// Tracker Reflex, a port of Arcade/CMUTrackerReflex.cs: an M314 motion tracker played on the keypad. The display
// is a 3 by 3 grid with you in the middle (7 8 9 on top, 1 2 3 at the bottom). Xenos close in from every side, but
// a blip only shows where the last ping saw it, and the ping quickens as they get closer. A key fires a pulse rifle
// burst into its sector, 5 point blank into the middle, Space or Enter reloads. A xeno that reaches the middle
// mauls you; the third one ends the run. Waves get bigger and faster until then.
// Constants, layout (320 x 224 units), sounds and strings match the C# file; keep them in step.

import { ArcadeScreen, Key, SCREEN_W, SCREEN_H, TAU } from './screen.js';
import { playAny, scream, preloadSounds } from '../audio.js';
import { stateCanvas } from '../sports/dolls.js';
import { loadRsi, loadStateSheet, stateFrames } from '../../sprites.js';
import { ensureFont } from '../../fonts.js';

// Tuning ---------------------------------------------------------------------------------------------------------

// the display on the screen, in screen units
const CENTRE_X = 160;
const CENTRE_Y = 124;
const RADIUS = 88;

// the display is the unit disc: sector lines at a third, xenos come in from just past the rim
const THIRD = 1 / 3;
const TOLERANCE = 0.05;
const SPAWN_RADIUS = 1.04;
const MAUL_RADIUS = 0.1;
const RANGE_METRES = 30;

const PING_TRAVEL = 0.45;
const PING_FAR = 1.5;
const PING_NEAR = 0.4;
const PING_IDLE = 1.9;
const BLIP_FADE = 1.4;
const ECHO_TIME = 0.6;

const MAX_HEALTH = 3;
const MAGAZINE = 10;
const ROUNDS_PER_BURST = 4;
const RELOAD_TIME = 1.25;
const FIRE_COOLDOWN = 0.11;
const INVULNERABLE = 1.1;

const KILL_POINTS = 10;
const POINT_BLANK_POINTS = 15;
const MISS_PENALTY = 5;
const WAVE_POINTS = 50;
const HEALTH_POINTS = 25;
const STREAK_STEP = 5;
const MAX_MULTIPLIER = 4;
const MAX_SCORE = 9999; // CMUArcadeLimits.MaxScore

const INTRO_TIME = 1.8;
const CLEAR_TIME = 2.4;
const DYING_TIME = 1.6;
const DEMO_CONTACTS = 5;
const DEMO_GAP = 1.4;

const BANNER_WIDTH = 176;

const MAX_DECALS = 90;
const MAX_GLASS = 40;
const MAX_STREAKS = 18;
const MAX_PARTICLES = 320;

// Assets ---------------------------------------------------------------------------------------------------------

const SPLATTER = '/Textures/Fluids/splatter.rsi';
const DETECTOR = '/Textures/_RMC14/Objects/Tools/motion_detector.rsi';
const SPLATTER_STATES = 6;

const PING_CONTACT = '/Audio/_RMC14/Effects/motion_detector.ogg';
const PING_EMPTY = '/Audio/_RMC14/Effects/motion_detector_none.ogg';
const SHOT = '/Audio/_RMC14/Weapons/Guns/Gunshots/gun_m54c_1.ogg';
const DRY_FIRE = '/Audio/_RMC14/Weapons/Guns/gun_cmb_click1.ogg';
const UNLOAD = '/Audio/_RMC14/Weapons/Guns/Reload/m41_unload.ogg';
const LOAD = '/Audio/_RMC14/Weapons/Guns/Reload/m41_reload.ogg';
const POWER_ON = '/Audio/_RMC14/Handling/hud_on.ogg';
const ROAR = '/Audio/_RMC14/Xeno/alien_distantroar_3.ogg';
const CLEARED = '/Audio/Effects/double_beep.ogg';
const STATIC = '/Audio/_RMC14/Effects/radiostatic.ogg';
const BRUTE_DEATH = '/Audio/_RMC14/Xeno/alien_death.ogg';

const DEATHS = [
  '/Audio/_RMC14/Xeno/alien_death2.ogg', '/Audio/_RMC14/Xeno/alien_roar_larva1.ogg',
  '/Audio/_RMC14/Xeno/alien_roar_larva2.ogg',
];
const SIZZLES = [
  '/Audio/_RMC14/Xeno/acid_sizzle1.ogg', '/Audio/_RMC14/Xeno/acid_sizzle2.ogg',
  '/Audio/_RMC14/Xeno/acid_sizzle3.ogg', '/Audio/_RMC14/Xeno/acid_sizzle4.ogg',
];
const FLESH = [
  '/Audio/_RMC14/Bullets/impact_flesh_1.ogg', '/Audio/_RMC14/Bullets/impact_flesh_2.ogg',
  '/Audio/_RMC14/Bullets/impact_flesh_3.ogg', '/Audio/_RMC14/Bullets/impact_flesh_4.ogg',
];
const HISSES = ['/Audio/_RMC14/Xeno/alien_hiss1.ogg', '/Audio/_RMC14/Xeno/alien_hiss2.ogg', '/Audio/_RMC14/Xeno/alien_hiss3.ogg'];
const GROWLS = ['/Audio/_RMC14/Xeno/alien_growl1.ogg', '/Audio/_RMC14/Xeno/alien_growl2.ogg', '/Audio/_RMC14/Xeno/alien_growl3.ogg'];
const CHARGES = ['/Audio/_RMC14/Xeno/runner_charging_1.ogg', '/Audio/_RMC14/Xeno/runner_charging_2.ogg'];
const CLAWS = [
  '/Audio/_RMC14/Xeno/alien_claw_flesh1.ogg', '/Audio/_RMC14/Xeno/alien_claw_flesh2.ogg',
  '/Audio/_RMC14/Xeno/alien_claw_flesh3.ogg', '/Audio/_RMC14/Xeno/alien_claw_flesh4.ogg',
  '/Audio/_RMC14/Xeno/alien_claw_flesh5.ogg',
];
const BITES = ['/Audio/_RMC14/Xeno/alien_bite1.ogg', '/Audio/_RMC14/Xeno/alien_bite2.ogg'];

// colours as [r, g, b, a] (0..255 rgb, 0..1 alpha), like the C# Color constants
const hex = (h, a = 1) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a];
const FACE = hex('#031006');
const BEZEL = hex('#0A1A0D');
const HOT = hex('#E8FFD8');
const WARN = hex('#FF4433');
const ACID = hex('#C6F03A');
const ACID_STAIN = hex('#9FD02A', 0.7);
const BLOOD = hex('#A10D0D', 0.85);
const BLOOD_DARK = hex('#6A0606', 0.9);
const BLACK = [0, 0, 0, 1];
const WHITE = [255, 255, 255, 1];

/** Strings, as in Games/tracker.ftl. */
const T = {
  help: 'Keypad 7 8 9 / 4 6 / 1 2 3 (numpad or number row) fires into that sector,\n'
    + '5 fires point blank into the middle, Space or Enter reloads.\n'
    + 'Misses waste ammo and break your streak. Three xenos through and you are done.',
  model: 'M314 MOTION TRACKER',
  title: 'TRACKER REFLEX',
  start: 'SPACE TO START',
  retry: 'SPACE TO TRY AGAIN',
  paused: 'PAUSED',
  wave: wave => `WAVE ${wave}`,
  waveLabel: 'WAVE',
  inbound: 'CONTACTS INBOUND',
  clear: 'SECTOR CLEAR',
  bonus: points => `BONUS +${points}`,
  lost: 'SIGNAL LOST',
  vitals: 'VITALS',
  ammo: 'AMMO',
  reload: 'RELOAD',
  reloading: 'RELOADING',
  streak: 'STREAK',
  multiplier: multiplier => `x${multiplier}`,
  kills: kills => `KILLS ${kills}`,
  range: 'RANGE',
  metres: metres => `${metres}m`,
  none: '--',
  keypad: 'KEYPAD',
  miss: 'MISS',
  close: 'POINT BLANK',
  danger: '!!',
};

// The C# draws with its own VectorFonts (points at 96 dpi), not the page font: the layout is measured for them.
// ascent and height are the faces' hhea metrics in em, which the engine uses to place and measure text.
const FONTS = {
  small: { family: '700 {px}px "GameMono", "Roboto Mono", Consolas, monospace', px: 7 * 4 / 3, ascent: 1.048, height: 1.319 },
  medium: { family: '400 {px}px "GameTerminal", Consolas, "Courier New", monospace', px: 10 * 4 / 3, ascent: 1, height: 1.143 },
  big: { family: '400 {px}px "GameTerminal", Consolas, "Courier New", monospace', px: 13 * 4 / 3, ascent: 1, height: 1.143 },
};

const Phase = { Attract: 0, Intro: 1, Wave: 2, Clear: 3, Dying: 4, Over: 5 };

/** Drone stalks stop-start, Runner is small and fast, Lurker weaves between sectors, Brute takes two bursts. */
const Kind = { Drone: 0, Runner: 1, Lurker: 2, Brute: 3 };

// Each sector's outline on the unit disc (the grid cell clipped to the display), and its middle.
const CELL_EDGE = 8;
const CELLS = [];
const CELL_CENTRES = [];
for (let sector = 1; sector <= 9; sector++) {
  const column = (sector - 1) % 3;
  const row = 2 - Math.floor((sector - 1) / 3);
  const x0 = -1 + column * 2 / 3;
  const y0 = -1 + row * 2 / 3;
  const corners = [[x0, y0], [x0 + 2 / 3, y0], [x0 + 2 / 3, y0 + 2 / 3], [x0, y0 + 2 / 3]];
  const points = [];
  let sx = 0;
  let sy = 0;
  for (let edge = 0; edge < 4; edge++) {
    const [ax, ay] = corners[edge];
    const [bx, by] = corners[(edge + 1) % 4];
    for (let step = 0; step < CELL_EDGE; step++) {
      // the rim cuts the outer cells: their outline points outside the disc go onto the rim
      let x = ax + (bx - ax) * step / CELL_EDGE;
      let y = ay + (by - ay) * step / CELL_EDGE;
      const length = Math.hypot(x, y);
      if (length > 1) {
        x /= length;
        y /= length;
      }
      points.push({ x, y });
      sx += x;
      sy += y;
    }
  }
  CELLS[sector] = points;
  CELL_CENTRES[sector] = { x: sx / points.length, y: sy / points.length };
}

const ALL_SOUNDS = [
  PING_CONTACT, PING_EMPTY, SHOT, DRY_FIRE, UNLOAD, LOAD, POWER_ON, ROAR, CLEARED, STATIC, BRUTE_DEATH,
  ...DEATHS, ...SIZZLES, ...FLESH, ...HISSES, ...GROWLS, ...CHARGES, ...CLAWS, ...BITES,
];

/** The keypad is the tracker in a 3 by 3 grid: 7 8 9 on top, 1 2 3 at the bottom, 5 is you. */
function inSector(at, sector, tolerance) {
  const column = (sector - 1) % 3;
  const row = 2 - Math.floor((sector - 1) / 3);
  return inBand(at.x, column, tolerance) && inBand(at.y, row, tolerance);
}

function inBand(value, band, tolerance) {
  if (band === 0) return value < -THIRD + tolerance;
  if (band === 1) return value > -THIRD - tolerance && value < THIRD + tolerance;
  return value > THIRD - tolerance;
}

function angleGap(a, b) {
  const gap = Math.abs(a - b) % TAU;
  return gap > Math.PI ? TAU - gap : gap;
}

function css(colour, alpha = 1) {
  return `rgba(${colour[0]}, ${colour[1]}, ${colour[2]}, ${Math.max(0, Math.min(1, colour[3] * alpha))})`;
}

function withAlpha(colour, alpha) {
  return [colour[0], colour[1], colour[2], alpha];
}

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
}

function toHex(colour) {
  return '#' + colour.slice(0, 3).map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
}

/** A colour from the page's phosphor settings (#RRGGBB or rgba(...)). */
function parseColour(value, fallback) {
  const text = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(text)) return hex(text);
  const m = /^rgba?\(([^)]+)\)$/i.exec(text);
  if (m) {
    const [r, g, b] = m[1].split(',').map(Number);
    if ([r, g, b].every(Number.isFinite)) return [r, g, b, 1];
  }
  return fallback;
}

/** Every frame of a state facing south, tinted like a sprite modulate (multiply, alpha kept). */
async function tintedFrames(rsiPath, stateName, tint) {
  const rsi = await loadRsi(rsiPath);
  const state = rsi.states.get(stateName);
  if (!state) throw new Error(`state "${stateName}" is not in ${rsi.path}`);
  const image = await loadStateSheet(rsi.path, stateName);
  return stateFrames(rsi, state, image, 0).map(frame => {
    const canvas = document.createElement('canvas');
    canvas.width = rsi.size.x;
    canvas.height = rsi.size.y;
    const c = canvas.getContext('2d');
    c.drawImage(image, frame.sx, frame.sy, rsi.size.x, rsi.size.y, 0, 0, rsi.size.x, rsi.size.y);
    c.globalCompositeOperation = 'multiply';
    c.fillStyle = tint;
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(image, frame.sx, frame.sy, rsi.size.x, rsi.size.y, 0, 0, rsi.size.x, rsi.size.y);
    return canvas;
  });
}

export class TrackerReflex extends ArcadeScreen {
  constructor(colors) {
    super(colors);
    this.green = parseColour(colors.green, hex('#3FE05A'));
    this.dim = parseColour(colors.dim, hex('#1F8A33'));
    this.images = new Map();

    this.xenos = [];
    this.particles = [];
    this.acid = [];
    this.glass = [];
    this.streaks = [];
    this.drips = [];
    this.rings = [];
    this.popups = [];
    this.keyFlash = new Array(10).fill(0);
    this.tracers = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
    this.claws = [];

    this.phase = Phase.Attract;
    this.phaseTimer = 0;
    this.time = 0;
    this.freeze = 0;
    this.paused = false;
    this.female = false;

    this.wave = 0;
    this.toSpawn = 0;
    this.spawnTimer = 0;
    this.lastSpawnAngle = 0;

    this.pingAge = 0;
    this.pingPeriod = PING_IDLE;
    this.danger = false;
    this.range = -1;

    this.health = MAX_HEALTH;
    this.ammo = MAGAZINE;
    this.reload = 0;
    this.cooldown = 0;
    this.invulnerable = 0;
    this.streak = 0;
    this.kills = 0;

    this.shakeTime = 0;
    this.shakeDuration = 1;
    this.shakePower = 0;
    this.shake = { x: 0, y: 0 };
    this.redFlash = 0;
    this.clawAge = 99;
    this.ammoWarn = 0;

    this.flashSector = 5;
    this.flashAge = 99;
    this.flashHit = false;
    this.flashTo = { x: 0, y: 0 };

    this.banner = null;
    this.bannerSub = null;
    this.bannerAge = 0;
    this.bannerLife = 0;

    ensureFont('Mono');
    ensureFont('Terminal');
    preloadSounds(ALL_SOUNDS);
    this.showBanner(T.title, T.start, Infinity);
  }

  get help() {
    return T.help;
  }

  /** Xenos can reach you and you can shoot. */
  get playing() {
    return this.phase === Phase.Intro || this.phase === Phase.Wave || this.phase === Phase.Clear;
  }

  get multiplier() {
    return Math.min(MAX_MULTIPLIER, 1 + Math.floor(this.streak / STREAK_STEP));
  }

  start() {
    super.start();
    this.xenos = [];
    this.particles = [];
    this.acid = [];
    this.glass = [];
    this.streaks = [];
    this.drips = [];
    this.rings = [];
    this.popups = [];
    this.keyFlash.fill(0);

    this.female = Math.random() < 0.5;
    this.health = MAX_HEALTH;
    this.ammo = MAGAZINE;
    this.reload = 0;
    this.cooldown = 0;
    this.invulnerable = 0;
    this.streak = 0;
    this.kills = 0;
    this.wave = 0;
    this.redFlash = 0;
    this.clawAge = 99;
    this.flashAge = 99;
    this.freeze = 0;
    this.pingAge = 0;
    this.pingPeriod = PING_IDLE;
    this.range = -1;

    this.sound(POWER_ON, -2);
    this.sound(LOAD);
    this.nextWave();
  }

  // Update -------------------------------------------------------------------------------------------------------

  update(dt) {
    // a game left without the keys waits for them
    this.paused = this.running && !this.focused;
    if (this.paused) return;

    dt = Math.min(dt, 0.1);
    if (this.freeze > 0) {
      // the impact frame: everything holds still for a moment
      this.freeze -= dt;
      return;
    }

    this.time += dt;
    this.updatePhase(dt);
    this.updateXenos(dt);
    this.updatePing(dt);
    this.updateGun(dt);
    this.updateEffects(dt);
  }

  updatePhase(dt) {
    switch (this.phase) {
      case Phase.Attract:
      case Phase.Over:
        // the idle tracker still picks things up, silently: they come in and are gone
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.xenos.length < DEMO_CONTACTS) {
          this.spawn(Math.random() * TAU);
          this.spawnTimer = DEMO_GAP * (0.6 + 0.8 * Math.random());
        }
        break;
      case Phase.Intro:
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
          this.phase = Phase.Wave;
          this.spawnTimer = 0.2;
        }
        break;
      case Phase.Wave:
        this.spawnTimer -= dt;
        if (this.toSpawn > 0 && this.spawnTimer <= 0) this.spawnNext();
        if (this.toSpawn === 0 && this.xenos.length === 0) this.clearWave();
        break;
      case Phase.Clear:
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.nextWave();
        break;
      case Phase.Dying:
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
          this.phase = Phase.Over;
          this.sound(STATIC, 0, 0.8);
          this.showBanner(T.lost, T.retry, Infinity);
          this.gameOver();
        }
        break;
    }
  }

  nextWave() {
    this.wave++;
    this.toSpawn = 4 + 3 * this.wave;
    this.phase = Phase.Intro;
    this.phaseTimer = INTRO_TIME;
    this.showBanner(T.wave(this.wave), T.inbound, INTRO_TIME);
    this.sound(ROAR, this.wave === 1 ? -9 : -5);
  }

  clearWave() {
    const bonus = WAVE_POINTS * this.wave + HEALTH_POINTS * this.health;
    this.addScore(bonus);
    this.phase = Phase.Clear;
    this.phaseTimer = CLEAR_TIME;
    this.showBanner(T.clear, T.bonus(bonus), CLEAR_TIME);
    this.sound(CLEARED);
  }

  spawnNext() {
    // spread arrivals around the display instead of stacking them in one sector
    let angle = this.lastSpawnAngle;
    for (let tries = 0; tries < 4 && angleGap(angle, this.lastSpawnAngle) < 0.6; tries++) angle = Math.random() * TAU;
    this.lastSpawnAngle = angle;
    this.spawn(angle);
    this.toSpawn--;

    // later waves come in pairs now and then
    if (this.wave >= 4 && this.toSpawn > 0 && Math.random() < 0.2) {
      this.spawn(angle + (Math.random() < 0.5 ? -0.35 : 0.35));
      this.toSpawn--;
    }

    this.spawnTimer = Math.max(0.4, 1.8 - 0.16 * this.wave) * (0.7 + 0.6 * Math.random());
    if (Math.random() < 0.35) this.soundAny(GROWLS, -10);
  }

  spawn(angle) {
    const wave = this.wave;
    const runner = Math.min(0.35, 0.07 * wave);
    const lurker = wave >= 2 ? Math.min(0.25, 0.06 * (wave - 1)) : 0;
    const brute = wave >= 3 ? Math.min(0.2, 0.05 * (wave - 2)) : 0;
    const roll = Math.random();
    const kind = roll < brute ? Kind.Brute
      : roll < brute + runner ? Kind.Runner
        : roll < brute + runner + lurker ? Kind.Lurker
          : Kind.Drone;
    const pace = kind === Kind.Runner ? 1.75 : kind === Kind.Lurker ? 0.9 : kind === Kind.Brute ? 0.6 : 1;
    this.xenos.push({
      kind,
      angle,
      distance: SPAWN_RADIUS,
      speed: Math.min(0.3, 0.12 + 0.016 * wave) * pace * (0.9 + 0.2 * Math.random()),
      phase: Math.random() * TAU,
      health: kind === Kind.Brute ? 2 : 1,
      // where the last ping (or muzzle flash) saw it: the display only knows that
      shown: { x: 0, y: 0 },
      shownAge: 99,
      pinged: false,
      lunging: false,
      hurt: 0,
    });
  }

  static at(xeno) {
    return { x: Math.cos(xeno.angle) * xeno.distance, y: Math.sin(xeno.angle) * xeno.distance };
  }

  updateXenos(dt) {
    this.danger = false;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    for (let i = this.xenos.length - 1; i >= 0; i--) {
      const xeno = this.xenos[i];
      const pace = xeno.kind === Kind.Drone || xeno.kind === Kind.Brute ? 0.75 + 0.35 * Math.sin(this.time * 2.3 + xeno.phase) : 1;
      xeno.distance -= xeno.speed * pace * dt;
      if (xeno.kind === Kind.Lurker) xeno.angle += Math.sin(this.time * 1.6 + xeno.phase) * 0.9 * dt;
      xeno.hurt = Math.max(0, xeno.hurt - dt);
      xeno.shownAge += dt;

      // the lunge: once in the middle cell it is coming for you, and only 5 can stop it
      const lunging = inSector(TrackerReflex.at(xeno), 5, 0);
      if (lunging && !xeno.lunging && this.playing) this.soundAny(CHARGES, -4);
      xeno.lunging = lunging;

      this.danger ||= xeno.lunging && this.playing;
      if (xeno.distance <= MAUL_RADIUS) {
        xeno.distance = MAUL_RADIUS;
        if (!this.playing) {
          this.xenos.splice(i, 1);
          continue;
        }
        if (this.invulnerable <= 0) {
          this.xenos.splice(i, 1);
          this.maul(xeno);
        }
      }
    }
  }

  updatePing(dt) {
    if (this.phase === Phase.Dying) return;
    this.pingAge += dt;
    const ring = this.pingAge / PING_TRAVEL * 1.06;
    for (const xeno of this.xenos) {
      if (xeno.pinged || ring < xeno.distance) continue;
      xeno.pinged = true;
      xeno.shown = TrackerReflex.at(xeno);
      xeno.shownAge = 0;
    }
    if (this.pingAge >= this.pingPeriod) this.ping();
  }

  /** A new sweep: it comes round faster, higher and louder the closer the nearest contact is. */
  ping() {
    this.pingAge = 0;
    let closest = Infinity;
    for (const xeno of this.xenos) {
      xeno.pinged = false;
      if (xeno.distance <= 1) closest = Math.min(closest, xeno.distance);
    }

    if (closest > 1) {
      this.pingPeriod = PING_IDLE;
      this.range = -1;
      if (this.playing) this.sound(PING_EMPTY, -7);
      return;
    }

    const near = 1 - Math.min(1, Math.max(0, (closest - MAUL_RADIUS) / (1 - MAUL_RADIUS)));
    this.pingPeriod = PING_FAR + (PING_NEAR - PING_FAR) * near;
    this.range = Math.round(closest * RANGE_METRES);

    // fast pings overlap their tails, so they come down a little to stay under the gunfire
    if (this.playing) this.sound(PING_CONTACT, -5 + 3 * near - (near > 0.6 ? 2 : 0), 1 + 0.3 * near);
  }

  updateGun(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.ammoWarn = Math.max(0, this.ammoWarn - dt);
    if (this.reload <= 0) return;
    const before = this.reload;
    this.reload -= dt;
    if (before > RELOAD_TIME * 0.45 && this.reload <= RELOAD_TIME * 0.45) this.sound(LOAD);
    if (this.reload > 0) return;
    this.reload = 0;
    this.ammo = MAGAZINE;
  }

  updateEffects(dt) {
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const power = this.shakePower * Math.max(0, this.shakeTime / this.shakeDuration);
      this.shake = { x: (Math.random() * 2 - 1) * power, y: (Math.random() * 2 - 1) * power };
    } else {
      this.shake = { x: 0, y: 0 };
    }

    this.redFlash = Math.max(0, this.redFlash - dt * 1.8);
    this.clawAge += dt;
    this.flashAge += dt;
    this.bannerAge += dt;
    for (let i = 0; i < this.keyFlash.length; i++) this.keyFlash[i] = Math.max(0, this.keyFlash[i] - dt * 4);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        if (p.lands) this.addDecal(p.glass ? this.glass : this.acid, p.x, p.y, p.size * 2.6, p.colour, p.glass ? MAX_GLASS : MAX_DECALS);
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const drag = Math.exp(-p.drag * dt);
      p.vx *= drag;
      p.vy *= drag;
      if (p.glass) p.vy += 90 * dt;
    }

    for (const drip of this.drips) {
      if (drip.length >= drip.max || drip.speed < 1) continue;
      drip.length = Math.min(drip.max, drip.length + drip.speed * dt);
      drip.speed *= Math.exp(-1.4 * dt);
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].age += dt;
      if (this.rings[i].age >= this.rings[i].life) this.rings.splice(i, 1);
    }

    for (let i = this.popups.length - 1; i >= 0; i--) {
      this.popups[i].age += dt;
      if (this.popups[i].age >= 0.9) this.popups.splice(i, 1);
    }
  }

  // Shooting -----------------------------------------------------------------------------------------------------

  onKey(input) {
    if (!input.down || input.repeat || !this.running) return;
    let sector = input.pad;
    if (sector === 0) {
      sector = input.key === Key.Up ? 8 : input.key === Key.Down ? 2 : input.key === Key.Left ? 4 : input.key === Key.Right ? 6 : 0;
    }
    if (sector !== 0) this.fire(sector);
    else if (input.key === Key.Action) this.startReload();
  }

  startReload() {
    if (!this.playing || this.reload > 0 || this.ammo === MAGAZINE) return;
    this.reload = RELOAD_TIME;
    this.sound(UNLOAD);
  }

  fire(sector) {
    if (!this.playing || this.cooldown > 0) return;

    if (this.reload > 0 || this.ammo === 0) {
      this.sound(DRY_FIRE);
      this.cooldown = FIRE_COOLDOWN * 2;
      if (this.reload <= 0) this.ammoWarn = 0.6;
      return;
    }

    this.ammo--;
    this.cooldown = FIRE_COOLDOWN;
    this.sound(SHOT, -2, 0.95 + Math.random() * 0.1);
    this.keyFlash[sector] = 1;
    this.shakeScreen(1.2, 0.08);

    // the muzzle flash lights the sector: anything there shows up where it really is
    let target = -1;
    for (let i = 0; i < this.xenos.length; i++) {
      const xeno = this.xenos[i];
      const at = TrackerReflex.at(xeno);
      if (xeno.distance > 1 || !inSector(at, sector, TOLERANCE)) continue;
      xeno.shown = at;
      xeno.shownAge = 0;
      if (target < 0 || xeno.distance < this.xenos[target].distance) target = i;
    }

    this.flashSector = sector;
    this.flashAge = 0;
    this.flashHit = target >= 0;
    const centre = CELL_CENTRES[sector];
    const reach = sector === 5 ? 0 : 1.15;
    this.flashTo = target >= 0 ? TrackerReflex.at(this.xenos[target]) : { x: centre.x * reach, y: centre.y * reach };
    for (const tracer of this.tracers) {
      const spread = target >= 0 ? 0.06 : 0.25;
      tracer.x = (Math.random() - 0.5) * spread;
      tracer.y = (Math.random() - 0.5) * spread;
    }

    if (target < 0) {
      this.miss(sector);
      return;
    }
    this.hit(target, sector === 5);
  }

  miss(sector) {
    this.streak = 0;
    this.addScore(-MISS_PENALTY);
    const at = unit(CELL_CENTRES[sector]);
    this.pop(T.miss, at.x, at.y, this.dim);
  }

  hit(index, pointBlank) {
    const xeno = this.xenos[index];
    const position = TrackerReflex.at(xeno);
    const at = unit(position);
    const length = Math.hypot(position.x, position.y);
    const outward = length > 0.01 ? { x: position.x / length, y: position.y / length } : { x: 0, y: -1 };
    xeno.health--;
    if (xeno.health > 0) {
      // a brute shrugs it off and gets knocked back, bleeding acid
      xeno.hurt = 0.15;
      xeno.distance = Math.min(1, xeno.distance + 0.08);
      xeno.shown = TrackerReflex.at(xeno);
      xeno.shownAge = 0;
      this.spray(at, outward, 0.9, 8, 30, 70, ACID, false, 0.4);
      this.addDecal(this.acid, at.x, at.y, 18 + Math.random() * 8, ACID_STAIN, MAX_DECALS);
      this.soundAny(FLESH, -3);
      this.soundAny(HISSES, -4);
      return;
    }

    this.xenos.splice(index, 1);
    this.kills++;
    this.streak++;
    const points = KILL_POINTS * this.multiplier + (pointBlank ? POINT_BLANK_POINTS : 0);
    this.addScore(points);
    this.pop(`+${points}`, at.x, at.y - 6, HOT);
    if (pointBlank) this.pop(T.close, at.x, at.y + 8, WARN);
    else if (this.streak % STREAK_STEP === 0 && this.multiplier > 1) this.pop(T.multiplier(this.multiplier), at.x, at.y + 8, ACID);

    const big = xeno.kind === Kind.Brute;
    this.spray(at, outward, 1.3, big ? 26 : 16, 35, big ? 120 : 95, ACID, false, 0.35);
    this.addDecal(this.acid, at.x, at.y, (big ? 46 : 32) + Math.random() * 10, ACID_STAIN, MAX_DECALS);
    this.rings.push({ x: at.x, y: at.y, age: 0, life: 0.32, size: big ? 22 : 15, colour: ACID });
    this.shakeScreen(big ? 3 : 1.8, 0.14);
    this.freeze = 0.035;

    if (big) this.sound(BRUTE_DEATH, -3);
    else this.soundAny(DEATHS, -3);
    this.soundAny(SIZZLES, -8);
  }

  /** One got through: claws across the glass, your blood on it for the rest of the run. */
  maul(xeno) {
    this.health--;
    this.streak = 0;
    this.invulnerable = INVULNERABLE;
    this.freeze = 0.12;
    this.redFlash = 1;
    this.clawAge = 0;
    this.shakeScreen(6, 0.5);

    const from = xeno.angle;
    const direction = { x: Math.cos(from), y: Math.sin(from) };
    const slash = from + Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    const along = { x: Math.cos(slash), y: Math.sin(slash) };
    const across = { x: -along.y, y: along.x };
    const middle = { x: CENTRE_X + direction.x * 18, y: CENTRE_Y + direction.y * 18 };
    this.claws = [];
    for (let i = 0; i < 3; i++) {
      const start = { x: middle.x + across.x * (i - 1) * 13 - along.x * 80, y: middle.y + across.y * (i - 1) * 13 - along.y * 80 };
      this.claws.push({ start, along });
      const end = 140 - Math.random() * 30;
      this.addStreak(start.x + along.x * 20, start.y + along.y * 20, start.x + along.x * end, start.y + along.y * end, 1.4 + Math.random());
    }

    const splats = this.health <= 0 ? 7 : 3;
    for (let i = 0; i < splats; i++) {
      const reach = Math.random() * 70;
      const spot = {
        x: middle.x + direction.x * reach + (Math.random() - 0.5) * 110,
        y: middle.y + direction.y * reach + (Math.random() - 0.5) * 110,
      };
      const size = 50 + Math.random() * 55;
      this.addDecal(this.glass, spot.x, spot.y, size, BLOOD, MAX_GLASS);
      for (let d = 0; d < 2; d++) {
        this.drips.push({
          x: spot.x + (Math.random() - 0.5) * size * 0.5,
          y: spot.y + (Math.random() - 0.2) * size * 0.3,
          length: 0,
          max: 18 + Math.random() * 55,
          speed: 40 + Math.random() * 50,
          width: 1.5 + Math.random() * 1.8,
        });
      }
    }

    this.spray({ x: CENTRE_X, y: CENTRE_Y }, direction, Math.PI, this.health <= 0 ? 40 : 24, 90, 230, BLOOD, true, 0.45);
    this.pop('-1', CENTRE_X, CENTRE_Y - 16, WARN);

    this.soundAny(CLAWS, 0);
    scream(this.female, { source: this.canvas });
    if (this.health > 0) return;

    this.soundAny(BITES, 0);
    this.phase = Phase.Dying;
    this.phaseTimer = DYING_TIME;
    this.freeze = 0.2;
    this.reload = 0;
    this.banner = null;
  }

  // Effects ------------------------------------------------------------------------------------------------------

  soundAny(paths, volume) {
    playAny(paths, { volume, source: this.canvas });
  }

  addScore(points) {
    this.score = Math.min(MAX_SCORE, Math.max(0, this.score + points));
  }

  shakeScreen(power, duration) {
    if (power < this.shakePower * Math.max(0, this.shakeTime / this.shakeDuration)) return;
    this.shakePower = power;
    this.shakeTime = duration;
    this.shakeDuration = duration;
  }

  showBanner(text, sub, life) {
    this.banner = text;
    this.bannerSub = sub;
    this.bannerAge = 0;
    this.bannerLife = life;
  }

  pop(text, x, y, colour) {
    this.popups.push({ text, x, y, age: 0, colour });
  }

  spray(at, direction, spread, count, slowest, fastest, colour, glass, lands) {
    const heading = Math.atan2(direction.y, direction.x);
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const angle = heading + (Math.random() - 0.5) * 2 * spread;
      const speed = slowest + Math.random() * (fastest - slowest);
      this.particles.push({
        x: at.x,
        y: at.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        life: 0.3 + Math.random() * 0.45,
        size: 0.8 + Math.random() * 1.6,
        drag: glass ? 2.5 : 3.2,
        colour,
        // on the glass in front of the display: it does not shake with the screen
        glass,
        // leaves a drop where it comes to rest
        lands: Math.random() < lands,
      });
    }
  }

  addDecal(decals, x, y, size, colour, max) {
    if (decals.length >= max) decals.shift();
    decals.push({ x, y, size, state: Math.floor(Math.random() * SPLATTER_STATES), rotation: Math.random() * TAU, colour });
  }

  addStreak(x1, y1, x2, y2, width) {
    if (this.streaks.length >= MAX_STREAKS) this.streaks.shift();
    this.streaks.push({ x1, y1, x2, y2, width });
  }

  // Images -------------------------------------------------------------------------------------------------------

  /** A cached image (or frame list) once loaded; null until then or if it cannot be read. */
  image(key, load) {
    if (this.images.has(key)) return this.images.get(key);
    this.images.set(key, null);
    load().then(image => this.images.set(key, image), e => console.warn(`tracker: ${e.message}`));
    return null;
  }

  splatter(state, colour) {
    const tint = toHex(colour);
    return this.image(`splatter|${state}|${tint}`, () => stateCanvas(SPLATTER, `splatter-${state}`, tint));
  }

  /** The real tracker's blip: a dot that rings outward. */
  echo(colour) {
    const tint = toHex(colour);
    return this.image(`echo|${tint}`, () => tintedFrames(DETECTOR, 'detector_blip', tint));
  }

  // Drawing ------------------------------------------------------------------------------------------------------

  drawGame(ctx) {
    const dead = this.phase === Phase.Dying || this.phase === Phase.Over;

    // a dying tracker flickers out
    const lit = this.phase !== Phase.Dying || Math.floor(this.time * 22) % 3 !== 0;
    this.drawDisplay(ctx, lit);
    if (lit) {
      for (const decal of this.acid) this.drawDecal(ctx, decal, true);
      this.drawPing(ctx);
      this.drawFlash(ctx);
      this.drawBlips(ctx);
      this.drawMarine(ctx);
      for (const ring of this.rings) {
        const t = ring.age / ring.life;
        this.circle(ctx, ring.x, ring.y, ring.size * t, ring.colour, 1 - t, false);
        this.circle(ctx, ring.x, ring.y, ring.size * t + 1, ring.colour, (1 - t) * 0.5, false);
      }
    }

    if (dead) this.drawStatic(ctx, this.phase === Phase.Dying ? 18 : 6);
    this.drawGlare(ctx);
    this.drawPanels(ctx);

    for (const p of this.particles) {
      const t = p.age / p.life;
      this.circle(ctx, p.x, p.y, p.size * (1 - t * 0.4), p.colour, 1 - t * t, true, !p.glass);
    }

    for (const popup of this.popups) {
      const t = popup.age / 0.9;
      const rise = -18 * (1 - (1 - t) * (1 - t));
      this.centred(ctx, FONTS.small, popup.text, popup.x, popup.y + rise, popup.colour, 1 - t * t);
    }

    this.drawGlass(ctx);
    this.drawDanger(ctx);
    this.drawBanner(ctx);
    this.drawScanlines(ctx);
  }

  drawDisplay(ctx, lit) {
    this.circle(ctx, CENTRE_X, CENTRE_Y, RADIUS + 7, BEZEL, 1);
    this.circle(ctx, CENTRE_X, CENTRE_Y, RADIUS + 7, this.dim, 0.6, false);
    this.circle(ctx, CENTRE_X, CENTRE_Y, RADIUS + 2, BLACK, 1);
    this.circle(ctx, CENTRE_X, CENTRE_Y, RADIUS, FACE, 1);
    if (!lit) return;

    // a soft phosphor bloom towards the middle
    this.circle(ctx, CENTRE_X, CENTRE_Y, RADIUS * 0.55, this.green, 0.025);
    this.circle(ctx, CENTRE_X, CENTRE_Y, RADIUS, this.dim, 0.9, false);
    this.circle(ctx, CENTRE_X, CENTRE_Y, RADIUS * 0.5, this.dim, 0.35, false);
    this.circle(ctx, CENTRE_X, CENTRE_Y, RADIUS * MAUL_RADIUS, this.dim, 0.5, false);

    for (let i = 0; i < 24; i++) {
      const angle = i * TAU / 24;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const inner = i % 6 === 0 ? 0.9 : 0.95;
      this.line(ctx, unit({ x: dx * inner, y: dy * inner }), unit({ x: dx, y: dy }), this.dim, 0.8);
    }

    // the keypad grid: chords at a third either way, the middle cell boxed in
    const chord = Math.sqrt(1 - THIRD * THIRD);
    this.line(ctx, unit({ x: -THIRD, y: -chord }), unit({ x: -THIRD, y: chord }), this.dim, 0.55);
    this.line(ctx, unit({ x: THIRD, y: -chord }), unit({ x: THIRD, y: chord }), this.dim, 0.55);
    this.line(ctx, unit({ x: -chord, y: -THIRD }), unit({ x: chord, y: -THIRD }), this.dim, 0.55);
    this.line(ctx, unit({ x: -chord, y: THIRD }), unit({ x: chord, y: THIRD }), this.dim, 0.55);

    const pulse = 0.5 + 0.5 * Math.sin(this.time * 18);
    const corner = unit({ x: -THIRD, y: -THIRD });
    const size = 2 * THIRD * RADIUS;
    ctx.strokeStyle = this.danger ? css(WARN, 0.45 + 0.5 * pulse) : css(this.dim);
    ctx.lineWidth = 1;
    ctx.strokeRect(corner.x + this.shake.x + 0.5, corner.y + this.shake.y + 0.5, size, size);
    if (this.danger) this.drawCell(ctx, 5, WARN, 0.06 + 0.08 * pulse);

    for (let sector = 1; sector <= 9; sector++) {
      if (sector === 5) continue;
      const centre = CELL_CENTRES[sector];
      const label = unit({ x: centre.x * 1.12, y: centre.y * 1.12 });
      this.centred(ctx, FONTS.small, String(sector), label.x, label.y, this.dim, 0.45 + 0.55 * this.keyFlash[sector]);
    }
  }

  drawCell(ctx, sector, colour, alpha) {
    const outline = CELLS[sector];
    ctx.fillStyle = css(colour, alpha);
    ctx.beginPath();
    outline.forEach((point, i) => {
      const at = unit(point);
      if (i === 0) ctx.moveTo(at.x + this.shake.x, at.y + this.shake.y);
      else ctx.lineTo(at.x + this.shake.x, at.y + this.shake.y);
    });
    ctx.closePath();
    ctx.fill();
  }

  drawPing(ctx) {
    const t = this.pingAge / PING_TRAVEL;
    if (t >= 1) return;
    const radius = t * 1.06 * RADIUS;
    const colour = this.danger ? mix(this.green, WARN, 0.4) : this.green;
    this.circle(ctx, CENTRE_X, CENTRE_Y, radius, colour, 0.05 * (1 - t));
    this.circle(ctx, CENTRE_X, CENTRE_Y, radius, colour, 0.85 * (1 - t * 0.7), false);
    this.circle(ctx, CENTRE_X, CENTRE_Y, Math.max(0, radius - 2), colour, 0.35 * (1 - t), false);
    this.circle(ctx, CENTRE_X, CENTRE_Y, Math.max(0, radius - 5), colour, 0.15 * (1 - t), false);
  }

  /** The burst: the sector lights up, tracers run out from you, a spark where they land. */
  drawFlash(ctx) {
    const life = 0.14;
    if (this.flashAge >= life) return;
    const a = 1 - this.flashAge / life;
    this.drawCell(ctx, this.flashSector, this.green, (this.flashHit ? 0.26 : 0.16) * a);

    const target = this.flashTo;
    const length = Math.hypot(target.x, target.y);
    const heading = length > 0.01 ? { x: target.x / length, y: target.y / length } : { x: 0, y: -1 };
    const muzzle = unit({ x: heading.x * 0.07, y: heading.y * 0.07 });
    for (const jitter of this.tracers) {
      this.thick(ctx, muzzle, unit({ x: target.x + jitter.x, y: target.y + jitter.y }), 1.3, HOT, a, true);
    }

    // a star of a muzzle flash, then the hit spark
    ctx.fillStyle = css(HOT, a);
    ctx.beginPath();
    for (let i = 0; i < 13; i++) {
      const angle = i * TAU / 12 + this.flashAge * 9;
      const reach = (i % 2 === 0 ? 7 : 2.5) * (0.6 + 0.4 * a);
      const x = muzzle.x + this.shake.x + Math.cos(angle) * reach;
      const y = muzzle.y + this.shake.y + Math.sin(angle) * reach;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    if (this.flashHit) {
      const at = unit(target);
      this.circle(ctx, at.x, at.y, 2 + 6 * (1 - a), HOT, a);
      this.circle(ctx, at.x, at.y, 4 + 9 * (1 - a), ACID, 0.6 * a, false);
    }
  }

  drawBlips(ctx) {
    for (const xeno of this.xenos) {
      if (xeno.shownAge >= BLIP_FADE) continue;
      let fade = 1 - xeno.shownAge / BLIP_FADE;
      if (xeno.kind === Kind.Lurker) fade *= 0.7 + 0.3 * Math.sin(this.time * 25 + xeno.phase);
      const at = unit(xeno.shown);
      const colour = xeno.hurt > 0 ? HOT : xeno.lunging ? WARN : this.green;
      let size = xeno.kind === Kind.Runner ? 2.2 : xeno.kind === Kind.Lurker ? 2.7 : xeno.kind === Kind.Brute ? 4.2 : 3;

      // it pops when the ping finds it, then settles
      size *= 1 + 0.7 * Math.max(0, 0.12 - xeno.shownAge) / 0.12;
      if (xeno.shownAge < ECHO_TIME) {
        const frames = this.echo(colour);
        if (frames && frames.length) {
          const frame = Math.min(frames.length - 1, Math.floor(xeno.shownAge / ECHO_TIME * frames.length));
          this.drawImage(ctx, frames[frame], at.x, at.y, size * 7.5, 0, 0.8 * fade, true);
        }
      }

      this.circle(ctx, at.x, at.y, size * 2.6, colour, 0.1 * fade);
      this.circle(ctx, at.x, at.y, size * 1.7, colour, 0.22 * fade);
      this.circle(ctx, at.x, at.y, size, colour, fade);
      this.circle(ctx, at.x, at.y, size * 0.45, HOT, fade);
      if (xeno.kind === Kind.Brute) this.circle(ctx, at.x, at.y, size + 3, colour, 0.6 * fade, false);
    }
  }

  drawMarine(ctx) {
    const hurt = this.invulnerable > 0 && Math.floor(this.time * 12) % 2 === 0;
    const colour = hurt ? WARN : this.phase === Phase.Dying || this.phase === Phase.Over ? BLOOD_DARK : this.green;
    const x = CENTRE_X + this.shake.x;
    const y = CENTRE_Y + this.shake.y;
    ctx.fillStyle = css(colour);
    ctx.beginPath();
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x + 4, y + 4);
    ctx.lineTo(x, y + 2);
    ctx.lineTo(x - 4, y + 4);
    ctx.closePath();
    ctx.fill();
  }

  drawStatic(ctx, lines) {
    for (let i = 0; i < lines; i++) {
      const y = (Math.random() * 2 - 1) * 0.95;
      const half = Math.sqrt(1 - y * y);
      const x = (Math.random() * 2 - 1) * half;
      const length = Math.random() * 0.5;
      this.line(ctx, unit({ x: Math.max(-half, x - length), y }), unit({ x: Math.min(half, x + length), y }), this.green,
        0.15 + Math.random() * 0.3);
    }
  }

  drawGlare(ctx) {
    const points = [{ x: -0.82, y: -0.3 }, { x: -0.3, y: -0.82 }, { x: -0.12, y: -0.66 }, { x: -0.66, y: -0.12 }];
    ctx.fillStyle = css(WHITE, 0.035);
    ctx.beginPath();
    points.forEach((point, i) => {
      const at = unit(point);
      if (i === 0) ctx.moveTo(at.x + this.shake.x, at.y + this.shake.y);
      else ctx.lineTo(at.x + this.shake.x, at.y + this.shake.y);
    });
    ctx.closePath();
    ctx.fill();
  }

  drawPanels(ctx) {
    // left: vitals, the rifle's counter, the streak
    this.text(ctx, FONTS.small, T.vitals, 10, 30, this.dim);
    for (let i = 0; i < MAX_HEALTH; i++) {
      const alive = i < this.health;
      const x = 16 + i * 16;
      const y = 47;
      let colour = alive ? this.green : BLOOD_DARK;
      if (alive && this.health === 1) colour = mix(this.green, WARN, 0.5 + 0.5 * Math.sin(this.time * 9));
      this.fill(ctx, x - 5, y - 1.5, 10, 3, colour);
      this.fill(ctx, x - 1.5, y - 5, 3, 10, colour);
      if (!alive) {
        this.thick(ctx, { x: x - 5, y: y - 5 }, { x: x + 5, y: y + 5 }, 1.2, WARN, 0.7, true);
        this.thick(ctx, { x: x + 5, y: y - 5 }, { x: x - 5, y: y + 5 }, 1.2, WARN, 0.7, true);
      }
    }

    this.text(ctx, FONTS.small, T.ammo, 10, 60, this.dim);
    const blink = Math.floor(this.time * 4) % 2 === 0;
    const low = this.ammo <= 2 && this.reload <= 0;
    const rounds = this.ammo * ROUNDS_PER_BURST;
    this.text(ctx, FONTS.big, String(rounds).padStart(2, '0'), 10, 72, low && blink ? WARN : this.green);
    if (this.reload > 0) {
      const done = 1 - this.reload / RELOAD_TIME;
      this.fill(ctx, 10, 95, 48, 4, this.dim, 0.4);
      this.fill(ctx, 10, 95, 48 * done, 4, this.green);
      this.text(ctx, FONTS.small, T.reloading, 10, 102, this.green);
    } else {
      for (let i = 0; i < MAGAZINE; i++) {
        if (i < this.ammo) this.fill(ctx, 10 + i * 5, 95, 3, 4, this.green);
        else this.fill(ctx, 10 + i * 5, 95, 3, 4, this.dim, 0.35);
      }
      if ((this.ammo === 0 || this.ammoWarn > 0) && blink) this.text(ctx, FONTS.small, T.reload, 10, 102, WARN);
    }

    this.text(ctx, FONTS.small, T.streak, 10, 120, this.dim);
    this.text(ctx, FONTS.medium, T.multiplier(this.multiplier), 10, 132, this.multiplier > 1 ? ACID : this.green);
    this.text(ctx, FONTS.small, T.kills(this.kills), 10, 200, this.dim);

    // right: the range to the nearest contact, the wave, the keypad
    this.text(ctx, FONTS.small, T.range, 262, 30, this.dim);
    const range = this.danger ? T.danger : this.range < 0 ? T.none : T.metres(this.range);
    this.text(ctx, FONTS.medium, range, 262, 42, this.danger && blink ? WARN : this.green);
    this.text(ctx, FONTS.small, T.model, 314, 4, this.dim, 1, true);

    this.text(ctx, FONTS.small, T.waveLabel, 262, 62, this.dim);
    this.text(ctx, FONTS.medium, String(this.wave), 262, 74, this.green);

    this.text(ctx, FONTS.small, T.keypad, 262, 136, this.dim);
    for (let sector = 1; sector <= 9; sector++) {
      const column = (sector - 1) % 3;
      const row = 2 - Math.floor((sector - 1) / 3);
      const x = 262 + column * 17;
      const y = 148 + row * 17;
      const contact = sector === 5 ? this.danger : this.sectorShows(sector);
      let fill = sector === 5 && this.danger ? withAlpha(WARN, 0.35) : contact ? withAlpha(this.dim, 0.45) : [0, 0, 0, 0];
      fill = mix(fill, this.green, this.keyFlash[sector]);
      if (fill[3] > 0) this.fill(ctx, x, y, 15, 15, fill);
      ctx.strokeStyle = css(this.dim);
      ctx.lineWidth = 1;
      ctx.strokeRect(x + this.shake.x + 0.5, y + this.shake.y + 0.5, 15, 15);
      this.centred(ctx, FONTS.small, String(sector), x + 7.5, y + 7.5, this.keyFlash[sector] > 0.5 ? BLACK : this.green);
    }
  }

  /** Whether a blip still glows in that sector, for the keypad on the side panel. */
  sectorShows(sector) {
    return this.xenos.some(xeno => xeno.shownAge < BLIP_FADE * 0.8 && inSector(xeno.shown, sector, 0));
  }

  /** Your blood on the glass: it stays put when the screen shakes, and runs down slowly. */
  drawGlass(ctx) {
    for (const s of this.streaks) this.thick(ctx, { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }, s.width, BLOOD_DARK, 0.7 / 0.9, false);
    for (const decal of this.glass) this.drawDecal(ctx, decal, false);
    for (const drip of this.drips) {
      const bottom = { x: drip.x, y: drip.y + drip.length };
      this.thick(ctx, { x: drip.x, y: drip.y }, bottom, drip.width, BLOOD_DARK, 1, false);
      this.circle(ctx, bottom.x, bottom.y, drip.width * 0.75, BLOOD_DARK, 1, true, false);
    }

    // the claws: three slashes torn across in a blink, fading out
    const swipe = 0.07;
    const hold = 0.45;
    if (this.clawAge < swipe + hold) {
      const reach = Math.min(1, this.clawAge / swipe);
      const fade = this.clawAge < swipe ? 1 : 1 - (this.clawAge - swipe) / hold;
      const colour = mix(WHITE, WARN, Math.min(1, this.clawAge / 0.15));
      for (const { start, along } of this.claws) {
        const end = { x: start.x + along.x * 160 * reach, y: start.y + along.y * 160 * reach };
        this.thick(ctx, start, end, 3.5, colour, fade, false);
      }
    }

    if (this.redFlash > 0) {
      ctx.fillStyle = css(WARN, 0.5 * this.redFlash * this.redFlash);
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    }
    if (this.phase === Phase.Dying || this.phase === Phase.Over) {
      ctx.fillStyle = css(BLOOD_DARK, 0.18 / 0.9);
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    }
  }

  /** The edges pulse red while something is in the middle cell, and slowly on your last life. */
  drawDanger(ctx) {
    let alpha = 0;
    if (this.danger) alpha = 0.18 + 0.14 * Math.sin(this.time * 18);
    else if (this.health === 1 && this.playing) alpha = 0.08 * Math.max(0, Math.sin(this.time * 5));
    if (alpha <= 0) return;
    for (let layer = 1; layer <= 2; layer++) {
      const edge = 6 * layer;
      ctx.fillStyle = css(WARN, alpha / layer);
      ctx.fillRect(0, 0, SCREEN_W, edge);
      ctx.fillRect(0, SCREEN_H - edge, SCREEN_W, edge);
      ctx.fillRect(0, edge, edge, SCREEN_H - 2 * edge);
      ctx.fillRect(SCREEN_W - edge, edge, edge, SCREEN_H - 2 * edge);
    }
  }

  drawBanner(ctx) {
    if (this.paused) {
      this.bannerBox(ctx, T.paused, null, 1, 1);
      return;
    }
    if (this.banner == null || this.bannerAge >= this.bannerLife) return;

    let fade = Math.min(1, this.bannerAge / 0.12);
    if (Number.isFinite(this.bannerLife)) fade = Math.min(fade, (this.bannerLife - this.bannerAge) / 0.3);

    // it slams in a little oversized and settles
    const slam = 1 + 0.35 * Math.max(0, 1 - this.bannerAge / 0.15);
    let sub = this.bannerSub;
    if (sub === T.start || sub === T.retry) {
      if (!this.focused || Math.floor(this.time * 2) % 2 === 1) sub = null;
    }
    this.bannerBox(ctx, this.banner, sub, fade, slam);
  }

  bannerBox(ctx, text, sub, fade, slam) {
    const font = FONTS.big;
    // a long one shrinks to fit inside the display
    ctx.font = font.family.replace('{px}', font.px.toFixed(2));
    const fit = Math.min(1, BANNER_WIDTH / ctx.measureText(text).width);
    const px = font.px * fit * slam;
    ctx.font = font.family.replace('{px}', px.toFixed(2));
    const width = ctx.measureText(text).width;
    const height = font.height * px;
    const cx = CENTRE_X;
    const cy = CENTRE_Y - 10;
    const left = cx - width / 2;
    const top = cy - height / 2;
    ctx.fillStyle = css(BLACK, 0.75 * fade);
    ctx.fillRect(left - 8, top - 4, width + 16, height + 8);
    ctx.strokeStyle = css(this.green, 0.8 * fade);
    ctx.lineWidth = 1;
    ctx.strokeRect(left - 8 + 0.5, top - 4 + 0.5, width + 16 - 1, height + 8 - 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const baseline = top + font.ascent * px;
    ctx.fillStyle = css(this.green, 0.25 * fade);
    ctx.fillText(text, left - 1, baseline);
    ctx.fillText(text, left + 1, baseline);
    ctx.fillStyle = css(this.green, fade);
    ctx.fillText(text, left, baseline);
    if (sub == null) return;

    const small = FONTS.small;
    ctx.font = small.family.replace('{px}', small.px.toFixed(2));
    const subWidth = ctx.measureText(sub).width;
    const subHeight = small.height * small.px;
    const subLeft = cx - subWidth / 2;
    const subTop = CENTRE_Y + 12 - subHeight / 2;
    ctx.fillStyle = css(BLACK, 0.7 * fade);
    ctx.fillRect(subLeft - 4, subTop - 2, subWidth + 8, subHeight + 4);
    ctx.fillStyle = css(HOT, fade);
    ctx.fillText(sub, subLeft, subTop + small.ascent * small.px);
  }

  /** The CRT: dark lines across the picture and a faint bright band rolling down it. */
  drawScanlines(ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    for (let y = 0; y < SCREEN_H; y += 3) ctx.fillRect(0, y, SCREEN_W, 1);
    const roll = (this.time * 40) % 264 - 20;
    ctx.fillStyle = css(this.green, 0.025);
    ctx.fillRect(0, roll, SCREEN_W, 20);
  }

  drawDecal(ctx, decal, shaken) {
    const image = this.splatter(decal.state, decal.colour);
    if (image) this.drawImage(ctx, image, decal.x, decal.y, decal.size, decal.rotation, decal.colour[3], shaken);
  }

  // Drawing helpers ----------------------------------------------------------------------------------------------

  drawImage(ctx, image, x, y, size, rotation, alpha, shaken) {
    const ox = shaken ? this.shake.x : 0;
    const oy = shaken ? this.shake.y : 0;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.imageSmoothingEnabled = false;
    ctx.translate(x + ox, y + oy);
    if (rotation) ctx.rotate(rotation);
    ctx.drawImage(image, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  circle(ctx, x, y, radius, colour, alpha = 1, filled = true, shaken = true) {
    if (radius <= 0) return;
    const ox = shaken ? this.shake.x : 0;
    const oy = shaken ? this.shake.y : 0;
    ctx.beginPath();
    ctx.arc(x + ox, y + oy, radius, 0, TAU);
    if (filled) {
      ctx.fillStyle = css(colour, alpha);
      ctx.fill();
    } else {
      ctx.strokeStyle = css(colour, alpha);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  line(ctx, from, to, colour, alpha = 1) {
    ctx.strokeStyle = css(colour, alpha);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(from.x + this.shake.x, from.y + this.shake.y);
    ctx.lineTo(to.x + this.shake.x, to.y + this.shake.y);
    ctx.stroke();
  }

  /** A line with a width; shaken with the screen unless it is on the glass. */
  thick(ctx, from, to, width, colour, alpha, shaken) {
    const ox = shaken ? this.shake.x : 0;
    const oy = shaken ? this.shake.y : 0;
    ctx.strokeStyle = css(colour, alpha);
    ctx.lineWidth = width;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(from.x + ox, from.y + oy);
    ctx.lineTo(to.x + ox, to.y + oy);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  fill(ctx, x, y, width, height, colour, alpha = 1) {
    ctx.fillStyle = css(colour, alpha);
    ctx.fillRect(x + this.shake.x, y + this.shake.y, width, height);
  }

  /** Text whose top left is at (x, y), placed like the engine places it: the baseline one ascent down. */
  text(ctx, font, str, x, y, colour, alpha = 1, right = false) {
    ctx.font = font.family.replace('{px}', font.px.toFixed(2));
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    if (right) x -= ctx.measureText(str).width;
    ctx.fillStyle = css(colour, alpha);
    ctx.fillText(str, x + this.shake.x, y + this.shake.y + font.ascent * font.px);
  }

  centred(ctx, font, str, x, y, colour, alpha = 1) {
    ctx.font = font.family.replace('{px}', font.px.toFixed(2));
    const width = ctx.measureText(str).width;
    this.text(ctx, font, str, x - width / 2, y - font.height * font.px / 2, colour, alpha);
  }
}

/** A point on the unit disc of the display, in screen units. */
function unit(point) {
  return { x: CENTRE_X + point.x * RADIUS, y: CENTRE_Y + point.y * RADIUS };
}
