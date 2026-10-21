// Stage 5, a port of Arcade/CMUHuggerRun.Ravager.cs, the finale: the runner has become a ravager, and it bulldozes
// up a burning colony street through five waves of marines, seen side-on like a brawler. Space slashes in a
// three-hit claw chain that ends in a tail sweep; a direction held with Space, or a double-tapped direction, charges,
// flattening everything in the path and breaking riot shields. Riflemen shoot down their lane, smartgunners hose a
// long stream, flamers leave the ground burning, riot marines block claws from the front, a sentry is dropped in, and
// an APC brings the heavy squad. Marines fly when hit, bleed where they land, scream and shed their guns. Kills chain
// a combo multiplier and fill a rage meter that sets off a short unstoppable frenzy. Clearing the last wave counts up
// the campaign tally and wins the run; running out of health loses it. Constants, sprites, sounds and strings match
// the C# file; keep them in step.

import {
  HuggerStage, Key, Outfit, EAST, WEST, SOUTH, RAVAGER, SCREEN_W, SCREEN_H, HUD_HEIGHT, SMOKE, SPARK, PHOSPHOR, BRIGHT,
  AMBER, ALARM, ACID, DARK_ACID, BLOOD, DARK_BLOOD, TRACER_CORE, TRACER_GLOW, DUST, LASER, GREEN, DIM, WHITE, BLACK,
  SMALL_FONT, SIGN_FONT, BIG_FONT, TAU, hash, hash01, clamp, moveTowards, fill, outline, line, circle, ellipse, quad,
  beam, sprite, text, centreText, textWidth,
} from './stage.js';
import { fetchResource } from '../../../repo.js';

// Layout and tuning -------------------------------------------------------------------------------------------------

// The kerb at the back of the street; feet walk between STREET_TOP and STREET_BOTTOM.
const CURB_Y = 130;
const STREET_TOP = 136;
const STREET_BOTTOM = 210;
/** Each wave is fought with the camera locked on its own stretch of street, this far apart. */
const ARENA_WIDTH = 360;

const RAVAGER_SCALE = 1.6;
const RAVAGER_BOX = 64 * RAVAGER_SCALE;
const HUMAN_SCALE = 2.2;
const HUMAN_BOX = 32 * HUMAN_SCALE;
const GEAR_BOX = 32 * 1.4;
const BAR_WIDTH = 84;

const MAX_HEALTH = 100;
const WALK_SPEED = 92;
const DEPTH_SPEED = 58;
const FRENZY_SPEED = 1.35;
const STEP_TIME = 0.34;
// the ravager's body for bullets: half its width, and how far off its depth a lane still hits it
const HALF_WIDTH = 24;
const BODY_DEPTH = 15;

// slashes come in a chain of three; the third is a wide tail sweep that launches
const SLASH_TIME = 0.24;
const SWEEP_TIME = 0.34;
const STRIKE_AT = 0.07;
const CHAIN_WINDOW = 0.22;
const SLASH_REACH = 64;
const SWEEP_REACH = 80;
const SLASH_DEPTH = 18;
const SWEEP_DEPTH = 22;
const LUNGE_SPEED = 110;

// the charge: a crouch, a straight run that flattens what it meets, a skid
const CHARGE_WINDUP = 0.14;
const CHARGE_TIME = 0.5;
const SKID_TIME = 0.22;
const CHARGE_SPEED = 340;
const CHARGE_REGEN = 70;
const DOUBLE_TAP = 0.28;
const CHARGE_REACH = 42;
const CHARGE_DEPTH = 20;
const TRAMPLE_DEPTH = 7;

const COMBO_WINDOW = 2.8;
const COMBO_STEP = 4;
const MAX_MULTIPLIER = 5;
const FRENZY_TIME = 6;
const RAGE_PER_KILL = 9;
const RAGE_CHARGE = 4;
const HEAL_PER_KILL = 2;

const GRAVITY = 900;
const STAGGER_TIME = 0.32;
const BULLET_REACH_Z = 95;
const RIFLE_SPEED = 380;
const SMART_SPEED = 420;
const SENTRY_SPEED = 400;

// damage to the ravager, of its 100 health
const RIFLE_DAMAGE = 3;
const SMART_DAMAGE = 1.5;
const SENTRY_DAMAGE = 3;
const SHELL_DAMAGE = 10;
const FLAME_DPS = 16;
const BURN_DPS = 9;
const BASH_DAMAGE = 7;
const BLAST_DAMAGE = 8;

const FLAME_REACH = 96;
const FLAME_TIME = 1.3;
const FIRE_LIFE = 2.6;
const FUSE = 0.35;

// the APC parks at the back of the street; its wheels stand on APC_Y
const APC_Y = 152;
const APC_HALF = 84;
/** The APC sprite's 128 px frame at this scale; its wheels stand on the frame's row 112. */
const APC_SCALE = 1.35;
const APC_HEALTH = 40;
const APC_BONUS = 2000;
const APC_DROPS = 6;
const APC_DRIVE_TIME = 2.4;
const APC_DROP_EVERY = 5;
const APC_FIRE_EVERY = 3.4;
const SHELL_TIME = 0.9;

// the finale's tally: rows reveal one by one, then the run is won
const TALLY_START = 1.4;
const TALLY_ROW = 0.55;
const TALLY_ROWS = 6;
const WIN_AFTER = TALLY_START + TALLY_ROWS * TALLY_ROW + 0.9;
const COMBO_BONUS = 50;
const HEALTH_BONUS = 20;
const WAVE_BONUS = 300;

const MAX_TROOPERS = 26;
const MAX_BULLETS = 48;
const MAX_SHELLS = 4;
const MAX_FIRES = 24;
const MAX_DEBRIS = 40;
const MAX_BLASTS = 8;
const MAX_GHOSTS = 8;
const MAX_FLASHES = 10;
const MAX_SCORCHES = 16;
const MAX_DRAWN = MAX_TROOPERS + 2;

const RIFLEMAN = 0;
const SMARTGUNNER = 1;
const FLAMER = 2;
const RIOT = 3;
const SENTRY = 4;

// Per kind of trooper: health, points, the distance kept from the ravager and how far off it still attacks, walking
// speed, aim time, and the muzzle in units in front of and above the feet.
const KIND_HEALTH = [1, 2, 2, 3, 4];
const KIND_POINTS = [100, 200, 200, 250, 300];
const KIND_RANGE = [135, 170, 62, 24, 0];
const KIND_TOLERANCE = [50, 45, 26, 14, 999];
const KIND_SPEED = [48, 30, 42, 30, 0];
const KIND_AIM = [0.45, 0.65, 0.35, 0.3, 0.4];
const MUZZLE_X = [29, 35, 33, 18, 33];
const MUZZLE_Z = [33, 27, 33, 30, 37];

/** Who comes in when, and from which side (1 the right, -1 the left), in seconds from the wave's start. */
const S = (at, kind, side) => ({ at, kind, side });
const WAVES = [
  [S(1.4, RIFLEMAN, 1), S(1.9, RIFLEMAN, 1), S(3.5, RIFLEMAN, -1), S(5.5, RIFLEMAN, 1), S(6, RIFLEMAN, 1)],
  [S(0.4, RIFLEMAN, 1), S(0.8, RIFLEMAN, 1), S(2, SMARTGUNNER, 1), S(3.5, RIFLEMAN, -1), S(4, RIFLEMAN, -1),
    S(6.5, RIFLEMAN, 1), S(7, RIFLEMAN, 1)],
  [S(0.4, FLAMER, 1), S(0.8, RIFLEMAN, 1), S(1.2, RIFLEMAN, 1), S(3, RIOT, -1), S(3.4, RIFLEMAN, -1),
    S(6, FLAMER, -1), S(6.4, RIOT, 1), S(6.8, RIFLEMAN, 1)],
  [S(0.3, SENTRY, 1), S(0.8, RIOT, 1), S(1.2, RIFLEMAN, 1), S(1.5, RIFLEMAN, 1), S(3.5, SMARTGUNNER, -1),
    S(3.9, RIOT, -1), S(6, FLAMER, 1), S(6.4, RIFLEMAN, 1), S(6.8, SMARTGUNNER, 1), S(9, RIFLEMAN, -1),
    S(9.4, RIFLEMAN, -1)],
  [S(2.6, RIOT, 1), S(3, RIOT, -1), S(3.4, SMARTGUNNER, -1), S(5.5, FLAMER, 1), S(5.9, FLAMER, -1),
    S(6.3, RIFLEMAN, 1), S(6.7, RIFLEMAN, -1), S(9, SMARTGUNNER, 1), S(9.4, RIFLEMAN, -1), S(9.8, SENTRY, -1)],
];

// Art and sound -----------------------------------------------------------------------------------------------------

const M41 = '/Textures/CMU14/Weapons/Guns/USCM/m41mk2.rsi';
const SMART_GUN = '/Textures/_RMC14/Objects/Weapons/Guns/SmartGuns/smart_gun.rsi';
const M34 = '/Textures/_RMC14/Objects/Weapons/Guns/Flamethrower/m34.rsi';
const SHIELDS = '/Textures/Objects/Weapons/Melee/shields.rsi';
const SMART_PACK = '/Textures/_RMC14/Objects/Clothing/Back/Smartpacks/V42/smartpack.rsi';
const FUEL_PACK = '/Textures/_RMC14/Objects/Clothing/Back/Satchels/Marines/flamethrower.rsi';
const APC_RSI = '/Textures/_RMC14/Structures/Tyrargo_Vehicles/tyrargo_apc.rsi';
const BARRICADES = '/Textures/_RMC14/Structures/Walls/Barricades/barricade.rsi';
const RAZORWIRE = '/Textures/_RMC14/Structures/Walls/Barricades/razorwire.rsi';
const AMMO_CRATE = '/Textures/_RMC14/Structures/Storage/Crates/ammo.rsi';
const BASIC_CRATE = '/Textures/_RMC14/Structures/Storage/Crates/basic.rsi';
const BARRELS = '/Textures/_RMC14/Structures/barrels.rsi';
const TRUCKS = '/Textures/_RMC14/Structures/Vehicles/vehicles2.rsi';
const FLOODLIGHT = '/Textures/_RMC14/Structures/illuminator.rsi';
const LANDING_SIGNS = '/Textures/_RMC14/Structures/landing_signs.rsi';
const ASPHALT = '/Textures/_RMC14/Tiles/asphalt/asphalt.png';
const ASPHALT_WORN = '/Textures/_RMC14/Tiles/asphalt/asphalt13.png';
const SENTRY_RSI = '/Textures/_RMC14/Objects/Weapons/Sentries/sentry.rsi';
const WIELDED = 'wielded-inhand-left';
const BACKPACK = 'equipped-BACKPACK';

const RIFLE_SHOT = '/Audio/Weapons/Guns/Gunshots/m41.ogg';
const SENTRY_SHOT = '/Audio/Weapons/Guns/Gunshots/gun_sentry.ogg';
const IGNITE = '/Audio/_RMC14/Weapons/Guns/Flamer/surv_flamer_ignite.ogg';
const CANNON = '/Audio/_RMC14/Vehicle/weapons/autocannon_fire.ogg';
const ENGINE = '/Audio/_RMC14/Vehicle/tank_driving.ogg';
const HYDRAULICS = '/Audio/_RMC14/Machines/hydraulics_1.ogg';
const BIG_BOOM = '/Audio/_RMC14/Explosion/bigboom2.ogg';
const METAL_CRASH = '/Audio/_RMC14/Effects/metal_crash.ogg';
const METAL_HIT = '/Audio/_RMC14/Structures/metalhit.ogg';
const RADIO = '/Audio/_RMC14/Effects/radiostatic.ogg';
const TICK = '/Audio/_RMC14/Effects/tick.ogg';
const WINDUP = '/Audio/_RMC14/Xeno/crusher_windup_sound.ogg';
const FRENZY_ROAR = '/Audio/_RMC14/Xeno/xenos_roaring.ogg';
const BLOCK = '/Audio/_RMC14/Xeno/alien_claw_block.ogg';
const SHIELD_BREAK = '/Audio/_RMC14/Bullets/shield_break_c1.ogg';
const KNOCKDOWN = '/Audio/_RMC14/Weapons/alien_knockdown.ogg';
const GIBBED = '/Audio/_RMC14/Effects/gibbed.ogg';
const SPLASH = '/Audio/Effects/Fluids/splat.ogg';
const BODY_FALL = '/Audio/CMU14/PersonalComputers/Games/fall.ogg';
const DISTANT_ROAR = '/Audio/_RMC14/Xeno/alien_distantroar_3.ogg';
const ROARS = [
  '/Audio/_RMC14/Xeno/alien_roar1.ogg', '/Audio/_RMC14/Xeno/alien_roar2.ogg', '/Audio/_RMC14/Xeno/alien_roar3.ogg',
  '/Audio/_RMC14/Xeno/alien_roar4.ogg', '/Audio/_RMC14/Xeno/alien_roar5.ogg', '/Audio/_RMC14/Xeno/alien_roar6.ogg',
];
const ECHO_ROARS = ['/Audio/_RMC14/Xeno/alien_echoroar_1.ogg', '/Audio/_RMC14/Xeno/alien_echoroar_2.ogg'];
const CLAWS = [
  '/Audio/_RMC14/Xeno/alien_claw_flesh1.ogg', '/Audio/_RMC14/Xeno/alien_claw_flesh2.ogg', '/Audio/_RMC14/Xeno/alien_claw_flesh3.ogg',
  '/Audio/_RMC14/Xeno/alien_claw_flesh4.ogg', '/Audio/_RMC14/Xeno/alien_claw_flesh5.ogg',
];
const SWOOSHES = [
  '/Audio/CMU14/PersonalComputers/Games/swoosh_1.ogg', '/Audio/CMU14/PersonalComputers/Games/swoosh_2.ogg',
  '/Audio/CMU14/PersonalComputers/Games/swoosh_3.ogg',
];
const TAIL_SWIPES = [
  '/Audio/_RMC14/Xeno/alien_tail_swipe1.ogg', '/Audio/_RMC14/Xeno/alien_tail_swipe2.ogg', '/Audio/_RMC14/Xeno/alien_tail_swipe3.ogg',
];
const CHARGE_STEPS = [
  '/Audio/_RMC14/Xeno/alien_footstep_charge1.ogg', '/Audio/_RMC14/Xeno/alien_footstep_charge2.ogg',
  '/Audio/_RMC14/Xeno/alien_footstep_charge3.ogg',
];
const STOMPS = [
  '/Audio/_RMC14/Xeno/alien_footstep_large1.ogg', '/Audio/_RMC14/Xeno/alien_footstep_large2.ogg',
  '/Audio/_RMC14/Xeno/alien_footstep_large3.ogg',
];
const HISSES = ['/Audio/_RMC14/Xeno/alien_hiss1.ogg', '/Audio/_RMC14/Xeno/alien_hiss2.ogg', '/Audio/_RMC14/Xeno/alien_hiss3.ogg'];
const DEATHS = ['/Audio/_RMC14/Xeno/alien_death.ogg', '/Audio/_RMC14/Xeno/alien_death2.ogg'];
const PUNCHES = ['/Audio/CMU14/PersonalComputers/Games/punch_1.ogg', '/Audio/CMU14/PersonalComputers/Games/punch_2.ogg'];
const BONES = ['/Audio/CMU14/Medical/bone_crack_1.ogg', '/Audio/CMU14/Medical/bone_crack_2.ogg'];
const FLESH = [
  '/Audio/_RMC14/Bullets/impact_flesh_1.ogg', '/Audio/_RMC14/Bullets/impact_flesh_2.ogg',
  '/Audio/_RMC14/Bullets/impact_flesh_3.ogg', '/Audio/_RMC14/Bullets/impact_flesh_4.ogg',
];
const RICOCHETS = ['/Audio/_RMC14/Bullets/bullet_impact1.ogg', '/Audio/_RMC14/Bullets/bullet_impact2.ogg'];
const SHIELD_HITS = ['/Audio/_RMC14/Bullets/shield_impact_c1.ogg', '/Audio/_RMC14/Bullets/shield_impact_c2.ogg'];
const SMART_SHOTS = [
  '/Audio/CMU14/Weapons/smartgun/gun_smartgun1.ogg', '/Audio/CMU14/Weapons/smartgun/gun_smartgun2.ogg',
  '/Audio/CMU14/Weapons/smartgun/gun_smartgun3.ogg', '/Audio/CMU14/Weapons/smartgun/gun_smartgun4.ogg',
];
const FLAMER_FIRE = [
  '/Audio/_RMC14/Weapons/Guns/Flamer/surv_flamer_fire1.ogg', '/Audio/_RMC14/Weapons/Guns/Flamer/surv_flamer_fire2.ogg',
  '/Audio/_RMC14/Weapons/Guns/Flamer/surv_flamer_fire3.ogg', '/Audio/_RMC14/Weapons/Guns/Flamer/surv_flamer_fire4.ogg',
];
const EXPLOSIONS = [
  '/Audio/_RMC14/Explosion/explosion1.ogg', '/Audio/_RMC14/Explosion/explosion2.ogg', '/Audio/_RMC14/Explosion/explosion3.ogg',
  '/Audio/_RMC14/Explosion/explosion4.ogg', '/Audio/_RMC14/Explosion/explosion5.ogg',
];

const SKY = '#010502';
const FAR_COLOUR = '#031008';
const BUILDING_COLOUR = '#05190B';
const TARMAC = '#031209';
const KERB = '#0A2412';
const HULL = '#0B2A12';
const TILE_TINT = '#5A7A60';
/** Scenery props sit back in the dark, dimmer than the fighters. */
const PROP_TINT = '#8FAF92';
const SHARD = '#2E4A30';
const HURT_TINT = '#FF7A60';
const FRENZY_TINT = '#FF4A3A';
const BASE_TINT = '#6A7A6A';

/** Strings from Games/hugger-ravager.ftl (title and hint from hugger.ftl, stage 5; victory is the framework's). */
const T = {
  title: 'STAGE 5 - RAVAGER',
  hint: 'BULLDOZE THROUGH',
  victory: 'HIVE VICTORIOUS',
  keys: 'SPACE: SLASH    ARROW+SPACE: CHARGE',
  wave: wave => `WAVE ${wave}`,
  waveCount: (wave, waves) => `WAVE ${wave}/${waves}`,
  final: 'FINAL WAVE',
  heavy: 'HEAVY SQUAD INBOUND',
  go: 'GO',
  hp: 'HP',
  rage: 'RAGE',
  frenzy: 'FRENZY!',
  combo: (count, mult) => `${count} KILLS X${mult}`,
  kills: count => `${count} KILLS`,
  points: points => `+${points}`,
  pointsMult: (points, mult) => `+${points} X${mult}`,
  blocked: 'BLOCKED',
  shield: 'SHIELD BROKEN',
  friendly: 'FRIENDLY FIRE',
  brutal: 'BRUTAL!',
  savage: 'SAVAGE!',
  carnage: 'CARNAGE!',
  unstoppable: 'UNSTOPPABLE!',
  stencil: 'USCM',
  dead: 'BROUGHT DOWN',
  purged: 'COLONY PURGED',
  tally: ['CAMPAIGN', 'RAMPAGE', 'MARINES SLAIN', 'BEST COMBO BONUS', 'HEALTH BONUS', 'TOTAL'],
};

const Pose = { Walk: 0, Slash: 1, Windup: 2, Charge: 3, Skid: 4, Dead: 5, Roar: 6 };
const Act = { Move: 0, Aim: 1, Fire: 2, Stagger: 3, Flying: 4, Dead: 5 };
const WaveState = { Fight: 0, Advance: 1, Done: 2 };

/** Two hex colours mixed, as a css colour: Color.InterpolateBetween. */
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const channel = shift => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

/** A tile texture (not a sprite state) loaded and multiplied by a tint, like run.frame does for sprites; null while loading. */
function tile(path, tint) {
  const entry = { image: null };
  fetchResource(path, 'blob').then(({ data }) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`${path} is not a readable image`));
    image.src = URL.createObjectURL(data);
  })).then(image => {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(image, 0, 0);
    entry.image = canvas;
  }, e => console.warn(`hugger run: ${e.message}`));
  return entry;
}

function sign(value) {
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

function newTrooper() {
  return {
    person: {}, active: false, kind: 0, state: Act.Move, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rotation: 0, spin: 0,
    facing: -1, hp: 0, timer: 0, cooldown: 0, gap: 0, step: 0, shots: 0, lane: 0, armed: false, turn: 0, stamp: 0,
    fuse: 0, drop: 0, struck: false, pooled: false, diedAt: 0,
  };
}

function alive(t) {
  return t.active && t.state !== Act.Flying && t.state !== Act.Dead;
}

export class Ravager extends HuggerStage {
  constructor(run) {
    super(run);
    this.troopers = Array.from({ length: MAX_TROOPERS }, newTrooper);
    this.bullets = [];
    this.shells = [];
    this.fires = [];
    this.debris = new Array(MAX_DEBRIS);
    this.blasts = [];
    this.ghosts = new Array(MAX_GHOSTS);
    this.flares = [];
    this.scorches = new Array(MAX_SCORCHES);
    this.order = new Array(MAX_DRAWN).fill(0);
    this.depths = new Array(MAX_DRAWN).fill(0);
    this.tally = new Array(TALLY_ROWS).fill(0);
  }

  get title() { return T.title; }
  get hint() { return T.hint; }

  get sounds() {
    return [
      RIFLE_SHOT, SENTRY_SHOT, IGNITE, CANNON, ENGINE, HYDRAULICS, BIG_BOOM, METAL_CRASH, METAL_HIT, RADIO, TICK, WINDUP,
      FRENZY_ROAR, BLOCK, SHIELD_BREAK, KNOCKDOWN, GIBBED, SPLASH, BODY_FALL, DISTANT_ROAR, ...ROARS, ...ECHO_ROARS, ...CLAWS,
      ...SWOOSHES, ...TAIL_SWIPES, ...CHARGE_STEPS, ...STOMPS, ...HISSES, ...DEATHS, ...PUNCHES, ...BONES, ...FLESH,
      ...RICOCHETS, ...SHIELD_HITS, ...SMART_SHOTS, ...FLAMER_FIRE, ...EXPLOSIONS,
    ];
  }

  preload() {
    const run = this.run;
    for (const dir of [EAST, WEST]) {
      run.frame(RAVAGER, 'alive', dir);
      run.frame(RAVAGER, 'alive', dir, 0, ACID);
      run.frame(RAVAGER, 'alive', dir, 0, FRENZY_TINT);
      run.frame(RAVAGER, 'alive', dir, 0, HURT_TINT);
      run.frame(M41, WIELDED, dir);
      run.frame(SMART_GUN, WIELDED, dir);
      run.frame(M34, WIELDED, dir);
      run.frame(SMART_PACK, BACKPACK, dir);
      run.frame(FUEL_PACK, BACKPACK, dir);
      run.frame(SENTRY_RSI, 'normal_uac_sentry_on', dir);
      run.frame(SENTRY_RSI, 'normal_uac_sentry_on', dir, 0, HURT_TINT);
    }
    run.frame(RAVAGER, 'crit');
    run.frame(RAVAGER, 'dead');
    run.frame(SHIELDS, 'riot-icon');
    run.frame(M41, 'icon');
    run.frame(SMART_GUN, 'Icon');
    run.frame(M34, 'icon');
    run.frame(SENTRY_RSI, 'normal_uac_sentry_destroyed');
    run.frame(SENTRY_RSI, 'defense_base', SOUTH, 0, BASE_TINT);
    run.frame(APC_RSI, 'apc', WEST);
    run.frame(APC_RSI, 'apc', WEST, 0, HURT_TINT);
    run.frame(APC_RSI, 'apc_destroyed', WEST);
    for (const state of ['sandbag', 'sandbag_wire']) run.frame(BARRICADES, state, SOUTH, 0, PROP_TINT);
    run.frame(RAZORWIRE, 'barbed_wire', SOUTH, 0, PROP_TINT);
    run.frame(AMMO_CRATE, 'closed', SOUTH, 0, PROP_TINT);
    run.frame(BASIC_CRATE, 'closed', SOUTH, 0, PROP_TINT);
    for (const state of ['barrel_red', 'barrel_yellow', 'barrel_blue']) run.frame(BARRELS, state, SOUTH, 0, PROP_TINT);
    run.frame(TRUCKS, 'truck_damaged', EAST, 0, PROP_TINT);
    run.frame(TRUCKS, 'truck_damaged', WEST, 0, PROP_TINT);
    run.frame(FLOODLIGHT, 'illuminator', SOUTH, 0, PROP_TINT);
    run.frame(FLOODLIGHT, 'illuminator_on', SOUTH, 0, PROP_TINT);
    run.frame(LANDING_SIGNS, 'laz_sign', SOUTH, 0, PROP_TINT);
    // the street's asphalt is a tile texture rather than a sprite state
    this.asphalt = tile(ASPHALT, TILE_TINT);
    this.asphaltWorn = tile(ASPHALT_WORN, TILE_TINT);
  }

  /** The ravager can be hurt and the marines fight on. */
  get hostile() {
    return this.pose !== Pose.Dead && this.finale < 0 && !this.run.over;
  }

  /** Bullets and fire do nothing to a charging or frenzied ravager. */
  get immune() {
    return this.frenzy > 0 || this.pose === Pose.Windup || this.pose === Pose.Charge;
  }

  arenaX(wave) {
    return wave * ARENA_WIDTH;
  }

  enter() {
    this.x = 70;
    this.y = 176;
    this.facing = 1;
    this.pose = Pose.Walk;
    this.timer = 0;
    this.hp = MAX_HEALTH;
    this.hurt = 0;
    this.push = 0;
    this.stride = 0;
    this.moving = false;
    this.stepTimer = 0;
    this.slash = 0;
    this.lastSlash = 0;
    this.chain = 0;
    this.queued = false;
    this.struck = false;
    this.chargeDir = { x: 1, y: 0 };
    this.chargeMeter = 100;
    this.stamp = 0;
    this.chargeStep = 0;
    this.ghostTimer = 0;
    this.rage = 0;
    this.frenzy = 0;
    this.hissCool = 0;
    this.screamCool = 0;
    this.tapKey = Key.None;
    this.tapTime = -1;
    this.pooled = false;

    this.time = 0;
    this.cam = 0;
    this.hitStop = 0;
    this.wave = 0;
    this.waveTime = 0;
    this.spawned = 0;
    this.waveState = WaveState.Fight;
    this.banner = 0;
    this.ambient = 3;
    this.entryScore = this.run.points;
    this.kills = 0;
    this.combo = 0;
    this.comboTime = 0;
    this.bestCombo = 0;
    this.cheer = 0;
    this.cheerText = null;
    this.finale = -1;
    this.tallyShown = 0;
    this.tally.fill(0);

    this.apc = 0;
    this.apcX = 0;
    this.apcHp = APC_HEALTH;
    this.apcTimer = 0;
    this.apcDoor = 0;
    this.apcDropTimer = 0;
    this.apcDrops = 0;
    this.apcFire = 0;
    this.apcAim = -1;
    this.apcHurt = 0;
    this.apcWheel = 0;
    this.apcRecoil = 0;
    this.apcBooms = 0;
    this.apcBoomTimer = 0;

    for (const t of this.troopers) t.active = false;
    this.bullets.length = 0;
    this.shells.length = 0;
    this.fires.length = 0;
    this.debrisCount = 0;
    this.debrisNext = 0;
    this.blasts.length = 0;
    this.ghostCount = 0;
    this.ghostNext = 0;
    this.flares.length = 0;
    this.scorchCount = 0;
    this.scorchNext = 0;

    this.startWave(0);
    this.run.camera = { x: 0, y: 0 };
  }

  // Input ---------------------------------------------------------------------------------------------------------

  onKey(input) {
    if (!input.down || input.repeat || !this.hostile) return;
    switch (input.key) {
      case Key.Left:
      case Key.Right:
        // a double tap charges that way
        if (input.key === this.tapKey && this.time - this.tapTime < DOUBLE_TAP) {
          this.tapKey = Key.None;
          if (this.tryCharge(input.key === Key.Right ? 1 : -1, 0)) return;
        }
        this.tapKey = input.key;
        this.tapTime = this.time;
        break;
      case Key.Action: {
        const dx = this.axis(Key.Left, Key.Right);
        const dy = this.axis(Key.Up, Key.Down);
        if ((dx !== 0 || dy !== 0) && this.tryCharge(dx, dy)) return;
        this.doSlash();
        break;
      }
    }
  }

  onRelease() {
    this.tapKey = Key.None;
  }

  // Demo bot -------------------------------------------------------------------------------------------------------

  // The demo's ravager: it wades into the nearest marine, lines up on his lane and claws in chains, charges down a
  // lane with two or more marines in it when the meter is full, steps out of a gunman's lane when a round is coming,
  // goes round the front of a raised riot shield, claws the APC, and walks on up the street between waves.

  demoThink(dt) {
    const run = this.run;
    this.botSlash = (this.botSlash ?? 0) - dt;
    this.botDodge = (this.botDodge ?? 0) - dt;
    this.botCharge = (this.botCharge ?? 0) - dt;
    if (!this.hostile || this.pose === Pose.Windup || this.pose === Pose.Charge || this.pose === Pose.Skid || this.pose === Pose.Roar) {
      this.botHold(0, 0);
      return;
    }

    const target = this.botTarget();
    if (!target && (this.apc === 1 || this.apc === 2)) {
      // the APC: get alongside and claw it
      const gap = this.apcX - this.x;
      if (Math.abs(gap) < APC_HALF + SLASH_REACH * 0.4 && this.y - APC_Y < 26 && Math.sign(gap) === Math.sign(this.facing)) {
        this.botHold(0, 0);
        if (this.botSlash <= 0) {
          run.botTap(Key.Action);
          this.botSlash = 0.2 + Math.random() * 0.12;
        }
        return;
      }
      this.botHold(Math.abs(gap) > APC_HALF + 10 ? Math.sign(gap) : Math.sign(gap) * (Math.sign(gap) === Math.sign(this.facing) ? 0 : 1),
        this.y - APC_Y > 20 ? -1 : 0);
      return;
    }
    if (!target) {
      const centre = this.cam + SCREEN_W / 2;
      this.botHold(this.waveState === WaveState.Advance ? 1 : Math.abs(centre - this.x) > 30 ? Math.sign(centre - this.x) : 0, 0);
      return;
    }

    if (this.botDodge <= 0 && this.botIncoming()) {
      this.botDodge = 0.4 + Math.random() * 0.2;
      this.botDodgeDir = this.y > (STREET_TOP + STREET_BOTTOM) / 2 ? -1 : 1;
    }

    const dx = target.x - this.x;
    const dy = target.y - this.y;

    // a lane with a crowd in it and a full meter: charge it
    if ((this.chargeMeter >= 100 || this.frenzy > 0) && this.botCharge <= 0 && Math.abs(dy) < 12 && Math.abs(dx) > 50 && Math.abs(dx) < 220
      && this.botLane(target) >= 2) {
      this.botCharge = 1.5;
      this.botHold(Math.sign(dx), 0);
      run.botTap(Key.Action);
      return;
    }

    // stand just short of him on our side, or round the back of a raised shield
    let stand = target.x - Math.sign(dx === 0 ? this.facing : dx) * 34;
    if (target.kind === RIOT && target.armed && target.facing * (this.x - target.x) > 0 && this.chargeMeter < 100) stand = target.x - target.facing * 34;

    const ahead = (target.x - this.x) * this.facing;
    if (ahead > -6 && ahead < SLASH_REACH - 10 && Math.abs(dy) < SLASH_DEPTH - 4 && this.botSlash <= 0) {
      // keys off so the claw does not turn into a charge
      this.botHold(0, 0);
      run.botTap(Key.Action);
      this.botSlash = (this.frenzy > 0 ? 0.1 : 0.17) + Math.random() * 0.14;
      return;
    }

    const mx = Math.abs(stand - this.x) > 6 ? Math.sign(stand - this.x) : Math.abs(ahead) < 1 || ahead < 0 ? Math.sign(dx) : 0;
    const my = this.botDodge > 0 ? this.botDodgeDir : Math.abs(dy) > 4 ? Math.sign(dy) : 0;
    this.botHold(mx, my);
  }

  botHold(x, y) {
    const run = this.run;
    run.bot(Key.Right, x > 0);
    run.bot(Key.Left, x < 0);
    run.bot(Key.Down, y > 0);
    run.bot(Key.Up, y < 0);
  }

  /** The nearest marine still standing on this stretch of street. */
  botTarget() {
    let best = null;
    let bestDistance = Infinity;
    for (const t of this.troopers) {
      if (!alive(t) || t.x < this.cam - 20 || t.x > this.cam + SCREEN_W + 20) continue;
      const distance = Math.abs(t.x - this.x) + Math.abs(t.y - this.y) * 2;
      if (distance >= bestDistance) continue;
      best = t;
      bestDistance = distance;
    }
    return best;
  }

  /** How many marines stand in a target's lane, for deciding whether a charge is worth it. */
  botLane(target) {
    let count = 0;
    for (const t of this.troopers) {
      if (alive(t) && Math.abs(t.y - target.y) < 14 && Math.sign(t.x - this.x) === Math.sign(target.x - this.x)) count++;
    }
    return count;
  }

  /** Whether a marine's round is coming down the ravager's lane. */
  botIncoming() {
    return this.bullets.some(b => {
      if (b.passed || Math.abs(b.y - this.y) > 9 || b.vx === 0) return false;
      const eta = (this.x - b.x) / b.vx;
      return eta > 0 && eta < 0.45 && Math.random() < 0.9;
    });
  }

  axis(negative, positive) {
    return (this.run.held(positive) ? 1 : 0) - (this.run.held(negative) ? 1 : 0);
  }

  // Update --------------------------------------------------------------------------------------------------------

  update(dt) {
    this.time += dt;
    if (this.hitStop > 0) {
      // the impact frame: everything on the street holds still for a moment
      this.hitStop -= dt;
      return;
    }
    this.updateRavager(dt);
    this.updateTroopers(dt);
    this.updateBullets(dt);
    this.updateShells(dt);
    this.updateFires(dt);
    this.updateDebris(dt);
    this.updateApc(dt);
    this.updateBlasts(dt);
    this.updateWaves(dt);
    this.updateCombo(dt);
    this.updateCamera(dt);
    this.ambience(dt);
    this.updateFinale(dt);
  }

  stop(seconds) {
    this.hitStop = Math.max(this.hitStop, seconds);
  }

  // The ravager ---------------------------------------------------------------------------------------------------

  updateRavager(dt) {
    this.timer += dt;
    this.chargeMeter = Math.min(100, this.chargeMeter + CHARGE_REGEN * dt);
    this.hurt -= dt;
    this.hissCool -= dt;
    this.screamCool -= dt;
    this.chain -= dt;
    if (this.frenzy > 0) {
      this.frenzy -= dt;
      this.rage = Math.max(0, 100 * this.frenzy / FRENZY_TIME);
      if (this.frenzy <= 0) this.rage = 0;
    }

    // riot bashes and blasts shove it
    if (this.push !== 0) {
      this.x += this.push * dt;
      this.push = moveTowards(this.push, 0, 700 * dt);
    }

    switch (this.pose) {
      case Pose.Walk:
        this.walk(dt);
        break;
      case Pose.Slash:
        this.slashing(dt);
        break;
      case Pose.Windup:
        if (Math.random() < dt * 30) this.dust(this.x - this.facing * 20, this.y, 1);
        if (this.timer >= CHARGE_WINDUP) this.beginCharge();
        break;
      case Pose.Charge:
        this.charging(dt);
        break;
      case Pose.Skid: {
        const slow = 1 - clamp(this.timer / SKID_TIME, 0, 1);
        this.x += this.chargeDir.x * CHARGE_SPEED * 0.35 * slow * dt;
        this.y += this.chargeDir.y * CHARGE_SPEED * 0.35 * slow * dt;
        if (Math.random() < dt * 40) this.dust(this.x, this.y, 1);
        if (this.timer >= SKID_TIME) this.setPose(Pose.Walk);
        break;
      }
      case Pose.Dead:
        this.dying();
        break;
    }

    this.keep();
    this.updateGhosts(dt);
  }

  setPose(pose) {
    this.pose = pose;
    this.timer = 0;
  }

  /** Keeps the ravager on the street, inside the camera, and out of the APC's hull. */
  keep() {
    this.y = clamp(this.y, STREET_TOP, STREET_BOTTOM);
    this.x = clamp(this.x, this.cam + 26, this.cam + SCREEN_W - 26);
    if (this.apc === 0 || this.y > APC_Y + 10 || Math.abs(this.x - this.apcX) > APC_HALF + 22) return;
    // pushed out the shortest way: in front of the hull, or off either end
    const front = APC_Y + 10 - this.y;
    const left = this.x - (this.apcX - APC_HALF - 22);
    const right = this.apcX + APC_HALF + 22 <= this.cam + SCREEN_W - 26 ? this.apcX + APC_HALF + 22 - this.x : Infinity;
    if (front <= left && front <= right) this.y = APC_Y + 10;
    else if (left < right) this.x = this.apcX - APC_HALF - 22;
    else this.x = this.apcX + APC_HALF + 22;
  }

  walk(dt) {
    const dx = this.hostile ? this.axis(Key.Left, Key.Right) : 0;
    const dy = this.hostile ? this.axis(Key.Up, Key.Down) : 0;
    const speed = this.frenzy > 0 ? FRENZY_SPEED : 1;
    this.x += dx * WALK_SPEED * speed * dt;
    this.y += dy * DEPTH_SPEED * speed * dt;
    if (dx !== 0) this.facing = dx;
    this.moving = dx !== 0 || dy !== 0;
    if (!this.moving) {
      this.stepTimer = Math.min(this.stepTimer, 0.08);
      return;
    }
    this.stride += dt * 7.5 * speed;
    this.stepTimer -= dt;
    if (this.stepTimer > 0) return;
    // heavy feet: a thud and a puff of dust with every step
    this.stepTimer = STEP_TIME / speed;
    this.run.playAny(STOMPS, -9, 0.85);
    this.dust(this.x - this.facing * 8, this.y, 2);
    this.run.shake(0.6, 0.08);
  }

  dust(x, y, count) {
    this.run.emit({ x, y: y - 1 }, count, DUST, 0.45, 34, 0.5, 2.4, -Math.PI / 2, 2.4, -16, { kind: SMOKE });
  }

  doSlash() {
    if (this.pose === Pose.Slash) {
      // a press during a slash chains the next one
      if (this.struck) this.queued = true;
      return;
    }
    if (this.pose !== Pose.Walk) return;
    this.startSlash(this.chain > 0 ? (this.lastSlash + 1) % 3 : 0);
  }

  startSlash(step) {
    this.setPose(Pose.Slash);
    this.slash = step;
    this.struck = false;
    this.queued = false;
    const dx = this.axis(Key.Left, Key.Right);
    if (dx !== 0) this.facing = dx;
    if (step === 2) this.run.playAny(TAIL_SWIPES, -2);
    else this.run.playAny(SWOOSHES, -3, step === 0 ? 0.9 : 1.05);
  }

  get slashLength() {
    return (this.slash === 2 ? SWEEP_TIME : SLASH_TIME) * (this.frenzy > 0 ? 0.7 : 1);
  }

  slashing(dt) {
    const strike = STRIKE_AT * (this.frenzy > 0 ? 0.7 : 1);
    if (this.timer < strike + 0.06) this.x += this.facing * LUNGE_SPEED * dt;
    if (!this.struck && this.timer >= strike) {
      this.struck = true;
      this.strike();
    }
    if (this.timer < this.slashLength) return;
    this.lastSlash = this.slash;
    this.chain = this.slash === 2 ? 0 : CHAIN_WINDOW;
    if (this.queued && this.slash < 2) {
      this.startSlash(this.slash + 1);
      return;
    }
    this.setPose(Pose.Walk);
  }

  /** The claws (or the tail) land: everything in reach in front is hit. */
  strike() {
    const sweep = this.slash === 2;
    const reach = sweep ? SWEEP_REACH : SLASH_REACH;
    const depth = sweep ? SWEEP_DEPTH : SLASH_DEPTH;
    const damage = this.frenzy > 0 ? 3 : sweep ? 2 : 1;
    let hits = 0;
    for (const t of this.troopers) {
      if (!alive(t) || t.z > 40) continue;
      const ahead = (t.x - this.x) * this.facing;
      if (ahead < -12 || ahead > reach || Math.abs(t.y - this.y) > depth) continue;
      hits++;
      this.hit(t, damage, sweep, false);
    }
    if ((this.apc === 1 || this.apc === 2) && Math.abs(this.x + this.facing * reach * 0.5 - this.apcX) < APC_HALF + reach * 0.5
      && this.y - APC_Y < 30) {
      hits++;
      this.damageApc(this.frenzy > 0 ? 2 : 1, { x: this.apcX - this.facing * APC_HALF * 0.8, y: this.y - 40 });
    }
    if (hits === 0) return;
    this.stop(sweep ? 0.07 : 0.05);
    this.run.shake(sweep ? 3 : 2, 0.15);
  }

  tryCharge(dx, dy) {
    if (!this.hostile || (this.chargeMeter < 100 && this.frenzy <= 0)) return false;
    if (this.pose !== Pose.Walk && !(this.pose === Pose.Slash && this.struck)) return false;
    const length = Math.hypot(dx, dy * 0.6) || 1;
    this.chargeDir = { x: dx / length, y: dy * 0.6 / length };
    if (dx !== 0) this.facing = sign(dx);
    if (this.frenzy <= 0) this.chargeMeter = 0;
    this.stamp++;
    this.setPose(Pose.Windup);
    this.run.play(WINDUP, -2);
    return true;
  }

  beginCharge() {
    this.setPose(Pose.Charge);
    this.chargeStep = 0;
    this.run.playAny(ROARS, -3, 1.05);
    this.run.shake(1.5, 0.2);
  }

  charging(dt) {
    const run = this.run;
    this.x += this.chargeDir.x * CHARGE_SPEED * dt;
    this.y += this.chargeDir.y * CHARGE_SPEED * dt;
    this.chargeStep -= dt;
    if (this.chargeStep <= 0) {
      this.chargeStep = 0.11;
      run.playAny(CHARGE_STEPS, -4);
      this.dust(this.x - this.facing * 14, this.y, 3);
      run.shake(1.2, 0.08);
    }

    for (const t of this.troopers) {
      if (!t.active || t.stamp === this.stamp || (t.kind === SENTRY && t.state === Act.Dead)) continue;
      const ahead = (t.x - this.x) * this.facing;
      if (ahead < -14 || ahead > CHARGE_REACH || Math.abs(t.y - this.y) > CHARGE_DEPTH || t.z > 50) continue;
      t.stamp = this.stamp;
      if (t.state === Act.Dead) {
        this.kick(t);
        continue;
      }
      if (t.state === Act.Flying) continue;
      this.hit(t, 4, true, true);
    }

    for (let i = 0; i < this.debrisCount; i++) {
      const d = this.debris[i];
      if (!d.resting || Math.abs(d.x - this.x - this.facing * 20) > 26 || Math.abs(d.y - this.y) > CHARGE_DEPTH) continue;
      d.resting = false;
      d.vx = this.facing * (160 + Math.random() * 80);
      d.vz = 90 + Math.random() * 80;
      d.spin = this.facing * (6 + Math.random() * 8);
    }

    // the APC stops the charge dead, and takes a beating for it
    if ((this.apc === 1 || this.apc === 2) && this.y < APC_Y + 14 && Math.abs(this.x + this.facing * 30 - this.apcX) < APC_HALF + 8) {
      this.damageApc(this.frenzy > 0 ? 8 : 6, { x: this.x + this.facing * 30, y: this.y - 40 });
      run.play(METAL_CRASH, 0, 0.9);
      run.shake(6, 0.35);
      this.stop(0.12);
      this.push = -this.facing * 220;
      this.setPose(Pose.Skid);
      return;
    }

    const edge = this.x <= this.cam + 27 || this.x >= this.cam + SCREEN_W - 27;
    if (this.timer >= CHARGE_TIME || (edge && this.chargeDir.x * (this.x - this.cam - SCREEN_W / 2) > 0)) this.setPose(Pose.Skid);
  }

  updateGhosts(dt) {
    for (let i = 0; i < this.ghostCount; i++) this.ghosts[i].age += dt;
    const trail = this.pose === Pose.Charge || this.pose === Pose.Skid || (this.frenzy > 0 && this.moving);
    if (!trail) return;
    this.ghostTimer -= dt;
    if (this.ghostTimer > 0) return;
    this.ghostTimer = 0.035;
    this.ghosts[this.ghostNext] = { x: this.x, y: this.y, facing: this.facing, tilt: this.tilt(), age: 0 };
    this.ghostNext = (this.ghostNext + 1) % MAX_GHOSTS;
    this.ghostCount = Math.min(this.ghostCount + 1, MAX_GHOSTS);
  }

  /** Hurts the ravager unless it is charging or frenzied. False when nothing happened. */
  takeDamage(amount, at, burning = false) {
    if (!this.hostile || this.immune) return false;
    const run = this.run;
    this.hp -= amount;
    this.hurt = burning ? 0.06 : 0.12;
    if (!burning || Math.random() < 0.1) {
      run.emit(at, burning ? 2 : 6, ACID, 1, 120, 0.7, 2, -Math.PI / 2, 2.4, 520,
        { floor: this.y + 1, depth: 8, stains: true, acid: true });
      if (!burning) run.playAny(FLESH, -8, 0.8);
    }
    if (this.hissCool <= 0) {
      this.hissCool = 0.9;
      run.playAny(HISSES, -4, 0.8);
    }
    if (this.hp <= 0) this.die();
    return true;
  }

  die() {
    const run = this.run;
    this.hp = 0;
    this.frenzy = 0;
    this.setPose(Pose.Dead);
    this.pooled = false;
    const chest = { x: this.x, y: this.y - 50 };
    const opts = { floor: this.y + 1, depth: 12, stains: true, acid: true };
    run.emit(chest, 50, ACID, 1, 240, 1.2, 2.6, -Math.PI / 2, 2.8, 600, opts);
    run.emit(chest, 14, DARK_ACID, 1, 150, 1, 3.4, -Math.PI / 2, 2, 600, opts);
    run.playAny(DEATHS);
    run.flash(ALARM, 0.3, 0.4);
    run.shake(5, 0.5);
    run.slowMotion(0.7);
    run.lose(T.dead, ALARM);
  }

  dying() {
    if (this.pooled || this.timer < 0.55) return;
    const run = this.run;
    this.pooled = true;
    run.splat({ x: this.x, y: this.y + 4 }, 70, ACID, 0.9, 0.45, true);
    run.splat({ x: this.x - 24, y: this.y + 8 }, 30, ACID, 0.85, 0.45, true);
    run.play(BODY_FALL, 0, 0.6);
    run.shake(4, 0.3);
    this.dust(this.x, this.y, 8);
  }

  // Kills and combo -----------------------------------------------------------------------------------------------

  /** A claw, tail or charge connects. Riot shields turn claws from the front; a charge breaks them. */
  hit(t, damage, heavy, charge) {
    const run = this.run;
    const shielded = t.kind === RIOT && t.armed && t.facing * (this.x - t.x) > 0;
    if (shielded && !charge && this.frenzy <= 0) {
      this.blocked(t);
      return;
    }
    if (t.kind === RIOT && t.armed && (charge || this.frenzy > 0)) this.breakShield(t);

    t.hp -= damage;
    const chest = { x: t.x, y: t.y - t.z - 40 };
    const bloodDir = this.facing > 0 ? -0.5 : Math.PI + 0.5;
    if (t.hp > 0) {
      t.state = Act.Stagger;
      t.timer = 0;
      t.vx = t.kind === SENTRY ? 0 : this.facing * (heavy ? 160 : 110);
      run.emit(chest, 12, BLOOD, 1, 160, 0.9, 2.2, bloodDir, 1.4, 520, { floor: t.y + 1, depth: 10, stains: true });
      run.playAny(t.kind === SENTRY ? RICOCHETS : CLAWS, -2);
      if (t.kind === SENTRY) this.sparks(chest, 10);
      return;
    }

    if (t.kind === SENTRY) {
      this.wreck(t);
      return;
    }
    if (charge && Math.abs(t.y - this.y) < TRAMPLE_DEPTH && Math.random() < 0.45) {
      this.trample(t);
      return;
    }

    const force = charge ? 1.5 : heavy ? 1.2 : 0.85;
    this.launch(t, this.facing * (115 + Math.random() * 60) * force, (175 + Math.random() * 80) * force,
      this.facing * (6 + Math.random() * 6) * force);
    const opts = { floor: t.y + 1, depth: 14, stains: true };
    run.emit(chest, charge ? 34 : 24, BLOOD, 1, 230, 1.2, 2.4, this.facing > 0 ? -0.6 : Math.PI + 0.6, 1.8, 520, opts);
    run.emit(chest, 8, DARK_BLOOD, 1, 130, 1, 3.4, -Math.PI / 2, 2, 520, opts);
    if (charge) {
      run.play(KNOCKDOWN, -1);
      run.playAny(BONES, -2);
      run.shake(3.5, 0.2);
      this.stop(0.06);
    } else {
      run.playAny(CLAWS);
    }
    this.killed(t, charge ? 1 : 0);
  }

  blocked(t) {
    const run = this.run;
    const at = { x: t.x + t.facing * 12, y: t.y - 34 };
    this.sparks(at, 14);
    run.play(BLOCK, -1);
    run.playAny(SHIELD_HITS, -4);
    run.pop(T.blocked, { x: at.x, y: at.y - 20 }, BRIGHT, 0.6);
    run.shake(1.5, 0.1);
    this.push = -this.facing * 170;
    t.x -= t.facing * 6;
    t.cooldown = Math.min(t.cooldown, 0.25);
    this.stop(0.04);
  }

  breakShield(t) {
    const run = this.run;
    t.armed = false;
    const at = { x: t.x + t.facing * 12, y: t.y - 34 };
    this.addDebris(RIOT, at, t.y, this.facing * (220 + Math.random() * 80), 200 + Math.random() * 80, this.facing * 9);
    this.sparks(at, 18);
    run.play(SHIELD_BREAK, 0);
    run.pop(T.shield, { x: at.x, y: at.y - 24 }, AMBER, 0.8);
  }

  sparks(at, count) {
    this.run.emit(at, count, TRACER_CORE, 1, 220, 0.3, 1, -Math.PI / 2, TAU, 300, { kind: SPARK });
  }

  /** Sends a dying trooper flying, with its gun and some armour coming off. */
  launch(t, vx, vz, spin) {
    t.state = Act.Flying;
    t.timer = 0;
    t.vx = vx;
    t.vz = vz;
    t.vy = (t.y - this.y) * 2 + (Math.random() - 0.5) * 30;
    t.spin = spin;
    t.struck = false;
    t.pooled = false;
    this.shedGear(t, vx, vz);
  }

  shedGear(t, vx, vz) {
    const chest = { x: t.x, y: t.y - t.z - 36 };
    if (t.armed) {
      t.armed = false;
      this.addDebris(t.kind, chest, t.y, vx * 0.6 + (Math.random() - 0.5) * 80, vz * 0.8 + Math.random() * 60, (Math.random() - 0.5) * 24);
    }
    const shards = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < shards; i++) {
      this.addDebris(5, chest, t.y, vx * 0.5 + (Math.random() - 0.5) * 160, vz * 0.7 + Math.random() * 120, (Math.random() - 0.5) * 30);
    }
  }

  /** Run down under the ravager's feet: flat, in pieces, in a lake of blood. */
  trample(t) {
    const run = this.run;
    t.state = Act.Dead;
    t.timer = 0;
    t.z = 0;
    t.vx = 0;
    t.rotation = this.facing * Math.PI / 2;
    t.pooled = true;
    this.shedGear(t, this.facing * 200, 160);
    const at = { x: t.x, y: t.y - 8 };
    const opts = { floor: t.y + 1, depth: 16, stains: true };
    run.emit(at, 46, BLOOD, 1, 260, 1.2, 2.6, -Math.PI / 2, 2.6, 560, opts);
    run.emit(at, 14, DARK_BLOOD, 1, 160, 1.1, 4, -Math.PI / 2, 2.2, 560, opts);
    run.splat({ x: t.x, y: t.y + 2 }, 64, BLOOD, 0.95);
    run.splat({ x: t.x - this.facing * 24, y: t.y + 4 }, 36, DARK_BLOOD, 0.9);
    run.play(GIBBED, 0);
    run.playAny(BONES);
    run.shake(4, 0.25);
    this.stop(0.08);
    this.killed(t, 2);
  }

  /** Kicks a body already on the ground back into the air. */
  kick(t) {
    t.state = Act.Flying;
    t.timer = 0;
    t.vx = this.facing * (160 + Math.random() * 60);
    t.vz = 120 + Math.random() * 60;
    t.spin = this.facing * 6;
    t.pooled = true;
    this.run.emit({ x: t.x, y: t.y - 10 }, 10, BLOOD, 1, 150, 0.9, 2.2, -Math.PI / 2, 2, 520, { floor: t.y + 1, depth: 12, stains: true });
    this.run.play(SPLASH, -6);
  }

  /** Scores a kill: the combo grows, the multiplier with it, rage builds and the ravager feeds. */
  killed(t, how) {
    t.diedAt = this.time;
    if (t.kind === FLAMER && (how > 0 || Math.random() < 0.5)) t.fuse = FUSE;
    if (this.screamCool <= 0 && t.kind !== SENTRY) {
      this.screamCool = 0.22;
      this.run.pendScream(0.04, t.person.female, -1);
    }
    this.score(KIND_POINTS[t.kind], { x: t.x, y: t.y - 90 }, how > 0);
  }

  get multiplier() {
    return Math.min(MAX_MULTIPLIER, 1 + Math.floor(this.combo / COMBO_STEP));
  }

  score(points, at, charge) {
    const run = this.run;
    this.kills++;
    this.combo++;
    this.comboTime = COMBO_WINDOW;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const multiplier = this.multiplier;
    run.addScore(points * multiplier);
    run.pop(multiplier > 1 ? T.pointsMult(points, multiplier) : T.points(points), at, multiplier > 2 ? AMBER : BRIGHT);
    this.hp = Math.min(MAX_HEALTH, this.hp + HEAL_PER_KILL);
    if (this.frenzy <= 0) {
      this.rage = Math.min(100, this.rage + RAGE_PER_KILL + (charge ? RAGE_CHARGE : 0));
      if (this.rage >= 100 && this.hostile) this.startFrenzy();
    }
    const word = { 6: T.brutal, 12: T.savage, 20: T.carnage, 30: T.unstoppable }[this.combo];
    if (!word) return;
    this.cheer = 1.1;
    this.cheerText = word;
  }

  startFrenzy() {
    const run = this.run;
    this.frenzy = FRENZY_TIME;
    this.rage = 100;
    this.cheer = 0;
    run.play(FRENZY_ROAR, 0);
    run.flash(ALARM, 0.35, 0.45);
    run.shake(5, 0.5);
    run.slowMotion(0.3);
    run.pop(T.frenzy, { x: this.x, y: this.y - 112 }, ALARM, 1.2);
  }

  updateCombo(dt) {
    if (this.frenzy > 0 || this.combo === 0) return;
    this.comboTime -= dt;
    if (this.comboTime <= 0) this.combo = 0;
  }

  // Troopers ------------------------------------------------------------------------------------------------------

  offScreen(t) {
    return t.x < this.cam - 40 || t.x > this.cam + SCREEN_W + 40;
  }

  free() {
    for (const t of this.troopers) if (!t.active) return t;
    // the street is full of bodies: reuse the longest dead, off screen if we can
    let oldest = null;
    for (const t of this.troopers) {
      if (t.state !== Act.Dead) continue;
      const off = this.offScreen(t);
      if (!oldest || (off && !this.offScreen(oldest)) || (off === this.offScreen(oldest) && t.diedAt < oldest.diedAt)) oldest = t;
    }
    return oldest;
  }

  addTrooper(kind, x, y) {
    const t = this.free();
    if (!t) return null;
    t.active = true;
    t.kind = kind;
    t.state = Act.Move;
    t.x = x;
    t.y = y;
    t.z = 0;
    t.vx = t.vy = t.vz = 0;
    t.rotation = 0;
    t.spin = 0;
    t.facing = x > this.x ? -1 : 1;
    t.hp = KIND_HEALTH[kind];
    t.timer = 0;
    t.cooldown = 0.6 + Math.random() * 0.9;
    t.gap = 0;
    t.step = Math.random() * 3;
    t.shots = 0;
    t.lane = kind === RIFLEMAN ? (Math.random() - 0.5) * 18 : kind === SMARTGUNNER ? (Math.random() - 0.5) * 8 : 0;
    t.armed = true;
    t.turn = 0;
    t.stamp = 0;
    t.fuse = 0;
    t.drop = 0;
    t.struck = false;
    t.pooled = false;
    if (kind !== SENTRY) this.run.dress(t.person, Outfit.Knifeman);
    return t;
  }

  spawnWave(spawn) {
    const y = STREET_TOP + 4 + Math.random() * (STREET_BOTTOM - STREET_TOP - 8);
    if (spawn.kind === SENTRY) {
      // air-dropped onto the street, landing with a clang
      const sentry = this.addTrooper(SENTRY, this.cam + (spawn.side > 0 ? 262 : 58), y);
      if (sentry) sentry.z = 170;
      return;
    }
    const x = spawn.side > 0 ? this.cam + SCREEN_W + 24 + Math.random() * 30 : this.cam - 24 - Math.random() * 30;
    this.addTrooper(spawn.kind, x, y);
  }

  updateTroopers(dt) {
    for (const t of this.troopers) {
      if (!t.active) continue;
      t.timer += dt;
      switch (t.state) {
        case Act.Move:
          this.think(t, dt);
          break;
        case Act.Aim:
          this.aiming(t);
          break;
        case Act.Fire:
          this.firing(t, dt);
          break;
        case Act.Stagger:
          t.x += t.vx * dt;
          t.vx = moveTowards(t.vx, 0, 500 * dt);
          if (t.timer >= STAGGER_TIME) {
            t.state = Act.Move;
            t.timer = 0;
          }
          break;
        case Act.Flying:
          this.fly(t, dt);
          break;
        case Act.Dead:
          this.lie(t, dt);
          break;
      }
      if (t.fuse > 0) {
        t.fuse -= dt;
        if (Math.random() < dt * 30) {
          this.run.emit({ x: t.x - t.facing * 6, y: t.y - t.z - 30 }, 1, TRACER_GLOW, 1, 60, 0.3, 1, -Math.PI / 2, 1.6, 0, { kind: SPARK });
        }
        if (t.fuse <= 0) this.explode({ x: t.x, y: t.y }, 46, BLAST_DAMAGE, false);
      }
    }
    this.separate(dt);
  }

  /** Living troopers spread out instead of standing in each other, and give the ravager room. */
  separate(dt) {
    for (let i = 0; i < MAX_TROOPERS; i++) {
      const a = this.troopers[i];
      if (!alive(a) || a.kind === SENTRY) continue;
      if (Math.abs(a.x - this.x) < 20 && Math.abs(a.y - this.y) < 10 && this.pose !== Pose.Dead) {
        a.x += sign(a.x - this.x + 0.01) * 60 * dt;
      }
      if (this.apc !== 0 && Math.abs(a.x - this.apcX) < APC_HALF + 6 && a.y < APC_Y + 8) a.y = moveTowards(a.y, APC_Y + 8, 80 * dt);
      for (let j = i + 1; j < MAX_TROOPERS; j++) {
        const b = this.troopers[j];
        if (!alive(b) || b.kind === SENTRY || Math.abs(a.x - b.x) > 16 || Math.abs(a.y - b.y) > 7) continue;
        const side = a.y < b.y ? -1 : 1;
        a.y += side * 20 * dt;
        b.y -= side * 20 * dt;
      }
      a.y = clamp(a.y, STREET_TOP, STREET_BOTTOM);
    }
  }

  onScreen(t) {
    return t.x > this.cam + 6 && t.x < this.cam + SCREEN_W - 6;
  }

  /** Walks to its kind's distance from the ravager on its own side and lines up a shot. */
  think(t, dt) {
    if (t.kind === SENTRY) {
      this.sentinel(t, dt);
      return;
    }
    const kind = t.kind;
    const side = t.x >= this.x ? 1 : -1;
    const want = KIND_RANGE[kind];
    let targetX = clamp(this.x + side * want, this.cam + 14, this.cam + SCREEN_W - 14);
    let targetY = clamp(this.y + t.lane, STREET_TOP, STREET_BOTTOM);
    let speed = KIND_SPEED[kind];
    if (!this.hostile) {
      // nobody left to shoot at: they stop and stare
      targetX = t.x;
      targetY = t.y;
    } else if ((kind === RIFLEMAN || kind === SMARTGUNNER) && Math.abs(t.x - this.x) < 50) {
      speed *= 1.5;
    }
    const dx = targetX - t.x;
    if (Math.abs(dx) > 6) {
      t.x += sign(dx) * speed * dt;
      t.step += dt * (4 + speed * 0.12);
    }
    const dy = targetY - t.y;
    if (Math.abs(dy) > 2) {
      t.y += sign(dy) * speed * 0.7 * dt;
      t.step += dt * 3;
    }

    const toward = this.x >= t.x ? 1 : -1;
    if (kind === RIOT) {
      // the shield turns slowly: get round him and his back is open
      if (toward !== t.facing) {
        t.turn += dt;
        if (t.turn > 0.55) {
          t.facing = toward;
          t.turn = 0;
        }
      } else {
        t.turn = 0;
      }
    } else {
      t.facing = toward;
    }

    t.cooldown -= dt;
    if (!this.hostile || t.cooldown > 0 || !this.onScreen(t) || t.facing !== toward) return;
    const distance = Math.abs(t.x - this.x);
    const inRange = kind === RIFLEMAN || kind === SMARTGUNNER
      ? distance < want + KIND_TOLERANCE[kind]
      : Math.abs(distance - want) < KIND_TOLERANCE[kind];
    if (!inRange || Math.abs(t.y - this.y) > (kind === RIOT ? 10 : 12)) return;
    t.state = Act.Aim;
    t.timer = 0;
    if (kind === FLAMER) this.run.play(IGNITE, -4);
  }

  /** A sentry drops in, then turns on the spot and fires down its lane when the ravager is in it. */
  sentinel(t, dt) {
    if (t.z > 0) {
      t.vz -= GRAVITY * dt;
      t.z = Math.max(0, t.z + t.vz * dt);
      if (t.z > 0) return;
      this.run.play(METAL_CRASH, -3, 1.2);
      this.dust(t.x, t.y, 8);
      this.run.shake(3, 0.2);
      return;
    }
    t.facing = this.x >= t.x ? 1 : -1;
    t.cooldown -= dt;
    if (!this.hostile || t.cooldown > 0 || !this.onScreen(t) || Math.abs(t.y - this.y) > 14) return;
    t.state = Act.Aim;
    t.timer = 0;
  }

  aiming(t) {
    if (!this.hostile) {
      t.state = Act.Move;
      return;
    }
    if (t.kind !== RIOT) t.facing = this.x >= t.x ? 1 : -1;
    if (t.timer < KIND_AIM[t.kind]) return;
    t.state = Act.Fire;
    t.timer = 0;
    t.gap = 0;
    t.struck = false;
    t.drop = 0;
    t.shots = t.kind === RIFLEMAN ? 3 : t.kind === SMARTGUNNER ? 14 : t.kind === SENTRY ? 5 : 0;
    if (t.kind === FLAMER) this.run.playAny(FLAMER_FIRE, -2);
    else if (t.kind === SENTRY) this.run.play(SENTRY_SHOT, -2);
  }

  firing(t, dt) {
    switch (t.kind) {
      case FLAMER:
        this.flame(t, dt);
        if (t.timer >= FLAME_TIME || !this.hostile) this.rest(t, 2.2 + Math.random() * 0.8);
        return;
      case RIOT:
        if (!t.struck && t.timer >= 0.08) {
          t.struck = true;
          const ahead = (this.x - t.x) * t.facing;
          if (ahead > 0 && ahead < 46 && Math.abs(t.y - this.y) < 16) {
            this.run.playAny(PUNCHES, 0, 0.8);
            this.run.shake(2, 0.15);
            if (this.takeDamage(BASH_DAMAGE, { x: this.x - t.facing * 10, y: this.y - 50 })) this.push = t.facing * 260;
          }
        }
        if (t.timer >= 0.3) this.rest(t, 1.1 + Math.random() * 0.4);
        return;
    }
    if (t.kind === SMARTGUNNER) t.y = moveTowards(t.y, this.y, 18 * dt);
    t.gap -= dt;
    if (t.gap > 0) return;
    t.gap = t.kind === SMARTGUNNER ? 0.075 : t.kind === SENTRY ? 0.09 : 0.1;
    this.shoot(t);
    t.shots--;
    if (t.shots > 0 && this.hostile) return;
    this.rest(t, t.kind === SMARTGUNNER ? 2 + Math.random() * 0.6 : t.kind === SENTRY ? 1 + Math.random() * 0.4 : 1.3 + Math.random() * 0.8);
  }

  rest(t, cooldown) {
    t.state = Act.Move;
    t.timer = 0;
    t.cooldown = cooldown;
  }

  muzzle(t) {
    return { x: t.x + t.facing * MUZZLE_X[t.kind], y: t.y - t.z - MUZZLE_Z[t.kind] };
  }

  shoot(t) {
    const run = this.run;
    const muzzle = this.muzzle(t);
    this.addFlare(muzzle);
    const speed = t.kind === SMARTGUNNER ? SMART_SPEED : t.kind === SENTRY ? SENTRY_SPEED : RIFLE_SPEED;
    this.addBullet({
      x: muzzle.x,
      y: t.y,
      z: MUZZLE_Z[t.kind],
      vx: t.facing * speed,
      damage: t.kind === SMARTGUNNER ? SMART_DAMAGE : t.kind === SENTRY ? SENTRY_DAMAGE : RIFLE_DAMAGE,
      kind: t.kind,
      passed: false,
      owner: this.troopers.indexOf(t),
    });
    if (t.kind === RIFLEMAN) run.play(RIFLE_SHOT, -3, 0.95 + Math.random() * 0.1);
    else if (t.kind === SMARTGUNNER && t.shots % 4 === 2) run.playAny(SMART_SHOTS, -2);
    // brass
    run.emit({ x: muzzle.x - t.facing * 16, y: muzzle.y + 4 }, 1, AMBER, 1, 80, 1, 1.6, -Math.PI / 2 - t.facing * 0.6, 0.6, 600,
      { floor: t.y + 1, depth: 6 });
  }

  /** The flamer's jet: a roaring cone of fire that burns the ravager and sets the ground alight. */
  flame(t, dt) {
    const run = this.run;
    const muzzle = this.muzzle(t);
    const grow = clamp(t.timer / 0.25, 0, 1);
    const direction = t.facing > 0 ? 0 : Math.PI;
    if (Math.random() < dt * 60) {
      run.emit(muzzle, 2, TRACER_GLOW, 0.8, 260 * grow + 40, 0.42, 3, direction, 0.3, -40, { kind: SMOKE });
      run.emit(muzzle, 1, ALARM, 0.7, 220 * grow + 40, 0.4, 2.4, direction, 0.4, -60, { kind: SMOKE });
      run.emit(muzzle, 1, TRACER_CORE, 1, 280 * grow, 0.25, 1, direction, 0.25, 0, { kind: SPARK });
    }
    t.drop -= dt;
    if (t.drop <= 0 && grow >= 1) {
      t.drop = 0.2;
      this.addFire(t.x + t.facing * (34 + Math.random() * (FLAME_REACH - 34)), t.y + (Math.random() - 0.5) * 10, 10 + Math.random() * 6);
    }
    const ahead = (this.x - muzzle.x) * t.facing;
    if (ahead > -HALF_WIDTH && ahead < FLAME_REACH * grow + HALF_WIDTH * 0.5 && Math.abs(t.y - this.y) < 16) {
      this.takeDamage(FLAME_DPS * dt, { x: this.x, y: this.y - 50 }, true);
    }
  }

  fly(t, dt) {
    const run = this.run;
    t.x += t.vx * dt;
    t.y = clamp(t.y + t.vy * dt, STREET_TOP - 2, STREET_BOTTOM + 6);
    t.z += t.vz * dt;
    t.vz -= GRAVITY * dt;
    t.rotation += t.spin * dt;
    if (Math.random() < dt * 24) {
      run.emit({ x: t.x, y: t.y - t.z - 20 }, 1, BLOOD, 1, 40, 0.8, 2.2, Math.PI / 2, 1, 520, { floor: t.y + 1, depth: 6, stains: true });
    }

    // flying bodies bowl over whoever they meet
    if (Math.abs(t.vx) > 140 && t.z < 60) {
      for (const other of this.troopers) {
        if (other === t || !alive(other) || other.kind === SENTRY || Math.abs(other.x - t.x) > 14 || Math.abs(other.y - t.y) > 12) continue;
        this.bowled(other, t.vx * 0.7);
        t.vx *= 0.6;
        break;
      }
    }

    // the edges of the fight throw bodies back, so the carnage stays in view
    if ((t.x < this.cam + 10 && t.vx < 0) || (t.x > this.cam + SCREEN_W - 10 && t.vx > 0)) {
      t.vx = -t.vx * 0.3;
      t.spin = -t.spin * 0.5;
    }

    if (this.apc !== 0 && Math.abs(t.x - this.apcX) < APC_HALF && t.y < APC_Y + 8 && t.z < 56) {
      t.x = this.apcX + sign(t.x - this.apcX) * APC_HALF;
      t.vx = -t.vx * 0.4;
      run.play(METAL_HIT, -6, 0.9);
    }

    if (t.z > 0 || t.vz > 0) return;
    t.z = 0;
    if (t.vz < -220) {
      // bounces once, hard
      t.vz = -t.vz * 0.32;
      t.vx *= 0.55;
      t.spin *= 0.5;
      run.play(BODY_FALL, -4, 0.9 + Math.random() * 0.2);
      this.dust(t.x, t.y, 4);
      run.splat({ x: t.x, y: t.y + 2 }, 40, BLOOD, 0.85);
      run.shake(1.5, 0.12);
      return;
    }
    t.state = Act.Dead;
    t.timer = 0;
    t.vx = 0;
    t.vz = 0;
    t.spin = 0;
    const turned = t.rotation - TAU * Math.round(t.rotation / TAU);
    t.rotation = turned >= 0 ? Math.PI / 2 : -Math.PI / 2;
    run.play(BODY_FALL, -6, 0.95 + Math.random() * 0.1);
    this.dust(t.x, t.y, 3);
    if (t.pooled) return;
    // the pool spreads out from under the body towards the head
    const head = sign(t.rotation);
    run.splat({ x: t.x, y: t.y + 3 }, 60, BLOOD, 0.9);
    run.splat({ x: t.x + head * 26, y: t.y + 5 }, 40, DARK_BLOOD, 0.85);
  }

  bowled(t, vx) {
    if (t.kind === RIOT && t.armed) this.breakShield(t);
    this.launch(t, vx, 160 + Math.random() * 80, sign(vx) * (6 + Math.random() * 4));
    this.run.emit({ x: t.x, y: t.y - 40 }, 16, BLOOD, 1, 180, 1, 2.2, -Math.PI / 2, 2, 520, { floor: t.y + 1, depth: 12, stains: true });
    this.run.playAny(PUNCHES, -2);
    this.killed(t, 0);
  }

  /** A body on the street bleeds out into a pool and twitches. */
  lie(t, dt) {
    if (t.kind === SENTRY || t.timer > 3) return;
    if (!t.pooled && t.timer > 0.8) {
      t.pooled = true;
      this.run.splat({ x: t.x + sign(t.rotation) * 18 + (Math.random() - 0.5) * 10, y: t.y + 5 }, 80, DARK_BLOOD, 0.85);
    }
    if (Math.random() < dt * 6) {
      this.run.emit({ x: t.x, y: t.y - 8 }, 1, BLOOD, 1, 30, 0.5, 2, -Math.PI / 2, 1.2, 400, { floor: t.y + 1, depth: 6, stains: true });
    }
  }

  /** A sentry torn apart: it goes up in a small blast and leaves its wreck. */
  wreck(t) {
    t.state = Act.Dead;
    t.timer = 0;
    t.armed = false;
    t.diedAt = this.time;
    this.explode({ x: t.x, y: t.y }, 30, 0, false);
    for (let i = 0; i < 4; i++) {
      this.addDebris(5, { x: t.x, y: t.y - 30 }, t.y, (Math.random() - 0.5) * 260, 140 + Math.random() * 160, (Math.random() - 0.5) * 30);
    }
    this.score(KIND_POINTS[SENTRY], { x: t.x, y: t.y - 80 }, false);
  }

  // Bullets, shells, fire, debris and blasts ----------------------------------------------------------------------

  addBullet(bullet) {
    if (this.bullets.length < MAX_BULLETS) this.bullets.push(bullet);
  }

  addFlare(at) {
    if (this.flares.length < MAX_FLASHES) this.flares.push({ x: at.x, y: at.y, age: 0 });
  }

  removeAt(list, index) {
    list[index] = list[list.length - 1];
    list.pop();
  }

  updateBullets(dt) {
    const run = this.run;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      const ahead = b.vx > 0 ? b.x - this.x : this.x - b.x;
      if (!b.passed && ahead > 0) {
        b.passed = true;
        if (Math.abs(b.y - this.y) < BODY_DEPTH && ahead < HALF_WIDTH * 2 && b.z < BULLET_REACH_Z && this.pose !== Pose.Dead) {
          const at = { x: b.x, y: b.y - b.z };
          if (this.immune && this.hostile) {
            // it glances off the charging carapace
            run.emit(at, 5, TRACER_CORE, 1, 200, 0.25, 1, b.vx > 0 ? Math.PI : 0, 1.6, 0, { kind: SPARK });
            run.playAny(RICOCHETS, -10, 1.2);
            this.removeAt(this.bullets, i);
            continue;
          }
          if (this.takeDamage(b.damage, at)) {
            this.removeAt(this.bullets, i);
            continue;
          }
        }
      }
      // past the ravager, a stray round can find a marine on the far side
      if (b.passed && this.friendly(b)) {
        this.removeAt(this.bullets, i);
        continue;
      }
      if (b.x < this.cam - 40 || b.x > this.cam + SCREEN_W + 40) this.removeAt(this.bullets, i);
    }
    for (let i = this.flares.length - 1; i >= 0; i--) {
      this.flares[i].age += dt;
      if (this.flares[i].age >= 0.07) this.removeAt(this.flares, i);
    }
  }

  friendly(b) {
    const run = this.run;
    for (let i = 0; i < MAX_TROOPERS; i++) {
      const t = this.troopers[i];
      if (i === b.owner || !alive(t) || t.kind === SENTRY || Math.abs(t.x - b.x) > 8 || Math.abs(t.y - b.y) > 10) continue;
      const dir = sign(b.vx);
      this.launch(t, dir * 120, 120, dir * 5);
      run.emit({ x: t.x, y: t.y - b.z }, 18, BLOOD, 1, 180, 1, 2.2, dir > 0 ? 0 : Math.PI, 1.4, 520, { floor: t.y + 1, depth: 12, stains: true });
      run.playAny(FLESH, -2);
      run.pop(T.friendly, { x: t.x, y: t.y - 104 }, AMBER, 0.9);
      this.killed(t, 0);
      return true;
    }
    return false;
  }

  updateShells(dt) {
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const shell = this.shells[i];
      shell.age += dt;
      if (shell.age < SHELL_TIME) continue;
      this.removeAt(this.shells, i);
      this.explode({ x: shell.to.x, y: shell.to.y }, 38, SHELL_DAMAGE, false);
    }
  }

  shellAt(shell) {
    const k = clamp(shell.age / SHELL_TIME, 0, 1);
    return {
      x: shell.from.x + (shell.to.x - shell.from.x) * k,
      y: shell.from.y + (shell.to.y - shell.from.y) * k - Math.sin(k * Math.PI) * 70,
    };
  }

  addFire(x, y, size) {
    if (this.fires.length >= MAX_FIRES) return;
    this.fires.push({ x, y: clamp(y, STREET_TOP, STREET_BOTTOM + 4), age: 0, life: FIRE_LIFE * (0.8 + Math.random() * 0.4), size });
  }

  updateFires(dt) {
    let burning = false;
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const fire = this.fires[i];
      fire.age += dt;
      if (fire.age >= fire.life) {
        this.removeAt(this.fires, i);
        continue;
      }
      if (Math.random() < dt * 5) {
        this.run.emit({ x: fire.x, y: fire.y - 6 }, 1, BLACK, 0.5, 18, 1.2, 3, -Math.PI / 2, 0.6, -20, { kind: SMOKE });
      }
      if (Math.abs(fire.x - this.x) < fire.size + 12 && Math.abs(fire.y - this.y) < 8) burning = true;
    }
    if (burning) this.takeDamage(BURN_DPS * dt, { x: this.x, y: this.y - 10 }, true);
  }

  addDebris(kind, at, floor, vx, vz, spin) {
    this.debris[this.debrisNext] = {
      x: at.x,
      y: floor + (Math.random() - 0.5) * 6,
      z: floor - at.y,
      vx,
      vy: (Math.random() - 0.5) * 40,
      vz,
      spin,
      rotation: Math.random() * TAU,
      size: kind >= 5 ? 2 + Math.random() * 3 : GEAR_BOX,
      kind,
      resting: false,
    };
    this.debrisNext = (this.debrisNext + 1) % MAX_DEBRIS;
    this.debrisCount = Math.min(this.debrisCount + 1, MAX_DEBRIS);
  }

  updateDebris(dt) {
    for (let i = 0; i < this.debrisCount; i++) {
      const d = this.debris[i];
      if (d.resting) continue;
      d.x += d.vx * dt;
      d.y = clamp(d.y + d.vy * dt, STREET_TOP - 4, STREET_BOTTOM + 8);
      d.z += d.vz * dt;
      d.vz -= GRAVITY * dt;
      d.rotation += d.spin * dt;
      if (d.z > 0 || d.vz > 0) continue;
      d.z = 0;
      if (d.vz < -140) {
        d.vz = -d.vz * 0.35;
        d.vx *= 0.6;
        d.spin *= 0.6;
        if (d.kind < 5 && Math.random() < 0.6) this.run.play(METAL_HIT, -14, 1.5 + Math.random() * 0.3);
        continue;
      }
      d.resting = true;
      d.vx = d.vy = d.vz = d.spin = 0;
    }
  }

  /**
   * A blast at a ground point: fire, smoke and shrapnel, troopers in the radius thrown, bodies scattered, the ravager
   * hurt if it is close and not charging. Leaves a scorch mark and a few small fires.
   */
  explode(at, radius, damage, big) {
    const run = this.run;
    if (this.blasts.length < MAX_BLASTS) this.blasts.push({ x: at.x, y: at.y, age: 0, size: radius });
    const air = { x: at.x, y: at.y - 14 };
    run.emit(air, big ? 40 : 22, TRACER_GLOW, 1, big ? 260 : 190, 0.6, 3.4, -Math.PI / 2, TAU, -40, { kind: SMOKE });
    run.emit(air, big ? 24 : 12, BLACK, 0.6, 90, 1.6, 5, -Math.PI / 2, 1.8, -30, { kind: SMOKE });
    run.emit(air, big ? 30 : 16, TRACER_CORE, 1, 320, 0.4, 1, -Math.PI / 2, TAU, 400, { kind: SPARK });
    run.playAny(EXPLOSIONS, big ? 0 : -3);
    run.shake(big ? 7 : 4.5, big ? 0.6 : 0.35);
    run.flash(TRACER_GLOW, big ? 0.4 : 0.22, 0.25);
    this.scorches[this.scorchNext] = { x: at.x, y: at.y, size: radius * 0.8 };
    this.scorchNext = (this.scorchNext + 1) % MAX_SCORCHES;
    this.scorchCount = Math.min(this.scorchCount + 1, MAX_SCORCHES);
    for (let k = 0; k < (big ? 5 : 2); k++) {
      this.addFire(at.x + (Math.random() - 0.5) * radius * 1.4, at.y + (Math.random() - 0.5) * 14, 8 + Math.random() * 6);
    }

    for (const t of this.troopers) {
      if (!t.active || t.kind === SENTRY || Math.abs(t.x - at.x) > radius || Math.abs(t.y - at.y) > radius * 0.5) continue;
      const away = t.x >= at.x ? 1 : -1;
      if (t.state === Act.Dead) {
        t.state = Act.Flying;
        t.vx = away * (120 + Math.random() * 80);
        t.vz = 200 + Math.random() * 100;
        t.spin = away * 8;
        t.pooled = true;
        continue;
      }
      if (!alive(t)) continue;
      if (t.kind === RIOT && t.armed) this.breakShield(t);
      this.launch(t, away * (180 + Math.random() * 80), 280 + Math.random() * 100, away * (8 + Math.random() * 6));
      run.emit({ x: t.x, y: t.y - 30 }, 20, BLOOD, 1, 220, 1.2, 2.6, -Math.PI / 2, 2.4, 520, { floor: t.y + 1, depth: 14, stains: true });
      this.killed(t, 1);
    }

    if (damage > 0 && Math.abs(this.x - at.x) < radius + 10 && Math.abs(this.y - at.y) < radius * 0.5 + 6
      && this.takeDamage(damage, { x: this.x, y: this.y - 50 })) {
      this.push = (this.x >= at.x ? 1 : -1) * 240;
    }
  }

  updateBlasts(dt) {
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      this.blasts[i].age += dt;
      if (this.blasts[i].age >= 0.45) this.removeAt(this.blasts, i);
    }
  }

  // The APC -------------------------------------------------------------------------------------------------------

  arriveApc() {
    this.apc = 1;
    this.apcX = this.cam + SCREEN_W + APC_HALF + 30;
    this.apcHp = APC_HEALTH;
    this.apcTimer = 0;
    this.apcDoor = 0;
    this.apcDropTimer = 1.5;
    this.apcDrops = 0;
    this.apcFire = 2;
    this.apcAim = -1;
    this.apcHurt = 0;
    this.apcRecoil = 0;
    this.apcBooms = 0;
    this.run.play(ENGINE, -2);
  }

  get apcPark() {
    return this.cam + 226;
  }

  updateApc(dt) {
    if (this.apc === 0) return;
    const run = this.run;
    this.apcTimer += dt;
    this.apcHurt -= dt;
    this.apcRecoil = Math.max(0, this.apcRecoil - dt * 4);
    if (this.apc === 1) {
      const from = this.cam + SCREEN_W + APC_HALF + 30;
      const k = clamp(this.apcTimer / APC_DRIVE_TIME, 0, 1);
      const x = from + (this.apcPark - from) * (1 - (1 - k) * (1 - k));
      this.apcWheel -= (this.apcX - x) / 11;
      this.apcX = x;
      if (Math.random() < dt * 20) this.dust(this.apcX + APC_HALF, APC_Y, 2);
      if (k >= 1) {
        this.apc = 2;
        this.apcTimer = 0;
        run.play(HYDRAULICS, -4);
      }
      return;
    }

    if (this.apc === 3) {
      // the wreck burns, and goes up again a couple of times
      if (this.apcBooms < 3) {
        this.apcBoomTimer -= dt;
        if (this.apcBoomTimer <= 0) {
          this.apcBooms++;
          this.apcBoomTimer = 0.45;
          this.explode({ x: this.apcX + (Math.random() - 0.5) * APC_HALF * 1.4, y: APC_Y + 2 }, 40, 0, false);
        }
      }
      if (Math.random() < dt * 14) {
        run.emit({ x: this.apcX + (Math.random() - 0.5) * APC_HALF * 1.6, y: APC_Y - 50 }, 1, BLACK, 0.6, 24, 2, 5, -Math.PI / 2, 0.5, -14,
          { kind: SMOKE });
      }
      return;
    }

    if (this.apcHp < APC_HEALTH / 2 && Math.random() < dt * 8) {
      run.emit({ x: this.apcX + (Math.random() - 0.5) * APC_HALF, y: APC_Y - 52 }, 1, BLACK, 0.5, 20, 1.6, 4, -Math.PI / 2, 0.5, -14,
        { kind: SMOKE });
    }
    if (!this.hostile) return;

    // the rear door drops a marine at a time
    this.apcDropTimer -= dt;
    if (this.apcDoor > 0 || (this.apcDropTimer <= 0 && this.apcDrops < APC_DROPS && this.livingCount() < 9)) {
      const before = this.apcDoor;
      this.apcDoor += dt;
      if (before < 0.4 && this.apcDoor >= 0.4) {
        this.apcDrops++;
        run.play(HYDRAULICS, -8, 1.2);
        const kind = this.apcDrops % 3 === 0 ? SMARTGUNNER : this.apcDrops % 3 === 1 ? RIFLEMAN : FLAMER;
        const t = this.addTrooper(kind, this.apcX - 2, APC_Y + 12);
        if (t) t.cooldown = 1.2;
      }
      if (this.apcDoor >= 1) {
        this.apcDoor = 0;
        this.apcDropTimer = APC_DROP_EVERY;
      }
    }

    // the turret lobs a round onto wherever the ravager stands, the impact marked on the ground
    if (this.apcAim >= 0) {
      this.apcAim += dt;
      if (this.apcAim < 0.7) return;
      this.apcAim = -1;
      this.fireCannon();
      if (this.apcHp < APC_HEALTH / 4) this.apcFire = 0.6;
      return;
    }
    this.apcFire -= dt;
    if (this.apcFire <= 0) {
      this.apcFire = APC_FIRE_EVERY;
      this.apcAim = 0;
    }
  }

  livingCount() {
    let count = 0;
    for (const t of this.troopers) if (alive(t)) count++;
    return count;
  }

  /** The APC sprite's centre, rocking as it drives and kicking back as it fires. */
  apcCentre() {
    const rock = this.apc === 1 ? Math.sin(this.apcTimer * 30) * 0.8 : 0;
    return { x: this.apcX + this.apcRecoil * 3, y: APC_Y - 48 * APC_SCALE + rock };
  }

  /** The tip of the turret's twin barrels, which face down the street. */
  barrelTip() {
    const centre = this.apcCentre();
    return { x: centre.x + 12 * APC_SCALE, y: centre.y - 27 * APC_SCALE };
  }

  fireCannon() {
    if (this.shells.length >= MAX_SHELLS) return;
    const run = this.run;
    const tip = this.barrelTip();
    this.shells.push({ from: tip, to: { x: this.x, y: this.y }, age: 0 });
    this.apcRecoil = 1;
    this.addFlare(tip);
    run.play(CANNON, -1);
    run.shake(2, 0.15);
    run.emit(tip, 6, BLACK, 0.5, 40, 1, 4, -Math.PI / 2, 1.2, -20, { kind: SMOKE });
  }

  damageApc(damage, at) {
    if (this.apc !== 1 && this.apc !== 2) return;
    const run = this.run;
    this.apcHp -= damage;
    this.apcHurt = 0.12;
    this.sparks(at, 16);
    run.play(METAL_HIT, -1, 0.8 + Math.random() * 0.2);
    this.addDebris(6, at, APC_Y + 4, this.facing * (80 + Math.random() * 120), 140 + Math.random() * 100, (Math.random() - 0.5) * 20);
    if (this.apcHp > 0) return;

    // the hull splits open: a big blast, a slow moment, and the heavy squad's ride is scrap
    this.apc = 3;
    this.apcBooms = 0;
    this.apcBoomTimer = 0.4;
    this.apcDoor = 0;
    this.shells.length = 0;
    this.explode({ x: this.apcX, y: APC_Y + 4 }, 70, 0, true);
    run.play(BIG_BOOM, 0);
    run.slowMotion(0.5);
    run.flash(WHITE, 0.5, 0.4);
    for (let i = 0; i < 6; i++) {
      this.addDebris(6, { x: this.apcX + (Math.random() - 0.5) * APC_HALF, y: APC_Y - 40 }, APC_Y + 6, (Math.random() - 0.5) * 300,
        200 + Math.random() * 200, (Math.random() - 0.5) * 30);
    }
    this.kills++;
    this.combo++;
    this.comboTime = COMBO_WINDOW;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    run.bonus(APC_BONUS, { x: this.apcX, y: APC_Y - 90 }, ACID);
  }

  // Waves, camera, ambience ---------------------------------------------------------------------------------------

  startWave(wave) {
    this.wave = wave;
    this.waveTime = 0;
    this.spawned = 0;
    this.waveState = WaveState.Fight;
    this.banner = wave === 0 ? 0 : 1.6;
    this.waveText = wave === WAVES.length - 1 ? T.final : T.wave(wave + 1);
    this.waveCount = T.waveCount(wave + 1, WAVES.length);
    if (wave > 0) this.run.play(RADIO, -8);
  }

  anyHostile() {
    if (this.apc === 1 || this.apc === 2) return true;
    return this.troopers.some(alive);
  }

  updateWaves(dt) {
    if (this.banner > 0) this.banner -= dt;
    if (this.cheer > 0) this.cheer -= dt;
    if (!this.hostile || this.run.attract) return;
    const wave = WAVES[this.wave];
    switch (this.waveState) {
      case WaveState.Fight:
        this.waveTime += dt;
        while (this.spawned < wave.length && wave[this.spawned].at <= this.waveTime) this.spawnWave(wave[this.spawned++]);
        if (this.wave === WAVES.length - 1 && this.apc === 0) this.arriveApc();
        if (this.spawned < wave.length || this.anyHostile() || this.waveTime < 1) return;
        this.run.bonus(WAVE_BONUS * (this.wave + 1), { x: this.x, y: this.y - 120 }, ACID);
        if (this.wave === WAVES.length - 1) {
          this.startFinale();
          return;
        }
        this.waveState = WaveState.Advance;
        break;
      case WaveState.Advance:
        if (this.cam >= this.arenaX(this.wave + 1) - 0.5) this.startWave(this.wave + 1);
        break;
    }
  }

  updateCamera(dt) {
    if (this.waveState === WaveState.Advance) {
      // the street scrolls on only forwards, as far as the next fight
      const target = clamp(this.x - 130, this.cam, this.arenaX(this.wave + 1));
      this.cam = moveTowards(this.cam, target, 200 * dt);
    }
    this.run.camera = { x: this.cam, y: 0 };
  }

  ambience(dt) {
    const run = this.run;
    this.ambient -= dt;
    if (Math.random() < dt * 6) {
      // embers off the burning colony
      run.emit({ x: this.cam + Math.random() * SCREEN_W, y: 118 + Math.random() * 10 }, 1, TRACER_GLOW, 0.7, 20, 2.4, 1, -Math.PI / 2, 1, -12,
        { kind: SPARK });
    }
    if (this.ambient > 0) return;
    this.ambient = 4 + Math.random() * 5;
    const roll = Math.random();
    if (roll < 0.3) {
      run.play(DISTANT_ROAR, -16, 0.9 + Math.random() * 0.2);
    } else if (roll < 0.55) {
      run.playAny(EXPLOSIONS, -22, 0.8);
    } else {
      const shots = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < shots; i++) run.pend(i * 0.1, RIFLE_SHOT, -20, 0.75);
    }
  }

  // The finale ----------------------------------------------------------------------------------------------------

  startFinale() {
    const run = this.run;
    this.finale = 0;
    this.tallyShown = 0;
    this.setPose(Pose.Roar);
    this.frenzy = 0;
    this.rage = 0;
    this.waveState = WaveState.Done;
    this.tally[0] = this.entryScore;
    this.tally[1] = run.points - this.entryScore;
    this.tally[2] = this.kills;
    this.tally[3] = this.bestCombo * COMBO_BONUS;
    this.tally[4] = Math.ceil(this.hp) * HEALTH_BONUS;
    run.playAny(ECHO_ROARS);
    run.slowMotion(0.8);
    run.flash(ACID, 0.3, 0.5);
    run.shake(4, 0.6);
  }

  updateFinale(dt) {
    if (this.finale < 0 || this.run.over) return;
    const run = this.run;
    this.finale += dt;
    const due = clamp(Math.floor((this.finale - TALLY_START) / TALLY_ROW) + 1, 0, TALLY_ROWS);
    while (this.tallyShown < due) {
      const row = this.tallyShown++;
      run.play(TICK, -4, row === TALLY_ROWS - 1 ? 0.8 : 1.1);
      if (row === 3 || row === 4) run.addScore(this.tally[row]);
      if (row === TALLY_ROWS - 1) {
        this.tally[row] = run.points;
        run.shake(2, 0.2);
      }
    }
    if (this.finale >= WIN_AFTER) run.win(T.victory);
  }

  // Drawing -------------------------------------------------------------------------------------------------------

  tilt() {
    const clock = this.run.clock;
    switch (this.pose) {
      case Pose.Walk:
        return this.moving ? Math.sin(this.stride) * 0.03 : Math.sin(clock * 2) * 0.01;
      case Pose.Slash: {
        const strike = STRIKE_AT * (this.frenzy > 0 ? 0.7 : 1);
        if (this.timer < strike) return -this.facing * 0.07 * (this.timer / strike);
        const k = clamp((this.timer - strike) / (this.slashLength - strike), 0, 1);
        return this.facing * (this.slash === 2 ? 0.2 : 0.14) * (1 - k);
      }
      case Pose.Windup:
        return -this.facing * 0.09;
      case Pose.Charge:
        return this.facing * 0.16;
      case Pose.Skid:
        return -this.facing * 0.07 * (1 - clamp(this.timer / SKID_TIME, 0, 1));
      case Pose.Roar:
        return -this.facing * 0.12 * clamp(this.timer / 0.3, 0, 1) + Math.sin(clock * 40) * 0.015;
      default:
        return 0;
    }
  }

  ravagerSize() {
    let w = 1;
    let h = 1;
    switch (this.pose) {
      case Pose.Windup: w = 1.06; h = 0.92; break;
      case Pose.Charge: w = 1.08; h = 0.94; break;
      case Pose.Roar: w = 0.97; h = 1.07; break;
      case Pose.Walk: if (this.moving) h = 1 - Math.abs(Math.sin(this.stride)) * 0.03; break;
    }
    return { w: w * RAVAGER_BOX, h: h * RAVAGER_BOX };
  }

  drawBack(ctx) {
    this.drawSky(ctx);
    this.drawSkyline(ctx, this.cam * 0.22);
    this.drawBuildings(ctx, this.cam * 0.55);
    this.drawStreet(ctx);
  }

  drawSky(ctx) {
    const clock = this.run.clock;
    fill(ctx, 0, HUD_HEIGHT, SCREEN_W, CURB_Y - HUD_HEIGHT, SKY);
    // the colony burns along the horizon
    for (let k = 0; k < 6; k++) fill(ctx, 0, 82 + k * 8, SCREEN_W, 8, TRACER_GLOW, 0.008 + k * 0.007);
    // drifting smoke plumes, very far off
    const u = this.cam * 0.08;
    for (let c = Math.floor(u / 120) - 1; c * 120 - u < SCREEN_W + 60; c++) {
      const x = c * 120 - u + hash01(c, 1) * 60;
      for (let k = 0; k < 5; k++) {
        const drift = (clock * 3 + k * 9) % 45;
        circle(ctx, x + k * 6 + drift * 0.4, 100 - k * 14 - drift * 0.3, 10 + k * 4, BLACK, 0.28);
      }
    }
  }

  drawSkyline(ctx, u) {
    const clock = this.run.clock;
    const cell = 26;
    const baseY = 122;
    for (let c = Math.floor(u / cell); c * cell - u < SCREEN_W; c++) {
      const x = c * cell - u;
      if (hash(c) % 23 === 0) {
        // an atmosphere processor, its warning light blinking
        fill(ctx, x + 4, baseY - 96, 18, 96, FAR_COLOUR);
        fill(ctx, x, baseY - 70, 26, 6, FAR_COLOUR);
        fill(ctx, x + 4, baseY - 96, 18, 1, DIM, 0.4);
        if (clock % 1.4 < 0.7) circle(ctx, x + 13, baseY - 99, 1.6, ALARM);
        continue;
      }
      const height = 14 + hash01(c, 1) * 46;
      fill(ctx, x, baseY - height, cell + 0.5, height, FAR_COLOUR);
      fill(ctx, x, baseY - height, cell, 1, DIM, 0.25);
      for (let k = 0; k < 4; k++) {
        if (hash01(c, k + 7) < 0.55) continue;
        const wy = baseY - height + 5 + hash01(c, k + 20) * (height - 10);
        const amber = hash01(c, k + 40) < 0.3;
        fill(ctx, x + 3 + k * 5.5, wy, 2, 1.5, amber ? AMBER : DIM, amber ? 0.5 : 0.45);
      }
    }
  }

  drawBuildings(ctx, u) {
    const clock = this.run.clock;
    const cell = 70;
    for (let c = Math.floor(u / cell); c * cell - u < SCREEN_W; c++) {
      const x = c * cell - u;
      const h = hash(c + 101);
      if (h % 5 === 0) continue;
      const height = 34 + hash01(c, 51) * 32;
      const width = cell - 8;
      const top = CURB_Y - height;
      const burning = h % 4 === 1;
      fill(ctx, x + 4, top, width, height, BUILDING_COLOUR);
      fill(ctx, x + 4, top, width, 1.2, GREEN, 0.35);
      fill(ctx, x + 4, top, 1, height, DIM, 0.4);
      fill(ctx, x + 3, top + 6, width + 2, 2, DIM, 0.3);

      // windows, some lit, some on fire
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 4; col++) {
          const wx = x + 10 + col * 14;
          const wy = top + 12 + row * 14;
          if (wy + 8 > CURB_Y - 14) continue;
          const roll = hash01(c * 8 + row * 4 + col, 3);
          if (burning && roll < 0.5) {
            const flicker = 0.55 + 0.45 * Math.sin(clock * (9 + roll * 7) + col);
            fill(ctx, wx, wy, 8, 7, mix(ALARM, TRACER_GLOW, flicker), 0.75);
          } else if (roll < 0.35) {
            fill(ctx, wx, wy, 8, 7, DIM, 0.7);
          } else if (roll < 0.5) {
            fill(ctx, wx, wy, 8, 7, BRIGHT, 0.35);
          } else {
            fill(ctx, wx, wy, 8, 7, BLACK, 0.8);
          }
        }
      }

      // the colony's landing sign on a roof here and there
      if (h % 7 === 3) sprite(ctx, this.run.frame(LANDING_SIGNS, 'laz_sign', SOUTH, 0, PROP_TINT), x + 4 + width / 2, top - 26 * 0.9, 64 * 0.9, 64 * 0.9);

      // a door at street level
      fill(ctx, x + width - 12, CURB_Y - 16, 10, 16, BLACK, 0.8);
      fill(ctx, x + width - 12, CURB_Y - 16, 10, 1, DIM, 0.6);
      if (!burning) continue;

      // flames licking off the roof, with a glow above
      ellipse(ctx, x + 4 + width / 2, top, width * 0.6, 10, TRACER_GLOW, 0.08);
      for (let k = 0; k < 5; k++) {
        const fx = x + 10 + k * (width - 12) / 4;
        const lick = 6 + 6 * Math.abs(Math.sin(clock * (6 + k) + c * 3 + k));
        quad(ctx, fx - 4, top, fx + 4, top, fx + 1, top - lick, fx - 1, top - lick, TRACER_GLOW, 0.6);
        quad(ctx, fx - 2, top, fx + 2, top, fx, top - lick * 0.6, fx, top - lick * 0.6, TRACER_CORE, 0.7);
      }
    }
  }

  drawStreet(ctx) {
    const clock = this.run.clock;
    const cam = this.cam;
    fill(ctx, 0, CURB_Y, SCREEN_W, SCREEN_H - CURB_Y, TARMAC);

    // the colony's own asphalt tiles, laid in staggered rows and squashed for the slant of the street
    for (let row = 0; row < 6; row++) {
      const shift = (row % 2) * 16;
      const y = CURB_Y + 6 + row * 15 + 7.5;
      for (let c = Math.floor((cam - shift) / 32); c * 32 + shift - cam < SCREEN_W; c++) {
        const image = (hash(c * 7 + row) % 5 === 0 ? this.asphaltWorn : this.asphalt)?.image;
        sprite(ctx, image, c * 32 + shift - cam + 16, y, 32, 15);
      }
    }

    fill(ctx, 0, CURB_Y, SCREEN_W, 5, KERB);
    fill(ctx, 0, CURB_Y, SCREEN_W, 1, GREEN, 0.5);
    fill(ctx, 0, CURB_Y + 5, SCREEN_W, 1, DIM, 0.5);

    // the seams of the street run off to a point on the horizon
    for (let c = Math.floor((cam - 160) / 48); c * 48 - cam < SCREEN_W + 160; c++) {
      const sx = c * 48 - cam;
      line(ctx, sx, CURB_Y + 6, sx + (sx - SCREEN_W / 2) * 0.9, SCREEN_H, DIM, 0.18);
    }
    fill(ctx, 0, 156, SCREEN_W, 1, DIM, 0.12);
    fill(ctx, 0, 196, SCREEN_W, 1, DIM, 0.12);

    // a dashed centre line, hazard paint on the kerb, cracks and grates
    for (let c = Math.floor(cam / 40); c * 40 - cam < SCREEN_W; c++) {
      const sx = c * 40 - cam;
      fill(ctx, sx, 175, 20, 1.5, AMBER, 0.28);
      const h = hash(c + 333);
      if (h % 3 === 0) {
        for (let k = 0; k < 5; k++) {
          const hx = sx + k * 8;
          quad(ctx, hx, CURB_Y + 1, hx + 4, CURB_Y + 1, hx + 1, CURB_Y + 5, hx - 3, CURB_Y + 5, AMBER, 0.35);
        }
      }
      if (h % 7 === 2) {
        const cy = 150 + hash01(c, 9) * 50;
        line(ctx, sx + 5, cy, sx + 14, cy + 3, BLACK, 0.7);
        line(ctx, sx + 14, cy + 3, sx + 22, cy + 1, BLACK, 0.7);
      }
      if (h % 11 === 5) {
        const gy = 160 + hash01(c, 13) * 36;
        fill(ctx, sx + 8, gy, 18, 6, BLACK, 0.6);
        for (let k = 0; k < 4; k++) fill(ctx, sx + 9 + k * 4.5, gy + 1, 1.5, 4, DIM, 0.4);
      }
    }

    this.drawKerb(ctx, cam);

    // floodlight towers along the kerb, a few of them flickering
    for (let c = Math.floor((cam - 40) / 192); c * 192 + 40 - cam < SCREEN_W + 40; c++) {
      const sx = c * 192 + 40 - cam;
      const on = hash(c + 77) % 4 !== 0 || Math.sin(clock * 13 + c) + Math.sin(clock * 7.1 + c * 2) > -0.4;
      if (on) {
        quad(ctx, sx - 6, 64, sx + 6, 64, sx + 40, CURB_Y + 40, sx - 40, CURB_Y + 40, GREEN, 0.035);
        ellipse(ctx, sx, CURB_Y + 30, 42, 9, GREEN, 0.045);
      }
      sprite(ctx, this.run.frame(FLOODLIGHT, on ? 'illuminator_on' : 'illuminator', SOUTH, 0, PROP_TINT), sx, CURB_Y + 3 - 43 * 0.9, 32 * 0.9, 96 * 0.9);
    }

    for (let i = 0; i < this.scorchCount; i++) {
      const scorch = this.scorches[i];
      const x = scorch.x - cam;
      ellipse(ctx, x, scorch.y + 2, scorch.size, scorch.size * 0.3, BLACK, 0.5);
      ellipse(ctx, x, scorch.y + 2, scorch.size * 0.6, scorch.size * 0.18, BLACK, 0.4);
    }
  }

  /**
   * What the marines left along the kerb: sandbag walls, barbed wire, ammo crates, barrels and burnt-out trucks, all
   * the game's own sprites, one pick per stretch of street.
   */
  drawKerb(ctx, cam) {
    const run = this.run;
    const clock = run.clock;
    const scale = 1.4;
    const box = 32 * scale;
    const ground = CURB_Y + 4;
    for (let c = Math.floor((cam - 120) / 150); c * 150 - cam < SCREEN_W + 60; c++) {
      const sx = c * 150 + 60 - cam;
      const h = hash(c + 909);
      switch (h % 6) {
        case 0:
          // a sandbag wall, two courses high
          for (let k = 0; k < 3; k++) sprite(ctx, run.frame(BARRICADES, 'sandbag', SOUTH, 0, PROP_TINT), sx + k * box, ground - 14 * scale, box, box);
          for (let k = 0; k < 2; k++) sprite(ctx, run.frame(BARRICADES, 'sandbag', SOUTH, 0, PROP_TINT), sx + box / 2 + k * box, ground - 14 * scale - 12, box, box);
          break;
        case 1:
          sprite(ctx, run.frame(BARRICADES, 'sandbag_wire', SOUTH, 0, PROP_TINT), sx, ground - 14 * scale, box, box);
          for (let k = 1; k < 3; k++) sprite(ctx, run.frame(RAZORWIRE, 'barbed_wire', SOUTH, 0, PROP_TINT), sx + k * box, ground - 9 * scale, box, box);
          break;
        case 2:
          // a crate stack with a barrel beside it
          sprite(ctx, run.frame(AMMO_CRATE, 'closed', SOUTH, 0, PROP_TINT), sx, ground - 10 * scale, box, box);
          sprite(ctx, run.frame(BASIC_CRATE, 'closed', SOUTH, 0, PROP_TINT), sx + 4, ground - 10 * scale - 18, box, box);
          sprite(ctx, run.frame(BARRELS, 'barrel_red', SOUTH, 0, PROP_TINT), sx + 34, ground - 14 * scale, box, box);
          break;
        case 3: {
          // a truck caught in the fighting, still smouldering
          const tx = sx + 30;
          const ty = ground - 29 * 1.3;
          sprite(ctx, run.frame(TRUCKS, 'truck_damaged', h % 2 === 0 ? EAST : WEST, 0, PROP_TINT), tx, ty, 64 * 1.3, 64 * 1.3);
          for (let k = 0; k < 3; k++) {
            const fx = tx - 14 + k * 14;
            const top = ty - 18;
            const lick = 5 + 5 * Math.abs(Math.sin(clock * (8 + k) + c + k));
            quad(ctx, fx - 4, top, fx + 4, top, fx + 1, top - lick, fx - 1, top - lick, TRACER_GLOW, 0.6);
          }
          break;
        }
        case 4:
          sprite(ctx, run.frame(BARRELS, 'barrel_yellow', SOUTH, 0, PROP_TINT), sx, ground - 14 * 1.2, 38, 38);
          sprite(ctx, run.frame(BARRELS, 'barrel_blue', SOUTH, 0, PROP_TINT), sx + 20, ground - 14 * 1.2 + 2, 38, 38);
          break;
      }
    }
  }

  drawFront(ctx) {
    this.drawShadows(ctx);
    this.drawFires(ctx);
    this.drawDebris(ctx, true);

    // everything standing on the street, back to front
    const order = this.order;
    const depths = this.depths;
    let count = 0;
    order[count] = -1;
    depths[count++] = this.y;
    if (this.apc !== 0) {
      order[count] = -2;
      depths[count++] = APC_Y;
    }
    for (let i = 0; i < MAX_TROOPERS; i++) {
      const t = this.troopers[i];
      if (!t.active || t.x < this.cam - 80 || t.x > this.cam + SCREEN_W + 80) continue;
      order[count] = i;
      depths[count++] = t.state === Act.Dead ? t.y - 3 : t.y;
    }
    for (let i = 1; i < count; i++) {
      const index = order[i];
      const depth = depths[i];
      let j = i - 1;
      while (j >= 0 && depths[j] > depth) {
        order[j + 1] = order[j];
        depths[j + 1] = depths[j];
        j--;
      }
      order[j + 1] = index;
      depths[j + 1] = depth;
    }
    for (let i = 0; i < count; i++) {
      if (order[i] === -1) this.drawRavager(ctx);
      else if (order[i] === -2) this.drawApc(ctx);
      else this.drawTrooper(ctx, this.troopers[order[i]]);
    }

    this.drawDebris(ctx, false);
    this.drawFire(ctx);
    this.drawBlasts(ctx);
    this.drawClaws(ctx);
  }

  drawShadows(ctx) {
    if (this.pose !== Pose.Dead) ellipse(ctx, this.x - this.cam, this.y + 1, 30, 5, BLACK, 0.45);
    for (const t of this.troopers) {
      if (!t.active) continue;
      const lift = 1 - Math.min(t.z, 120) / 160;
      const lying = Math.abs(Math.sin(t.rotation));
      ellipse(ctx, t.x - this.cam, t.y + 1, (11 + lying * 16) * lift, 3 * lift, BLACK, 0.45);
    }
    if (this.apc !== 0) ellipse(ctx, this.apcX - this.cam, APC_Y + 1, APC_HALF + 16, 6, BLACK, 0.45);
  }

  drawFires(ctx) {
    const clock = this.run.clock;
    for (let i = 0; i < this.fires.length; i++) {
      const fire = this.fires[i];
      const fade = clamp((fire.life - fire.age) / 0.6, 0, 1) * clamp(fire.age / 0.15, 0, 1);
      const x = fire.x - this.cam;
      const y = fire.y;
      ellipse(ctx, x, y, fire.size * 1.4, fire.size * 0.4, TRACER_GLOW, 0.14 * fade);
      for (let k = 0; k < 3; k++) {
        const fx = x + (k - 1) * fire.size * 0.55;
        const lick = fire.size * (0.8 + 0.6 * Math.abs(Math.sin(clock * (11 + k * 3) + i * 1.7 + k))) * fade;
        const half = fire.size * 0.32;
        quad(ctx, fx - half, y, fx + half, y, fx + 1, y - lick, fx - 1, y - lick, ALARM, 0.55 * fade);
        quad(ctx, fx - half * 0.6, y, fx + half * 0.6, y, fx, y - lick * 0.7, fx, y - lick * 0.7, TRACER_GLOW, 0.75 * fade);
      }
    }
  }

  drawDebris(ctx, resting) {
    for (let i = 0; i < this.debrisCount; i++) {
      const d = this.debris[i];
      if (d.resting !== resting) continue;
      const x = d.x - this.cam;
      const y = d.y - d.z - (d.kind >= 5 ? 1 : 3);
      if (x < -40 || x > SCREEN_W + 40) continue;
      if (d.kind >= 5) {
        const size = d.kind === 6 ? d.size * 2 : d.size;
        const sin = Math.sin(d.rotation);
        const cos = Math.cos(d.rotation);
        const ax = cos * size;
        const ay = sin * size;
        const bx = -sin * size * 0.6;
        const by = cos * size * 0.6;
        quad(ctx, x - ax - bx, y - ay - by, x + ax - bx, y + ay - by, x + ax + bx, y + ay + by, x - ax + bx, y - ay + by,
          d.kind === 6 ? HULL : SHARD);
        continue;
      }
      sprite(ctx, this.gearImage(d.kind), x, y, d.size, d.size, d.rotation);
    }
  }

  gearImage(kind) {
    const run = this.run;
    switch (kind) {
      case SMARTGUNNER: return run.frame(SMART_GUN, 'Icon');
      case FLAMER: return run.frame(M34, 'icon');
      case RIOT: return run.frame(SHIELDS, 'riot-icon');
      case SENTRY: return run.frame(SENTRY_RSI, 'normal_uac_sentry_destroyed');
      default: return run.frame(M41, 'icon');
    }
  }

  drawRavager(ctx) {
    const run = this.run;
    const clock = run.clock;
    const sx = this.x - this.cam;
    const direction = this.facing > 0 ? EAST : WEST;
    if (this.pose === Pose.Dead) {
      // staggers, goes down in a heap
      const k = clamp(this.timer / 0.55, 0, 1);
      if (k < 1) {
        sprite(ctx, run.frame(RAVAGER, 'crit'), sx - this.facing * 10 * k, this.y - RAVAGER_BOX / 2 + 10 * k, RAVAGER_BOX, RAVAGER_BOX,
          -this.facing * 0.5 * k);
        return;
      }
      sprite(ctx, run.frame(RAVAGER, 'dead'), sx - this.facing * 10, this.y - RAVAGER_BOX * 0.42, RAVAGER_BOX, RAVAGER_BOX);
      return;
    }

    for (let i = 0; i < this.ghostCount; i++) {
      const ghost = this.ghosts[i];
      const fade = 1 - ghost.age / 0.25;
      if (fade <= 0) continue;
      const image = run.frame(RAVAGER, 'alive', ghost.facing > 0 ? EAST : WEST, 0, this.frenzy > 0 ? FRENZY_TINT : ACID);
      sprite(ctx, image, ghost.x - this.cam, ghost.y - RAVAGER_BOX / 2, RAVAGER_BOX, RAVAGER_BOX, ghost.tilt, 0.3 * fade);
    }

    const { w, h } = this.ravagerSize();
    let bob = 0;
    if (this.pose === Pose.Walk && this.moving) bob = Math.abs(Math.sin(this.stride)) * 2.2;
    else if (this.pose === Pose.Charge) bob = Math.abs(Math.sin(clock * 30)) * 2;
    const jitter = this.pose === Pose.Windup ? (Math.random() - 0.5) * 2 : 0;
    const cx = sx + jitter;
    const cy = this.y - h / 2 - bob;
    const tilt = this.tilt();
    if (this.frenzy > 0) ellipse(ctx, cx, cy, w * 0.45, h * 0.5, ALARM, 0.08 + 0.05 * Math.sin(clock * 18));
    sprite(ctx, run.frame(RAVAGER, 'alive', direction), cx, cy, w, h, tilt);
    // tints are layered over the phosphor sprite: the frenzy's pulsing red, a hit's flash
    if (this.frenzy > 0) {
      sprite(ctx, run.frame(RAVAGER, 'alive', direction, 0, FRENZY_TINT), cx, cy, w, h, tilt, 0.35 + 0.25 * Math.sin(clock * 18));
    }
    if (this.hurt > 0) sprite(ctx, run.frame(RAVAGER, 'alive', direction, 0, HURT_TINT), cx, cy, w, h, tilt, 0.55);
  }

  drawTrooper(ctx, t) {
    const run = this.run;
    const sx = t.x - this.cam;
    const direction = t.facing > 0 ? EAST : WEST;
    if (t.kind === SENTRY) {
      this.drawSentry(ctx, t, sx, direction);
      return;
    }
    let rotation = t.rotation;
    let bob = 0;
    switch (t.state) {
      case Act.Move:
        bob = Math.abs(Math.sin(t.step)) * 2;
        rotation = t.kind === RIOT ? t.facing * 0.05 : 0;
        break;
      case Act.Aim:
        rotation = t.kind === RIOT ? -t.facing * 0.1 * Math.min(1, t.timer / 0.3) : -t.facing * 0.03;
        break;
      case Act.Fire:
        rotation = t.kind === RIOT ? t.facing * 0.2 : -t.facing * 0.05 * Math.abs(Math.sin(t.timer * 60));
        break;
      case Act.Stagger:
        rotation = -t.facing * 0.35 * (1 - t.timer / STAGGER_TIME);
        break;
      case Act.Dead:
        if (t.timer < 1.5) rotation += Math.sin(t.timer * 50) * 0.03 * (1 - t.timer / 1.5);
        break;
    }
    const lift = HUMAN_SCALE * (16 - 11 * Math.abs(Math.sin(rotation)));
    const cy = t.y - t.z - lift - bob;
    run.drawPerson(ctx, t.person, sx, cy, direction, HUMAN_SCALE, rotation, true);
    if (!t.armed) return;
    switch (t.kind) {
      case SMARTGUNNER:
        sprite(ctx, run.frame(SMART_PACK, BACKPACK, direction), sx, cy, HUMAN_BOX, HUMAN_BOX, rotation);
        sprite(ctx, run.frame(SMART_GUN, WIELDED, direction), sx, cy, HUMAN_BOX, HUMAN_BOX, rotation);
        break;
      case FLAMER:
        sprite(ctx, run.frame(FUEL_PACK, BACKPACK, direction), sx, cy, HUMAN_BOX, HUMAN_BOX, rotation);
        sprite(ctx, run.frame(M34, WIELDED, direction), sx, cy, HUMAN_BOX, HUMAN_BOX, rotation);
        if ((t.state === Act.Aim || t.state === Act.Fire) && run.clock % 0.1 < 0.06) {
          const muzzle = this.muzzle(t);
          circle(ctx, muzzle.x - this.cam, muzzle.y, 1.8, TRACER_GLOW);
        }
        break;
      case RIOT:
        // the shield, held square in front
        sprite(ctx, run.frame(SHIELDS, 'riot-icon'), sx + t.facing * 9, cy + 2, HUMAN_BOX * 0.75, HUMAN_BOX, rotation);
        break;
      default:
        sprite(ctx, run.frame(M41, WIELDED, direction), sx, cy, HUMAN_BOX, HUMAN_BOX, rotation);
        break;
    }
  }

  drawSentry(ctx, t, sx, direction) {
    const run = this.run;
    if (t.state === Act.Dead) {
      sprite(ctx, run.frame(SENTRY_RSI, 'defense_base', SOUTH, 0, BASE_TINT), sx, t.y - HUMAN_SCALE * 2, HUMAN_BOX, HUMAN_BOX);
      sprite(ctx, run.frame(SENTRY_RSI, 'normal_uac_sentry_destroyed'), sx, t.y - HUMAN_SCALE * 6, HUMAN_BOX, HUMAN_BOX);
      return;
    }
    const image = run.frame(SENTRY_RSI, 'normal_uac_sentry_on', direction, 0, t.state === Act.Stagger ? HURT_TINT : PHOSPHOR);
    sprite(ctx, image, sx, t.y - t.z - HUMAN_SCALE * 10, HUMAN_BOX, HUMAN_BOX);
  }

  drawApc(ctx) {
    const run = this.run;
    const clock = run.clock;
    const wreck = this.apc === 3;
    const centre = this.apcCentre();
    const cx = centre.x - this.cam;
    const cy = centre.y;
    const box = 128 * APC_SCALE;

    // headlights first, so the hull sits over their beams
    if (!wreck) {
      const nx = cx - 60 * APC_SCALE;
      const ny = cy + 22 * APC_SCALE;
      quad(ctx, nx, ny, nx, ny + 8, nx - 110, ny + 50, nx - 90, ny - 24, BRIGHT, 0.04);
    }
    sprite(ctx, run.frame(APC_RSI, wreck ? 'apc_destroyed' : 'apc', WEST), cx, cy, box, box);
    if (this.apcHurt > 0) sprite(ctx, run.frame(APC_RSI, 'apc', WEST, 0, HURT_TINT), cx, cy, box, box, 0, 0.6);

    // the side door opens on darkness to let the marines out
    const open = this.apcDoor > 0
      ? Math.sin(Math.min(1, this.apcDoor / 0.4) * Math.PI / 2) * (this.apcDoor > 0.7 ? (1 - this.apcDoor) / 0.3 : 1)
      : 0;
    if (open > 0) fill(ctx, cx - 8 * APC_SCALE, cy + 14 * APC_SCALE, 14 * APC_SCALE, 26 * APC_SCALE, BLACK, 0.85 * open);

    const tip = this.barrelTip();
    if (this.apcAim >= 0 && !wreck) circle(ctx, tip.x - this.cam, tip.y, 2 + this.apcAim * 3, LASER, 0.3 + 0.3 * Math.sin(clock * 40));
    if (!wreck && this.apcHp >= APC_HEALTH / 4) return;

    // burning
    const roof = cy - 36 * APC_SCALE;
    for (let k = 0; k < 6; k++) {
      const fx = cx - 70 + k * 26;
      const lick = (wreck ? 12 : 7) + 7 * Math.abs(Math.sin(clock * (7 + k) + k * 2));
      quad(ctx, fx - 6, roof, fx + 6, roof, fx + 1, roof - lick, fx - 1, roof - lick, TRACER_GLOW, 0.7);
      quad(ctx, fx - 3, roof, fx + 3, roof, fx, roof - lick * 0.6, fx, roof - lick * 0.6, TRACER_CORE, 0.8);
    }
  }

  /** Lane warnings and laser sights, tracers, the APC's shells, muzzle flashes and the flamers' jets. */
  drawFire(ctx) {
    const clock = this.run.clock;
    for (const t of this.troopers) {
      if (!t.active || t.state !== Act.Aim || t.kind === RIOT) continue;
      const muzzle = this.muzzle(t);
      const sx = muzzle.x - this.cam;
      const aim = Math.min(1, t.timer / KIND_AIM[t.kind]);
      const flicker = 0.75 + 0.25 * Math.sin(clock * 50 + t.x);
      if (t.kind === FLAMER) {
        fill(ctx, t.facing > 0 ? sx : sx - FLAME_REACH, t.y - 1, FLAME_REACH, 2, TRACER_GLOW, 0.15 * aim);
        continue;
      }
      // the lane the burst will come down, painted along the ground, and the sight's beam at gun height
      const reach = 330 * aim;
      const from = t.facing > 0 ? sx : sx - reach;
      fill(ctx, from, t.y - 0.5, reach, 1, LASER, 0.22 * flicker);
      fill(ctx, from, muzzle.y - 0.5, reach, 1, LASER, (0.25 + 0.25 * aim) * flicker);
      circle(ctx, sx, muzzle.y, 1.5 + aim, LASER, 0.6);
    }

    for (const b of this.bullets) {
      const hx = b.x - this.cam;
      const hy = b.y - b.z;
      const tx = hx - sign(b.vx) * (b.kind === SMARTGUNNER ? 10 : 14);
      beam(ctx, tx, hy, hx, hy, 4, TRACER_GLOW, 0.3);
      beam(ctx, tx, hy, hx, hy, 1.6, TRACER_CORE);
    }

    for (const shell of this.shells) {
      const k = shell.age / SHELL_TIME;
      const tx = shell.to.x - this.cam;
      const ring = 6 + 14 * (1 - k);
      ellipse(ctx, tx, shell.to.y, ring, ring * 0.3, LASER, 0.18 + 0.2 * k);
      ellipse(ctx, tx, shell.to.y, 3, 1, LASER, 0.7);
      const at = this.shellAt(shell);
      circle(ctx, at.x - this.cam, at.y, 4, TRACER_GLOW, 0.4);
      circle(ctx, at.x - this.cam, at.y, 2, TRACER_CORE);
    }

    for (const flare of this.flares) {
      const k = 1 - flare.age / 0.07;
      const x = flare.x - this.cam;
      circle(ctx, x, flare.y, 6 * k + 2, TRACER_GLOW, 0.5 * k);
      circle(ctx, x, flare.y, 2.5 * k + 1, TRACER_CORE, k);
    }

    for (const t of this.troopers) {
      if (!t.active || t.kind !== FLAMER || t.state !== Act.Fire) continue;
      const muzzle = this.muzzle(t);
      const mx = muzzle.x - this.cam;
      const grow = clamp(t.timer / 0.25, 0, 1);
      const flicker = 0.7 + 0.3 * Math.sin(clock * 47 + t.x);
      const ex = mx + t.facing * FLAME_REACH * grow;
      const ey = muzzle.y + 4;
      beam(ctx, mx, muzzle.y, ex, ey, 9 * flicker, TRACER_GLOW, 0.22);
      beam(ctx, mx, muzzle.y, mx + (ex - mx) * 0.6, muzzle.y + (ey - muzzle.y) * 0.6, 4, TRACER_CORE, 0.5);
    }
  }

  drawBlasts(ctx) {
    for (const blast of this.blasts) {
      const k = blast.age / 0.45;
      const x = blast.x - this.cam;
      const y = blast.y - 12;
      circle(ctx, x, y, blast.size * (0.3 + 0.8 * k), TRACER_GLOW, 0.45 * (1 - k));
      if (k < 0.4) circle(ctx, x, y, blast.size * (0.2 + k), WHITE, 0.8 * (1 - k / 0.4));
      ellipse(ctx, x, blast.y, blast.size * (0.6 + k), blast.size * 0.2, TRACER_GLOW, 0.3 * (1 - k));
    }
  }

  /** The claw streaks: three bright arcs swept through the slash, the sweep's one wide and low. */
  drawClaws(ctx) {
    if (this.pose !== Pose.Slash) return;
    const strike = STRIKE_AT * (this.frenzy > 0 ? 0.7 : 1);
    const k = (this.timer - strike + 0.02) / 0.16;
    if (k < 0 || k > 1) return;
    const sx = this.x - this.cam;
    const sweep = this.slash === 2;
    const cx = sx + this.facing * (sweep ? 10 : 18);
    const cy = this.y - (sweep ? 26 : 60);
    const radius = sweep ? 62 : 42;
    const [from, to] = this.slash === 0 ? [-1.3, 0.9] : this.slash === 1 ? [1.0, -1.1] : [-0.5, 0.55];
    const colour = this.frenzy > 0 ? FRENZY_TINT : BRIGHT;
    const reach = Math.min(1, k * 2.2);
    const alpha = 1 - k;
    for (let stroke = 0; stroke < 3; stroke++) {
      const r = radius + (stroke - 1) * 6;
      let px = 0;
      let py = 0;
      for (let s = 0; s <= 8; s++) {
        const angle = from + (to - from) * reach * s / 8;
        const x = cx + this.facing * Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r * (sweep ? 0.35 : 1);
        if (s > 0) {
          const tip = s / 8;
          beam(ctx, px, py, x, y, 6 * tip, colour, 0.45 * alpha);
          beam(ctx, px, py, x, y, 2.4 * tip, WHITE, alpha * (0.4 + 0.6 * tip));
        }
        px = x;
        py = y;
      }
    }
  }

  drawOverlay(ctx) {
    const clock = this.run.clock;
    this.drawEdges(ctx);
    if (this.finale >= 0) {
      this.drawTally(ctx);
      return;
    }
    if (this.run.over) return;
    this.drawBars(ctx);
    this.drawCombo(ctx);
    if (this.banner > 0) {
      const alpha = clamp(this.banner / 0.4, 0, 1) * clamp((1.6 - this.banner) / 0.2, 0, 1);
      centreText(ctx, BIG_FONT, this.waveText, SCREEN_W / 2, 58, AMBER, alpha);
      if (this.wave === WAVES.length - 1) centreText(ctx, SMALL_FONT, T.heavy, SCREEN_W / 2, 82, BRIGHT, alpha);
    }
    if (this.cheer > 0 && this.cheerText) {
      const pop = 1 + Math.max(0, this.cheer - 0.9) * 2;
      centreText(ctx, BIG_FONT, this.cheerText, SCREEN_W / 2, 40 - (pop - 1) * 6, AMBER, clamp(this.cheer / 0.3, 0, 1));
    }
    if (this.waveState === WaveState.Advance && clock % 0.8 < 0.55) {
      text(ctx, BIG_FONT, T.go, SCREEN_W - 66, 92, BRIGHT);
      const tx = SCREEN_W - 14;
      quad(ctx, tx, 101, tx - 12, 92, tx - 12, 110, tx, 101, BRIGHT);
    }
    if (this.time < 7 && this.wave === 0) {
      const alpha = clamp((7 - this.time) / 0.5, 0, 1);
      centreText(ctx, SMALL_FONT, T.keys, SCREEN_W / 2, 212, BRIGHT, alpha * 0.9);
    }
  }

  /** The frenzy burns the screen's edges red; low health pulses them. */
  drawEdges(ctx) {
    const clock = this.run.clock;
    let strength;
    if (this.frenzy > 0) strength = 0.16 + 0.08 * Math.sin(clock * 18);
    else if (this.hp < 30 && this.hostile) strength = (0.1 + 0.08 * Math.sin(clock * 7)) * (1 - this.hp / 30);
    else return;
    const top = HUD_HEIGHT;
    for (let k = 0; k < 4; k++) {
      const alpha = strength * (1 - k * 0.25);
      const inset = k * 4;
      fill(ctx, 0, top + inset, SCREEN_W, 4, ALARM, alpha);
      fill(ctx, 0, SCREEN_H - inset - 4, SCREEN_W, 4, ALARM, alpha);
      fill(ctx, inset, top, 4, SCREEN_H - top, ALARM, alpha);
      fill(ctx, SCREEN_W - inset - 4, top, 4, SCREEN_H - top, ALARM, alpha);
    }
  }

  drawBars(ctx) {
    const clock = this.run.clock;
    // health, with the charge meter under it
    const health = clamp(this.hp / MAX_HEALTH, 0, 1);
    const low = this.hp < 30;
    fill(ctx, 6, 20, BAR_WIDTH, 6, BLACK, 0.7);
    fill(ctx, 6, 20, BAR_WIDTH * health, 6, low && clock % 0.4 < 0.2 ? ALARM : ACID);
    outline(ctx, 6, 20, BAR_WIDTH, 6, DIM);
    const ready = this.chargeMeter >= 100 || this.frenzy > 0;
    fill(ctx, 6, 28, BAR_WIDTH * this.chargeMeter / 100, 2, ready ? BRIGHT : DIM);
    text(ctx, SIGN_FONT, T.hp, BAR_WIDTH + 10, 20, DIM);

    // rage, burning when full
    const rage = clamp(this.rage / 100, 0, 1);
    const hot = this.frenzy > 0 || rage > 0.8;
    const left = SCREEN_W - 6 - BAR_WIDTH;
    fill(ctx, left, 20, BAR_WIDTH, 6, BLACK, 0.7);
    fill(ctx, left, 20, BAR_WIDTH * rage, 6, hot ? mix(ALARM, TRACER_GLOW, 0.5 + 0.5 * Math.sin(clock * 16)) : ALARM);
    outline(ctx, left, 20, BAR_WIDTH, 6, DIM);
    // the frenzy's name is longer, so it takes the wave count's place while it burns
    if (this.frenzy > 0) {
      text(ctx, SIGN_FONT, T.frenzy, left - 4 - textWidth(ctx, SIGN_FONT, T.frenzy), 20, ALARM);
      return;
    }
    text(ctx, SIGN_FONT, T.rage, left - 4 - textWidth(ctx, SIGN_FONT, T.rage), 20, DIM);
    centreText(ctx, SIGN_FONT, this.waveCount, SCREEN_W / 2, 20, DIM);
  }

  drawCombo(ctx) {
    if (this.combo < 2) return;
    const multiplier = this.multiplier;
    const label = multiplier > 1 ? T.combo(this.combo, multiplier) : T.kills(this.combo);
    const colour = multiplier >= 3 ? AMBER : BRIGHT;
    text(ctx, SMALL_FONT, label, SCREEN_W - 6 - textWidth(ctx, SMALL_FONT, label), 30, colour);
    const left = this.frenzy > 0 ? 1 : clamp(this.comboTime / COMBO_WINDOW, 0, 1);
    fill(ctx, SCREEN_W - 6 - 60 * left, 41, 60 * left, 1.5, colour, 0.8);
  }

  drawTally(ctx) {
    if (!this.run.over) centreText(ctx, BIG_FONT, T.purged, SCREEN_W / 2, 66, ACID, clamp(this.finale / 0.5, 0, 1));
    if (this.tallyShown === 0) return;
    fill(ctx, 52, 110, 216, 6 + TALLY_ROWS * 13, BLACK, 0.65);
    outline(ctx, 52, 110, 216, 6 + TALLY_ROWS * 13, DIM);
    for (let row = 0; row < this.tallyShown; row++) {
      const y = 114 + row * 13;
      const total = row === TALLY_ROWS - 1;
      const colour = total ? ACID : row === 3 || row === 4 ? AMBER : BRIGHT;
      if (total) fill(ctx, 58, y - 2, 204, 1, DIM);
      text(ctx, SMALL_FONT, T.tally[row], 60, y, colour);
      // each figure counts up as its row comes in
      const age = this.finale - TALLY_START - row * TALLY_ROW;
      const shown = Math.floor(this.tally[row] * clamp(age / 0.4, 0, 1));
      const value = row === 3 || row === 4 ? T.points(shown) : String(shown);
      text(ctx, SMALL_FONT, value, 260 - textWidth(ctx, SMALL_FONT, value), y, colour);
    }
  }
}
