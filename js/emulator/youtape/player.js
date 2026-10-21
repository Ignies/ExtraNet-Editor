// YouTape's screen, ported from CMUTapePlayer in Content.CMU/Client/PersonalComputers/YouTape/CMUTapePlayer.cs:
// a widescreen (520 by 292, wide enough for a sportsbook arena at its own size) or a reel's portrait (190 by 338)
// picture with each scene's background and ad picture, a match replayed in its real arena or an arcade game playing
// itself, the people in it as dressed dolls (a streamer cut in from the chest up over the game's corner) and its props
// as their sprites, then over them the weather symbols, the news crawl, the strap across the lower third, the caption
// typed out line by line, the channel's bug or ADVERTISEMENT, and the deck's overlay: PLAY or PAUSE, the counter,
// tracking noise and the roll at the start of every scene.
//
// The game stacks controls: the screen draws the background, then its children (the arena or game, the actors), then
// the overlay. Here that is three layers: a canvas behind, the arena's or game's own canvas, and a canvas in front.

import { imageUrl } from '../../repo.js';
import { ensureFont, fontStack, FONT_FACES } from '../../fonts.js';
import { dollCanvas, propLayers, frameAt, lookSeed } from './looks.js';
import { Arena, ArenaWidth, ArenaHeight } from '../sports/arena.js';
import { HuggerRun } from '../arcade/hugger.js';
import { TrackerReflex } from '../arcade/tracker.js';
import { SCREEN_W, SCREEN_H } from '../arcade/screen.js';

/** Wide enough for a sportsbook arena at its own size: its dolls cannot be scaled crisply. */
export const WIDESCREEN = [ArenaWidth, 292];
/** A reel's tall screen. */
export const PORTRAIT = [190, 338];

const TYPE_SPEED = 34;
/** A streamer's doll is drawn this big, and cut off at the chest by the facecam. */
const BUST_SCALE = 5;
/** The arcade games' own phosphor, as CMUHuggerRun and CMUTrackerReflex draw by default. */
const GAME_COLOURS = { green: '#3FE05A', greenRgb: [63, 224, 90], dim: '#1F8A33' };
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

const propReady = new Map();

function layerCanvas(className) {
  const canvas = document.createElement('canvas');
  canvas.className = className;
  return canvas;
}

export class TapePlayer {
  /**
   * strings: the locale. size: WIDESCREEN or PORTRAIT. onEnded: the tape ran out. weatherIcons (set later): the
   * grammar's icon per condition.
   */
  constructor(strings = {}, { onEnded = () => {}, size = WIDESCREEN } = {}) {
    this.strings = strings;
    this.weatherIcons = {};
    this.onEnded = onEnded;
    this.width = size[0];
    this.height = size[1];
    this.tape = null;
    this.time = 0;
    this.playing = false;
    // the characters' dolls, by outfit and look, as CMUTapePlayer keeps one dummy per character
    this.dolls = new Map();
    // a tape's matches and games, by sport and game, as CMUTapePlayer keeps them while the tape is loaded
    this.arenas = new Map();
    this.games = new Map();
    this.embedded = null;
    this.sceneIndex = -1;
    ensureFont('Terminal');
    ensureFont('Sans');
    this.back = layerCanvas('emu-tape-layer');
    this.front = layerCanvas('emu-tape-layer');
    this.embeds = document.createElement('div');
    this.embeds.className = 'emu-tape-embeds';
    this.element = document.createElement('div');
    this.element.className = 'emu-tape-screen';
    this.element.style.width = `${this.width}px`;
    this.element.style.height = `${this.height}px`;
    this.element.append(this.back, this.embeds, this.front);
    this.ctx = this.back.getContext('2d');
    this.scale = 0;
    this.last = performance.now();
    let seen = false;
    const loop = now => {
      if (this.element.isConnected) seen = true;
      else if (seen) return;
      this.frame(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  t(id) {
    return this.strings[id] ?? FALLBACK[id] ?? id;
  }

  /** A reel's tall screen, which letters smaller and leaves the channel to the page. */
  get narrow() {
    return this.width < 300;
  }

  /** Where a match's arena sits, under the deck's counter. */
  get arenaAt() {
    return [0, this.height - ArenaHeight - 6];
  }

  /** How big the game is drawn: as big as the screen allows, the way a stream fills the frame. */
  get gameZoom() {
    return this.narrow ? (this.width - 8) / SCREEN_W : Math.min((this.width - 8) / SCREEN_W, (this.height - 8) / SCREEN_H);
  }

  get gameSize() {
    return [SCREEN_W * this.gameZoom, SCREEN_H * this.gameZoom];
  }

  /** Where a let's play's game sits, clear of the streamer's facecam. */
  get gameAt() {
    const [w, h] = this.gameSize;
    // a reel puts the game at the top, the way a phone stream does
    return this.narrow ? [(this.width - w) / 2, 8] : [(this.width - w) / 2, (this.height - h) / 2];
  }

  /** Where the streamer is cut in over the game: its bottom right corner. [left, top, width, height] */
  get facecam() {
    const [gw, gh] = this.gameSize;
    const [gx, gy] = this.gameAt;
    // A tall reel stacks like a phone stream: the game on top, the streamer under it, the width of the screen.
    if (this.narrow) return [8, gy + gh + 4, this.width - 16, 88];
    const w = Math.min(110, gw * 0.36);
    const h = Math.min(84, gh * 0.4);
    return [gx + gw - w, gy + gh - h, w, h];
  }

  load(tape) {
    this.tape = tape;
    // forget the dolls of characters the new tape does not have
    const cast = new Set();
    for (const scene of tape.scenes) for (const actor of scene.actors) if (actor.outfit) cast.add(this.dollKey(tape, actor));
    for (const key of [...this.dolls.keys()]) if (!cast.has(key)) this.dolls.delete(key);
    // A new tape brings its own matches and games; the old ones go.
    this.embeds.replaceChildren();
    this.embedded = null;
    this.arenas.clear();
    this.games.clear();
    this.sceneIndex = -1;
    this.time = 0;
    this.playing = true;
  }

  dollKey(tape, actor) {
    return `${actor.outfit}|${lookSeed(tape.seed, actor.character)}`;
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

  /** The scene playing now, its place in the tape and how far into it. */
  current() {
    if (!this.tape) return { scene: null, index: -1, at: 0 };
    let start = 0;
    for (let i = 0; i < this.tape.scenes.length; i++) {
      const scene = this.tape.scenes[i];
      if (this.time < start + scene.duration) return { scene, index: i, at: this.time - start };
      start += scene.duration;
    }
    return { scene: null, index: -1, at: 0 };
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
    const { scene, index, at } = this.current();
    if (index !== this.sceneIndex) {
      this.sceneIndex = index;
      this.showScene(scene, now / 1000);
    }
    // the arena runs on its own clock, as the game's control does, whether the tape plays or not
    if (this.embedded && this.embedded.arena) this.embedded.arena.frame(now / 1000);
    this.draw(scene, at, now / 1000);
  }

  /** CMUTapePlayer.ShowScene: puts the scene's arena or game up when the scene changes. */
  showScene(scene, now) {
    // off screen, a game waits where it is (its loop pauses while it is not on show) and an arena is shown afresh
    for (const child of this.embeds.children) child.style.display = 'none';
    this.embedded = null;
    if (!scene) return;
    if (scene.match) {
      let arena = this.arenas.get(scene.match.sport);
      if (!arena) {
        arena = Arena.create(scene.match.sport, fontStack('Sans'));
        Object.assign(arena.canvas.style, { position: 'absolute', width: `${ArenaWidth}px`, height: `${ArenaHeight}px` });
        this.arenas.set(scene.match.sport, arena);
        this.embeds.append(arena.canvas);
      }
      const [x, y] = this.arenaAt;
      Object.assign(arena.canvas.style, { left: `${x}px`, top: `${y}px`, display: 'block' });
      arena.show(scene.match, now, true, scene.matchFrom);
      this.embedded = { arena, element: arena.canvas };
    } else if (scene.game) {
      // One game per tape, carried on from scene to scene; it freezes while a scene without it is up.
      let screen = this.games.get(scene.game);
      if (!screen) {
        screen = scene.game === 'TrackerReflex' ? new TrackerReflex(GAME_COLOURS) : new HuggerRun(GAME_COLOURS);
        screen.demo = true;
        this.games.set(scene.game, screen);
        this.embeds.append(screen.canvas);
      }
      this.fitGame(screen);
      screen.canvas.style.display = 'block';
      this.embedded = { screen, element: screen.canvas };
    }
  }

  /** Enlarges a game screen to fill the frame: device pixels per game unit, as a downloaded game's window does. */
  fitGame(screen) {
    const ratio = window.devicePixelRatio || 1;
    const perUnit = this.gameZoom * ratio;
    const [w, h] = this.gameSize;
    const [x, y] = this.gameAt;
    if (screen.dpr !== perUnit) {
      screen.dpr = perUnit;
      screen.canvas.width = Math.round(SCREEN_W * perUnit);
      screen.canvas.height = Math.round(SCREEN_H * perUnit);
    }
    Object.assign(screen.canvas.style, { position: 'absolute', left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
  }

  // ---------------------------------------------------------------- drawing

  fit() {
    const scale = Math.max(1, Math.round(window.devicePixelRatio || 1));
    if (scale !== this.scale) {
      this.scale = scale;
      for (const canvas of [this.back, this.front]) {
        canvas.width = this.width * scale;
        canvas.height = this.height * scale;
      }
    }
    for (const canvas of [this.back, this.front]) {
      const ctx = canvas.getContext('2d');
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  /** Width of a string in a font. */
  measure(font, text) {
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

  draw(scene, at, seconds) {
    this.fit();
    const W = this.width;
    const H = this.height;
    // CMUTapePlayer.Draw, behind the arena, the game and the actors: black, the background, a stream's monitor, an ad
    this.ctx = this.back.getContext('2d');
    this.rect(0, 0, W, H, '#000000');
    if (scene) {
      const background = picture(scene.background);
      if (background) this.ctx.drawImage(background, 0, 0, W, H);
      if (scene.kind === 'play') {
        // A stream is the game filling the frame, with the streamer cut in over its corner.
        this.rect(0, 0, W, H, '#0E0B14');
        const [x, y] = this.gameAt;
        const [w, h] = this.gameSize;
        this.rect(x, y, x + w, y + h, '#050805');
      }
      const ad = scene.ad ? picture(scene.ad) : null;
      if (ad) {
        const width = Math.min(W * 0.7, ad.naturalWidth * 2);
        const height = (width * ad.naturalHeight) / ad.naturalWidth;
        this.ctx.drawImage(ad, (W - width) / 2, H * 0.18, width, height);
      }
    }
    // in front of them: the actors, then the overlay
    this.ctx = this.front.getContext('2d');
    if (scene) this.drawActors(scene, at, seconds);
    this.drawOverlay(scene, at);
  }

  /** The scene's people and props, feet where the scene puts them, the talkers bobbing while the tape plays. */
  drawActors(scene, at, seconds) {
    for (const actor of scene.actors) {
      const bob = actor.talking && this.playing ? Math.abs(Math.sin(at * 9)) * 2 : 0;
      if (actor.bust) {
        this.drawBust(actor, bob);
        continue;
      }
      const size = 32 * actor.scale;
      const left = actor.at[0] * this.width - size / 2;
      const top = actor.at[1] * this.height - size - bob;
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
        const doll = this.doll(actor);
        if (doll) this.ctx.drawImage(doll, left, top, size, size);
      }
    }
  }

  doll(actor) {
    return ready(this.dolls, this.dollKey(this.tape, actor), () => dollCanvas(actor.outfit, lookSeed(this.tape.seed, actor.character)));
  }

  /** CMUTapeBust: the streamer sits in the facecam, head and shoulders, with nothing behind, and bobs inside it. */
  drawBust(actor, bob) {
    const doll = actor.outfit ? this.doll(actor) : null;
    if (!doll) return;
    const [x, y, w, h] = this.facecam;
    const size = 32 * BUST_SCALE;
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.clip();
    this.ctx.drawImage(doll, x + (w - size) / 2, y - 0.06 * size - bob, size, size);
    this.ctx.restore();
  }

  /** CMUTapeOverlay.Draw */
  drawOverlay(scene, at) {
    const W = this.width;
    const H = this.height;
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
      const width = this.measure(small, scene.ticker);
      const x = W - ((this.time * 45) % (W + width));
      this.text(small, x, bottom - band + 1, scene.ticker, '#FFFFFF');
      bottom -= band;
    }
    let above = bottom;
    if (scene.strap) {
      // the strap wraps to the screen's width, and the caption sits above it
      const font = SANS(this.narrow ? 9 : 11);
      const lines = this.wrap(font, scene.strap, W - 40);
      const { lineHeight } = this.metrics(font);
      const height = lines.length * lineHeight + 4;
      const top = bottom - (this.narrow ? 8 : 26) - height;
      const width = Math.max(0, ...lines.map(line => this.measure(font, line)));
      const ad = scene.kind === 'ad';
      this.rect(10, top, 10 + width + 20, top + height, ad ? '#E8C020' : '#B01818');
      lines.forEach((line, i) => this.text(font, 20, top + 2 + i * lineHeight, line, ad ? '#000000' : '#FFFFFF'));
      above = top;
    }
    this.drawCaption(scene, at, above);
    if (scene.kind === 'ad') {
      const advert = this.t('cmu-tape-advert');
      const font = VHS(10);
      this.text(font, W - this.measure(font, advert) - 14, 8, advert, 'rgba(255, 255, 255, 0.8)');
    } else if (!this.narrow && tape.channel.length > 0 && scene.kind !== 'card' && scene.kind !== 'standby') {
      this.text(small, W - this.measure(small, tape.channel) - 10, 8, tape.channel, 'rgba(255, 255, 255, 0.7)');
    }
    this.drawDeck();
    this.drawNoise(at);
  }

  /** The line being said now, typed out, in a box over the bottom of the picture. */
  drawCaption(scene, at, bottom) {
    if (!scene.lines.length) return;
    const W = this.width;
    const each = scene.duration / scene.lines.length;
    const index = Math.min(scene.lines.length - 1, Math.trunc(at / each));
    const line = scene.lines[index];
    const shown = line.slice(0, Math.min(line.length, Math.trunc((at - index * each) * TYPE_SPEED)));
    const font = SANS(this.narrow ? 9 : 10);
    // A let's play keeps its captions clear of the facecam.
    const right = scene.kind === 'play' && !this.narrow ? W - this.facecam[0] + 6 : 12;
    const lines = this.wrap(font, shown, W - right - 28);
    const { lineHeight } = this.metrics(font);
    const height = lines.length * lineHeight + 8;
    const top = bottom - height - 4;
    if (lines.length > 0) this.rect(12, top, W - right, top + height, 'rgba(0, 0, 0, 0.65)');
    lines.forEach((value, i) => this.text(font, 20, top + 4 + i * lineHeight, value, '#FFF6C8'));
  }

  drawWeather(scene) {
    const font = SANS(9);
    const { lineHeight } = this.metrics(font);
    for (const weather of scene.weather) {
      const cx = weather.at[0] * this.width;
      const cy = weather.at[1] * this.height;
      const icon = picture(this.weatherIcons[weather.icon]);
      const size = 24 * 2;
      if (icon) this.ctx.drawImage(icon, cx - size / 2, cy - size / 2, size, size);
      const width = this.measure(font, weather.label);
      const x = cx - width / 2;
      const y = cy + size / 2;
      this.rect(x - 3, y - 1, x - 3 + width + 6, y - 1 + lineHeight + 2, 'rgba(0, 0, 0, 0.55)');
      this.text(font, x, y, weather.label, '#FFFFFF');
    }
  }

  /** PLAY or PAUSE and the tape counter, top left, the way a deck shows them. */
  drawDeck() {
    // a reel is a clip, not a tape in a deck
    if (this.narrow) return;
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
    const H = this.height;
    for (let i = 0; i < 3; i++) {
      const y = Math.random() * H;
      this.rect(0, y, this.width, y + 1, `rgba(255, 255, 255, ${0.06 + Math.random() * 0.08})`);
    }
    if (at < 0.25) {
      const band = H * (1 - at / 0.25);
      this.rect(0, band, this.width, Math.min(H, band + 18), 'rgba(255, 255, 255, 0.25)');
    }
  }

  centre(font, value, colour) {
    const width = this.measure(font, value);
    const { lineHeight } = this.metrics(font);
    this.text(font, this.width / 2 - width / 2, this.height / 2 - lineHeight / 2, value, colour);
  }

  wrap(font, value, width) {
    const lines = [];
    let line = '';
    for (const word of value.split(' ')) {
      const next = line.length === 0 ? word : `${line} ${word}`;
      if (line.length > 0 && this.measure(font, next) > width) {
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
