// YouTape's screen, ported from CMUTapePlayer in Content.CMU/Client/PersonalComputers/YouTape/CMUTapePlayer.cs:
// a 480 by 270 picture with each scene's background and ad picture, the people in it as dressed dolls and its props
// as their sprites, then over them the weather symbols, the news crawl, the strap across the lower third, the caption
// typed out line by line, the channel's bug or ADVERTISEMENT, and the deck's overlay: PLAY or PAUSE, the counter,
// tracking noise and the roll at the start of every scene.

import { imageUrl } from '../../repo.js';
import { ensureFont, FONT_FACES } from '../../fonts.js';
import { dollCanvas, propLayers, frameAt } from './looks.js';

export const SCREEN_WIDTH = 480;
export const SCREEN_HEIGHT = 270;

const TYPE_SPEED = 34;
// Robust sizes fonts in points at 96 DPI.
const pt = size => (size * 96) / 72;
const VHS = size => `${pt(size)}px ${FONT_FACES.Terminal.family}, ${FONT_FACES.Terminal.fallback}`;
const SANS = size => `700 ${pt(size)}px ${FONT_FACES.Sans.family}, ${FONT_FACES.Sans.fallback}`;

/** Fallback strings, for a repository whose locale does not have them yet. */
const FALLBACK = {
  'cmu-tape-play': 'PLAY >',
  'cmu-tape-pause': 'PAUSE ||',
  'cmu-tape-advert': 'ADVERTISEMENT',
  'cmu-tape-no-tape': 'NO TAPE',
  'cmu-tape-ended': 'END OF TAPE. PLEASE REWIND.',
};

const pictures = new Map();

/** A texture once it has loaded; null until then, or when it is missing. */
function picture(path) {
  if (!path) return null;
  if (!pictures.has(path)) {
    const slot = { image: null };
    pictures.set(path, slot);
    imageUrl(path).then(url => {
      const image = new Image();
      image.onload = () => (slot.image = image);
      image.src = url;
    }).catch(() => {});
  }
  return pictures.get(path).image;
}

/** Something drawn from a promise once it has resolved. */
function ready(cache, key, make) {
  if (!cache.has(key)) {
    const slot = { value: null };
    cache.set(key, slot);
    make().then(value => (slot.value = value)).catch(() => {});
  }
  return cache.get(key).value;
}

const dollReady = new Map();
const propReady = new Map();

export class TapePlayer {
  /** strings: the locale. weatherIcons: the grammar's icon per condition. onEnded: the tape ran out. */
  constructor(strings = {}, { onEnded = () => {} } = {}) {
    this.strings = strings;
    this.weatherIcons = {};
    this.onEnded = onEnded;
    this.tape = null;
    this.time = 0;
    this.playing = false;
    ensureFont('Terminal');
    ensureFont('Sans');
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'emu-tape-screen';
    this.ctx = this.canvas.getContext('2d');
    this.scale = 0;
    this.last = performance.now();
    let seen = false;
    const loop = now => {
      if (this.canvas.isConnected) seen = true;
      else if (seen) return;
      this.frame(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  t(id) {
    return this.strings[id] ?? FALLBACK[id] ?? id;
  }

  load(tape) {
    this.tape = tape;
    this.time = 0;
    this.playing = true;
  }

  togglePlay() {
    if (!this.tape) return;
    if (this.time >= this.tape.length) this.time = 0;
    this.playing = !this.playing;
  }

  /** Winds the tape to this many seconds in, for previews. */
  seek(seconds) {
    this.time = Math.min(Math.max(seconds, 0), this.tape ? this.tape.length : 0);
  }

  rewind() {
    this.time = 0;
    this.playing = false;
  }

  /** The scene playing now and how far into it. */
  current() {
    if (!this.tape) return { scene: null, at: 0 };
    let start = 0;
    for (const scene of this.tape.scenes) {
      if (this.time < start + scene.duration) return { scene, at: this.time - start };
      start += scene.duration;
    }
    return { scene: null, at: 0 };
  }

  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.tape && this.playing) {
      this.time += dt;
      if (this.time >= this.tape.length) {
        this.time = this.tape.length;
        this.playing = false;
        this.onEnded();
      }
    }
    this.draw(now / 1000);
  }

  // ---------------------------------------------------------------- drawing

  fit() {
    const scale = Math.max(1, Math.round(window.devicePixelRatio || 1));
    if (scale !== this.scale) {
      this.scale = scale;
      this.canvas.width = SCREEN_WIDTH * scale;
      this.canvas.height = SCREEN_HEIGHT * scale;
    }
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  /** Width of a string in a font. */
  width(font, text) {
    this.ctx.font = font;
    return this.ctx.measureText(text).width;
  }

  /** The font's ascent and line height, as Robust's Font.GetAscent and GetLineHeight. */
  metrics(font) {
    this.ctx.font = font;
    const m = this.ctx.measureText('Hg');
    const ascent = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent ?? 10;
    const descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent ?? 3;
    return { ascent, lineHeight: ascent + descent };
  }

  /** DrawString: the position is the top left of the line. */
  text(font, x, y, value, colour) {
    const { ascent } = this.metrics(font);
    this.ctx.font = font;
    this.ctx.fillStyle = colour;
    this.ctx.textBaseline = 'alphabetic';
    this.ctx.fillText(value, x, y + ascent);
  }

  rect(x0, y0, x1, y1, colour) {
    this.ctx.fillStyle = colour;
    this.ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }

  draw(seconds) {
    this.fit();
    const ctx = this.ctx;
    const W = SCREEN_WIDTH;
    const H = SCREEN_HEIGHT;
    // CMUTapePlayer.Draw: black, the background and an ad's picture, behind the actors
    this.rect(0, 0, W, H, '#000000');
    const { scene, at } = this.current();
    if (scene) {
      const background = picture(scene.background);
      if (background) ctx.drawImage(background, 0, 0, W, H);
      const ad = scene.ad ? picture(scene.ad) : null;
      if (ad) {
        const width = Math.min(W * 0.7, ad.naturalWidth * 2);
        const height = (width * ad.naturalHeight) / ad.naturalWidth;
        ctx.drawImage(ad, (W - width) / 2, H * 0.18, width, height);
      }
      this.drawActors(scene, at, seconds);
    }
    this.drawOverlay(scene, at);
  }

  /** The scene's people and props, feet where the scene puts them, the talkers bobbing while the tape plays. */
  drawActors(scene, at, seconds) {
    for (const actor of scene.actors) {
      const size = 32 * actor.scale;
      const bob = actor.talking && this.playing ? Math.abs(Math.sin(at * 9)) * 2 : 0;
      const left = actor.at[0] * SCREEN_WIDTH - size / 2;
      const top = actor.at[1] * SCREEN_HEIGHT - size - bob;
      if (actor.prop) {
        const layers = ready(propReady, actor.prop, () => propLayers(actor.prop));
        if (!layers) continue;
        for (const layer of layers) {
          const frame = frameAt(layer, seconds);
          const w = layer.w * actor.scale;
          const h = layer.h * actor.scale;
          // EntityPrototypeView centres the sprite in its box
          this.ctx.drawImage(layer.image, frame.sx, frame.sy, layer.w, layer.h, left + (size - w) / 2, top + (size - h) / 2, w, h);
        }
      } else if (actor.outfit) {
        const doll = ready(dollReady, actor.outfit, () => dollCanvas(actor.outfit));
        if (doll) this.ctx.drawImage(doll, left, top, size, size);
      }
    }
  }

  /** CMUTapeOverlay.Draw */
  drawOverlay(scene, at) {
    const W = SCREEN_WIDTH;
    const H = SCREEN_HEIGHT;
    const tape = this.tape;
    if (!tape) {
      this.centre(VHS(14), this.t('cmu-tape-no-tape'), '#FFFFFF');
      return;
    }
    if (!scene) {
      this.centre(VHS(14), this.t('cmu-tape-ended'), '#FFFFFF');
      this.drawDeck();
      return;
    }

    this.drawWeather(scene);
    const small = SANS(9);
    let bottom = H;
    if (scene.ticker) {
      const band = 14;
      this.rect(0, bottom - band, W, bottom, 'rgba(16, 16, 48, 0.9)');
      const width = this.width(small, scene.ticker);
      const x = W - ((this.time * 45) % (W + width));
      this.text(small, x, bottom - band + 1, scene.ticker, '#FFFFFF');
      bottom -= band;
    }
    if (scene.strap) {
      const font = SANS(11);
      const height = 18;
      const top = bottom - 44;
      const width = Math.min(W - 20, this.width(font, scene.strap) + 20);
      const ad = scene.kind === 'ad';
      this.rect(10, top, 10 + width, top + height, ad ? '#E8C020' : '#B01818');
      this.text(font, 20, top + 2, scene.strap, ad ? '#000000' : '#FFFFFF');
    }
    this.drawCaption(scene, at, bottom);
    if (scene.kind === 'ad') {
      const advert = this.t('cmu-tape-advert');
      const font = VHS(10);
      this.text(font, W - this.width(font, advert) - 14, 8, advert, 'rgba(255, 255, 255, 0.8)');
    } else if (tape.channel.length > 0 && scene.kind !== 'card' && scene.kind !== 'standby') {
      this.text(small, W - this.width(small, tape.channel) - 10, 8, tape.channel, 'rgba(255, 255, 255, 0.7)');
    }
    this.drawDeck();
    this.drawNoise(at);
  }

  /** The line being said now, typed out, in a box over the bottom of the picture. */
  drawCaption(scene, at, bottom) {
    if (!scene.lines.length) return;
    const W = SCREEN_WIDTH;
    const each = scene.duration / scene.lines.length;
    const index = Math.min(scene.lines.length - 1, Math.trunc(at / each));
    const line = scene.lines[index];
    const shown = line.slice(0, Math.min(line.length, Math.trunc((at - index * each) * TYPE_SPEED)));
    const font = SANS(10);
    const lines = this.wrap(font, shown, W - 40);
    const { lineHeight } = this.metrics(font);
    const height = lines.length * lineHeight + 8;
    let top = bottom - height - 4;
    if (scene.strap) top = Math.min(top, bottom - 44 - height - 4);
    if (lines.length > 0) this.rect(12, top, W - 12, top + height, 'rgba(0, 0, 0, 0.65)');
    lines.forEach((value, i) => this.text(font, 20, top + 4 + i * lineHeight, value, '#FFF6C8'));
  }

  drawWeather(scene) {
    const font = SANS(9);
    const { lineHeight } = this.metrics(font);
    for (const weather of scene.weather) {
      const cx = weather.at[0] * SCREEN_WIDTH;
      const cy = weather.at[1] * SCREEN_HEIGHT;
      const icon = picture(this.weatherIcons[weather.icon]);
      const size = 24 * 2;
      if (icon) this.ctx.drawImage(icon, cx - size / 2, cy - size / 2, size, size);
      const width = this.width(font, weather.label);
      const x = cx - width / 2;
      const y = cy + size / 2;
      this.rect(x - 3, y - 1, x - 3 + width + 6, y - 1 + lineHeight + 2, 'rgba(0, 0, 0, 0.55)');
      this.text(font, x, y, weather.label, '#FFFFFF');
    }
  }

  /** PLAY or PAUSE and the tape counter, top left, the way a deck shows them. */
  drawDeck() {
    const font = VHS(11);
    const state = this.t(this.playing ? 'cmu-tape-play' : 'cmu-tape-pause');
    const t = Math.trunc(this.time);
    const counter = `${Math.trunc(t / 3600)}:${String(Math.trunc(t / 60) % 60).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    const { lineHeight } = this.metrics(font);
    this.text(font, 10, 8, state, 'rgba(255, 255, 255, 0.85)');
    this.text(font, 10, 10 + lineHeight + 2, counter, 'rgba(255, 255, 255, 0.85)');
  }

  /** Tracking lines, and a roll for the first moment of every scene. */
  drawNoise(at) {
    const H = SCREEN_HEIGHT;
    for (let i = 0; i < 3; i++) {
      const y = Math.random() * H;
      this.rect(0, y, SCREEN_WIDTH, y + 1, `rgba(255, 255, 255, ${0.06 + Math.random() * 0.08})`);
    }
    if (at < 0.25) {
      const band = H * (1 - at / 0.25);
      this.rect(0, band, SCREEN_WIDTH, Math.min(H, band + 18), 'rgba(255, 255, 255, 0.25)');
    }
  }

  centre(font, value, colour) {
    const width = this.width(font, value);
    const { lineHeight } = this.metrics(font);
    this.text(font, SCREEN_WIDTH / 2 - width / 2, SCREEN_HEIGHT / 2 - lineHeight / 2, value, colour);
  }

  wrap(font, value, width) {
    const lines = [];
    let line = '';
    for (const word of value.split(' ')) {
      const next = line.length === 0 ? word : `${line} ${word}`;
      if (line.length > 0 && this.width(font, next) > width) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line.length > 0) lines.push(line);
    return lines;
  }
}
