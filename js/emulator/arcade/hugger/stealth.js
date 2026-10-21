// Stage 4, a port of Arcade/CMUHuggerRun.Stealth.cs: the runner sneaks through a desert colony's outskirts at
// night, seen from above like the VR missions of an old stealth game and drawn with the game's own Kutjevo desert
// sprites. Four short rooms, each harder than the last:
// marines walk their patrol routes with vision cones that cover blocks (chain-link fences do not), a sentry tower
// sweeps a searchlight. Stand in a cone and the marine's "!" fills; fill it and he shouts, radios the others in and
// opens fire, while they converge on where you were seen, search, then give up ("?") and go back to their rounds.
// Space pounces a short dash: land it on a marine from behind or the side (or before he has noticed you) and he goes
// down screaming in a pool of blood that stays; into his face and he shoves you off and shoots. Reach the exit to
// clear the room: points for the room, for not being spotted (GHOST), for silent takedowns and for time. The last
// room hands on to the ravager. Constants, maps, sprites, sounds and strings match the C# file; keep them in step.

import {
  HuggerStage, Key, Outfit, SOUTH, NORTH, EAST, WEST, RUNNER, SCREEN_W, SCREEN_H, HUD_HEIGHT, SMOKE, SPARK,
  BRIGHT, AMBER, ALARM, ACID, DARK_ACID, BLOOD, DARK_BLOOD, TRACER_CORE, TRACER_GLOW, DUST, LASER, GREEN, DIM, BLACK,
  TEXT_FONT, SMALL_FONT, SIGN_FONT, BIG_FONT, TAU, hash01, clamp, lerp, fill, outline, line, circle, ellipse, quad, beam,
  sprite, text, centreText,
} from './stage.js';
import { loadStateSheet } from '../../../sprites.js';

// Layout -----------------------------------------------------------------------------------------------------------

const TILE = 16;
/** Each room sits this far along world x from the last, so the stains of a cleared room stay out of sight. */
const ROOM_GAP = 4096;
const VIEW_H = SCREEN_H - HUD_HEIGHT;
const MAX_W = 40;
const MAX_H = 24;

// The runner
const RUN_SPEED = 84;
const RUN_ACCEL = 720;
const RUNNER_RADIUS = 6;
const RUNNER_SCALE = 0.6;
const POUNCE_SPEED = 270;
const POUNCE_TIME = 0.2;
const POUNCE_COOLDOWN = 0.45;
const POUNCE_BUFFER = 0.15;
const CONTACT = 13;
const MAUL_TIME = 0.5;
const STUN_TIME = 0.6;
const HEALTH = 3;
const GRACE = 0.8;

// Marines
const MARINE_RADIUS = 5;
const MARINE_SCALE = 0.75;
const PATROL_SPEED = 30;
const HUNT_SPEED = 62;
const TURN_RATE = 3.5;
const CONE_HALF = 0.62;
const CONE_RANGE = 88;
const HUNT_RANGE = 110;
const TOWER_HALF = 0.5;
const TOWER_RANGE = 150;
const RAYS = 20;
/** How fast the "!" fills, per second, for a runner in the middle of a cone; slower far off and at the edges. */
const NOTICE_RATE = 2.6;
/** Marines already looking for the runner fill it this many times faster. */
const AWARE_FACTOR = 4;
const DECAY = 0.55;
const HEAR_RANGE = 20;
const HEAR_RATE = 1.1;
/** A pounce that comes in within this angle of where the marine looks is in his face. */
const FACE_ANGLE = 0.95;
/** Below this much "!", a marine has not really noticed the runner yet, and a pounce still takes him. */
const UNAWARE = 0.3;

// the demo bot: how often it replans, how long it waits in cover, how far it pounces, how wide a berth it gives cones
const BOT_REPLAN = 0.3;
const BOT_PATIENCE = 5;
const BOT_POUNCE_REACH = 46;
const BOT_CONE_MARGIN = 0.25;
const BOT_RANGE_MARGIN = 14;
const LOSE_TIME = 2.2;
const SEARCH_TIME = 5.5;
const AIM_TIME = 0.45;
/** The first aim after the shout is slower: the moment to break and run. */
const ALERT_AIM = 0.7;
const BURST = 3;
const BURST_GAP = 0.1;
const FIRE_COOLDOWN = 0.85;
const FIRE_RANGE = 170;
const BULLET_SPEED = 380;
const BULLET_LIFE = 0.7;
const SPREAD = 0.08;
const NOISE_RANGE = 72;
const LIGHT_RADIUS = 22;
const LIGHT_SPEED = 55;
const LIGHT_CHASE = 110;
/** Bullets, muzzles and lasers are drawn this far above the ground they move on. */
const CHEST = 9;
/** The tower guard stands on the watchtower's platform, drawn this far above his post. */
const LIFT = 4;
const TRACER = 12;
const MAX_BULLETS = 48;
const MAX_PATH = 128;

// Scoring
const CLEAR_POINTS = 500;
const GHOST_POINTS = 500;
const SILENT_POINTS = 250;
const KILL_POINTS = 100;
const TIME_RATE = 10;
const TIME_CAP = 400;

// Flow
const EXIT_WALK = 0.5;
const TALLY_STEP = 0.4;
const TALLY_TIME = 2.6;
const ROOM_FADE = 0.35;
const BANNER_TIME = 2.6;

// Marine states
const PATROL = 0;
const SUSPECT = 1;
const HUNT = 2;
const COMBAT = 3;
const SEARCH = 4;
const RETURN = 5;
const DEAD = 6;

// Tiles
const SAND = 0;
const SCRUB = 1;
const ROCK = 2;
const CRATE = 3;
const BARREL = 4;
const FENCE = 5;
const WALL = 6;
const TOWER = 7;
const EXIT = 8;
const SANDBAG = 9;
const WRECK = 10;

// Sounds ---------------------------------------------------------------------------------------------------------

const POUNCE = '/Audio/_RMC14/Xeno/alien_pounce.ogg';
const GUN = '/Audio/Weapons/Guns/Gunshots/m41.ogg';
const RICOCHET = '/Audio/_RMC14/Bullets/bullet_impact1.ogg';
const SPOTTED = '/Audio/Effects/alert.ogg';
const RADIO = '/Audio/_RMC14/Effects/radiostatic.ogg';
const FALL = '/Audio/CMU14/PersonalComputers/Games/fall.ogg';
const BLOCK = '/Audio/_RMC14/Xeno/alien_claw_block.ogg';
const DEATH = '/Audio/_RMC14/Xeno/alien_death.ogg';
const CLEARED = '/Audio/Effects/double_beep.ogg';
const GHOSTED = '/Audio/_RMC14/Effects/tech_notification.ogg';
const TALLY = '/Audio/Effects/beep1.ogg';
const MALE_SIGH = '/Audio/Voice/Human/male_sigh.ogg';
const FEMALE_SIGH = '/Audio/Voice/Human/female_sigh.ogg';
const CLAWS = [
  '/Audio/_RMC14/Xeno/alien_claw_flesh1.ogg', '/Audio/_RMC14/Xeno/alien_claw_flesh2.ogg', '/Audio/_RMC14/Xeno/alien_claw_flesh3.ogg',
  '/Audio/_RMC14/Xeno/alien_claw_flesh4.ogg', '/Audio/_RMC14/Xeno/alien_claw_flesh5.ogg',
];
const BITES = ['/Audio/_RMC14/Xeno/alien_bite1.ogg', '/Audio/_RMC14/Xeno/alien_bite2.ogg'];
const HISSES = ['/Audio/_RMC14/Xeno/alien_hiss1.ogg', '/Audio/_RMC14/Xeno/alien_hiss2.ogg', '/Audio/_RMC14/Xeno/alien_hiss3.ogg'];
const PAIN = ['/Audio/_RMC14/Xeno/alien_help1.ogg', '/Audio/_RMC14/Xeno/alien_help2.ogg', '/Audio/_RMC14/Xeno/alien_help3.ogg'];
const FLESH = [
  '/Audio/_RMC14/Bullets/impact_flesh_1.ogg', '/Audio/_RMC14/Bullets/impact_flesh_2.ogg',
  '/Audio/_RMC14/Bullets/impact_flesh_3.ogg', '/Audio/_RMC14/Bullets/impact_flesh_4.ogg',
];
const PUNCHES = ['/Audio/CMU14/PersonalComputers/Games/punch_1.ogg', '/Audio/CMU14/PersonalComputers/Games/punch_2.ogg'];
const MALE_GASPS = ['/Audio/Effects/Gasp/gasp_male1.ogg', '/Audio/Effects/Gasp/gasp_male2.ogg'];
const FEMALE_GASPS = ['/Audio/Effects/Gasp/gasp_female1.ogg', '/Audio/Effects/Gasp/gasp_female2.ogg', '/Audio/Effects/Gasp/gasp_female3.ogg'];
const SHOUTS = [
  '/Audio/Voice/Talk/speak_1_exclaim.ogg', '/Audio/Voice/Talk/speak_2_exclaim.ogg',
  '/Audio/Voice/Talk/speak_3_exclaim.ogg', '/Audio/Voice/Talk/speak_4_exclaim.ogg',
];
const ASKS = [
  '/Audio/Voice/Talk/speak_1_ask.ogg', '/Audio/Voice/Talk/speak_2_ask.ogg',
  '/Audio/Voice/Talk/speak_3_ask.ogg', '/Audio/Voice/Talk/speak_4_ask.ogg',
];
const STEPS = [
  '/Audio/Effects/Footsteps/asteroid1.ogg', '/Audio/Effects/Footsteps/asteroid2.ogg', '/Audio/Effects/Footsteps/asteroid3.ogg',
  '/Audio/Effects/Footsteps/asteroid4.ogg', '/Audio/Effects/Footsteps/asteroid5.ogg',
];
const RATTLES = ['/Audio/Effects/fence_rattle1.ogg', '/Audio/Effects/fence_rattle2.ogg', '/Audio/Effects/fence_rattle3.ogg'];
const WINDS = ['/Audio/Effects/Weather/wind_2_1.ogg', '/Audio/Effects/Weather/wind_2_2.ogg', '/Audio/Effects/Weather/wind_3_1.ogg'];

// Colours --------------------------------------------------------------------------------------------------------

// The game's own desert art, drawn at half size: Kutjevo's rock and colony walls (corner smoothed like the game
// does it), chain-link fences, crates, barrels, sandbags, a wreck, the watchtower, cacti and stones on the sand.
const FLOOR = '/Textures/_RMC14/Tiles/planet/desert';
const FLOORS = ['desert_0', 'desert_1', 'desert_2', 'desert_3', 'desert_4', 'desert_5'];
const ROCK_RSI = '/Textures/_RMC14/Structures/Walls/kutjevo_rock.rsi';
const WALL_RSI = '/Textures/_RMC14/Structures/Walls/kutjevo_wall.rsi';
const FENCE_RSI = '/Textures/_RMC14/Structures/fences.rsi';
const BARREL_RSI = '/Textures/_RMC14/Structures/barrels.rsi';
const SANDBAG_RSI = '/Textures/_RMC14/Structures/Walls/Barricades/barricade.rsi';
const TOWER_RSI = '/Textures/_RMC14/Structures/watchtower.rsi';
const WRECK_RSI = '/Textures/_RMC14/Structures/vehicle_pileup.rsi';
const CACTUS_RSI = '/Textures/_RMC14/Structures/Flora/cactus.rsi';
const STONE_RSI = '/Textures/_RMC14/Structures/Flora/rocks.rsi';
const BOULDER_RSI = '/Textures/_RMC14/Structures/Flora/large_boulder.rsi';
const BOULDERS = ['boulder_large1', 'boulder_large2'];
const CONTAINER_RSI = '/Textures/_RMC14/Structures/containers.rsi';
const CRATES = [
  '/Textures/_RMC14/Structures/Storage/Crates/woodcrate.rsi', '/Textures/_RMC14/Structures/Storage/Crates/supply.rsi',
  '/Textures/_RMC14/Structures/Storage/Crates/ammo.rsi', '/Textures/_RMC14/Structures/Storage/Crates/weapons.rsi',
];
/** Cargo containers, two tiles tall: left, middle and right pieces in three colours. */
const CONTAINERS = [
  ['redcontainerleft', 'redcontainercenter', 'redcontainerright'],
  ['greencontainerleft', 'greencontainermiddle', 'greencontainerright'],
  ['bluecontainerleft', 'bluecontainermiddle', 'bluecontainerright'],
];
const BARRELS = ['barrel_green', 'barrel_red', 'barrel_yellow', 'barrel_blue'];
const CACTI = ['cactus_3', 'cacti_1', 'cacti_9', 'cactus_7'];
const STONES = ['rock_1', 'rock_5', 'rock_8', 'rock_2'];
/** The desert at night: the sand is darkened under everything else, so the cones and cover read over it. */
const FLOOR_TINT = '#7C866A';
const WRECK_W = 123;
const WRECK_H = 82;
const EXIT_COLOUR = '#12361A';

/** Strings from Games/hugger-stealth.ftl (the title and hint are in hugger.ftl). */
const T = {
  title: 'STAGE 4 - RUNNER',
  hint: 'SNEAK PAST THE MARINES',
  room: (room, rooms) => `ROOM ${room}/${rooms}`,
  banner: (room, name) => `ROOM ${room} - ${name}`,
  names: ['OUTSKIRTS', 'SUPPLY YARD', 'FENCE LINE', 'LANDING ZONE'],
  alert: 'ALERT',
  caution: 'CAUTION',
  exit: 'EXIT',
  clear: 'ROOM CLEAR',
  cleared: points => `CLEARED +${points}`,
  ghost: points => `GHOST +${points}`,
  spotted: 'SPOTTED',
  time: points => `TIME +${points}`,
  kills: count => `TAKEDOWNS ${count}`,
  silent: 'SILENT KILL',
  kill: 'TAKEDOWN',
  dead: 'GUNNED DOWN',
};

// Rooms ----------------------------------------------------------------------------------------------------------
// # rock, C crate, B barrel, F chain-link fence (blocks the way, not the view), W colony wall, T sentry tower, Z
// sandbags, V a wreck's footprint (the wreck is drawn from `wreck`, its top left tile), , a cactus or stones, S start,
// E exit. Marines: a route of tile points walked in a loop (one point is a sentry who looks
// `look` radians, sweeping `sweep` either side), waiting `wait` seconds at each. A tower guard stands on the
// tower; `light` is its searchlight's sweep, a centre and radii in tiles.

const ROOMS = [
  {
    par: 30,
    map: [
      '######################',
      '##.....,......#....,##',
      '#.....##.........CC..#',
      '#..,..##.........CC..#',
      '#..........,.........#',
      '#...#................#',
      '#.S.#.......B....,...#',
      '#...#................#',
      '#..........,.........#',
      '#..CC.........B......E',
      '#..CC.......##.......E',
      '##.....,....##.......E',
      '######################',
    ],
    marines: [
      { route: [[9, 2], [9, 11]], wait: 1.1 },
      { route: [[17, 8]], look: -Math.PI / 2, sweep: 0.7 },
    ],
  },
  {
    par: 45,
    map: [
      '##############################',
      '#......,.......B.......,.....#',
      '#..CC....CCC.......CCC...CC..#',
      '#..CC....CCC...,...CCC...CC..#',
      '#............................#',
      '#.S....BB......VVVV......BB..E',
      '#......BB......VVVV......BB..E',
      '#............................E',
      '#..CC....CCC.......CCC...CC..#',
      '#..CC....CCC...,...CCC...CC..#',
      '#..B..,....B...B......B......#',
      '#.......,..........,.........#',
      '##############################',
    ],
    marines: [
      { route: [[27, 4], [3, 4]], wait: 1.2 },
      { route: [[27, 7], [3, 7]], wait: 1.2 },
      { route: [[14, 1], [14, 11]], wait: 1.4 },
      { route: [[28, 11]], look: -2.4, sweep: 0.5 },
    ],
    wreck: [15, 5],
  },
  {
    par: 60,
    map: [
      '#########################EEE##',
      '#.....,.........F.........,..#',
      '#..##...........F....CC......#',
      '#..##.....B.....F....CC..##..#',
      '#...............F........##..#',
      '#....,..........F............#',
      '#....CC.........F.....B......#',
      '#....CC......................#',
      '#...........,................#',
      '#...##..........F......CC....#',
      '#FFFFFF...FFFFFFF..FFFFFFF..F#',
      '#...............F............#',
      '#..CC......,....F....ZZ......#',
      '#..CC...........F....ZZ..B...#',
      '#...............F............#',
      '#.....##.....................#',
      '#.....##........F.....CC.....#',
      '#..S............F.....CC.....#',
      '#.........,.....F............#',
      '##############################',
    ],
    marines: [
      { route: [[2, 11], [13, 11], [13, 14], [2, 14]], wait: 0.8 },
      { route: [[19, 11], [19, 18]], wait: 1.2 },
      { route: [[17, 8]], look: Math.PI, sweep: 0.9 },
      { route: [[19, 1], [28, 1], [28, 8], [19, 8]], wait: 0.9 },
      { route: [[2, 5], [14, 5]], wait: 1.0 },
    ],
  },
  {
    par: 70,
    map: [
      '##################################',
      '#WWWWW.....,..........WWWWWW.....#',
      '#WWWWW..........B.....WWWWWW.....#',
      '#WWWWW....CC..........WWWWWW...B.#',
      '#.........CC.....................#',
      '#....,..........,.......CC.......#',
      '#..B....................CC.......#',
      '#.........##.....................#',
      '#.........##.....ZZ..............#',
      '#.S..............TT..........,...E',
      '#................TT..............E',
      '#.....CC.........................#',
      '#.....CC..............##.........#',
      '#.....................##....B....#',
      '#..,......B......................#',
      '#.............,..........VVVV....#',
      '#WWWWWW.......WWWWW......VVVV....#',
      '#WWWWWW.......WWWWW..............#',
      '#WWWWWW.......WWWWW......,.......#',
      '##################################',
    ],
    marines: [
      { route: [[18, 10]], look: Math.PI, sweep: 1.2, tower: true },
      { route: [[13, 6], [21, 6], [21, 13], [13, 13]], wait: 0.6 },
      { route: [[30, 2], [30, 17]], wait: 1.2 },
      { route: [[2, 13], [11, 13]], wait: 1.0 },
      { route: [[27, 10]], look: -Math.PI / 2, sweep: 1.0 },
    ],
    light: { x: 18, y: 10, rx: 8, ry: 4 },
    wreck: [25, 15],
  },
];

// Helpers --------------------------------------------------------------------------------------------------------

function wrap(angle) {
  return ((((angle + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
}

function kindOf(ch) {
  switch (ch) {
    case ',': return SCRUB;
    case '#': return ROCK;
    case 'C': return CRATE;
    case 'B': return BARREL;
    case 'F': return FENCE;
    case 'W': return WALL;
    case 'T': return TOWER;
    case 'E': return EXIT;
    case 'Z': return SANDBAG;
    case 'V': return WRECK;
    default: return SAND;
  }
}

/** Facing radians to the sprite direction a person shows. */
function personDir(angle) {
  const c = Math.cos(angle);
  if (c > 0.707) return EAST;
  if (c < -0.707) return WEST;
  return Math.sin(angle) > 0 ? SOUTH : NORTH;
}

/** The runner shows its long side view for diagonals too. */
function runnerDir(angle) {
  const c = Math.cos(angle);
  if (c > 0.6) return EAST;
  if (c < -0.6) return WEST;
  return Math.sin(angle) > 0 ? SOUTH : NORTH;
}

export class Stealth extends HuggerStage {
  constructor(run) {
    super(run);
    this.grid = new Uint8Array(MAX_W * MAX_H);
    this.fence = new Uint8Array(MAX_W * MAX_H);
    this.corners = new Uint16Array(MAX_W * MAX_H);
    this.boulders = [];
    this.prev = new Int32Array(MAX_W * MAX_H);
    this.queue = new Int32Array(MAX_W * MAX_H);
    this.bullets = [];
    this.marines = [];
    this.order = [];
    this.trail = [];
  }

  get title() { return T.title; }
  get hint() { return T.hint; }

  get sounds() {
    return [
      POUNCE, GUN, RICOCHET, SPOTTED, RADIO, FALL, BLOCK, DEATH, CLEARED, GHOSTED, TALLY, MALE_SIGH, FEMALE_SIGH,
      ...CLAWS, ...BITES, ...HISSES, ...PAIN, ...FLESH, ...PUNCHES, ...MALE_GASPS, ...FEMALE_GASPS, ...SHOUTS, ...ASKS,
      ...STEPS, ...RATTLES, ...WINDS,
    ];
  }

  preload() {
    const run = this.run;
    const dirs = [SOUTH, NORTH, EAST, WEST];
    for (const dir of dirs) run.frame(RUNNER, 'alive', dir);
    run.frame(RUNNER, 'dead');
    for (let fill = 0; fill < 8; fill++) {
      for (const dir of dirs) {
        run.frame(ROCK_RSI, `rock${fill}`, dir);
        run.frame(WALL_RSI, `colony${fill}`, dir);
      }
    }
    for (let bits = 0; bits < 16; bits++) run.frame(FENCE_RSI, `fence${bits}`);
    for (const barrel of BARRELS) run.frame(BARREL_RSI, barrel);
    for (const crate of CRATES) run.frame(crate, 'icon');
    for (const colour of CONTAINERS) for (const piece of colour) run.frame(CONTAINER_RSI, piece);
    for (const dir of dirs) run.frame(SANDBAG_RSI, 'sandbag', dir);
    for (const cactus of CACTI) run.frame(CACTUS_RSI, cactus);
    for (const stone of STONES) run.frame(STONE_RSI, stone);
    for (const boulder of BOULDERS) run.frame(BOULDER_RSI, boulder);
    run.frame(TOWER_RSI, 'watchtower');
    run.frame(WRECK_RSI, 'car_pileup');

    // the floor tiles are plain textures, not RSIs: tint them like a sprite layer (multiplied, alpha kept)
    this.floors = FLOORS.map(() => null);
    FLOORS.forEach((name, i) => loadStateSheet(FLOOR, name).then(image => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const g = canvas.getContext('2d');
      g.drawImage(image, 0, 0);
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = FLOOR_TINT;
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(image, 0, 0);
      this.floors[i] = canvas;
    }, e => console.warn(`hugger run: ${e.message}`)));
  }

  // Lifecycle --------------------------------------------------------------------------------------------------

  enter() {
    this.time = 0;
    this.health = HEALTH;
    this.loadRoom(0);
  }

  loadRoom(index) {
    const spec = ROOMS[index];
    this.room = index;
    this.spec = spec;
    this.w = spec.map[0].length;
    this.h = spec.map.length;
    this.ox = index * ROOM_GAP;
    this.grid.fill(ROCK);
    this.fence.fill(0);
    let exits = 0;
    this.exitX = 0;
    this.exitY = 0;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const ch = spec.map[y][x];
        this.grid[y * MAX_W + x] = kindOf(ch);
        if (ch === 'S') {
          this.px = this.ox + (x + 0.5) * TILE;
          this.py = (y + 0.5) * TILE;
        } else if (ch === 'E') {
          exits++;
          this.exitX += x;
          this.exitY += y;
          this.exitDx = x === this.w - 1 ? 1 : x === 0 ? -1 : 0;
          this.exitDy = y === 0 ? -1 : y === this.h - 1 ? 1 : 0;
        }
      }
    }
    this.exitX = this.ox + (this.exitX / exits + 0.5) * TILE;
    this.exitY = (this.exitY / exits + 0.5) * TILE;

    // which way each fence runs: bits for a fence (or wall) to the left, right, up and down
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.tile(x, y) !== FENCE) continue;
        let bits = 0;
        if (this.joins(x - 1, y)) bits |= 1;
        if (this.joins(x + 1, y)) bits |= 2;
        if (this.joins(x, y - 1)) bits |= 4;
        if (this.joins(x, y + 1)) bits |= 8;
        this.fence[y * MAX_W + x] = bits;
      }
    }

    // the corners of each rock and colony wall tile, smoothed into their neighbours the way the game does
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const t = this.tile(x, y);
        if (t === ROCK || t === WALL) this.corners[y * MAX_W + x] = this.cornerFill(x, y, t);
      }
    }

    this.boulders.length = 0;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.boulder(x, y)) this.boulders.push(x, y);
      }
    }

    this.marines.length = 0;
    this.tower = null;
    for (const m of spec.marines) {
      const marine = {
        route: m.route.map(([x, y]) => ({ x: this.ox + (x + 0.5) * TILE, y: (y + 0.5) * TILE })),
        wait: m.wait ?? 1,
        look: m.look ?? 0,
        sweep: m.sweep ?? 0,
        tower: !!m.tower,
        phase: Math.random() * TAU,
        rays: new Float32Array(RAYS + 1),
        path: new Int32Array(MAX_PATH),
        person: {},
      };
      if (marine.tower) marine.route[0] = { x: this.ox + m.route[0][0] * TILE, y: m.route[0][1] * TILE };
      this.run.dress(marine.person, Outfit.Rifleman);
      this.resetMarine(marine);
      this.marines.push(marine);
      if (marine.tower) this.tower = marine;
    }

    const light = spec.light;
    if (light) {
      this.lightX = this.ox + light.x * TILE;
      this.lightY = light.y * TILE;
    }
    this.lightSees = false;

    this.bullets.length = 0;
    this.trail.length = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = 0;
    this.pounce = 0;
    this.pounceCool = 0;
    this.pounceWant = 0;
    this.pvx = 0;
    this.pvy = 0;
    this.fromX = 0;
    this.fromY = 0;
    this.maul = 0;
    this.stun = 0;
    this.grace = 0;
    this.dead = false;
    this.walk = 0;
    this.rattle = 0;
    this.step = 0;
    this.wind = 0.5;
    this.lastX = this.px;
    this.lastY = this.py;
    this.roomTime = 0;
    this.seen = false;
    this.alarmed = false;
    this.kills = 0;
    this.clearing = -1;
    this.tallied = 0;
    this.fade = index === 0 ? 0 : ROOM_FADE;
    this.fadeOut = false;
    this.banner = BANNER_TIME;
    this.roomText = T.room(index + 1, ROOMS.length);
    this.bannerText = T.banner(index + 1, T.names[index]);
    this.health = Math.min(HEALTH, this.health + (index === 0 ? 0 : 1));
    this.updateCamera(1);
    this.castCones();
    if (index > 0) this.run.playAny(HISSES, -6);
  }

  resetMarine(m) {
    m.x = m.route[0].x;
    m.y = m.route[0].y;
    m.facing = m.route.length > 1 ? Math.atan2(m.route[1].y - m.y, m.route[1].x - m.x) : m.look;
    m.state = PATROL;
    m.meter = 0;
    m.leg = m.route.length > 1 ? 1 : 0;
    m.pause = 0;
    m.lookAt = m.facing;
    m.sees = false;
    m.goalX = m.x;
    m.goalY = m.y;
    m.wantX = m.x;
    m.wantY = m.y;
    m.huntX = m.x;
    m.huntY = m.y;
    m.suspectX = m.x;
    m.suspectY = m.y;
    m.pathLen = 0;
    m.pathAt = 0;
    m.repath = 0;
    m.lost = 0;
    m.search = 0;
    m.searchAngle = 0;
    m.aim = AIM_TIME;
    m.burst = 0;
    m.burstTimer = 0;
    m.cooldown = 0;
    m.flash = 0;
    m.pop = 0;
    m.gait = 0;
    m.moving = false;
    m.die = 0;
    m.fall = 0;
    m.fallDir = 1;
    m.pool = 0;
    m.found = false;
  }

  onKey(input) {
    if (input.down && !input.repeat && input.key === Key.Action) this.pounceWant = POUNCE_BUFFER;
  }

  onRelease() {
    this.pounceWant = 0;
  }

  // Tiles ------------------------------------------------------------------------------------------------------

  // Demo bot -------------------------------------------------------------------------------------------------------

  // The demo's runner: a planner over the tiles that finds a way to the exit keeping out of every marine's view,
  // waits in cover when there is none (until it loses patience and makes a dash), and pounces any marine it can reach
  // from behind or who has not noticed it. Once a marine is on to it, it runs for the exit.

  demoThink(dt) {
    const run = this.run;
    if (this.dead || this.clearing >= 0 || run.over || this.maul > 0) {
      this.botSteer(0, 0);
      return;
    }
    if (!this.botPath) {
      this.botPath = new Int32Array(MAX_PATH);
      this.botMark = new Int32Array(MAX_W * MAX_H);
      this.botDanger = new Uint8Array(MAX_W * MAX_H);
      this.botStamp = 0;
      this.botRoom = -1;
    }
    if (this.botRoom !== this.room) {
      // a look round the new room before moving
      this.botRoom = this.room;
      this.botLength = 0;
      this.botStep = 0;
      this.botWait = 0;
      this.botThink = 0.6 + Math.random() * 0.5;
      this.botPause = this.botThink;
    }
    if (this.botPause > 0) {
      this.botPause -= dt;
      this.botSteer(0, 0);
      return;
    }

    const prey = this.pounce <= 0 && this.pounceCool <= 0 && this.stun <= 0 ? this.botPrey() : null;
    if (prey) {
      const tx = prey.x - this.px;
      const ty = prey.y - this.py;
      this.botSteer(tx, ty);
      const along = tx * Math.cos(this.facing) + ty * Math.sin(this.facing);
      const across = Math.abs(tx * Math.sin(this.facing) - ty * Math.cos(this.facing));
      if (along > 4 && along < POUNCE_SPEED * POUNCE_TIME && across < CONTACT - 3) run.botTap(Key.Action);
      return;
    }

    this.botThink -= dt;
    if (this.botThink <= 0) {
      this.botThink = BOT_REPLAN + Math.random() * 0.15;
      const alerted = this.anyCombat();
      if (!this.botPlan(!alerted && this.botWait < BOT_PATIENCE)) {
        this.botWait += BOT_REPLAN;
        if (Math.random() < 0.06) this.botPause = 0.3 + Math.random() * 0.5;
      } else {
        this.botWait = 0;
      }
    }

    if (this.botStep >= this.botLength) {
      this.botSteer(0, 0);
      return;
    }
    const tile = this.botPath[this.botStep];
    const cx = this.ox + (tile % MAX_W + 0.5) * TILE;
    const cy = (Math.floor(tile / MAX_W) + 0.5) * TILE;
    if (Math.hypot(cx - this.px, cy - this.py) < 5) {
      this.botStep++;
      return;
    }
    this.botSteer(cx - this.px, cy - this.py);
  }

  /** Holds the arrow keys that head the runner along a direction, or lets them all go. */
  botSteer(dx, dy) {
    const run = this.run;
    run.bot(Key.Right, dx > 3);
    run.bot(Key.Left, dx < -3);
    run.bot(Key.Down, dy > 3);
    run.bot(Key.Up, dy < -3);
  }

  /** A marine close enough to pounce who is turned away or has not noticed the runner. */
  botPrey() {
    for (const m of this.marines) {
      if (m.state === DEAD || m.tower || Math.hypot(m.x - this.px, m.y - this.py) > BOT_POUNCE_REACH) continue;
      const approach = Math.atan2(this.py - m.y, this.px - m.x);
      const behind = Math.abs(wrap(approach - m.facing)) > FACE_ANGLE + 0.15;
      const unaware = (m.state === PATROL || m.state === RETURN) && m.meter < UNAWARE * 0.6 && !m.sees;
      if (behind || unaware) return m;
    }
    return null;
  }

  /** Whether a tile's middle is in, or about to be in, a living marine's view. */
  botDangerous(tile) {
    if (this.botMark[tile] === this.botStamp) return this.botDanger[tile] === 1;
    this.botMark[tile] = this.botStamp;
    const ax = this.ox + (tile % MAX_W + 0.5) * TILE;
    const ay = (Math.floor(tile / MAX_W) + 0.5) * TILE;
    let danger = false;
    for (const m of this.marines) {
      if (danger) break;
      if (m.state === DEAD) continue;
      const dx = ax - m.x;
      const dy = ay - m.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 20 && !m.tower) {
        danger = true;
        break;
      }
      if (dist > this.rangeOf(m) + BOT_RANGE_MARGIN) continue;
      const angle = Math.atan2(dy, dx);
      if (Math.abs(wrap(angle - m.facing)) > (m.tower ? TOWER_HALF : CONE_HALF) + BOT_CONE_MARGIN) continue;
      danger = this.cast(m.x, m.y, angle, dist, m.tower) >= dist - 2;
    }
    this.botDanger[tile] = danger ? 1 : 0;
    return danger;
  }

  /**
   * Plans the shortest way over the tiles to the exit (breadth first, eight ways), keeping out of view when careful.
   * With no safe way it heads for the nearest tile out of view instead. False when it had to settle for that.
   */
  botPlan(careful) {
    this.botStamp++;
    this.botLength = 0;
    this.botStep = 0;
    const sx = Math.floor((this.px - this.ox) / TILE);
    const sy = Math.floor(this.py / TILE);
    if (sx < 0 || sy < 0 || sx >= this.w || sy >= this.h) return false;
    const start = sy * MAX_W + sx;
    const exit = this.botSearch(start, careful, false);
    if (exit >= 0) {
      this.botTrace(start, exit);
      return true;
    }
    // nowhere safe to go: get out of view and wait
    if (careful && this.botDangerous(start)) {
      const cover = this.botSearch(start, false, true);
      if (cover >= 0) this.botTrace(start, cover);
    }
    return false;
  }

  /** Breadth first from a tile to the exit (or, with cover, to the nearest tile out of view). */
  botSearch(start, careful, cover) {
    this.prev.fill(-1);
    this.prev[start] = start;
    let head = 0;
    let tail = 0;
    this.queue[tail++] = start;
    while (head < tail) {
      const at = this.queue[head++];
      const x = at % MAX_W;
      const y = (at - x) / MAX_W;
      if (cover ? at !== start && !this.botDangerous(at) : this.tile(x, y) === EXIT) return at;
      for (let k = 0; k < 8; k++) {
        const nx = x + (k === 0 || k === 4 || k === 5 ? 1 : k === 1 || k === 6 || k === 7 ? -1 : 0);
        const ny = y + (k === 2 || k === 4 || k === 6 ? 1 : k === 3 || k === 5 || k === 7 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
        const next = ny * MAX_W + nx;
        if (this.prev[next] >= 0 || this.solid(this.grid[next], false)) continue;
        // no cutting corners round a solid tile
        if (nx !== x && ny !== y && (this.solid(this.tile(nx, y), false) || this.solid(this.tile(x, ny), false))) continue;
        if (careful && this.botDangerous(next)) continue;
        this.prev[next] = at;
        this.queue[tail++] = next;
      }
    }
    return -1;
  }

  botTrace(start, end) {
    let count = 0;
    for (let at = end; at !== start && count < MAX_PATH; at = this.prev[at]) count++;
    if (count >= MAX_PATH) return;
    let step = end;
    for (let i = count - 1; i >= 0; i--) {
      this.botPath[i] = step;
      step = this.prev[step];
    }
    this.botLength = count;
    this.botStep = 0;
  }

  tile(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return ROCK;
    return this.grid[y * MAX_W + x];
  }

  /**
   * The four corner states of a smoothed wall tile, packed three bits each (SE, NE, NW, SW): 1 the side
   * counter-clockwise of the corner joins, 2 the diagonal, 4 the side clockwise (the game's CornerFill). Rock runs
   * on past the edge of the map.
   */
  cornerFill(x, y, kind) {
    const same = (dx, dy) => {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) return kind === ROCK;
      return this.grid[ny * MAX_W + nx] === kind;
    };
    let ne = 0;
    let nw = 0;
    let sw = 0;
    let se = 0;
    if (same(0, -1)) {
      ne |= 1;
      nw |= 4;
    }
    if (same(1, -1)) ne |= 2;
    if (same(1, 0)) {
      ne |= 4;
      se |= 1;
    }
    if (same(1, 1)) se |= 2;
    if (same(0, 1)) {
      se |= 4;
      sw |= 1;
    }
    if (same(-1, 1)) sw |= 2;
    if (same(-1, 0)) {
      sw |= 4;
      nw |= 1;
    }
    if (same(-1, -1)) nw |= 2;
    return se | ne << 3 | nw << 6 | sw << 9;
  }

  joins(x, y) {
    const t = this.tile(x, y);
    return t === FENCE || t === WALL || t === ROCK && x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  /** Whether a tile stops a walker; marines also keep off the exit. */
  solid(t, marine) {
    return t === ROCK || t === CRATE || t === BARREL || t === FENCE || t === WALL || t === TOWER || t === SANDBAG || t === WRECK
      || marine && t === EXIT;
  }

  /** Whether a tile blocks the view; from up the tower only rock and walls do. */
  opaque(t, elevated) {
    return t === ROCK || t === WALL || t === WRECK || !elevated && (t === CRATE || t === BARREL || t === SANDBAG);
  }

  stopsBullets(t) {
    return t === ROCK || t === WALL || t === CRATE || t === BARREL || t === SANDBAG || t === WRECK;
  }

  tileAt(wx, wy) {
    return this.tile(Math.floor((wx - this.ox) / TILE), Math.floor(wy / TILE));
  }

  /**
   * Pushes a circle out of the solid tiles around it. Fences are thin rails and barrels round-ish, so the walker
   * goes right up to them. Returns the kind of the last tile it touched, or -1.
   */
  pushOut(e, r, marine) {
    let touched = -1;
    const lx = e.x - this.ox;
    const x0 = Math.floor((lx - r) / TILE);
    const x1 = Math.floor((lx + r) / TILE);
    const y0 = Math.floor((e.y - r) / TILE);
    const y1 = Math.floor((e.y + r) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = this.tile(tx, ty);
        if (!this.solid(t, marine)) continue;
        const bx = this.ox + tx * TILE;
        const by = ty * TILE;
        if (t === FENCE) {
          const bits = this.fence[ty * MAX_W + tx];
          let any = false;
          if (bits & 3) any = this.pushRect(e, r, bx, by + 6, TILE, 4) || any;
          if (bits & 12) any = this.pushRect(e, r, bx + 6, by, 4, TILE) || any;
          if (!bits) any = this.pushRect(e, r, bx + 5, by + 5, 6, 6) || any;
          if (any) touched = t;
        } else if (t === BARREL) {
          if (this.pushRect(e, r, bx + 2, by + 2, 12, 12)) touched = t;
        } else if (this.pushRect(e, r, bx, by, TILE, TILE)) {
          touched = t;
        }
      }
    }
    return touched;
  }

  pushRect(e, r, x, y, w, h) {
    const cx = clamp(e.x, x, x + w);
    const cy = clamp(e.y, y, y + h);
    const dx = e.x - cx;
    const dy = e.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) return false;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2);
      e.x += dx / d * (r - d);
      e.y += dy / d * (r - d);
      return true;
    }
    // the centre is inside: out the nearest side
    const left = e.x - x;
    const right = x + w - e.x;
    const up = e.y - y;
    const down = y + h - e.y;
    const least = Math.min(left, right, up, down);
    if (least === left) e.x = x - r;
    else if (least === right) e.x = x + w + r;
    else if (least === up) e.y = y - r;
    else e.y = y + h + r;
    return true;
  }

  /** Whether a circle at a point would overlap a solid tile. */
  blocked(x, y, r, marine) {
    const probe = this.probe ??= { x: 0, y: 0 };
    probe.x = x;
    probe.y = y;
    return this.pushOut(probe, r, marine) >= 0;
  }

  /** Moves a walker by (dx, dy), an axis at a time so it slides along walls. Returns the tile it bumped, or -1. */
  move(e, dx, dy, r, marine) {
    e.x += dx;
    const a = this.pushOut(e, r, marine);
    e.y += dy;
    const b = this.pushOut(e, r, marine);
    return b >= 0 ? b : a;
  }

  /** How far a sight line from a world point at an angle runs before something opaque stops it, up to max. */
  cast(ox, oy, angle, max, elevated) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const px = (ox - this.ox) / TILE;
    const py = oy / TILE;
    let mx = Math.floor(px);
    let my = Math.floor(py);
    const deltaX = dx === 0 ? 1e30 : Math.abs(1 / dx);
    const deltaY = dy === 0 ? 1e30 : Math.abs(1 / dy);
    const stepX = dx < 0 ? -1 : 1;
    const stepY = dy < 0 ? -1 : 1;
    let sideX = dx < 0 ? (px - mx) * deltaX : (mx + 1 - px) * deltaX;
    let sideY = dy < 0 ? (py - my) * deltaY : (my + 1 - py) * deltaY;
    const limit = max / TILE;
    for (let k = 0; k < 64; k++) {
      let dist;
      if (sideX < sideY) {
        dist = sideX;
        sideX += deltaX;
        mx += stepX;
      } else {
        dist = sideY;
        sideY += deltaY;
        my += stepY;
      }
      if (dist >= limit) return max;
      if (this.opaque(this.tile(mx, my), elevated)) return dist * TILE;
    }
    return max;
  }

  // Paths ------------------------------------------------------------------------------------------------------

  /** Finds a way over the tiles from a marine to a world point (breadth first, eight ways) and stores it on him. */
  plan(m, gx, gy) {
    m.wantX = gx;
    m.wantY = gy;
    m.goalX = gx;
    m.goalY = gy;
    m.pathLen = 0;
    m.pathAt = 0;
    m.repath = 1;
    m.reachable = true;
    const sx = Math.floor((m.x - this.ox) / TILE);
    const sy = Math.floor(m.y / TILE);
    const ex = Math.floor((gx - this.ox) / TILE);
    const ey = Math.floor(gy / TILE);
    if (ex < 0 || ey < 0 || ex >= this.w || ey >= this.h) return;
    const start = sy * MAX_W + sx;
    const end = ey * MAX_W + ex;
    if (start === end) return;
    this.prev.fill(-1);
    this.prev[start] = start;
    let head = 0;
    let tail = 0;
    this.queue[tail++] = start;
    let found = false;
    while (head < tail) {
      const at = this.queue[head++];
      if (at === end) {
        found = true;
        break;
      }
      const x = at % MAX_W;
      const y = (at - x) / MAX_W;
      for (let k = 0; k < 8; k++) {
        const nx = x + (k === 0 || k === 4 || k === 5 ? 1 : k === 1 || k === 6 || k === 7 ? -1 : 0);
        const ny = y + (k === 2 || k === 4 || k === 6 ? 1 : k === 3 || k === 5 || k === 7 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
        const next = ny * MAX_W + nx;
        if (this.prev[next] >= 0 || this.solid(this.grid[next], true) && next !== end) continue;
        // no cutting corners round a solid tile
        if (nx !== x && ny !== y && (this.solid(this.tile(nx, y), true) || this.solid(this.tile(x, ny), true))) continue;
        this.prev[next] = at;
        this.queue[tail++] = next;
      }
    }
    if (!found) {
      // out of reach (over a fence): stay put and look from here
      m.reachable = false;
      m.goalX = m.x;
      m.goalY = m.y;
      return;
    }
    let count = 0;
    for (let at = end; at !== start && count < MAX_PATH; at = this.prev[at]) count++;
    if (count >= MAX_PATH) return;
    let at = end;
    for (let i = count - 1; i >= 0; i--) {
      m.path[i] = at;
      at = this.prev[at];
    }
    m.pathLen = count;
  }

  /** Whether a marine can walk straight from where he is to a point. */
  clear(m, x, y) {
    const dx = x - m.x;
    const dy = y - m.y;
    const length = Math.hypot(dx, dy);
    const steps = Math.ceil(length / 5);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (this.blocked(m.x + dx * t, m.y + dy * t, MARINE_RADIUS + 1, true)) return false;
    }
    return true;
  }

  /** Walks a marine along his path towards his goal. Returns true once he is there. */
  follow(m, speed, dt) {
    // look ahead for corners he can cut
    for (let k = 0; k < 3 && m.pathAt < m.pathLen; k++) {
      const next = m.pathAt + 1;
      const nx = next < m.pathLen ? this.ox + (m.path[next] % MAX_W + 0.5) * TILE : m.goalX;
      const ny = next < m.pathLen ? (Math.floor(m.path[next] / MAX_W) + 0.5) * TILE : m.goalY;
      if (!this.clear(m, nx, ny)) break;
      m.pathAt++;
    }
    const tx = m.pathAt < m.pathLen ? this.ox + (m.path[m.pathAt] % MAX_W + 0.5) * TILE : m.goalX;
    const ty = m.pathAt < m.pathLen ? (Math.floor(m.path[m.pathAt] / MAX_W) + 0.5) * TILE : m.goalY;
    const dx = tx - m.x;
    const dy = ty - m.y;
    const d = Math.hypot(dx, dy);
    if (d < 1.5) {
      if (m.pathAt >= m.pathLen) return true;
      m.pathAt++;
      return false;
    }
    const stepLength = Math.min(d, speed * dt);
    this.move(m, dx / d * stepLength, dy / d * stepLength, MARINE_RADIUS, true);
    m.moving = true;
    this.turn(m, Math.atan2(dy, dx), TURN_RATE * dt);
    return false;
  }

  /** Walks towards a world point, planning a path when the goal moves to another tile or now and then. */
  goTo(m, x, y, speed, dt) {
    if (m.tower) return true;
    m.repath -= dt;
    if (m.repath <= 0 || Math.floor((x - this.ox) / TILE) !== Math.floor((m.wantX - this.ox) / TILE)
      || Math.floor(y / TILE) !== Math.floor(m.wantY / TILE)) {
      this.plan(m, x, y);
    } else if (m.reachable) {
      m.goalX = x;
      m.goalY = y;
    }
    return this.follow(m, speed, dt);
  }

  turn(m, target, step) {
    const diff = wrap(target - m.facing);
    m.facing = wrap(m.facing + clamp(diff, -step, step));
  }

  // Update -----------------------------------------------------------------------------------------------------

  update(dt) {
    const run = this.run;
    this.time += dt;
    if (this.banner > 0) this.banner -= dt;
    if (this.fade > 0 && !this.fadeOut) this.fade = Math.max(0, this.fade - dt);

    if (this.clearing >= 0) {
      this.updateClear(dt);
      this.updateCamera(dt);
      return;
    }

    this.roomTime += dt;
    if (!run.over) this.updatePlayer(dt);
    for (const m of this.marines) this.updateMarine(m, dt);
    this.separate();
    this.updateLight(dt);
    this.updateBullets(dt);
    this.updateAmbience(dt);
    this.updateCamera(dt);
    this.castCones();
  }

  /** Traces each marine's view out to the cover in its way, for drawing the cones. */
  castCones() {
    for (const m of this.marines) {
      if (m.state === DEAD) continue;
      const half = m.tower ? TOWER_HALF : CONE_HALF;
      const range = this.rangeOf(m);
      for (let i = 0; i <= RAYS; i++) m.rays[i] = this.cast(m.x, m.y, m.facing - half + 2 * half * i / RAYS, range, m.tower);
    }
  }

  rangeOf(m) {
    if (m.tower) return TOWER_RANGE;
    return m.state === HUNT || m.state === SEARCH || m.state === COMBAT ? HUNT_RANGE : CONE_RANGE;
  }

  updateCamera(dt) {
    const tx = clamp(this.px - this.ox - SCREEN_W / 2, 0, Math.max(0, this.w * TILE - SCREEN_W));
    const ty = clamp(this.py - VIEW_H / 2, 0, Math.max(0, this.h * TILE - VIEW_H));
    if (dt >= 1) {
      this.camX = tx;
      this.camY = ty;
    } else {
      const k = Math.min(1, dt * 6);
      this.camX += (tx - this.camX) * k;
      this.camY += (ty - this.camY) * k;
    }
    this.run.camera = { x: this.ox + Math.round(this.camX), y: Math.round(this.camY) - HUD_HEIGHT };
  }

  updatePlayer(dt) {
    const run = this.run;
    if (this.dead) return;
    if (this.grace > 0) this.grace -= dt;
    if (this.pounceCool > 0) this.pounceCool -= dt;
    if (this.pounceWant > 0) this.pounceWant -= dt;

    let ix = (run.held(Key.Right) ? 1 : 0) - (run.held(Key.Left) ? 1 : 0);
    let iy = (run.held(Key.Down) ? 1 : 0) - (run.held(Key.Up) ? 1 : 0);
    if (ix !== 0 && iy !== 0) {
      ix *= Math.SQRT1_2;
      iy *= Math.SQRT1_2;
    }

    if (this.maul > 0) {
      this.maul -= dt;
      this.vx = 0;
      this.vy = 0;
      return;
    }

    if (this.stun > 0) {
      this.stun -= dt;
      const drag = Math.max(0, 1 - 6 * dt);
      this.vx *= drag;
      this.vy *= drag;
      this.move(this, this.vx * dt, this.vy * dt, RUNNER_RADIUS, false);
      return;
    }

    if (this.pounce > 0) {
      this.pounce -= dt;
      const bump = this.move(this, this.pvx * dt, this.pvy * dt, RUNNER_RADIUS, false);
      this.trail.push({ x: this.px, y: this.py, age: 0 });
      if (this.trail.length > 6) this.trail.shift();
      for (const m of this.marines) {
        if (m.state === DEAD || m.tower) continue;
        if (Math.hypot(m.x - this.px, m.y - this.py) < CONTACT) {
          this.land(m);
          return;
        }
      }
      if (bump >= 0) {
        this.pounce = 0;
        run.emit({ x: this.px + this.pvx * 0.03, y: this.py + this.pvy * 0.03 }, 6, DUST, 0.5, 40, 0.6, 3, Math.atan2(-this.pvy, -this.pvx), 1.6, 0,
          { kind: SMOKE });
        if (bump === FENCE) this.rattleFence();
        run.shake(1.5, 0.15);
      }
      if (this.pounce <= 0) {
        this.pounceCool = POUNCE_COOLDOWN;
        this.vx = this.pvx * 0.3;
        this.vy = this.pvy * 0.3;
        run.emit({ x: this.px, y: this.py + 2 }, 5, DUST, 0.45, 30, 0.6, 3, -Math.PI / 2, TAU, 0, { kind: SMOKE });
      }
      return;
    }

    if (ix !== 0 || iy !== 0) this.facing = Math.atan2(iy, ix);
    if (this.pounceWant > 0 && this.pounceCool <= 0) {
      this.pounceWant = 0;
      this.pounce = POUNCE_TIME;
      this.pvx = Math.cos(this.facing) * POUNCE_SPEED;
      this.pvy = Math.sin(this.facing) * POUNCE_SPEED;
      this.fromX = this.px;
      this.fromY = this.py;
      this.trail.length = 0;
      run.play(POUNCE, -3);
      run.emit({ x: this.px, y: this.py + 2 }, 6, DUST, 0.5, 40, 0.6, 3, this.facing + Math.PI, 1.4, 0, { kind: SMOKE });
      return;
    }

    const step = RUN_ACCEL * dt;
    this.vx = this.vx < ix * RUN_SPEED ? Math.min(ix * RUN_SPEED, this.vx + step) : Math.max(ix * RUN_SPEED, this.vx - step);
    this.vy = this.vy < iy * RUN_SPEED ? Math.min(iy * RUN_SPEED, this.vy + step) : Math.max(iy * RUN_SPEED, this.vy - step);
    const bump = this.move(this, this.vx * dt, this.vy * dt, RUNNER_RADIUS, false);
    const speed = Math.hypot(this.vx, this.vy);
    this.walk += speed * dt * 0.22;
    if (this.rattle > 0) this.rattle -= dt;
    if (bump === FENCE && speed > 30) this.rattleFence();

    // marines are in the way too
    for (const m of this.marines) {
      if (m.state === DEAD || m.tower) continue;
      const dx = this.px - m.x;
      const dy = this.py - m.y;
      const d = Math.hypot(dx, dy);
      const least = RUNNER_RADIUS + MARINE_RADIUS;
      if (d < least && d > 0.01) {
        this.px = m.x + dx / d * least;
        this.py = m.y + dy / d * least;
      }
    }

    if (this.tileAt(this.px, this.py) === EXIT) this.startClear();
  }

  // the runner is the walker for move(); it keeps its position in px/py
  get x() { return this.px; }
  set x(v) { this.px = v; }
  get y() { return this.py; }
  set y(v) { this.py = v; }

  rattleFence() {
    if (this.rattle > 0) return;
    this.rattle = 0.9;
    this.run.playAny(RATTLES, -6);
    this.noise(this.px, this.py, NOISE_RANGE);
  }

  /** Marines near a sound turn and come to look. */
  noise(x, y, range) {
    for (const m of this.marines) {
      if (m.state !== PATROL && m.state !== RETURN && m.state !== SUSPECT) continue;
      if (Math.hypot(m.x - x, m.y - y) > range) continue;
      m.state = SUSPECT;
      m.meter = Math.max(m.meter, 0.5);
      m.suspectX = x;
      m.suspectY = y;
    }
  }

  /** The pounce reaches a marine: from behind or the side, or before he has noticed, he dies; else it is botched. */
  land(m) {
    const approach = Math.atan2(this.fromY - m.y, this.fromX - m.x);
    const off = Math.abs(wrap(approach - m.facing));
    const unaware = (m.state === PATROL || m.state === RETURN || m.state === SUSPECT) && m.meter < UNAWARE;
    this.pounce = 0;
    if (off > FACE_ANGLE || unaware) this.takedown(m);
    else this.botch(m);
  }

  takedown(m) {
    const run = this.run;
    const silent = m.state !== COMBAT && m.state !== HUNT && m.state !== SEARCH;
    const angle = Math.atan2(this.pvy, this.pvx);
    m.state = DEAD;
    m.die = 0;
    m.fallDir = this.pvx >= 0 ? 1 : -1;
    m.pool = 0;
    m.meter = 0;
    this.maul = MAUL_TIME;
    this.px = m.x - Math.cos(angle) * 7;
    this.py = m.y - Math.sin(angle) * 7;
    this.pushOut(this, RUNNER_RADIUS, false);
    this.vx = 0;
    this.vy = 0;
    this.kills++;

    const at = { x: m.x, y: m.y - 8 };
    run.emit(at, 40, BLOOD, 1, 170, 0.7, 2.2, angle, 2.4, 0, { stains: true, drag: 5, flat: 1 });
    run.emit(at, 16, DARK_BLOOD, 1, 110, 0.6, 3, angle, 3, 0, { stains: true, drag: 5, flat: 1 });
    run.emit(at, 10, BLOOD, 0.9, 220, 0.25, 1, angle, 1.2, 0, { kind: SPARK });
    run.splat({ x: m.x, y: m.y }, 26, BLOOD, 0.95, 1);
    run.playAny(CLAWS);
    run.pend(0.14, BITES[Math.floor(Math.random() * BITES.length)], -2);
    run.pendScream(0.05, m.person.female, -2);
    run.pend(0.42, FALL, -2);
    run.shake(3, 0.3);
    run.slowMotion(0.18);
    run.flash(BLOOD, 0.22, 0.2);
    if (silent) {
      run.bonus(SILENT_POINTS, { x: m.x, y: m.y - 30 }, ACID);
      run.pop(T.silent, { x: m.x, y: m.y - 42 }, BRIGHT, 1.2);
    } else {
      run.bonus(KILL_POINTS, { x: m.x, y: m.y - 30 }, ACID);
      run.pop(T.kill, { x: m.x, y: m.y - 42 }, BRIGHT, 1.2);
    }
    this.noise(m.x, m.y, NOISE_RANGE);
  }

  botch(m) {
    const run = this.run;
    const angle = Math.atan2(this.py - m.y, this.px - m.x);
    this.stun = STUN_TIME;
    this.vx = Math.cos(angle) * 150;
    this.vy = Math.sin(angle) * 150;
    run.playAny(PUNCHES);
    run.play(BLOCK, -4);
    run.shake(2.5, 0.25);
    run.emit({ x: this.px, y: this.py - 6 }, 8, DUST, 0.5, 40, 0.5, 3, angle, 2, 0, { kind: SMOKE });
    this.alert(m);
    m.aim = 0.25;
    m.facing = Math.atan2(this.py - m.y, this.px - m.x);
  }

  updateMarine(m, dt) {
    m.moving = false;
    if (m.flash > 0) m.flash -= dt;
    if (m.pop > 0) m.pop -= dt;
    if (m.state === DEAD) {
      this.updateCorpse(m, dt);
      return;
    }
    if (this.run.over) return;

    const rate = this.notice(m);
    const aware = m.state === HUNT || m.state === SEARCH;
    if (m.state !== COMBAT) {
      if (rate > 0) {
        m.meter += rate * (aware ? AWARE_FACTOR : 1) * dt;
        m.suspectX = this.px;
        m.suspectY = this.py;
        if (m.state === PATROL || m.state === RETURN) m.state = SUSPECT;
      } else if (m.state === SUSPECT) {
        // he goes over to look while it fades slowly, and gives it up faster once there
        const there = Math.hypot(m.suspectX - m.x, m.suspectY - m.y) < 10 || m.tower;
        m.meter -= (there ? DECAY : DECAY * 0.3) * dt;
      }
      if (m.meter >= 1) {
        this.alert(m);
        return;
      }
    }

    switch (m.state) {
      case PATROL:
        this.patrol(m, dt);
        this.checkBodies(m);
        break;
      case RETURN:
        if (m.tower || this.goTo(m, m.route[m.leg].x, m.route[m.leg].y, PATROL_SPEED, dt)) {
          m.state = PATROL;
          m.pause = 0;
        }
        this.checkBodies(m);
        break;
      case SUSPECT:
        // turn to where he saw something; walk over once he is fairly sure
        this.turn(m, Math.atan2(m.suspectY - m.y, m.suspectX - m.x), TURN_RATE * dt);
        if (rate === 0 && m.meter > 0.2 && Math.hypot(m.suspectX - m.x, m.suspectY - m.y) > 10) {
          this.goTo(m, m.suspectX, m.suspectY, PATROL_SPEED, dt);
        }
        if (m.meter <= 0) {
          m.meter = 0;
          m.state = RETURN;
          m.repath = 0;
          this.run.pop('?', { x: m.x, y: m.y - 34 }, AMBER, 1);
        }
        this.checkBodies(m);
        break;
      case HUNT:
        if (this.goTo(m, m.huntX, m.huntY, HUNT_SPEED, dt)) {
          m.state = SEARCH;
          m.search = 0;
          m.searchAngle = m.facing;
        }
        break;
      case SEARCH:
        m.search += dt;
        this.turn(m, m.searchAngle + Math.sin(m.search * 2.2) * 1.4, TURN_RATE * dt);
        if (m.search > SEARCH_TIME && !this.anyCombat()) this.giveUp(m);
        break;
      case COMBAT:
        this.combat(m, rate > 0 || m.tower && this.lightSees, dt);
        break;
    }

    if (m.moving) {
      m.gait += dt * (m.state === HUNT || m.state === COMBAT ? 11 : 7);
    }
  }

  /** Keeps marines from walking through each other. */
  separate() {
    const least = MARINE_RADIUS * 2 + 2;
    for (let i = 0; i < this.marines.length; i++) {
      const a = this.marines[i];
      if (a.state === DEAD || a.tower) continue;
      for (let j = i + 1; j < this.marines.length; j++) {
        const b = this.marines[j];
        if (b.state === DEAD || b.tower) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= least) continue;
        const nx = d > 0.01 ? dx / d : 1;
        const ny = d > 0.01 ? dy / d : 0;
        const push = (least - d) / 2;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        this.pushOut(a, MARINE_RADIUS, true);
        this.pushOut(b, MARINE_RADIUS, true);
      }
    }
  }

  /** How fast this marine is noticing the runner right now (meter per second), 0 if he is not. Sets m.sees. */
  notice(m) {
    m.sees = false;
    if (this.dead || this.clearing >= 0) return 0;
    const dx = this.px - m.x;
    const dy = this.py - m.y;
    const dist = Math.hypot(dx, dy);
    const moving = Math.hypot(this.vx, this.vy) > 20 || this.pounce > 0;
    const heard = !m.tower && dist < HEAR_RANGE && moving ? HEAR_RATE : 0;
    const range = this.rangeOf(m);
    const half = m.tower ? TOWER_HALF : CONE_HALF;
    if (dist > range) return heard;
    const angle = Math.atan2(dy, dx);
    const off = Math.abs(wrap(angle - m.facing));
    if (off > half) return heard;
    if (this.cast(m.x, m.y, angle, dist, m.tower) < dist - 0.5) return heard;
    m.sees = true;
    return Math.max(heard, NOTICE_RATE * (1.25 - dist / range) * (1.2 - 0.6 * off / half));
  }

  patrol(m, dt) {
    if (m.route.length === 1) {
      const post = m.route[0];
      if (!m.tower && Math.hypot(post.x - m.x, post.y - m.y) > 2) {
        this.goTo(m, post.x, post.y, PATROL_SPEED, dt);
        return;
      }
      this.turn(m, m.look + Math.sin(this.time * 0.8 + m.phase) * m.sweep, TURN_RATE * 0.5 * dt);
      return;
    }
    if (m.pause > 0) {
      m.pause -= dt;
      this.turn(m, m.lookAt + Math.sin(m.pause * 3) * 0.6, TURN_RATE * 0.6 * dt);
      return;
    }
    const point = m.route[m.leg];
    if (this.goTo(m, point.x, point.y, PATROL_SPEED, dt)) {
      const next = m.route[(m.leg + 1) % m.route.length];
      m.lookAt = Math.atan2(next.y - point.y, next.x - point.x);
      m.leg = (m.leg + 1) % m.route.length;
      m.pause = m.wait;
      m.repath = 0;
    }
  }

  /** A marine who sees a body goes to look, and the others hear about it. */
  checkBodies(m) {
    for (const body of this.marines) {
      if (body.state !== DEAD || body.found || body === m) continue;
      const dx = body.x - m.x;
      const dy = body.y - m.y;
      const dist = Math.hypot(dx, dy);
      if (dist > CONE_RANGE) continue;
      const angle = Math.atan2(dy, dx);
      if (Math.abs(wrap(angle - m.facing)) > CONE_HALF) continue;
      if (this.cast(m.x, m.y, angle, dist, m.tower) < dist - 0.5) continue;
      body.found = true;
      this.run.playAny(m.person.female ? FEMALE_GASPS : MALE_GASPS, -2);
      this.run.pop('!?', { x: m.x, y: m.y - 34 }, AMBER, 1);
      for (const o of this.marines) {
        if (o.state === DEAD || o.state === COMBAT) continue;
        if (o !== m && Math.hypot(o.x - body.x, o.y - body.y) > 160) continue;
        this.hunt(o, body.x, body.y);
      }
      return;
    }
  }

  hunt(m, x, y) {
    m.meter = 0;
    if (m.tower) {
      m.state = SEARCH;
      m.search = 0;
      m.searchAngle = Math.atan2(y - m.y, x - m.x);
      return;
    }
    m.state = HUNT;
    m.huntX = x;
    m.huntY = y;
    this.plan(m, x, y);
  }

  giveUp(m) {
    const run = this.run;
    m.state = RETURN;
    m.meter = 0;
    m.repath = 0;
    run.pop('?', { x: m.x, y: m.y - 34 }, AMBER, 1.2);
    if (Math.hypot(m.x - this.px, m.y - this.py) < 200) {
      run.play(ASKS[Math.floor(Math.random() * ASKS.length)], -8);
      run.pend(0.4, m.person.female ? FEMALE_SIGH : MALE_SIGH, -6);
    }
  }

  anyCombat() {
    for (const m of this.marines) if (m.state === COMBAT) return true;
    return false;
  }

  /** The marine is sure: he shouts, radios it in, and the others come running. */
  alert(m) {
    const run = this.run;
    const first = !this.anyCombat();
    m.state = COMBAT;
    m.meter = 1;
    m.pop = 0.9;
    m.aim = ALERT_AIM;
    m.burst = 0;
    m.cooldown = 0;
    m.lost = 0;
    this.lastX = this.px;
    this.lastY = this.py;
    this.seen = true;
    if (first) run.play(SPOTTED, -4);
    run.playAny(m.person.female ? FEMALE_GASPS : MALE_GASPS, -2);
    run.play(SHOUTS[Math.floor(Math.random() * SHOUTS.length)], -4, 0.85);
    run.pend(0.35, RADIO, -10);
    for (const o of this.marines) {
      if (o === m || o.state === DEAD || o.state === COMBAT) continue;
      this.hunt(o, this.px, this.py);
    }
  }

  combat(m, sees, dt) {
    if (sees) {
      this.lastX = this.px;
      this.lastY = this.py;
      m.lost = 0;
      this.turn(m, Math.atan2(this.py - m.y, this.px - m.x), TURN_RATE * 1.6 * dt);
      // everyone else hunting hears where the runner is
      for (const o of this.marines) {
        if (o.state === HUNT) {
          o.huntX = this.px;
          o.huntY = this.py;
        }
      }
    } else {
      m.lost += dt;
      if (m.lost > LOSE_TIME) {
        this.hunt(m, this.lastX, this.lastY);
        return;
      }
    }

    const dist = Math.hypot(this.px - m.x, this.py - m.y);
    if (sees && dist < FIRE_RANGE) {
      if (m.burst > 0) {
        m.burstTimer -= dt;
        if (m.burstTimer <= 0) {
          this.fire(m);
          m.burst--;
          m.burstTimer = BURST_GAP;
          if (m.burst === 0) m.cooldown = FIRE_COOLDOWN;
        }
      } else if (m.cooldown > 0) {
        m.cooldown -= dt;
      } else {
        m.aim -= dt;
        if (m.aim <= 0) {
          m.burst = BURST;
          m.burstTimer = 0;
          m.aim = AIM_TIME * 0.7;
        }
      }
      return;
    }

    m.burst = 0;
    m.aim = Math.min(AIM_TIME, m.aim + dt);
    if (!m.tower) this.goTo(m, this.lastX, this.lastY, HUNT_SPEED, dt);
  }

  fire(m) {
    const run = this.run;
    const angle = Math.atan2(this.py - m.y, this.px - m.x) + (Math.random() - 0.5) * 2 * SPREAD;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const lift = m.tower ? CHEST + LIFT : CHEST;
    if (this.bullets.length < MAX_BULLETS) {
      this.bullets.push({ x: m.x + dx * 9, y: m.y + dy * 9, vx: dx * BULLET_SPEED, vy: dy * BULLET_SPEED, life: BULLET_LIFE, lift });
    }
    m.flash = 0.06;
    m.facing = angle;
    run.play(GUN, -5, 0.92 + Math.random() * 0.16);
    run.emit({ x: m.x + dx * 11, y: m.y + dy * 11 - lift }, 4, TRACER_GLOW, 0.9, 120, 0.12, 1, angle, 0.8, 0, { kind: SPARK });
    run.emit({ x: m.x + dx * 11, y: m.y + dy * 11 - lift }, 2, DUST, 0.35, 15, 0.5, 2, angle, 1, 0, { kind: SMOKE });
  }

  updateBullets(dt) {
    const run = this.run;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let gone = b.life <= 0;
      if (!gone && this.stopsBullets(this.tileAt(b.x, b.y))) {
        gone = true;
        const back = Math.atan2(-b.vy, -b.vx);
        run.emit({ x: b.x, y: b.y - b.lift }, 5, TRACER_CORE, 1, 140, 0.18, 1, back, 1.6, 0, { kind: SPARK });
        run.emit({ x: b.x, y: b.y - b.lift }, 2, DUST, 0.4, 15, 0.5, 2, back, 1, 0, { kind: SMOKE });
        run.play(RICOCHET, -10, 0.9 + Math.random() * 0.2);
      }
      if (!gone && !this.dead && this.clearing < 0 && Math.hypot(b.x - this.px, b.y - this.py) < RUNNER_RADIUS + 2) {
        gone = true;
        if (this.grace <= 0) this.hurt(b.vx / BULLET_SPEED, b.vy / BULLET_SPEED);
      }
      if (gone) this.bullets.splice(i, 1);
    }
  }

  hurt(dx, dy) {
    const run = this.run;
    const angle = Math.atan2(dy, dx);
    this.health--;
    this.grace = GRACE;
    this.vx += dx * 120;
    this.vy += dy * 120;
    const at = { x: this.px, y: this.py - 6 };
    run.emit(at, 16, ACID, 1, 150, 0.6, 2, angle, 1.8, 0, { stains: true, acid: true, drag: 5, flat: 1 });
    run.emit(at, 6, ACID, 1, 240, 0.2, 1, angle, 1.2, 0, { kind: SPARK });
    run.splat({ x: this.px, y: this.py }, 14, ACID, 0.85, 1, true);
    run.playAny(FLESH);
    if (this.health <= 0) {
      this.die(angle);
      return;
    }
    run.playAny(PAIN, -4);
    run.flash(ACID, 0.25, 0.2);
    run.shake(3, 0.25);
  }

  die(angle) {
    const run = this.run;
    this.dead = true;
    this.pounce = 0;
    this.maul = 0;
    const at = { x: this.px, y: this.py - 6 };
    run.emit(at, 50, ACID, 1, 200, 0.9, 2.4, angle, 2.6, 0, { stains: true, acid: true, drag: 4, flat: 1 });
    run.emit(at, 16, DARK_ACID, 1, 120, 0.8, 3.2, angle, 3, 0, { stains: true, acid: true, drag: 4, flat: 1 });
    run.emit(at, 8, ACID, 0.4, 30, 1, 4, -Math.PI / 2, 1.5, -20, { kind: SMOKE });
    run.splat({ x: this.px, y: this.py + 2 }, 40, ACID, 0.9, 1, true);
    run.splat({ x: this.px - 12, y: this.py + 6 }, 18, ACID, 0.85, 1, true);
    run.play(DEATH);
    run.flash(ACID, 0.35, 0.3);
    run.shake(5, 0.45);
    run.slowMotion(0.5);
    run.lose(T.dead, ACID);
  }

  updateCorpse(m, dt) {
    m.die += dt;
    m.fall = Math.min(1, m.die / 0.32);
    // the pool spreads for a moment, then stays
    const marks = [0.3, 0.7, 1.2, 1.8];
    if (m.pool < marks.length && m.die >= marks[m.pool]) {
      const size = 22 + m.pool * 6;
      this.run.splat({ x: m.x + (Math.random() - 0.5) * 6 + m.fallDir * 4, y: m.y + (Math.random() - 0.5) * 4 }, size,
        m.pool < 2 ? BLOOD : DARK_BLOOD, 0.8, 1);
      m.pool++;
    }
  }

  updateLight(dt) {
    this.lightSees = false;
    const light = this.spec.light;
    const tower = this.tower;
    if (!light || !tower || this.run.over) return;
    let tx;
    let ty;
    let speed = LIGHT_SPEED;
    if (tower.state === COMBAT) {
      tx = this.lastX;
      ty = this.lastY;
      speed = LIGHT_CHASE;
    } else if (tower.state === SEARCH) {
      tx = this.lastX + Math.cos(this.time * 1.6) * 40;
      ty = this.lastY + Math.sin(this.time * 2.1) * 30;
    } else {
      tx = this.ox + (light.x + Math.cos(this.time * 0.4) * light.rx) * TILE;
      ty = (light.y + Math.sin(this.time * 0.6) * light.ry) * TILE;
    }
    const dx = tx - this.lightX;
    const dy = ty - this.lightY;
    const d = Math.hypot(dx, dy);
    if (d > 0.5) {
      const stepLength = Math.min(d, speed * dt);
      this.lightX += dx / d * stepLength;
      this.lightY += dy / d * stepLength;
    }
    if (this.dead || this.clearing >= 0) return;
    if (Math.hypot(this.px - this.lightX, this.py - this.lightY) < LIGHT_RADIUS) {
      this.lightSees = true;
      if (tower.state !== COMBAT) this.alert(tower);
    }
  }

  updateAmbience(dt) {
    const run = this.run;
    this.wind -= dt;
    if (this.wind <= 0) {
      this.wind = 8 + Math.random() * 5;
      run.playAny(WINDS, -17);
    }
    if (Math.random() < dt * 2.5) {
      const y = this.camY + Math.random() * VIEW_H;
      run.emit({ x: this.ox + this.camX - 4, y }, 1, DUST, 0.12, 90, 3.5, 3, 0.1, 0.3, 0, { kind: SMOKE });
    }

    // the nearest walking marine's boots on the sand
    this.step -= dt;
    if (this.step > 0) return;
    let nearest = null;
    let best = 110;
    for (const m of this.marines) {
      if (!m.moving) continue;
      const d = Math.hypot(m.x - this.px, m.y - this.py);
      if (d < best) {
        best = d;
        nearest = m;
      }
    }
    if (!nearest) {
      this.step = 0.1;
      return;
    }
    const hurry = nearest.state === HUNT || nearest.state === COMBAT;
    this.step = hurry ? 0.3 : 0.45;
    run.playAny(STEPS, -14 - best / 10);
  }

  // Clearing a room --------------------------------------------------------------------------------------------

  startClear() {
    const run = this.run;
    this.clearing = 0;
    this.tallied = 0;
    this.bullets.length = 0;
    this.ghost = !this.seen;
    this.timePoints = Math.min(TIME_CAP, Math.max(0, Math.round((this.spec.par - this.roomTime) * TIME_RATE / 10) * 10));
    this.clearText = T.cleared(CLEAR_POINTS);
    this.ghostText = this.ghost ? T.ghost(GHOST_POINTS) : T.spotted;
    this.timeText = T.time(this.timePoints);
    this.killText = T.kills(this.kills);
    run.playAny(HISSES, -4);
  }

  updateClear(dt) {
    const run = this.run;
    this.clearing += dt;
    if (this.clearing < EXIT_WALK) {
      this.facing = Math.atan2(this.exitDy, this.exitDx);
      this.px += this.exitDx * RUN_SPEED * 0.8 * dt;
      this.py += this.exitDy * RUN_SPEED * 0.8 * dt;
      this.walk += RUN_SPEED * 0.8 * dt * 0.22;
    }
    for (const m of this.marines) {
      if (m.state === DEAD) this.updateCorpse(m, dt);
    }

    const steps = Math.floor((this.clearing - EXIT_WALK) / TALLY_STEP) + 1;
    while (this.tallied < Math.min(steps, 3)) {
      this.tallied++;
      if (this.tallied === 1) {
        run.addScore(CLEAR_POINTS);
        run.play(CLEARED, -4);
      } else if (this.tallied === 2) {
        if (this.ghost) {
          run.addScore(GHOST_POINTS);
          run.play(GHOSTED, -4);
        }
      } else if (this.timePoints > 0) {
        run.addScore(this.timePoints);
        run.play(TALLY, -6, 1.3);
      }
    }

    if (this.clearing < EXIT_WALK + TALLY_TIME) return;
    if (this.room >= ROOMS.length - 1) {
      run.nextStage();
      return;
    }
    if (!this.fadeOut) {
      this.fadeOut = true;
      this.fade = 0;
    }
    this.fade += dt;
    if (this.fade >= ROOM_FADE) this.loadRoom(this.room + 1);
  }

  // Drawing ----------------------------------------------------------------------------------------------------

  /** World to screen. */
  sx(x) { return x - this.run.camera.x; }
  sy(y) { return y - this.run.camera.y; }

  drawBack(ctx) {
    const cam = this.run.camera;
    fill(ctx, 0, HUD_HEIGHT, SCREEN_W, VIEW_H, BLACK);
    const x0 = Math.max(0, Math.floor((cam.x - this.ox) / TILE));
    const x1 = Math.min(this.w - 1, Math.floor((cam.x - this.ox + SCREEN_W) / TILE));
    const y0 = Math.max(0, Math.floor((cam.y + HUD_HEIGHT) / TILE));
    const y1 = Math.min(this.h - 1, Math.floor((cam.y + SCREEN_H) / TILE));

    // the sand, with the faint grid of a training floor
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = this.tile(tx, ty);
        const x = this.sx(this.ox + tx * TILE);
        const y = this.sy(ty * TILE);
        const n = this.room * 4099 + ty * MAX_W + tx;
        if (t === EXIT) {
          this.drawExit(ctx, x, y);
          continue;
        }
        sprite(ctx, this.floors?.[Math.floor(hash01(n, 1) * 5.999)], x + TILE / 2, y + TILE / 2, TILE, TILE);
        fill(ctx, x, y, TILE, 1, GREEN, 0.04);
        fill(ctx, x, y, 1, TILE, GREEN, 0.04);
      }
    }

    // shadows, then the cones on the sand, then the cover over them
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = this.tile(tx, ty);
        const x = this.sx(this.ox + tx * TILE);
        const y = this.sy(ty * TILE);
        if (t === CRATE) fill(ctx, x + 3, y + 3, TILE, TILE, BLACK, 0.3);
        else if (t === SANDBAG) ellipse(ctx, x + 9, y + 14, 8, 3, BLACK, 0.35);
        else if (t === BARREL) ellipse(ctx, x + 9, y + 14, 6, 2.5, BLACK, 0.35);
      }
    }
    if (this.tower) ellipse(ctx, this.sx(this.tower.x) + 2, this.sy(this.tower.y) + 14, 20, 5, BLACK, 0.35);

    for (const m of this.marines) if (m.state !== DEAD) this.drawCone(ctx, m);
    if (this.spec.light) this.drawLightSpot(ctx);

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = this.tile(tx, ty);
        const x = this.sx(this.ox + tx * TILE);
        const y = this.sy(ty * TILE);
        const n = this.room * 4099 + ty * MAX_W + tx;
        switch (t) {
          case SCRUB: this.drawScrub(ctx, x, y, n); break;
          case ROCK: this.drawSmooth(ctx, ROCK_RSI, 'rock', this.corners[ty * MAX_W + tx], x, y); break;
          case WALL: this.drawSmooth(ctx, WALL_RSI, 'colony', this.corners[ty * MAX_W + tx], x, y); break;
          case CRATE: this.drawCrate(ctx, tx, ty, x, y, n); break;
          case BARREL: this.object(ctx, BARREL_RSI, BARRELS[Math.floor(hash01(n, 12) * 3.999)], SOUTH, x, y); break;
          case FENCE: this.drawFence(ctx, x, y, this.fence[ty * MAX_W + tx]); break;
          case SANDBAG: this.object(ctx, SANDBAG_RSI, 'sandbag', this.sandbagDir(tx, ty), x, y); break;
        }
      }
    }

    // boulders on the lone outcrops
    for (let i = 0; i < this.boulders.length; i += 2) {
      const tx = this.boulders[i];
      const ty = this.boulders[i + 1];
      const x = this.sx(this.ox + (tx + 1) * TILE);
      const y = this.sy((ty + 1) * TILE) - 2;
      if (x < -TILE * 2 || x > SCREEN_W + TILE * 2 || y < 0 || y > SCREEN_H + TILE * 2) continue;
      sprite(ctx, this.run.frame(BOULDER_RSI, BOULDERS[(tx + ty) & 1]), x, y, TILE * 2, TILE * 2);
    }

    // the wreck, over its footprint of 4 x 2 tiles
    const wreck = this.spec.wreck;
    if (wreck) {
      const x = this.sx(this.ox + (wreck[0] + 2) * TILE);
      const y = this.sy((wreck[1] + 2) * TILE) + 2 - WRECK_H / 4;
      sprite(ctx, this.run.frame(WRECK_RSI, 'car_pileup'), x, y, WRECK_W / 2, WRECK_H / 2);
    }
  }

  /** A 32 px game sprite filling one tile. */
  object(ctx, rsi, state, dir, x, y) {
    sprite(ctx, this.run.frame(rsi, state, dir), x + TILE / 2, y + TILE / 2, TILE, TILE);
  }

  /**
   * Cargo: a block two crate tiles tall is a row of containers, drawn from its top tile (left, middle and right
   * pieces, one colour per row); a crate on its own is a crate.
   */
  drawCrate(ctx, tx, ty, x, y, n) {
    if (this.tile(tx, ty - 1) === CRATE) return;
    if (this.tile(tx, ty + 1) !== CRATE) {
      this.object(ctx, CRATES[Math.floor(hash01(n, 12) * 3.999)], 'icon', SOUTH, x, y);
      return;
    }
    let start = tx;
    while (this.tile(start - 1, ty) === CRATE && this.tile(start - 1, ty + 1) === CRATE) start--;
    const colour = CONTAINERS[Math.floor(hash01(this.room * 4099 + ty * MAX_W + start, 13) * 2.999)];
    const left = start === tx;
    const right = !(this.tile(tx + 1, ty) === CRATE && this.tile(tx + 1, ty + 1) === CRATE);
    const piece = left ? colour[0] : right ? colour[2] : colour[1];
    sprite(ctx, this.run.frame(CONTAINER_RSI, piece), x + TILE / 2, y + TILE, TILE, TILE * 2);
  }

  /** A corner-smoothed wall tile: four quarter sprites, each its corner's state, facing the corner's way. */
  drawSmooth(ctx, rsi, base, corners, x, y) {
    this.object(ctx, rsi, base + (corners & 7), SOUTH, x, y);
    this.object(ctx, rsi, base + (corners >> 3 & 7), EAST, x, y);
    this.object(ctx, rsi, base + (corners >> 6 & 7), NORTH, x, y);
    this.object(ctx, rsi, base + (corners >> 9 & 7), WEST, x, y);
  }

  /** A lone 2 x 2 outcrop of rock, away from the walls of the room, gets a boulder on it; this is its top left tile. */
  boulder(tx, ty) {
    for (let y = ty - 1; y <= ty + 2; y++) {
      for (let x = tx - 1; x <= tx + 2; x++) {
        const inside = x >= tx && x <= tx + 1 && y >= ty && y <= ty + 1;
        if (x <= 0 || y <= 0 || x >= this.w - 1 || y >= this.h - 1) return false;
        if ((this.grid[y * MAX_W + x] === ROCK) !== inside) return false;
      }
    }
    return true;
  }

  /** Sandbags run along a line of them: side on (east) when the line runs up and down. */
  sandbagDir(tx, ty) {
    if (this.tile(tx - 1, ty) === SANDBAG || this.tile(tx + 1, ty) === SANDBAG) return SOUTH;
    return this.tile(tx, ty - 1) === SANDBAG || this.tile(tx, ty + 1) === SANDBAG ? EAST : SOUTH;
  }

  drawExit(ctx, x, y) {
    const pulse = 0.5 + 0.5 * Math.sin(this.run.clock * 5);
    fill(ctx, x, y, TILE, TILE, EXIT_COLOUR);
    fill(ctx, x, y, TILE, TILE, GREEN, 0.08 + 0.12 * pulse);
    // chevrons pointing out
    const dx = this.exitDx;
    const dy = this.exitDy;
    const shift = (this.run.clock * 12) % 8;
    for (let k = 0; k < 2; k++) {
      const c = k * 8 + shift - 4;
      const cx = x + 8 + dx * c;
      const cy = y + 8 + dy * c;
      const px = -dy;
      const py = dx;
      line(ctx, cx - dx * 3 + px * 3, cy - dy * 3 + py * 3, cx, cy, ACID, 0.7);
      line(ctx, cx - dx * 3 - px * 3, cy - dy * 3 - py * 3, cx, cy, ACID, 0.7);
    }
  }

  /** A cactus or a few stones on the sand. */
  drawScrub(ctx, x, y, n) {
    const k = Math.floor(hash01(n, 8) * 3.999);
    if (hash01(n, 9) < 0.5) this.object(ctx, CACTUS_RSI, CACTI[k], SOUTH, x, y);
    else this.object(ctx, STONE_RSI, STONES[k], SOUTH, x, y);
  }

  /** The fence sprite joined to its neighbours: the game's bits are north 1, south 2, east 4, west 8. */
  drawFence(ctx, x, y, bits) {
    const joins = (bits & 4 ? 1 : 0) | (bits & 8 ? 2 : 0) | (bits & 2 ? 4 : 0) | (bits & 1 ? 8 : 0);
    this.object(ctx, FENCE_RSI, `fence${joins}`, SOUTH, x, y);
  }

  coneColour(m) {
    switch (m.state) {
      case COMBAT: return ALARM;
      case HUNT:
      case SEARCH: return AMBER;
      case SUSPECT: return m.meter > 0.5 ? AMBER : GREEN;
      default: return GREEN;
    }
  }

  drawCone(ctx, m) {
    const ox = this.sx(m.x);
    const oy = this.sy(m.y);
    const half = m.tower ? TOWER_HALF : CONE_HALF;
    const colour = this.coneColour(m);
    const alpha = m.state === COMBAT ? 0.16 : 0.11;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    for (let i = 0; i <= RAYS; i++) {
      const a = m.facing - half + 2 * half * i / RAYS;
      ctx.lineTo(ox + Math.cos(a) * m.rays[i], oy + Math.sin(a) * m.rays[i]);
    }
    ctx.closePath();
    ctx.fill();
    // a brighter core near the marine
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    for (let i = 0; i <= RAYS; i++) {
      const a = m.facing - half + 2 * half * i / RAYS;
      const r = Math.min(m.rays[i], this.rangeOf(m) * 0.5);
      ctx.lineTo(ox + Math.cos(a) * r, oy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    // the edge of the view
    for (let i = 0; i < RAYS; i++) {
      const a = m.facing - half + 2 * half * i / RAYS;
      const b = m.facing - half + 2 * half * (i + 1) / RAYS;
      line(ctx, ox + Math.cos(a) * m.rays[i], oy + Math.sin(a) * m.rays[i], ox + Math.cos(b) * m.rays[i + 1],
        oy + Math.sin(b) * m.rays[i + 1], colour, 0.3);
    }
    const a0 = m.facing - half;
    const a1 = m.facing + half;
    line(ctx, ox, oy, ox + Math.cos(a0) * m.rays[0], oy + Math.sin(a0) * m.rays[0], colour, 0.22);
    line(ctx, ox, oy, ox + Math.cos(a1) * m.rays[RAYS], oy + Math.sin(a1) * m.rays[RAYS], colour, 0.22);
  }

  drawLightSpot(ctx) {
    const x = this.sx(this.lightX);
    const y = this.sy(this.lightY);
    const hot = this.tower && this.tower.state === COMBAT;
    const flicker = 0.92 + 0.08 * Math.sin(this.run.clock * 23);
    circle(ctx, x, y, LIGHT_RADIUS + 4, hot ? ALARM : BRIGHT, 0.05 * flicker);
    circle(ctx, x, y, LIGHT_RADIUS, hot ? ALARM : BRIGHT, 0.13 * flicker);
    circle(ctx, x, y, LIGHT_RADIUS * 0.6, BRIGHT, 0.1 * flicker);
    circle(ctx, x, y, LIGHT_RADIUS, hot ? ALARM : BRIGHT, 0.35, false);
  }

  drawFront(ctx) {
    for (const m of this.marines) if (m.state === DEAD) this.drawCorpse(ctx, m);
    if (this.dead) this.drawDeadRunner(ctx);

    // walkers back to front
    const order = this.order;
    order.length = 0;
    for (const m of this.marines) if (m.state !== DEAD) order.push(m);
    if (!this.dead) order.push(this);
    // the tower stands on its footprint, so it sorts by its base
    const depth = e => e.tower ? e.y + TILE : e.y;
    order.sort((a, b) => depth(a) - depth(b));
    for (const e of order) {
      if (e === this) this.drawRunner(ctx);
      else if (e.tower) this.drawTower(ctx);
      else this.drawMarine(ctx, e, this.sx(e.x), this.sy(e.y));
    }

    for (const m of this.marines) if (m.state !== DEAD) this.drawLaser(ctx, m);
    for (const b of this.bullets) {
      const x = this.sx(b.x);
      const y = this.sy(b.y) - b.lift;
      const speed = Math.hypot(b.vx, b.vy);
      const tx = x - b.vx / speed * TRACER;
      const ty = y - b.vy / speed * TRACER;
      beam(ctx, tx, ty, x, y, 4, TRACER_GLOW, 0.3);
      beam(ctx, tx, ty, x, y, 1.6, TRACER_CORE);
    }
    for (const m of this.marines) if (m.state !== DEAD && m.flash > 0) this.drawMuzzle(ctx, m);
    for (const m of this.marines) if (m.state !== DEAD) this.drawGlyph(ctx, m);
  }

  drawMarine(ctx, m, x, y) {
    const run = this.run;
    const bob = m.moving ? Math.abs(Math.sin(m.gait)) * 1.2 : 0;
    const sway = m.moving ? Math.sin(m.gait) * 0.05 : 0;
    ellipse(ctx, x, y + 3, 6, 2.5, BLACK, 0.45);
    run.drawPerson(ctx, m.person, x, y + 4 - bob, personDir(m.facing), MARINE_SCALE, sway);
  }

  drawCorpse(ctx, m) {
    const x = this.sx(m.x);
    const y = this.sy(m.y);
    const fall = m.fall * m.fall;
    this.run.drawPerson(ctx, m.person, x + m.fallDir * 3 * fall, y - lerp(10, 2, fall), personDir(m.facing), MARINE_SCALE,
      m.fallDir * fall * Math.PI / 2, true);
  }

  drawRunner(ctx) {
    const run = this.run;
    const x = this.sx(this.px);
    const y = this.sy(this.py);
    const dir = runnerDir(this.facing);
    const speed = Math.hypot(this.vx, this.vy);
    const moving = speed > 10 && this.pounce <= 0;
    const leap = this.pounce > 0 ? Math.sin((1 - this.pounce / POUNCE_TIME) * Math.PI) : 0;
    const scale = RUNNER_SCALE * (1 + 0.12 * leap);
    const box = 64 * scale;
    const bob = moving ? Math.abs(Math.sin(this.walk)) * 1.5 : 0;
    const squash = moving ? 0.04 * Math.sin(this.walk * 2) : 0;
    const tilt = moving && (dir === EAST || dir === WEST) ? Math.sin(this.walk) * 0.04 : 0;
    const side = dir === EAST || dir === WEST;
    const shift = dir === SOUTH ? 4 : dir === NORTH ? -3.5 : 0;
    const lift = leap * 8 + bob;
    ellipse(ctx, x, y + 3, side ? 17 : 10, 3.2, BLACK, 0.45 - 0.2 * leap);

    const image = run.frame(RUNNER, 'alive', dir);
    // ghosts of the leap
    for (const t of this.trail) {
      sprite(ctx, image, this.sx(t.x) - shift * scale, this.sy(t.y) + 3 - 14 * scale - lift * 0.5, box, box, 0, 0.18);
    }
    if (this.pounce <= 0) this.trail.length = 0;
    const blink = this.grace > 0 && Math.floor(this.grace * 14) % 2 === 0;
    const stun = this.stun > 0 ? Math.sin(this.stun * 40) * 0.08 : 0;
    sprite(ctx, image, x - shift * scale, y + 3 - 14 * scale - lift, box * (1 + squash), box * (1 - squash), tilt + stun, blink ? 0.35 : 1);
  }

  drawDeadRunner(ctx) {
    const s = RUNNER_SCALE;
    sprite(ctx, this.run.frame(RUNNER, 'dead'), this.sx(this.px) + 3.5 * s, this.sy(this.py) + 6 * s - 2, 64 * s, 64 * s);
  }

  drawLaser(ctx, m) {
    if (m.state !== COMBAT || m.burst > 0 || m.cooldown > 0 || m.aim >= AIM_TIME || !(m.sees || m.tower && this.lightSees)) return;
    const k = 1 - m.aim / AIM_TIME;
    if (Math.sin(this.run.clock * 60) < -0.3 && k < 0.7) return;
    const lift = m.tower ? CHEST + LIFT : CHEST;
    const x = this.sx(m.x + Math.cos(m.facing) * 9);
    const y = this.sy(m.y + Math.sin(m.facing) * 9) - lift;
    const tx = this.sx(this.px);
    const ty = this.sy(this.py) - 6;
    line(ctx, x, y, tx, ty, LASER, 0.25 + 0.5 * k);
    circle(ctx, tx, ty, 1.5, LASER, 0.6 + 0.4 * k);
  }

  drawMuzzle(ctx, m) {
    const k = m.flash / 0.06;
    const lift = m.tower ? CHEST + LIFT : CHEST;
    const x = this.sx(m.x + Math.cos(m.facing) * 11);
    const y = this.sy(m.y + Math.sin(m.facing) * 11) - lift;
    circle(ctx, x, y, 6 * k + 2, TRACER_GLOW, 0.5 * k);
    circle(ctx, x, y, 2.5 * k + 1, TRACER_CORE, k);
  }

  /** The watchtower over its 2 x 2 footprint, its guard on the platform, and the searchlight's lamp. */
  drawTower(ctx) {
    const m = this.tower;
    const x = this.sx(m.x);
    const y = this.sy(m.y);
    sprite(ctx, this.run.frame(TOWER_RSI, 'watchtower'), x, y + TILE - 24, 32, 48);
    this.drawMarine(ctx, m, x, y - LIFT);
    if (!this.spec.light) return;
    // the lamp, and its beam to the spot
    const lx = x + 10;
    const ly = y - LIFT - 12;
    const sx = this.sx(this.lightX);
    const sy = this.sy(this.lightY);
    const angle = Math.atan2(sy - ly, sx - lx);
    const px = -Math.sin(angle) * LIGHT_RADIUS * 0.9;
    const py = Math.cos(angle) * LIGHT_RADIUS * 0.9;
    quad(ctx, lx, ly, lx, ly, sx + px, sy + py, sx - px, sy - py, BRIGHT, 0.05);
    circle(ctx, lx, ly, 2.5, DIM);
    circle(ctx, lx + Math.cos(angle) * 1.5, ly + Math.sin(angle) * 1.5, 1.5, BRIGHT);
  }

  drawGlyph(ctx, m) {
    const x = this.sx(m.x);
    const y = this.sy(m.y) - (m.tower ? LIFT + 2 : 0) - 32;
    if (m.state === COMBAT) {
      if (m.pop <= 0) return;
      const t = 1 - m.pop / 0.9;
      const jump = Math.sin(Math.min(1, t * 4) * Math.PI) * 5;
      centreText(ctx, BIG_FONT, '!', x, y - 10 - jump, ALARM, Math.min(1, m.pop * 4));
      return;
    }
    if (m.state === HUNT || m.state === SEARCH) {
      centreText(ctx, TEXT_FONT, '?', x, y, AMBER, 0.8);
      return;
    }
    if (m.meter <= 0) return;
    const colour = m.meter > 0.6 ? ALARM : AMBER;
    centreText(ctx, TEXT_FONT, '!', x, y - 2, colour, 0.4 + 0.6 * m.meter);
    fill(ctx, x - 6, y + 9, 12, 2, BLACK, 0.7);
    fill(ctx, x - 6, y + 9, 12 * clamp(m.meter, 0, 1), 2, colour);
  }

  drawOverlay(ctx) {
    const run = this.run;
    const top = HUD_HEIGHT + 2;
    fill(ctx, 0, HUD_HEIGHT, SCREEN_W, 12, BLACK, 0.4);
    text(ctx, SMALL_FONT, this.roomText, 6, top, GREEN, 0.75);
    // health
    for (let i = 0; i < HEALTH; i++) {
      const x = 86 + i * 10;
      const y = top + 5;
      if (i < this.health) quad(ctx, x, y - 4, x + 4, y, x, y + 4, x - 4, y, ACID);
      else quad(ctx, x, y - 3, x + 3, y, x, y + 3, x - 3, y, DARK_ACID, 0.5);
    }

    let combat = false;
    let caution = false;
    for (const m of this.marines) {
      if (m.state === COMBAT) combat = true;
      else if (m.state === HUNT || m.state === SEARCH) caution = true;
    }
    if (this.clearing < 0 && !this.dead) {
      if (combat && run.clock % 0.5 < 0.32) centreText(ctx, TEXT_FONT, T.alert, 282, top - 1, ALARM);
      else if (!combat && caution) centreText(ctx, TEXT_FONT, T.caution, 282, top - 1, AMBER);
    }

    // the exit's sign
    const ex = this.sx(this.exitX) - this.exitDx * 22;
    const ey = this.sy(this.exitY) - this.exitDy * 22 - 4;
    if (ex > 0 && ex < SCREEN_W && ey > HUD_HEIGHT && ey < SCREEN_H) {
      centreText(ctx, SIGN_FONT, T.exit, clamp(ex, 16, SCREEN_W - 16), clamp(ey, HUD_HEIGHT + 14, SCREEN_H - 12), ACID,
        0.6 + 0.3 * Math.sin(run.clock * 5));
    }

    if (this.banner > 0 && this.clearing < 0) {
      const alpha = clamp(this.banner / 0.5, 0, 1) * clamp((BANNER_TIME - this.banner) / 0.3, 0, 1);
      centreText(ctx, TEXT_FONT, this.bannerText, SCREEN_W / 2, 196, GREEN, alpha);
    }

    if (this.clearing >= EXIT_WALK) this.drawTally(ctx);
    if (this.fade > 0) fill(ctx, 0, HUD_HEIGHT, SCREEN_W, VIEW_H, BLACK, clamp(this.fade / ROOM_FADE, 0, 1));
  }

  drawTally(ctx) {
    const t = this.clearing - EXIT_WALK;
    fill(ctx, 64, 66, 192, 84, BLACK, 0.78);
    outline(ctx, 64, 66, 192, 84, DIM);
    centreText(ctx, TEXT_FONT, T.clear, SCREEN_W / 2, 72, ACID);
    if (this.tallied >= 1) centreText(ctx, SMALL_FONT, this.clearText, SCREEN_W / 2, 92, BRIGHT);
    if (this.tallied >= 2) centreText(ctx, SMALL_FONT, this.ghostText, SCREEN_W / 2, 105, this.ghost ? ACID : DIM);
    if (this.tallied >= 3) centreText(ctx, SMALL_FONT, this.timeText, SCREEN_W / 2, 118, BRIGHT);
    if (t >= TALLY_STEP * 3) centreText(ctx, SMALL_FONT, this.killText, SCREEN_W / 2, 132, DIM);
  }
}
