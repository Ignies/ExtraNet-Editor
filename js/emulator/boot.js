// CMUComputerBootSplash: the tube warms up, each logo builds interlaced, then a progress bar and the OS's boot
// lines run under the last one before the desktop fades in. A click skips it. A hacked machine boots corrupted.

import { el } from '../util.js';
import { imageUrl } from '../repo.js';
import { fontStack, ensureFont } from '../fonts.js';
import { L } from './data.js';

const WARM_UP = 0.55;
const REVEAL = 1.1;
const HOLD = 1.0;
const SWAP = 0.3;
const LINE_EVERY = 0.32;
const FINAL_HOLD = 0.6;
const FADE_OUT = 0.35;
const ROW_HEIGHT = 2;
const GLITCH = '#$%&@!?/|<>{}[]~^*';

function loadImage(path) {
  return imageUrl(path).then(url => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  }));
}

/** Plays the splash in host. Resolves when it ends or is clicked away. */
export async function bootSplash(host, theme, strings, { corrupted = false } = {}) {
  ensureFont('Display');
  ensureFont('Mono');
  const logos = [];
  for (const logo of theme.logos) {
    if (logo === 'name') {
      logos.push(null);
      continue;
    }
    try {
      logos.push(await loadImage(logo));
    } catch {
      // A missing file is skipped.
    }
  }
  if (!logos.length) logos.push(null);
  const lines = [];
  let intrusion = 1;
  for (const line of theme.bootLines) {
    lines.push(line);
    if (corrupted && intrusion <= 4 && lines.length % 2 === 0) lines.push(L(strings, `cmu-deep-boot-${intrusion++}`));
  }
  if (corrupted) lines.push(L(strings, 'cmu-deep-boot-5'));
  const lastStart = WARM_UP + Math.max(0, logos.length - 1) * (REVEAL + HOLD + SWAP);
  const logEnd = lastStart + REVEAL + lines.length * LINE_EVERY;
  const end = logEnd + FINAL_HOLD + FADE_OUT;

  const canvas = el('canvas.emu-boot');
  host.append(canvas);
  const nameFont = `bold 30px ${fontStack('Display')}`;
  const monoFont = `12px ${fontStack('Mono')}`;

  return new Promise(resolve => {
    let time = 0;
    let last = performance.now();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      canvas.remove();
      resolve();
    };
    canvas.addEventListener('click', finish);
    const step = now => {
      if (done) return;
      if (!canvas.isConnected) {
        finish();
        return;
      }
      time += Math.min(0.1, (now - last) / 1000);
      last = now;
      if (time >= end) {
        finish();
        return;
      }
      draw();
      requestAnimationFrame(step);
    };

    function draw() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
      if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      if (time < WARM_UP) {
        warmUp(ctx, w, h, time / WARM_UP);
        return;
      }
      ctx.fillStyle = theme.background;
      ctx.fillRect(0, 0, w, h);
      const index = Math.min(logos.length - 1, Math.floor((time - WARM_UP) / (REVEAL + HOLD + SWAP)));
      const isLast = index >= logos.length - 1;
      const local = time - WARM_UP - index * (REVEAL + HOLD + SWAP);
      const logo = logos[index];
      ctx.font = nameFont;
      const box = logoBox(ctx, logo, w, h);
      const flicker = 0.9 + 0.1 * Math.sin(time * 37) * Math.max(0, 1 - local / REVEAL);
      let pulse = local > REVEAL ? 0.85 + 0.15 * Math.sin(time * 2.4) : 1;
      if (corrupted && Math.random() < 0.08) pulse *= 0.25;
      drawLogo(ctx, logo, box, flicker * pulse);
      const reveal = Math.max(0, Math.min(1, local / REVEAL));
      if (reveal < 1) cover(ctx, box, reveal);
      if (!isLast) {
        const swap = (local - REVEAL - HOLD) / SWAP;
        if (swap > 0) {
          ctx.globalAlpha = Math.min(1, swap);
          ctx.fillStyle = theme.background;
          ctx.fillRect(0, 0, w, h);
          ctx.globalAlpha = 1;
        }
        return;
      }
      log(ctx, w, box, local - REVEAL);
      if (corrupted) tears(ctx, w, h);
      const fade = (time - logEnd - FINAL_HOLD) / FADE_OUT;
      if (fade > 0) {
        ctx.globalAlpha = Math.min(1, fade);
        ctx.fillStyle = theme.background;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }
    }

    function warmUp(ctx, w, h, t) {
      const bright = mixHex(theme.phosphor, '#ffffff', 0.6);
      const cy = h / 2;
      if (t < 0.5) {
        const half = w / 2 * (t / 0.5);
        ctx.fillStyle = bright;
        ctx.fillRect(w / 2 - half, cy - 1, half * 2, 2);
        return;
      }
      const open = (t - 0.5) / 0.5;
      const halfHeight = Math.max(1, h / 2 * open);
      ctx.fillStyle = mixHex(bright, theme.background, open);
      ctx.fillRect(0, cy - halfHeight, w, halfHeight * 2);
    }

    function logoBox(ctx, logo, w, h) {
      let dw;
      let dh;
      if (logo) {
        const fit = Math.max(1, Math.floor(Math.min(w * 0.7 / logo.width, h * 0.35 / logo.height)));
        dw = logo.width * fit;
        dh = logo.height * fit;
      } else {
        dw = ctx.measureText(theme.name).width;
        dh = 36;
      }
      const x = Math.round((w - dw) / 2);
      const y = Math.round(h * 0.36 - dh / 2);
      return { x, y, w: dw, h: dh };
    }

    function drawLogo(ctx, logo, box, brightness) {
      if (logo) {
        ctx.globalAlpha = Math.max(0, Math.min(1, brightness));
        ctx.drawImage(logo, box.x, box.y, box.w, box.h);
        ctx.globalAlpha = 1;
        return;
      }
      ctx.font = nameFont;
      ctx.textBaseline = 'top';
      ctx.fillStyle = theme.phosphor;
      ctx.globalAlpha = 0.12 * brightness;
      for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) ctx.fillText(theme.name, box.x + ox, box.y + oy);
      ctx.globalAlpha = Math.min(1, brightness);
      ctx.fillText(theme.name, box.x, box.y);
      ctx.globalAlpha = 0.7 * brightness;
      ctx.fillRect(box.x, box.y + box.h + 6, box.w, 2);
      ctx.globalAlpha = 1;
    }

    function cover(ctx, box, reveal) {
      const top = box.y - 2;
      const bottom = box.y + box.h + 10;
      const rows = Math.ceil((bottom - top) / ROW_HEIGHT);
      const even = Math.max(0, Math.min(1, reveal * 2)) * rows;
      const odd = Math.max(0, Math.min(1, reveal * 2 - 1)) * rows;
      ctx.fillStyle = theme.background;
      for (let i = 0; i < rows; i++) {
        const shown = i % 2 === 0 ? i < even : i < odd;
        if (!shown) ctx.fillRect(box.x - 4, top + i * ROW_HEIGHT, box.w + 8, ROW_HEIGHT);
      }
    }

    function log(ctx, w, box, elapsed) {
      if (elapsed < 0) return;
      const barWidth = Math.max(box.w, Math.min(w * 0.6, 460));
      const left = (w - barWidth) / 2;
      let y = box.y + box.h + 30;
      const progress = lines.length === 0 ? 1 : Math.max(0, Math.min(1, elapsed / (lines.length * LINE_EVERY)));
      ctx.fillStyle = theme.phosphor;
      ctx.globalAlpha = 0.18;
      ctx.fillRect(left, y, barWidth, 12);
      ctx.globalAlpha = 1;
      ctx.fillRect(left, y, barWidth * progress, 12);
      y += 30;
      const shown = Math.min(lines.length, Math.floor(elapsed / LINE_EVERY) + 1);
      ctx.font = monoFont;
      ctx.textBaseline = 'top';
      for (let i = Math.max(0, shown - 3); i < shown; i++) {
        const text = corrupt(lines[i]);
        const width = ctx.measureText(text).width;
        ctx.fillStyle = i === shown - 1 ? theme.phosphor : theme.dim;
        ctx.fillText(text, (w - width) / 2, y);
        y += 19;
      }
    }

    function corrupt(line) {
      if (!corrupted) return line;
      return [...line].map(c => (c !== ' ' && Math.random() < 0.07 ? GLITCH[Math.floor(Math.random() * GLITCH.length)] : c)).join('');
    }

    function tears(ctx, w, h) {
      const bands = Math.floor(Math.random() * 4);
      for (let i = 0; i < bands; i++) {
        const y = Math.random() * h;
        const height = 2 + Math.random() * 10;
        const shift = (Math.random() - 0.5) * w * 0.3;
        ctx.globalAlpha = 0.12 + Math.random() * 0.2;
        ctx.fillStyle = theme.phosphor;
        ctx.fillRect(shift, y, w, height);
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, y + height, w, 2);
        ctx.globalAlpha = 1;
      }
    }

    requestAnimationFrame(step);
  });
}

function mixHex(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
