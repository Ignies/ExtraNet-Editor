// Baseball: the simulation (CMUSports.Baseball.cs) and its arena (Sports/CMUBaseballArena.cs). The ballpark seen
// from high behind home plate, six innings. The pitcher winds up and deals, the bat cracks, fielders run the ball
// down and throw it in, runners slide into the bags, and home runs leave the park under fireworks with the crowd
// on its feet. Beanballs, broken bats, foul balls into the stands and collisions at the plate draw blood that
// stays in the dirt. Everything is posed from the match's events, so a late joiner sees the same field.

import { Sport, Action, Innings, L, Colours, defineSport, f, ev, kitColour, matchName, sportLength } from './core.js';
import { layerCanvas } from './dolls.js';
import {
  Arena, ArenaWidth, ArenaHeight, Bar, Dir, GOLD, BLOOD, DARK_BLOOD, lerp, clamp, shortName, kitCss, rect, circle,
  line, texture,
} from './arena.js';

// ---------------------------------------------------------------- the simulation

/** An AtBat value besides 0 to 4: the pitch hits the batter, who takes first. */
export const HitByPitch = 5;
/** Where an at-bat's kind (0 to 3) and direction (0 left field line to 4 right) sit in its state. */
export const KindShift = 8;
export const DirectionShift = 11;
/** Out kinds. Hits use the same bits for how the ball flies: grounder, liner, fly ball, blooper. */
export const Strikeout = 0;
export const Groundout = 1;
export const Flyout = 2;
export const Popout = 3;
/** Special kinds: the bat shatters (extra: who the shard hits), a foul ball hits a fan (extra: stand, state: fan), a walk-off. */
export const BrokenBat = 1;
export const FanHit = 2;
export const WalkOff = 3;
/** Who gets hurt, in an Injury's value and a broken bat's extra. */
export const HurtPitcher = 0;
export const HurtBatter = 1;
export const HurtCatcher = 2;
export const HurtRunner = 3;
export const HurtThirdBase = 4;

const LeadTime = 3;
const TailTime = 7;
const FoulWeight = 9;

/** CMUSports.Baseball. Deterministic from the seed and the winner; three rolls per plate appearance, in this order. */
export function playBaseball(random, winner) {
  let innings = [[], []];
  for (let side = 0; side < 2; side++) {
    for (let inning = 0; inning < Innings; inning++) {
      const half = innings[side][inning] = [];
      let outs = 0;
      while (outs < 3) {
        const roll = random.nextDouble();
        const detail = Math.trunc(random.nextDouble() * 20);
        const luck = random.nextDouble();
        const outcome = half.length >= 8 || roll < 0.62 ? 0
          : roll < 0.655 ? HitByPitch
            : roll < 0.82 ? 1
              : roll < 0.91 ? 2
                : roll < 0.95 ? 3
                  : 4;
        half.push({ outcome, detail, luck });
        if (outcome === 0) outs++;
      }
    }
  }

  const totals = [runs(innings[0]), runs(innings[1])];
  if (totals[winner] < totals[1 - winner]) innings = [innings[1], innings[0]];
  // a tie goes to the winner with a home run just before their last out, to straightaway centre
  if (totals[0] === totals[1]) {
    const last = innings[winner][Innings - 1];
    last.splice(last.length - 1, 0, { outcome: 4, detail: 2, luck: 0.5 });
  }

  // away (side 1) bats in the top of each inning, home (side 0) in the bottom
  const play = { events: [], score: [0, 0], result: '' };
  const steps = [];
  let over = false;
  for (let inning = 0; inning < Innings && !over; inning++) {
    for (let side = 1; side >= 0 && !over; side--) {
      const final = inning === Innings - 1 && side === 0;
      if (final && play.score[0] > play.score[1]) break;
      steps.push({ side, inning, bell: true, weight: 9 });
      const bases = { value: 0 };
      let outs = 0;
      for (const at of innings[side][inning]) {
        const before = bases.value;
        const scored = advance(bases, at.outcome);
        if (at.outcome === 0) outs++;
        play.score[side] += scored;
        // the home side never bats on once it leads in the last inning
        over = final && play.score[0] > play.score[1];
        const step = { side, inning, bell: false, at, runs: scored, before, state: bases.value | (outs << 4), walkOff: over };
        step.weight = weight(step);
        steps.push(step);
        if (over) break;
      }
    }
  }

  let total = 0;
  for (const step of steps) total += step.weight;
  // every step gets time by its weight, so a home run trot lasts longer than a strikeout
  const unit = f(f(f(sportLength(Sport.Baseball) - LeadTime) - TailTime) / total);
  let elapsed = 0;
  for (const step of steps) {
    const start = f(LeadTime + f(unit * elapsed));
    elapsed += step.weight;
    if (step.bell) {
      play.events.push(ev(start, Action.Bell, step.side, step.inning + 1));
      continue;
    }
    stepEvents(play, step, start, unit);
  }

  play.result = `${play.score[0]} - ${play.score[1]}`;
  return play;
}

/** The events of one plate appearance starting at start. Each lands at its own time. */
function stepEvents(play, step, start, unit) {
  const at = step.at;
  const side = step.side;
  const kind = Math.trunc(at.detail / 5);
  const direction = at.detail % 5;
  let contact = start;
  if (fouled(at)) {
    play.events.push(ev(f(start + f(unit * 5)), Action.Special, side, FanHit,
      Math.trunc(at.luck * 1000) % 2, Math.trunc(at.luck * 100000) % 64));
    contact = f(start + f(unit * FoulWeight));
  }

  play.events.push(ev(contact, Action.AtBat, side, at.outcome, step.runs,
    step.state | (kind << KindShift) | (direction << DirectionShift)));

  if (step.walkOff) play.events.push(ev(f(contact + f(0.02)), Action.Special, side, WalkOff, step.runs));
  if (at.outcome === HitByPitch) play.events.push(ev(f(contact + f(0.05)), Action.Injury, side, HurtBatter, 1 + Math.trunc(at.luck * 3)));
  if (broken(at)) {
    const victim = at.luck < 0.08 ? HurtPitcher : HurtThirdBase;
    play.events.push(ev(f(contact + f(0.01)), Action.Special, side, BrokenBat, victim));
    play.events.push(ev(f(contact + f(0.3)), Action.Injury, 1 - side, victim, 1 + Math.trunc(at.luck * 100) % 3));
  }
  if (collision(step)) {
    // the lead runner reaches the plate later the further back he started
    const lead = step.before >= 4 ? 3 : step.before >= 2 ? 2 : 1;
    const crash = f(contact + f(unit * (3 + 3 * (4 - lead))));
    play.events.push(ev(crash, Action.Injury, 1 - side, HurtCatcher, 1 + Math.trunc(at.luck * 10) % 3));
    play.events.push(ev(f(crash + f(0.03)), Action.Injury, side, HurtRunner, 1 + Math.trunc(at.luck * 40) % 3));
  }
}

const fouled = at => at.luck >= 0.94;
const broken = at => at.outcome === 0 && Math.trunc(at.detail / 5) === Groundout && at.luck < 0.16;
const collision = step => step.at.outcome >= 1 && step.at.outcome <= 3 && step.runs > 0 && step.at.luck < 0.35;

/** How long a plate appearance takes, in tenths of a step: a long hit takes longer to run out. */
function weight(step) {
  const at = step.at;
  const kind = Math.trunc(at.detail / 5);
  let w = at.outcome === 0 ? [8, 10, 12, 10][kind]
    : at.outcome === 1 ? 16 : at.outcome === 2 ? 18 : at.outcome === 3 ? 21 : at.outcome === 4 ? 28 : 20;
  if (fouled(at)) w += FoulWeight;
  if (broken(at)) w += 4;
  if (collision(step)) w += 12;
  return w;
}

function runs(innings) {
  let total = 0;
  for (const half of innings) {
    const bases = { value: 0 };
    for (const at of half) total += advance(bases, at.outcome);
  }
  return total;
}

/**
 * Moves every runner as many bases as the batter took, or only the forced ones when the batter is hit by the
 * pitch. Bits 0 to 2 are first to third. Returns the runs scored.
 */
export function advance(bases, outcome) {
  if (outcome === 0) return 0;
  if (outcome === 4) {
    const home = bitCount(bases.value) + 1;
    bases.value = 0;
    return home;
  }
  if (outcome === HitByPitch) {
    // the batter fills the lowest empty bag, pushing up everyone in front of it
    bases.value |= ~bases.value & (bases.value + 1);
  } else {
    bases.value = (bases.value << outcome) | (1 << (outcome - 1));
  }
  const scored = bitCount(bases.value >> 3);
  bases.value &= 7;
  return scored;
}

function bitCount(bits) {
  let count = 0;
  for (; bits !== 0; bits >>= 1) count += bits & 1;
  return count;
}

// ---------------------------------------------------------------- strings (Games/baseball.ftl)

const T = {
  strikeout: 'STRIKE THREE!',
  out: 'OUT!',
  caught: 'CAUGHT!',
  single: 'SINGLE!',
  double: 'DOUBLE!',
  triple: 'TRIPLE!',
  homer: 'HOME RUN!',
  beanball: 'HIT BY PITCH!',
  takesFirst: 'He takes his base',
  brokenBat: 'BROKEN BAT!',
  fanDown: 'FAN DOWN!',
  collision: 'COLLISION AT THE PLATE!',
  safe: 'SAFE!',
  walkOff: 'WALK-OFF!',
  playBall: 'PLAY BALL!',
  runs: n => (n === 1 ? '1 RUN SCORES' : `${n} RUNS SCORE`),
  ordinal: n => (n === 1 ? '1ST' : n === 2 ? '2ND' : n === 3 ? '3RD' : `${n}TH`),
  top: inning => `TOP ${inning}`,
  bottom: inning => `BOTTOM ${inning}`,
  atBat: team => `${team} at bat`,
  matchup: (away, home) => `${away} at ${home}`,
  outs: 'OUTS',
  runsColumn: 'R',
  hitsColumn: 'H',
  mph: speed => `${speed} MPH`,
  feet: feet => `${feet} FT`,
};

// ---------------------------------------------------------------- sounds

const KnockSound = '/Audio/Weapons/dodgeball.ogg';
const BrokenBatSound = '/Audio/Effects/wood_destroy2.ogg';
const BounceSound = '/Audio/Effects/Footsteps/bounce.ogg';
const CrashSound = '/Audio/Effects/Footsteps/largethud.ogg';
const SmackSound = '/Audio/Effects/Footsteps/meatslap.ogg';
const PierceSound = '/Audio/_RMC14/Weapons/pierce.ogg';
const HornSound = '/Audio/Items/airhorn.ogg';
const ChimeSound = '/Audio/Effects/voteding.ogg';
/** The crack of the bat, the stadium's "charge!" fanfare, the crowd and the thud of a body going down. */
const HitSound = '/Audio/CMU14/PersonalComputers/Games/baseball_hit.ogg';
const ChargeSound = '/Audio/CMU14/PersonalComputers/Games/baseball_charge.ogg';
const SmallCheerSound = '/Audio/CMU14/PersonalComputers/Games/crowd_cheer_small.ogg';
const FallSound = '/Audio/CMU14/PersonalComputers/Games/fall.ogg';
/** Big cheers, long enough that only one plays at a time. */
const CheerSounds = ['/Audio/CMU14/PersonalComputers/Games/crowd_cheer_1.ogg', '/Audio/CMU14/PersonalComputers/Games/crowd_cheer_2.ogg'];
/** Pitches, swings and throws. */
const SwooshSounds = [
  '/Audio/CMU14/PersonalComputers/Games/swoosh_1.ogg', '/Audio/CMU14/PersonalComputers/Games/swoosh_2.ogg',
  '/Audio/CMU14/PersonalComputers/Games/swoosh_3.ogg',
];
const SlideSounds = ['/Audio/Effects/Footsteps/asteroid1.ogg', '/Audio/Effects/Footsteps/asteroid2.ogg', '/Audio/Effects/Footsteps/asteroid3.ogg'];
const MittSounds = ['/Audio/Weapons/boxingpunch1.ogg', '/Audio/Weapons/boxingpunch2.ogg', '/Audio/Weapons/boxingpunch3.ogg'];
const BeanSounds = ['/Audio/_RMC14/Weapons/genhit1.ogg', '/Audio/_RMC14/Weapons/genhit2.ogg', '/Audio/_RMC14/Weapons/genhit3.ogg'];
const MeatSounds = [
  '/Audio/Weapons/Guns/Hits/bullet_meat1.ogg', '/Audio/Weapons/Guns/Hits/bullet_meat2.ogg',
  '/Audio/Weapons/Guns/Hits/bullet_meat3.ogg', '/Audio/Weapons/Guns/Hits/bullet_meat4.ogg',
];
const ClapSounds = [
  '/Audio/Effects/Emotes/clap1.ogg', '/Audio/Effects/Emotes/clap2.ogg', '/Audio/Effects/Emotes/clap3.ogg',
  '/Audio/Effects/Emotes/clap4.ogg',
];
const WhistleSounds = [
  '/Audio/Voice/Human/whistle_1.ogg', '/Audio/Voice/Human/whistle_2.ogg', '/Audio/Voice/Human/whistle_3.ogg',
  '/Audio/Voice/Human/whistle_4.ogg',
];
const FireworkSounds = ['/Audio/Effects/explosionsmallfar.ogg'];
const ALL_SOUNDS = [
  KnockSound, BrokenBatSound, BounceSound, CrashSound, SmackSound, PierceSound, HornSound, ChimeSound,
  HitSound, ChargeSound, SmallCheerSound, FallSound, ...CheerSounds, ...SwooshSounds, ...SlideSounds, ...MittSounds,
  ...BeanSounds, ...MeatSounds,
  ...ClapSounds, ...WhistleSounds, ...FireworkSounds,
];

// ---------------------------------------------------------------- field geometry

const BatRsi = '/Textures/Objects/Weapons/Melee/baseball_bat.rsi';

// The field is laid out in true units of 90 ft (home to first), x to the right and y out to centre field, and
// projected so that things shrink with distance. Home plate sits near the bottom of the arena.
const HomeX = 260;
const HomeY = 206;
const DepthScale = 75;
const DepthFall = 0.3346;
const WidthScale = 139.9;
/** How far foul territory runs out from the lines to the stands. */
const FoulWidth = 0.45;

// Roles, the same for both sides. A runner's role is Batter plus the base he started the play on.
const Pitcher = 0;
const Catcher = 1;
const First = 2;
const Second = 3;
const Shortstop = 4;
const Third = 5;
const Left = 6;
const Centre = 7;
const Right = 8;
const Batter = 9;
const OnDeck = 13;
const Roles = 14;

/** Who is added first, so the far side of the field is drawn under the near side. */
const DrawOrder = [Centre, Left, Right, Second, Shortstop, Batter + 2, First, Third, Batter + 1, Batter + 3, Pitcher, OnDeck, Batter, Catcher];

/** Where each fielder plays, by role. */
const Spots = [[0, 0.672], [0, -0.17], [0.80, 0.98], [0.36, 1.50], [-0.36, 1.50], [-0.80, 0.98], [-1.75, 2.70], [0, 3.30], [1.75, 2.70]];
/** Home, first, second, third. */
const BaseSpots = [[0, 0], [0.7071, 0.7071], [0, 1.4142], [-0.7071, 0.7071]];
const BatterSpot = [-0.12, 0];
const Zone = [-0.02, 0.05];
const Mitt = [0, -0.13];
const Hand = [0.03, 0.62];
/** Dugouts and on-deck circles by side: home on the first base side, away on the third. */
const Dugouts = [[0.70, 0.14], [-0.70, 0.14]];
const Circles = [[0.50, -0.04], [-0.50, -0.04]];
const PathFacing = [Dir.East, Dir.North, Dir.West, Dir.South];

// Broadcast boxes over the stands, in arena units: the score bug, the outfield board and the radar gun.
const BugBox = [6, 30, 112, 32];
const BoardBox = [194, 28, 132, 38];
const RadarBox = [430, 30, 84, 16];

const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
const mul = (a, k) => [a[0] * k, a[1] * k];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const norm = a => {
  const l = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / l, a[1] / l];
};

function project(g) {
  const depth = 1 + DepthFall * g[1];
  return [HomeX + g[0] * WidthScale / depth, HomeY - DepthScale * g[1] / depth];
}

function unproject(s) {
  const rise = HomeY - s[1];
  const y = rise / (DepthScale - DepthFall * rise);
  return [(s[0] - HomeX) * (1 + DepthFall * y) / WidthScale, y];
}

/** How big things look at a height on screen: 1 at the plate, smaller out towards the fence. */
const near = screenY => 1 - DepthFall / DepthScale * (HomeY - screenY);

/** A point out from home, by degrees off straightaway centre (negative towards left field). */
function polar(degrees, distance) {
  const a = degrees * Math.PI / 180;
  return [Math.sin(a) * distance, Math.cos(a) * distance];
}

/** How far the fence is at an angle: 400 ft to centre, 330 down the lines. */
const fence = degrees => 4.44 - 0.77 * Math.pow(Math.min(1, Math.abs(degrees) / 45), 1.5);

function air(g, height) {
  const at = project(g);
  return [at[0], at[1] - height * near(at[1])];
}

const ring = (centre, radius, segments) => {
  const points = [];
  for (let i = 0; i < segments; i++) points.push(project(add(centre, polar(360 * i / segments, radius))));
  return points;
};

const Geometry = (() => {
  const leftLine = [-0.7071, 0.7071];
  const rightLine = [0.7071, 0.7071];
  const leftOut = [-0.7071, -0.7071];
  const rightOut = [0.7071, -0.7071];
  const pole = fence(45);

  // the whole playing surface around home: stands fronts, the fence, the backstop
  const backLeft = add(mul(leftLine, -0.25), leftOut, FoulWidth);
  const surface = [project(backLeft), project(add(mul(leftLine, pole), leftOut, FoulWidth))];
  for (let a = -45; a <= 45; a += 3) surface.push(project(polar(a, fence(a))));
  surface.push(project(add(mul(rightLine, pole), rightOut, FoulWidth)), project(add(mul(rightLine, -0.25), rightOut, FoulWidth)));
  for (let a = 164; a <= 196; a += 8) surface.push(project(polar(a, Math.hypot(backLeft[0], backLeft[1]))));

  const track = [];
  const wall = [];
  const top = [];
  for (let a = -45; a <= 45; a += 3) {
    const outer = project(polar(a, fence(a)));
    track.push([project(polar(a, fence(a) - 0.14)), outer]);
    const high = [outer[0], outer[1] - 7 * near(outer[1])];
    wall.push([outer, high]);
    top.push(high);
  }

  const stripes = [];
  for (let k = 0; k < 12; k += 2) {
    const wedge = [project([0, 0])];
    for (let a = -45 + k * 7.5; a <= -45 + (k + 1) * 7.5 + 0.01; a += 2.5) wedge.push(project(polar(a, fence(a) - 0.14)));
    stripes.push(wedge);
  }

  // the infield dirt: the arc behind the bags around the mound, closing down the lines to the plate
  const mound = Spots[Pitcher];
  const dirt = [project([1.006, 1.006])];
  for (let a = 72; a >= -72; a -= 8) dirt.push(project(add(mound, polar(a, 1.06))));
  dirt.push(project([-1.006, 1.006]), project([0, -0.14]));

  const quad = points => points.map(project);
  const bags = [1, 2, 3].map(i => {
    const b = BaseSpots[i];
    return quad([add(b, [0.036, 0]), add(b, [0, 0.036]), add(b, [-0.036, 0]), add(b, [0, -0.036])]);
  });

  // the front walls of the lower stands, and the dugouts set into them
  const rails = [];
  const dens = [];
  for (let side = 0; side < 2; side++) {
    const ln = side === 0 ? rightLine : leftLine;
    const away = side === 0 ? rightOut : leftOut;
    const n = project(add(mul(ln, -0.25), away, FoulWidth));
    const far = project(add(mul(ln, pole), away, FoulWidth));
    rails.push([n, far, [far[0], far[1] - 6 * near(far[1])], [n[0], n[1] - 6 * near(n[1])]]);
    const a = add(mul(ln, 0.22), away, FoulWidth);
    const b = add(mul(ln, 0.62), away, FoulWidth);
    dens.push(quad([a, b, add(b, away, 0.14), add(a, away, 0.14)]));
  }

  // batter's boxes and the foul lines, as pairs of points
  const chalk = [];
  for (const x of [-0.17, 0.05]) {
    const box = [[x, -0.08], [x + 0.12, -0.08], [x + 0.12, 0.08], [x, 0.08]];
    for (let i = 0; i < 4; i++) chalk.push([project(box[i]), project(box[(i + 1) % 4])]);
  }
  chalk.push([project([-0.12, 0.12]), project(mul(leftLine, pole))], [project([0.12, 0.12]), project(mul(rightLine, pole))]);

  return {
    surface, track, wall, top, stripes, dirt, bags, rails, dens, chalk,
    infield: quad([[0, 0.17], [0.58, 0.735], [0, 1.25], [-0.58, 0.735]]),
    plateCircle: ring([0, 0], 0.17, 20),
    moundRing: ring(mound, 0.1, 16),
    rubber: quad([[-0.035, 0.665], [0.035, 0.665], [0.035, 0.68], [-0.035, 0.68]]),
    plate: quad([[-0.028, 0], [0.028, 0], [0.028, -0.02], [0, -0.042], [-0.028, -0.02]]),
    poles: [project(mul(leftLine, pole)), project(mul(rightLine, pole))],
  };
})();

/** Whether a spot on screen is on the playing surface rather than up in the stands. */
function inside(at) {
  const s = Geometry.surface;
  let inside = false;
  for (let i = 0, j = s.length - 1; i < s.length; j = i++) {
    const a = s[i];
    const b = s[j];
    if ((a[1] > at[1]) !== (b[1] > at[1]) && at[0] < (b[0] - a[0]) * (at[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

const inBox = (box, at) => at[0] > box[0] - 3 && at[0] < box[0] + box[2] + 3 && at[1] > box[1] - 3 && at[1] < box[1] + box[3] + 3;

function hash(i) {
  let h = Math.imul(i, 2654435761) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h, 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return h & 0x7FFFFFFF;
}

const Skins = ['#F1C9A5', '#C68E63', '#8D5A3B', '#E0AC7E'];
const FireworkColours = ['#FFD24A', '#FF4A4A', '#5AE0FF', '#FFFFFF', '#9DFF5A'];
const Grass = '#3B8636';
const Mown = '#45943E';
const Clay = '#B6804F';
const Chalky = '#F2F0E6';
const Wood = '#9A6B3A';

/** The fans in every seat the field, the fence and the broadcast boxes leave free. */
const Seats = (() => {
  const seats = [];
  let index = 0;
  for (let row = 0; ; row++) {
    const y = Bar + 3 + row * 7;
    if (y > ArenaHeight - 2) break;
    for (let x = 3 + (row % 2) * 3.5; x < ArenaWidth - 2; x += 7, index++) {
      const at = [x, y];
      if (inside(at) || inside([x, y + 6]) || inside([x + 5, y + 3]) || inside([x - 5, y + 3])) continue;
      if (inBox(BugBox, at) || inBox(BoardBox, at) || inBox(RadarBox, at)) continue;
      const h = hash(index);
      seats.push({ at, size: 1.6 + 1.4 * near(y), shirt: h % 10, skin: (h >> 8) % Skins.length, phase: (h % 628) / 100 });
    }
  }
  return seats;
})();

/** The fans in the lower stands a foul ball can reach: third base side, then first. */
const FoulSeats = (() => {
  const foul = [[], []];
  Seats.forEach((seat, i) => {
    if (seat.at[1] > 120 && seat.at[1] < ArenaHeight - 10) foul[seat.at[0] < HomeX ? 0 : 1].push(i);
  });
  return foul;
})();

// The fans in the nearer seats are dressed like the game's people, from the same sprites. Up in the far deck a
// dressed sprite would shrink to a smudge of a few pixels, so those fans stay simple blocks of shirt and face.
const PartsRsi = '/Textures/Mobs/Species/Human/parts.rsi';
const EyesRsi = '/Textures/Mobs/Customization/eyes.rsi';
const HairRsi = '/Textures/Mobs/Customization/human_hair.rsi';
const SuitRsi = '/Textures/Clothing/Uniforms/Jumpsuits/Color/color.rsi';
const Civilians = '/Textures/_RMC14/Objects/Clothing/Uniforms/Civilian/';
/** Seats this low on screen or lower get dressed sprite fans. */
const SpriteRows = 96;
/** How many different fans a match dresses; every seat wears one of them. */
const Looks = 40;
const CivilianSuits = [
  'blue_jumpsuit.rsi', 'brown_utility.rsi', 'khaki_workwear.rsi', 'grey_jumpsuit.rsi', 'green_utility.rsi',
  'blue_workwear.rsi', 'lightbrown_jumpsuit.rsi', 'doctor.rsi', 'emt.rsi',
];
const MaleHair = ['crewcut', 'business', 'bedhead', 'buzzcut', 'afro'];
const FemaleHair = ['ponytail', 'bob', 'bun', 'longstraightponytail'];
const FanSkins = ['#FFE1CC', '#EDC2A0', '#C08A62', '#8A5634'];
const HairColours = ['#2A1A10', '#5A3A20', '#C89A50', '#1A1A1A', '#8A3A1A'];
const EyeColour = '#2B1A10';
/** The coloured jumpsuit's tint per kit colour, from the ClothingUniformJumpsuitColor prototypes. */
const SuitTints = {
  Red: '#eb0c07', Blue: '#52aecc', Green: '#9ed63a', Yellow: '#ffe14d', Orange: '#ff8c19', Purple: '#9f70cc', White: null, Brown: '#a17229',
};

/** The match's fans: sex, skin, hairstyle and colour, and what they wear (-1 home colours, -2 away, else a civilian suit). */
function fanLooks(id) {
  const looks = [];
  for (let look = 0; look < Looks; look++) {
    const h = hash((Math.imul(id, 131) + look * 7 + 1) | 0);
    const female = h % 100 < 45;
    const kind = (h >> 16) % 10;
    looks.push({
      female, skin: (h >> 7) % FanSkins.length, hair: (h >> 9) % (female ? FemaleHair.length : MaleHair.length),
      hairColour: (h >> 13) % HairColours.length, outfit: kind < 4 ? -1 : kind < 6 ? -2 : (h >> 20) % CivilianSuits.length,
    });
  }
  return looks;
}

/** A fan's sprite layers in the order the game draws a person: body, eyes, clothes, hands, hair. */
function fanLayers(look, homeSuit, awaySuit) {
  const skin = FanSkins[look.skin];
  const layers = [
    [PartsRsi, look.female ? 'torso_f' : 'torso_m', skin], [PartsRsi, look.female ? 'head_f' : 'head_m', skin],
    [EyesRsi, 'eyes', EyeColour], [PartsRsi, 'r_arm', skin], [PartsRsi, 'l_arm', skin],
  ];
  if (look.outfit < 0) {
    layers.push([SuitRsi, 'equipped-INNERCLOTHING', look.outfit === -1 ? homeSuit : awaySuit], [SuitRsi, 'trinkets-equipped-INNERCLOTHING', null]);
  } else {
    layers.push([Civilians + CivilianSuits[look.outfit], 'equipped-INNERCLOTHING', null]);
  }
  layers.push([PartsRsi, 'l_hand', skin], [PartsRsi, 'r_hand', skin]);
  layers.push([HairRsi, look.female ? FemaleHair[look.hair] : MaleHair[look.hair], HairColours[look.hairColour]]);
  return layers;
}

/** Fans in the stands left of home look right to the field (east), fans on the right look left (west). */
const fanFacing = seat => (seat.at[0] < HomeX ? Dir.East : Dir.West);

/** Composites one fan facing a direction into a 32 x 32 canvas, from each layer's own frame for that direction. */
async function fanCanvas(layers, direction) {
  const images = await Promise.all(layers.map(([rsi, state, tint]) => layerCanvas(rsi, state, direction, tint).catch(e => {
    console.warn(`baseball fans: ${e.message}`);
    return null;
  })));
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const c = canvas.getContext('2d');
  for (const image of images) if (image) c.drawImage(image, 0, 0);
  return canvas;
}

/**
 * Draws a fan's head and shoulders (the top 22 rows of the sprite: the seat in front hides the rest) with the head
 * on the seat, turned by rotation radians.
 */
function drawFan(c, image, x, y, size, rotation = 0) {
  // the sprite's head spans rows 3 to 11, centred on column 16
  const k = size * 0.14;
  c.save();
  c.translate(x, y - size);
  if (rotation) c.rotate(rotation);
  c.drawImage(image, 0, 0, 32, 22, -16 * k, -3 * k, 32 * k, 22 * k);
  c.restore();
}

const smooth = x => {
  x = clamp(x, 0, 1);
  return x * x * (3 - 2 * x);
};

function facing(from, to) {
  const a = project(from);
  const b = project(to);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? Dir.East : Dir.West;
  return dy > 0 ? Dir.South : Dir.North;
}

/** A point along the base paths: 0 home, 1 first, 2 second, 3 third, 4 home again. */
function path(u) {
  u = clamp(u, 0, 4);
  const leg = Math.min(Math.trunc(u), 3);
  return lerp(BaseSpots[leg], BaseSpots[(leg + 1) % 4], u - leg);
}

/** How long before the ball reaches the plate the pitcher starts his windup. */
const leadFor = gap => clamp(gap * 0.36, 0.25, 0.55);
const pitchTime = lead => Math.min(0.24, lead * 0.42);

/** How high the pitch hits the batter, by where: head, shoulder, ribs, leg. */
const wound = kind => [27, 22, 17, 8][kind] ?? 8;

const standing = (ground, dir) => ({ ground, facing: dir, lift: 0, squash: 1, lie: 0, rotation: 0, alpha: 1 });

// ---------------------------------------------------------------- the match as the arena plays it

/**
 * One plate appearance worked out from the events: what happened, when the pitches come, and how everyone
 * moves. The choreography is written in its own seconds after contact and stretched by pace to fill the time
 * the match gives it.
 */
class Plate {
  constructor(fields) {
    Object.assign(this, {
      fouled: false, foul: 0, foulWindup: 0, foulRelease: 0, fanTime: 0, fanSeat: 0,
      broken: false, shard: NaN, shardVictim: 0, crash: NaN, crashBase: 1, severity: 0,
      walkOff: false, lastOfHalf: false, lastOfGame: false, charge: false,
      start: 0, windup: 0, release: 0, end: 0, pace: 1, finish: 1,
      ball: [], moves: [], catching: -1, watch: NaN, landed: NaN, caught: NaN, thrown: NaN, throwBase: 2,
      safe: false, slide: NaN, batterFrom: 0.18, runFrom: 0.05, perBase: 0.55, mob: NaN,
      call: '', callColour: '#FFFFFF', callAt: 0, line: '', lineAt: 0, speed: '', distance: '',
    }, fields);
  }

  /** Real time of a choreography moment. */
  real(tau) {
    return this.contact + tau * this.pace;
  }

  move(role, to, from, by) {
    this.moves.push({ role, to, from, by });
  }

  flight(from, to, a, b, heightA, heightB, arc, hops = 0) {
    this.ball.push({ from, to, a, b, heightA, heightB, arc, hops });
  }

  has(startBase) {
    return startBase === 0 || (this.before & (1 << (startBase - 1))) !== 0;
  }
}

/** How many bases the runner who started on k (0 the batter) takes on the play. */
function basesRun(p, k) {
  if (p.outcome === 0) return 0;
  if (p.outcome === 4) return 4 - k;
  if (p.outcome === HitByPitch) {
    // forced only when every bag behind him is full
    for (let b = 1; b <= k; b++) if ((p.before & (1 << (b - 1))) === 0) return 0;
    return 1;
  }
  return Math.min(p.outcome, 4 - k);
}

/** When the last runner home crosses the plate, or when the batter stops if nobody scores. */
function lastArrival(p) {
  let last = 0;
  for (let k = 0; k <= 3; k++) {
    if (!p.has(k)) continue;
    const bases = basesRun(p, k);
    const from = k === 0 ? p.batterFrom : p.runFrom;
    if (bases > 0) last = Math.max(last, from + bases * p.perBase);
  }
  return last;
}

function hashSpeed(n) {
  return 86 + hash(n) % 15;
}

/** Works out who runs where and how the ball flies for one plate appearance. */
function choreograph(p) {
  const dir = p.direction;
  p.speed = T.mph(hashSpeed(p.number * 7 + p.half.inning));
  if (p.outcome === 0) {
    choreographOut(p, dir);
  } else if (p.outcome === HitByPitch) {
    p.call = T.beanball;
    p.callColour = '#FF5050';
    p.callAt = 0.05;
    p.line = T.takesFirst;
    p.lineAt = 0.8;
    p.flight(0, 0.45, add(BatterSpot, [0.03, 0]), [-0.32, 0.22], wound(p.kind), 0, 8, 1);
    p.move(Catcher, [-0.26, 0.16], 0.3, 0.7);
    p.move(Catcher, Spots[Catcher], 1.0, 1.5);
    p.runFrom = 0.8;
    p.batterFrom = 0.8;
    p.perBase = 0.75;
    p.finish = 1.85;
  } else if (p.outcome === 4) {
    choreographHomeRun(p, dir);
  } else {
    choreographHit(p, dir);
  }

  if (p.walkOff || p.lastOfGame) {
    const settled = p.outcome === 0 ? (Number.isNaN(p.caught) ? 0.15 : p.caught) + 0.35 : lastArrival(p) + 0.25;
    p.mob = settled;
    p.finish = Math.max(p.finish, settled + 0.4);
    if (p.walkOff) {
      p.line = T.walkOff;
      p.lineAt = settled;
    }
  }
}

function choreographOut(p, dir) {
  p.callColour = '#FFFFFF';
  if (p.kind === Strikeout) {
    p.call = T.strikeout;
    p.callAt = 0.02;
    p.caught = 0;
    p.flight(0.32, 0.62, Mitt, add(Spots[Pitcher], [0, -0.04]), 14, 22, 10);
    p.batterFrom = 0.4;
    p.finish = 0.7;
  } else if (p.kind === Groundout) {
    const fielder = [Third, Shortstop, Pitcher, Second, First][dir];
    const spot = Spots[fielder];
    const meet = add(add(spot, norm(spot), -(fielder === Pitcher ? 0.06 : 0.12)), [fielder === Pitcher ? 0.04 : 0, 0]);
    const bag = add(BaseSpots[1], [0.01, 0.03]);
    p.flight(0, 0.36, Zone, meet, 15, 3, 0, 3);
    p.move(fielder, meet, 0.03, 0.36);
    if (fielder === First) {
      p.move(First, bag, 0.42, 0.66);
      p.caught = 0.66;
    } else {
      p.flight(0.44, 0.7, meet, bag, 16, 16, 6);
      p.move(First, bag, 0.08, 0.4);
      p.caught = 0.7;
      p.move(fielder, spot, 0.72, 1.0);
    }
    p.catching = First;
    p.move(First, Spots[First], 0.75, 1.0);
    p.call = T.out;
    p.callAt = p.caught;
    p.batterFrom = 0.12;
    p.perBase = 0.7;
    p.finish = 1.0;
  } else if (p.kind === Flyout) {
    const fielder = dir <= 1 ? Left : dir === 2 ? Centre : Right;
    const angle = [-30, -17, 0, 17, 30][dir];
    const landing = polar(angle, dir === 2 ? 3.0 : dir === 1 || dir === 3 ? 2.85 : 2.6);
    p.flight(0, 0.8, Zone, landing, 15, 10, 70);
    p.move(fielder, landing, 0.05, 0.74);
    p.catching = fielder;
    p.caught = 0.8;
    p.watch = 0.8;
    p.flight(0.88, 1.15, landing, BaseSpots[2], 12, 14, 18);
    p.move(Shortstop, add(BaseSpots[2], [-0.05, -0.03]), 0.75, 1.05);
    p.move(Shortstop, Spots[Shortstop], 1.15, 1.3);
    p.move(fielder, Spots[fielder], 0.9, 1.3);
    p.call = T.caught;
    p.callAt = 0.8;
    p.batterFrom = 0.12;
    p.perBase = 0.9;
    p.finish = 1.3;
  } else {
    const fielder = [Third, Shortstop, Catcher, Second, First][dir];
    const spot = Spots[fielder];
    const landing = fielder === Catcher ? [0.1, -0.14] : add(spot, norm(spot), -0.15);
    p.flight(0, 0.8, Zone, landing, 15, 12, 90);
    p.move(fielder, landing, 0.08, 0.65);
    p.move(fielder, spot, 0.85, 1.05);
    p.catching = fielder;
    p.caught = 0.8;
    p.watch = 0.8;
    p.call = T.out;
    p.callAt = 0.8;
    p.batterFrom = 0.12;
    p.perBase = 1;
    p.finish = 1.05;
  }
}

function choreographHit(p, dir) {
  const bases = p.outcome;
  let angle = [-36, -18, 0, 18, 36][dir];
  if (bases === 3 && dir === 2) angle = p.kind % 2 === 0 ? -22 : 22;
  const wall = fence(angle) - 0.14;
  let stop;
  let rolled;
  if (p.kind === 0) {
    // a grounder skips through the infield and rolls on
    const distance = Math.min(bases === 1 ? 2.2 : bases === 2 ? 3.6 : 3.9, wall);
    stop = polar(angle, distance);
    rolled = 0.5 + 0.08 * bases;
    p.flight(0, rolled, Zone, stop, 15, 0, 0, 4 + bases);
  } else {
    const pick = (a, b, c) => (bases === 1 ? a : bases === 2 ? b : c);
    let [land, arc, time] = p.kind === 1 ? [pick(2.0, 2.9, 3.2), 16, 0.4 + 0.05 * bases]
      : p.kind === 2 ? [pick(2.3, 3.3, 3.6), 50, 0.7 + 0.05 * bases]
        : [pick(1.75, 2.5, 3.0), 32, 0.6];
    land = Math.min(land, wall);
    const on = land + pick(0.3, 0.55, 0.7);
    // off the wall it comes back a little
    const distance = on > wall ? wall - 0.15 : on;
    const landing = polar(angle, land);
    stop = polar(angle + (on > wall ? 4 : 0), distance);
    p.flight(0, time, Zone, landing, 15, 0, arc);
    p.flight(time, time + 0.3, landing, stop, 0, 0, 7, 2);
    p.landed = time;
    p.watch = time;
    rolled = time + 0.3;
  }

  let chaser = Left;
  let best = Infinity;
  for (const fielder of [Left, Centre, Right]) {
    const d = dist(Spots[fielder], stop);
    if (d < best) {
      best = d;
      chaser = fielder;
    }
  }

  const pickUp = rolled + 0.05;
  p.move(chaser, stop, 0.08, pickUp);
  p.catching = chaser;
  p.batterFrom = 0.15;
  p.perBase = 0.5;
  const arrive = p.batterFrom + bases * p.perBase;
  const target = bases === 3 ? 3 : 2;
  const receiver = target === 3 ? Third : angle < 0 ? Second : Shortstop;
  const bag = add(BaseSpots[target], [target === 3 ? 0.03 : 0, -0.03]);
  p.move(receiver, bag, 0.2, 0.8);
  let thrown = pickUp + 0.12 + 0.4;
  if (bases >= 2) thrown = Math.max(thrown, arrive + 0.08);
  p.flight(pickUp + 0.12, thrown, stop, bag, 14, 15, 22);
  p.thrown = thrown;
  p.throwBase = target;
  p.safe = bases >= 2 && thrown - arrive < 0.4;
  if (bases >= 2) p.slide = arrive - 0.14;
  p.move(chaser, Spots[chaser], thrown, thrown + 0.45);
  p.move(receiver, Spots[receiver], thrown + 0.1, thrown + 0.5);

  if (!Number.isNaN(p.crash) || (p.runs > 0 && p.has(3))) {
    // the catcher stands up and sets himself on the plate for the throw that never comes
    p.move(Catcher, [0.03, 0.02], 0.25, 0.5);
    p.move(Catcher, Spots[Catcher], lastArrival(p) + 0.75, lastArrival(p) + 1.1);
  }

  p.crashBase = p.before >= 4 ? 3 : p.before >= 2 ? 2 : 1;
  p.call = bases === 1 ? T.single : bases === 2 ? T.double : T.triple;
  p.callColour = '#7CFF00';
  p.callAt = 0.22;
  if (p.runs > 0) {
    p.line = T.runs(p.runs);
    p.lineAt = lastArrival(p);
  }

  p.finish = Math.max(thrown + 0.5, arrive + 0.35, lastArrival(p) + 0.45);
  if (!Number.isNaN(p.crash)) p.finish = Math.max(p.finish, p.runFrom + (4 - p.crashBase) * p.perBase + 0.9);
}

function choreographHomeRun(p, dir) {
  const angle = [-30, -15, 0, 15, 30][dir];
  const carry = fence(angle) + 0.7 + 0.15 * p.kind;
  p.flight(0, 1.2, Zone, polar(angle, carry), 15, 3, 68 + 10 * p.kind);
  p.landed = 1.2;
  p.watch = 1.2;
  const chaser = angle < -8 ? Left : angle > 8 ? Right : Centre;
  p.move(chaser, polar(angle, fence(angle) - 0.07), 0.08, 0.98);
  p.move(chaser, Spots[chaser], 1.8, 2.6);
  p.catching = chaser;
  p.batterFrom = 0.3;
  p.runFrom = 0.2;
  p.perBase = 0.55;
  p.call = T.homer;
  p.callColour = GOLD;
  p.callAt = 0.3;
  p.line = p.runs > 1 ? T.runs(p.runs) : '';
  p.lineAt = 1.2;
  p.distance = T.feet(Math.trunc(carry * 90));
  p.finish = p.batterFrom + 4 * p.perBase + 0.3;
}

/** Works the plate appearances, their pitches and their choreography out of the events. */
function prepare(play) {
  const plates = [];
  const halves = [];
  const plateOf = [];
  if (!play) return { plates, halves, plateOf };
  let half = null;
  let last = null;
  let bases = 0;
  let home = 0;
  let away = 0;
  let fan = -1;
  play.events.forEach((e, i) => {
    plateOf[i] = -1;
    if (e.action === Action.Bell) {
      if (last) last.lastOfHalf = true;
      half = { start: e.time, side: e.side, inning: clamp(e.value, 1, Innings), first: plates.length, intro: 0 };
      halves.push(half);
      bases = 0;
    } else if (e.action === Action.AtBat && half) {
      const plate = new Plate({
        number: plates.length, half, side: e.side, outcome: e.value, runs: e.extra, before: bases, after: e.state & 7,
        outs: (e.state >> 4) & 3, kind: (e.state >> KindShift) & 3, direction: clamp((e.state >> DirectionShift) & 7, 0, 4),
        contact: e.time,
      });
      bases = plate.after;
      if (e.side === 0) home += e.extra;
      else away += e.extra;
      plate.home = home;
      plate.away = away;
      if (fan >= 0) {
        const hit = play.events[fan];
        plate.fouled = true;
        plate.fanTime = hit.time;
        const stand = FoulSeats[clamp(hit.extra, 0, 1)];
        plate.fanSeat = stand.length > 0 ? stand[hit.state % stand.length] : 0;
        plateOf[fan] = plate.number;
        fan = -1;
      }
      plates.push(plate);
      plateOf[i] = plate.number;
      last = plate;
    } else if (e.action === Action.Special && e.value === FanHit) {
      fan = i;
    } else if (last) {
      plateOf[i] = last.number;
      if (e.action === Action.Special && e.value === BrokenBat) {
        last.broken = true;
        last.shardVictim = e.extra;
      } else if (e.action === Action.Special && e.value === WalkOff) {
        last.walkOff = true;
      } else if (e.action === Action.Injury) {
        if (e.value === HurtBatter) last.severity = e.extra;
        else if (e.value === HurtPitcher || e.value === HurtThirdBase) last.shard = e.time;
        else if (e.value === HurtCatcher) last.crash = e.time;
      }
    }
  });
  if (last) {
    last.lastOfHalf = true;
    last.lastOfGame = true;
  }

  const length = sportLength(Sport.Baseball);
  plates.forEach((plate, n) => {
    const previous = n > 0 && plates[n - 1].half === plate.half ? plates[n - 1].contact : plate.half.start;
    if (plate.fouled) {
      // the fan hit sits five tenths into the step, the real pitch nine
      plate.foul = plate.fanTime - (plate.contact - plate.fanTime) * 1.25;
      const lead = leadFor(plate.foul - previous);
      plate.foulWindup = plate.foul - lead;
      plate.foulRelease = plate.foul - pitchTime(lead);
      const again = clamp(plate.contact - plate.fanTime - 0.05, 0.25, 0.55);
      plate.windup = plate.contact - again;
      plate.release = plate.contact - pitchTime(again);
      plate.start = plate.foulWindup;
    } else {
      const lead = leadFor(plate.contact - previous);
      plate.windup = plate.contact - lead;
      plate.release = plate.contact - pitchTime(lead);
      plate.start = plate.windup;
    }
    if (plate.number === plate.half.first) plate.half.intro = plate.start;
  });

  // the charge: the first time in a late home half that a runner reaches scoring position
  let charged = null;
  for (const plate of plates) {
    if (plate.side === 0 && plate.half.inning >= 4 && plate.half !== charged && (plate.after & 6) !== 0 && plate.outs < 3 && !plate.walkOff) {
      plate.charge = true;
      charged = plate.half;
    }
  }

  plates.forEach((plate, n) => {
    if (n + 1 < plates.length && plates[n + 1].half === plate.half) {
      plate.end = plates[n + 1].start;
    } else {
      const next = halves[halves.indexOf(plate.half) + 1];
      plate.end = next ? next.start : length;
    }
    choreograph(plate);
    plate.pace = clamp((Math.min(plate.end, length) - plate.contact) / plate.finish, 0.4, 1.25);
    if (!Number.isNaN(plate.crash)) {
      // the lead runner reaches the plate exactly when the match says he flattens the catcher
      const arrive = plate.runFrom + (4 - plate.crashBase) * plate.perBase;
      plate.pace = clamp((plate.crash - plate.contact) / arrive, 0.4, 2.5);
    }
  });
  return { plates, halves, plateOf };
}

// ---------------------------------------------------------------- the arena

const ratioNow = () => Math.max(1, Math.min(3, Math.round((typeof window !== 'undefined' && window.devicePixelRatio) || 1)));

export class BaseballArena extends Arena {
  build(match) {
    this.dolls = [[], []];
    this.used = new Array(2 * Roles).fill(false);
    this.feet = [];
    for (const role of DrawOrder) {
      for (let side = 0; side < 2; side++) this.dolls[side][role] = this.addDoll('Player', kitColour(match.sport, side, match.entrants[side]), 1);
    }

    this.homeColour = kitCss(match, 0);
    this.awayColour = kitCss(match, 1);
    this.teams = [shortName(matchName(match, 0)), shortName(matchName(match, 1))];
    this.abbreviations = this.teams.map(t => t.slice(0, 3));
    // most of the crowd wears the home colours, a corner of it the visitors'
    const neutral = ['#E8E8E8', '#3A4A6A', '#7A6A55', '#222428', '#8A3030', '#5A7A4A'];
    this.shirts = Array.from({ length: 10 }, (_, i) => (i < 3 ? this.homeColour : i === 3 ? this.awayColour : neutral[i - 4]));
    this.cards = [0, 1].map(side => Array.from({ length: Innings }, (_, i) => (side === 1 ? T.top : T.bottom)(T.ordinal(i + 1))));
    this.batting = [0, 1].map(side => T.atBat(this.teams[side]));
    this.bugs = [0, 1].map(side => Array.from({ length: Innings }, (_, i) => `${side === 1 ? '▲' : '▼'} ${T.ordinal(i + 1)}`));
    this.matchup = T.matchup(this.teams[1], this.teams[0]);

    this.hurtFans = new Set();
    // the crowd's faces and clothes are the match's own, the same for everyone watching it
    const looks = fanLooks(match.id);
    this.fanSkins = looks.map(look => FanSkins[look.skin]);
    this.seatLooks = Seats.map((_, seat) => hash((Math.imul(match.id, 7919) + seat) | 0) % Looks);
    this.fans = null;
    const homeSuit = SuitTints[Colours[kitColour(match.sport, 0, match.entrants[0])]];
    const awaySuit = SuitTints[Colours[kitColour(match.sport, 1, match.entrants[1])]];
    const dressing = direction => Promise.all(looks.map(look => fanCanvas(fanLayers(look, homeSuit, awaySuit), direction)));
    Promise.all([dressing(Dir.East), dressing(Dir.West)]).then(([east, west]) => {
      // the stands are drawn again once the fans are dressed
      if (this.match !== match) return;
      this.fans = { [Dir.East]: east, [Dir.West]: west };
      this.layers = null;
    });
    this.excite = 0;
    this.cheerUntil = 0;
    this.smallUntil = 0;
    this.clockTime = performance.now() / 1000;
    this.lastT = NaN;
    this.lastClock = 0;
    this.layers = null;
    this.hasPlay = match.winner >= 0;
    // the same match the base plays, so events can be placed on the field as they come
    Object.assign(this, prepare(this.play));
    this.preload(ALL_SOUNDS);
    this.sprite(BatRsi, 'icon');
  }

  // ---------------------------------------------------------------- events

  onEvent(match, e, index, live) {
    const plate = index >= 0 && index < this.plateOf.length && this.plateOf[index] >= 0 ? this.plates[this.plateOf[index]] : null;
    if (e.action === Action.Bell) {
      this.sound(ChimeSound, -6);
      return;
    }
    if (!plate) return;
    if (e.action === Action.AtBat) {
      this.contactMoment(plate);
    } else if (e.action === Action.Injury) {
      this.hurt(match, plate, e);
    } else if (e.action === Action.Special) {
      if (e.value === BrokenBat) {
        this.sound(BrokenBatSound, 2);
        const at = air(Zone, 15);
        this.burst(at[0], at[1], 16, Wood, 130, { life: 0.6, size: 2.2, direction: -Math.PI / 2, spread: 2.6, gravity: 380, floor: project(BatterSpot)[1] + 6 });
        this.burst(at[0], at[1], 8, '#E8D2A8', 160, { life: 0.25, size: 1, streak: true });
        this.pop(T.brokenBat, at[0] - T.brokenBat.length * 3.1, at[1] - 22, '#FFB050', false, 1.1, 14);
      } else if (e.value === FanHit) {
        this.fanHit(plate);
      } else if (e.value === WalkOff) {
        this.sound(HornSound, 2);
        this.soundAny(WhistleSounds, -2);
        this.bigCheer();
        this.excite = 1;
      }
    }
  }

  /** Bat on ball, or ball on batter. */
  contactMoment(plate) {
    if (plate.outcome === HitByPitch) {
      const body = air(add(BatterSpot, [0.03, 0]), wound(plate.kind));
      this.soundAny(BeanSounds, 3);
      this.soundAny(MeatSounds, -2);
      this.shake(3.5, 0.3);
      this.flash('rgba(255,255,255,0.3)', 0.12);
      this.burst(body[0], body[1], 10, '#FFFFFF', 80, { life: 0.2, size: 1.2, streak: true });
      return;
    }
    if (plate.outcome === 0 && plate.kind === Strikeout) {
      this.soundAny(MittSounds, 0);
      this.sound(SwooshSounds[0], -2, 0.8);
      return;
    }
    const homer = plate.outcome === 4;
    const at = air(Zone, 15);
    if (!plate.broken) this.crack(homer ? 3 : plate.outcome > 0 ? 1 : -1, homer ? 0.94 : 1);
    else this.sound(KnockSound, -3);
    this.burst(at[0], at[1], homer ? 14 : 7, '#FFFFFF', homer ? 140 : 90, { life: 0.22, size: 1.3, streak: true });
    if (homer) {
      this.shake(2.5, 0.3);
      this.flash('rgba(255,255,255,0.28)', 0.15);
      this.excite = Math.max(this.excite, 0.6);
    } else if (plate.outcome > 0) {
      this.excite = Math.max(this.excite, 0.45);
    }
  }

  /** Someone bleeds. The pool lands whether or not anyone watched; the spray and the scream only live. */
  hurt(match, plate, e) {
    const amount = clamp(e.extra, 1, 3);
    let foot;
    let woundAt;
    let away = -Math.PI / 2;
    if (e.value === HurtBatter) {
      foot = BatterSpot;
      woundAt = air(foot, wound(plate.kind));
      away = -Math.PI * 0.8;
      this.soundAny(MeatSounds, 0);
      this.pop('!', woundAt[0], woundAt[1] - 8, '#FF5050', true, 0.5, 10);
    } else if (e.value === HurtPitcher || e.value === HurtThirdBase) {
      const role = e.value === HurtPitcher ? Pitcher : Third;
      foot = this.fielderBody(plate, 1 - plate.side, role, e.time).ground;
      woundAt = air(foot, 23);
      away = -Math.PI * 0.35;
      this.sound(PierceSound, 2);
      this.soundAny(MeatSounds, 0);
      this.shake(2, 0.25);
    } else if (e.value === HurtCatcher) {
      foot = [0.03, -0.03];
      woundAt = air(foot, 16);
      away = Math.PI * 1.15;
      this.sound(CrashSound, 4);
      this.soundAny(BeanSounds, 2);
      this.sound(SmackSound, 0);
      this.shake(5.5, 0.45);
      this.flash('rgba(255,255,255,0.35)', 0.15);
      this.pop(T.collision, HomeX, 150, '#FF5050', true, 1.4, 16);
    } else {
      foot = [-0.04, 0.02];
      woundAt = air(foot, 12);
      away = -Math.PI * 0.15;
    }

    const floor = project(foot);
    const n = near(floor[1]);
    this.splat(floor[0], floor[1] + 1, (8 + amount * 4) * n);
    for (let i = 0; i < amount; i++) {
      this.splat(floor[0] + (this.fxFloat() - 0.5) * 18 * n, floor[1] + (this.fxFloat() - 0.3) * 6 * n, (3 + this.fxFloat() * 3) * n, DARK_BLOOD);
    }
    if (e.value === HurtBatter) {
      // he walks it off to first, dripping
      for (let i = 1; i <= 4; i++) {
        const drop = project(lerp(BatterSpot, BaseSpots[1], i / 5));
        this.splat(drop[0], drop[1] + 1, (2.5 + this.fxFloat() * 2) * n);
      }
    }
    this.gush(woundAt, floor[1] + 2, amount, away);
    this.sound(FallSound, 2);
    this.scream(false, amount >= 3 ? 3 : 0);
  }

  /** A spray of blood from a wound: a few heavy drops that stain where they land, and a mist that does not. */
  gush(at, floor, amount, direction) {
    this.burst(at[0], at[1], 4 + amount * 3, BLOOD, 60 + amount * 40, { life: 1.3, size: 1.8 + amount * 0.4, direction, spread: 1.7, gravity: 420, floor, stains: true });
    this.burst(at[0], at[1], 6 + amount * 6, BLOOD, 50 + amount * 35, { life: 0.5, size: 1.3, direction, spread: 2.2, gravity: 200, drag: 2.5 });
    this.burst(at[0], at[1], 2 + amount, DARK_BLOOD, 30 + amount * 20, { life: 0.9, size: 2.4 + amount * 0.5, direction, spread: 1.0, gravity: 420, floor, stains: true });
  }

  fanHit(plate) {
    if (Seats.length === 0) return;
    const index = clamp(plate.fanSeat, 0, Seats.length - 1);
    const seat = Seats[index];
    this.hurtFans.add(index);
    const at = [seat.at[0], seat.at[1] - seat.size];
    this.splat(seat.at[0], seat.at[1] + 2, 9 * near(seat.at[1]) + 4);
    this.splat(seat.at[0] + (this.fxFloat() - 0.5) * 10, seat.at[1] + 4, 4, DARK_BLOOD);
    this.gush(at, seat.at[1] + 4, 2, -Math.PI / 2);
    this.sound(SmackSound, 2);
    this.soundAny(BeanSounds, 0);
    this.scream(this.fxFloat() < 0.4, 0);
    this.shake(1.2, 0.2);
    this.pop(T.fanDown, at[0] - T.fanDown.length * 3.1, at[1] - 14, '#FF5050', false, 1.3, 14);
  }

  // ---------------------------------------------------------------- every frame

  updateMatch(match, play, t) {
    this.clockTime = performance.now() / 1000;
    const delta = clamp(this.clockTime - this.lastClock, 0, 0.1);
    this.lastClock = this.clockTime;
    this.excite = Math.max(0, this.excite - delta * 0.28);
    const step = Number.isNaN(this.lastT) ? -1 : t - this.lastT;
    this.cueing = step > 0 && step < 0.3;
    this.t = t;
    this.used.fill(false);
    this.ballOn = false;
    this.batOn = false;
    this.shardOn = false;
    this.radar = '';

    this.half = null;
    for (let i = this.halves.length - 1; i >= 0; i--) {
      if (this.halves[i].start <= t) {
        this.half = this.halves[i];
        break;
      }
    }
    this.plate = null;
    if (this.half) {
      for (let n = this.half.first; n < this.plates.length && this.plates[n].half === this.half && this.plates[n].start <= t; n++) this.plate = this.plates[n];
    }

    const batting = this.half ? this.half.side : 1;
    const fielding = 1 - batting;
    const plate = this.plate;
    this.bases = !plate ? 0 : t >= plate.contact + 0.4 * plate.pace ? plate.after : plate.before;
    this.outs = !plate ? 0 : t >= plate.contact ? plate.outs : plate.outs - (plate.outcome === 0 ? 1 : 0);

    for (let role = 0; role <= Right; role++) this.stand(fielding, role, this.fielderBody(plate, fielding, role, t));
    this.poseBatters(batting, t);
    this.poseBall(t);
    this.poseBat(t);
    this.poseShard(t);
    if (this.cueing) this.cues(t);
    this.scoreboard(t);
    this.calls(t);

    for (let side = 0; side < 2; side++) {
      for (let role = 0; role < Roles; role++) {
        const doll = this.dolls[side][role];
        if (!this.used[doll]) this.hide(doll);
      }
    }
    this.lastT = t;
  }

  /** Poses a doll standing on a spot of the field, scaled for how far away it is. */
  stand(side, role, body) {
    if (body.alpha <= 0.01) return;
    const doll = this.dolls[side][role];
    const at = project(body.ground);
    const scale = Math.round(1.05 * Math.pow(Math.max(near(at[1]), 0.2), 0.7) * 20) / 20;
    const state = this.doll(doll);
    state.scale = scale;
    state.alpha = clamp(body.alpha, 0, 1);
    const squash = body.squash <= 0 ? 1 : body.squash;
    state.squash = squash;
    // the feet stay on the ground: a standing doll's feet sit 14 px under its middle, a lying one's 4
    const drop = (14 * squash * (1 - body.lie) + 4 * body.lie) * scale;
    this.pose(doll, at[0], at[1] - drop - body.lift * scale, body.facing, body.rotation + body.lie * 90);
    this.used[doll] = true;
    this.feet[doll] = at;
  }

  /** The bounce of a running stride. */
  stride(phase = 0) {
    return Math.abs(Math.sin(this.clockTime * 17 + phase)) * 1.6;
  }

  /**
   * How far a side has come out of its dugout at the start of a half, 0 to 1. The first side takes the field
   * before the first bell, while the crowd settles.
   */
  arrival(half, t) {
    if (!this.hasPlay) return 1;
    if (!half || (this.halves.length > 0 && half === this.halves[0])) return smooth((t - 0.2) / 2.2);
    return smooth((t - half.start) / clamp((half.intro - half.start) * 0.85, 0.3, 1.1));
  }

  /** Jogs a player off to his dugout, fading as he goes in. */
  leave(body, side, k, phase) {
    if (k <= 0) return;
    const from = body.ground;
    body.ground = lerp(from, Dugouts[side], k);
    body.facing = facing(from, Dugouts[side]);
    body.lift = k < 1 ? this.stride(phase) : 0;
    body.squash = 1;
    body.lie = 0;
    body.rotation = 0;
    body.alpha = Math.min(body.alpha, k < 0.7 ? 1 : (1 - k) / 0.3);
  }

  fielderBody(plate, side, role, t) {
    const spot = Spots[role];
    const body = standing(spot, role === Catcher ? Dir.North : Dir.South);
    const half = plate ? plate.half : this.half;

    // a new half: the side takes the field from its dugout
    if (!plate) {
      const jog = this.arrival(half, t);
      if (jog < 1) {
        body.ground = lerp(Dugouts[side], spot, jog);
        body.facing = facing(Dugouts[side], spot);
        body.lift = this.stride(role);
        return body;
      }
      if (role === Catcher) body.squash = 0.74;
      return body;
    }

    if (role === Catcher) body.squash = 0.74;
    else if (t >= plate.release - 0.3 && t < plate.contact + 0.15) body.squash = 0.93;
    if (role === Pitcher) delivery(plate, t, body);
    if (t >= plate.contact) this.aftermath(plate, role, t, body);

    if (plate.lastOfGame && !Number.isNaN(plate.mob)) {
      const mob = plate.real(plate.mob);
      if (!plate.walkOff) {
        // the side in the field won: everyone piles onto the mound
        const k = smooth((t - mob) / 0.8);
        if (k > 0) {
          const slot = add(Spots[Pitcher], polar(role * 40, role === Pitcher ? 0 : 0.14));
          body.ground = lerp(body.ground, slot, k);
          body.facing = k < 1 ? facing(spot, slot) : role % 2 === 0 ? Dir.South : Dir.East;
          body.lift = k < 1 ? this.stride(role) : Math.abs(Math.sin(this.clockTime * 7 + role)) * 6;
          body.squash = 1;
          body.lie = 0;
          body.rotation = 0;
        }
      } else {
        this.leave(body, side, smooth((t - mob - 0.3) / 1.6), role);
      }
    } else if (plate.lastOfHalf) {
      this.leave(body, side, smooth((t - plate.real(plate.finish) - 0.1) / 1.1), role);
    }
    return body;
  }

  /** What a fielder does once the ball is in play. */
  aftermath(plate, role, t, body) {
    const tau = (t - plate.contact) / plate.pace;
    let ground = body.ground;
    let moving = false;
    for (const move of plate.moves) {
      if (move.role !== role || tau <= move.from) continue;
      const k = smooth((tau - move.from) / Math.max(0.01, move.by - move.from));
      if (k < 1) {
        body.facing = facing(ground, move.to);
        moving = true;
      }
      ground = lerp(ground, move.to, k);
    }
    body.ground = ground;
    if (moving) {
      body.lift = this.stride(role);
      body.squash = 1;
    } else if (!Number.isNaN(plate.watch) && tau < plate.watch && role !== Catcher) {
      // everyone turns to watch a ball in the air
      body.facing = Dir.North;
      body.squash = 1;
    }

    // the catcher comes out of his crouch once the ball is in play, or to throw it back after a strikeout
    if (role === Catcher) {
      const strikeout = plate.outcome === 0 && plate.kind === Strikeout;
      body.squash = Math.max(body.squash, 0.74 + 0.26 * smooth(strikeout ? (tau - 0.3) / 0.2 : tau / 0.25));
    }
    if (role === plate.catching && !Number.isNaN(plate.caught) && Math.abs(tau - plate.caught) < 0.12) body.lift = Math.max(body.lift, 2.5);

    // the outfielder leaps at the wall for a ball he will never reach
    if (plate.outcome === 4 && role === plate.catching && tau > 0.98 && tau < 1.3) {
      body.lift = 7 * Math.sin(Math.PI * (tau - 0.98) / 0.32);
      body.facing = Dir.North;
    }

    // a shard of the bat drops the pitcher or the third baseman for a moment
    if (plate.broken && !Number.isNaN(plate.shard) && t >= plate.shard && role === (plate.shardVictim === HurtPitcher ? Pitcher : Third)) {
      const down = t - plate.shard;
      body.lie = down < 0.12 ? down / 0.12 : 1 - smooth((down - 0.9) / 0.35);
      body.rotation = -8 * body.lie;
      body.lift = 0;
    }

    // flattened at the plate by the runner
    if (role === Catcher && !Number.isNaN(plate.crash) && t >= plate.crash) {
      const down = t - plate.crash;
      body.ground = add(body.ground, [0.03, -0.08], smooth(down / 0.15));
      body.lie = down < 0.1 ? down / 0.1 : 1 - smooth((down - 0.75) / 0.3);
      body.rotation = -180 * body.lie;
      body.facing = Dir.North;
      body.squash = 1;
      body.lift = 0;
    }
  }

  poseBatters(side, t) {
    const plate = this.plate;
    const half = this.half;
    const deckFacing = side === 0 ? Dir.West : Dir.East;
    if (!plate) {
      // a new half: the leadoff hitter walks up from the dugout
      const walk = this.arrival(half, t);
      const body = standing(lerp(Dugouts[side], BatterSpot, walk), walk < 1 ? facing(Dugouts[side], BatterSpot) : Dir.East);
      if (walk < 1) body.lift = this.stride();
      body.squash = walk >= 1 ? 0.95 : 1;
      this.stand(side, Batter, body);
      this.stand(side, OnDeck, standing(Circles[side], deckFacing));
      return;
    }

    if (t < plate.contact) {
      const body = standing(BatterSpot, Dir.East);
      body.squash = 0.95;
      if (plate.outcome === HitByPitch && t > plate.contact - 0.07) {
        body.facing = Dir.South;
        body.rotation = -12;
      }
      this.stand(side, Batter, body);
      // runners take a lead as the pitcher comes set
      const lead = 0.03 + 0.06 * smooth((t - plate.windup) / Math.max(0.1, plate.release - plate.windup));
      for (let k = 1; k <= 3; k++) if (plate.has(k)) this.stand(side, Batter + k, standing(path(k + lead), Dir.South));
      this.stand(side, OnDeck, standing(Circles[side], deckFacing));
      return;
    }

    const tau = (t - plate.contact) / plate.pace;
    const done = plate.real(plate.finish);
    for (let k = 0; k <= 3; k++) {
      if (!plate.has(k)) continue;
      const body = this.runner(plate, side, k, t, tau);
      if (plate.lastOfHalf && !plate.walkOff) this.leave(body, side, smooth((t - done - 0.1) / 1.1), k);
      if (plate.walkOff) this.celebrate(plate, body, k, t);
      this.stand(side, Batter + k, body);
    }

    // the next hitter walks up to the plate as the play winds down
    const deck = standing(Circles[side], deckFacing);
    if (!plate.lastOfHalf) {
      const walk = smooth((t - (plate.end - 0.55)) / 0.5);
      if (walk > 0) {
        deck.ground = lerp(Circles[side], BatterSpot, walk);
        deck.facing = walk < 1 ? facing(Circles[side], BatterSpot) : Dir.East;
      }
    } else if (plate.walkOff) {
      this.celebrate(plate, deck, 4, t);
    } else {
      this.leave(deck, side, smooth((t - done) / 1.0), 4);
    }
    this.stand(side, OnDeck, deck);
  }

  /** The batting side mobs the plate after a walk-off. */
  celebrate(plate, body, index, t) {
    const k = smooth((t - plate.real(plate.mob)) / 0.7);
    if (k <= 0) return;
    const slot = add([0, 0.08], polar(index * 72 + 20, 0.13));
    body.ground = lerp(body.ground, slot, k);
    body.alpha = 1;
    body.lie = 0;
    body.rotation = 0;
    body.squash = 1;
    body.facing = index % 2 === 0 ? Dir.South : Dir.West;
    body.lift = k < 1 ? this.stride(index) : Math.abs(Math.sin(this.clockTime * 7.5 + index * 1.3)) * 6;
  }

  /** Where the runner who started on k (0 the batter) is during the play. */
  runner(plate, side, k, t, tau) {
    const body = standing(k === 0 ? BatterSpot : path(k + 0.09), k === 0 ? Dir.East : Dir.South);
    const dugout = Dugouts[side];
    if (plate.outcome === 0) {
      if (k > 0) {
        // runners hold, drifting back to the bag
        body.ground = path(k + 0.09 * (1 - smooth(tau / 0.5)));
        return body;
      }
      if (plate.kind === Strikeout) {
        const w = smooth((tau - plate.batterFrom) / 1.1);
        body.ground = lerp(BatterSpot, dugout, w);
        if (w > 0) {
          body.facing = facing(BatterSpot, dugout);
          body.lift = w < 1 ? this.stride() * 0.5 : 0;
        }
        body.alpha = w < 0.6 ? 1 : (1 - w) / 0.4;
        return body;
      }
      const outAt = Number.isNaN(plate.caught) ? 0.6 : plate.caught;
      const run = Math.min(tau, outAt + 0.1);
      const u = clamp((run - plate.batterFrom) / plate.perBase, 0, 1.05);
      body.ground = lerp(BatterSpot, path(u), smooth(u * 4));
      body.facing = Dir.East;
      body.lift = tau > plate.batterFrom && tau < outAt + 0.1 ? this.stride() : 0;
      const off = smooth((tau - outAt - 0.15) / 1.1);
      if (off > 0) {
        const from = body.ground;
        body.ground = lerp(from, dugout, off);
        body.facing = facing(from, dugout);
        body.lift = off < 1 ? this.stride() * 0.6 : 0;
        body.alpha = off < 0.6 ? 1 : (1 - off) / 0.4;
      }
      return body;
    }

    const bases = basesRun(plate, k);
    const start = k === 0 ? plate.batterFrom : plate.runFrom;
    const progress = bases === 0 ? 0 : clamp((tau - start) / plate.perBase, 0, bases);
    const at = k + progress;
    const arrive = start + bases * plate.perBase;

    if (k === 0 && plate.outcome === HitByPitch) {
      // down in the box, up again, then the long walk to first holding his head
      const fall = clamp(tau / 0.15, 0, 1) * (1 - smooth((tau - 0.58) / 0.2));
      body.ground = lerp(BatterSpot, path(at), smooth(at * 3));
      body.lie = fall;
      body.rotation = -10 * fall;
      body.facing = fall > 0.5 ? Dir.South : Dir.East;
      if (fall < 0.5 && progress > 0 && progress < bases) body.lift = this.stride() * 0.4;
      return body;
    }

    body.ground = k === 0 ? lerp(BatterSpot, path(at), smooth(at * 4)) : path(at < k + 0.09 && progress <= 0 ? k + 0.09 : at);
    const leg = Math.min(Math.trunc(at), 3);
    if (progress > 0 && progress < bases) {
      body.facing = PathFacing[leg];
      body.lift = this.stride(k);
    }

    // feet first into the bag; lying turns the head left, so a slide towards second or third turns right round
    if (k === 0 && !Number.isNaN(plate.slide) && tau > plate.slide && tau < arrive + 0.3) {
      body.lie = 0.85 * (1 - smooth((tau - arrive - 0.05) / 0.25));
      body.lift = 0;
      const into = Math.trunc(at - 0.01);
      body.rotation = into === 1 || into === 2 ? 180 : 0;
    }

    // the lead runner dives into the catcher
    if (!Number.isNaN(plate.crash) && k === plate.crashBase) {
      const crash = plate.crash;
      if (t > crash - 0.12 * plate.pace) {
        const down = t - crash;
        body.lie = down < 0 ? 1 + down / (0.12 * plate.pace) : 1 - smooth((down - 0.8) / 0.3);
        // head first, towards the plate on his right
        body.rotation = -180 * body.lie;
        body.facing = Dir.South;
        body.lift = 0;
        body.ground = [-0.04, 0.02];
        if (down > 1.1) {
          const w = smooth((down - 1.1) / 1.0);
          body.ground = lerp(body.ground, dugout, w);
          body.facing = facing(BaseSpots[0], dugout);
          body.lift = w < 1 ? this.stride() * 0.5 : 0;
          body.alpha = w < 0.6 ? 1 : (1 - w) / 0.4;
        }
      }
      return body;
    }

    // a run in: he trots off to the dugout to the high fives
    if (k + bases >= 4 && tau > arrive && !plate.walkOff) {
      const w = smooth((tau - arrive - 0.1) / 0.9);
      body.ground = lerp(BaseSpots[0], dugout, w);
      body.facing = facing(BaseSpots[0], dugout);
      body.lift = w < 1 ? this.stride(k) * 0.6 : 0;
      body.alpha = w < 0.6 ? 1 : (1 - w) / 0.4;
    } else if (progress >= bases && bases > 0) {
      body.facing = Dir.South;
    }
    return body;
  }

  // ---------------------------------------------------------------- the ball and the bat

  poseBall(t) {
    const ball = this.ballAt(this.plate, t);
    if (!ball) return;
    this.ballOn = true;
    this.ballShadow = project(ball.ground);
    const n = near(this.ballShadow[1]);
    this.ballHeight = ball.height;
    this.ballAt2 = [this.ballShadow[0], this.ballShadow[1] - ball.height * n];
    this.ballSize = 1.3 + 1.1 * n + Math.min(ball.height, 120) * 0.006;
    this.trail = [];
    for (let k = 1; k <= 6; k++) {
      const old = this.ballAt(this.plate, t - k * 0.018);
      if (!old) break;
      const shadow = project(old.ground);
      this.trail.push([shadow[0], shadow[1] - old.height * near(shadow[1]), this.ballSize * (1 - k * 0.12)]);
    }
  }

  ballAt(plate, t) {
    if (!plate || t < plate.start) return null;
    if (plate.fouled && t < plate.windup) {
      if (t < plate.foul) return pitched(plate.foulRelease, plate.foul, Zone, 15, t);
      if (t >= plate.fanTime) return null;
      // fouled back over the dugout into the seats
      const k = (t - plate.foul) / Math.max(0.05, plate.fanTime - plate.foul);
      const seat = Seats[clamp(plate.fanSeat, 0, Seats.length - 1)];
      return { ground: lerp(Zone, unproject(seat.at), k), height: 15 * (1 - k) + seat.size * 2 * k + 60 * 4 * k * (1 - k) };
    }
    if (t < plate.contact) {
      if (plate.outcome === HitByPitch) return pitched(plate.release, plate.contact, add(BatterSpot, [0.03, 0]), wound(plate.kind), t);
      if (plate.outcome === 0 && plate.kind === Strikeout) return pitched(plate.release, plate.contact, Mitt, 11, t);
      return pitched(plate.release, plate.contact, Zone, 15, t);
    }
    const tau = (t - plate.contact) / plate.pace;
    for (const flight of plate.ball) {
      if (tau < flight.from || tau >= flight.to) continue;
      const k = (tau - flight.from) / Math.max(0.01, flight.to - flight.from);
      let height = flight.heightA + (flight.heightB - flight.heightA) * k + flight.arc * 4 * k * (1 - k);
      if (flight.hops > 0) height += Math.abs(Math.sin(Math.PI * k * flight.hops)) * 7 * (1 - k);
      return { ground: lerp(flight.a, flight.b, k), height };
    }
    return null;
  }

  /** The bat: waggling in the stance, swinging through the zone, dropped or flipped after contact. */
  poseBat(t) {
    const plate = this.plate;
    const batter = this.dolls[this.half ? this.half.side : 1][Batter];
    if (!this.used[batter]) return;
    const foot = this.feet[batter];
    const n = near(foot[1]);
    const hands = [foot[0] + 5 * n, foot[1] - 16 * n];
    this.batSize = 22 * n;
    this.batAt = hands;
    this.batAngle = -118 + 5 * Math.sin(this.clockTime * 3.1);
    this.batOn = true;
    this.batHeld = true;
    if (!plate || t < plate.start) return;

    const strikeout = plate.outcome === 0 && plate.kind === Strikeout;
    if (t >= plate.contact && !strikeout) {
      // after contact the bat is dropped, flipped or in pieces
      const tau = (t - plate.contact) / plate.pace;
      const lying = project(add(BatterSpot, [0.07, -0.03]));
      if (plate.broken) {
        this.batOn = false;
      } else if (plate.outcome === 4 && tau < 0.55) {
        const k = clamp((tau - 0.1) / 0.45, 0, 1);
        const at = lerp(hands, lying, k);
        this.batAt = [at[0], at[1] - 20 * n * 4 * k * (1 - k)];
        this.batAngle = -510 + 720 * k;
      } else if (tau > plate.batterFrom * 0.6 || plate.outcome === HitByPitch) {
        this.batAt = lying;
        this.batAngle = 8;
      } else {
        this.batAngle = -510;
      }
      return;
    }
    if (strikeout && t >= plate.contact && (t - plate.contact) / plate.pace > plate.batterFrom) {
      // he takes it back to the dugout with him
      this.batOn = false;
      return;
    }
    const foul = plate.fouled && t < plate.windup;
    const pitch = foul ? plate.foul : plate.contact;
    if ((foul || plate.outcome !== HitByPitch) && t > pitch - 0.14) this.batAngle = swing(t - pitch);
    else if (t > pitch - 0.5) this.batAngle = -128;
  }

  /** The bat shard spinning out to whoever it hits. */
  poseShard(t) {
    const plate = this.plate;
    if (!plate || !plate.broken || Number.isNaN(plate.shard) || t <= plate.contact || t >= plate.shard) return;
    const k = (t - plate.contact) / (plate.shard - plate.contact);
    const victim = plate.shardVictim === HurtPitcher ? Pitcher : Third;
    const to = air(this.fielderBody(plate, 1 - plate.side, victim, plate.shard).ground, 23);
    const from = air(Zone, 15);
    const at = lerp(from, to, k);
    this.shardOn = true;
    this.shardAt = [at[0], at[1] - 14 * 4 * k * (1 - k)];
    this.shardAngle = k * 1500;
    this.shardSize = 16 * near(this.shardAt[1]);
  }

  // ---------------------------------------------------------------- moments

  /** Plays the moments of the current play that fall in this frame: throws, catches, slides, runs, fireworks. */
  cues(t) {
    const plate = this.plate;
    if (this.hasPlay && this.crossed(0.4)) this.soundAny(ClapSounds, -6);
    if (!plate) return;

    if ((plate.fouled && this.crossed(plate.foulRelease)) || this.crossed(plate.release)) this.soundAny(SwooshSounds, -6);
    if ((plate.fouled && this.crossed(plate.foul - 0.1)) || (plate.outcome !== HitByPitch && this.crossed(plate.contact - 0.1))) {
      this.soundAny(SwooshSounds, -9, 0.15);
    }
    // throws back to the infield, to first, to the bag
    for (let i = 1; i < plate.ball.length; i++) {
      const flight = plate.ball[i];
      if (flight.heightA > 5 && this.crossed(plate.real(flight.from))) this.soundAny(SwooshSounds, -9);
    }
    if (plate.fouled && this.crossed(plate.foul)) {
      this.crack(-3, 1.05);
      const at = air(Zone, 15);
      this.burst(at[0], at[1], 6, '#FFFFFF', 80, { life: 0.2, size: 1.2, streak: true });
    }
    if (!Number.isNaN(plate.landed) && this.crossed(plate.real(plate.landed))) {
      if (plate.outcome === 4) this.homeRunLands(plate);
      else this.landing(plate);
    }
    if (!Number.isNaN(plate.caught) && plate.caught > 0 && this.crossed(plate.real(plate.caught))) {
      this.soundAny(MittSounds, -3);
      if (plate.lastOfGame || plate.outs === 3) this.soundAny(ClapSounds, -5);
    }
    if (!Number.isNaN(plate.thrown) && this.crossed(plate.real(plate.thrown))) {
      this.soundAny(MittSounds, -5);
      if (plate.safe) {
        const at = air(BaseSpots[plate.throwBase], 34);
        this.pop(T.safe, at[0] - T.safe.length * 3.1, at[1], '#7CFF00', false, 1.0, 12);
      }
    }
    if (!Number.isNaN(plate.slide) && this.crossed(plate.real(plate.slide + 0.1))) {
      this.soundAny(SlideSounds, 2);
      this.sound(SwooshSounds[2], -6, 0.7);
      const bag = project(BaseSpots[Math.min(plate.outcome, 3)]);
      this.burst(bag[0], bag[1], 22, '#C9A27A', 55, { life: 0.8, size: 2.6, direction: -Math.PI / 2, spread: 2.8, gravity: 40, drag: 2.5 });
    }

    // runs crossing the plate
    for (let k = 0; k <= 3; k++) {
      if (!plate.has(k) || k + basesRun(plate, k) < 4) continue;
      const from = k === 0 ? plate.batterFrom : plate.runFrom;
      if (this.crossed(plate.real(from + (4 - k) * plate.perBase))) {
        this.smallCheer();
        this.excite = Math.max(this.excite, 0.6);
        if (k === 0 || plate.outcome !== 4) this.soundAny(WhistleSounds, -8);
      }
    }

    // late in the game, with the home side threatening, the organ calls the charge
    if (plate.charge && this.crossed(Math.min(plate.real(plate.finish), plate.end - 0.2)) && this.clockTime >= this.cheerUntil) {
      this.sound(ChargeSound, -2);
    }

    // a beaned batter drips all the way to first
    if (plate.outcome === HitByPitch) {
      for (let i = 0; i < 6; i++) {
        if (!this.crossed(plate.real(0.85 + i * 0.13))) continue;
        const foot = this.feet[this.dolls[plate.side][Batter]];
        if (!foot) continue;
        const n = near(foot[1]);
        this.burst(foot[0], foot[1] - 26 * n, 2, BLOOD, 20, { life: 1, size: 2, direction: Math.PI / 2, spread: 1, gravity: 300, floor: foot[1] + 1, stains: true });
      }
    }

    if (!Number.isNaN(plate.mob)) {
      const mob = plate.real(plate.mob);
      if (this.crossed(mob)) {
        this.soundAny(ClapSounds, -1);
        this.soundAny(WhistleSounds, -3);
        this.excite = 1;
        if (!plate.walkOff) {
          this.sound(HornSound, -2);
          this.smallCheer();
        }
      }
      for (let i = 0; i < 6; i++) if (this.crossed(mob + 0.2 + i * 0.45)) this.firework(i);
    }
  }

  crack(volume, pitch) {
    this.sound(HitSound, volume, pitch * (0.97 + this.fxFloat() * 0.06));
  }

  /** A big cheer, unless one is still going: they are long, and stacked they only get louder. */
  bigCheer() {
    if (!this.live || this.clockTime < this.cheerUntil) return;
    this.soundAny(CheerSounds, -2, 0.03);
    this.cheerUntil = this.clockTime + 14;
  }

  /** A short cheer for a run, kept under a big one and not stacked on itself. */
  smallCheer() {
    if (!this.live || this.clockTime < this.cheerUntil || this.clockTime < this.smallUntil) return;
    this.sound(SmallCheerSound, -3);
    this.smallUntil = this.clockTime + 3;
  }

  crossed(time) {
    return this.lastT < time && time <= this.t;
  }

  landing(plate) {
    this.sound(BounceSound, -4);
    const at = project(plate.ball[0].b);
    this.burst(at[0], at[1], 6, '#6FAF5A', 30, { life: 0.4, size: 1.6, direction: -Math.PI / 2, spread: 2, gravity: 120 });
  }

  /** Gone: into the seats, the crowd up, the horn, and fireworks over the stands. */
  homeRunLands(plate) {
    this.excite = 1;
    this.sound(HornSound, 0);
    this.bigCheer();
    this.soundAny(WhistleSounds, -3);
    const at = project(plate.ball[0].b);
    this.burst(at[0], at[1], 12, '#FFFFFF', 50, { life: 0.5, size: 1.4, direction: -Math.PI / 2, spread: 2.4, gravity: 160 });
    for (let i = 0; i < 3; i++) this.firework(i + plate.number);
  }

  firework(i) {
    const x = 40 + this.fxFloat() * (ArenaWidth - 80);
    const y = Bar + 8 + this.fxFloat() * 22;
    const colour = FireworkColours[i % FireworkColours.length];
    this.burst(x, y + 30, 3, '#FFE6A0', 120, { life: 0.25, size: 1, direction: -Math.PI / 2, spread: 0.15, streak: true });
    this.burst(x, y, 34, colour, 95, { life: 1.1, size: 1.7, gravity: 45, streak: true, drag: 1.4 });
    this.burst(x, y, 12, '#FFFFFF', 45, { life: 0.6, size: 1.2, gravity: 30, drag: 2 });
    this.soundAny(FireworkSounds, -10, 0.2);
  }

  // ---------------------------------------------------------------- text

  scoreboard(t) {
    const line = [new Array(Innings).fill(0), new Array(Innings).fill(0)];
    const played = [new Array(Innings).fill(false), new Array(Innings).fill(false)];
    const runsSoFar = [0, 0];
    const hits = [0, 0];
    for (const half of this.halves) if (half.start <= t) played[half.side][half.inning - 1] = true;
    for (const plate of this.plates) {
      if (plate.contact > t) break;
      // a run counts when it crosses the plate, not when the ball is hit
      let scored = 0;
      for (let k = 0; k <= 3; k++) {
        if (plate.has(k) && k + basesRun(plate, k) >= 4) {
          const from = k === 0 ? plate.batterFrom : plate.runFrom;
          if (plate.real(from + (4 - k) * plate.perBase) <= t) scored++;
        }
      }
      scored = Math.min(scored, plate.runs);
      line[plate.side][plate.half.inning - 1] += scored;
      runsSoFar[plate.side] += scored;
      if (plate.outcome >= 1 && plate.outcome <= 4) hits[plate.side]++;
    }
    const over = this.hasPlay && t >= sportLength(Sport.Baseball) - 0.05;
    this.over = over;

    // the outfield board: a line score, away over home
    const x = BoardBox[0] + 4;
    const y = BoardBox[1] + 1;
    for (let inning = 0; inning < Innings; inning++) this.say(String(inning + 1), x + 34 + inning * 11, y, '#9AA4B0');
    this.say(T.runsColumn, x + 104, y, '#FFD24A');
    this.say(T.hitsColumn, x + 116, y, '#9AA4B0');
    for (let row = 0; row < 2; row++) {
      const side = row === 0 ? 1 : 0;
      const rowY = y + 12 + row * 12;
      const batting = this.half && this.half.side === side && !over;
      this.say(this.abbreviations[side], x, rowY, side === 0 ? this.homeColour : this.awayColour);
      for (let inning = 0; inning < Innings; inning++) {
        const text = played[side][inning] ? String(line[side][inning]) : over && side === 0 && inning === Innings - 1 ? 'X' : '';
        if (text) this.say(text, x + 34 + inning * 11, rowY, batting && this.half.inning === inning + 1 ? GOLD : '#FFFFFF');
      }
      this.say(String(runsSoFar[side]), x + 104, rowY, '#FFD24A');
      this.say(String(hits[side]), x + 116, rowY, '#FFFFFF');
    }

    // the score bug: inning, outs, who is on
    if (this.half && !over) {
      this.say(this.bugs[this.half.side][this.half.inning - 1], BugBox[0] + 6, BugBox[1] + 3, '#FFFFFF');
      this.say(T.outs, BugBox[0] + 6, BugBox[1] + 17, '#9AA4B0');
    } else if (over) {
      this.say(L.final, BugBox[0] + 6, BugBox[1] + 10, GOLD);
    } else if (!this.hasPlay || t < 3) {
      this.say(this.matchup, BugBox[0] + 6, BugBox[1] + 10, '#FFFFFF');
    }

    const plate = this.plate;
    if (plate && t >= plate.release && t < plate.contact + 2.2) this.radar = plate.speed;
    if (plate && plate.outcome === 4 && t >= plate.real(plate.landed) && t < plate.real(plate.landed) + 2.5) this.radar = plate.distance;
    if (this.radar) this.say(this.radar, RadarBox[0] + RadarBox[2] - 4, RadarBox[1] + 2, '#7CFF00', false, true);
  }

  calls(t) {
    if (!this.hasPlay) return;
    if (t >= 0 && t < 2.9) {
      this.say(T.playBall, ArenaWidth / 2, 108, GOLD, true);
      return;
    }
    const half = this.half;
    const plate = this.plate;
    if (half && t < half.start + 1.6 && (!plate || t < plate.contact)) {
      this.say(this.cards[half.side][half.inning - 1], ArenaWidth / 2, 104, '#FFFFFF', true);
      const text = this.batting[half.side];
      this.say(text, ArenaWidth / 2 - text.length * 3.1, 118, half.side === 0 ? this.homeColour : this.awayColour);
      return;
    }
    if (!plate || t < plate.contact) return;
    if (t >= plate.real(plate.callAt) && t < plate.real(plate.callAt) + 1.5) this.say(plate.call, ArenaWidth / 2, 104, plate.callColour, true);
    if (plate.line && t >= plate.real(plate.lineAt) && t < plate.real(plate.lineAt) + 1.6) {
      if (plate.walkOff) this.say(plate.line, ArenaWidth / 2, 124, GOLD, true);
      else this.say(plate.line, ArenaWidth / 2 - plate.line.length * 3.1, 118, '#FFD24A');
    }
  }

  // ---------------------------------------------------------------- drawing

  /**
   * The stands and the field never change, so they are drawn once into layers: the crowd sitting, and a few
   * frames of it on its feet for when the place goes wild.
   */
  ensureLayers() {
    const ratio = ratioNow();
    if (this.layers && this.layers.ratio === ratio) return;
    const make = (crowd) => {
      const canvas = document.createElement('canvas');
      canvas.width = ArenaWidth * ratio;
      canvas.height = ArenaHeight * ratio;
      const c = canvas.getContext('2d');
      c.setTransform(ratio, 0, 0, ratio, 0, 0);
      c.imageSmoothingEnabled = false;
      rect(c, 0, Bar, ArenaWidth, ArenaHeight - Bar, '#262A31');
      for (let y = Bar + 6; y < ArenaHeight; y += 7) rect(c, 0, y, ArenaWidth, 1, '#30353D');
      crowd(c);
      drawPark(c);
      return canvas;
    };
    const frames = [];
    for (let frame = 0; frame < 4; frame++) frames.push(make(c => this.drawCrowd(c, 1, frame * Math.PI / 2)));
    this.layers = { ratio, rest: make(c => this.drawCrowd(c, 0, 0)), frames };
  }

  drawCrowd(c, excite, phase) {
    const up = excite > 0.55 ? 1.5 : 0;
    Seats.forEach((seat, i) => {
      const bob = excite * 2.4 * Math.max(0, Math.sin(seat.phase + phase));
      const x = seat.at[0];
      const y = seat.at[1] - bob - up;
      const size = seat.size;
      let skin = Skins[seat.skin];
      if (seat.at[1] >= SpriteRows && this.fans) {
        const look = this.seatLooks[i];
        skin = this.fanSkins[look];
        drawFan(c, this.fans[fanFacing(seat)][look], x, y, size);
      } else {
        rect(c, x - size * 0.75, y, size * 1.5, size * 1.2, this.shirts[seat.shirt]);
        rect(c, x - size * 0.5, y - size, size, size, skin);
      }
      // arms up when the place goes wild
      if (excite > 0.5 && seat.shirt % 3 === 0) rect(c, x + size * 0.6, y - size * 2, 1, size * 1.6, skin);
    });
  }

  drawField(c) {
    this.ensureLayers();
    const layer = this.excite > 0.35 ? this.layers.frames[Math.floor(this.clockTime * 7) % 4] : this.layers.rest;
    c.drawImage(layer, 0, 0, ArenaWidth, ArenaHeight);

    // fans knocked flat in their seats by a foul ball
    for (const index of this.hurtFans) {
      const seat = Seats[index];
      const size = seat.size;
      rect(c, seat.at[0] - size * 1.1, seat.at[1] - size * 2.4, size * 2.2, size * 2.4, '#262A31');
      if (seat.at[1] >= SpriteRows && this.fans) {
        drawFan(c, this.fans[fanFacing(seat)][this.seatLooks[index]], seat.at[0] - size * 0.6, seat.at[1] + size * 0.9, size, -1.3);
        continue;
      }
      rect(c, seat.at[0] - size * 0.75, seat.at[1], size * 1.5, size * 1.2, this.shirts[seat.shirt]);
      rect(c, seat.at[0] - size, seat.at[1] + size * 0.2, size * 1.1, size * 0.8, Skins[seat.skin]);
    }

    // broadcast boxes over the stands
    panel(c, BoardBox, '#0E1116', '#3A4250');
    panel(c, BugBox, 'rgba(12,15,20,0.92)', '#7CFF00');
    if (this.radar) panel(c, RadarBox, 'rgba(12,15,20,0.92)', '#7CFF00');
    this.drawBug(c);
  }

  /** Outs as lights and a little diamond with the occupied bags lit. */
  drawBug(c) {
    if (!this.half || this.over) return;
    for (let i = 0; i < 3; i++) circle(c, BugBox[0] + 40 + i * 9, BugBox[1] + 23, 3, i < this.outs ? '#FF5050' : '#3A4250');
    const cx = BugBox[0] + 92;
    const cy = BugBox[1] + 16;
    const bags = [[9, 0], [0, -9], [-9, 0]];
    for (let i = 0; i < 3; i++) diamond(c, cx + bags[i][0], cy + bags[i][1], 4.5, (this.bases & (1 << i)) !== 0 ? GOLD : '#3A4250');
    diamond(c, cx, cy + 9, 3, '#9AA4B0');
  }

  drawOverDecals(c) {
    // shadows under everyone, and under the ball
    for (let doll = 0; doll < this.used.length; doll++) {
      if (!this.used[doll] || !this.feet[doll]) continue;
      const at = this.feet[doll];
      const n = near(at[1]);
      ellipse(c, at[0], at[1], 7 * n, 2.2 * n, `rgba(0,0,0,${0.3 * this.doll(doll).alpha})`);
    }
    if (this.ballOn) {
      const n = near(this.ballShadow[1]);
      const fade = 1 - Math.min(1, this.ballHeight / 140);
      ellipse(c, this.ballShadow[0], this.ballShadow[1], 2.6 * n, 1.1 * n, `rgba(0,0,0,${0.4 * fade})`);
    }
  }

  drawOverlay(c) {
    if (this.batOn) this.drawBat(c, this.batAt, this.batAngle, this.batSize, true);
    if (this.shardOn) this.drawBat(c, this.shardAt, this.shardAngle, this.shardSize, false);
    if (!this.ballOn) return;
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const [x, y, size] = this.trail[i];
      ellipse(c, x, y, size, size, `rgba(255,255,255,${0.32 * (1 - i / 6)})`);
    }
    const [x, y] = this.ballAt2;
    // a dark rim keeps it readable against the crowd and the white shirts
    ellipse(c, x, y, this.ballSize + 0.9, this.ballSize + 0.9, 'rgba(0,0,0,0.55)');
    ellipse(c, x, y, this.ballSize, this.ballSize, '#F4F1E8');
    if (this.ballSize > 2.2) line(c, x - this.ballSize * 0.5, y, x + this.ballSize * 0.5, y, '#C03030');
  }

  /** The bat sprite with its handle in the hands and the barrel pointing at degrees on screen (clockwise). */
  drawBat(c, hands, degrees, size, held) {
    const image = this.sprite(BatRsi, 'icon');
    if (!image) return;
    const radians = degrees * Math.PI / 180;
    // the icon lies with its barrel up and to the right
    const x = held ? hands[0] + Math.cos(radians) * size * 0.31 : hands[0];
    const y = held ? hands[1] + Math.sin(radians) * size * 0.31 : hands[1];
    texture(c, image, x, y, size, size, radians + Math.PI / 4);
  }
}

/** The pitcher's windup: set, leg kick facing third, stride and follow-through. */
function delivery(plate, t, body) {
  const foul = plate.fouled && t < plate.windup;
  const windup = foul ? plate.foulWindup : plate.windup;
  const release = foul ? plate.foulRelease : plate.release;
  if (t < windup) return;
  const set = windup + (release - windup) * 0.3;
  const kick = release - 0.12;
  if (t < set) {
    body.facing = Dir.South;
    body.squash = 0.97;
  } else if (t < kick) {
    const k = (t - set) / Math.max(0.01, kick - set);
    body.facing = Dir.West;
    body.lift = 4.5 * Math.sin(Math.PI * k);
    body.rotation = -6 * k;
  } else if (t < release) {
    const k = (t - kick) / 0.12;
    body.facing = Dir.South;
    body.ground = [body.ground[0], body.ground[1] - 0.05 * k];
    body.rotation = 12 * k;
    body.squash = 1 - 0.08 * k;
  } else {
    const k = clamp((t - release) / 0.45, 0, 1);
    body.facing = Dir.South;
    body.ground = [body.ground[0], body.ground[1] - 0.05 * (1 - smooth((t - release - 0.6) / 0.6))];
    body.rotation = 14 * (1 - k);
    body.squash = 0.9 + 0.1 * k;
  }
}

function pitched(release, arrive, target, targetHeight, t) {
  if (t < release) return null;
  const k = clamp((t - release) / Math.max(0.05, arrive - release), 0, 1);
  return { ground: lerp(Hand, target, k), height: 25 + (targetHeight - 25) * k - 3 * k * (1 - k) };
}

/** The barrel's angle on screen through a swing, by seconds from the ball reaching the plate. */
function swing(s) {
  const times = [-0.14, -0.05, 0, 0.07, 0.18];
  const angles = [-128, -225, -360, -450, -510];
  if (s <= times[0]) return angles[0];
  for (let i = 1; i < times.length; i++) {
    if (s <= times[i]) return angles[i - 1] + (angles[i] - angles[i - 1]) * (s - times[i - 1]) / (times[i] - times[i - 1]);
  }
  return angles[angles.length - 1];
}

function shape(c, points, colour) {
  c.beginPath();
  c.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) c.lineTo(points[i][0], points[i][1]);
  c.closePath();
  c.fillStyle = colour;
  c.fill();
}

function strip(c, pairs, colour) {
  for (let i = 0; i + 1 < pairs.length; i++) shape(c, [pairs[i][0], pairs[i][1], pairs[i + 1][1], pairs[i + 1][0]], colour);
}

function ellipse(c, x, y, rx, ry, colour) {
  c.beginPath();
  c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  c.fillStyle = colour;
  c.fill();
}

function diamond(c, x, y, size, colour) {
  shape(c, [[x + size, y], [x, y - size], [x - size, y], [x, y + size]], colour);
}

function panel(c, box, fill, edge) {
  rect(c, box[0], box[1], box[2], box[3], fill);
  rect(c, box[0], box[1] + box[3] - 1, box[2], 1, edge);
}

/** The ballpark itself, drawn once into the stand layers. */
function drawPark(c) {
  const g = Geometry;
  shape(c, g.surface, Grass);
  for (const stripe of g.stripes) shape(c, stripe, Mown);
  strip(c, g.track, '#9C6C40');
  shape(c, g.dirt, Clay);
  shape(c, g.infield, Grass);
  shape(c, g.plateCircle, Clay);
  shape(c, g.moundRing, '#C08A58');
  shape(c, g.rubber, Chalky);
  for (const [a, b] of g.chalk) line(c, a[0], a[1], b[0], b[1], 'rgba(242,240,230,0.85)');
  for (const bag of g.bags) shape(c, bag, Chalky);
  shape(c, g.plate, Chalky);
  strip(c, g.wall, '#1D4A2C');
  c.beginPath();
  c.moveTo(g.top[0][0], g.top[0][1]);
  for (const p of g.top) c.lineTo(p[0], p[1]);
  c.strokeStyle = '#E8C547';
  c.lineWidth = 1;
  c.stroke();
  for (const pole of g.poles) line(c, pole[0], pole[1], pole[0], pole[1] - 30 * near(pole[1]), '#F2D22E');
  for (let side = 0; side < 2; side++) {
    shape(c, g.rails[side], '#22324E');
    shape(c, g.dens[side], '#101216');
  }
}

defineSport(Sport.Baseball, { play: (random, entrants, winner) => playBaseball(random, winner), Arena: BaseballArena });
