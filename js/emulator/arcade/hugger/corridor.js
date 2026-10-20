// The side-scrolling corridor the facehugger and larva stages run along, a port of Arcade/CMUHuggerRun.Corridor.cs:
// green phosphor colony scenery with parallax, a player creature at a fixed x that jumps (held for higher) and
// ducks, tracers fired down three lanes from off screen with laser-sight warnings, and humans (colonists, riflemen
// who aim, knifemen who stab) who walk in from the right. Subclasses pick the creature, what spawns, and what
// touching a human means.

import {
  HuggerStage, SCREEN_W, SCREEN_H, HUD_HEIGHT, SMOKE, SPARK, SOUTH, EAST, WEST, Key, Outfit, SIGN_FONT,
  BRIGHT, AMBER, ALARM, ACID, DARK_ACID, BLOOD, DARK_BLOOD, TRACER_CORE, TRACER_GLOW, DUST, LASER, GREEN, DIM, WHITE, BLACK,
  hash, hash01, clamp, moveTowards, normalize, pick, fill, outline, line, circle, ellipse, quad, beam, sprite, centreText,
} from './stage.js';

export const CEILING_Y = 40;
export const FLOOR_Y = 186;
export const PLAYER_X = 64;
const WALL_DEPTH = 0.85;
const OUTSIDE_DEPTH = 0.12;
const HILL_DEPTH = 0.22;
const PANEL_WIDTH = 64;

/** Humans are 32 px sprites at 3.3: about two thirds of the corridor, feet on the floor. */
export const HUMAN_SCALE = 3.3;

// human hit boxes, in units above the floor and either side of the feet, from the sprite at HUMAN_SCALE
export const HEAD_TOP = 96;
export const HEAD_BOTTOM = 69;
export const HEAD_HALF_WIDTH = 14;
export const BODY_TOP = 71;
export const BODY_HALF_WIDTH = 11;

const WARNING = 0.38;
const BULLET_SPEED = 330;
const BULLET_SPEED_PER_RUN = 0.5;
const MARINE_BULLET_SPEED = 360;
const BURST_GAP = 0.085;
const TRACER = 16;

const ALERT_RANGE = 130;
const MARINE_AIM = 0.45;
const MARINE_REACH = 80;
const MARINE_BACKPEDAL = 40;
export const KICK_TIME = 0.32;
export const STRUGGLE = 0.35;
export const FALL_TIME = 0.5;

// a knifeman winds up when the player comes in range, then stabs low in front of him for a moment
const STAB_RANGE = 100;
const WIND_UP_TIME = 0.32;
const STAB_TIME = 0.22;
const RECOVER_TIME = 0.7;
const STAB_REACH_NEAR = 8;
const STAB_REACH_FAR = 64;
const STAB_HEIGHT = 34;

/** How long the corridor takes to skid to a stop when the run halts, so the scene stays on screen. */
const STOP_TIME = 0.15;
const MAX_BULLETS = 32;
const MAX_SHOTS = 12;
const MAX_FLASHES = 8;
const MAX_HUMANS = 4;

export const RIFLE_SHOT = '/Audio/Weapons/Guns/Gunshots/m41.ogg';
const RICOCHET = '/Audio/_RMC14/Bullets/bullet_impact1.ogg';
export const SQUISH = '/Audio/Effects/Footsteps/meatslap.ogg';
const DISTANT_ROAR = '/Audio/_RMC14/Xeno/alien_distantroar_3.ogg';
export const BODY_FALL = '/Audio/CMU14/PersonalComputers/Games/fall.ogg';
const KNIFE_SWING = '/Audio/CMU14/PersonalComputers/Games/swoosh_2.ogg';
export const FLESH = [
  '/Audio/_RMC14/Bullets/impact_flesh_1.ogg', '/Audio/_RMC14/Bullets/impact_flesh_2.ogg',
  '/Audio/_RMC14/Bullets/impact_flesh_3.ogg', '/Audio/_RMC14/Bullets/impact_flesh_4.ogg',
];
const SIZZLES = [
  '/Audio/_RMC14/Xeno/acid_sizzle1.ogg', '/Audio/_RMC14/Xeno/acid_sizzle2.ogg',
  '/Audio/_RMC14/Xeno/acid_sizzle3.ogg', '/Audio/_RMC14/Xeno/acid_sizzle4.ogg',
];
export const HISSES = ['/Audio/_RMC14/Xeno/alien_hiss1.ogg', '/Audio/_RMC14/Xeno/alien_hiss2.ogg', '/Audio/_RMC14/Xeno/alien_hiss3.ogg'];
const SWOOSHES = [
  '/Audio/CMU14/PersonalComputers/Games/swoosh_1.ogg', '/Audio/CMU14/PersonalComputers/Games/swoosh_2.ogg',
  '/Audio/CMU14/PersonalComputers/Games/swoosh_3.ogg',
];
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
const CORRIDOR_SOUNDS = [
  RIFLE_SHOT, RICOCHET, SQUISH, DISTANT_ROAR, BODY_FALL, KNIFE_SWING,
  ...FLESH, ...SIZZLES, ...HISSES, ...SWOOSHES, ...STEPS, ...MALE_GASPS, ...FEMALE_GASPS, ...WHISTLES,
];

// scenery from the game's own sprites, multiplied down into the phosphor so the characters stay in front
export const STRUCTURES = '/Textures/_RMC14/Structures/';
export const METAL_WALL = '/Textures/_RMC14/Structures/Walls/metal.rsi';
export const REINFORCED_WALL = '/Textures/_RMC14/Structures/Walls/rwall.rsi';
export const PIPES = '/Textures/_RMC14/Structures/overhead_pipes.rsi';
export const GRATE = '/Textures/_RMC14/Structures/grate.rsi';
export const SCRUBBER = '/Textures/_RMC14/Structures/Piping/Atmospherics/vent_scrubber.rsi';
export const PLATING = '/Textures/_RMC14/Tiles/almayer/plating.png';
const FLOOR_TILE = '/Textures/_RMC14/Tiles/almayer/floor.png';
const CATWALK_TILE = '/Textures/_RMC14/Tiles/almayer/catwalk_tile.png';
const TUBE = '/Textures/_RMC14/Structures/Wallmounts/Lighting/light_tube.rsi';
const POSTERS = '/Textures/_RMC14/Structures/Wallmounts/posters.rsi';
const SIGNS = '/Textures/_RMC14/Structures/Wallmounts/semiotics.rsi';
const DISPLAY = '/Textures/_RMC14/Structures/Machines/status_display.rsi';
const COMPUTER = '/Textures/_RMC14/Structures/Machines/computer.rsi';
const INTERCOM = '/Textures/_RMC14/Structures/Wallmounts/intercom.rsi';
const EXTINGUISHER = '/Textures/_RMC14/Structures/Wallmounts/extinguisher_cabinet.rsi';
const CAMERA = '/Textures/_RMC14/Structures/Wallmounts/camera.rsi';
/** Doors are 32 px sprites at 3.4: a little taller than a person. */
const DOOR_SIZE = 109;
const DOORS = [
  '/Textures/_RMC14/Structures/Doors/Airlocks/maint_door.rsi', '/Textures/_RMC14/Structures/Doors/Airlocks/personal_door.rsi',
  '/Textures/_RMC14/Structures/Doors/Airlocks/secure_door.rsi', '/Textures/_RMC14/Structures/Doors/Airlocks/engi_door.rsi',
  '/Textures/_RMC14/Structures/Doors/Airlocks/medi_door.rsi', '/Textures/_RMC14/Structures/Doors/Airlocks/sec_door.rsi',
];
const CLOSETS = [
  '/Textures/_RMC14/Structures/Storage/Closets/green.rsi', '/Textures/_RMC14/Structures/Storage/Closets/red.rsi',
  '/Textures/_RMC14/Structures/Storage/Closets/standard.rsi', '/Textures/_RMC14/Structures/Storage/Closets/blue.rsi',
  '/Textures/_RMC14/Structures/Storage/Closets/yellow.rsi',
];
const CRATES = [
  '/Textures/_RMC14/Structures/Storage/Crates/ammo.rsi', '/Textures/_RMC14/Structures/Storage/Crates/basic.rsi',
  '/Textures/_RMC14/Structures/Storage/Crates/alpha.rsi',
];
const POSTER_STATES = ['safety_guidance', 'assault_rifle', 'proper_lifting', 'safety_goggles_1', 'the_future', 'remember_io', 'walkman', 'eat'];
const SIGN_STATES = ['biohazard', 'airlock', 'hazard', 'highvoltage', 'firehaz', 'escapepod', 'galley', 'cryo'];
/** The scenery tints: the wall darkest, the floor rows, and what hangs on the wall a little brighter. */
export const WALL_TINT = '#6A8A70';
export const FLOOR_FAR = '#607A66';
export const FLOOR_NEAR = '#7C9A82';
export const PROP_TINT = '#AAC8B0';

function panelKind(panel) {
  return hash(panel) % 16;
}

const WALL_COLOUR = '#04140A';
const CEILING_COLOUR = '#020D05';
const FLOOR_COLOUR = '#041309';
const SKY = '#010502';
const HILLS = '#0A2A12';

/** Strings the corridor shows (Games/hugger.ftl). */
const T = {
  contact: 'CONTACT!',
  signs: ['MED', 'SEC', 'ENG', 'HYDRO', 'CARGO', 'OPS'],
};

export const HumanState = {
  Walk: 0, Stand: 1, Alert: 2, Flee: 3, Aim: 4, WindUp: 5, Stab: 6, Recover: 7, Kick: 8, Latched: 9, Shot: 10, Down: 11,
};

export function hittable(human) {
  return human.active && human.state !== HumanState.Latched && human.state !== HumanState.Shot && human.state !== HumanState.Down;
}

export function inside(x, y, left, right, top, bottom) {
  // tracers are thin: a hair of slack so a grazing round still counts
  return x >= left - 1.5 && x <= right + 1.5 && y >= top - 1.5 && y <= bottom + 1.5;
}

export function overlap(left, right, top, bottom, otherLeft, otherRight, otherTop, otherBottom) {
  return left < otherRight && right > otherLeft && top < otherBottom && bottom > otherTop;
}

/** The M41A's muzzle on a rifleman facing west, from the sprite at HUMAN_SCALE. */
function barrel(x) {
  return { x: x - 43, y: FLOOR_Y - 51 };
}

function rotate(x, y, angle) {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

export class CorridorStage extends HuggerStage {
  // the player creature, in units: half its hit box width, its height standing and ducked, and its jump
  get halfWidth() { return 13; }
  get height() { return 25; }
  get duckHeight() { return 13; }
  get jumpVelocity() { return 400; }
  get gravity() { return 2400; }
  get holdGravity() { return 700; }
  get maxHold() { return 0.33; }
  get fastFallGravity() { return 5000; }
  get jumpBuffer() { return 0.1; }
  get startSpeed() { return 150; }
  get maxSpeed() { return 400; }
  get acceleration() { return 2.6; }
  get laneLow() { return FLOOR_Y - 7; }
  get laneMid() { return FLOOR_Y - 21; }
  get laneHigh() { return FLOOR_Y - 48; }

  get sounds() {
    return CORRIDOR_SOUNDS;
  }

  constructor(run) {
    super(run);
    this.humans = [];
    for (let i = 0; i < MAX_HUMANS; i++) this.humans.push({ active: false, person: {} });
    this.bullets = [];
    this.shots = [];
    this.flashes = [];
    this.warmScenery();
  }

  /** Starts loading the corridor's scenery sprites now, so they are there when it first scrolls by. */
  warmScenery() {
    const run = this.run;
    for (const wall of [METAL_WALL, REINFORCED_WALL]) run.frame(wall, 'full', SOUTH, 0, WALL_TINT);
    run.image(PLATING, WALL_TINT);
    for (const tint of [FLOOR_FAR, FLOOR_NEAR]) {
      run.image(FLOOR_TILE, tint);
      run.image(CATWALK_TILE, tint);
    }
    run.frame(PIPES, 'intact', EAST, 0, PROP_TINT);
    run.frame(PIPES, 'intact-supply', SOUTH, 0, PROP_TINT);
    run.frame(TUBE, 'tube1', SOUTH, 0, null);
    run.frame(TUBE, 'tube0', SOUTH, 0, PROP_TINT);
    for (const door of DOORS) run.frame(door, 'closed', SOUTH, 0, PROP_TINT);
    for (const closet of CLOSETS) {
      run.frame(closet, 'base', SOUTH, 0, PROP_TINT);
      run.frame(closet, 'closed', SOUTH, 0, PROP_TINT);
    }
    for (const crate of CRATES) run.frame(crate, 'closed', SOUTH, 0, PROP_TINT);
    for (const state of POSTER_STATES) run.frame(POSTERS, state, SOUTH, 0, PROP_TINT);
    for (const state of SIGN_STATES) run.frame(SIGNS, state, SOUTH, 0, PROP_TINT);
    for (const [rsi, state] of [[DISPLAY, 'redalert_framed'], [DISPLAY, 'default'], [COMPUTER, 'computer_generic'], [INTERCOM, 'intercom'],
      [EXTINGUISHER, 'extinguisher_closed'], [CAMERA, 'camera'], [SCRUBBER, 'on']]) run.frame(rsi, state, SOUTH, 0, PROP_TINT);
  }

  /** Whether the player is ducking: Down held while on the floor. */
  get ducking() {
    return this.run.held(Key.Down) && this.grounded;
  }

  /** The player is in control and things can still hit it. */
  get playing() {
    return !this.run.over && !this.run.attract && !this.halted;
  }

  enter() {
    this.scroll = 0;
    this.speed = this.startSpeed;
    this.time = 0;
    this.halted = false;
    this.stopRate = 0;
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.squash = 0;
    this.anim = 0;
    this.hold = 0;
    this.buffer = 0;
    this.dust = 0;
    this.corpse = false;
    this.corpseDown = false;
    this.corpseAt = { x: 0, y: 0 };
    this.corpseVelocity = { x: 0, y: 0 };
    this.corpseSpin = 0;
    this.corpseRotation = 0;
    this.sizzle = 0;
    this.bullets.length = 0;
    this.shots.length = 0;
    this.flashes.length = 0;
    this.ambient = 5;
    for (const human of this.humans) human.active = false;
  }

  onKey(input) {
    if (input.down && (input.key === Key.Up || input.key === Key.Action)) this.buffer = this.jumpBuffer;
  }

  /** Stops the run where it is: the corridor skids to a halt and nothing more spawns or hits. */
  halt() {
    this.halted = true;
    this.stopRate = Math.max(1, this.speed / STOP_TIME);
    this.shots.length = 0;
  }

  update(dt) {
    const run = this.run;
    if (run.attract) this.speed = 28;
    else if (this.halted || run.over) this.speed = Math.max(0, this.speed - this.stopRate * dt);
    else this.speed = Math.min(this.maxSpeed, this.speed + this.acceleration * dt);

    const moved = this.speed * dt;
    this.scroll += moved;
    run.camera = { x: this.scroll, y: 0 };
    const scurry = this.playing ? Math.max(1, this.speed / this.startSpeed) * (this.ducking ? 1.6 : 1) : 1;
    this.anim += dt * scurry;
    if (this.playing) {
      this.time += dt;
      run.addDistance(moved);
      this.movePlayer(dt);
      this.ambience(dt);
      this.spawnThreats(dt);
      this.fireQueued(dt);
    }

    this.moveBullets(dt);
    this.moveHumans(dt);
    this.moveCorpse(dt);
    this.updateStage(dt);
    if (this.playing) this.collide();
  }

  /** Spawns this stage's bullets, humans and obstacles. Called every step while playing. */
  spawnThreats(dt) {}

  /** Everything else the stage does each step, playing or not (scenes, obstacles). */
  updateStage(dt) {}

  /** The player's box touched a human: head when it met the head from above the shoulders. */
  onTouch(human, head) {}

  /** A knifeman's stab caught the player. */
  onStabbed(human) {}

  /** A tracer hit the player at screen point hit going dir. */
  onShot(hit, dir) {}

  /** Extra collisions the stage checks each step while playing (airlocks, vents). */
  collideStage(left, right, top, bottom) {}

  // The player -----------------------------------------------------------------------------------------------------

  movePlayer(dt) {
    const run = this.run;
    if (this.buffer > 0) this.buffer -= dt;
    const down = run.held(Key.Down);
    if (this.grounded) {
      if (this.buffer > 0 && !down) this.jump();
    } else {
      // holding the jump floats it higher for a moment; ducking in the air drops it like a stone
      let gravity = this.gravity;
      const held = run.held(Key.Up) || run.held(Key.Action);
      if (down) {
        gravity = this.fastFallGravity;
      } else if (held && this.vy > 0 && this.hold < this.maxHold) {
        gravity = this.holdGravity;
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
    run.emit(this.world(PLAYER_X - this.halfWidth, FLOOR_Y - 1), 1, DUST, 0.45, 30, 0.35, 1.6, Math.PI + 0.4, 0.8, -20, { kind: SMOKE });
  }

  jump() {
    this.grounded = false;
    this.vy = this.jumpVelocity;
    this.hold = 0;
    this.buffer = 0;
    this.squash = 1;
    this.run.playAny(SWOOSHES, -6, 1.1);
    this.run.emit(this.world(PLAYER_X - 4, FLOOR_Y - 1), 5, DUST, 0.6, 60, 0.4, 2, Math.PI, 1.2, -10, { kind: SMOKE });
  }

  land() {
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.squash = -1;
    this.run.playAny(STEPS, -12, 1.6);
    this.run.emit(this.world(PLAYER_X, FLOOR_Y - 1), 6, DUST, 0.6, 50, 0.45, 2, -Math.PI / 2, Math.PI, -10, { kind: SMOKE });
    if (this.buffer > 0 && !this.run.held(Key.Down)) this.jump();
  }

  /** The player's hit box on screen this step. */
  playerBox() {
    const bottom = FLOOR_Y - this.y;
    return {
      left: PLAYER_X - this.halfWidth,
      right: PLAYER_X + this.halfWidth,
      top: bottom - (this.ducking ? this.duckHeight : this.height),
      bottom,
    };
  }

  /** Width and height to draw the player sprite: squashed on landing, stretched on take-off, flattened ducking. */
  playerSize(size, duck = 0.55) {
    let w = size;
    let h = size;
    if (this.squash > 0) {
      w *= 1 - 0.14 * this.squash;
      h *= 1 + 0.22 * this.squash;
    } else if (this.squash < 0) {
      w *= 1 - 0.2 * this.squash;
      h *= 1 + 0.26 * this.squash;
    }
    if (this.ducking) {
      w *= 1.14;
      h *= duck;
    }
    return { w, h };
  }

  /** The nose-up/nose-down tilt of a jump, in radians: the creature keeps facing the way it runs. */
  jumpTilt() {
    if (this.grounded) return 0;
    return clamp(-this.vy / 1400, -0.3, 0.25);
  }

  // Fire -----------------------------------------------------------------------------------------------------------

  ambience(dt) {
    this.ambient -= dt;
    if (this.ambient > 0) return;
    this.ambient = 7 + Math.random() * 8;
    if (Math.random() < 0.3) {
      this.run.play(DISTANT_ROAR, -14, 0.9 + Math.random() * 0.2);
      return;
    }
    const shots = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < shots; i++) this.run.pend(i * 0.09, RIFLE_SHOT, -18, 0.78);
  }

  /** Queues a pattern of off-screen fire that gets nastier with time: singles, bursts, a low-then-mid pair. */
  firePattern() {
    const hard = clamp(this.time / 90, 0, 1);
    const roll = Math.random();
    if (this.time > 15 && roll < 0.25 + hard * 0.2) {
      this.queue(this.pickLane(), 3);
    } else if (this.time > 40 && roll < 0.55) {
      this.queue(this.laneLow, 1);
      this.queue(this.laneMid, 1, 0.3);
    } else {
      this.queue(this.pickLane(), 1);
    }
  }

  /** Seconds until the next pattern, shrinking with time; rate above 1 fires more often. */
  fireGap(rate = 1) {
    const hard = clamp(this.time / 90, 0, 1);
    return (1.55 - 0.7 * hard) * (0.8 + Math.random() * 0.6) / rate;
  }

  pickLane() {
    if (this.time < 10) return this.laneLow;
    const roll = Math.random();
    if (roll < 0.5) return this.laneLow;
    return roll < 0.8 || this.time < 20 ? this.laneMid : this.laneHigh;
  }

  /** Queues off-screen shots down a lane, each shown by its laser sight for WARNING seconds first. */
  queue(lane, count, delay = 0) {
    for (let i = 0; i < count && this.shots.length < MAX_SHOTS; i++) {
      this.shots.push({ delay: WARNING + delay + i * BURST_GAP, lane });
    }
  }

  get shotsQueued() {
    return this.shots.length > 0;
  }

  fireQueued(dt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const shot = this.shots[i];
      shot.delay -= dt;
      if (shot.delay > 0) continue;
      this.shots.splice(i, 1);
      this.addBullet(SCREEN_W + 4, shot.lane, -(BULLET_SPEED + this.speed * BULLET_SPEED_PER_RUN), 0);
      this.addFlash(SCREEN_W - 1, shot.lane);
      this.run.play(RIFLE_SHOT, -4, 0.95 + Math.random() * 0.1);
    }
  }

  addBullet(x, y, vx, vy) {
    if (this.bullets.length < MAX_BULLETS) this.bullets.push({ x, y, vx, vy });
  }

  addFlash(x, y) {
    if (this.flashes.length < MAX_FLASHES) this.flashes.push({ x, y, age: 0 });
  }

  /** Whether any tracer is still coming at the player. */
  bulletsAhead() {
    return this.bullets.some(b => b.x > PLAYER_X);
  }

  moveBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.y >= FLOOR_Y + 2) {
        // an aimed shot that missed sparks off the deck plating
        const world = this.world(bullet.x, FLOOR_Y + 2);
        this.run.emit(world, 7, AMBER, 1, 160, 0.3, 1, -Math.PI / 2 + Math.sign(bullet.vx) * 0.6, 1.2, 500, { floor: FLOOR_Y + 2, kind: SPARK });
        this.run.emit(world, 2, DUST, 0.5, 20, 0.5, 2, -Math.PI / 2, 1, -15, { kind: SMOKE });
        this.run.play(RICOCHET, -10, 1.1 + Math.random() * 0.2);
      } else if (bullet.x > -TRACER - 10 && bullet.y > HUD_HEIGHT) {
        continue;
      }
      this.bullets.splice(i, 1);
    }

    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].age += dt;
      if (this.flashes[i].age >= 0.07) this.flashes.splice(i, 1);
    }
  }

  // Humans ---------------------------------------------------------------------------------------------------------

  /** A human walks (or stands) in from the right. Null when all are in use. */
  spawnHuman(outfit, standing) {
    const human = this.humans.find(h => !h.active);
    if (!human) return null;
    this.run.dress(human.person, outfit);
    human.active = true;
    human.outfit = outfit;
    human.east = false;
    human.flees = false;
    human.infected = false;
    human.whistled = outfit !== Outfit.Colonist;
    human.shouted = false;
    human.timer = 0;
    human.step = Math.random() * 3;
    human.fall = 1;
    human.cooldown = 0;
    human.shots = 0;
    human.x = this.scroll + SCREEN_W + 60;
    human.state = standing || outfit === Outfit.Rifleman ? HumanState.Stand : HumanState.Walk;
    human.walk = human.state === HumanState.Walk ? 10 + Math.random() * 24 : 0;
    return human;
  }

  /** Whether a human who can still act is ahead of the player. */
  humanAhead() {
    return this.humans.some(h => h.active && h.x - this.scroll > PLAYER_X - 24 && hittable(h));
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
            if (Math.random() < 0.35) this.run.playAny(WHISTLES, -12);
          }
          this.notice(human, x);
          break;
        case HumanState.Stand:
          if (human.outfit === Outfit.Rifleman) this.watch(human, x, dt);
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
        case HumanState.WindUp:
          if (human.timer < WIND_UP_TIME) break;
          human.state = HumanState.Stab;
          human.timer = 0;
          this.run.play(KNIFE_SWING, -2, 0.9);
          break;
        case HumanState.Stab:
          if (human.timer < STAB_TIME) break;
          human.state = HumanState.Recover;
          human.timer = 0;
          break;
        case HumanState.Recover:
        case HumanState.Kick:
          if (human.timer < (human.state === HumanState.Kick ? KICK_TIME * 1.6 : RECOVER_TIME)) break;
          human.state = HumanState.Stand;
          human.timer = 0;
          break;
        case HumanState.Latched:
          if (human.timer >= STRUGGLE + FALL_TIME) this.fallen(human);
          break;
        case HumanState.Shot:
          if (human.timer >= FALL_TIME * 0.8) this.fallen(human);
          break;
      }
      if (x < -90 || (human.state === HumanState.Flee && x > SCREEN_W + 90)) human.active = false;
    }
  }

  /** A colonist who sees the player freezes with a gasp and may run; a knifeman closes in and winds up a stab. */
  notice(human, x) {
    if (!this.playing || x < PLAYER_X) return;
    if (human.outfit === Outfit.Knifeman) {
      if (x - PLAYER_X > STAB_RANGE || human.shouted) return;
      human.shouted = true;
      human.state = HumanState.WindUp;
      human.timer = 0;
      this.run.pop('!', this.world(x, FLOOR_Y - 116), ALARM, 0.6);
      return;
    }
    if (x - PLAYER_X > ALERT_RANGE) return;
    human.state = HumanState.Alert;
    human.timer = 0;
    human.flees = human.outfit === Outfit.Colonist && Math.random() < 0.45;
    this.run.pop('!', this.world(x, FLOOR_Y - 116), AMBER, 0.7);
    this.run.playAny(human.person.female ? FEMALE_GASPS : MALE_GASPS, -6);
  }

  /** A rifleman backs off and takes aim every second or so, until the player is too close to shoot. */
  watch(human, x, dt) {
    if (!this.playing) return;
    if (x < PLAYER_X + MARINE_REACH) {
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
    this.run.pop(T.contact, this.world(x, FLOOR_Y - 118), AMBER);
  }

  aim(human, x) {
    if (!this.playing || x < PLAYER_X + MARINE_REACH) {
      human.state = HumanState.Stand;
      human.timer = 0;
      return;
    }
    // the laser sight settles for a moment, then a three round burst at wherever the player is
    if (human.timer < MARINE_AIM + (3 - human.shots) * 0.09) return;
    const muzzle = barrel(x);
    const target = this.target();
    const dir = normalize(target.x - muzzle.x, target.y - muzzle.y);
    this.addBullet(muzzle.x, muzzle.y, dir.x * MARINE_BULLET_SPEED, dir.y * MARINE_BULLET_SPEED);
    this.addFlash(muzzle.x, muzzle.y);
    this.run.play(RIFLE_SHOT, 0, 0.95 + Math.random() * 0.1);
    this.run.emit(this.world(muzzle.x + 34, muzzle.y + 4), 1, AMBER, 1, 90, 1.2, 1.8, -Math.PI / 2 + 0.5, 0.6, 600, { floor: FLOOR_Y + 2 });
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

  /** Where marines aim: the middle of the player. */
  target() {
    return { x: PLAYER_X, y: FLOOR_Y - this.y - (this.ducking ? this.duckHeight : this.height) * 0.5 };
  }

  /** The body hits the floor. */
  fallen(human) {
    human.state = HumanState.Down;
    human.timer = 0;
    const x = human.x - this.scroll;
    this.run.play(BODY_FALL, -1, 0.95 + Math.random() * 0.1);
    this.run.emit(this.world(x + human.fall * 50, FLOOR_Y), 12, DUST, 0.5, 70, 0.6, 3.5, -Math.PI / 2, Math.PI, -10, { kind: SMOKE });
    this.run.shake(2.5, 0.25);
    if (!human.infected) this.run.splat({ x: human.x + human.fall * 36, y: FLOOR_Y + 6 }, 52, DARK_BLOOD, 0.9);
  }

  /** A round meant for the player hits whoever it passed: they scream and drop. */
  wounded(human, hx, hy, dir) {
    human.state = HumanState.Shot;
    human.timer = 0;
    human.fall = -1;
    const angle = Math.atan2(dir.y, dir.x);
    const hit = this.world(hx, hy);
    this.run.emit(hit, 24, BLOOD, 1, 180, 1.2, 2.2, angle, 1.6, 520, { floor: FLOOR_Y + 1, depth: 14, stains: true });
    this.run.emit(hit, 6, DARK_BLOOD, 1, 90, 1, 3, angle, 1.2, 520, { floor: FLOOR_Y + 1, depth: 14, stains: true });
    this.run.playAny(FLESH);
    this.run.scream(human.person.female, -2);
  }

  /** Where a standing human's face is on screen. */
  face(human) {
    return { x: human.x - this.scroll, y: FLOOR_Y - 82 };
  }

  // Collisions -----------------------------------------------------------------------------------------------------

  collide() {
    const { left, right, top, bottom } = this.playerBox();
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      const dir = normalize(bullet.vx, bullet.vy);
      const tailX = bullet.x - dir.x * TRACER;
      const tailY = bullet.y - dir.y * TRACER;
      if (inside(bullet.x, bullet.y, left, right, top, bottom) || inside((bullet.x + tailX) / 2, (bullet.y + tailY) / 2, left, right, top, bottom)
        || inside(tailX, tailY, left, right, top, bottom)) {
        this.bullets.splice(i, 1);
        this.onShot({ x: bullet.x, y: bullet.y }, dir);
        return;
      }

      // a round that got past the player can still find somebody behind it
      if (bullet.x >= PLAYER_X - 14) continue;
      for (const human of this.humans) {
        if (!hittable(human)) continue;
        const x = human.x - this.scroll;
        if (!inside(bullet.x, bullet.y, x - BODY_HALF_WIDTH, x + BODY_HALF_WIDTH, FLOOR_Y - HEAD_TOP, FLOOR_Y)) continue;
        this.bullets.splice(i, 1);
        this.wounded(human, bullet.x, bullet.y, dir);
        break;
      }
    }

    for (const human of this.humans) {
      if (!hittable(human)) continue;
      const x = human.x - this.scroll;
      if (human.state === HumanState.Stab
        && overlap(left, right, top, bottom, x - STAB_REACH_FAR, x - STAB_REACH_NEAR, FLOOR_Y - STAB_HEIGHT, FLOOR_Y)) {
        this.onStabbed(human);
        if (!this.playing) return;
      }
      if (overlap(left, right, top, bottom, x - HEAD_HALF_WIDTH, x + HEAD_HALF_WIDTH, FLOOR_Y - HEAD_TOP, FLOOR_Y - HEAD_BOTTOM)) {
        this.onTouch(human, true);
        if (!this.playing) return;
        continue;
      }
      if (overlap(left, right, top, bottom, x - BODY_HALF_WIDTH, x + BODY_HALF_WIDTH, FLOOR_Y - BODY_TOP, FLOOR_Y)) {
        this.onTouch(human, false);
        if (!this.playing) return;
      }
    }

    this.collideStage(left, right, top, bottom);
  }

  // Deaths ---------------------------------------------------------------------------------------------------------

  /**
   * The player bursts in acid where hit struck it (screen point) and its body tumbles away with velocity (world
   * units, up positive), landing in a pool. The run is lost with text.
   */
  killPlayer(hit, dir, velocity, spin, cry, text, acid = 40) {
    const run = this.run;
    const angle = Math.atan2(dir.y, dir.x);
    const at = this.world(hit.x, hit.y);
    this.corpse = true;
    this.corpseDown = false;
    this.corpseAt = { x: PLAYER_X + this.scroll, y: this.y + 8 };
    this.corpseVelocity = { x: velocity.x, y: velocity.y };
    this.corpseSpin = spin;
    const opts = { floor: FLOOR_Y + 1, depth: 14, stains: true, acid: true, inherit: this.speed * 0.2 };
    run.emit(at, acid, ACID, 1, 230, 1.1, 2.4, angle, 1.9, 620, opts);
    run.emit(at, Math.floor(acid / 3), DARK_ACID, 1, 140, 0.9, 3.2, angle, 1.2, 620, opts);
    run.emit(at, 12, ACID, 1, 280, 0.25, 1, angle + Math.PI, 1.4, 0, { kind: SPARK });
    run.emit(at, 6, ACID, 0.4, 30, 0.9, 3, -Math.PI / 2, 1.5, -20, { kind: SMOKE });
    run.play(cry);
    run.flash(ACID, 0.35, 0.3);
    run.shake(4.5, 0.4);
    run.slowMotion(0.45);
    this.halt();
    run.lose(text, ACID);
  }

  /** A tracer kills the player: knocked back the way the round was going. */
  shotDown(hit, dir, cry, text) {
    this.run.playAny(FLESH);
    this.killPlayer(hit, dir, { x: dir.x * 70, y: 170 + this.y * 0.5 }, -9, cry, text);
  }

  moveCorpse(dt) {
    if (!this.corpse) return;
    const run = this.run;
    if (!this.corpseDown) {
      this.corpseVelocity.y -= this.gravity * dt;
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
      run.emit({ x: this.corpseAt.x + (Math.random() - 0.5) * 28, y: FLOOR_Y + 3 }, 1, ACID, 0.35, 14, 1.1, 2.5, -Math.PI / 2, 0.6, -25, { kind: SMOKE });
    }
  }

  /** The dead creature hits the floor in a pool of its own acid. */
  splash() {
    const run = this.run;
    const x = this.corpseAt.x;
    run.splat({ x, y: FLOOR_Y + 5 }, 40, ACID, 0.9, 0.45, true);
    run.splat({ x: x - 16, y: FLOOR_Y + 10 }, 18, ACID, 0.85, 0.45, true);
    run.splat({ x: x + 14, y: FLOOR_Y + 2 }, 14, ACID, 0.85, 0.45, true);
    run.emit({ x, y: FLOOR_Y }, 18, ACID, 1, 140, 0.9, 1.8, -Math.PI / 2, 2.4, 600, { floor: FLOOR_Y + 1, depth: 14, stains: true, acid: true });
    run.emit({ x, y: FLOOR_Y }, 6, ACID, 0.4, 20, 1.2, 3, -Math.PI / 2, 1, -20, { kind: SMOKE });
    run.play(SQUISH, -2);
    run.playAny(SIZZLES, -3);
    run.shake(2.5, 0.25);
    this.sizzle = 2.4;
  }

  // Drawing --------------------------------------------------------------------------------------------------------

  /** Screen x to world, for spawning effects where something is on screen. */
  world(x, y) {
    return { x: x + this.scroll, y };
  }

  drawBack(ctx) {
    this.drawCeiling(ctx);
    this.drawWall(ctx);
    this.drawFloor(ctx);
    this.drawLights(ctx);
  }

  drawFront(ctx) {
    this.drawShadows(ctx);
    for (const human of this.humans) if (human.active) this.drawHuman(ctx, human);
    this.drawCorpse(ctx);
    if (!this.corpse) this.drawPlayer(ctx);
    this.drawFire(ctx);
    this.drawStreaks(ctx);
  }

  /** Draws the player creature with its feet at (PLAYER_X, FLOOR_Y - y). */
  drawPlayer(ctx) {}

  /** The player's body while it tumbles, and once it lies dead (a canvas from run.frame). */
  corpseImage(landed) {
    return null;
  }

  get corpseSize() {
    return 40;
  }

  /** Drawn on a latched host's face, at the same box as the host's sprite. Null for none. */
  faceMask(human, direction) {
    return null;
  }

  drawCeiling(ctx) {
    const run = this.run;
    fill(ctx, 0, HUD_HEIGHT, SCREEN_W, CEILING_Y - HUD_HEIGHT, CEILING_COLOUR);
    const u = this.scroll * WALL_DEPTH;
    const pipe = run.frame(PIPES, 'intact', EAST, 0, PROP_TINT);
    for (let c = Math.floor(u / 48); c * 48 - u < SCREEN_W; c++) sprite(ctx, pipe, c * 48 - u + 24, 28, 48, 48);
    fill(ctx, 0, CEILING_Y - 2, SCREEN_W, 2, DIM, 0.8);
    for (let c = Math.floor((u - 30) / 96); c * 96 + 30 - u < SCREEN_W; c++) {
      // a strip light on the ceiling: the tube sits in the bottom rows of its sprite
      const x = c * 96 + 30 - u;
      const on = this.lampOn(c);
      sprite(ctx, run.frame(TUBE, on ? 'tube1' : 'tube0', SOUTH, 0, on ? null : PROP_TINT), x + 13, CEILING_Y - 30, 64, 64);
    }
  }

  /** Most lamps burn steady; a few in every corridor stutter. */
  lampOn(lamp) {
    if (hash(lamp) % 6 !== 0) return true;
    const clock = this.run.clock;
    return Math.sin(clock * 13 + lamp) + Math.sin(clock * 7.3 + lamp * 2) > -0.6;
  }

  drawWall(ctx) {
    fill(ctx, 0, CEILING_Y, SCREEN_W, FLOOR_Y - CEILING_Y, WALL_COLOUR);
    const u = this.scroll * WALL_DEPTH;
    const first = Math.floor(u / PANEL_WIDTH) - 1;
    // the wall first and then what is on it, so a door wider than its panel is not covered by the next one
    for (let p = first; p * PANEL_WIDTH - u < SCREEN_W; p++) this.drawWallTiles(ctx, p, p * PANEL_WIDTH - u);
    for (let p = first; p * PANEL_WIDTH - u < SCREEN_W + PANEL_WIDTH; p++) this.drawPanel(ctx, p, p * PANEL_WIDTH - u);
  }

  /** Two colony wall blocks stacked up to a strip of deck plating at the foot of the wall. */
  drawWallTiles(ctx, panel, x) {
    const run = this.run;
    const tile = run.frame(hash01(panel, 11) < 0.3 ? REINFORCED_WALL : METAL_WALL, 'full', SOUTH, 0, WALL_TINT);
    sprite(ctx, tile, x + 32, CEILING_Y + 32, 64, 64);
    sprite(ctx, tile, x + 32, CEILING_Y + 96, 64, 64);
    const plate = run.image(PLATING, WALL_TINT);
    sprite(ctx, plate, x + 16, FLOOR_Y - 9, 32, 18);
    sprite(ctx, plate, x + 48, FLOOR_Y - 9, 32, 18);
    fill(ctx, x, FLOOR_Y - 18, PANEL_WIDTH, 1, DIM, 0.6);
  }

  /** What hangs on or stands against one panel of wall, picked by its hash, all the game's own sprites. */
  drawPanel(ctx, panel, x) {
    const run = this.run;
    const h = hash(panel);
    const kind = panelKind(panel);
    // a door spills onto the panels either side, so they stay bare
    if ((kind !== 9 && (panelKind(panel - 1) === 9 || panelKind(panel + 1) === 9)) || (kind === 9 && panelKind(panel - 1) === 9)) return;
    const frame = Math.floor(run.clock / 0.12);
    switch (kind) {
      case 0:
        sprite(ctx, run.frame(POSTERS, POSTER_STATES[(h >>> 8) % POSTER_STATES.length], SOUTH, 0, PROP_TINT), x + 32, 84, 52, 52);
        return;
      case 1:
        sprite(ctx, run.frame(EXTINGUISHER, 'extinguisher_closed', SOUTH, 0, PROP_TINT), x + 32, 122, 48, 48);
        return;
      case 2:
        sprite(ctx, run.frame(INTERCOM, 'intercom', SOUTH, frame, PROP_TINT), x + 24, 104, 44, 44);
        sprite(ctx, run.frame(CAMERA, 'camera', SOUTH, Math.floor(frame / 2), PROP_TINT), x + 44, 60, 44, 44);
        return;
      case 3:
        // a crate stood against the wall; its sprite's bottom edge is 26 px down
        sprite(ctx, run.frame(CRATES[(h >>> 8) % CRATES.length], 'closed', SOUTH, 0, PROP_TINT), x + 32, FLOOR_Y - 1 - 10 * 2.2, 70, 70);
        return;
      case 4:
        sprite(ctx, run.frame(SIGNS, SIGN_STATES[(h >>> 8) % SIGN_STATES.length], SOUTH, 0, PROP_TINT), x + 36, 80, 48, 48);
        return;
      case 5:
      case 6:
        sprite(ctx, run.frame(SCRUBBER, 'on', SOUTH, frame, PROP_TINT), x + 32, 130, 52, 52);
        return;
      case 7:
      case 8:
        // window onto the colony outside
        fill(ctx, x + 8, 52, 48, 56, BLACK);
        this.drawOutside(ctx, x + 10, 54, 44, 52);
        fill(ctx, x + 31.5, 54, 1, 52, DIM, 0.6);
        outline(ctx, x + 8, 52, 48, 56, DIM);
        quad(ctx, x + 14, 54, x + 20, 54, x + 12, 70, x + 10, 70, GREEN, 0.06);
        return;
      case 9:
        // an airlock door, a little taller than a person
        sprite(ctx, run.frame(DOORS[(h >>> 10) % DOORS.length], 'closed', SOUTH, 0, PROP_TINT), x + 32, FLOOR_Y - DOOR_SIZE / 2, DOOR_SIZE, DOOR_SIZE);
        return;
      case 10:
        sprite(ctx, run.frame(DISPLAY, (h >>> 8) % 2 === 0 ? 'redalert_framed' : 'default', SOUTH, frame, PROP_TINT), x + 32, 76, 56, 56);
        return;
      case 11:
        // a console against the wall
        sprite(ctx, run.frame(COMPUTER, 'computer_generic', SOUTH, Math.floor(frame / 4), PROP_TINT), x + 32, FLOOR_Y - 1 - 38.5, 77, 77);
        return;
      case 12: {
        // pipes down the wall, and a valve
        const riser = run.frame(PIPES, 'intact-supply', SOUTH, 0, PROP_TINT);
        for (let y = CEILING_Y; y < FLOOR_Y - 18; y += 48) sprite(ctx, riser, x + 24, y + 24, 48, 48);
        circle(ctx, x + 24, 98, 7, AMBER, 0.8, false);
        line(ctx, x + 17, 98, x + 31, 98, AMBER, 0.7);
        line(ctx, x + 24, 91, x + 24, 105, AMBER, 0.7);
        return;
      }
      case 13: {
        // a locker: its body, then its closed door; the body's bottom edge is 30 px down
        const closet = CLOSETS[(h >>> 8) % CLOSETS.length];
        const y = FLOOR_Y - 1 - 14 * 3.2;
        sprite(ctx, run.frame(closet, 'base', SOUTH, 0, PROP_TINT), x + 32, y, 102, 102);
        sprite(ctx, run.frame(closet, 'closed', SOUTH, 0, PROP_TINT), x + 32, y, 102, 102);
        return;
      }
      case 14:
        // somebody already died here
        sprite(ctx, run.splatterFrame((h >>> 9) % 6, DARK_BLOOD), x + 32, 138, 30, 30, ((h >>> 12) % 628) / 100, 0.65);
        fill(ctx, x + 30, 148, 1.5, 14, DARK_BLOOD, 0.5);
        fill(ctx, x + 36, 146, 1, 9, DARK_BLOOD, 0.45);
        return;
      case 15:
        // a department sign
        fill(ctx, x + 12, 66, 40, 14, BLACK);
        outline(ctx, x + 12, 66, 40, 14, GREEN, 0.8);
        centreText(ctx, SIGN_FONT, T.signs[(h >>> 8) % T.signs.length], x + 32, 69, GREEN);
        return;
    }
  }

  /** The colony outside a window: stars, rain and hills, far enough away to crawl past. */
  drawOutside(ctx, x, y, width, height) {
    const clock = this.run.clock;
    fill(ctx, x, y, width, height, SKY);
    const cell = 11;
    const u = this.scroll * OUTSIDE_DEPTH;
    const last = Math.floor((x + width + u) / cell);
    for (let c = Math.floor((x + u) / cell); c <= last; c++) {
      for (let k = 0; k < 2; k++) {
        const sx = c * cell + hash01(c, k * 2 + 1) * cell - u;
        if (sx < x + 1 || sx > x + width - 2) continue;
        const sy = y + 2 + hash01(c, k * 2 + 2) * height * 0.6;
        const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(clock * (1 + hash01(c, 9) * 3) + c));
        fill(ctx, sx, sy, 1, 1, GREEN, (0.2 + 0.6 * hash01(c, k + 5)) * twinkle);
      }
    }
    const hills = this.scroll * HILL_DEPTH;
    for (let cx = x; cx < x + width; cx += 2) {
      const i = Math.floor((cx + hills) / 18);
      let f = (cx + hills) / 18 - i;
      f = f * f * (3 - 2 * f);
      const a = hash01(i, 3);
      const r = 6 + 16 * (a + (hash01(i + 1, 3) - a) * f);
      fill(ctx, cx, y + height - r, Math.min(2, x + width - cx), r, HILLS);
    }
    for (let k = 0; k < 5; k++) {
      const rx = x + (k * 9.7 + clock * 14) % width;
      const ry = y + (k * 23 + clock * 120) % (height - 6);
      line(ctx, rx, ry, Math.max(x, rx - 2), ry + 5, GREEN, 0.18);
    }
  }

  drawFloor(ctx) {
    const run = this.run;
    fill(ctx, 0, FLOOR_Y, SCREEN_W, SCREEN_H - FLOOR_Y, FLOOR_COLOUR);
    // two rows of deck plates seen at a slant, the near row lighter and offset half a plate
    for (let row = 0; row < 2; row++) {
      const offset = row * 20;
      const y = FLOOR_Y + 1 + row * 19;
      const tint = row === 0 ? FLOOR_FAR : FLOOR_NEAR;
      const floor = run.image(FLOOR_TILE, tint);
      const catwalk = run.image(CATWALK_TILE, tint);
      for (let c = Math.floor((this.scroll + offset) / 40) - 1; c * 40 - this.scroll - offset < SCREEN_W; c++) {
        const x = c * 40 - this.scroll - offset;
        sprite(ctx, hash(c * 2 + row) % 7 === 0 ? catwalk : floor, x + 20, y + 9.5, 40, 19);
      }
    }
    fill(ctx, 0, FLOOR_Y, SCREEN_W, 1.5, GREEN, 0.65);
    fill(ctx, 0, FLOOR_Y + 1.5, SCREEN_W, 3, BLACK, 0.35);
  }

  drawLights(ctx) {
    const u = this.scroll * WALL_DEPTH;
    for (let c = Math.floor((u - 30) / 96) - 1; c * 96 + 30 - u < SCREEN_W + 40; c++) {
      if (!this.lampOn(c)) continue;
      const x = c * 96 + 30 - u;
      quad(ctx, x + 2, CEILING_Y - 3, x + 24, CEILING_Y - 3, x + 62, FLOOR_Y + 14, x - 36, FLOOR_Y + 14, GREEN, 0.035);
      ellipse(ctx, x + 13, FLOOR_Y + 9, 40, 6, GREEN, 0.05);
    }
  }

  drawShadows(ctx) {
    for (const human of this.humans) {
      if (!human.active) continue;
      const x = human.x - this.scroll;
      if (human.state === HumanState.Down) ellipse(ctx, x + human.fall * 46, FLOOR_Y + 3, 50, 5, BLACK, 0.45);
      else ellipse(ctx, x, FLOOR_Y + 1, 18, 4, BLACK, 0.45);
    }
    if (!this.corpse && !this.halted) {
      const lift = Math.min(this.y, 120) / 120;
      ellipse(ctx, PLAYER_X, FLOOR_Y + 1, (this.halfWidth + 3) * (1 - lift * 0.45), 3.5, BLACK, 0.45 * (1 - lift * 0.6));
    }
    if (this.corpse) ellipse(ctx, this.corpseAt.x - this.scroll, FLOOR_Y + 1, this.halfWidth, 3, BLACK, 0.45);
  }

  drawHuman(ctx, human) {
    const x = human.x - this.scroll;
    if (x < -90 || x > SCREEN_W + 90) return;
    const { rotation, lean, bob } = this.pose(human);
    const direction = human.east ? EAST : WEST;
    const fx = x + lean;
    const fy = FLOOR_Y - bob;
    this.run.drawPerson(ctx, human.person, fx, fy, direction, HUMAN_SCALE, rotation);
    if (human.outfit === Outfit.Knifeman && (human.state === HumanState.WindUp || human.state === HumanState.Stab)) {
      this.drawKnife(ctx, human, fx, fy);
    }
    const mask = this.faceMask(human, direction);
    if (!mask) return;
    // the mask is drawn in the host's own box, so it turns with the body
    const centre = rotate(0, -HUMAN_SCALE * 16, rotation);
    sprite(ctx, mask, fx + centre.x, fy + centre.y, 32 * HUMAN_SCALE, 32 * HUMAN_SCALE, rotation);
  }

  /** The bayonet raised overhead on the wind-up, then driven down and forward along the floor on the stab. */
  drawKnife(ctx, human, fx, fy) {
    const knife = this.run.knifeIcon;
    if (human.state === HumanState.WindUp) {
      const k = human.timer / WIND_UP_TIME;
      const ax = fx - 6 + 10 * k;
      const ay = fy - 78 - 10 * k;
      sprite(ctx, knife, ax, ay, 30, 30, -2.2 - k * 0.6);
      if (this.run.clock % 0.16 < 0.08) circle(ctx, ax - 6, ay - 8, 2.5, WHITE, 0.8);
      return;
    }
    const t = clamp(human.timer / STAB_TIME, 0, 1);
    const tx = fx - STAB_REACH_NEAR - (STAB_REACH_FAR - STAB_REACH_NEAR) * t;
    const ty = fy - STAB_HEIGHT + 18 * t;
    sprite(ctx, knife, tx + 10, ty - 6, 30, 30, 0.6);
    beam(ctx, fx - 6, fy - 70, tx, ty, 3, WHITE, 0.35 * (1 - t));
  }

  /** How a human stands this frame: rotation about the feet in radians, a sideways lean and a bob, in units. */
  pose(human) {
    let rotation = 0;
    let lean = 0;
    let bob = 0;
    switch (human.state) {
      case HumanState.Walk:
        bob = Math.abs(Math.sin(human.step)) * 3;
        break;
      case HumanState.Flee:
        bob = Math.abs(Math.sin(human.step)) * 4;
        rotation = 0.12;
        break;
      case HumanState.Stand:
      case HumanState.Aim:
        bob = human.outfit === Outfit.Rifleman && this.playing
          ? Math.abs(Math.sin(human.step)) * 2.5
          : 0.8 + Math.sin(this.run.clock * 2 + human.x) * 0.8;
        break;
      case HumanState.Alert:
        lean = (Math.random() - 0.5) * 2;
        rotation = 0.06;
        break;
      case HumanState.WindUp:
        rotation = 0.12 * human.timer / WIND_UP_TIME;
        break;
      case HumanState.Stab: {
        const stab = clamp(human.timer / STAB_TIME, 0, 1);
        rotation = 0.12 - 0.4 * stab;
        lean = -14 * stab;
        break;
      }
      case HumanState.Recover: {
        const back = 1 - clamp(human.timer / RECOVER_TIME, 0, 1);
        rotation = -0.28 * back;
        lean = -14 * back;
        break;
      }
      case HumanState.Kick: {
        const kick = Math.sin(Math.min(1, human.timer / KICK_TIME) * Math.PI);
        rotation = (human.east ? 0.18 : -0.18) * kick;
        lean = (human.east ? 5 : -8) * kick;
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
        bob = -10 * fall * fall;
        break;
      }
      case HumanState.Shot: {
        const drop = clamp(human.timer / (FALL_TIME * 0.8), 0, 1);
        rotation = human.fall * Math.PI / 2 * drop * drop;
        bob = -10 * drop * drop;
        break;
      }
      case HumanState.Down:
        rotation = human.fall * Math.PI / 2 + this.twitch(human);
        bob = -10;
        break;
    }
    return { rotation, lean, bob };
  }

  /** The small jerks of a body on the floor; stages can make a host twitch harder. */
  twitch(human) {
    return human.timer < 1.5 ? Math.sin(human.timer * 50) * 0.025 * (1 - human.timer / 1.5) : 0;
  }

  drawCorpse(ctx) {
    if (!this.corpse) return;
    const x = this.corpseAt.x - this.scroll;
    const feet = FLOOR_Y - this.corpseAt.y;
    const size = this.corpseSize;
    sprite(ctx, this.corpseImage(this.corpseDown), x, feet - size / 2 + size * 0.06, size, size, this.corpseDown ? 0 : this.corpseRotation);
  }

  /** Laser sights on the lanes about to be fired down, riflemen's aim, tracers and muzzle flashes. */
  drawFire(ctx) {
    const clock = this.run.clock;
    this.shots.forEach((shot, i) => {
      if (shot.delay >= WARNING) return;
      const k = 1 - shot.delay / WARNING;
      const flicker = 0.75 + 0.25 * Math.sin(clock * 60 + i);
      fill(ctx, SCREEN_W - 90 * k, shot.lane - 0.5, 90 * k, 1, LASER, 0.3 * k * flicker);
      circle(ctx, SCREEN_W - 1, shot.lane, 2 + 7 * k, TRACER_GLOW, (0.15 + 0.35 * k) * flicker);
    });

    for (const human of this.humans) {
      if (!human.active || human.state !== HumanState.Aim || !this.playing) continue;
      const muzzle = barrel(human.x - this.scroll);
      const target = this.target();
      const aim = Math.min(1, human.timer / MARINE_AIM);
      line(ctx, muzzle.x, muzzle.y, muzzle.x + (target.x - muzzle.x) * aim, muzzle.y + (target.y - muzzle.y) * aim,
        LASER, clamp(0.35 + 0.3 * Math.sin(clock * 50), 0, 1));
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

  /** Speed lines once the run gets going. */
  drawStreaks(ctx) {
    if (!this.playing || this.speed < 250) return;
    const alpha = (this.speed - 250) / (this.maxSpeed - 250) * 0.18;
    const cell = 70;
    const u = this.scroll * 1.25;
    for (let c = Math.floor(u / cell); c * cell - u < SCREEN_W; c++) {
      if ((hash(c) & 3) !== 0) continue;
      const x = c * cell - u + hash01(c, 1) * cell;
      fill(ctx, x, 50 + hash01(c, 2) * 120, 20 + hash01(c, 3) * 40, 1, BRIGHT, alpha);
    }
  }
}

