// The computer as a machine (CMUComputerMachine and CMUComputerPanel): the drawn bezel round the screen, a
// nine-slice at 2 px per art pixel, and the front panel under it at 3 px per art pixel, with the ATM's card
// reader, the power key and the power and disk lights, all from the game's own art, in any casing the game has
// (frame_, plate_, fascia_, housing_<casing>.png and power.rsi's <casing>_ states). A desk machine's printer feeds
// its paper out of the slot in the right end (printer_paper.rsi); a laptop has none.

import { el } from '../util.js';
import { fetchResource } from '../repo.js';
import { loadRsi, loadStateSheet, stateFrames } from '../sprites.js';
import { canPrint } from './computers.js';

const ART = '/Textures/CMU14/PersonalComputers/Machine/';
const READER = '/Textures/CMU14/ColonyEconomy/atm_reader.rsi';
const LEDS = '/Textures/CMU14/ColonyEconomy/atm_leds.rsi';
const CARD = '/Textures/_RMC14/Objects/CMIDs/id.rsi';
const CARD_STATE = 'id_generic';

const ZOOM = 2;
const TILE = 32;
const FRAME = { left: 18, top: 20, right: 18, bottom: 15 };
const GLASS = 3;
const PLATE_Y = 2;
const GLASS_OFF = 22;

const PANEL_ZOOM = 3;
const ART_HEIGHT = 22;
const LEFT_END = 45;
const RIGHT_END = 160;
const DISK_LED = [36, 6, 5, 5];
const HOUSING = [60, -8, 55, 30];
const READER_RECT = [62, -18, 51, 42];
const CARD_RECT = [62, -32, 51, 48];
const POWER_LED = [119, 12, 5, 5];
const POWER = [130, 3, 21, 17];
// Printed paper rises out of the printer's slot, up over the bezel's bottom edge and the screen.
const PAPER = [7, -33, 46, 42];
// The paper's feed: a frame for each few pixels out, then it hangs there a moment and is torn off.
const PAPER_FRAMES = 10;
const FEED_SECONDS = 2.4;
const HANG_SECONDS = 1.6;
const TORN_SECONDS = 0.5;

const INSERT_KEYS = [[0, 0], [0.30, 18], [0.40, 18], [0.70, 30], [0.78, 29]];
const EJECT_KEYS = [[0, 29], [0.12, 21], [0.32, 21], [0.60, 0]];
const CARD_LEFT = 9;
const CARD_SIZE = 32;

/** How much bigger the machine is than its screen, in CSS pixels. */
export const CHROME = {
  x: (FRAME.left + FRAME.right - 2 * GLASS) * ZOOM,
  y: (FRAME.top + FRAME.bottom - 2 * GLASS) * ZOOM + ART_HEIGHT * PANEL_ZOOM,
  minWidth: (LEFT_END + RIGHT_END) * PANEL_ZOOM,
};

function image(path) {
  return fetchResource(path, 'blob').then(({ data }) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`unreadable ${path}`));
    img.src = URL.createObjectURL(data);
  }));
}

async function rsiStates(path, names) {
  const rsi = await loadRsi(path);
  const out = {};
  await Promise.all(names.map(async name => {
    const state = rsi.states.get(name);
    if (!state) return;
    const sheet = await loadStateSheet(rsi.path, name);
    const frames = stateFrames(rsi, state, sheet, 0);
    out[name] = { sheet, frames, w: rsi.size.x, h: rsi.size.y, total: frames.reduce((s, f) => s + f.delay, 0) };
  }));
  return out;
}

function frameAt(s, t) {
  let left = t % s.total;
  for (const f of s.frames) {
    if (left < f.delay) return f;
    left -= f.delay;
  }
  return s.frames[s.frames.length - 1];
}

function smooth(keys, time) {
  for (let i = 1; i < keys.length; i++) {
    const [t0, v0] = keys[i - 1];
    const [t1, v1] = keys[i];
    if (time > t1) continue;
    const t = t1 > t0 ? Math.min(1, Math.max(0, (time - t0) / (t1 - t0))) : 1;
    return Math.round(v0 + (v1 - v0) * t * t * (3 - 2 * t));
  }
  return keys[keys.length - 1][1];
}

export class Machine {
  /** onPower(): the power key was pressed. onReader(): the card reader was clicked. */
  constructor({ onPower, onReader, tips = {} }) {
    this.on = false;
    this.card = false;
    this.busy = 0;
    this.nextBlip = 2;
    this.art = null;
    this.cardKeys = null;
    this.cardTime = 0;
    this.cardShown = false;
    this.hover = false;
    this.pressed = 0;
    // CMUComputerPanel._printing: seconds into the paper's feed, or -1 with nothing coming out
    this.printing = -1;
    this.torn = [];
    this.screen = el('div.emu-screen');
    this.canvas = el('canvas.emu-machine-art');
    this.power = el('button.emu-hit.emu-power', { type: 'button', title: tips.power || 'Power', 'aria-label': tips.power || 'Power' });
    this.reader = el('button.emu-hit.emu-reader', { type: 'button', title: tips.reader || 'Card reader', 'aria-label': tips.reader || 'Card reader' });
    this.power.addEventListener('pointerenter', () => { this.hover = true; });
    this.power.addEventListener('pointerleave', () => { this.hover = false; });
    this.power.addEventListener('pointerdown', () => { this.pressed = 0.09; this.down = true; });
    this.power.addEventListener('pointerup', () => { this.down = false; });
    this.power.addEventListener('click', () => onPower());
    this.reader.addEventListener('click', () => {
      this.pulse(0.6);
      onReader();
    });
    this.root = el('div.emu-machine', {}, this.screen, this.canvas, this.power, this.reader);
    this.last = performance.now();
    this.t = 0;
    const loop = now => {
      if (!this.root.isConnected && this.started) return;
      this.started = true;
      this.frame(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  async setCasing(casing) {
    const name = casing.toLowerCase();
    const paperStates = [...Array.from({ length: PAPER_FRAMES }, (_, i) => `out_${i + 1}`), 'sheet'];
    const [frame, plate, fascia, housing, glassOff, power, reader, leds, card, paper] = await Promise.all([
      image(`${ART}frame_${name}.png`),
      image(`${ART}plate_${name}.png`).catch(() => null),
      image(`${ART}fascia_${name}.png`),
      image(`${ART}housing_${name}.png`),
      image(`${ART}glass_off.png`),
      rsiStates(`${ART}power.rsi`, ['off', 'off_hover', 'off_pressed', 'on', 'on_hover', 'on_pressed'].map(s => `${name}_${s}`)),
      rsiStates(READER, ['lights_ready', 'lights_ok', 'bay_glass']),
      rsiStates(LEDS, ['green', 'amber_busy']),
      rsiStates(CARD, [CARD_STATE]).catch(() => ({})),
      // Laptops have no printer.
      canPrint(name) ? rsiStates(`${ART}printer_paper.rsi`, paperStates).catch(() => null) : null,
    ]);
    this.art = { name, frame, plate, fascia, housing, glassOff, power, reader, leds, card: card[CARD_STATE] || null, paper };
    this.printing = -1;
    this.resize(this.width, this.height);
  }

  /** Sizes the machine round a screen of this many CSS pixels. */
  resize(screenWidth, screenHeight) {
    if (!screenWidth) return;
    this.width = Math.max(screenWidth, CHROME.minWidth - CHROME.x);
    this.height = screenHeight;
    const w = this.width + CHROME.x;
    const h = this.height + CHROME.y;
    this.W = w;
    this.H = h;
    this.bezelBottom = h - ART_HEIGHT * PANEL_ZOOM;
    Object.assign(this.root.style, { width: `${w}px`, height: `${h}px` });
    Object.assign(this.screen.style, {
      left: `${(FRAME.left - GLASS) * ZOOM}px`, top: `${(FRAME.top - GLASS) * ZOOM}px`,
      width: `${this.width}px`, height: `${this.height}px`,
    });
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    Object.assign(this.canvas.style, { width: `${w}px`, height: `${h}px` });
    const right = w - RIGHT_END * PANEL_ZOOM;
    const place = (node, [x, y, rw, rh], origin) => Object.assign(node.style, {
      left: `${origin + x * PANEL_ZOOM}px`, top: `${this.bezelBottom + y * PANEL_ZOOM}px`, width: `${rw * PANEL_ZOOM}px`, height: `${rh * PANEL_ZOOM}px`,
    });
    place(this.power, POWER, right);
    place(this.reader, READER_RECT, right);
  }

  pulse(seconds) {
    this.busy = Math.max(this.busy, seconds);
  }

  /** Whether this machine has a printer: not a laptop (CMUComputerPrinting.CanPrint). */
  get canPrint() {
    return !!(this.art && this.art.paper);
  }

  /**
   * CMUComputerPanel.Print: feeds a sheet out of the printer's slot, lets it hang a moment and tears it off.
   * onTorn(): the sheet is off, at the end of the feed.
   */
  print(onTorn) {
    if (!this.canPrint) return false;
    this.printing = 0;
    this.pulse(FEED_SECONDS);
    if (onTorn) this.torn.push(onTorn);
    return true;
  }

  /** Where the paper comes out, in CSS pixels in the machine: the sprite's rectangle over the right end. */
  paperRect() {
    const q = PANEL_ZOOM;
    const right = this.W - RIGHT_END * q;
    const [x, y, w, h] = PAPER;
    return { left: right + x * q, top: this.bezelBottom + y * q, width: w * q, height: h * q };
  }

  /** The state to show for the paper now, or null: out_1..out_10 through the feed, out_10 hanging, then the torn sheet. */
  paperState() {
    const t = this.printing;
    if (t < 0) return null;
    if (t < FEED_SECONDS) return `out_${Math.min(PAPER_FRAMES, Math.max(1, Math.floor(t / FEED_SECONDS * PAPER_FRAMES) + 1))}`;
    if (t < FEED_SECONDS + HANG_SECONDS) return `out_${PAPER_FRAMES}`;
    return 'sheet';
  }

  setCard(inserted, animate = true) {
    if (inserted === this.card) return;
    this.card = inserted;
    if (inserted) {
      this.cardKeys = INSERT_KEYS;
      this.cardTime = animate ? 0 : INSERT_KEYS[INSERT_KEYS.length - 1][0];
      this.cardShown = true;
    } else if (this.cardShown) {
      this.cardKeys = EJECT_KEYS;
      this.cardTime = animate ? 0 : 1;
    }
  }

  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    this.busy -= dt;
    this.nextBlip -= dt;
    this.pressed -= dt;
    if (this.on && this.nextBlip <= 0) {
      this.nextBlip = 2 + Math.random() * 5;
      this.pulse(0.1 + Math.random() * 0.3);
    }
    if (this.printing >= 0) {
      this.printing += dt;
      if (this.printing >= FEED_SECONDS + HANG_SECONDS + TORN_SECONDS) {
        this.printing = -1;
        for (const done of this.torn.splice(0)) done();
      }
    }
    if (this.cardKeys) {
      this.cardTime += dt;
      if (this.cardKeys === EJECT_KEYS && this.cardTime >= EJECT_KEYS[EJECT_KEYS.length - 1][0]) {
        this.cardShown = false;
        this.cardKeys = null;
      }
    }
    this.draw();
  }

  draw() {
    const a = this.art;
    if (!a || !this.W) return;
    const ctx = this.canvas.getContext('2d');
    const dpr = this.canvas.width / this.W;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.W, this.H);
    const k = ZOOM;
    const W = this.W;
    const B = this.bezelBottom;

    // A dead tube while off: the glass nine-slice over the screen.
    if (!this.on) {
      const x0 = (FRAME.left - GLASS) * k;
      const y0 = (FRAME.top - GLASS) * k;
      nine(ctx, a.glassOff, GLASS_OFF, x0, y0, this.width, this.height, k);
    }

    // The bezel: corners as drawn, edges repeated, the middle left open for the screen.
    const f = a.frame;
    const L = FRAME.left;
    const T = FRAME.top;
    const R = FRAME.right;
    const Bo = FRAME.bottom;
    const rows = [[0, T, 0, T * k], [T, TILE, T * k, B - Bo * k], [T + TILE, Bo, B - Bo * k, B]];
    const cols = [[0, L, 0, L * k], [L, TILE, L * k, W - R * k], [L + TILE, R, W - R * k, W]];
    rows.forEach(([sy, sh, dy0, dy1], r) => {
      cols.forEach(([sx, sw, dx0, dx1], c) => {
        if (r === 1 && c === 1) return;
        repeat(ctx, f, sx, sy, sw, sh, dx0, dy0, dx1, dy1, k, c === 1, r === 1);
      });
    });
    if (a.plate) {
      const px = Math.floor((W / k - a.plate.width) / 2) * k;
      ctx.drawImage(a.plate, px, PLATE_Y * k, a.plate.width * k, a.plate.height * k);
    }

    // The front panel: a left end, a repeating vent, and the right end with the reader and the keys.
    const q = PANEL_ZOOM;
    const right = W - RIGHT_END * q;
    repeat(ctx, a.fascia, 0, 0, LEFT_END, ART_HEIGHT, 0, B, LEFT_END * q, B + ART_HEIGHT * q, q, false, false);
    repeat(ctx, a.fascia, LEFT_END, 0, TILE, ART_HEIGHT, LEFT_END * q, B, right, B + ART_HEIGHT * q, q, true, false);
    repeat(ctx, a.fascia, LEFT_END + TILE, 0, a.fascia.width - LEFT_END - TILE, ART_HEIGHT, right, B, W, B + ART_HEIGHT * q, q, false, false);
    const at = ([x, y, w, h], origin = right) => [origin + x * q, B + y * q, w * q, h * q];
    const [hx, hy, hw, hh] = at(HOUSING);
    ctx.drawImage(a.housing, hx, hy, hw, hh);
    const sprite = (state, rect, t = this.t) => {
      if (!state) return;
      const fr = frameAt(state, t);
      const [x, y, w, h] = rect;
      ctx.drawImage(state.sheet, fr.sx, fr.sy, state.w, state.h, x, y, w, h);
    };
    const lights = !this.on ? null : this.card ? a.reader.lights_ok : a.reader.lights_ready;
    sprite(lights, at(READER_RECT));
    if (this.cardShown && a.card) this.drawCard(ctx, a.card, at(CARD_RECT));
    sprite(a.reader.bay_glass, at(READER_RECT));
    if (this.on) sprite(a.leds.green, at(POWER_LED));
    if (this.on && this.busy > 0) sprite(a.leds.amber_busy, at(DISK_LED, 0));
    const look = this.pressed > 0 || this.down ? '_pressed' : this.hover ? '_hover' : '';
    sprite(a.power[`${a.name}_${this.on ? 'on' : 'off'}${look}`] || a.power[`${a.name}_${this.on ? 'on' : 'off'}`], at(POWER));
    // Last, over the bezel and the screen: the paper coming out of the printer.
    const paper = this.paperState();
    if (paper && a.paper) sprite(a.paper[paper], at(PAPER), 0);
  }

  /** The ID card standing upright in the slot, as the game draws it, cut off where it is inside the machine. */
  drawCard(ctx, card, [x, y, w, h]) {
    const art = w / CARD_RECT[2];
    const keys = this.cardKeys || INSERT_KEYS;
    const top = this.cardKeys ? smooth(keys, this.cardTime) : keys[keys.length - 1][1];
    const dx = x + CARD_LEFT * art;
    const dy = y + top * art;
    const size = CARD_SIZE * art;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const fr = frameAt(card, this.t);
    ctx.drawImage(card.sheet, fr.sx, fr.sy, card.w, card.h, dx, dy, size, size);
    ctx.restore();
  }
}

/** DrawRepeated: tiles the source along the axes asked for, cutting the last copy short; stretches otherwise. */
function repeat(ctx, img, sx, sy, sw, sh, dx0, dy0, dx1, dy1, k, alongX, alongY) {
  const stepX = alongX ? sw * k : dx1 - dx0;
  const stepY = alongY ? sh * k : dy1 - dy0;
  if (stepX <= 0 || stepY <= 0) return;
  for (let y = dy0; y < dy1; y += stepY) {
    const hh = Math.min(stepY, dy1 - y);
    for (let x = dx0; x < dx1; x += stepX) {
      const ww = Math.min(stepX, dx1 - x);
      const srcW = alongX ? sw * (ww / stepX) : sw;
      const srcH = alongY ? sh * (hh / stepY) : sh;
      ctx.drawImage(img, sx, sy, srcW, srcH, x, y, ww, hh);
    }
  }
}

/** A nine-slice with stretched edges and middle. */
function nine(ctx, img, m, x, y, w, h, k) {
  const M = m * k;
  const iw = img.width;
  const ih = img.height;
  const xs = [[0, m, x, M], [m, iw - 2 * m, x + M, w - 2 * M], [iw - m, m, x + w - M, M]];
  const ys = [[0, m, y, M], [m, ih - 2 * m, y + M, h - 2 * M], [ih - m, m, y + h - M, M]];
  for (const [sy, sh, dy, dh] of ys) for (const [sx, sw, dx, dw] of xs) if (dw > 0 && dh > 0) ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}
