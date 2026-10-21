// The side-scrolling corridor the facehugger and larva stages run along, a port of Arcade/CMUHuggerRun.Corridor.cs:
// green phosphor colony scenery with parallax, a player creature at a fixed x that jumps (held for higher) and
// ducks, tracers fired down three lanes from off screen with laser-sight warnings, and humans (colonists, riflemen
// who aim, knifemen who stab) who walk in from the right. Subclasses pick the creature, what spawns, and what
// touching a human means.

import {
  HuggerStage, SCREEN_W, SCREEN_H, HUD_HEIGHT, SMOKE, SPARK, SOUTH, EAST, WEST, Key, Outfit, SIGN_FONT,
  BRIGHT, AMBER, ALARM, ACID, DARK_ACID, BLOOD, DARK_BLOOD, TRACER_CORE, TRACER_GLOW, DUST, LASER, GREEN, DIM, WHITE, BLACK,
  TAU, hash, hash01, clamp, moveTowards, normalize, pick, fill, outline, line, circle, ellipse, quad, beam, sprite, centreText,
} from './stage.js';

export const CEILING_Y = 40;
export const FLOOR_Y = 186;
export const PLAYER_X = 64;
// the wall scrolls with the deck, so hazards on the deck can be lined up with bare wall; the windows give depth
const WALL_DEPTH = 1;
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
export const MARINE_BACKPEDAL = 40;

// locker traps: the tell starts this many seconds before the player gets there and lasts this long before the door goes
const MAX_LOCKERS = 2;
const LOCKER_TELL_ETA = 1.6;
const LOCKER_TELL = 0.55;
// a shotgunner braces, then blasts a spread of short-range pellets into one band: low is jumped, high is ducked
const SHOTGUN_BRACE = 0.4;
const SHOTGUN_PUMP_TIME = 0.65;
const SHOTGUN_RANGE = 230;
const SHOTGUN_CLOSEST = 70;
const SHOTGUN_PELLETS = 6;
const SHOTGUN_SPEED = 420;
const SHOTGUN_LOW = [2, 14];
const SHOTGUN_HIGH = [17, 52];

// the demo bot's reactions: a reaction time drawn per threat, the odd fumble, and how it times and holds its jumps
const BOT_REACT_MIN = 0.14;
const BOT_REACT_SPREAD = 0.16;
const BOT_FUMBLE = 0.05;
const BOT_FUMBLE_LATE = 0.2;
const BOT_LEAD = 0.17;
const BOT_TAP = 0.07;
const BOT_LONG_HOLD = 0.24;

/** A threat's reaction time, from its own random draw: a human beat, and now and then a fumble. */
export function botReaction(seed) {
  return BOT_REACT_MIN + seed * BOT_REACT_SPREAD + (seed < BOT_FUMBLE ? BOT_FUMBLE_LATE : 0);
}
export const KICK_TIME = 0.32;
export const STRUGGLE = 0.35;
export const FALL_TIME = 0.5;

// a knifeman winds up when the player comes in range, then stabs low in front of him for a moment
const STAB_RANGE = 100;
const WIND_UP_TIME = 0.32;
const STAB_TIME = 0.22;
const RECOVER_TIME = 0.7;
const STAB_REACH_NEAR = 8;
export const STAB_REACH_FAR = 64;
const STAB_HEIGHT = 34;

/** How long the corridor takes to skid to a stop when the run halts, so the scene stays on screen. */
const STOP_TIME = 0.15;
const MAX_BULLETS = 32;
const MAX_SHOTS = 12;
const MAX_FLASHES = 8;
const MAX_HUMANS = 4;

export const RIFLE_SHOT = '/Audio/Weapons/Guns/Gunshots/m41.ogg';
const SHOTGUN = '/Audio/_RMC14/Weapons/Guns/Gunshots/gun_shotgun.ogg';
const SHOTGUN_PUMP = '/Audio/_RMC14/Weapons/Guns/Pump/shotgunpump1.ogg';
const LOCKER_OPEN = '/Audio/Effects/closetopen.ogg';
const RATTLES = ['/Audio/Effects/fence_rattle1.ogg', '/Audio/Effects/fence_rattle2.ogg', '/Audio/Effects/fence_rattle3.ogg'];
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
  RIFLE_SHOT, RICOCHET, SQUISH, DISTANT_ROAR, BODY_FALL, KNIFE_SWING, SHOTGUN, SHOTGUN_PUMP, LOCKER_OPEN, ...RATTLES,
  ...FLESH, ...SIZZLES, ...HISSES, ...SWOOSHES, ...STEPS, ...MALE_GASPS, ...FEMALE_GASPS, ...WHISTLES,
];

// The corridor is drawn as one side-view composition rather than tiled sprites: from the top, a ceiling girder with
// strip lights, a service band of pipes, the main wall of bevelled riveted plates, a handrail, a ribbed lower wall,
// the skirting and the deck, with foreground railings at the bottom edge. Its palette is the six greys of the game's
// metal wall sprite (Walls/metal.rsi), pulled into the phosphor. Doors, lockers, consoles, crates, signs and vents
// are the game's own sprites, placed sparingly at sensible heights.
export const SCRUBBER = '/Textures/_RMC14/Structures/Piping/Atmospherics/vent_scrubber.rsi';
const FLOOR_TILE = '/Textures/_RMC14/Tiles/almayer/floor.png';
const CATWALK_TILE = '/Textures/_RMC14/Tiles/almayer/catwalk_tile.png';
const POSTERS = '/Textures/_RMC14/Structures/Wallmounts/posters.rsi';
const SIGNS = '/Textures/_RMC14/Structures/Wallmounts/semiotics.rsi';
const DISPLAY = '/Textures/_RMC14/Structures/Machines/status_display.rsi';
const COMPUTER = '/Textures/_RMC14/Structures/Machines/computer.rsi';
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

/** The metal wall sprite's greys, pulled into the phosphor: outline, dark, mid, main, light, highlight, and a rim for trims. */
export const OUTLINE = '#0E160F';
export const DARK = '#152018';
export const MID = '#1B2A1F';
export const MAIN = '#223427';
const MAIN_SHADE = '#1F3024';
export const LIGHT = '#283C2C';
export const HIGH = '#33503A';
export const RIM = '#4C7A56';
const TUBE_LIT = '#DFFFE6';
/** Furniture is multiplied by this: dimmer than the characters, so they stay in front. */
export const PROP_TINT = '#8EAE94';
export const FLOOR_FAR = '#4E6654';
export const FLOOR_NEAR = '#647E6A';

// the wall's bands, top to bottom
const SERVICE_TOP = 40;
const WALL_TOP = 62;
const PLATE_TOP = 66;
const RAIL_Y = 148;
const LOWER_TOP = 156;
const SKIRT_TOP = 172;
const FOREGROUND_DEPTH = 1.35;

/** What stands at a panel, from its hash: most panels are bare, and no two neighbours both carry something. */
function furniture(panel) {
  const kind = hash(panel) % 100;
  // at least two bare panels between any two pieces, so nothing crowds anything else
  if (kind >= 59 || hash(panel - 1) % 100 < 59 || hash(panel - 2) % 100 < 59) return -1;
  return kind;
}

const SKY = '#010502';
const HILLS = '#0A2A12';

/** Strings the corridor shows (Games/hugger.ftl). */
const T = {
  contact: 'CONTACT!',
  signs: ['MED', 'SEC', 'ENG', 'HYDRO', 'CARGO', 'OPS'],
};

/** What a locker trap holds, and how far along it is. */
export const LockerContent = { Empty: 0, Marine: 1, Colonist: 2 };
const LockerState = { Shut: 0, Tell: 1, Open: 2 };

export const HumanState = {
  Walk: 0, Stand: 1, Alert: 2, Flee: 3, Aim: 4, WindUp: 5, Stab: 6, Recover: 7, Kick: 8, Latched: 9, Shot: 10, Down: 11, Brace: 12, Pump: 13,
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
    this.lockers = [];
    this.warmScenery();
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
    this.lockers.length = 0;
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
    this.moveLockers(dt);
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

  /** A tracer or pellet in flight; life is how long it lasts (pellets are short range). */
  addBullet(x, y, vx, vy, life = Infinity) {
    if (this.bullets.length < MAX_BULLETS) this.bullets.push({ x, y, vx, vy, life, age: 0, seed: Math.random() });
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
      bullet.life -= dt;
      bullet.age += dt;
      if (bullet.life <= 0) {
        // a pellet at the end of its range
        this.run.emit(this.world(bullet.x, bullet.y), 2, DUST, 0.4, 10, 0.3, 1.5, 0, TAU, -10, { kind: SMOKE });
      } else if (bullet.y >= FLOOR_Y + 2) {
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

  // Locker traps ---------------------------------------------------------------------------------------------------

  /**
   * A wall locker on the deck ahead that may hold somebody: as the player nears it rattles, the door shifts and,
   * if someone is inside, eyes glint in its slats; then it bursts open. mix gives the odds of what is inside:
   * { marine, colonist } (the rest are empty).
   */
  spawnLocker(mix) {
    if (this.lockers.length >= MAX_LOCKERS) return;
    const roll = Math.random();
    const content = roll < mix.marine ? LockerContent.Marine : roll < mix.marine + mix.colonist ? LockerContent.Colonist : LockerContent.Empty;
    const x = this.bareSlot(this.scroll + SCREEN_W + 50);
    this.lockers.push({ x, content, closet: CLOSETS[Math.floor(Math.random() * CLOSETS.length)], state: LockerState.Shut, timer: 0 });
  }

  /** Whether a locker that has not burst yet is ahead of the player. */
  lockerAhead() {
    return this.lockers.some(l => l.state !== LockerState.Open && l.x - this.scroll > PLAYER_X - 30);
  }

  /**
   * The world x of the middle of the first bare stretch of wall at or after x: a panel with no furniture on it or
   * on the two either side, so hazards never land near a door, a locker or a sign.
   */
  bareSlot(x) {
    let panel = Math.floor(x / PANEL_WIDTH);
    while ([-2, -1, 0, 1, 2].some(k => furniture(panel + k) >= 0)) panel++;
    return panel * PANEL_WIDTH + PANEL_WIDTH / 2;
  }

  moveLockers(dt) {
    for (let i = this.lockers.length - 1; i >= 0; i--) {
      const locker = this.lockers[i];
      locker.timer += dt;
      const x = locker.x - this.scroll;
      if (x < -90) {
        this.lockers.splice(i, 1);
        continue;
      }
      if (locker.state === LockerState.Shut && this.playing && (x - PLAYER_X) / Math.max(1, this.speed) < LOCKER_TELL_ETA) {
        locker.state = LockerState.Tell;
        locker.timer = 0;
        this.run.playAny(RATTLES, locker.content === LockerContent.Empty ? -8 : -3);
      } else if (locker.state === LockerState.Tell && locker.timer >= LOCKER_TELL) {
        this.openLocker(locker, x);
      }
    }
  }

  /** The locker door bangs open on whatever was inside. */
  openLocker(locker, x) {
    const run = this.run;
    locker.state = LockerState.Open;
    locker.timer = 0;
    run.play(LOCKER_OPEN, locker.content === LockerContent.Empty ? -6 : 2, locker.content === LockerContent.Empty ? 0.8 : 1);
    if (locker.content === LockerContent.Empty) return;
    run.shake(1.5, 0.2);
    run.emit(this.world(x + 14, FLOOR_Y - 50), 8, DUST, 0.5, 50, 0.6, 3, 0, 1.6, -10, { kind: SMOKE });
    const human = this.spawnHuman(locker.content === LockerContent.Marine ? Outfit.Shotgunner : Outfit.Colonist, true);
    if (!human) return;
    human.x = locker.x + 6;
    human.timer = 0;
    human.shouted = true;
    human.whistled = true;
    if (locker.content === LockerContent.Marine) {
      // out he steps, shotgun up
      human.state = HumanState.Brace;
      human.high = Math.random() < 0.5;
      run.pop('!', this.world(x, FLOOR_Y - 116), ALARM, 0.6);
      return;
    }
    human.state = HumanState.Flee;
    human.east = true;
    human.flees = true;
    run.scream(human.person.female, 0);
  }

  /** A shotgunner braces, shows where the blast will go, then fires a spread of pellets and pumps another round. */
  brace(human, x, dt) {
    // too close to level the gun at something underfoot
    if (!this.playing || x < PLAYER_X + SHOTGUN_CLOSEST) {
      human.state = HumanState.Stand;
      human.timer = 0;
      return;
    }
    if (human.timer < SHOTGUN_BRACE || x - PLAYER_X > SHOTGUN_RANGE) return;
    const run = this.run;
    const muzzle = { x: x - 46, y: FLOOR_Y - 51 };
    const band = human.high ? SHOTGUN_HIGH : SHOTGUN_LOW;
    for (let k = 0; k < SHOTGUN_PELLETS; k++) {
      const ty = FLOOR_Y - (band[0] + (band[1] - band[0]) * (k + Math.random() * 0.6) / SHOTGUN_PELLETS);
      // aimed through the back of the player, so a band clears (or fills) the whole of its box
      const dir = normalize(PLAYER_X - this.halfWidth - 4 - muzzle.x, ty - muzzle.y);
      const speed = SHOTGUN_SPEED * (0.92 + Math.random() * 0.16);
      this.addBullet(muzzle.x, muzzle.y, dir.x * speed, dir.y * speed, (muzzle.x - PLAYER_X + 40) / SHOTGUN_SPEED);
    }
    this.addFlash(muzzle.x, muzzle.y);
    this.addFlash(muzzle.x - 8, muzzle.y);
    run.emit(this.world(muzzle.x, muzzle.y), 10, TRACER_GLOW, 1, 200, 0.2, 1, Math.PI, 0.7, 0, { kind: SPARK });
    run.emit(this.world(muzzle.x, muzzle.y), 5, DUST, 0.5, 30, 0.7, 4, Math.PI, 1, -15, { kind: SMOKE });
    run.play(SHOTGUN, 0, 0.95 + Math.random() * 0.1);
    run.shake(2, 0.15);
    run.pend(0.3, SHOTGUN_PUMP, -2);
    human.state = HumanState.Pump;
    human.timer = 0;
  }

  drawLockers(ctx) {
    const run = this.run;
    for (const locker of this.lockers) {
      const x = locker.x - this.scroll;
      if (x < -80 || x > SCREEN_W + 80) continue;
      // a rattle that builds before the door goes
      const shake = locker.state === LockerState.Tell ? Math.sin(locker.timer * 60) * (0.6 + 1.4 * locker.timer / LOCKER_TELL) : 0;
      const y = FLOOR_Y - 14 * 3;
      sprite(ctx, run.frame(locker.closet, 'base', SOUTH, 0, PROP_TINT), x + shake, y, 96, 96);
      if (locker.state === LockerState.Open) {
        sprite(ctx, run.frame(locker.closet, 'open', SOUTH, 0, PROP_TINT), x, y, 96, 96);
        continue;
      }
      sprite(ctx, run.frame(locker.closet, 'closed', SOUTH, 0, PROP_TINT), x + shake * 1.6, y, 96, 96);
      // eyes in the slats when somebody is in there
      if (locker.state === LockerState.Tell && locker.content !== LockerContent.Empty && run.clock % 0.5 < 0.35) {
        fill(ctx, x - 5 + shake * 1.6, FLOOR_Y - 58, 2, 1.5, WHITE, 0.9);
        fill(ctx, x + 2 + shake * 1.6, FLOOR_Y - 58, 2, 1.5, WHITE, 0.9);
      }
    }
  }

  /** The red zone a braced shotgunner is about to fill, at the player, so it can be jumped or ducked. */
  drawBlastWarnings(ctx) {
    const clock = this.run.clock;
    for (const human of this.humans) {
      if (!human.active || human.state !== HumanState.Brace || !this.playing) continue;
      const x = human.x - this.scroll;
      if (x - PLAYER_X > SHOTGUN_RANGE) continue;
      const band = human.high ? SHOTGUN_HIGH : SHOTGUN_LOW;
      const k = Math.min(1, human.timer / SHOTGUN_BRACE);
      const flicker = 0.7 + 0.3 * Math.sin(clock * 40);
      fill(ctx, PLAYER_X - 22, FLOOR_Y - band[1], 44, band[1] - band[0], LASER, (0.1 + 0.22 * k) * flicker);
      outline(ctx, PLAYER_X - 22, FLOOR_Y - band[1], 44, band[1] - band[0], LASER, 0.5 * k * flicker);
      line(ctx, x - 46, FLOOR_Y - 51, PLAYER_X + 22, FLOOR_Y - (band[0] + band[1]) / 2, LASER, 0.3 * k * flicker);
    }
  }

  // Demo bot -------------------------------------------------------------------------------------------------------

  // The demo's player: it reads each threat a human beat after it shows (a reaction time drawn per threat), jumps
  // low fire, ducks mid fire and high shotgun blasts, and leaves the rest to the stage. Now and then it fumbles a
  // threat by reacting late, so runs end.

  demoThink(dt) {
    const run = this.run;
    if (!this.playing) {
      run.bot(Key.Up, false);
      run.bot(Key.Down, false);
      this.botHold = 0;
      return;
    }
    const plan = { jump: false, hold: BOT_TAP, duck: false };
    this.botBullets(plan);
    this.botBrace(plan);
    this.botStage(plan);
    if (this.botHold > 0) {
      this.botHold -= dt;
      if (this.botHold <= 0) run.bot(Key.Up, false);
    }
    if (plan.jump && this.grounded && !(this.botHold > 0)) {
      run.bot(Key.Down, false);
      run.bot(Key.Up, true);
      this.botHold = plan.hold;
      return;
    }
    // ducking in the air is a fast fall, into whatever it was jumping
    run.bot(Key.Down, plan.duck && this.grounded);
  }

  /** The stage's own reads for its bot: faces to leap at, knives, airlocks, vents. Sets plan.jump/hold/duck. */
  botStage(plan) {}

  botBullets(plan) {
    for (const bullet of this.bullets) {
      if (bullet.vx >= 0 || bullet.age < botReaction(bullet.seed)) continue;
      const eta = (bullet.x - PLAYER_X) / -bullet.vx;
      if (eta < -0.12 || eta > 1) continue;
      // how high it will be when it reaches the player
      const height = FLOOR_Y - (bullet.y + bullet.vy * Math.max(0, eta));
      if (height > this.height + 3) continue;
      if (height > this.duckHeight + 2) {
        if (eta < 0.32) plan.duck = true;
        continue;
      }
      const lead = BOT_LEAD + (bullet.seed - 0.5) * 0.08;
      if (eta <= 0 || eta > lead) continue;
      plan.jump = true;
      if (this.lowFireAfter(eta)) plan.hold = Math.max(plan.hold, BOT_LONG_HOLD);
    }
  }

  /** Whether more low fire follows close behind, so the jump wants holding (a burst). */
  lowFireAfter(eta) {
    return this.bullets.some(b => {
      if (b.vx >= 0) return false;
      const next = (b.x - PLAYER_X) / -b.vx;
      return next > eta + 0.02 && next < eta + 0.45 && FLOOR_Y - b.y <= this.duckHeight + 2;
    });
  }

  /**
   * A braced shotgunner: get down under a high blast and stay down while the pellets go over, or time a held jump over
   * a low one from when it will reach the player. The red zone is read a beat after he braces, later on a fumble.
   */
  botBrace(plan) {
    for (const h of this.humans) {
      if (!h.active || !(h.state === HumanState.Brace || (h.state === HumanState.Pump && h.timer < 0.3))) continue;
      const x = h.x - this.scroll;
      if (x - PLAYER_X > SHOTGUN_RANGE) continue;
      if (h.state === HumanState.Brace && h.timer < 0.1 + h.botSeed * 0.15 + (h.botSeed < BOT_FUMBLE ? BOT_FUMBLE_LATE : 0)) continue;
      if (h.high) {
        plan.duck = true;
        continue;
      }
      const arrival = (h.state === HumanState.Brace ? SHOTGUN_BRACE - h.timer : -h.timer) + (x - 46 - PLAYER_X) / SHOTGUN_SPEED;
      if (arrival < -0.05 || arrival > BOT_LEAD + (h.botSeed - 0.5) * 0.06) continue;
      plan.jump = true;
      plan.hold = Math.max(plan.hold, BOT_LONG_HOLD);
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
    human.botSeed = Math.random();
    human.botDone = false;
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
        case HumanState.Brace:
          this.brace(human, x, dt);
          break;
        case HumanState.Pump:
          if (human.timer < SHOTGUN_PUMP_TIME) break;
          human.state = HumanState.Brace;
          human.timer = 0;
          human.high = Math.random() < 0.5;
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
    this.drawLockers(ctx);
    for (const human of this.humans) if (human.active) this.drawHuman(ctx, human);
    this.drawBlastWarnings(ctx);
    this.drawCorpse(ctx);
    if (!this.corpse) this.drawPlayer(ctx);
    this.drawForeground(ctx);
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

  /** Starts loading the corridor's scenery sprites now, so they are there when it first scrolls by. */
  warmScenery() {
    const run = this.run;
    for (const tint of [FLOOR_FAR, FLOOR_NEAR]) {
      run.image(FLOOR_TILE, tint);
      run.image(CATWALK_TILE, tint);
    }
    for (const door of DOORS) run.frame(door, 'closed', SOUTH, 0, PROP_TINT);
    for (const closet of CLOSETS) {
      run.frame(closet, 'base', SOUTH, 0, PROP_TINT);
      run.frame(closet, 'closed', SOUTH, 0, PROP_TINT);
    }
    for (const crate of CRATES) run.frame(crate, 'closed', SOUTH, 0, PROP_TINT);
    for (const state of POSTER_STATES) run.frame(POSTERS, state, SOUTH, 0, PROP_TINT);
    for (const state of SIGN_STATES) run.frame(SIGNS, state, SOUTH, 0, PROP_TINT);
    for (const [rsi, state] of [[DISPLAY, 'redalert_framed'], [DISPLAY, 'default'], [COMPUTER, 'computer_generic'], [SCRUBBER, 'on']]) {
      run.frame(rsi, state, SOUTH, 0, PROP_TINT);
    }
  }

  /** The ceiling girder and the service band of pipes under it, both one continuous strip. */
  drawCeiling(ctx) {
    const u = this.scroll * WALL_DEPTH;
    fill(ctx, 0, HUD_HEIGHT, SCREEN_W, SERVICE_TOP - HUD_HEIGHT, OUTLINE);
    // the girder: a web with a flange under it, and stiffeners with rivets
    fill(ctx, 0, 19, SCREEN_W, 4, DARK);
    fill(ctx, 0, 31, SCREEN_W, 5, MID);
    fill(ctx, 0, 31, SCREEN_W, 1, HIGH);
    fill(ctx, 0, 36, SCREEN_W, 1, OUTLINE);
    for (let c = Math.floor(u / 48); c * 48 - u < SCREEN_W; c++) {
      const x = c * 48 - u;
      fill(ctx, x, 23, 3, 8, DARK);
      fill(ctx, x + 1, 33, 1, 1, RIM);
    }

    // the service band: a big pipe with flanged joints, a small one, and the brackets holding them
    fill(ctx, 0, SERVICE_TOP - 4, SCREEN_W, WALL_TOP - SERVICE_TOP + 4, OUTLINE);
    fill(ctx, 0, 43, SCREEN_W, 7, MID);
    fill(ctx, 0, 43, SCREEN_W, 1, HIGH);
    fill(ctx, 0, 49, SCREEN_W, 1, DARK);
    fill(ctx, 0, 53, SCREEN_W, 3, DARK);
    fill(ctx, 0, 53, SCREEN_W, 1, LIGHT);
    for (let c = Math.floor(u / 80); c * 80 - u < SCREEN_W; c++) {
      const x = c * 80 - u + 20;
      fill(ctx, x, 41, 4, 11, LIGHT);
      fill(ctx, x, 41, 4, 1, HIGH);
    }
    for (let c = Math.floor(u / 48); c * 48 - u < SCREEN_W; c++) fill(ctx, c * 48 - u + 30, 40, 2, 22, DARK);
  }

  /** Most lamps burn steady; a few in every corridor stutter. */
  lampOn(lamp) {
    if (hash(lamp) % 6 !== 0) return true;
    const clock = this.run.clock;
    return Math.sin(clock * 13 + lamp) + Math.sin(clock * 7.3 + lamp * 2) > -0.6;
  }

  drawWall(ctx) {
    const u = this.scroll * WALL_DEPTH;
    const first = Math.floor(u / PANEL_WIDTH) - 1;
    // the bands run the whole width, then the plates, then what stands in front, so a door can spill over its panel
    fill(ctx, 0, WALL_TOP, SCREEN_W, FLOOR_Y - WALL_TOP, DARK);
    fill(ctx, 0, WALL_TOP, SCREEN_W, 1, HIGH);
    fill(ctx, 0, WALL_TOP + 1, SCREEN_W, 2, MAIN);
    fill(ctx, 0, WALL_TOP + 3, SCREEN_W, 1, OUTLINE);
    for (let p = first; p * PANEL_WIDTH - u < SCREEN_W; p++) this.drawPlate(ctx, p, p * PANEL_WIDTH - u);
    this.drawLowerWall(ctx, u);
    for (let p = first; p * PANEL_WIDTH - u < SCREEN_W + PANEL_WIDTH; p++) this.drawFurniture(ctx, p, p * PANEL_WIDTH - u);
  }

  /** One bevelled wall plate with rivets at its corners, and now and then a groove, a grille, a split or some grime. */
  drawPlate(ctx, panel, x) {
    const top = PLATE_TOP;
    const bottom = RAIL_Y - 2;
    fill(ctx, x + 2, top, PANEL_WIDTH - 4, bottom - top, hash01(panel, 24) < 0.3 ? MAIN_SHADE : MAIN);
    fill(ctx, x + 2, top, PANEL_WIDTH - 4, 1, HIGH);
    fill(ctx, x + 2, top, 1, bottom - top, LIGHT);
    fill(ctx, x + 2, bottom - 1, PANEL_WIDTH - 4, 1, OUTLINE);
    fill(ctx, x + PANEL_WIDTH - 3, top, 1, bottom - top, OUTLINE);
    const v = hash01(panel, 21);
    if (v < 0.45) {
      fill(ctx, x + 3, 104, PANEL_WIDTH - 6, 1, OUTLINE);
      fill(ctx, x + 3, 105, PANEL_WIDTH - 6, 1, LIGHT);
    } else if (v < 0.65) {
      fill(ctx, x + 14, 116, 36, 22, DARK);
      for (let k = 0; k < 5; k++) fill(ctx, x + 16, 118 + k * 4, 32, 2, OUTLINE);
    } else if (v < 0.82) {
      fill(ctx, x + 31, top + 1, 1, bottom - top - 2, OUTLINE);
      fill(ctx, x + 32, top + 1, 1, bottom - top - 2, LIGHT);
    } else {
      fill(ctx, x + 3, 118, PANEL_WIDTH - 6, bottom - 119, OUTLINE, 0.35);
      fill(ctx, x + 12 + hash01(panel, 22) * 36, 100, 1, 30, OUTLINE, 0.5);
    }
    for (const [rx, ry] of [[x + 5, top + 3], [x + PANEL_WIDTH - 7, top + 3], [x + 5, bottom - 5], [x + PANEL_WIDTH - 7, bottom - 5]]) {
      fill(ctx, rx, ry, 1, 1, HIGH);
      fill(ctx, rx + 1, ry + 1, 1, 1, OUTLINE);
    }
  }

  /** The handrail, the ribbed lower wall and the skirting, continuous along the corridor. */
  drawLowerWall(ctx, u) {
    fill(ctx, 0, RAIL_Y, SCREEN_W, LOWER_TOP - RAIL_Y, OUTLINE);
    fill(ctx, 0, RAIL_Y + 2, SCREEN_W, 2, RIM);
    fill(ctx, 0, RAIL_Y + 2, SCREEN_W, 1, GREEN, 0.25);
    fill(ctx, 0, LOWER_TOP, SCREEN_W, SKIRT_TOP - LOWER_TOP, MID);
    fill(ctx, 0, LOWER_TOP, SCREEN_W, 1, OUTLINE);
    for (let c = Math.floor(u / 8); c * 8 - u < SCREEN_W; c++) fill(ctx, c * 8 - u, LOWER_TOP + 1, 1, SKIRT_TOP - LOWER_TOP - 1, DARK);
    fill(ctx, 0, SKIRT_TOP, SCREEN_W, FLOOR_Y - SKIRT_TOP, DARK);
    fill(ctx, 0, SKIRT_TOP, SCREEN_W, 1, HIGH);
    for (let c = Math.floor(u / PANEL_WIDTH); c * PANEL_WIDTH - u < SCREEN_W; c++) {
      const x = c * PANEL_WIDTH - u;
      fill(ctx, x + 31, RAIL_Y + 4, 2, 4, LIGHT);
      fill(ctx, x + 8, 178, 2, 2, LIGHT);
      fill(ctx, x + 40, 178, 2, 2, LIGHT);
      if (hash01(c, 23) >= 0.15) continue;
      for (let k = 0; k < 8; k++) {
        const sx = x + k * 8 + 4;
        quad(ctx, sx, SKIRT_TOP + 2, sx + 4, SKIRT_TOP + 2, sx, FLOOR_Y - 1, sx - 4, FLOOR_Y - 1, AMBER, 0.3);
      }
    }
  }

  /** What stands at a panel: doors and lockers on the deck, signs at eye level, vents and displays up high. */
  drawFurniture(ctx, panel, x) {
    const kind = furniture(panel);
    if (kind < 0) return;
    const run = this.run;
    const h = hash(panel);
    const centre = x + 32;
    const frame = Math.floor(run.clock / 0.12);
    if (kind < 9) {
      // an airlock door set into a recess in the wall, a little taller than a person
      fill(ctx, centre - 58, FLOOR_Y - 115, 116, 115, OUTLINE);
      fill(ctx, centre - 58, FLOOR_Y - 115, 116, 1, HIGH);
      sprite(ctx, run.frame(DOORS[(h >>> 10) % DOORS.length], 'closed', SOUTH, 0, PROP_TINT), centre, FLOOR_Y - DOOR_SIZE / 2, DOOR_SIZE, DOOR_SIZE);
      circle(ctx, centre + 46, FLOOR_Y - 104, 1.6, (h >>> 8) % 3 === 0 ? ALARM : GREEN, run.clock % 1.2 < 0.8 ? 1 : 0.3);
    } else if (kind < 18) {
      // a viewport onto the colony outside
      fill(ctx, x + 4, 72, 56, 54, OUTLINE);
      this.drawOutside(ctx, x + 7, 75, 50, 48);
      fill(ctx, x + 31.5, 75, 1, 48, MID);
      outline(ctx, x + 6, 74, 52, 50, HIGH);
      quad(ctx, x + 12, 75, x + 18, 75, x + 10, 92, x + 8, 92, GREEN, 0.07);
    } else if (kind < 24) {
      // a locker stood on the deck: its body, then its door; the body ends 30 px down its sprite
      const closet = CLOSETS[(h >>> 8) % CLOSETS.length];
      const y = FLOOR_Y - 14 * 3;
      sprite(ctx, run.frame(closet, 'base', SOUTH, 0, PROP_TINT), centre, y, 96, 96);
      sprite(ctx, run.frame(closet, 'closed', SOUTH, 0, PROP_TINT), centre, y, 96, 96);
    } else if (kind < 29) {
      sprite(ctx, run.frame(COMPUTER, 'computer_generic', SOUTH, Math.floor(frame / 4), PROP_TINT), centre, FLOOR_Y - 38.5, 77, 77);
    } else if (kind < 35) {
      // a crate on the deck; its sprite ends 26 px down
      sprite(ctx, run.frame(CRATES[(h >>> 8) % CRATES.length], 'closed', SOUTH, 0, PROP_TINT), centre, FLOOR_Y - 10 * 2.2, 70, 70);
    } else if (kind < 43) {
      if ((h >>> 8) % 2 === 0) {
        sprite(ctx, run.frame(SIGNS, SIGN_STATES[(h >>> 9) % SIGN_STATES.length], SOUTH, 0, PROP_TINT), centre + 4, 96, 44, 44);
      } else {
        fill(ctx, x + 12, 88, 40, 14, BLACK);
        outline(ctx, x + 12, 88, 40, 14, GREEN, 0.8);
        centreText(ctx, SIGN_FONT, T.signs[(h >>> 9) % T.signs.length], centre, 91, GREEN);
      }
    } else if (kind < 49) {
      sprite(ctx, run.frame(SCRUBBER, 'on', SOUTH, frame, PROP_TINT), centre, 84, 44, 44);
    } else if (kind < 53) {
      sprite(ctx, run.frame(POSTERS, POSTER_STATES[(h >>> 8) % POSTER_STATES.length], SOUTH, 0, PROP_TINT), centre, 100, 48, 48);
    } else if (kind < 56) {
      sprite(ctx, run.frame(DISPLAY, (h >>> 8) % 2 === 0 ? 'redalert_framed' : 'default', SOUTH, frame, PROP_TINT), centre, 88, 52, 52);
    } else {
      // somebody already died here
      sprite(ctx, run.splatterFrame((h >>> 9) % 6, DARK_BLOOD), centre, 126, 30, 30, ((h >>> 12) % 628) / 100, 0.65);
      fill(ctx, centre - 2, 136, 1.5, 14, DARK_BLOOD, 0.5);
      fill(ctx, centre + 4, 134, 1, 9, DARK_BLOOD, 0.45);
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
    fill(ctx, 0, FLOOR_Y, SCREEN_W, SCREEN_H - FLOOR_Y, OUTLINE);
    // two rows of deck plates seen at a slant, the near row lighter and offset half a plate
    for (let row = 0; row < 2; row++) {
      const offset = row * 20;
      const y = FLOOR_Y + 2 + row * 19;
      const tint = row === 0 ? FLOOR_FAR : FLOOR_NEAR;
      const floor = run.image(FLOOR_TILE, tint);
      const catwalk = run.image(CATWALK_TILE, tint);
      for (let c = Math.floor((this.scroll + offset) / 40) - 1; c * 40 - this.scroll - offset < SCREEN_W; c++) {
        const x = c * 40 - this.scroll - offset;
        sprite(ctx, hash(c * 2 + row) % 7 === 0 ? catwalk : floor, x + 20, y + 9.5, 40, 19);
      }
    }
    // the deck's edge against the wall, and the wall's shadow on the deck
    fill(ctx, 0, FLOOR_Y, SCREEN_W, 2, RIM);
    fill(ctx, 0, FLOOR_Y, SCREEN_W, 1, GREEN, 0.5);
    fill(ctx, 0, FLOOR_Y + 2, SCREEN_W, 4, BLACK, 0.4);
  }

  /** Each strip light: its fitting, a halo on the wall, a cone of light, and a pool of it on the deck. */
  drawLights(ctx) {
    const u = this.scroll * WALL_DEPTH;
    for (let c = Math.floor((u - 30) / 96) - 1; c * 96 + 30 - u < SCREEN_W + 60; c++) {
      const x = c * 96 + 30 - u;
      const centre = x + 13;
      const on = this.lampOn(c);
      fill(ctx, x - 1, 35, 28, 5, DARK);
      fill(ctx, x - 1, 35, 28, 1, HIGH);
      fill(ctx, x + 1, 38, 24, 2, on ? TUBE_LIT : MID);
      if (!on) continue;
      ellipse(ctx, centre, 42, 30, 9, GREEN, 0.05);
      ellipse(ctx, centre, 41, 16, 4, GREEN, 0.07);
      quad(ctx, x + 1, 40, x + 25, 40, x + 66, FLOOR_Y, x - 40, FLOOR_Y, GREEN, 0.035);
      ellipse(ctx, centre, FLOOR_Y + 9, 54, 8, GREEN, 0.07);
      ellipse(ctx, centre, FLOOR_Y + 8, 26, 4, GREEN, 0.07);
    }
  }

  /** Railings and cable runs nearer than the deck, at its bottom edge, moving past faster. */
  drawForeground(ctx) {
    const u = this.scroll * FOREGROUND_DEPTH;
    for (let c = Math.floor(u / 150) - 1; c * 150 - u < SCREEN_W + 40; c++) {
      const kind = hash(c + 101) % 4;
      const x = c * 150 - u + hash01(c, 41) * 60;
      if (kind === 0) {
        // a railing: two posts and a bar
        fill(ctx, x, 209, 70, 3, OUTLINE);
        fill(ctx, x, 209, 70, 1, MID);
        for (const px of [x, x + 66]) {
          fill(ctx, px, 206, 5, SCREEN_H - 206, OUTLINE);
          fill(ctx, px, 206, 5, 1, MID);
        }
      } else if (kind === 1) {
        // a cable bundle along the deck edge
        for (let k = 0; k < 3; k++) {
          for (let sx = 0; sx < 90; sx += 3) {
            fill(ctx, x + sx, 218 + k * 2 + Math.sin((sx + c * 7) / 14 + k) * 1.5, 3, 2, k === 1 ? MID : OUTLINE);
          }
        }
      }
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

