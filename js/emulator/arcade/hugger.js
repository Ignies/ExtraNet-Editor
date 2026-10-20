// Hugger Run, a port of Arcade/CMUHuggerRun.cs: a xeno's life cycle as one arcade run. A facehugger dodges fire
// down a colony corridor until it lands on a face, bursts out as a larva, slips through the vents, evolves, sneaks
// past marines as a runner and ends as a ravager. This module is the cabinet and the stage machine: it runs one
// stage (hugger/*.js) at a time, fades between them with a title card, and owns what the stages share: input,
// score, particles, decals, popups, shake, flashes, slow motion, sounds, sprites, dressed humans, the HUD and the
// phosphor screen. Stages get it as `this.run`; the contract is in hugger/stage.js and hugger-stage-contract.md.
// Constants, layout (320 x 224 units), sprites, sounds and strings match the C# files; keep them in step.

import { ArcadeScreen } from './screen.js';
import { scream, preloadSounds } from '../audio.js';
import { layerCanvas, stateCanvas } from '../sports/dolls.js';
import { loadRsi, loadStateSheet, stateFrames } from '../../sprites.js';
import { ensureFont } from '../../fonts.js';
import { fetchResource } from '../../repo.js';
import {
  SCREEN_W, SCREEN_H, HUD_HEIGHT, STEP, UNITS_PER_POINT, SMOKE, SPARK, SOUTH, NORTH, EAST, WEST, Key, Outfit,
  SPLATTER, PHOSPHOR, BRIGHT, ACID, DARK_ACID, GREEN, DIM, BLACK, STAIN_COLOURS, TEXT_FONT, SMALL_FONT, BIG_FONT, CARD_FONT,
  clamp, pick, fill, circle, line, centreText, text, textWidth,
} from './hugger/stage.js';
import { Facehugger } from './hugger/facehugger.js';
import { Larva } from './hugger/larva.js';
import { Vent } from './hugger/vent.js';
import { Stealth } from './hugger/stealth.js';
import { Ravager } from './hugger/ravager.js';

/** The campaign, in order. */
const STAGES = [Facehugger, Larva, Vent, Stealth, Ravager];

const MAX_SCORE = 99999; // CMUArcadeLimits.MaxScore
const MILESTONE = 500;
const FADE_TIME = 0.4;
const CARD_TIME = 1.8;
const RESTART_DELAY = 0.9;
const SLOW_FACTOR = 0.35;
const MAX_PARTICLES = 480;
const MAX_DECALS = 180;
const MAX_POPUPS = 10;

const PARTS = '/Textures/Mobs/Species/Human/parts.rsi';
const EYES = '/Textures/Mobs/Customization/eyes.rsi';
const HAIR = '/Textures/Mobs/Customization/human_hair.rsi';
const CLOTHING = '/Textures/_RMC14/Objects/Clothing/';
const RIFLE = '/Textures/CMU14/Weapons/Guns/USCM/m41mk2.rsi';
const KNIFE = '/Textures/_RMC14/Objects/Weapons/Melee/m5_bayonet.rsi';
const SHOTGUN = '/Textures/_RMC14/Objects/Weapons/Guns/Shotguns/m37a1/classic.rsi';
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
const SKINS = ['#FFE1CC', '#EDC2A0', '#C08A62', '#8A5634'];
const HAIR_COLOURS = ['#2A1A10', '#5A3A20', '#C89A50', '#1A1A1A', '#8A3A1A'];
const EYE_COLOUR = '#2B1A10';
const HUD_COLOUR = '#010401';

const NEW_GAME = '/Audio/Effects/Arcade/newgame.ogg';
const LOST = '/Audio/Effects/Arcade/gameover.ogg';
const WON = '/Audio/Effects/Arcade/win.ogg';
const BEEP = '/Audio/Effects/beep1.ogg';
const FRAMEWORK_SOUNDS = [NEW_GAME, LOST, WON, BEEP];

/** Framework strings from Games/hugger.ftl. */
const T = {
  help: 'Space, W, Up or 8 jumps, hold it to leap higher; S, Down or 2 ducks. Infect a host, burst out, crawl the vents, evolve. Later: arrows move, Space pounces.',
  title: 'HUGGER RUN',
  start: 'SPACE OR 8 TO RUN',
  keys: 'JUMP: SPACE / W / 8    DUCK: S / 2',
  again: 'SPACE TO RUN AGAIN',
  paused: 'PAUSED',
  best: score => `HI ${score}`,
  bonus: bonus => `+${bonus}`,
  victory: 'HIVE VICTORIOUS',
  victoryStatus: score => `HIVE VICTORIOUS - SCORE ${score}`,
};

const Flow = { Attract: 0, Playing: 1, FadeOut: 2, FadeIn: 3, Over: 4 };

/** A copy of an image region tinted like a sprite layer colour: multiplied, alpha kept. */
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

function warn(e) {
  console.warn(`hugger run: ${e.message}`);
}

export class HuggerRun extends ArcadeScreen {
  constructor(colors) {
    super(colors);
    this.green = colors.green;
    this.dim = colors.dim;

    this.frames = new Map();
    this.splats = new Map();
    for (const colour of STAIN_COLOURS) {
      const list = new Array(6).fill(null);
      this.splats.set(colour, list);
      for (let i = 0; i < 6; i++) stateCanvas(SPLATTER, `splatter-${i}`, colour).then(c => { list[i] = c; });
    }

    this.particles = [];
    this.decals = new Array(MAX_DECALS);
    this.decalCount = 0;
    this.decalNext = 0;
    this.popups = [];
    this.pending = [];
    this.keys = new Array(6).fill(false);

    this.flow = Flow.Attract;
    this.flowTime = 0;
    this.card = 0;
    this.paused = false;
    this.clock = 0;
    this.overTime = 0;
    /** Where the world is seen from: a world point is drawn at point - camera. Stages set it as they move. */
    this.camera = { x: 0, y: 0 };
    this.distance = 0;
    this.milestones = 0;
    this.best = 0;
    this.slow = 0;
    this.shakeStrength = 0;
    this.shakeTime = 0;
    this.offset = { x: 0, y: 0 };
    this.flashColour = BLACK;
    this.flashAlpha = 0;
    this.flashLife = 0;
    this.flashAge = 0;
    this.hudFlash = 0;
    this.endText = '';
    this.endColour = ACID;

    this.stages = STAGES.map(Stage => new Stage(this));
    this.stage = 0;
    preloadSounds([...FRAMEWORK_SOUNDS, ...this.stages.flatMap(stage => stage.sounds)]);
    this.preloadPeople();
    for (const stage of this.stages) stage.preload();
    ensureFont('Terminal');
    this.stages[0].enter();
  }

  get help() {
    return T.help;
  }

  // For the stages -------------------------------------------------------------------------------------------------

  /** The title screen: only the first stage sees it, scrolling by under the title with nothing spawning. */
  get attract() {
    return this.flow === Flow.Attract;
  }

  /** The run has ended (lost or won). Stages keep updating so their ending plays out, but take no input. */
  get over() {
    return this.flow === Flow.Over;
  }

  get points() {
    return this.score;
  }

  fx() {
    return Math.random();
  }

  /** Whether a key (Key.Up, Key.Down, ...) is held right now. */
  held(key) {
    return this.keys[key];
  }

  addScore(points) {
    this.score = clamp(this.score + points, 0, MAX_SCORE);
    if (Math.floor(this.score / MILESTONE) <= this.milestones) return;
    this.milestones = Math.floor(this.score / MILESTONE);
    this.hudFlash = 0.6;
    this.play(BEEP, -8, 1.2);
  }

  /** Adds the points for running some world units, keeping the fraction for next time. */
  addDistance(units) {
    this.distance += units;
    const whole = Math.floor(this.distance / UNITS_PER_POINT);
    if (whole <= 0) return;
    this.distance -= whole * UNITS_PER_POINT;
    this.addScore(whole);
  }

  /** A bonus with its '+N' popup at a world point. */
  bonus(points, at, colour) {
    this.addScore(points);
    this.pop(T.bonus(points), at, colour, 1.4);
  }

  /** Ends this stage: the screen fades out and the next stage enters behind its title card. The last stage wins. */
  nextStage() {
    if (this.flow !== Flow.Playing) return;
    if (this.stage >= this.stages.length - 1) {
      this.win(T.victory);
      return;
    }
    this.flow = Flow.FadeOut;
    this.flowTime = 0;
  }

  /** The run is lost: big text in the middle and the score goes to the board. */
  lose(text, colour) {
    if (this.flow !== Flow.Playing) return;
    this.end(text, colour);
    this.pend(0.6, LOST, -6);
  }

  /** The run is won. The status line says so with the final score. */
  win(text) {
    if (this.flow !== Flow.Playing) return;
    this.end(text, ACID);
    this.setStatus(T.victoryStatus(this.score));
    this.pend(0.3, WON, -4);
  }

  end(text, colour) {
    this.flow = Flow.Over;
    this.overTime = 0;
    this.endText = text;
    this.endColour = colour;
    this.gameOver();
    this.best = Math.max(this.best, this.score);
  }

  /** Slows everything (stages and effects) for a moment, for an impact. */
  slowMotion(seconds) {
    this.slow = Math.max(this.slow, seconds);
  }

  // Run flow and input ---------------------------------------------------------------------------------------------

  /** Starts a run. stage is for testing: the campaign always starts at 0. */
  start(stage = 0) {
    // a key mashed as the run ends must not throw it straight into a new one
    if (this.flow === Flow.Over && this.overTime < RESTART_DELAY) return;

    super.start();
    this.flow = Flow.Playing;
    this.distance = 0;
    this.milestones = 0;
    this.slow = 0;
    this.pending.length = 0;
    this.keys.fill(false);
    this.enterStage(stage);
    this.play(NEW_GAME, -6);
  }

  enterStage(stage) {
    this.stage = stage;
    this.particles.length = 0;
    this.decalCount = 0;
    this.decalNext = 0;
    this.popups.length = 0;
    this.shakeTime = 0;
    this.flashLife = 0;
    this.card = CARD_TIME;
    this.camera = { x: 0, y: 0 };
    this.stages[stage].enter();
  }

  onKey(input) {
    if (input.key !== Key.None) this.keys[input.key] = input.down;
    if (input.repeat) return;

    // W, Up and 8 start a run as well as Space
    if (!this.running && input.down && input.key === Key.Up) {
      this.start();
      return;
    }

    if (this.flow === Flow.Playing) this.stages[this.stage].onKey(input);
  }

  onFocusLost() {
    this.keys.fill(false);
    this.stages[this.stage].onRelease();
  }

  update(dt) {
    const real = Math.min(dt, 0.05);
    this.clock += real;

    // a run without the keys waits for them instead of running into the next bullet
    this.paused = (this.flow === Flow.Playing || this.flow === Flow.FadeIn || this.flow === Flow.FadeOut) && !this.focused;
    if (this.paused) return;

    if (this.slow > 0) this.slow -= real;
    const delta = this.slow > 0 ? real * SLOW_FACTOR : real;
    switch (this.flow) {
      case Flow.FadeOut:
        this.flowTime += real;
        if (this.flowTime >= FADE_TIME) {
          this.stages[this.stage].exit();
          this.enterStage(this.stage + 1);
          this.flow = Flow.FadeIn;
          this.flowTime = 0;
        }
        break;
      case Flow.FadeIn:
        this.flowTime += real;
        if (this.flowTime >= FADE_TIME) this.flow = Flow.Playing;
        break;
      default: {
        if (this.flow === Flow.Over) this.overTime += real;
        if (this.flow === Flow.Playing && this.card > 0) this.card -= real;
        const stage = this.stages[this.stage];
        for (let left = delta; left > 0; left -= STEP) stage.update(Math.min(left, STEP));
        break;
      }
    }

    this.updateEffects(delta);
    this.updateSounds(real);
  }

  // Effects --------------------------------------------------------------------------------------------------------

  /**
   * Throws particles from a world point {x, y}. direction and spread are radians, 0 pointing right and positive
   * turning down the screen. Options: floor (the y drops land on, or NaN to fly until they fade), depth (how much
   * further down they may land), stains (land as a decal; with no floor, where they stop), kind (DROP, SPARK, SMOKE),
   * acid, inherit (added to the x speed), drag, flat (the decal's squash, 1 for top-down).
   */
  emit(at, count, colour, alpha, speed, life, size, direction, spread, gravity = 0,
    { floor = NaN, depth = 0, stains = false, kind = 0, acid = false, inherit = 0, drag = 0, flat = 0.45 } = {}) {
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
        drag,
        floor: Number.isNaN(floor) ? NaN : floor + Math.random() * depth,
        flat,
        colour,
        alpha,
        kind,
        stains,
        acid,
      });
    }
  }

  /** Stamps a stain at a world point. flat squashes it for a floor seen at a slant (1 is top-down). */
  splat(at, size, colour, alpha = 0.9, flat = 0.45, acid = false) {
    this.decals[this.decalNext] = {
      x: at.x, y: at.y, size, colour, alpha, flat, acid, age: 0,
      rotation: Math.random() * Math.PI * 2,
      state: Math.floor(Math.random() * 6),
    };
    this.decalNext = (this.decalNext + 1) % MAX_DECALS;
    this.decalCount = Math.min(this.decalCount + 1, MAX_DECALS);
  }

  /** Text that floats up from a world point and fades. */
  pop(text, at, colour, life = 0.9) {
    if (this.popups.length < MAX_POPUPS) this.popups.push({ text, x: at.x, y: at.y, colour, age: 0, life });
  }

  shake(strength, time = 0.3) {
    // a light knock does not cut short a big one still shaking
    if (this.shakeTime > 0 && strength < this.shakeStrength) return;
    this.shakeStrength = strength;
    this.shakeTime = time;
  }

  /** Washes the play area with a colour at alpha strength, fading over time. */
  flash(colour, alpha, time = 0.25) {
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
      } else if (p.drag > 0) {
        const drag = Math.max(0, 1 - p.drag * dt);
        p.vx *= drag;
        p.vy *= drag;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const landed = !Number.isNaN(p.floor) && p.y >= p.floor && p.vy > 0;
      const expired = p.age >= p.life;
      if (p.stains && (landed || (expired && Number.isNaN(p.floor)))) {
        this.splat({ x: p.x, y: landed ? p.floor : p.y }, p.size * 2.4, p.colour, p.alpha, p.flat, p.acid);
      }
      if (landed || expired) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
      }
    }

    for (let i = 0; i < this.decalCount; i++) this.decals[i].age += dt;

    for (let i = this.popups.length - 1; i >= 0; i--) {
      this.popups[i].age += dt;
      if (this.popups[i].age >= this.popups[i].life) this.popups.splice(i, 1);
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

  // Sound ----------------------------------------------------------------------------------------------------------

  play(path, volume = 0, pitch = 1) {
    this.sound(path, volume, pitch);
  }

  /** One of several takes, with a little pitch variation around pitch. */
  playAny(paths, volume = 0, pitch = 1) {
    this.sound(pick(paths), volume, pitch * (0.94 + Math.random() * 0.12));
  }

  scream(female, volume = 0) {
    scream(female, { volume, source: this.canvas });
  }

  /** A sound a moment later, like the scream after the pounce. */
  pend(delay, path, volume = 0, pitch = 1) {
    this.pending.push({ delay, path, volume, pitch, scream: 0 });
  }

  pendScream(delay, female, volume = 0) {
    this.pending.push({ delay, path: null, volume, pitch: 1, scream: female ? 2 : 1 });
  }

  updateSounds(dt) {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const sound = this.pending[i];
      sound.delay -= dt;
      if (sound.delay > 0) continue;
      this.pending.splice(i, 1);
      if (sound.scream > 0) this.scream(sound.scream === 2, sound.volume);
      else if (sound.path) this.play(sound.path, sound.volume, sound.pitch);
    }
  }

  // Sprites and people ---------------------------------------------------------------------------------------------

  /**
   * A frame of a sprite state facing a direction, tinted (PHOSPHOR by default, null for none), as a canvas; null
   * while it loads (the first call starts the load). Frames wrap; one-direction states ignore the direction.
   */
  frame(rsi, state, direction = SOUTH, frame = 0, tint = PHOSPHOR) {
    const frames = this.framesOf(rsi, state, direction, tint);
    if (!frames || frames.length === 0) return null;
    return frames[((frame % frames.length) + frames.length) % frames.length];
  }

  frameCount(rsi, state) {
    const frames = this.framesOf(rsi, state, SOUTH, PHOSPHOR);
    return frames ? frames.length : 1;
  }

  framesOf(rsi, state, direction, tint) {
    const key = `${rsi}|${state}|${direction}|${tint}`;
    const entry = this.frames.get(key);
    if (entry !== undefined) return entry;
    this.frames.set(key, null);
    (async () => {
      const meta = await loadRsi(rsi);
      const st = meta.states.get(state);
      if (!st) throw new Error(`state "${state}" is not in ${meta.path}`);
      const image = await loadStateSheet(meta.path, state);
      return stateFrames(meta, st, image, Math.min(direction, st.directions - 1))
        .map(f => tinted(image, tint, f.sx, f.sy, meta.size.x, meta.size.y));
    })().then(frames => this.frames.set(key, frames), e => {
      warn(e);
      this.frames.set(key, []);
    });
    return null;
  }

  /**
   * A plain texture file rather than an RSI state, such as a floor tile under /Textures/_RMC14/Tiles/, tinted
   * (PHOSPHOR by default, null for none), as a canvas; null while it loads.
   */
  image(path, tint = PHOSPHOR) {
    const key = `${path}|${tint}`;
    const entry = this.frames.get(key);
    if (entry !== undefined) return entry;
    this.frames.set(key, null);
    fetchResource(path, 'blob')
      .then(({ data }) => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`${path} is not a readable image`));
        image.src = URL.createObjectURL(data);
      }))
      .then(image => this.frames.set(key, tinted(image, tint)), e => warn(e));
    return null;
  }

  /** One of the six blood splatter states tinted one of STAIN_COLOURS; null while loading. */
  splatterFrame(state, colour) {
    return this.splats.get(colour)?.[state] ?? null;
  }

  /** The sheets people are dressed from, so a person dressed later composites at once. */
  preloadPeople() {
    const sheets = [
      [PARTS, ['torso_m', 'torso_f', 'head_m', 'head_f', 'r_arm', 'l_arm', 'r_leg', 'l_leg', 'l_foot', 'r_foot', 'l_hand', 'r_hand']],
      [EYES, ['eyes']], [HAIR, [...MALE_HAIR, ...FEMALE_HAIR]], [RIFLE, ['wielded-inhand-left']], [SHOTGUN, ['wielded-inhand-left']], [KNIFE, ['inhand-left', 'icon']],
      [CLOTHING + MARINE_UNIFORM, ['equipped-INNERCLOTHING']], [CLOTHING + MARINE_BOOTS, ['equipped-FEET']],
      [CLOTHING + MARINE_ARMOR, ['equipped-OUTERCLOTHING']], [CLOTHING + MARINE_HELMET, ['equipped-HELMET']],
      ...JUMPSUITS.map(j => [CLOTHING + j, ['equipped-INNERCLOTHING']]), ...SHOES.map(s => [CLOTHING + s, ['equipped-FEET']]),
    ];
    for (const [rsi, states] of sheets) {
      loadRsi(rsi).then(meta => states.forEach(state => loadStateSheet(meta.path, state).catch(warn)), warn);
    }
    this.frame(KNIFE, 'icon');
  }

  /** The bayonet's icon, for drawing a stab bigger than the in-hand sprite shows it. */
  get knifeIcon() {
    return this.frame(KNIFE, 'icon');
  }

  /**
   * Dresses a person ({} or a reused object) the way the game draws one: body parts, eyes, clothes and hair (or
   * marine kit) in layer order, in all four directions. Picks sex, skin, clothes and hair at random. Sets
   * person.outfit, person.female and person.images[direction] (canvases, null until composited).
   */
  dress(person, outfit) {
    const marine = outfit !== Outfit.Colonist;
    person.outfit = outfit;
    person.female = Math.random() < (marine ? 0.2 : 0.45);
    const skin = pick(SKINS);
    const sex = person.female ? '_f' : '_m';
    const layers = [
      [PARTS, 'torso' + sex, skin], [PARTS, 'head' + sex, skin], [EYES, 'eyes', EYE_COLOUR],
      [PARTS, 'r_arm', skin], [PARTS, 'l_arm', skin], [PARTS, 'r_leg', skin], [PARTS, 'l_leg', skin],
      [CLOTHING + (marine ? MARINE_UNIFORM : pick(JUMPSUITS)), 'equipped-INNERCLOTHING', null],
      [PARTS, 'l_foot', skin], [PARTS, 'r_foot', skin], [PARTS, 'l_hand', skin], [PARTS, 'r_hand', skin],
      [CLOTHING + (marine ? MARINE_BOOTS : pick(SHOES)), 'equipped-FEET', null],
    ];
    if (!marine) {
      layers.push([HAIR, pick(person.female ? FEMALE_HAIR : MALE_HAIR), pick(HAIR_COLOURS)]);
    } else {
      layers.push([CLOTHING + MARINE_ARMOR, 'equipped-OUTERCLOTHING', null]);
      layers.push([CLOTHING + MARINE_HELMET, 'equipped-HELMET', null]);
      if (outfit === Outfit.Rifleman) layers.push([RIFLE, 'wielded-inhand-left', null]);
      else if (outfit === Outfit.Shotgunner) layers.push([SHOTGUN, 'wielded-inhand-left', null]);
      else layers.push([KNIFE, 'inhand-left', null]);
    }

    person.images = [null, null, null, null];
    const token = {};
    person.token = token;
    for (const direction of [SOUTH, NORTH, EAST, WEST]) {
      Promise.all(layers.map(([rsi, state, tint]) => layerCanvas(rsi, state, direction, tint).catch(e => {
        warn(e);
        return null;
      }))).then(canvases => {
        if (person.token !== token) return;
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        for (const layer of canvases) if (layer) ctx.drawImage(layer, 0, 0);
        person.images[direction] = tinted(canvas, PHOSPHOR);
      });
    }
  }

  /**
   * Draws a dressed person. (x, y) is the screen point under their feet (the sprite's bottom middle), or the
   * sprite's centre when centred (for top-down views). The sprite is 32 px drawn at scale, turned by rotation
   * radians about that point.
   */
  drawPerson(ctx, person, x, y, direction, scale, rotation = 0, centred = false, alpha = 1) {
    const image = person.images?.[direction];
    if (!image) return;
    const size = 32 * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.drawImage(image, -size / 2, centred ? -size / 2 : -size, size, size);
    ctx.restore();
  }

  // Drawing --------------------------------------------------------------------------------------------------------

  drawGame(ctx) {
    ctx.imageSmoothingEnabled = false;
    const stage = this.stages[this.stage];
    ctx.save();
    ctx.translate(this.offset.x, this.offset.y);
    stage.drawBack(ctx);
    this.drawDecals(ctx);
    stage.drawFront(ctx);
    this.drawParticles(ctx);
    this.drawPopups(ctx);
    if (this.flashLife > 0 && this.flashAge < this.flashLife) {
      fill(ctx, 0, HUD_HEIGHT, SCREEN_W, SCREEN_H - HUD_HEIGHT, this.flashColour, this.flashAlpha * (1 - this.flashAge / this.flashLife));
    }
    ctx.restore();
    stage.drawOverlay(ctx);
    let fade = 0;
    if (this.flow === Flow.FadeOut) fade = this.flowTime / FADE_TIME;
    else if (this.flow === Flow.FadeIn) fade = 1 - this.flowTime / FADE_TIME;
    if (fade > 0) fill(ctx, 0, HUD_HEIGHT, SCREEN_W, SCREEN_H - HUD_HEIGHT, BLACK, clamp(fade, 0, 1));
    this.drawHud(ctx, stage);
    this.drawCrt(ctx);
  }

  drawDecals(ctx) {
    const start = this.decalCount < MAX_DECALS ? 0 : this.decalNext;
    for (let i = 0; i < this.decalCount; i++) {
      const decal = this.decals[(start + i) % MAX_DECALS];
      const x = decal.x - this.camera.x;
      const y = decal.y - this.camera.y;
      if (x < -decal.size || x > SCREEN_W + decal.size || y < -decal.size || y > SCREEN_H + decal.size) continue;
      const half = decal.size / 2;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, decal.flat);
      ctx.rotate(decal.rotation);
      if (decal.acid) {
        // fresh acid is bright and darkens as it eats in
        const t = Math.min(1, decal.age / 4);
        this.stamp(ctx, ACID, decal.state, half, decal.alpha * (1 - t));
        this.stamp(ctx, DARK_ACID, decal.state, half, decal.alpha * t);
        if (decal.age < 2.5) this.stamp(ctx, ACID, decal.state, half, 0.5 * (1 - decal.age / 2.5));
      } else {
        this.stamp(ctx, decal.colour, decal.state, half, decal.alpha);
      }
      ctx.restore();
    }
  }

  stamp(ctx, colour, state, half, alpha) {
    const image = this.splatterFrame(state, colour);
    if (!image || alpha <= 0) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(image, -half, -half, half * 2, half * 2);
    ctx.globalAlpha = 1;
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      const alpha = p.alpha * clamp(1 - p.age / p.life, 0, 1);
      const x = p.x - this.camera.x;
      const y = p.y - this.camera.y;
      if (p.kind === SPARK) line(ctx, x, y, x - p.vx * 0.03, y - p.vy * 0.03, p.colour, alpha);
      else if (p.kind === SMOKE) circle(ctx, x, y, p.size, p.colour, alpha * 0.6);
      else fill(ctx, x - p.size / 2, y - p.size / 2, p.size, p.size, p.colour, alpha);
    }
  }

  drawPopups(ctx) {
    for (const popup of this.popups) {
      const progress = popup.age / popup.life;
      centreText(ctx, SMALL_FONT, popup.text, popup.x - this.camera.x, popup.y - this.camera.y - 18 * progress, popup.colour,
        clamp(2 - progress * 2, 0, 1));
    }
  }

  drawHud(ctx, stage) {
    fill(ctx, 0, 0, SCREEN_W, HUD_HEIGHT, HUD_COLOUR);
    fill(ctx, 0, HUD_HEIGHT - 1, SCREEN_W, 1, this.hudFlash > 0 && this.hudFlash % 0.2 > 0.1 ? BRIGHT : this.dim);
    const best = T.best(String(this.best).padStart(5, '0'));
    text(ctx, SMALL_FONT, best, SCREEN_W - 6 - textWidth(ctx, SMALL_FONT, best), 3, this.dim);

    const blink = this.clock % 1.1 < 0.75;
    if (this.flow === Flow.Attract) {
      centreText(ctx, BIG_FONT, T.title, SCREEN_W / 2, 62, this.green);
      if (this.focused && blink) centreText(ctx, TEXT_FONT, T.start, SCREEN_W / 2, 92, BRIGHT);
      centreText(ctx, SMALL_FONT, T.keys, SCREEN_W / 2, 108, this.dim);
      return;
    }
    if (this.flow === Flow.Over) {
      if (this.overTime < 0.15) return;
      const end = textWidth(ctx, BIG_FONT, this.endText) <= SCREEN_W - 16 ? BIG_FONT : CARD_FONT;
      centreText(ctx, end, this.endText, SCREEN_W / 2, 66, this.endColour);
      if (this.focused && this.overTime >= RESTART_DELAY && blink) centreText(ctx, TEXT_FONT, T.again, SCREEN_W / 2, 96, BRIGHT);
      return;
    }
    if (this.paused) {
      centreText(ctx, BIG_FONT, T.paused, SCREEN_W / 2, 80, this.green);
      return;
    }

    // the stage card, over the start of each stage
    if (this.flow === Flow.FadeOut || this.card <= 0) return;
    const alpha = clamp(this.card / 0.4, 0, 1);
    // a long title steps down a size rather than running off the screen
    const title = textWidth(ctx, BIG_FONT, stage.title) <= SCREEN_W - 16 ? BIG_FONT : CARD_FONT;
    centreText(ctx, title, stage.title, SCREEN_W / 2, 54, this.green, alpha);
    centreText(ctx, SMALL_FONT, stage.hint, SCREEN_W / 2, 80, BRIGHT, alpha);
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

