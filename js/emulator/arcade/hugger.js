// Hugger Run, a port of Arcade/CMUHuggerRun.cs: a side-scrolling runner. A facehugger scurries right along a
// colony corridor that speeds up the further it gets, while marines fire pulse rifle tracers its way to be jumped
// or ducked. Colonists and marines wander into its path: dropping onto a face infects them and ends the run as a
// win with a big bonus, while running into their legs gets it kicked flat. Green phosphor corridor, the game's own
// sprites in colour. Constants, layout (320 x 224 units), sprites, sounds and strings match the C# file; keep them
// in step. The scenery hash is the same too, so both corridors have the same panels in the same places.

import { ArcadeScreen, Key, SCREEN_W, SCREEN_H, TAU } from './screen.js';
import { scream, preloadSounds } from '../audio.js';
import { layerCanvas, stateCanvas } from '../sports/dolls.js';
import { loadRsi, loadStateSheet, stateFrames } from '../../sprites.js';
import { ensureFont } from '../../fonts.js';

// Tuning ---------------------------------------------------------------------------------------------------------

const HUD_HEIGHT = 16;
const CEILING_Y = 40;
const FLOOR_Y = 186;
const HUGGER_X = 64;

// the parasite's 32 px sprite drawn at 1.25, with the 3 px of air under its feet in that sprite
const HUGGER_SIZE = 40;
const HUGGER_FOOT_PAD = 3.75;
const HUGGER_HALF_WIDTH = 11;
const HUGGER_HEIGHT = 21;
const DUCK_HEIGHT = 11;

// humans are 32 px sprites drawn at 2x with their feet on the floor
const HUMAN_SIZE = 64;

// how far each layer moves for every unit the floor moves
const WALL_DEPTH = 0.85;
const OUTSIDE_DEPTH = 0.12;
const HILL_DEPTH = 0.22;
const PANEL_WIDTH = 64;

const START_SPEED = 150;
const MAX_SPEED = 400;
const ACCELERATION = 2.6;
const UNITS_PER_POINT = 12;
const MILESTONE = 100;

// a quick tap leaps about 45 units and a full hold about 94: high enough to clear a human outright, so a face is
// something to aim for, not something in the way
const JUMP_VELOCITY = 330;
const GRAVITY = 2000;
const HOLD_GRAVITY = 500;
const MAX_HOLD = 0.38;
const FAST_FALL_GRAVITY = 4200;
const JUMP_BUFFER = 0.1;

// fire from off screen comes along three lanes: low is jumped, mid is ducked or jumped high, and high passes over
// a hugger that keeps its feet on the floor
const LANE_LOW = FLOOR_Y - 6;
const LANE_MID = FLOOR_Y - 19;
const LANE_HIGH = FLOOR_Y - 40;
const WARNING = 0.38;
const BULLET_SPEED = 330;
const BULLET_SPEED_PER_RUN = 0.5;
const MARINE_BULLET_SPEED = 360;
const BURST_GAP = 0.085;
const TRACER = 14;
const FIRST_SHOT = 1.4;

// human hit boxes, in units above the floor and either side of the feet
const HEAD_TOP = 60;
const HEAD_BOTTOM = 42;
const HEAD_HALF_WIDTH = 9;
const BODY_TOP = 44;
const BODY_HALF_WIDTH = 7;
// a hugger whose feet are this high when it meets a head lands on the face rather than the chest
const LATCH_HEIGHT = 36;

const ALERT_RANGE = 110;
const FIRST_HUMAN = 7;
const HUMAN_EVERY_MIN = 9;
const HUMAN_EVERY_MAX = 16;
const MARINES_FROM = 35;
const COLONIST_BONUS = 1000;
const MARINE_BONUS = 1500;
const MARINE_AIM = 0.45;
const MARINE_REACH = 60;
// marines back off as they fire, so a fast hugger still has to get through a volley or two
const MARINE_BACKPEDAL = 40;
const KICK_TIME = 0.32;
const STRUGGLE = 0.35;
const FALL_TIME = 0.5;

// how long the corridor takes to skid to a stop when the run ends, so the ending stays on screen
const STOP_TIME = 0.15;
const RESTART_DELAY = 0.9;
const SLOW_MOTION = 0.35;

const MAX_SCORE = 9999; // CMUArcadeLimits.MaxScore
const MAX_BULLETS = 32;
const MAX_SHOTS = 12;
const MAX_HUMANS = 3;
const MAX_PARTICLES = 420;
const MAX_DECALS = 140;
const MAX_POPUPS = 8;
const MAX_FLASHES = 8;

const DROP = 0;
const SPARK = 1;
const SMOKE = 2;

// Art and sound --------------------------------------------------------------------------------------------------

const PARASITE = '/Textures/_RMC14/Mobs/Xenonids/Parasite/parasite.rsi';
const SPLATTER = '/Textures/Fluids/splatter.rsi';
const PARTS = '/Textures/Mobs/Species/Human/parts.rsi';
const EYES = '/Textures/Mobs/Customization/eyes.rsi';
const HAIR = '/Textures/Mobs/Customization/human_hair.rsi';
const CLOTHING = '/Textures/_RMC14/Objects/Clothing/';
const RIFLE = '/Textures/CMU14/Weapons/Guns/USCM/m41mk2.rsi';
// UAV-OSD-Sans-Mono at the game's sizes 8, 7, 6 and 16 (points at 96 dpi); it is a wide face
const FONT = '10.67px GameTerminal, Consolas, "Courier New", monospace';
const SMALL_FONT = '9.33px GameTerminal, Consolas, "Courier New", monospace';
const SIGN_FONT = '8px GameTerminal, Consolas, "Courier New", monospace';
const BIG_FONT = '21.33px GameTerminal, Consolas, "Courier New", monospace';

const JUMPSUITS = [
  'Uniforms/Civilian/blue_jumpsuit.rsi', 'Uniforms/Civilian/brown_utility.rsi', 'Uniforms/Civilian/khaki_workwear.rsi',
  'Uniforms/Civilian/grey_jumpsuit.rsi', 'Uniforms/Civilian/green_utility.rsi', 'Uniforms/Civilian/blue_workwear.rsi',
  'Uniforms/Civilian/lightbrown_jumpsuit.rsi', 'Uniforms/Civilian/doctor.rsi', 'Uniforms/Civilian/emt.rsi',
];
const SHOES = ['Shoes/Boots/black.rsi', 'Shoes/Boots/brown.rsi', 'Shoes/laceup.rsi', 'Shoes/leather.rsi'];
const MALE_HAIR = ['crewcut', 'business', 'bedhead', 'buzzcut', 'afro'];
const FEMALE_HAIR = ['ponytail', 'bob', 'bun', 'longstraightponytail'];
const MARINE_UNIFORM = 'Uniforms/Marine/standard.rsi';
const MARINE_BOOTS = 'Shoes/Boots/rmc.rsi';
const MARINE_ARMOR = 'OuterClothing/Armor/m3/standard.rsi';
const MARINE_HELMET = 'Head/Helmets/m10/standard.rsi';

const POUNCE = '/Audio/_RMC14/Xeno/alien_pounce.ogg';
const PARASITE_DIES = '/Audio/_RMC14/Xeno/alien_parasite_dies.ogg';
const RIFLE_SHOT = '/Audio/Weapons/Guns/Gunshots/m41.ogg';
const RICOCHET = '/Audio/_RMC14/Bullets/bullet_impact1.ogg';
const SQUISH = '/Audio/Effects/Footsteps/meatslap.ogg';
const BEEP = '/Audio/Effects/beep1.ogg';
const NEW_GAME = '/Audio/Effects/Arcade/newgame.ogg';
const LOST = '/Audio/Effects/Arcade/gameover.ogg';
const WON = '/Audio/Effects/Arcade/win.ogg';
const DISTANT_ROAR = '/Audio/_RMC14/Xeno/alien_distantroar_3.ogg';

const FLESH = [
  '/Audio/_RMC14/Bullets/impact_flesh_1.ogg', '/Audio/_RMC14/Bullets/impact_flesh_2.ogg',
  '/Audio/_RMC14/Bullets/impact_flesh_3.ogg', '/Audio/_RMC14/Bullets/impact_flesh_4.ogg',
];
const SIZZLES = [
  '/Audio/_RMC14/Xeno/acid_sizzle1.ogg', '/Audio/_RMC14/Xeno/acid_sizzle2.ogg',
  '/Audio/_RMC14/Xeno/acid_sizzle3.ogg', '/Audio/_RMC14/Xeno/acid_sizzle4.ogg',
];
const HISSES = ['/Audio/_RMC14/Xeno/alien_hiss1.ogg', '/Audio/_RMC14/Xeno/alien_hiss2.ogg', '/Audio/_RMC14/Xeno/alien_hiss3.ogg'];
const SWOOSHES = [
  '/Audio/CMU14/PersonalComputers/Games/swoosh_1.ogg', '/Audio/CMU14/PersonalComputers/Games/swoosh_2.ogg',
  '/Audio/CMU14/PersonalComputers/Games/swoosh_3.ogg',
];
const PUNCHES = ['/Audio/CMU14/PersonalComputers/Games/punch_1.ogg', '/Audio/CMU14/PersonalComputers/Games/punch_2.ogg'];
const BODY_FALL = '/Audio/CMU14/PersonalComputers/Games/fall.ogg';
const STEPS = [
  '/Audio/Effects/Footsteps/plating1.ogg', '/Audio/Effects/Footsteps/plating2.ogg', '/Audio/Effects/Footsteps/plating3.ogg',
  '/Audio/Effects/Footsteps/plating4.ogg', '/Audio/Effects/Footsteps/plating5.ogg',
];
const MALE_GASPS = ['/Audio/Effects/Gasp/gasp_male1.ogg', '/Audio/Effects/Gasp/gasp_male2.ogg'];
const FEMALE_GASPS = ['/Audio/Effects/Gasp/gasp_female1.ogg', '/Audio/Effects/Gasp/gasp_female2.ogg', '/Audio/Effects/Gasp/gasp_female3.ogg'];
const WHISTLES = [
  '/Audio/Voice/Human/whistle_1.ogg', '/Audio/Voice/Human/whistle_2.ogg', '/Audio/Voice/Human/whistle_3.ogg',
  '/Audio/Voice/Human/whistle_4.ogg',
];

const ALL_SOUNDS = [
  POUNCE, PARASITE_DIES, RIFLE_SHOT, RICOCHET, BODY_FALL, SQUISH, BEEP, NEW_GAME, LOST, WON, DISTANT_ROAR,
  ...FLESH, ...SIZZLES, ...HISSES, ...SWOOSHES, ...PUNCHES, ...STEPS, ...MALE_GASPS, ...FEMALE_GASPS, ...WHISTLES,
];

const PHOSPHOR = '#E2FFE2';
const BRIGHT = '#A8FFB8';
const WALL_COLOUR = '#04140A';
const PANEL_COLOUR = '#082010';
const LEAF_COLOUR = '#0C2C15';
const CEILING_COLOUR = '#020D05';
const HUD_COLOUR = '#010401';
const FLOOR_COLOUR = '#041309';
const SKY = '#010502';
const HILLS = '#0A2A12';
const SCREEN_GLOW = '#0E4A1E';
const AMBER = '#D8A428';
const ALARM = '#FF3B30';
const ACID = '#C6F02A';
const DARK_ACID = '#6E9410';
const BLOOD = '#A80E0E';
const DARK_BLOOD = '#5E0606';
const TRACER_CORE = '#FFF6CC';
const TRACER_GLOW = '#FFB43C';
const DUST = '#7A9C7C';
const LASER = '#FF2A2A';
const EYE_COLOUR = '#2B1A10';
const WHITE = '#FFFFFF';
const BLACK = '#000000';
const SKINS = ['#FFE1CC', '#EDC2A0', '#C08A62', '#8A5634'];
const HAIR_COLOURS = ['#2A1A10', '#5A3A20', '#C89A50', '#1A1A1A', '#8A3A1A'];

// the stains a particle or decal can be, each a tinted set of splatter states
const STAIN_COLOURS = [ACID, DARK_ACID, BLOOD, DARK_BLOOD];

/** Strings from Games/hugger.ftl. */
const T = {
  help: 'Space, W, Up or 8 jumps, hold it to leap higher; S, Down or 2 ducks. Dodge the bullets. Land on a face to infect and win, or leap clean over; never touch the legs.',
  title: 'HUGGER RUN',
  start: 'SPACE OR 8 TO RUN',
  keys: 'JUMP: SPACE / W / 8    DUCK: S / 2',
  again: 'SPACE TO RUN AGAIN',
  paused: 'PAUSED',
  best: score => `HI ${score}`,
  shot: 'SHOT DOWN',
  kicked: 'KICKED FLAT',
  infected: 'INFECTED!',
  bonus: bonus => `+${bonus}`,
  win: score => `HOST INFECTED - SCORE ${score}`,
  contact: 'CONTACT!',
  signs: ['MED', 'SEC', 'ENG', 'HYDRO', 'CARGO', 'OPS'],
};

const Phase = { Attract: 0, Run: 1, Shot: 2, Kicked: 3, Infected: 4 };
const HumanState = { Walk: 0, Stand: 1, Alert: 2, Flee: 3, Aim: 4, Kick: 5, Latched: 6, Shot: 7, Down: 8 };

// RSI directions in sheet order
const SOUTH = 0;
const EAST = 2;
const WEST = 3;

// Helpers ----------------------------------------------------------------------------------------------------------

/** The same integer hash as the C# file, so scenery matches between the game and the emulator. */
function hash(n) {
  let h = Math.imul(n | 0, 0x9E3779B1) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x85EBCA77) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xC2B2AE3D) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** A steady pseudo-random 0..1 for a spot in the world, so scenery does not flicker as it scrolls. */
function hash01(n, salt) {
  return (hash((Math.imul(n | 0, 31) + salt) | 0) & 0xFFFF) / 65535;
}

function ridge(u) {
  const i = Math.floor(u / 18);
  let f = u / 18 - i;
  f = f * f * (3 - 2 * f);
  const a = hash01(i, 3);
  return 6 + 16 * (a + (hash01(i + 1, 3) - a) * f);
}

function moveTowards(value, target, step) {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function normalize(x, y) {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

/** A copy of an image tinted like a sprite layer colour: multiplied, alpha kept. */
function tinted(image, tint, sx = 0, sy = 0, w = image.width, h = image.height) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, sx, sy, w, h, 0, 0, w, h);
  if (tint) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(image, sx, sy, w, h, 0, 0, w, h);
  }
  return canvas;
}

/** Every frame of a state facing a direction, tinted, as canvases. One-direction states ignore the direction. */
async function stateFramesTinted(rsiPath, stateName, direction, tint) {
  const rsi = await loadRsi(rsiPath);
  const state = rsi.states.get(stateName);
  if (!state) throw new Error(`state "${stateName}" is not in ${rsi.path}`);
  const image = await loadStateSheet(rsi.path, stateName);
  return stateFrames(rsi, state, image, Math.min(direction, state.directions - 1))
    .map(frame => tinted(image, tint, frame.sx, frame.sy, rsi.size.x, rsi.size.y));
}

function warn(e) {
  console.warn(`hugger run: ${e.message}`);
}

// The game ---------------------------------------------------------------------------------------------------------

export class HuggerRun extends ArcadeScreen {
  constructor(colors) {
    super(colors);
    this.green = colors.green;
    this.dim = colors.dim;

    this.bullets = [];
    this.shots = [];
    this.humans = [];
    for (let i = 0; i < MAX_HUMANS; i++) this.humans.push({ active: false, layers: null, west: null, east: null });
    this.particles = [];
    this.decals = new Array(MAX_DECALS);
    this.decalCount = 0;
    this.decalNext = 0;
    this.popups = [];
    this.flashes = [];
    this.pending = [];

    this.phase = Phase.Attract;
    this.clock = 0;
    this.time = 0;
    this.scroll = 0;
    this.run = 0;
    this.speed = 0;
    this.bonus = 0;
    this.best = 0;
    this.milestones = 0;
    this.over = 0;
    this.stopRate = 0;
    this.slow = 0;
    this.paused = false;

    // the hugger: height of its feet over the floor and its climb, in units per second
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.held = false;
    this.duck = false;
    this.hold = 0;
    this.buffer = 0;
    this.squash = 0;
    this.anim = 0;
    this.dust = 0;

    // its body once it is dead: x along the floor, y the height above it
    this.corpse = false;
    this.corpseDown = false;
    this.corpseAt = { x: 0, y: 0 };
    this.corpseVelocity = { x: 0, y: 0 };
    this.corpseSpin = 0;
    this.corpseRotation = 0;
    this.sizzle = 0;

    this.nextShot = 0;
    this.nextHuman = 0;
    this.ambient = 0;

    this.shakeStrength = 0;
    this.shakeTime = 0;
    this.offset = { x: 0, y: 0 };
    this.flashColour = WHITE;
    this.flashAlpha = 0;
    this.flashLife = 0;
    this.flashAge = 0;
    this.hudFlash = 0;
    this.endText = '';
    this.endColour = this.green;

    this.art = { running: null, thrown: null, dead: null, maskWest: null, maskEast: null, splats: new Map() };
    this.loadArt();
    preloadSounds(ALL_SOUNDS);
    ensureFont('Terminal');
  }

  get help() {
    return T.help;
  }

  /** Starts loading every sprite: the hugger's states, the stains, and the sheets the humans are dressed from. */
  loadArt() {
    const art = this.art;
    stateFramesTinted(PARASITE, 'running', EAST, PHOSPHOR).then(f => { art.running = f; }, warn);
    stateFramesTinted(PARASITE, 'thrown', SOUTH, PHOSPHOR).then(f => { art.thrown = f[0]; }, warn);
    stateFramesTinted(PARASITE, 'dead', SOUTH, PHOSPHOR).then(f => { art.dead = f[0]; }, warn);
    stateFramesTinted(PARASITE, 'equipped-MASK', WEST, PHOSPHOR).then(f => { art.maskWest = f; }, warn);
    stateFramesTinted(PARASITE, 'equipped-MASK', EAST, PHOSPHOR).then(f => { art.maskEast = f; }, warn);
    for (const colour of STAIN_COLOURS) {
      const list = new Array(6).fill(null);
      art.splats.set(colour, list);
      for (let i = 0; i < 6; i++) stateCanvas(SPLATTER, `splatter-${i}`, colour).then(c => { list[i] = c; });
    }

    // the sheets are cached, so a human dressed later composites at once
    const sheets = [
      [PARTS, ['torso_m', 'torso_f', 'head_m', 'head_f', 'r_arm', 'l_arm', 'r_leg', 'l_leg', 'l_foot', 'r_foot', 'l_hand', 'r_hand']],
      [EYES, ['eyes']], [HAIR, [...MALE_HAIR, ...FEMALE_HAIR]], [RIFLE, ['wielded-inhand-left']],
      [CLOTHING + MARINE_UNIFORM, ['equipped-INNERCLOTHING']], [CLOTHING + MARINE_BOOTS, ['equipped-FEET']],
      [CLOTHING + MARINE_ARMOR, ['equipped-OUTERCLOTHING']], [CLOTHING + MARINE_HELMET, ['equipped-HELMET']],
      ...JUMPSUITS.map(j => [CLOTHING + j, ['equipped-INNERCLOTHING']]), ...SHOES.map(s => [CLOTHING + s, ['equipped-FEET']]),
    ];
    for (const [rsi, states] of sheets) {
      loadRsi(rsi).then(meta => states.forEach(state => loadStateSheet(meta.path, state).catch(warn)), warn);
    }
  }

  start() {
    // a jump mashed as the hugger dies must not throw it straight into a new run
    if (this.phase !== Phase.Attract && this.over < RESTART_DELAY) return;

    super.start();
    this.phase = Phase.Run;
    this.time = 0;
    this.run = 0;
    this.speed = START_SPEED;
    this.bonus = 0;
    this.milestones = 0;
    this.over = 0;
    this.slow = 0;
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.held = false;
    this.hold = 0;
    this.buffer = 0;
    this.squash = 0;
    this.corpse = false;
    this.sizzle = 0;
    this.bullets.length = 0;
    this.shots.length = 0;
    this.particles.length = 0;
    this.decalCount = 0;
    this.decalNext = 0;
    this.popups.length = 0;
    this.flashes.length = 0;
    this.pending.length = 0;
    this.shakeTime = 0;
    this.flashLife = 0;
    for (const human of this.humans) human.active = false;
    this.nextShot = FIRST_SHOT;
    this.nextHuman = FIRST_HUMAN;
    this.ambient = 5;
    this.play(NEW_GAME, -6);
  }

  onKey(input) {
    if (input.repeat) return;
    switch (input.key) {
      case Key.Up:
      case Key.Action:
        // W, Up and 8 start a run as well as Space
        if (input.down && !this.running) {
          this.start();
          return;
        }
        this.held = input.down;
        if (input.down) this.buffer = JUMP_BUFFER;
        break;
      case Key.Down:
        this.duck = input.down;
        break;
    }
  }

  onFocusLost() {
    this.held = false;
    this.duck = false;
  }

  update(dt) {
    const real = Math.min(dt, 0.05);
    this.clock += real;

    // a run without the keys waits for them instead of running into the next bullet
    this.paused = this.phase === Phase.Run && !this.focused;
    if (this.paused) return;

    if (this.slow > 0) this.slow -= real;
    if (this.phase !== Phase.Attract && this.phase !== Phase.Run) this.over += real;

    const delta = this.slow > 0 ? real * SLOW_MOTION : real;
    for (let left = delta; left > 0; left -= 1 / 120) this.simulate(Math.min(left, 1 / 120));

    this.updateEffects(delta);
    this.updateSounds(real);
  }

  // Simulation -----------------------------------------------------------------------------------------------------

  simulate(dt) {
    switch (this.phase) {
      case Phase.Attract:
        this.speed = 28;
        break;
      case Phase.Run:
        this.time += dt;
        this.speed = Math.min(MAX_SPEED, this.speed + ACCELERATION * dt);
        break;
      default:
        this.speed = Math.max(0, this.speed - this.stopRate * dt);
        break;
    }

    const moved = this.speed * dt;
    this.scroll += moved;
    const scurry = this.phase === Phase.Run ? Math.max(1, this.speed / START_SPEED) * (this.duck && this.grounded ? 1.6 : 1) : 1;
    this.anim += dt * scurry;
    if (this.phase === Phase.Run) {
      this.run += moved;
      this.moveHugger(dt);
      this.spawn(dt);
      this.fireQueued(dt);
    }

    this.moveBullets(dt);
    this.moveHumans(dt);
    this.moveCorpse(dt);
    if (this.phase !== Phase.Run) return;

    this.collide();
    if (this.phase === Phase.Run) this.tally();
  }

  moveHugger(dt) {
    if (this.buffer > 0) this.buffer -= dt;

    if (this.grounded) {
      if (this.buffer > 0 && !this.duck) this.jump();
    } else {
      // holding the jump floats it higher for a moment; ducking in the air drops it like a stone
      let gravity = GRAVITY;
      if (this.duck) {
        gravity = FAST_FALL_GRAVITY;
      } else if (this.held && this.vy > 0 && this.hold < MAX_HOLD) {
        gravity = HOLD_GRAVITY;
        this.hold += dt;
      }
      this.vy -= gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) this.land();
    }

    this.squash = moveTowards(this.squash, 0, dt * 7);
    if (!this.grounded) return;

    this.dust -= dt;
    if (this.dust > 0) return;

    this.dust = 0.06 + Math.random() * 0.06;
    this.emit(this.world(HUGGER_X - 8, FLOOR_Y - 1), 1, DUST, 0.45, 30, 0.35, 1.4, Math.PI + 0.4, 0.8, -20, { kind: SMOKE });
  }

  jump() {
    this.grounded = false;
    this.vy = JUMP_VELOCITY;
    this.hold = 0;
    this.buffer = 0;
    this.squash = 1;
    this.playAny(SWOOSHES, -6, 1.1);
    this.emit(this.world(HUGGER_X - 4, FLOOR_Y - 1), 5, DUST, 0.6, 60, 0.4, 2, Math.PI, 1.2, -10, { kind: SMOKE });
  }

  land() {
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.squash = -1;
    this.playAny(STEPS, -12, 1.6);
    this.emit(this.world(HUGGER_X, FLOOR_Y - 1), 6, DUST, 0.6, 50, 0.45, 2, -Math.PI / 2, Math.PI, -10, { kind: SMOKE });
    if (this.buffer > 0 && !this.duck) this.jump();
  }

  /** Distance makes the score, plus any infection bonus. A beep every hundred, like the old dino. */
  tally() {
    const points = Math.floor(this.run / UNITS_PER_POINT);
    this.score = Math.min(MAX_SCORE, points + this.bonus);
    if (Math.floor(points / MILESTONE) <= this.milestones) return;

    this.milestones = Math.floor(points / MILESTONE);
    this.hudFlash = 0.6;
    this.play(BEEP, -8, 1.2);
  }

  /**
   * Bullets come in patterns that get closer and nastier with time; humans walk in every so often, and while one
   * is ahead of the hugger the marines off screen hold their fire rather than hit a colonist.
   */
  spawn(dt) {
    this.nextShot -= dt;
    this.nextHuman -= dt;
    this.ambient -= dt;
    if (this.ambient <= 0) {
      this.ambience();
      this.ambient = 7 + Math.random() * 8;
    }

    const blocked = this.humanAhead();
    if (this.nextHuman <= 0 && !blocked && this.shots.length === 0 && !this.bulletsAhead()) {
      this.spawnHuman(this.time >= MARINES_FROM && Math.random() < 0.4);
      this.nextHuman = HUMAN_EVERY_MIN + Math.random() * (HUMAN_EVERY_MAX - HUMAN_EVERY_MIN);
      this.nextShot = Math.max(this.nextShot, 1.2);
      return;
    }

    if (blocked) {
      this.nextShot = Math.max(this.nextShot, 0.8);
      return;
    }

    // let the lane clear for the human that is due
    if (this.nextShot > 0 || this.nextHuman <= 0) return;

    const hard = clamp(this.time / 90, 0, 1);
    const roll = Math.random();
    if (this.time > 15 && roll < 0.25 + hard * 0.2) {
      this.queue(this.pickLane(), 3);
    } else if (this.time > 40 && roll < 0.55) {
      this.queue(LANE_LOW, 1);
      this.queue(LANE_MID, 1, 0.3);
    } else {
      this.queue(this.pickLane(), 1);
    }

    this.nextShot = (1.55 - 0.7 * hard) * (0.8 + Math.random() * 0.6);
  }

  pickLane() {
    if (this.time < 10) return LANE_LOW;
    const roll = Math.random();
    if (roll < 0.5) return LANE_LOW;
    return roll < 0.8 || this.time < 20 ? LANE_MID : LANE_HIGH;
  }

  queue(lane, count, delay = 0) {
    for (let i = 0; i < count && this.shots.length < MAX_SHOTS; i++) {
      this.shots.push({ delay: WARNING + delay + i * BURST_GAP, lane });
    }
  }

  humanAhead() {
    return this.humans.some(h => h.active && h.x - this.scroll > HUGGER_X - 24
      && h.state !== HumanState.Down && h.state !== HumanState.Shot);
  }

  bulletsAhead() {
    return this.bullets.some(b => b.x > HUGGER_X);
  }

  /** Distant fire and roars from elsewhere in the colony, so the corridor never feels empty. */
  ambience() {
    if (Math.random() < 0.3) {
      this.play(DISTANT_ROAR, -14, 0.9 + Math.random() * 0.2);
      return;
    }
    const shots = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < shots; i++) this.pend(i * 0.09, RIFLE_SHOT, -18, 0.78);
  }

  fireQueued(dt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const shot = this.shots[i];
      shot.delay -= dt;
      if (shot.delay > 0) continue;
      this.shots.splice(i, 1);
      this.addBullet(SCREEN_W + 4, shot.lane, -(BULLET_SPEED + this.speed * BULLET_SPEED_PER_RUN), 0);
      this.addFlash(SCREEN_W - 1, shot.lane);
      this.play(RIFLE_SHOT, -4, 0.95 + Math.random() * 0.1);
    }
  }

  addBullet(x, y, vx, vy) {
    if (this.bullets.length < MAX_BULLETS) this.bullets.push({ x, y, vx, vy });
  }

  moveBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.y >= FLOOR_Y + 2) {
        // an aimed shot that missed sparks off the deck plating
        const world = this.world(bullet.x, FLOOR_Y + 2);
        this.emit(world, 7, AMBER, 1, 160, 0.3, 1, -Math.PI / 2 + Math.sign(bullet.vx) * 0.6, 1.2, 500, { kind: SPARK });
        this.emit(world, 2, DUST, 0.5, 20, 0.5, 2, -Math.PI / 2, 1, -15, { kind: SMOKE });
        this.play(RICOCHET, -10, 1.1 + Math.random() * 0.2);
      } else if (bullet.x > -TRACER - 10 && bullet.y > HUD_HEIGHT) {
        continue;
      }
      this.bullets.splice(i, 1);
    }
  }

  spawnHuman(marine) {
    const human = this.humans.find(h => !h.active);
    if (!human) return;

    human.active = true;
    human.marine = marine;
    human.female = Math.random() < (marine ? 0.2 : 0.45);
    human.east = false;
    human.flees = false;
    human.infected = false;
    human.whistled = marine;
    human.shouted = false;
    human.timer = 0;
    human.step = Math.random() * 3;
    human.fall = 1;
    human.cooldown = 0;
    human.shots = 0;
    human.x = this.scroll + SCREEN_W + 40;
    if (marine || Math.random() < 0.3) {
      human.state = HumanState.Stand;
      human.walk = 0;
    } else {
      human.state = HumanState.Walk;
      human.walk = 10 + Math.random() * 24;
    }
    this.dress(human);

    // the hugger smells prey before it sees it
    this.playAny(HISSES, -12, 1.45);
  }

  /** Puts a human together the way the game draws one: body parts, eyes, clothes and hair in layer order. */
  dress(human) {
    const skin = pick(SKINS);
    const sex = human.female ? '_f' : '_m';
    const layers = [
      [PARTS, 'torso' + sex, skin], [PARTS, 'head' + sex, skin], [EYES, 'eyes', EYE_COLOUR],
      [PARTS, 'r_arm', skin], [PARTS, 'l_arm', skin], [PARTS, 'r_leg', skin], [PARTS, 'l_leg', skin],
      [CLOTHING + (human.marine ? MARINE_UNIFORM : pick(JUMPSUITS)), 'equipped-INNERCLOTHING', null],
      [PARTS, 'l_foot', skin], [PARTS, 'r_foot', skin], [PARTS, 'l_hand', skin], [PARTS, 'r_hand', skin],
      [CLOTHING + (human.marine ? MARINE_BOOTS : pick(SHOES)), 'equipped-FEET', null],
    ];
    if (human.marine) {
      layers.push([CLOTHING + MARINE_ARMOR, 'equipped-OUTERCLOTHING', null]);
      layers.push([CLOTHING + MARINE_HELMET, 'equipped-HELMET', null]);
      layers.push([RIFLE, 'wielded-inhand-left', null]);
    } else {
      layers.push([HAIR, pick(human.female ? FEMALE_HAIR : MALE_HAIR), pick(HAIR_COLOURS)]);
    }

    human.west = null;
    human.east = false;
    human.eastImage = null;
    const token = {};
    human.token = token;
    const composite = direction => Promise.all(layers.map(([rsi, state, tint]) =>
      layerCanvas(rsi, state, direction, tint).catch(e => {
        warn(e);
        return null;
      }))).then(canvases => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      for (const layer of canvases) if (layer) ctx.drawImage(layer, 0, 0);
      return tinted(canvas, PHOSPHOR);
    });
    composite(WEST).then(c => { if (human.token === token) human.west = c; });
    composite(EAST).then(c => { if (human.token === token) human.eastImage = c; });
  }

  moveHumans(dt) {
    for (const human of this.humans) {
      if (!human.active) continue;

      human.timer += dt;
      const x = human.x - this.scroll;
      switch (human.state) {
        case HumanState.Walk:
          human.x -= human.walk * dt;
          human.step += dt * (4 + human.walk * 0.18);
          if (!human.whistled && x < SCREEN_W - 10) {
            human.whistled = true;
            if (Math.random() < 0.35) this.playAny(WHISTLES, -12);
          }
          this.notice(human, x);
          break;
        case HumanState.Stand:
          if (human.marine) this.watch(human, x, dt);
          else this.notice(human, x);
          break;
        case HumanState.Alert:
          if (human.flees && human.timer > 0.3) {
            human.state = HumanState.Flee;
            human.east = true;
            human.timer = 0;
          }
          break;
        case HumanState.Flee:
          human.x += 48 * dt;
          human.step += dt * 14;
          break;
        case HumanState.Aim:
          this.backpedal(human, dt);
          this.aim(human, x);
          break;
        case HumanState.Kick:
          if (human.timer >= KICK_TIME * 1.6) {
            human.state = HumanState.Stand;
            human.timer = 0;
          }
          break;
        case HumanState.Latched:
          if (human.timer >= STRUGGLE + FALL_TIME) this.fallen(human);
          break;
        case HumanState.Shot:
          if (human.timer >= FALL_TIME * 0.8) this.fallen(human);
          break;
      }

      if (x < -60 || (human.state === HumanState.Flee && x > SCREEN_W + 60)) human.active = false;
    }
  }

  /** A colonist who sees the hugger coming freezes with a gasp, and some turn and run. */
  notice(human, x) {
    if (this.phase !== Phase.Run || x < HUGGER_X || x - HUGGER_X > ALERT_RANGE) return;

    human.state = HumanState.Alert;
    human.timer = 0;
    human.flees = !human.marine && Math.random() < 0.45;
    this.pop('!', x, FLOOR_Y - 72, AMBER, 0.7);
    this.playAny(human.female ? FEMALE_GASPS : MALE_GASPS, -6);
  }

  /** A marine on screen takes aim at the hugger every second or so, until it gets too close to shoot. */
  watch(human, x, dt) {
    if (this.phase !== Phase.Run) return;

    if (x < HUGGER_X + MARINE_REACH) {
      this.notice(human, x);
      return;
    }

    this.backpedal(human, dt);
    human.cooldown -= dt;
    if (human.cooldown > 0 || x > SCREEN_W + 8) return;

    human.state = HumanState.Aim;
    human.timer = 0;
    human.shots = 3;
    if (human.shouted) return;

    human.shouted = true;
    this.pop(T.contact, x, FLOOR_Y - 74, AMBER, 0.9);
  }

  aim(human, x) {
    if (this.phase !== Phase.Run || x < HUGGER_X + MARINE_REACH) {
      human.state = HumanState.Stand;
      human.timer = 0;
      return;
    }

    // the laser sight settles for a moment, then a three round burst at wherever the hugger is
    if (human.timer < MARINE_AIM + (3 - human.shots) * 0.09) return;

    const muzzle = barrel(x);
    const target = this.target();
    const dir = normalize(target.x - muzzle.x, target.y - muzzle.y);
    this.addBullet(muzzle.x, muzzle.y, dir.x * MARINE_BULLET_SPEED, dir.y * MARINE_BULLET_SPEED);
    this.addFlash(muzzle.x, muzzle.y);
    this.play(RIFLE_SHOT, 0, 0.95 + Math.random() * 0.1);
    this.emit(this.world(muzzle.x + 22, muzzle.y + 2), 1, AMBER, 1, 90, 1.2, 1.6, -Math.PI / 2 + 0.5, 0.6, 600);
    human.shots--;
    if (human.shots > 0) return;

    human.state = HumanState.Stand;
    human.timer = 0;
    human.cooldown = 0.9 + Math.random() * 0.7;
  }

  backpedal(human, dt) {
    human.x += MARINE_BACKPEDAL * dt;
    human.step += dt * 6;
  }

  target() {
    return { x: HUGGER_X, y: FLOOR_Y - this.y - (this.duck && this.grounded ? 5 : 11) };
  }

  fallen(human) {
    human.state = HumanState.Down;
    human.timer = 0;
    const x = human.x - this.scroll;
    this.play(BODY_FALL, -1, 0.95 + Math.random() * 0.1);
    this.emit(this.world(x + human.fall * 30, FLOOR_Y), 10, DUST, 0.5, 60, 0.6, 3, -Math.PI / 2, Math.PI, -10, { kind: SMOKE });
    this.shake(2, 0.25);
    if (!human.infected) this.addDecal(human.x + human.fall * 22, FLOOR_Y + 5, 34, DARK_BLOOD, 0.9, false);
  }

  moveCorpse(dt) {
    if (!this.corpse) return;

    if (!this.corpseDown) {
      this.corpseVelocity.y -= GRAVITY * dt;
      this.corpseAt.x += this.corpseVelocity.x * dt;
      this.corpseAt.y += this.corpseVelocity.y * dt;
      this.corpseRotation += this.corpseSpin * dt;
      if (this.corpseAt.y > 0) return;

      this.corpseAt.y = 0;
      this.corpseDown = true;
      this.corpseRotation = 0;
      this.splash();
      return;
    }

    if (this.sizzle <= 0) return;

    // the acid eats into the deck for a while
    this.sizzle -= dt;
    if (Math.random() < dt * 20) {
      this.emit({ x: this.corpseAt.x + (Math.random() - 0.5) * 24, y: FLOOR_Y + 3 }, 1, ACID, 0.35, 14, 1.1, 2.5, -Math.PI / 2, 0.6, -25, { kind: SMOKE });
    }
  }

  /** The dead hugger hits the floor in a pool of its own acid. */
  splash() {
    const at = { x: this.corpseAt.x, y: FLOOR_Y };
    this.addDecal(at.x, FLOOR_Y + 5, 34, ACID, 0.9, true);
    this.addDecal(at.x - 14, FLOOR_Y + 9, 16, ACID, 0.85, true);
    this.addDecal(at.x + 12, FLOOR_Y + 2, 12, ACID, 0.85, true);
    this.emit(at, 18, ACID, 1, 140, 0.9, 1.8, -Math.PI / 2, 2.4, 600, { stains: true, acid: true });
    this.emit(at, 6, ACID, 0.4, 20, 1.2, 3, -Math.PI / 2, 1, -20, { kind: SMOKE });
    this.play(SQUISH, -2);
    this.playAny(SIZZLES, -3);
    this.pend(0.6, LOST, -6);
    this.shake(2.5, 0.25);
    this.sizzle = 2.4;
  }

  // Collisions and endings -----------------------------------------------------------------------------------------

  collide() {
    const bottom = FLOOR_Y - this.y;
    const top = bottom - (this.duck && this.grounded ? DUCK_HEIGHT : HUGGER_HEIGHT);
    const left = HUGGER_X - HUGGER_HALF_WIDTH;
    const right = HUGGER_X + HUGGER_HALF_WIDTH;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      const dir = normalize(bullet.vx, bullet.vy);
      const tailX = bullet.x - dir.x * TRACER;
      const tailY = bullet.y - dir.y * TRACER;
      if (inside(bullet.x, bullet.y, left, right, top, bottom) || inside((bullet.x + tailX) / 2, (bullet.y + tailY) / 2, left, right, top, bottom)
        || inside(tailX, tailY, left, right, top, bottom)) {
        this.bullets.splice(i, 1);
        this.shotDown(bullet);
        return;
      }

      // a round that got past the hugger can still find somebody behind it
      if (bullet.x >= HUGGER_X - 14) continue;

      for (const human of this.humans) {
        if (!hittable(human)) continue;
        const x = human.x - this.scroll;
        if (!inside(bullet.x, bullet.y, x - BODY_HALF_WIDTH, x + BODY_HALF_WIDTH, FLOOR_Y - HEAD_TOP, FLOOR_Y)) continue;
        this.bullets.splice(i, 1);
        this.wounded(human, bullet);
        break;
      }
    }

    for (const human of this.humans) {
      if (!hittable(human)) continue;
      const x = human.x - this.scroll;
      if (this.y >= LATCH_HEIGHT && overlap(left, right, top, bottom, x - HEAD_HALF_WIDTH, x + HEAD_HALF_WIDTH, FLOOR_Y - HEAD_TOP, FLOOR_Y - HEAD_BOTTOM)) {
        this.infect(human);
        return;
      }
      if (overlap(left, right, top, bottom, x - BODY_HALF_WIDTH, x + BODY_HALF_WIDTH, FLOOR_Y - BODY_TOP, FLOOR_Y)) {
        this.kicked(human);
        return;
      }
    }
  }

  endRun(phase, text, colour) {
    this.phase = phase;
    this.over = 0;
    this.stopRate = Math.max(1, this.speed / STOP_TIME);
    this.shots.length = 0;
    this.held = false;
    this.duck = false;
    this.endText = text;
    this.endColour = colour;
    this.gameOver();
    this.best = Math.max(this.best, this.score);
  }

  /** A tracer finds the hugger: it bursts in acid that splashes along the floor. */
  shotDown(bullet) {
    const dir = normalize(bullet.vx, bullet.vy);
    const angle = Math.atan2(dir.y, dir.x);
    const hit = this.world(bullet.x, bullet.y);
    this.corpse = true;
    this.corpseDown = false;
    this.corpseAt = { x: HUGGER_X + this.scroll, y: this.y + 8 };
    this.corpseVelocity = { x: dir.x * 70, y: 170 + this.y * 0.5 };
    this.corpseSpin = -9;
    this.emit(hit, 40, ACID, 1, 230, 1.1, 2.2, angle, 1.9, 620, { stains: true, acid: true, inherit: this.speed * 0.2 });
    this.emit(hit, 14, DARK_ACID, 1, 140, 0.9, 3, angle, 1.2, 620, { stains: true, acid: true, inherit: this.speed * 0.2 });
    this.emit(hit, 12, ACID, 1, 280, 0.25, 1, angle + Math.PI, 1.4, 0, { kind: SPARK });
    this.emit(hit, 6, ACID, 0.4, 30, 0.9, 3, -Math.PI / 2, 1.5, -20, { kind: SMOKE });
    this.playAny(FLESH);
    this.play(PARASITE_DIES);
    this.flash(ACID, 0.35, 0.3);
    this.shake(4.5, 0.4);
    this.slow = 0.45;
    this.endRun(Phase.Shot, T.shot, ACID);
  }

  /** Ran into a pair of legs: the human punts the hugger away and it splats down the corridor. */
  kicked(human) {
    human.state = HumanState.Kick;
    human.timer = 0;
    const hit = this.world(HUGGER_X + 8, FLOOR_Y - this.y - 10);
    this.corpse = true;
    this.corpseDown = false;
    this.corpseAt = { x: HUGGER_X + this.scroll + 4, y: this.y + 10 };
    this.corpseVelocity = { x: -40, y: 420 };
    this.corpseSpin = -14;
    this.emit(hit, 16, ACID, 1, 160, 0.9, 2, Math.PI + 0.5, 1.6, 620, { stains: true, acid: true });
    this.playAny(PUNCHES);
    this.play(PARASITE_DIES, 0, 1.05);
    this.flash(WHITE, 0.2, 0.12);
    this.shake(3.5, 0.3);
    this.slow = 0.3;
    this.endRun(Phase.Kicked, T.kicked, this.green);
  }

  /** Came down on a face: the hugger latches on, the host screams and goes over backwards. A win. */
  infect(human) {
    const bonus = human.marine ? MARINE_BONUS : COLONIST_BONUS;
    human.state = HumanState.Latched;
    human.timer = 0;
    human.infected = true;
    human.fall = human.east ? -1 : 1;
    this.bonus += bonus;
    this.tally();
    this.endRun(Phase.Infected, T.infected, ACID);
    this.setStatus(T.win(this.score));

    const face = { x: human.x - this.scroll, y: FLOOR_Y - 50 };
    this.emit(this.world(face.x, face.y), 14, BLOOD, 1, 120, 0.9, 1.8, -Math.PI / 2, 2.2, 520, { stains: true });
    this.emit(this.world(face.x, face.y), 5, DARK_BLOOD, 1, 70, 0.9, 2.6, -Math.PI / 2, 1.6, 520, { stains: true });
    this.pop(T.bonus(bonus), face.x, face.y - 22, ACID, 1.4);
    this.play(POUNCE);
    this.playAny(SWOOSHES, -3, 0.9);
    this.pendScream(0.12, human.female);
    this.pend(1.1, WON, -4);
    this.flash(WHITE, 0.3, 0.15);
    this.shake(3, 0.3);
    this.slow = 0.3;
  }

  /** A round meant for the hugger hits whoever it passed: they scream and drop. */
  wounded(human, bullet) {
    human.state = HumanState.Shot;
    human.timer = 0;
    human.fall = -1;
    const dir = normalize(bullet.vx, bullet.vy);
    const angle = Math.atan2(dir.y, dir.x);
    const hit = this.world(bullet.x, bullet.y);
    this.emit(hit, 22, BLOOD, 1, 170, 1.2, 2, angle, 1.6, 520, { stains: true });
    this.emit(hit, 6, DARK_BLOOD, 1, 90, 1, 3, angle, 1.2, 520, { stains: true });
    this.playAny(FLESH);
    scream(human.female, { volume: -2, source: this.canvas });
  }

  // Effects --------------------------------------------------------------------------------------------------------

  world(x, y) {
    return { x: x + this.scroll, y };
  }

  /**
   * Throws particles from a world spot. direction and spread are radians, 0 pointing right and positive turning
   * down the screen. Falling drops land somewhere down the floor's depth.
   */
  emit(at, count, colour, alpha, speed, life, size, direction, spread, gravity,
    { stains = false, kind = DROP, acid = false, inherit = 0 } = {}) {
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const angle = direction + (Math.random() - 0.5) * spread;
      const magnitude = speed * (0.35 + Math.random() * 0.65);
      this.particles.push({
        x: at.x,
        y: at.y,
        vx: Math.cos(angle) * magnitude + inherit,
        vy: Math.sin(angle) * magnitude,
        age: 0,
        life: life * (0.6 + Math.random() * 0.6),
        size: size * (0.6 + Math.random() * 0.8),
        gravity,
        floor: gravity > 0 ? FLOOR_Y + 1 + Math.random() * 13 : NaN,
        colour,
        alpha,
        kind,
        stains,
        acid,
      });
    }
  }

  addDecal(x, y, size, colour, alpha, acid) {
    this.decals[this.decalNext] = {
      x, y, size, colour, alpha, acid, age: 0,
      rotation: Math.random() * TAU,
      state: Math.floor(Math.random() * 6),
    };
    this.decalNext = (this.decalNext + 1) % MAX_DECALS;
    this.decalCount = Math.min(this.decalCount + 1, MAX_DECALS);
  }

  addFlash(x, y) {
    if (this.flashes.length < MAX_FLASHES) this.flashes.push({ x, y, age: 0 });
  }

  /** Text that floats up from a screen spot and fades, riding along with the floor. */
  pop(text, x, y, colour, life) {
    if (this.popups.length < MAX_POPUPS) this.popups.push({ text, x: x + this.scroll, y, colour, age: 0, life });
  }

  shake(strength, time) {
    // a light knock does not cut short a big one still shaking
    if (this.shakeTime > 0 && strength < this.shakeStrength) return;
    this.shakeStrength = strength;
    this.shakeTime = time;
  }

  flash(colour, alpha, time) {
    this.flashColour = colour;
    this.flashAlpha = alpha;
    this.flashLife = time;
    this.flashAge = 0;
  }

  updateEffects(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      p.vy += p.gravity * dt;
      if (p.kind === SMOKE) {
        const drag = Math.max(0, 1 - 2.5 * dt);
        p.vx *= drag;
        p.vy *= drag;
        p.size += dt * 6;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const landed = !Number.isNaN(p.floor) && p.y >= p.floor && p.vy > 0;
      if (landed && p.stains) this.addDecal(p.x, p.floor, p.size * 2.4, p.colour, p.alpha, p.acid);
      if (landed || p.age >= p.life) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
      }
    }

    for (let i = 0; i < this.decalCount; i++) this.decals[i].age += dt;

    for (let i = this.popups.length - 1; i >= 0; i--) {
      this.popups[i].age += dt;
      if (this.popups[i].age >= this.popups[i].life) this.popups.splice(i, 1);
    }

    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].age += dt;
      if (this.flashes[i].age >= 0.07) this.flashes.splice(i, 1);
    }

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const strength = this.shakeTime > 0 ? this.shakeStrength * Math.min(1, this.shakeTime * 4) : 0;
      this.offset = { x: (Math.random() - 0.5) * 2 * strength, y: (Math.random() - 0.5) * 2 * strength };
    } else {
      this.offset = { x: 0, y: 0 };
    }

    if (this.flashLife > 0) this.flashAge += dt;
    if (this.hudFlash > 0) this.hudFlash -= dt;
  }

  play(path, volume = 0, pitch = 1) {
    this.sound(path, volume, pitch);
  }

  playAny(paths, volume = 0, pitch = 1) {
    this.sound(pick(paths), volume, pitch * (0.94 + Math.random() * 0.12));
  }

  pend(delay, path, volume = 0, pitch = 1) {
    this.pending.push({ delay, path, volume, pitch, scream: 0 });
  }

  pendScream(delay, female) {
    this.pending.push({ delay, path: null, volume: 0, pitch: 1, scream: female ? 2 : 1 });
  }

  updateSounds(dt) {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const sound = this.pending[i];
      sound.delay -= dt;
      if (sound.delay > 0) continue;
      this.pending.splice(i, 1);
      if (sound.scream > 0) scream(sound.scream === 2, { volume: sound.volume, source: this.canvas });
      else if (sound.path) this.play(sound.path, sound.volume, sound.pitch);
    }
  }

  // Drawing --------------------------------------------------------------------------------------------------------

  drawGame(ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(this.offset.x, this.offset.y);
    this.drawCeiling(ctx);
    this.drawWall(ctx);
    this.drawFloor(ctx);
    this.drawLights(ctx);
    this.drawDecals(ctx);
    this.drawShadows(ctx);
    for (const human of this.humans) if (human.active) this.drawHuman(ctx, human);
    this.drawCorpse(ctx);
    this.drawHugger(ctx);
    this.drawFire(ctx);
    this.drawParticles(ctx);
    this.drawStreaks(ctx);
    this.drawPopups(ctx);
    if (this.flashLife > 0 && this.flashAge < this.flashLife) {
      fill(ctx, 0, HUD_HEIGHT, SCREEN_W, SCREEN_H - HUD_HEIGHT, this.flashColour, this.flashAlpha * (1 - this.flashAge / this.flashLife));
    }
    ctx.restore();
    this.drawHud(ctx);
    this.drawCrt(ctx);
  }

  drawCeiling(ctx) {
    fill(ctx, 0, HUD_HEIGHT, SCREEN_W, CEILING_Y - HUD_HEIGHT, CEILING_COLOUR);
    fill(ctx, 0, 20, SCREEN_W, 2.5, this.dim, 0.55);
    fill(ctx, 0, 20, SCREEN_W, 0.8, this.green, 0.3);
    fill(ctx, 0, 26, SCREEN_W, 3, this.dim, 0.35);
    const u = this.scroll * WALL_DEPTH;
    for (let c = Math.floor(u / 48); c * 48 - u < SCREEN_W; c++) fill(ctx, c * 48 - u, 18, 3, 13, this.dim, 0.6);

    fill(ctx, 0, CEILING_Y - 4, SCREEN_W, 4, PANEL_COLOUR);
    fill(ctx, 0, CEILING_Y - 0.5, SCREEN_W, 1, this.dim, 0.8);
    for (let c = Math.floor((u - 30) / 96); c * 96 + 30 - u < SCREEN_W; c++) {
      const x = c * 96 + 30 - u;
      const on = this.lampOn(c);
      if (on) fill(ctx, x, CEILING_Y - 7, 26, 4, BRIGHT);
      else fill(ctx, x, CEILING_Y - 7, 26, 4, this.dim, 0.5);
      if (on) fill(ctx, x - 3, CEILING_Y - 3, 32, 2, this.green, 0.3);
    }
  }

  /** Most lamps burn steady; a few in every corridor stutter. */
  lampOn(lamp) {
    if (hash(lamp) % 6 !== 0) return true;
    return Math.sin(this.clock * 13 + lamp) + Math.sin(this.clock * 7.3 + lamp * 2) > -0.6;
  }

  drawWall(ctx) {
    fill(ctx, 0, CEILING_Y, SCREEN_W, FLOOR_Y - CEILING_Y, WALL_COLOUR);
    const u = this.scroll * WALL_DEPTH;
    for (let p = Math.floor(u / PANEL_WIDTH); p * PANEL_WIDTH - u < SCREEN_W; p++) this.drawPanel(ctx, p, p * PANEL_WIDTH - u);
  }

  drawPanel(ctx, panel, x) {
    const h = hash(panel);
    const kind = h % 16;
    const dim = this.dim;
    const green = this.green;
    fill(ctx, x + 2, CEILING_Y + 4, PANEL_WIDTH - 4, FLOOR_Y - CEILING_Y - 20, PANEL_COLOUR);
    fill(ctx, x, CEILING_Y, 1, FLOOR_Y - CEILING_Y, dim, 0.6);
    fill(ctx, x + 1, CEILING_Y, 1, FLOOR_Y - CEILING_Y, BLACK, 0.4);
    fill(ctx, x, 116, PANEL_WIDTH, 3, dim, 0.45);
    fill(ctx, x, 116, PANEL_WIDTH, 1, green, 0.25);
    fill(ctx, x, FLOOR_Y - 14, PANEL_WIDTH, 14, CEILING_COLOUR);
    fill(ctx, x, FLOOR_Y - 14, PANEL_WIDTH, 1, dim, 0.6);
    fill(ctx, x + 5, CEILING_Y + 7, 1, 1, dim, 0.8);
    fill(ctx, x + PANEL_WIDTH - 6, CEILING_Y + 7, 1, 1, dim, 0.8);
    fill(ctx, x + 5, FLOOR_Y - 20, 1, 1, dim, 0.8);
    fill(ctx, x + PANEL_WIDTH - 6, FLOOR_Y - 20, 1, 1, dim, 0.8);
    switch (kind) {
      case 5:
      case 6:
        // vent grille
        fill(ctx, x + 16, 126, 32, 20, BLACK, 0.7);
        for (let k = 0; k < 6; k++) fill(ctx, x + 18, 128 + k * 3, 28, 1.2, dim, 0.7);
        return;
      case 7:
      case 8:
        // window onto the colony outside
        fill(ctx, x + 8, 52, 48, 56, BLACK);
        this.drawOutside(ctx, x + 10, 54, 44, 52);
        fill(ctx, x + 31.5, 54, 1, 52, dim, 0.6);
        fill(ctx, x + 8, 52, 48, 1, green, 0.5);
        fill(ctx, x + 8, 107, 48, 1, dim, 0.7);
        quad(ctx, x + 14, 54, x + 20, 54, x + 12, 70, x + 10, 70, green, 0.06);
        return;
      case 9: {
        // bulkhead
        fill(ctx, x + 10, 52, 44, FLOOR_Y - 52, BLACK);
        fill(ctx, x + 12, 58, 40, FLOOR_Y - 58, LEAF_COLOUR);
        fill(ctx, x + 31.5, 58, 1, FLOOR_Y - 58, BLACK);
        fill(ctx, x + 16, 70, 10, 14, SKY);
        fill(ctx, x + 38, 70, 10, 14, SKY);
        for (let k = 0; k < 6; k++) {
          const sx = x + 10 + k * 8;
          quad(ctx, sx, 52, sx + 4, 52, sx + 1, 57, sx - 3, 57, AMBER, 0.55);
        }
        const locked = (h >>> 8) % 3 === 0;
        const blink = this.clock % 1.2 < 0.8;
        if (locked) circle(ctx, x + 58, 66, 1.6, ALARM, blink ? 1 : 0.3);
        else circle(ctx, x + 58, 66, 1.6, green);
        return;
      }
      case 10:
        // department sign
        fill(ctx, x + 12, 66, 40, 14, BLACK);
        outline(ctx, x + 12, 66, 40, 14, green, 0.8);
        centreText(ctx, SIGN_FONT, T.signs[(h >>> 8) % T.signs.length], x + 32, 69, green);
        quad(ctx, x + 28, 84, x + 36, 84, x + 32, 89, x + 32, 89, dim);
        return;
      case 11:
        // wall terminal
        fill(ctx, x + 18, 80, 28, 30, BLACK, 0.8);
        outline(ctx, x + 18, 80, 28, 30, dim);
        fill(ctx, x + 21, 83, 22, 15, SCREEN_GLOW);
        for (let k = 0; k < 3; k++) fill(ctx, x + 23, 85 + k * 4, 6 + hash01(panel, k) * 12, 1.5, green, 0.8);
        if (this.clock % 1 < 0.5) fill(ctx, x + 23, 97, 3, 1.5, BRIGHT);
        fill(ctx, x + 16, 110, 32, 3, dim, 0.7);
        return;
      case 12:
        // pipes and a valve
        fill(ctx, x + 20, CEILING_Y, 4, FLOOR_Y - CEILING_Y - 14, dim, 0.45);
        fill(ctx, x + 20, CEILING_Y, 1, FLOOR_Y - CEILING_Y - 14, green, 0.3);
        fill(ctx, x + 28, CEILING_Y, 3, FLOOR_Y - CEILING_Y - 14, dim, 0.35);
        circle(ctx, x + 26, 96, 6, AMBER, 0.7, false);
        line(ctx, x + 20, 96, x + 32, 96, AMBER, 0.6);
        line(ctx, x + 26, 90, x + 26, 102, AMBER, 0.6);
        return;
      case 13:
        // hazard striped kick plate
        for (let k = 0; k < 8; k++) {
          const sx = x + k * 8 + 4;
          quad(ctx, sx, FLOOR_Y - 13, sx + 4, FLOOR_Y - 13, sx, FLOOR_Y, sx - 4, FLOOR_Y, AMBER, 0.4);
        }
        return;
      case 14:
        // somebody already died here
        if ((h >>> 8) % 2 !== 0) {
          const splat = this.art.splats.get(DARK_BLOOD)?.[(h >>> 9) % 6];
          if (splat) sprite(ctx, splat, x + 32, 138, 30, 30, ((h >>> 12) % 628) / 100, 0.65);
          fill(ctx, x + 30, 148, 1.5, 14, DARK_BLOOD, 0.5);
          fill(ctx, x + 36, 146, 1, 9, DARK_BLOOD, 0.45);
          return;
        }
        break;
    }
    fill(ctx, x + 10, 60, PANEL_WIDTH - 20, 1, dim, 0.25);
    fill(ctx, x + 10, 140, PANEL_WIDTH - 20, 1, dim, 0.25);
  }

  /** The colony outside a window: stars, rain and hills, far enough away to crawl past. */
  drawOutside(ctx, x, y, width, height) {
    fill(ctx, x, y, width, height, SKY);
    const cell = 11;
    const u = this.scroll * OUTSIDE_DEPTH;
    const last = Math.floor((x + width + u) / cell);
    for (let c = Math.floor((x + u) / cell); c <= last; c++) {
      for (let k = 0; k < 2; k++) {
        const sx = c * cell + hash01(c, k * 2 + 1) * cell - u;
        if (sx < x + 1 || sx > x + width - 2) continue;
        const sy = y + 2 + hash01(c, k * 2 + 2) * height * 0.6;
        const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(this.clock * (1 + hash01(c, 9) * 3) + c));
        fill(ctx, sx, sy, 1, 1, this.green, (0.2 + 0.6 * hash01(c, k + 5)) * twinkle);
      }
    }

    const hills = this.scroll * HILL_DEPTH;
    for (let cx = x; cx < x + width; cx += 2) {
      const r = ridge(cx + hills);
      fill(ctx, cx, y + height - r, Math.min(2, x + width - cx), r, HILLS);
    }

    for (let k = 0; k < 5; k++) {
      const rx = x + (k * 9.7 + this.clock * 14) % width;
      const ry = y + (k * 23 + this.clock * 120) % (height - 6);
      line(ctx, rx, ry, Math.max(x, rx - 2), ry + 5, this.green, 0.18);
    }
  }

  drawFloor(ctx) {
    fill(ctx, 0, FLOOR_Y, SCREEN_W, SCREEN_H - FLOOR_Y, FLOOR_COLOUR);
    fill(ctx, 0, FLOOR_Y + 11, SCREEN_W, 1, this.dim, 0.3);
    fill(ctx, 0, FLOOR_Y + 24, SCREEN_W, 1, this.dim, 0.2);
    for (let c = Math.floor((this.scroll - 120) / 40); c * 40 - this.scroll < SCREEN_W + 120; c++) {
      const sx = c * 40 - this.scroll;
      line(ctx, sx, FLOOR_Y + 2, sx + (sx - SCREEN_W / 2) * 0.5, SCREEN_H, this.dim, 0.35);
      if (hash(c) % 3 !== 0) continue;
      // a floor grate
      fill(ctx, sx + 10, FLOOR_Y + 4, 18, 1, BLACK, 0.6);
      fill(ctx, sx + 10, FLOOR_Y + 7, 19, 1, BLACK, 0.6);
    }
    fill(ctx, 0, FLOOR_Y, SCREEN_W, 1.5, this.green, 0.65);
    fill(ctx, 0, FLOOR_Y + 1.5, SCREEN_W, 2.5, this.dim, 0.25);
  }

  drawLights(ctx) {
    const u = this.scroll * WALL_DEPTH;
    for (let c = Math.floor((u - 30) / 96) - 1; c * 96 + 30 - u < SCREEN_W + 40; c++) {
      if (!this.lampOn(c)) continue;
      const x = c * 96 + 30 - u;
      quad(ctx, x + 2, CEILING_Y - 3, x + 24, CEILING_Y - 3, x + 62, FLOOR_Y + 14, x - 36, FLOOR_Y + 14, this.green, 0.035);
      ellipse(ctx, x + 13, FLOOR_Y + 9, 40, 6, this.green, 0.05);
    }
  }

  drawDecals(ctx) {
    const start = this.decalCount < MAX_DECALS ? 0 : this.decalNext;
    for (let i = 0; i < this.decalCount; i++) {
      const decal = this.decals[(start + i) % MAX_DECALS];
      const x = decal.x - this.scroll;
      if (x < -decal.size || x > SCREEN_W + decal.size) continue;

      // the floor is seen at a slant, so its stains are squashed flat
      const half = decal.size / 2;
      ctx.save();
      ctx.translate(x, decal.y);
      ctx.scale(1, 0.45);
      ctx.rotate(decal.rotation);
      if (decal.acid) {
        // fresh acid is bright and darkens as it eats in
        const t = Math.min(1, decal.age / 4);
        drawSplat(ctx, this.art.splats.get(ACID)?.[decal.state], half, decal.alpha * (1 - t));
        drawSplat(ctx, this.art.splats.get(DARK_ACID)?.[decal.state], half, decal.alpha * t);
        if (decal.age < 2.5) drawSplat(ctx, this.art.splats.get(ACID)?.[decal.state], half, 0.5 * (1 - decal.age / 2.5));
      } else {
        drawSplat(ctx, this.art.splats.get(decal.colour)?.[decal.state], half, decal.alpha);
      }
      ctx.restore();
    }
  }

  drawShadows(ctx) {
    for (const human of this.humans) {
      if (!human.active) continue;
      const x = human.x - this.scroll;
      if (human.state === HumanState.Down) ellipse(ctx, x + human.fall * 28, FLOOR_Y + 2, 30, 4, BLACK, 0.45);
      else ellipse(ctx, x, FLOOR_Y + 1, 12, 3, BLACK, 0.45);
    }

    if (this.phase === Phase.Attract || this.phase === Phase.Run) {
      const lift = Math.min(this.y, 100) / 100;
      ellipse(ctx, HUGGER_X, FLOOR_Y + 1, 12 * (1 - lift * 0.45), 3, BLACK, 0.45 * (1 - lift * 0.6));
    }

    if (this.corpse) ellipse(ctx, this.corpseAt.x - this.scroll, FLOOR_Y + 1, 11, 2.5, BLACK, 0.45);
  }

  drawHuman(ctx, human) {
    const x = human.x - this.scroll;
    if (x < -60 || x > SCREEN_W + 60) return;
    const image = human.east ? human.eastImage : human.west;
    if (!image) return;

    const { rotation, lean, bob } = this.pose(human);
    ctx.save();
    ctx.translate(x + lean, FLOOR_Y - bob);
    ctx.rotate(rotation);
    ctx.drawImage(image, -HUMAN_SIZE / 2, -HUMAN_SIZE, HUMAN_SIZE, HUMAN_SIZE);
    if (human.infected) {
      // the hugger wrapped round the face, squeezing faster while the host still fights it
      const squeeze = human.state === HumanState.Down ? human.timer / 0.25 : human.timer / 0.08;
      const frames = human.east ? this.art.maskEast : this.art.maskWest;
      if (frames) ctx.drawImage(frames[Math.floor(squeeze) % frames.length], -HUMAN_SIZE / 2, -HUMAN_SIZE, HUMAN_SIZE, HUMAN_SIZE);
    }
    ctx.restore();
  }

  /** How a human stands this frame: rotation about the feet in radians, a sideways lean and a bob, in units. */
  pose(human) {
    let rotation = 0;
    let lean = 0;
    let bob = 0;
    switch (human.state) {
      case HumanState.Walk:
        bob = Math.abs(Math.sin(human.step)) * 2;
        break;
      case HumanState.Flee:
        bob = Math.abs(Math.sin(human.step)) * 2.5;
        rotation = 0.12;
        break;
      case HumanState.Stand:
      case HumanState.Aim:
        bob = human.marine && this.phase === Phase.Run
          ? Math.abs(Math.sin(human.step)) * 1.5
          : 0.5 + Math.sin(this.clock * 2 + human.x) * 0.5;
        break;
      case HumanState.Alert:
        lean = (Math.random() - 0.5) * 1.2;
        rotation = 0.06;
        break;
      case HumanState.Kick: {
        const kick = Math.sin(Math.min(1, human.timer / KICK_TIME) * Math.PI);
        rotation = (human.east ? 0.18 : -0.18) * kick;
        lean = (human.east ? 3 : -5) * kick;
        break;
      }
      case HumanState.Latched: {
        if (human.timer < STRUGGLE) {
          rotation = Math.sin(human.timer * 40) * 0.08;
          break;
        }
        // goes over backwards, slow at first and then all at once, settling onto the floor
        const fall = clamp((human.timer - STRUGGLE) / FALL_TIME, 0, 1);
        rotation = human.fall * Math.PI / 2 * fall * fall;
        bob = -6 * fall * fall;
        break;
      }
      case HumanState.Shot: {
        const drop = clamp(human.timer / (FALL_TIME * 0.8), 0, 1);
        rotation = human.fall * Math.PI / 2 * drop * drop;
        bob = -6 * drop * drop;
        break;
      }
      case HumanState.Down:
        rotation = human.fall * Math.PI / 2;
        bob = -6;
        if (human.timer < 1.5) rotation += Math.sin(human.timer * 50) * 0.025 * (1 - human.timer / 1.5);
        break;
    }
    return { rotation, lean, bob };
  }

  drawHugger(ctx) {
    if (this.phase !== Phase.Attract && this.phase !== Phase.Run) return;

    let image;
    let rotation = 0;
    if (this.grounded) {
      image = this.art.running?.[Math.floor(this.anim / 0.1) % this.art.running.length];
    } else if (this.vy > 90) {
      // nose up on the way up, then legs spread for the grab
      image = this.art.running?.[1];
      rotation = -0.35;
    } else {
      image = this.art.thrown;
      rotation = this.vy < -100 ? 0.15 : 0;
    }
    if (!image) return;

    let w = HUGGER_SIZE;
    let h = HUGGER_SIZE;
    if (this.squash > 0) {
      w *= 1 - 0.14 * this.squash;
      h *= 1 + 0.22 * this.squash;
    } else if (this.squash < 0) {
      w *= 1 - 0.2 * this.squash;
      h *= 1 + 0.26 * this.squash;
    }
    if (this.duck && this.grounded) {
      w *= 1.14;
      h *= 0.55;
    }

    const feet = FLOOR_Y - this.y;
    sprite(ctx, image, HUGGER_X, feet + HUGGER_FOOT_PAD * h / HUGGER_SIZE - h / 2, w, h, rotation);
  }

  drawCorpse(ctx) {
    if (!this.corpse) return;
    const x = this.corpseAt.x - this.scroll;
    const feet = FLOOR_Y - this.corpseAt.y;
    if (!this.corpseDown) {
      if (this.art.thrown) sprite(ctx, this.art.thrown, x, feet - 16, HUGGER_SIZE, HUGGER_SIZE, this.corpseRotation);
      return;
    }
    if (this.art.dead) sprite(ctx, this.art.dead, x, feet - HUGGER_SIZE / 2 + 1.25, HUGGER_SIZE, HUGGER_SIZE, 0);
  }

  /** Laser sights on the lanes about to be fired down, marines' aim, tracers and muzzle flashes. */
  drawFire(ctx) {
    this.shots.forEach((shot, i) => {
      if (shot.delay >= WARNING) return;
      const k = 1 - shot.delay / WARNING;
      const flicker = 0.75 + 0.25 * Math.sin(this.clock * 60 + i);
      fill(ctx, SCREEN_W - 90 * k, shot.lane - 0.5, 90 * k, 1, LASER, 0.3 * k * flicker);
      circle(ctx, SCREEN_W - 1, shot.lane, 2 + 7 * k, TRACER_GLOW, (0.15 + 0.35 * k) * flicker);
    });

    for (const human of this.humans) {
      if (!human.active || human.state !== HumanState.Aim || this.phase !== Phase.Run) continue;
      const muzzle = barrel(human.x - this.scroll);
      const target = this.target();
      const aim = Math.min(1, human.timer / MARINE_AIM);
      line(ctx, muzzle.x, muzzle.y, muzzle.x + (target.x - muzzle.x) * aim, muzzle.y + (target.y - muzzle.y) * aim,
        LASER, clamp(0.35 + 0.3 * Math.sin(this.clock * 50), 0, 1));
      if (aim >= 1) circle(ctx, target.x, target.y, 1.5, LASER);
    }

    for (const bullet of this.bullets) {
      const dir = normalize(bullet.vx, bullet.vy);
      const tailX = bullet.x - dir.x * TRACER;
      const tailY = bullet.y - dir.y * TRACER;
      beam(ctx, tailX, tailY, bullet.x, bullet.y, 5, TRACER_GLOW, 0.3);
      beam(ctx, tailX, tailY, bullet.x, bullet.y, 2, TRACER_CORE);
      fill(ctx, bullet.x - 1, bullet.y - 1, 2, 2, WHITE);
    }

    for (const flash of this.flashes) {
      const k = 1 - flash.age / 0.07;
      circle(ctx, flash.x, flash.y, 7 * k + 2, TRACER_GLOW, 0.5 * k);
      circle(ctx, flash.x, flash.y, 3 * k + 1, TRACER_CORE, k);
      beam(ctx, flash.x - 12 * k, flash.y, flash.x + 4, flash.y, 2, TRACER_CORE, k);
      beam(ctx, flash.x, flash.y - 6 * k, flash.x, flash.y + 6 * k, 1.5, TRACER_GLOW, k);
    }
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      const alpha = p.alpha * clamp(1 - p.age / p.life, 0, 1);
      const x = p.x - this.scroll;
      switch (p.kind) {
        case SPARK:
          line(ctx, x, p.y, x - p.vx * 0.03, p.y - p.vy * 0.03, p.colour, alpha);
          break;
        case SMOKE:
          circle(ctx, x, p.y, p.size, p.colour, alpha * 0.6);
          break;
        default:
          fill(ctx, x - p.size / 2, p.y - p.size / 2, p.size, p.size, p.colour, alpha);
          break;
      }
    }
  }

  /** Speed lines once the run gets going. */
  drawStreaks(ctx) {
    if (this.phase !== Phase.Run || this.speed < 250) return;
    const alpha = (this.speed - 250) / (MAX_SPEED - 250) * 0.18;
    const cell = 70;
    const u = this.scroll * 1.25;
    for (let c = Math.floor(u / cell); c * cell - u < SCREEN_W; c++) {
      if ((hash(c) & 3) !== 0) continue;
      const x = c * cell - u + hash01(c, 1) * cell;
      fill(ctx, x, 50 + hash01(c, 2) * 120, 20 + hash01(c, 3) * 40, 1, BRIGHT, alpha);
    }
  }

  drawPopups(ctx) {
    for (const popup of this.popups) {
      const progress = popup.age / popup.life;
      centreText(ctx, SMALL_FONT, popup.text, popup.x - this.scroll, popup.y - 18 * progress, popup.colour, clamp(2 - progress * 2, 0, 1));
    }
  }

  drawHud(ctx) {
    fill(ctx, 0, 0, SCREEN_W, HUD_HEIGHT, HUD_COLOUR);
    fill(ctx, 0, HUD_HEIGHT - 1, SCREEN_W, 1, this.hudFlash > 0 && this.hudFlash % 0.2 > 0.1 ? BRIGHT : this.dim);
    const best = T.best(String(this.best).padStart(5, '0'));
    ctx.font = SMALL_FONT;
    text(ctx, SMALL_FONT, best, SCREEN_W - 6 - ctx.measureText(best).width, 3, this.dim);

    const blink = this.clock % 1.1 < 0.75;
    switch (this.phase) {
      case Phase.Attract:
        centreText(ctx, BIG_FONT, T.title, SCREEN_W / 2, 62, this.green);
        if (this.focused && blink) centreText(ctx, FONT, T.start, SCREEN_W / 2, 92, BRIGHT);
        centreText(ctx, SMALL_FONT, T.keys, SCREEN_W / 2, 108, this.dim);
        break;
      case Phase.Run:
        if (this.paused) centreText(ctx, BIG_FONT, T.paused, SCREEN_W / 2, 80, this.green);
        break;
      default:
        if (this.over < 0.15) break;
        centreText(ctx, BIG_FONT, this.endText, SCREEN_W / 2, 66, this.endColour);
        if (this.focused && this.over >= RESTART_DELAY && blink) centreText(ctx, FONT, T.again, SCREEN_W / 2, 96, BRIGHT);
        break;
    }
  }

  /** Scanlines, a slow roll bar and darkened edges, so the whole screen reads as an old tube. */
  drawCrt(ctx) {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = BLACK;
    for (let y = 1; y < SCREEN_H; y += 2) ctx.fillRect(0, y, SCREEN_W, 1);
    ctx.globalAlpha = 1;

    const roll = (this.clock * 26) % (SCREEN_H + 60) - 30;
    fill(ctx, 0, roll, SCREEN_W, 22, this.green, 0.025);
    for (let k = 0; k < 3; k++) {
      const alpha = 0.14 - k * 0.04;
      const inset = k * 3;
      fill(ctx, inset, inset, SCREEN_W - inset * 2, 3, BLACK, alpha);
      fill(ctx, inset, SCREEN_H - inset - 3, SCREEN_W - inset * 2, 3, BLACK, alpha);
      fill(ctx, inset, inset + 3, 3, SCREEN_H - inset * 2 - 6, BLACK, alpha);
      fill(ctx, SCREEN_W - inset - 3, inset + 3, 3, SCREEN_H - inset * 2 - 6, BLACK, alpha);
    }
  }
}

// Collision and drawing helpers, in screen units -------------------------------------------------------------------

/** The M41A's muzzle on a marine facing west, from the sprite. */
function barrel(x) {
  return { x: x - 26, y: FLOOR_Y - 31 };
}

function hittable(human) {
  return human.active && human.state !== HumanState.Latched && human.state !== HumanState.Shot && human.state !== HumanState.Down;
}

function inside(x, y, left, right, top, bottom) {
  // tracers are thin: a hair of slack so a grazing round still counts
  return x >= left - 1.5 && x <= right + 1.5 && y >= top - 1.5 && y <= bottom + 1.5;
}

function overlap(left, right, top, bottom, otherLeft, otherRight, otherTop, otherBottom) {
  return left < otherRight && right > otherLeft && top < otherBottom && bottom > otherTop;
}

function fill(ctx, x, y, w, h, colour, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
}

function outline(ctx, x, y, w, h, colour, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.globalAlpha = 1;
}

function line(ctx, x1, y1, x2, y2, colour, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function circle(ctx, x, y, radius, colour, alpha = 1, filled = true) {
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, radius), 0, TAU);
  if (filled) {
    ctx.fillStyle = colour;
    ctx.fill();
  } else {
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function ellipse(ctx, x, y, rx, ry, colour, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function quad(ctx, ax, ay, bx, by, cx, cy, dx, dy, colour, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.lineTo(dx, dy);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** A straight bar of some width from one point to another, for tracers. */
function beam(ctx, x1, y1, x2, y2, width, colour, alpha = 1) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (length < 0.01) return;
  const sx = -(y2 - y1) / length * (width / 2);
  const sy = (x2 - x1) / length * (width / 2);
  quad(ctx, x1 + sx, y1 + sy, x2 + sx, y2 + sy, x2 - sx, y2 - sy, x1 - sx, y1 - sy, colour, alpha);
}

/** Draws an image centred on a spot at a size, turned by radians. */
function sprite(ctx, image, x, y, w, h, radians = 0, alpha = 1) {
  ctx.globalAlpha = alpha;
  if (radians === 0) {
    ctx.drawImage(image, x - w / 2, y - h / 2, w, h);
  } else {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(radians);
    ctx.drawImage(image, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawSplat(ctx, image, half, alpha) {
  if (!image || alpha <= 0) return;
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, -half, -half, half * 2, half * 2);
  ctx.globalAlpha = 1;
}

/** Phosphor text: a dark drop, a soft glow either side, then the letters. */
function text(ctx, font, str, x, y, colour, alpha = 1) {
  ctx.font = font;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = BLACK;
  ctx.globalAlpha = alpha * 0.8;
  ctx.fillText(str, x + 1, y + 1);
  ctx.fillStyle = colour;
  ctx.globalAlpha = alpha * 0.25;
  ctx.fillText(str, x - 1, y);
  ctx.fillText(str, x + 1, y);
  ctx.globalAlpha = alpha;
  ctx.fillText(str, x, y);
  ctx.globalAlpha = 1;
}

function centreText(ctx, font, str, x, y, colour, alpha = 1) {
  ctx.font = font;
  text(ctx, font, str, x - ctx.measureText(str).width / 2, y, colour, alpha);
}
