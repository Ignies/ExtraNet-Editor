// The sportsbook arena, a port of CMUSportsArena.cs: plays a match live with dressed dolls and real item sprites.
// Before kickoff the lineup waits on the field; from kickoff everyone watches the same match, worked out from the
// seed and winner revealed then. Each sport draws its own arena as a subclass (see sprint.js); this base holds the
// dolls and items, the scoreboard text and the effects they share: particles, blood decals that stay on the floor,
// screen shake, flashes, floating words and sounds.
//
// Drawing is in arena units (520 x 240), y down. Rotations of dolls and items are in degrees the Robust way
// (anticlockwise on screen); texture() takes radians that turn clockwise, like the C#'s Texture helper.

import { L, SPORT_NAMES, Colours, kitColour, matchName, playMatch, sportLength, sportModule } from './core.js';
import { dollCanvas, itemCanvas, stateCanvas, readyImage } from './dolls.js';
import { playSound, playAny, scream, preloadSounds } from '../audio.js';

export const ArenaWidth = 520;
export const ArenaHeight = 240;
/** The scoreboard bar along the top. */
export const Bar = 26;

/** An event this long ago when the arena first sees it is history: it leaves its marks, but silently. */
const Fresh = 0.5;
const MaxDecals = 160;
const MaxParticles = 600;

const SPLATTER = '/Textures/Fluids/splatter.rsi';
const SplatterStates = 6;

export const BLOOD = '#9E0B0B';
export const DARK_BLOOD = '#5E0606';

/** Doll directions, as the RSIs order them. */
export const Dir = { South: 0, North: 1, East: 2, West: 3 };

export const WHITE = [255, 255, 255];
export const GOLD = '#FFD700';
export const LIME = '#00FF00';
export const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const two = n => String(n).padStart(2, '0');
const TAU = Math.PI * 2;

/** The last word of a team's name, for the scoreboard. */
export const shortName = team => team.split(' ').pop().toUpperCase();

const TEAM_COLOURS = {
  Red: '#E04040', Blue: '#4080FF', Green: '#40C060', Yellow: '#F0D040', Orange: '#F09030', Purple: '#A060E0', Brown: '#A07040',
};

/** The colour a match entrant wears, by slot, as CSS. */
export function kitCss(match, slot) {
  if (!match || slot < 0 || slot >= match.entrants.length) return '#FFFFFF';
  return TEAM_COLOURS[Colours[kitColour(match.sport, slot, match.entrants[slot])]] || '#FFFFFF';
}

export class Arena {
  /** The arena for a sport, from its module's registration. */
  static create(sport, font) {
    const { Arena: SportArena } = sportModule(sport);
    return new SportArena(font);
  }

  #children = [];
  #dolls = [];
  #texts = [];
  #popups = [];
  #particles = [];
  #decals = [];
  #seen = -Infinity;
  #caughtUp = false;
  #shakeStrength = 0;
  #shakeTime = 0;
  #shakeX = 0;
  #shakeY = 0;
  #flash = null;
  #flashLife = 0;
  #flashAge = 0;
  #lastFrame = 0;
  #ratio = 0;
  #t = 0;

  constructor(font) {
    this.font = font;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'emu-sports-arena';
    this.ctx = this.canvas.getContext('2d');
    /** The match on show, its play (null while the winner is secret) and the time its clock started. */
    this.match = null;
    this.play = null;
    this.start = 0;
    /** Whether a replay is on rather than the live match. */
    this.replaying = false;
    /** The sport name, top left, and the clock, top right. Sports set their own clock after the base's default. */
    this.header = '';
    this.clock = '';
    /** Whether effects play now. False while catching up on events that happened off screen. */
    this.live = false;
  }

  /** Shows a match, live from its kickoff, or from now when replay is set, optionally starting `from` seconds in. */
  show(match, now, replay = false, from = 0) {
    const known = this.match && this.match.id === match.id && this.match.winner === match.winner;
    this.match = match;
    if (known && !replay && !this.replaying) return;
    this.replaying = replay;
    this.play = match.winner >= 0 ? playMatch(match.sport, match.seed, match.entrants.length, match.winner) : null;
    // a replay can start part-way for highlights; what came before leaves its marks silently
    this.start = replay ? now - clamp(from, 0, sportLength(match.sport)) : match.kickoff;
    this.#rebuild();
  }

  #rebuild() {
    this.#children = [];
    this.#dolls = [];
    this.#resetEffects();
    if (this.match) this.build(this.match);
  }

  /** Wipes the floor and forgets which events played, so they play again from the start. */
  #resetEffects() {
    this.#particles = [];
    this.#decals = [];
    this.#popups = [];
    this.#seen = -Infinity;
    this.#caughtUp = false;
    this.#shakeStrength = 0;
    this.#shakeTime = 0;
    this.#shakeX = 0;
    this.#shakeY = 0;
    this.#flashLife = 0;
  }

  // ---------------------------------------------------------------- for the sports

  /** Adds the sport's dolls and items, in drawing order. Called whenever a new match is shown. */
  build(match) {}

  /**
   * Poses everything for t seconds from kickoff (negative before it, and -1 while the winner is still secret,
   * when play is null). Called every frame the arena is on screen.
   */
  updateMatch(match, play, t) {}

  /** The field, under the decals and dolls. */
  drawField(c) {
    rect(c, 0, Bar, ArenaWidth, ArenaHeight - Bar, '#000000');
  }

  /** Over the decals, under the dolls: shadows, chalk, anything the blood should not cover. */
  drawOverDecals(c) {}

  /** Over the dolls and particles, under the text: ropes in front, glass, lights. */
  drawOverlay(c) {}

  /**
   * Runs once for every event of the match as its time comes. live is false for events that happened before
   * the arena was looking (a late join, a tab switched back to): leave their lasting marks, like decals, but
   * make no sound, particles or shake. Effects called while not live are ignored anyway.
   */
  onEvent(match, ev, index, live) {}

  /** Adds a doll in a kit (roles: Runner, Boxer, Player, Spacer; colour: an index into Colours). Returns its index. */
  addDoll(role, colour, scale) {
    const doll = { kind: 'doll', role, colour, scale, squash: 1, visible: false, x: 0, y: 0, dir: Dir.South, rot: 0, alpha: 1 };
    this.#children.push(doll);
    this.#dolls.push(doll);
    return this.#dolls.length - 1;
  }

  get dollCount() {
    return this.#dolls.length;
  }

  /** A doll's state, to change its scale, alpha or squash (its height over its width, 1 upright, less for a crouch). */
  doll(index) {
    return this.#dolls[index];
  }

  /** An item sprite ({ rsi, state }, see dolls.js) drawn size * scale across, hidden every frame until placed. */
  addItem(item, size, scale = 1) {
    const view = { kind: 'item', item, size: size * scale, visible: false, x: 0, y: 0, rot: 0, alpha: 1 };
    this.#children.push(view);
    return view;
  }

  /** Centres an item on a spot of the arena for this frame. */
  place(item, x, y, rotation = 0) {
    Object.assign(item, { visible: true, x, y, rot: rotation });
  }

  pose(doll, x, y, dir, rotation = 0) {
    const d = this.#dolls[doll];
    if (d) Object.assign(d, { visible: true, x, y, dir, rot: rotation });
  }

  hide(doll) {
    if (this.#dolls[doll]) this.#dolls[doll].visible = false;
  }

  /** Text for this frame. Big calls are centred on their spot; labels hang from it, or end at it when right aligned. */
  say(text, x, y, colour, big = false, right = false) {
    this.#texts.push({ text, x, y, colour, big, right });
  }

  /** Text that floats up and fades by itself, like a hit word. */
  pop(text, x, y, colour, big = false, life = 0.8, rise = 24) {
    if (this.live) this.#popups.push({ text, x, y, colour, big, life, rise, age: 0 });
  }

  /** A sprite state's first frame, tinted if asked, or null until it has loaded. Paths are rooted or under /Textures. */
  sprite(rsi, state, tint = null) {
    return readyImage(`state|${rsi}|${state}|${tint}`, () => stateCanvas(rsi, state, tint));
  }

  /** Starts loading sounds, so their first play is on time. */
  preload(...paths) {
    preloadSounds(paths.flat());
  }

  // ---------------------------------------------------------------- effects

  /**
   * Throws particles from a spot. direction and spread are in radians, with 0 pointing right and positive
   * angles turning down the screen. floor is the y the particles land on (NaN to fly until they fade); stains
   * makes the drops that land leave blood decals; streak draws them as sparks along their velocity.
   */
  burst(x, y, count, colour, speed, {
    life = 0.6, size = 2, direction = 0, spread = TAU, gravity = 0, floor = NaN, stains = false, streak = false, drag = 0,
  } = {}) {
    if (!this.live) return;
    for (let i = 0; i < count && this.#particles.length < MaxParticles; i++) {
      const angle = direction + (this.fxFloat() - 0.5) * spread;
      const v = speed * (0.35 + this.fxFloat() * 0.65);
      this.#particles.push({
        x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, age: 0,
        life: life * (0.6 + this.fxFloat() * 0.6), size: size * (0.6 + this.fxFloat() * 0.8),
        colour, gravity, floor, stains, streak, drag,
      });
    }
  }

  /** Blood sprays from a wound towards direction, and the drops that reach floor stain it. amount 1 is a nick, 3 a gusher. */
  bleed(x, y, floor, amount, direction = -Math.PI / 2, spread = 1.6) {
    this.burst(x, y, 6 + amount * 8, BLOOD, 70 + amount * 45, {
      life: 1.4, size: 1.6 + amount * 0.5, direction, spread, gravity: 420, floor, stains: true,
    });
    this.burst(x, y, 2 + amount * 2, DARK_BLOOD, 30 + amount * 20, {
      life: 0.9, size: 2.4 + amount * 0.6, direction, spread: spread * 0.6, gravity: 420, floor, stains: true,
    });
  }

  /** Stamps a blood decal on the floor. Unlike the other effects it also lands while catching up. */
  splat(x, y, size, colour = BLOOD) {
    this.#addDecal(x, y, size, colour);
  }

  #addDecal(x, y, size, colour) {
    if (this.#decals.length >= MaxDecals) this.#decals.shift();
    this.#decals.push({ x, y, size, state: Math.floor(this.fxFloat() * SplatterStates), colour, rot: this.fxFloat() * TAU });
  }

  /** Shakes the whole arena, strongest at the start and dying out over time seconds. */
  shake(strength, time = 0.35) {
    // a light tap does not cut short a big hit still shaking
    if (!this.live || (this.#shakeTime > 0 && strength < this.#shakeStrength)) return;
    this.#shakeStrength = strength;
    this.#shakeTime = time;
  }

  /** Washes the arena with a colour (any CSS colour, alpha included) that fades out over time seconds. */
  flash(colour, time = 0.25) {
    if (!this.live) return;
    this.#flash = colour;
    this.#flashLife = time;
    this.#flashAge = 0;
  }

  /** Plays a sound from /Audio/... while live and on screen. volume is in dB over the game base. */
  sound(path, volume = 0, pitch = 1) {
    if (this.live) playSound(path, { volume, pitch, source: this.canvas });
  }

  soundAny(paths, volume = 0, spread = 0.08) {
    if (this.live) playAny(paths, { volume, spread, source: this.canvas });
  }

  /** A scream from the human takes; core.js's female(sport, entrant) says which. */
  scream(female, volume = 0) {
    if (this.live) scream(female, { volume, source: this.canvas });
  }

  /** For effects only. The match itself comes from its seed, never from this. */
  fxFloat() {
    return Math.random();
  }

  /** How far the field is shaken this frame, as [x, y]. Everything but the scoreboard bar moves with it. */
  get shakeOffset() {
    return [this.#shakeX, this.#shakeY];
  }

  #updateEffects(delta) {
    for (let i = this.#particles.length - 1; i >= 0; i--) {
      const p = this.#particles[i];
      p.age += delta;
      p.vy += p.gravity * delta;
      if (p.drag > 0) {
        const keep = Math.max(0, 1 - p.drag * delta);
        p.vx *= keep;
        p.vy *= keep;
      }
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      const landed = !Number.isNaN(p.floor) && p.y >= p.floor && p.vy > 0;
      // stamp the drop where it fell; the bigger it was, the wider it spreads
      if (landed && p.stains) this.#addDecal(p.x, p.floor, p.size * 2.6, p.colour);
      if (landed || p.age >= p.life) this.#particles.splice(i, 1);
    }

    for (let i = this.#popups.length - 1; i >= 0; i--) {
      this.#popups[i].age += delta;
      if (this.#popups[i].age >= this.#popups[i].life) this.#popups.splice(i, 1);
    }

    if (this.#shakeTime > 0) {
      this.#shakeTime -= delta;
      const strength = this.#shakeTime > 0 ? this.#shakeStrength * Math.min(1, this.#shakeTime * 4) : 0;
      this.#shakeX = (this.fxFloat() - 0.5) * 2 * strength;
      this.#shakeY = (this.fxFloat() - 0.5) * 2 * strength;
    } else {
      this.#shakeX = 0;
      this.#shakeY = 0;
    }

    if (this.#flashLife > 0) this.#flashAge += delta;
  }

  // ---------------------------------------------------------------- the frame

  /** Advances to now (seconds, like the kickoff) and draws. Call it every animation frame the arena is on show. */
  frame(now) {
    const real = performance.now();
    // clamped, so an arena coming back on show does not take one giant step
    const delta = this.#lastFrame ? Math.min(0.25, (real - this.#lastFrame) / 1000) : 0;
    this.#lastFrame = real;
    this.#texts = [];
    const match = this.match;
    if (!match) return this.#draw();

    const t = now - this.start;
    this.#t = t;
    const length = sportLength(match.sport);
    this.header = SPORT_NAMES[match.sport].toUpperCase();
    this.clock = this.play == null
      ? L.starts(Math.max(0, Math.trunc(-t)))
      : t >= length ? L.final : `${Math.trunc(Math.trunc(t) / 60)}:${two(Math.trunc(t) % 60)}`;

    const play = this.play;
    const time = play == null ? -1 : Math.min(t, length);
    if (play != null) {
      if (time < this.#seen) this.#resetEffects();
      for (let i = 0; i < play.events.length; i++) {
        const e = play.events[i];
        if (e.time <= this.#seen || e.time > time) continue;
        this.live = this.#caughtUp && time - e.time < Fresh;
        this.onEvent(match, e, i, this.live);
      }
      this.#seen = time;
    }

    this.#caughtUp = true;
    this.live = true;
    this.#updateEffects(delta);
    for (const child of this.#children) if (child.kind === 'item') child.visible = false;
    this.updateMatch(match, play, time);
    if (play != null && t >= length) this.say(L.winner(matchName(match, match.winner)), ArenaWidth / 2, ArenaHeight - 30, GOLD, true);
    this.#draw();
  }

  #draw() {
    const ratio = Math.max(1, Math.min(3, Math.round(window.devicePixelRatio || 1)));
    if (ratio !== this.#ratio) {
      this.#ratio = ratio;
      this.canvas.width = ArenaWidth * ratio;
      this.canvas.height = ArenaHeight * ratio;
    }
    const c = this.ctx;
    c.setTransform(ratio, 0, 0, ratio, 0, 0);
    c.imageSmoothingEnabled = false;
    c.globalAlpha = 1;
    const shaken = draw => {
      c.save();
      c.translate(this.#shakeX, this.#shakeY);
      draw();
      c.restore();
    };

    if (!this.match) {
      rect(c, 0, 0, ArenaWidth, ArenaHeight, '#000000');
    } else {
      shaken(() => {
        this.drawField(c);
        for (const decal of this.#decals) {
          const image = this.sprite(SPLATTER, `splatter-${decal.state}`, decal.colour);
          if (image) texture(c, image, decal.x, decal.y, decal.size, decal.size, decal.rot);
        }
        this.drawOverDecals(c);
      });
    }

    // the scoreboard bar stays still while the field shakes
    rect(c, 0, 0, ArenaWidth, Bar, '#0C0F14');
    rect(c, 0, Bar - 2, ArenaWidth, 2, '#7CFF00');

    // the dolls and items like the arena's children, then the particles and the sport's overlay
    shaken(() => {
      for (const child of this.#children) {
        if (!child.visible) continue;
        const image = child.kind === 'doll'
          ? readyImage(`doll|${child.role}|${child.colour}|${child.dir}`, () => dollCanvas(child.role, child.colour, child.dir))
          : readyImage(`item|${child.item.rsi}|${child.item.state}`, () => itemCanvas(child.item));
        if (!image) continue;
        c.globalAlpha = child.alpha;
        sprite(c, image, child.x, child.y, child.kind === 'doll' ? 32 * child.scale : child.size, child.rot,
          child.kind === 'doll' ? child.squash : 1);
        c.globalAlpha = 1;
      }
      for (const p of this.#particles) {
        c.globalAlpha = Math.min(1, clamp(1 - p.age / p.life, 0, 1) * 1.4);
        if (p.streak) {
          line(c, p.x, p.y, p.x - p.vx * 0.03, p.y - p.vy * 0.03, p.colour);
        } else {
          rect(c, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size, p.colour);
        }
      }
      c.globalAlpha = 1;
      this.drawOverlay(c);
    });

    if (this.#flash && this.#flashLife > 0 && this.#flashAge < this.#flashLife) {
      c.globalAlpha = 1 - this.#flashAge / this.#flashLife;
      rect(c, 0, Bar, ArenaWidth, ArenaHeight - Bar, this.#flash);
      c.globalAlpha = 1;
    }

    // the text layer: the scoreboard, calls and hit words
    if (this.match) {
      c.font = `bold 10px ${this.font}`;
      c.textBaseline = 'top';
      c.textAlign = 'left';
      c.fillStyle = '#7CFF00';
      c.fillText(this.header || '', 8, 7);
      this.#drawBadge(c);
      c.font = `bold 10px ${this.font}`;
      c.textBaseline = 'top';
      c.textAlign = 'right';
      c.fillStyle = '#FFFFFF';
      c.fillText(this.clock || '', ArenaWidth - 8, 7);
    }
    c.lineJoin = 'round';
    shaken(() => {
      for (const text of this.#texts) this.#text(c, text.text, text.x, text.y, text.colour, text.big, text.right);
      for (const popup of this.#popups) {
        const progress = popup.age / popup.life;
        c.globalAlpha = clamp(2 - progress * 2, 0, 1);
        this.#text(c, popup.text, popup.x, popup.y - popup.rise * progress, popup.colour, popup.big, false);
      }
      c.globalAlpha = 1;
    });
  }

  /** A blinking LIVE light while a match plays, or REPLAY while one is watched again. */
  #drawBadge(c) {
    const match = this.match;
    if (!match || this.play == null || this.#t < 0 || this.#t >= sportLength(match.sport)) return;
    const x = 8 + c.measureText(this.header || '').width + 10;
    const colour = this.replaying ? '#F2C230' : '#FF3030';
    if ((performance.now() / 1000) % 1 < 0.6) circle(c, x + 4, 13, 4, colour);
    c.fillStyle = colour;
    c.textAlign = 'left';
    c.fillText(this.replaying ? L.arenaReplay : L.arenaLive, x + 11, 7);
  }

  #text(c, text, x, y, colour, big, right) {
    c.font = `bold ${big ? 18 : 10}px ${this.font}`;
    c.textAlign = big ? 'center' : right ? 'right' : 'left';
    c.textBaseline = big ? 'middle' : 'top';
    c.lineWidth = 3;
    c.strokeStyle = '#000000';
    c.strokeText(text, x, y);
    c.fillStyle = colour;
    c.fillText(text, x, y);
  }
}

// ---------------------------------------------------------------- drawing helpers, in arena units

export function rect(c, x, y, w, h, colour) {
  c.fillStyle = colour;
  c.fillRect(x, y, w, h);
}

export function frameRect(c, x, y, w, h, colour) {
  c.strokeStyle = colour;
  c.lineWidth = 1;
  c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

export function circle(c, x, y, r, colour, filled = true) {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  if (filled) {
    c.fillStyle = colour;
    c.fill();
  } else {
    c.strokeStyle = colour;
    c.lineWidth = 1;
    c.stroke();
  }
}

export function line(c, x1, y1, x2, y2, colour, width = 1) {
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.strokeStyle = colour;
  c.lineWidth = width;
  c.stroke();
}

export function poly(c, colour, ...points) {
  c.beginPath();
  c.moveTo(points[0][0], points[0][1]);
  for (const p of points.slice(1)) c.lineTo(p[0], p[1]);
  c.closePath();
  c.fillStyle = colour;
  c.fill();
}

/** Draws an image centred on a spot, width by height, turned by rotation radians (clockwise on screen). */
export function texture(c, image, x, y, width, height = width, rotation = 0) {
  c.save();
  c.translate(x, y);
  if (rotation) c.rotate(rotation);
  c.drawImage(image, -width / 2, -height / 2, width, height);
  c.restore();
}

/**
 * A sprite centred on its spot. Robust angles turn anticlockwise on screen, so a world rotation of -90 lies the
 * doll down clockwise, as the arena's SpriteView.WorldRotation does.
 */
export function sprite(c, image, x, y, size, degrees, squash = 1) {
  c.save();
  c.translate(x, y);
  // squashed on screen after turning, like a SpriteView's Y scale in game
  if (squash !== 1) c.scale(1, squash);
  if (degrees) c.rotate(-degrees * Math.PI / 180);
  c.drawImage(image, -size / 2, -size / 2, size, size);
  c.restore();
}
