// Zero-g ball: the simulation (CMUSports.ZeroG.cs) and its arena (Sports/CMUZeroGArena.cs). Three a side tumbling
// in a glass-fronted cage against the stars. Players drift between push-offs with thruster puffs, perch on the cage
// walls, carry the ball and shoot it down a trail into the net. Body checks crack visors and leave blood floating
// as globules that splat on the walls and the glass; the live cage wall shocks anyone who drifts into it.
// Everything that moves is worked out from the match time, so a late joiner sees the same match, and the marks
// left by what they missed.

import { Sport, Action, Squad, defineSport, f, range, ev, female, kitColour, matchName, sportLength } from './core.js';
import {
  Arena, ArenaWidth, ArenaHeight, Bar, Dir, BLOOD, DARK_BLOOD, GOLD, shortName, kitCss, rect, frameRect, circle, line,
  poly, texture,
} from './arena.js';
import { BALL, dollCanvas, readyImage } from './dolls.js';

const T = {
  goal: team => `GOAL! ${team}`,
  hit: ['', 'BONK!', 'CRACK!', 'VISOR SMASHED!'],
  zap: 'ZAP!',
  post: 'OFF THE POST!',
  save: 'SAVED!',
};

// ---------------------------------------------------------------- the simulation

/**
 * A Special shot at goal. side: who shoots; extra: the shooter; state: how it ends, ZeroGScored, ZeroGPost or
 * ZeroGSaved. A scored shot reaches the net ZeroGShotFlight seconds later, at its Goal.
 */
export const ZeroGShot = 0;
/** A Special brush with the electrified cage wall. side, extra: who touches it; state: 0 the top wall, 1 the bottom. */
export const ZeroGShock = 1;
export const ZeroGScored = 0;
export const ZeroGPost = 1;
export const ZeroGSaved = 2;
/** How long a shot takes to reach the goal mouth, in seconds. */
export const ZeroGShotFlight = f(0.4);
/** How long after a player gets the ball the rough stuff happens to them, in seconds. */
const ZeroGScrapDelay = f(0.6);

/** CMUSports.ZeroG. Deterministic from the seed and the winner. */
export function playZeroG(random, winner) {
  const play = { events: [], score: [0, 0], result: '' };
  const length = sportLength(Sport.ZeroGBall);
  const winning = random.next(1, 6);
  const losing = random.next(0, winning);
  const goals = [];
  for (let i = 0; i < winning; i++) goals.push(winner);
  for (let i = 0; i < losing; i++) goals.push(1 - winner);

  // shuffle the order the goals go in, then give each its own stretch of the match
  for (let i = goals.length - 1; i > 0; i--) {
    const j = random.next(i + 1);
    [goals[i], goals[j]] = [goals[j], goals[i]];
  }

  const stretch = f((length - 10) / goals.length);
  let time = f(2);
  let holder = { side: random.next(2), player: 0 };
  for (let i = 0; i < goals.length; i++) {
    const side = goals[i];
    const goal = f(f(6 + f(stretch * i)) + range(random, stretch * 0.5, stretch * 0.9));
    play.events.push(ev(time, Action.Pass, holder.side, holder.player));
    for (time = f(time + range(random, 1, 2)); time < f(goal - 2.5); time = f(time + range(random, 1, 2.2))) {
      const s = random.nextDouble() < 0.5 ? holder.side : 1 - holder.side;
      holder = { side: s, player: random.next(Squad) };
      play.events.push(ev(time, Action.Pass, holder.side, holder.player));
      zeroGScrap(random, play, time, holder.side, holder.player);
    }

    const shooter = random.next(Squad);
    play.events.push(ev(f(goal - 1.5), Action.Pass, side, shooter));
    play.events.push(ev(f(goal - ZeroGShotFlight), Action.Special, side, ZeroGShot, shooter, ZeroGScored));
    play.events.push(ev(goal, Action.Goal, side, shooter));
    play.score[side]++;
    holder = { side: 1 - side, player: 0 };
    time = f(goal + 2.5);
  }

  play.events.push(ev(time, Action.Pass, holder.side, holder.player));
  for (time = f(time + 1.5); time < length - 1; time = f(time + range(random, 1, 2.2))) {
    const s = random.nextDouble() < 0.5 ? holder.side : 1 - holder.side;
    holder = { side: s, player: random.next(Squad) };
    play.events.push(ev(time, Action.Pass, holder.side, holder.player));
    zeroGScrap(random, play, time, holder.side, holder.player);
  }

  play.result = `${play.score[0]} - ${play.score[1]}`;
  return play;
}

/**
 * What may happen to the player who just got the ball, before the next pass: a body check from an opponent that
 * cracks their visor, someone drifting into the live cage wall, or a shot that misses. Never changes the score.
 */
function zeroGScrap(random, play, time, side, player) {
  const at = f(time + ZeroGScrapDelay);
  const roll = random.nextDouble();
  if (roll < 0.11) {
    // extra: how hard the hit was; state: the opponent who threw it
    const severity = random.next(1, 4);
    const attacker = random.next(Squad);
    play.events.push(ev(at, Action.Injury, side, player, severity, attacker));
  } else if (roll < 0.16) {
    const victimSide = random.next(2);
    const victim = random.next(Squad);
    const wall = random.next(2);
    play.events.push(ev(at, Action.Special, victimSide, ZeroGShock, victim, wall));
  } else if (roll < 0.25) {
    const outcome = random.next(ZeroGPost, ZeroGSaved + 1);
    play.events.push(ev(at, Action.Special, side, ZeroGShot, player, outcome));
  }
}

// ---------------------------------------------------------------- the arena

const BALL_SIZE = 24;
const Dolls = Squad * 2;
const Keeper = 2;
const CageLeft = 16;
const CageRight = ArenaWidth - 16;
const CageTop = Bar + 8;
const CageBottom = ArenaHeight - 8;
const GoalY = (CageTop + CageBottom) / 2;
const GoalHalf = 34;
/** How far from a wall a player perched on it stands, centre to rail. */
const Perch = 18;
const Kickoff = 2;
const PassSpeed = 420;
const KnockTime = 0.8;
/** How long before a shock the cage wall arms and crackles. */
const ArmTime = 0.9;
const MaxGlobules = 140;
const MaxGlass = 48;
const TAU = Math.PI * 2;

/** Each role's reach along the cage, from its own goal (0) to the one it attacks (1): striker, mid, back. */
const RoleNear = [0.48, 0.26, 0.05];
const RoleFar = [0.88, 0.68, 0.3];
const WallChance = [0.24, 0.24, 0.1];
const Lineup = [[0.4, -46], [0.28, 42], [0.1, 0]];
const Centre = [ArenaWidth / 2, GoalY];
/** The hatch in the cage roof that serves the ball after a goal. */
const Serve = [ArenaWidth / 2, CageTop + 8];

const CAGE = '#3FD8FF';
const RAIL = '#1A2433';
const HAZARD = '#D8B020';
const SPARK = '#FFF6A0';
const ARC = '#8FE6FF';
const PUFF = 'rgba(221,230,240,0.55)';
// decals take an opaque tint here, so the C#'s 80% scorch is its colour over the dark rail
const SCORCH = '#1A1612';
const SHARD = '#D8F6FF';
const LIT = '#9FE8FF';
const CHARRED = '#303848';
const SINGED = '#8A8A8A';

const SWOOSHES = [
  '/Audio/CMU14/PersonalComputers/Games/swoosh_1.ogg', '/Audio/CMU14/PersonalComputers/Games/swoosh_2.ogg',
  '/Audio/CMU14/PersonalComputers/Games/swoosh_3.ogg',
];
const PUNCHES = ['/Audio/CMU14/PersonalComputers/Games/punch_1.ogg', '/Audio/CMU14/PersonalComputers/Games/punch_2.ogg'];
const CRACKS = [
  '/Audio/Effects/glass_crack1.ogg', '/Audio/Effects/glass_crack2.ogg', '/Audio/Effects/glass_crack3.ogg',
  '/Audio/Effects/glass_crack4.ogg',
];
const GORE = [
  '/Audio/Weapons/Guns/Hits/bullet_meat1.ogg', '/Audio/Weapons/Guns/Hits/bullet_meat2.ogg',
  '/Audio/Weapons/Guns/Hits/bullet_meat3.ogg', '/Audio/Weapons/Guns/Hits/bullet_meat4.ogg',
];
const SPARKS = ['/Audio/Effects/sparks1.ogg', '/Audio/Effects/sparks2.ogg', '/Audio/Effects/sparks3.ogg', '/Audio/Effects/sparks4.ogg'];
const THUDS = ['/Audio/Effects/metal_thud1.ogg', '/Audio/Effects/metal_thud2.ogg', '/Audio/Effects/metal_thud3.ogg'];
const RATTLES = ['/Audio/Effects/fence_rattle1.ogg', '/Audio/Effects/fence_rattle2.ogg', '/Audio/Effects/fence_rattle3.ogg'];
/** The big crowd cheers run for about fifteen seconds, so only one plays at a time. */
const CHEERS = ['/Audio/CMU14/PersonalComputers/Games/crowd_cheer_1.ogg', '/Audio/CMU14/PersonalComputers/Games/crowd_cheer_2.ogg'];
const SMALL_CHEER = '/Audio/CMU14/PersonalComputers/Games/crowd_cheer_small.ogg';
/** How long a big cheer is left to run before another may start, in seconds. */
const CheerLength = 13;
const SPLATS = ['/Audio/Effects/Fluids/blood1.ogg', '/Audio/Effects/Fluids/blood2.ogg'];
const SOUNDS = [
  ...SWOOSHES, ...PUNCHES, ...CRACKS, ...GORE, ...SPARKS, ...THUDS, ...RATTLES, ...CHEERS, SMALL_CHEER, ...SPLATS,
  '/Audio/Items/Whistle/whistle_1.ogg', '/Audio/Items/Whistle/whistle_2.ogg', '/Audio/Items/Whistle/trench_whistle_1.ogg',
  '/Audio/Weapons/dodgeball.ogg', '/Audio/Effects/quick_exhale.ogg',
  '/Audio/Machines/warning_buzzer.ogg', '/Audio/Items/airhorn.ogg', '/Audio/Weapons/genhit1.ogg',
  '/Audio/Effects/glass_smack.ogg', '/Audio/_RMC14/Effects/hit_on_shattered_glass.ogg',
  '/Audio/Effects/Lightning/lightningshock.ogg', '/Audio/Effects/PowerSink/electric.ogg',
  '/Audio/Effects/soft_thump.ogg', '/Audio/_RMC14/Items/metal_chair_clang.ogg', '/Audio/Machines/airlock_electrify_on.ogg',
];

const Kind = { Hover: 0, Held: 1, Flight: 2, Shot: 3, Net: 4, Loose: 5, Gone: 6 };
const Cue = { Catch: 0, Post: 1, Save: 2, Arm: 3, Final: 4 };

/** A CSS hex colour with an alpha. */
function alpha(hex, a) {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** A doll's composited canvas multiplied by a colour, the way a SpriteView's Modulate tints it. */
function tintedDoll(colour, dir, tint) {
  return readyImage(`zerog|${colour}|${dir}|${tint}`, () => dollCanvas('Spacer', colour, dir).then(source => {
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(source, 0, 0);
    return canvas;
  }));
}

// small vector helpers, on [x, y]
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, s) => [a[0] * s, a[1] * s];
const vlerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const lengthSq = a => a[0] * a[0] + a[1] * a[1];
const normalize = a => {
  const l = Math.hypot(a[0], a[1]);
  return [a[0] / l, a[1] / l];
};
const turn = (v, radians) => {
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  return [v[0] * cos - v[1] * sin, v[0] * sin + v[1] * cos];
};
const lerp1 = (a, b, t) => a + (b - a) * t;
const clamp1 = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

function smooth(x) {
  x = clamp1(x, 0, 1);
  return x * x * (3 - 2 * x);
}

/** Thrust, coast, brake: speeds up over the first fifth, drifts steadily, slows over the last fifth. */
function drift(s) {
  const ramp = 0.2;
  const k = 1 / (2 * ramp * (1 - ramp));
  if (s < ramp) return s * s * k;
  if (s > 1 - ramp) return 1 - (1 - s) * (1 - s) * k;
  return (s - ramp / 2) / (1 - ramp);
}

/** A number from 0 to 1 that only depends on its inputs, for the look of a match: its paths and marks. Same as the C#. */
export function hash(a, b, c) {
  let h = (Math.imul(a, 0x9E3779B1) ^ Math.imul(b, 0x85EBCA77) ^ Math.imul(c, 0xC2B2AE3D)) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h, 0x2C1B3C6D) >>> 0;
  h = (h ^ (h >>> 12)) >>> 0;
  h = Math.imul(h, 0x297A2D39) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  return (h >>> 8) / 16777216;
}

const squad = player => clamp1(player, 0, Squad - 1);
const goalMouth = shooting => [shooting === 0 ? CageRight : CageLeft, GoalY];
const screen = (side, u, y) => [side === 0 ? lerp1(CageLeft, CageRight, u) : lerp1(CageRight, CageLeft, u), y];

function weight(pull, t) {
  if (t <= pull.start || t >= pull.end) return 0;
  if (t < pull.peak) return smooth((t - pull.start) / (pull.peak - pull.start));
  return t <= pull.release ? 1 : 1 - smooth((t - pull.release) / (pull.end - pull.release));
}

/** A loose ball keeps its speed and bounces off the cage, like a light folded back into the box. */
function fold1(value, min, max, count) {
  const span = max - min;
  const n = Math.floor((value - min) / span);
  count.bounces += Math.abs(n);
  const into = value - min - n * span;
  return (n & 1) === 0 ? min + into : max - into;
}

function fold(at, count = { bounces: 0 }) {
  return [fold1(at[0], CageLeft + 8, CageRight - 8, count), fold1(at[1], CageTop + 8, CageBottom - 8, count)];
}

/** Lined up in formation before the kickoff, bobbing gently. */
function formation(doll, t) {
  const side = Math.trunc(doll / Squad);
  const spot = Lineup[doll % Squad];
  const at = screen(side, spot[0], GoalY + spot[1]);
  return [at[0] + Math.sin(t * 1.3 + doll) * 3, at[1] + Math.cos(t * 1.1 + doll * 2) * 4];
}

/** The visor, at the front of the helmet, turned with the player. */
function head(doll, at, rotation) {
  return add(at, turn([doll < Squad ? 2 : -2, -9], -rotation * Math.PI / 180));
}

export class ZeroGArena extends Arena {
  constructor(font) {
    super(font);
    this.pulls = [];
    this.knocks = [];
    for (let doll = 0; doll < Dolls; doll++) {
      this.pulls.push([]);
      this.knocks.push([]);
    }
    this.turnovers = [];
    this.legs = [];
    this.cues = [];
    this.hits = [];
    this.zaps = [];
    this.goals = [];
    this.pos = Array.from({ length: Dolls }, () => [0, 0]);
    this.rot = new Array(Dolls).fill(0);
    this.segment = new Array(Dolls).fill(-Infinity);
    this.braked = new Array(Dolls).fill(false);
    this.crack = new Array(Dolls).fill(0);
    this.globules = [];
    this.glass = [];
    this.zplay = null;
    this.id = 0;
    this.names = ['', ''];
    this.score = [0, 0];
    this.fresh = -1;
    this.t = -1;
    this.lastT = NaN;
    this.real = 0;
    this.delta = 0;
    this.lastReal = 0;
    this.after = 0;
    this.spin = 0;
    this.cheered = -Infinity;
    this.lastIndex = -1;
    this.ballAt = Centre;
    this.ballLeg = -1;
    this.bounceLeg = -1;
    this.bounces = 0;
    this.preload(SOUNDS);
  }

  build(match) {
    this.prepare(match);
    for (let side = 0; side < 2; side++) {
      this.names[side] = shortName(matchName(match, side));
      for (let i = 0; i < Squad; i++) this.addDoll('Spacer', kitColour(match.sport, side, match.entrants[side]), 1.25);
    }
    this.ball = this.addItem(BALL, BALL_SIZE);
  }

  // ---------------------------------------------------------------- the match, worked out

  /**
   * Works out how everyone and the ball move for the whole match, once, from the same play every client sees:
   * first who gets drawn where and knocked about, then the ball's path through their hands.
   */
  prepare(match) {
    this.id = match.id | 0;
    this.turnovers = [];
    this.legs = [];
    this.cues = [];
    this.hits = [];
    this.zaps = [];
    this.goals = [];
    for (let doll = 0; doll < Dolls; doll++) {
      this.pulls[doll] = [];
      this.knocks[doll] = [];
      this.segment[doll] = -Infinity;
      this.braked[doll] = false;
      this.crack[doll] = 0;
    }
    this.resetFloor();
    this.lastIndex = -1;
    this.lastT = NaN;
    this.after = 0;
    this.ballLeg = -1;
    this.bounceLeg = -1;
    // the base's own play, worked out in show() before build() from the same seed and winner
    this.zplay = match.winner >= 0 ? this.play : null;
    const play = this.zplay;
    if (!play) return;

    const events = play.events;
    let holding = -1;
    for (const e of events) {
      if (e.action === Action.Pass && e.side !== holding) {
        this.turnovers.push({ time: e.time, side: e.side });
        holding = e.side;
      } else if (e.action === Action.Goal) {
        this.goals.push({ time: e.time, side: e.side });
      }
    }

    let passed = 0;
    events.forEach((e, i) => {
      if (e.action === Action.Pass) passed = e.time;
      else if (e.action === Action.Injury) this.prepareHit(i, e);
      else if (e.action === Action.Special && e.value === ZeroGShock) this.prepareZap(i, e);
      else if (e.action === Action.Special && e.value === ZeroGShot) this.prepareShot(i, e, passed);
    });

    this.addLeg({ kind: Kind.Hover, start: -Infinity, end: 0, from: Centre, to: Centre, velocity: [0, 0], holder: -1 });
    events.forEach((e, i) => {
      if (e.action === Action.Pass) this.preparePass(e);
      else if (e.action === Action.Special && e.value === ZeroGShot) this.prepareShotBall(i, e);
      else if (e.action === Action.Injury) this.knockLoose(e.time, e.side * Squad + squad(e.value), this.hitAt(i).direction, i);
      else if (e.action === Action.Special && e.value === ZeroGShock) this.knockLoose(e.time, e.side * Squad + squad(e.extra), [0, e.state === 0 ? 1 : -1], i);
    });

    this.cues.push({ time: sportLength(match.sport), kind: Cue.Final, at: Centre, side: match.winner });
    this.cues.sort((a, b) => a.time - b.time);
  }

  /** The opponent closes in, they collide, and both drift apart spinning. */
  prepareHit(index, e) {
    const victim = e.side * Squad + squad(e.value);
    const attacker = (1 - e.side) * Squad + squad(e.state);
    const severity = clamp1(e.extra, 1, 3);
    const target = this.player(victim, e.time).at;
    const start = this.player(attacker, e.time - 0.7).at;
    let direction = sub(target, start);
    direction = lengthSq(direction) > 1 ? normalize(direction) : [e.side === 0 ? -1 : 1, 0];
    const spin = hash(this.id, index, 5) < 0.5 ? 1 : -1;
    this.pulls[attacker].push({ start: e.time - 0.7, peak: e.time, release: e.time, end: e.time + 0.25, target: sub(target, mul(direction, 14)) });
    this.knocks[victim].push({ time: e.time, push: mul(direction, 26 + severity * 14), spin: spin * 360 * (severity === 3 ? 2 : 1), shock: false });
    this.knocks[attacker].push({ time: e.time, push: mul(direction, -16), spin: -spin * 360, shock: false });
    this.hits.push({ index, time: e.time, doll: victim, severity, contact: sub(target, mul(direction, 7)), direction });
  }

  /** A player drifts onto the live wall, gets thrown off it twitching, and the wall keeps the scorch. */
  prepareZap(index, e) {
    const victim = e.side * Squad + squad(e.extra);
    const top = e.state === 0;
    const near = this.player(victim, e.time - 1).at;
    const contact = [clamp1(near[0], CageLeft + 60, CageRight - 60), top ? CageTop : CageBottom];
    const spot = [contact[0], top ? CageTop + 16 : CageBottom - 16];
    this.pulls[victim].push({ start: e.time - 1, peak: e.time, release: e.time, end: e.time + 0.2, target: spot });
    const spin = hash(this.id, index, 7) < 0.5 ? 720 : -720;
    this.knocks[victim].push({ time: e.time, push: [(hash(this.id, index, 6) - 0.5) * 40, top ? 62 : -62], spin, shock: true });
    this.zaps.push({ index, time: e.time, doll: victim, contact, top });
    this.cues.push({ time: e.time - ArmTime, kind: Cue.Arm, at: contact, side: e.side });
  }

  /** The shooter thrusts into a shooting spot; on a save the keeper dives across the goal mouth. */
  prepareShot(index, e, passed) {
    const shooter = e.side * Squad + squad(e.extra);
    const forward = e.side === 0 ? 1 : -1;
    let spot;
    if (e.state === ZeroGScored) {
      spot = screen(e.side, 0.7, GoalY + (hash(this.id, index, 8) - 0.5) * 70);
    } else {
      const at = this.player(shooter, passed).at;
      spot = [at[0] + forward * 45, at[1] + (GoalY - at[1]) * 0.3];
    }
    this.pulls[shooter].push({ start: Math.min(passed, e.time - 0.3), peak: e.time, release: e.time + 0.05, end: e.time + 1.4, target: spot });
    if (e.state !== ZeroGSaved) return;

    const keeper = (1 - e.side) * Squad + Keeper;
    const goal = goalMouth(e.side);
    const dive = [goal[0] - forward * 30, GoalY + (hash(this.id, index, 9) - 0.5) * 44];
    const arrive = e.time + ZeroGShotFlight;
    this.pulls[keeper].push({ start: e.time - 0.2, peak: arrive, release: arrive + 0.2, end: arrive + 1.6, target: dive });
  }

  preparePass(e) {
    const current = this.legAt(e.time);
    let from = this.ballPosition(e.time, current);
    if (this.legs[current].kind === Kind.Net || this.legs[current].kind === Kind.Gone) from = Serve;
    const receiver = e.side * Squad + squad(e.value);
    const guess = this.hand(receiver, e.time);
    const flight = clamp1(Math.hypot(guess[0] - from[0], guess[1] - from[1]) / PassSpeed, 0.22, 0.5);
    const to = this.hand(receiver, e.time + flight);
    this.addLeg({ kind: Kind.Flight, start: e.time, end: e.time + flight, from, to, velocity: [0, 0], holder: receiver });
    this.addLeg({ kind: Kind.Held, start: e.time + flight, end: Infinity, from: to, to, velocity: [0, 0], holder: receiver });
    this.cues.push({ time: e.time + flight, kind: Cue.Catch, at: to, side: e.side });
  }

  prepareShotBall(index, e) {
    const from = this.ballPosition(e.time, this.legAt(e.time));
    const goal = goalMouth(e.side);
    const inward = e.side === 0 ? -1 : 1;
    const end = e.time + ZeroGShotFlight;
    let to;
    if (e.state === ZeroGPost) {
      const high = hash(this.id, index, 11) < 0.5;
      to = [goal[0] + inward * 3, GoalY + (high ? -GoalHalf : GoalHalf)];
      this.addLeg({ kind: Kind.Shot, start: e.time, end, from, to, velocity: [0, 0], holder: e.side });
      this.addLeg({ kind: Kind.Loose, start: end, end: Infinity, from: to, to, velocity: [inward * 140, high ? -70 : 70], holder: -1 });
      this.cues.push({ time: end, kind: Cue.Post, at: to, side: e.side });
    } else if (e.state === ZeroGSaved) {
      to = this.player((1 - e.side) * Squad + Keeper, end).at;
      this.addLeg({ kind: Kind.Shot, start: e.time, end, from, to, velocity: [0, 0], holder: e.side });
      this.addLeg({ kind: Kind.Loose, start: end, end: Infinity, from: to, to, velocity: [inward * 150, (hash(this.id, index, 12) - 0.5) * 180], holder: -1 });
      this.cues.push({ time: end, kind: Cue.Save, at: to, side: e.side });
    } else {
      to = [goal[0] - inward * 5, GoalY + (hash(this.id, index, 10) - 0.5) * 44];
      this.addLeg({ kind: Kind.Shot, start: e.time, end, from, to, velocity: [0, 0], holder: e.side });
      this.addLeg({ kind: Kind.Net, start: end, end: end + 1.4, from: to, to, velocity: [0, 0], holder: -1 });
      this.addLeg({ kind: Kind.Gone, start: end + 1.4, end: Infinity, from: to, to, velocity: [0, 0], holder: -1 });
    }
  }

  /** A hit player lets go of the ball, which drifts off until someone picks it up. */
  knockLoose(time, doll, direction, index) {
    const current = this.legAt(time);
    const leg = this.legs[current];
    if (leg.kind !== Kind.Held || leg.holder !== doll) return;
    const from = this.ballPosition(time, current);
    const velocity = mul(turn(direction, (hash(this.id, index, 13) - 0.5) * 1.8), 130);
    this.addLeg({ kind: Kind.Loose, start: time, end: Infinity, from, to: from, velocity, holder: -1 });
  }

  /** Legs stay in time order, so the ball's leg at any moment can be found by halving. */
  addLeg(leg) {
    const last = this.legs[this.legs.length - 1];
    if (last && leg.start < last.start) leg.start = last.start;
    this.legs.push(leg);
  }

  hitAt(index) {
    return this.hits.find(h => h.index === index) ?? { direction: [1, 0], severity: 1, doll: 0, time: 0, contact: [0, 0], index };
  }

  // ---------------------------------------------------------------- motion

  /** Where a player is, and how far turned in degrees, at a moment of the match. */
  player(doll, t) {
    if (!this.zplay) return { at: formation(doll, this.real), rotation: Math.sin(this.real * 0.9 + doll) * 6 };

    const path = this.path(doll, t);
    let at = path.at;
    let rotation = path.rotation;
    if (t < Kickoff + 2) {
      const settle = smooth((t - Kickoff) / 2);
      at = vlerp(formation(doll, t), at, settle);
      rotation *= settle;
    }

    for (const pull of this.pulls[doll]) {
      const w = weight(pull, t);
      if (w > 0) at = vlerp(at, pull.target, w);
    }

    for (const knock of this.knocks[doll]) {
      const age = t - knock.time;
      if (age <= 0) continue;
      at = add(at, mul(knock.push, age / KnockTime * Math.exp(1 - age / KnockTime)));
      rotation += knock.spin * (1 - Math.exp(-age / 0.6));
      if (knock.shock && age < 0.7) at = add(at, [Math.sin(age * 97) * 2.5, Math.cos(age * 83) * 2.5]);
    }

    return { at: [clamp1(at[0], CageLeft + 14, CageRight - 14), clamp1(at[1], CageTop + 16, CageBottom - 16)], rotation };
  }

  /**
   * The player's own roaming: from one push-off point to the next, thrusting away, coasting and braking, each
   * point inside their role's reach and leaning with whoever has the ball. Some points are perches on the walls.
   */
  path(doll, t) {
    const side = Math.trunc(doll / Squad);
    const player = doll % Squad;
    const period = 2.6 + player * 0.45 + side * 0.25;
    const x = t / period + hash(this.id, doll, 77);
    const segment = Math.floor(x);
    const progress = x - segment;
    const a = this.waypoint(doll, segment);
    const b = this.waypoint(doll, segment + 1);
    const eased = drift(progress);
    const u = clamp1(lerp1(a.u, b.u, eased) + this.lean(side, t), 0.03, 0.95);
    return {
      at: screen(side, u, lerp1(a.y, b.y, eased)),
      rotation: lerp1(a.turn, b.turn, eased),
      segment,
      progress,
      heading: sub(screen(side, b.u, b.y), screen(side, a.u, a.y)),
    };
  }

  /** A push-off point: u along the attack, y on screen, its turn in degrees. Perches hang feet to the wall. */
  waypoint(doll, segment) {
    const player = doll % Squad;
    const u = lerp1(RoleNear[player], RoleFar[player], hash(this.id, doll * 4 + 1, segment));
    const across = hash(this.id, doll * 4 + 2, segment);
    const spin = hash(this.id, doll * 4 + 4, segment) - 0.5;
    const perch = hash(this.id, doll * 4 + 3, segment) < WallChance[player];
    if (!perch) return { u, y: lerp1(CageTop + 30, CageBottom - 30, across), turn: spin * 70, perch };
    const top = across < 0.5;
    return { u, y: top ? CageTop + Perch : CageBottom - Perch, turn: (top ? 180 : 0) + spin * 20, perch };
  }

  /** Teams push up when they get the ball and drop back when they lose it, over a second and a half. */
  lean(side, t) {
    let i = this.turnovers.length - 1;
    while (i >= 0 && this.turnovers[i].time > t) i--;
    if (i < 0) return 0;
    const now = this.turnovers[i].side === side ? 0.1 : -0.08;
    const before = i === 0 ? 0 : this.turnovers[i - 1].side === side ? 0.1 : -0.08;
    return lerp1(before, now, smooth((t - this.turnovers[i].time) / 1.5));
  }

  hand(doll, t) {
    return add(this.player(doll, t).at, [doll < Squad ? 12 : -12, -2]);
  }

  legAt(t) {
    let low = 0;
    let high = this.legs.length - 1;
    let found = -1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (this.legs[mid].start <= t) {
        found = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return found;
  }

  /** Where the ball is at a moment on one of its legs, or hovering before the match when leg is -1. */
  ballPosition(t, leg) {
    const hover = [Centre[0], Centre[1] + Math.sin((this.zplay ? t : this.real) * 2) * 4];
    if (leg < 0) return hover;
    const l = this.legs[leg];
    switch (l.kind) {
      case Kind.Held: return this.hand(l.holder, t);
      case Kind.Flight:
      case Kind.Shot: return vlerp(l.from, l.to, clamp1((t - l.start) / (l.end - l.start), 0, 1));
      case Kind.Net: return [l.to[0] + Math.sin(t * 3) * 1.5, l.to[1] + Math.cos(t * 2.3) * 1.5];
      case Kind.Loose: return fold(add(l.from, mul(l.velocity, t - l.start)));
      case Kind.Gone: return l.to;
      default: return hover;
    }
  }

  // ---------------------------------------------------------------- events

  onEvent(match, e, index, live) {
    // the arena rewound to the start: the floor was wiped, so is the glass
    if (index <= this.lastIndex) this.resetFloor();
    this.lastIndex = index;
    const play = this.zplay;
    if (!play) return;

    if (e.action === Action.Pass) {
      if (index === 0) this.sound('/Audio/Items/Whistle/whistle_1.ogg', -2);
      else if (play.events[index - 1].action === Action.Goal) this.sound('/Audio/Items/Whistle/whistle_2.ogg', -4);
      this.soundAny(SWOOSHES, -12);
    } else if (e.action === Action.Goal) {
      this.onGoal(match, e);
    } else if (e.action === Action.Injury) {
      this.onHit(match, this.hitAt(index), live);
    } else if (e.action === Action.Special && e.value === ZeroGShock) {
      for (const zap of this.zaps) if (zap.index === index) this.onZap(match, zap, live);
    } else if (e.action === Action.Special && e.value === ZeroGShot) {
      this.onShot(match, e);
    }
  }

  onShot(match, e) {
    const shooter = e.side * Squad + squad(e.extra);
    const at = this.player(shooter, e.time).at;
    const back = e.side === 0 ? Math.PI : 0;
    this.burst(at[0] + (e.side === 0 ? -10 : 10), at[1] + 2, 16, PUFF, 110, { life: 0.6, size: 3, direction: back, spread: 0.9, drag: 3 });
    const ball = this.ballPosition(e.time, this.legAt(e.time));
    this.burst(ball[0], ball[1], 8, kitCss(match, e.side), 90, { life: 0.35, size: 1.5, direction: back, spread: 0.6, streak: true });
    this.sound('/Audio/Weapons/dodgeball.ogg');
    this.soundAny(SWOOSHES, -2);
    this.sound('/Audio/Effects/quick_exhale.ogg', -8, 0.6);
  }

  onGoal(match, e) {
    const [x, y] = goalMouth(e.side);
    const inward = e.side === 0 ? Math.PI : 0;
    const colour = kitCss(match, e.side);
    this.burst(x, y, 40, colour, 190, { life: 1.6, size: 2.5, direction: inward, spread: 2.4, drag: 1.4 });
    this.burst(x, y, 24, '#FFFFFF', 160, { life: 1.4, size: 2, direction: inward, spread: 2.2, drag: 1.4 });
    this.burst(x, y, 16, GOLD, 210, { life: 1.2, size: 1.5, direction: inward, spread: 1.6, streak: true, drag: 1.2 });
    this.flash(alpha(colour, 0.3), 0.6);
    this.shake(3, 0.5);
    this.sound('/Audio/Machines/warning_buzzer.ogg', -3);
    this.sound('/Audio/Items/airhorn.ogg', -6);
    this.soundAny(RATTLES, -2);
    this.cheer(false);
  }

  onHit(match, hit, live) {
    const side = Math.trunc(hit.doll / Squad);
    const { at, rotation } = this.player(hit.doll, hit.time);
    const visor = head(hit.doll, at, rotation);
    if (!live) {
      // what the globules left while nobody watched: blood on the nearest wall, and on the glass for the worst
      const wall = visor[1] < GoalY ? CageTop : CageBottom;
      for (let i = 0; i <= hit.severity; i++) this.splat(visor[0] + (this.fxFloat() - 0.5) * 90, wall, 5 + this.fxFloat() * 7 + hit.severity * 2);
      if (hit.severity >= 2) this.addGlass([visor[0] + (this.fxFloat() - 0.5) * 50, visor[1] + (this.fxFloat() - 0.5) * 30], 8 + hit.severity * 4);
      return;
    }

    const angle = Math.atan2(hit.direction[1], hit.direction[0]);
    this.soundAny(PUNCHES, -1);
    this.sound('/Audio/Weapons/genhit1.ogg', -6);
    if (hit.severity === 1) {
      this.sound('/Audio/Effects/glass_smack.ogg', -2);
    } else if (hit.severity === 2) {
      this.soundAny(CRACKS, -1);
    } else {
      this.sound('/Audio/_RMC14/Effects/hit_on_shattered_glass.ogg');
      this.soundAny(GORE, -4);
      this.flash('rgba(255,255,255,0.18)', 0.12);
    }
    if (hit.severity >= 2) this.scream(female(match.sport, match.entrants[side]));

    this.shake(1.5 + hit.severity, 0.3 + hit.severity * 0.08);
    this.burst(hit.contact[0], hit.contact[1], 6 + hit.severity * 2, 'rgba(255,255,255,0.7)', 60, { life: 0.3, size: 2.5, drag: 4 });
    this.burst(visor[0], visor[1], 4 + hit.severity * 5, SHARD, 130, { life: 0.55, size: 1.4, direction: angle, spread: 2.4, streak: true, drag: 1.5 });
    this.spawnBlood(visor, hit.direction, 3 + hit.severity * 4, 30 + hit.severity * 25);
    const colour = hit.severity === 1 ? '#FFFF00' : hit.severity === 2 ? '#FFA500' : '#FF4040';
    this.pop(T.hit[hit.severity], visor[0], visor[1] - 18, colour, hit.severity === 3);
  }

  onZap(match, zap, live) {
    this.splat(zap.contact[0], zap.contact[1], 18, SCORCH);
    if (!live) {
      this.splat(zap.contact[0] + (this.fxFloat() - 0.5) * 30, zap.contact[1], 7);
      return;
    }

    const side = Math.trunc(zap.doll / Squad);
    const { at, rotation } = this.player(zap.doll, zap.time);
    const visor = head(zap.doll, at, rotation);
    const away = zap.top ? Math.PI / 2 : -Math.PI / 2;
    this.sound('/Audio/Effects/Lightning/lightningshock.ogg', -2);
    this.soundAny(SPARKS, -4);
    this.sound('/Audio/Effects/PowerSink/electric.ogg', -8);
    this.scream(female(match.sport, match.entrants[side]), 1);
    this.flash(alpha(ARC, 0.35), 0.18);
    this.shake(4, 0.5);
    this.burst(zap.contact[0], zap.contact[1], 30, SPARK, 220, { life: 0.45, size: 1.5, direction: away, spread: 2.6, streak: true, drag: 2 });
    this.burst(zap.contact[0], zap.contact[1], 16, ARC, 160, { life: 0.35, size: 1.5, direction: away, spread: 2.2, streak: true, drag: 2 });
    this.burst(visor[0], visor[1], 10, 'rgba(90,90,96,0.5)', 30, { life: 1.2, size: 4, direction: away, spread: 2, drag: 1.5 });
    this.spawnBlood(visor, [0, zap.top ? 1 : -1], 4, 40);
    this.pop(T.zap, visor[0], visor[1] - 18, ARC, true);
  }

  playCue(match, cue) {
    switch (cue.kind) {
      case Cue.Catch:
        this.sound('/Audio/Effects/soft_thump.ogg', -14);
        break;
      case Cue.Post:
        this.sound('/Audio/_RMC14/Items/metal_chair_clang.ogg', -2);
        this.burst(cue.at[0], cue.at[1], 12, SPARK, 150, { life: 0.4, size: 1.5, streak: true, drag: 2 });
        this.shake(2);
        this.cheer(true);
        this.pop(T.post, cue.at[0] + (cue.side === 0 ? -50 : 50), cue.at[1] - 16, '#FFFFFF');
        break;
      case Cue.Save:
        this.sound('/Audio/Effects/soft_thump.ogg', -2);
        this.soundAny(PUNCHES, -6);
        this.cheer(true);
        this.burst(cue.at[0], cue.at[1], 10, 'rgba(255,255,255,0.8)', 90, { life: 0.35, size: 2, drag: 3 });
        this.shake(1.5);
        this.pop(T.save, cue.at[0], cue.at[1] - 22, kitCss(match, 1 - cue.side), true);
        break;
      case Cue.Arm:
        this.sound('/Audio/Machines/airlock_electrify_on.ogg', -4);
        break;
      case Cue.Final: {
        this.sound('/Audio/Items/Whistle/trench_whistle_1.ogg', -2);
        this.sound('/Audio/Items/airhorn.ogg', -6);
        this.cheer(false);
        const colour = kitCss(match, cue.side);
        for (let side = 0; side < 2; side++) {
          const [x, y] = goalMouth(side);
          const inward = side === 0 ? Math.PI : 0;
          this.burst(x, y, 20, colour, 170, { life: 1.8, size: 2.5, direction: inward, spread: 2.4, drag: 1.2 });
          this.burst(x, y, 14, GOLD, 170, { life: 1.8, size: 2, direction: inward, spread: 2.4, drag: 1.2 });
          this.burst(x, y, 14, '#FFFFFF', 150, { life: 1.6, size: 2, direction: inward, spread: 2.4, drag: 1.2 });
        }
        break;
      }
    }
  }

  /**
   * The crowd behind the glass: a big cheer for a goal or the final whistle, unless one is still running, when
   * the short one stands in; the short one alone for a save or a shot off the post.
   */
  cheer(small) {
    if (!this.live) return;
    if (!small && this.real - this.cheered >= CheerLength) {
      this.cheered = this.real;
      this.soundAny(CHEERS, -6, 0.03);
      return;
    }
    this.sound(SMALL_CHEER, -6);
  }

  // ---------------------------------------------------------------- blood in zero-g

  spawnBlood(at, towards, count, speed) {
    const angle = Math.atan2(towards[1], towards[0]);
    for (let i = 0; i < count && this.globules.length < MaxGlobules; i++) {
      const a = angle + (this.fxFloat() - 0.5) * 2.2;
      const v = speed * (0.3 + this.fxFloat() * 0.9);
      this.globules.push({
        x: at[0], y: at[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        radius: 1.2 + this.fxFloat() * 2.2, phase: this.fxFloat() * TAU, age: 0, life: 5 + this.fxFloat() * 3,
        depth: 0, depthSpeed: (this.fxFloat() - 0.35) * 0.9, colour: this.fxFloat() < 0.3 ? DARK_BLOOD : BLOOD,
      });
    }
  }

  /** Globules drift until they reach a wall, the glass or the back mesh, and burst there as a stain. */
  updateGlobules(delta) {
    for (let i = this.globules.length - 1; i >= 0; i--) {
      const g = this.globules[i];
      g.age += delta;
      g.x += g.vx * delta;
      g.y += g.vy * delta;
      const keep = Math.max(0, 1 - 0.08 * delta);
      g.vx *= keep;
      g.vy *= keep;
      g.depth += g.depthSpeed * delta;
      g.phase += delta * 9;
      const x = clamp1(g.x, CageLeft, CageRight);
      const y = clamp1(g.y, CageTop, CageBottom);
      if (g.depth >= 1) {
        this.addGlass([g.x, g.y], g.radius * 5);
        this.soundAny(SPLATS, -16);
      } else if (x !== g.x || y !== g.y) {
        this.splat(x, y, g.radius * 3.2, g.colour);
        this.soundAny(SPLATS, -18);
      } else if (g.age >= g.life || g.depth <= -1) {
        this.splat(g.x, g.y, g.radius * 2.6, DARK_BLOOD);
      } else {
        continue;
      }
      this.globules.splice(i, 1);
    }
  }

  addGlass(at, size) {
    if (this.glass.length >= MaxGlass) this.glass.shift();
    const colour = this.fxFloat() < 0.3 ? DARK_BLOOD : BLOOD;
    this.glass.push({ x: at[0], y: at[1], size, state: Math.floor(this.fxFloat() * 6), rot: this.fxFloat() * TAU, colour });
  }

  resetFloor() {
    this.globules = [];
    this.glass = [];
  }

  // ---------------------------------------------------------------- the frame

  updateMatch(match, play, t) {
    const real = performance.now();
    this.delta = this.lastReal ? Math.min(0.25, (real - this.lastReal) / 1000) : 0;
    this.lastReal = real;
    this.real += this.delta;

    const length = sportLength(match.sport);
    const over = this.zplay != null && t >= length;
    this.after = over ? this.after + this.delta : 0;
    const time = this.zplay == null ? t : t + this.after;
    this.t = time;

    if (this.zplay) {
      // cues between events: only for time that really passed on screen, not a jump back to the match
      if (!Number.isNaN(this.lastT) && t > this.lastT && t - this.lastT < 0.5) {
        for (const cue of this.cues) if (cue.time > this.lastT && cue.time <= t) this.playCue(match, cue);
      }
      this.lastT = t;
    }

    for (let doll = 0; doll < Dolls; doll++) {
      const side = Math.trunc(doll / Squad);
      const { at, rotation: turned } = this.player(doll, time);
      let rotation = turned;
      if (over && side === match.winner) rotation += this.after * 160;
      this.pos[doll] = at;
      this.rot[doll] = rotation;
      this.thrusters(doll, time);
      this.pose(doll, at[0], at[1], side === 0 ? Dir.East : Dir.West, rotation);

      let crack = 0;
      for (const hit of this.hits) if (hit.doll === doll && hit.time <= time) crack = Math.max(crack, hit.severity);
      this.crack[doll] = crack;
      if (crack >= 2 && !over && this.fxFloat() < this.delta * (crack === 3 ? 1.6 : 0.7)) {
        this.spawnBlood(head(doll, at, rotation), [this.fxFloat() - 0.5, this.fxFloat() - 0.5], 1, 14);
      }
    }

    const leg = this.legAt(time);
    const ball = this.ballPosition(time, leg);
    this.ballAt = ball;
    this.ballLeg = leg;
    const kind = leg < 0 ? Kind.Hover : this.legs[leg].kind;
    if (kind === Kind.Loose) {
      const l = this.legs[leg];
      const count = { bounces: 0 };
      fold(add(l.from, mul(l.velocity, time - l.start)), count);
      if (leg === this.bounceLeg && count.bounces > this.bounces) {
        this.soundAny(THUDS, -12);
        this.burst(ball[0], ball[1], 5, 'rgba(255,255,255,0.6)', 50, { life: 0.3, size: 1.5, drag: 3 });
      }
      this.bounceLeg = leg;
      this.bounces = count.bounces;
    }

    const flying = kind === Kind.Flight || kind === Kind.Shot || kind === Kind.Loose;
    this.spin = (this.spin + this.delta * (flying ? 720 : 90)) % 360;
    if (kind !== Kind.Gone) this.place(this.ball, ball[0], ball[1], this.spin);

    this.updateGlobules(this.delta);

    this.score[0] = this.score[1] = 0;
    this.fresh = -1;
    for (const goal of this.goals) {
      if (goal.time > time) break;
      this.score[goal.side]++;
      if (time - goal.time < 2.5) this.fresh = goal.side;
    }
    if (this.fresh >= 0) this.say(T.goal(matchName(match, this.fresh)), ArenaWidth / 2, ArenaHeight / 2 - 10, GOLD, true);
  }

  /** Puffs from the backpack as a player pushes off towards the next point, and as they brake into it. */
  thrusters(doll, time) {
    if (!this.zplay) return;
    const { segment, progress, heading } = this.path(doll, time);
    const direction = lengthSq(heading) > 1 ? normalize(heading) : [1, 0];
    const at = this.pos[doll];
    if (segment !== this.segment[doll]) {
      if (segment === this.segment[doll] + 1 && time > Kickoff) {
        const { perch } = this.waypoint(doll, segment);
        const back = Math.atan2(-direction[1], -direction[0]);
        this.burst(at[0] - direction[0] * 10, at[1] - direction[1] * 10, perch ? 14 : 6, PUFF, perch ? 90 : 55,
          { life: 0.5, size: perch ? 3 : 2.2, direction: back, spread: 0.8, drag: 3 });
        if (perch) {
          this.soundAny(THUDS, -16);
          this.sound('/Audio/Effects/quick_exhale.ogg', -14, 0.65);
        }
      }
      this.segment[doll] = segment;
      this.braked[doll] = false;
    } else if (!this.braked[doll] && progress > 0.8) {
      this.braked[doll] = true;
      if (time > Kickoff) {
        this.burst(at[0] + direction[0] * 10, at[1] + direction[1] * 10, 4, PUFF, 40,
          { life: 0.4, size: 2, direction: Math.atan2(direction[1], direction[0]), spread: 0.7, drag: 3 });
      }
    }
  }

  /** A shocked player flickers between lit up and skeleton dark, then stays a little singed: [tint, strength]. */
  tint(doll, time) {
    for (const zap of this.zaps) {
      if (zap.doll !== doll) continue;
      const age = time - zap.time;
      if (age < 0 || age >= 4) continue;
      if (age < 0.7) return [(Math.trunc(age * 24) & 1) === 0 ? LIT : CHARRED, 1];
      return [SINGED, 1 - (age - 0.7) / 3.3];
    }
    return null;
  }

  // ---------------------------------------------------------------- drawing

  drawField(c) {
    rect(c, 0, Bar, ArenaWidth, ArenaHeight - Bar, '#03040A');

    // a nebula far behind the cage
    circle(c, 440, 80, 96, alpha('#2A1A4A', 0.22));
    circle(c, 470, 64, 60, alpha('#4A2470', 0.18));
    circle(c, 410, 110, 40, alpha('#6A2A60', 0.12));

    // stars drifting by, the near ones faster
    for (let star = 0; star < 84; star++) {
      const layer = star % 3;
      let x = hash(star, 1, 31) * ArenaWidth - this.real * (2 + layer * 4);
      x -= Math.floor(x / ArenaWidth) * ArenaWidth;
      const y = Bar + hash(star, 2, 31) * (ArenaHeight - Bar);
      const twinkle = 0.25 + layer * 0.18 + Math.sin(this.real * (1 + layer) + star) * 0.08;
      const size = 1 + layer * 0.5;
      rect(c, x, y, size, size, `rgba(255,255,255,${twinkle})`);
    }

    // a planet, lit from the top right: its thin crescent and the haze of its air
    circle(c, 64, 216, 56, alpha('#5FA8E0', 0.12));
    circle(c, 64, 216, 52, '#2A527C');
    circle(c, 56, 222, 50, '#0B1422');

    // the cage: a back panel with its mesh, the halfway line and circle
    rect(c, CageLeft, CageTop, CageRight - CageLeft, CageBottom - CageTop, alpha('#0B1626', 0.55));
    const mesh = alpha(CAGE, 0.06);
    for (let x = CageLeft + 24; x < CageRight; x += 24) line(c, x, CageTop, x, CageBottom, mesh);
    for (let y = CageTop + 22; y < CageBottom; y += 22) line(c, CageLeft, y, CageRight, y, mesh);
    rect(c, ArenaWidth / 2 - 1, CageTop, 2, CageBottom - CageTop, alpha(CAGE, 0.2));
    circle(c, ArenaWidth / 2, GoalY, 32, alpha(CAGE, 0.22), false);
    circle(c, ArenaWidth / 2, GoalY, 3, alpha(CAGE, 0.35));
    rect(c, Serve[0] - 10, CageTop, 20, 4, '#2E3E52');

    const match = this.match;
    if (!match) return;

    // each team's own goal, a netted pocket in its end wall
    for (let side = 0; side < 2; side++) {
      const colour = kitCss(match, side);
      const x = side === 0 ? CageLeft - 12 : CageRight;
      rect(c, x, GoalY - GoalHalf, 12, GoalHalf * 2, alpha(colour, 0.18));
      for (let y = GoalY - GoalHalf + 6; y < GoalY + GoalHalf; y += 6) line(c, x, y, x + 12, y, 'rgba(255,255,255,0.18)');
      line(c, x + 6, GoalY - GoalHalf, x + 6, GoalY + GoalHalf, 'rgba(255,255,255,0.18)');
    }

    // the walls: the end walls around the goal mouths, the live top and bottom rails with their hazard stripes
    const wallHeight = GoalY - GoalHalf - (CageTop - 4);
    rect(c, CageLeft - 4, CageTop - 4, 4, wallHeight, RAIL);
    rect(c, CageLeft - 4, GoalY + GoalHalf, 4, wallHeight, RAIL);
    rect(c, CageRight, CageTop - 4, 4, wallHeight, RAIL);
    rect(c, CageRight, GoalY + GoalHalf, 4, wallHeight, RAIL);
    for (let wall = 0; wall < 2; wall++) {
      const y = wall === 0 ? CageTop - 4 : CageBottom;
      rect(c, CageLeft - 4, y, CageRight - CageLeft + 8, 4, RAIL);
      for (let x = CageLeft + 4; x < CageRight - 8; x += 20) rect(c, x, y + 1, 9, 2, alpha(HAZARD, 0.7));
      const hum = 0.18 + Math.sin(this.real * 7 + wall * 2) * 0.05;
      rect(c, CageLeft, wall === 0 ? CageTop : CageBottom - 1, CageRight - CageLeft, 1, alpha(CAGE, hum));
    }

    // a wall arming under someone about to touch it
    for (const zap of this.zaps) {
      const age = this.t - zap.time;
      if (age < -ArmTime || age > 0.6) continue;
      const power = age < 0 ? smooth((age + ArmTime) / ArmTime) : 1 - age / 0.6;
      const y = zap.top ? CageTop - 3 : CageBottom - 3;
      rect(c, zap.contact[0] - 50, y, 100, 6, alpha(ARC, 0.15 + power * 0.45));
      rect(c, zap.contact[0] - 26, y + 1, 52, 4, `rgba(255,255,255,${power * 0.5})`);
    }
  }

  drawOverDecals(c) {
    const match = this.match;
    if (!match) return;

    // a soft glow in each kit's colour behind the players, so the teams read against the dark
    for (let doll = 0; doll < Dolls; doll++) {
      const colour = alpha(kitCss(match, Math.trunc(doll / Squad)), 0.07);
      circle(c, this.pos[doll][0], this.pos[doll][1], 18, colour);
      circle(c, this.pos[doll][0], this.pos[doll][1], 11, colour);
    }

    if (this.ballLeg < 0 || this.ballLeg >= this.legs.length) return;
    const leg = this.legs[this.ballLeg];
    if (leg.kind !== Kind.Flight && leg.kind !== Kind.Shot && leg.kind !== Kind.Loose) return;

    // the ball's trail: long and in the shooter's colour on a shot, a faint wake on a pass
    const shot = leg.kind === Kind.Shot;
    const samples = shot ? 12 : 7;
    const trail = shot ? kitCss(match, leg.holder) : '#FFFFFF';
    for (let i = samples; i >= 1; i--) {
      const when = this.t - i * 0.022;
      if (when < leg.start) continue;
      const at = this.ballPosition(when, this.ballLeg);
      const fade = 1 - i / (samples + 1);
      circle(c, at[0], at[1], (shot ? 7 : 5) * fade + 1, alpha(trail, (shot ? 0.45 : 0.18) * fade));
    }
    if (shot) circle(c, this.ballAt[0], this.ballAt[1], 11, 'rgba(255,255,255,0.15)');
  }

  drawOverlay(c) {
    const match = this.match;
    if (!match) return;

    this.drawTints(c, match);
    for (const g of this.globules) {
      const radius = g.radius * (1 + g.depth * 0.35) * (1 + Math.sin(g.phase) * 0.14);
      circle(c, g.x, g.y, radius + 0.6, DARK_BLOOD);
      circle(c, g.x, g.y, radius, g.colour);
      circle(c, g.x - radius * 0.35, g.y - radius * 0.35, radius * 0.3, 'rgba(255,138,138,0.55)');
    }

    this.drawGoalLights(c, match);
    this.drawImpacts(c);
    this.drawVisors(c);

    // the glass in front: two soft reflections, the blood that hit it, the bolts of its frame
    const shimmer = 0.035 + Math.sin(this.real * 0.7) * 0.01;
    poly(c, `rgba(255,255,255,${shimmer})`, [120, CageTop], [175, CageTop], [95, CageBottom], [40, CageBottom]);
    poly(c, `rgba(255,255,255,${shimmer * 0.7})`, [350, CageTop], [368, CageTop], [288, CageBottom], [270, CageBottom]);

    for (const glass of this.glass) {
      const image = this.sprite('/Textures/Fluids/splatter.rsi', `splatter-${glass.state}`, glass.colour);
      if (!image) continue;
      c.globalAlpha = 0.75;
      texture(c, image, glass.x, glass.y, glass.size, glass.size, glass.rot);
      c.globalAlpha = 1;
    }

    frameRect(c, CageLeft, CageTop, CageRight - CageLeft, CageBottom - CageTop, 'rgba(255,255,255,0.1)');
    for (let corner = 0; corner < 4; corner++) {
      const x = corner % 2 === 0 ? CageLeft - 6 : CageRight - 4;
      const y = corner < 2 ? CageTop - 6 : CageBottom - 4;
      rect(c, x, y, 10, 10, RAIL);
      frameRect(c, x, y, 10, 10, '#8FA3B8');
      circle(c, x + 5, y + 5, 1.5, '#8FA3B8');
    }

    // the scoreboard sits in the bar, which stays still while the field shakes
    const [sx, sy] = this.shakeOffset;
    c.save();
    c.translate(-sx, -sy);
    this.drawScoreboard(c, match);
    c.restore();
  }

  /** The doll again, multiplied by its shock tint, the way the game modulates its SpriteView. */
  drawTints(c, match) {
    for (let doll = 0; doll < Dolls; doll++) {
      const tint = this.tint(doll, this.t);
      if (!tint) continue;
      const side = Math.trunc(doll / Squad);
      const d = this.doll(doll);
      const image = tintedDoll(kitColour(match.sport, side, match.entrants[side]), d.dir, tint[0]);
      if (!image) continue;
      c.save();
      c.globalAlpha = clamp1(tint[1], 0, 1);
      c.translate(d.x, d.y);
      if (d.rot) c.rotate(-d.rot * Math.PI / 180);
      const size = 32 * d.scale;
      c.drawImage(image, -size / 2, -size / 2, size, size);
      c.restore();
    }
  }

  /** The goal frame strobes in the scorer's colour, fading over three seconds. */
  drawGoalLights(c, match) {
    for (let side = 0; side < 2; side++) {
      const mouth = goalMouth(1 - side);
      let lit = 0;
      let by = side;
      for (const goal of this.goals) {
        const age = this.t - goal.time;
        if (goal.side === 1 - side && age >= 0 && age < 3) {
          lit = (Math.trunc(age * 8) & 1) === 0 ? 1 - age / 3 : 0.35 * (1 - age / 3);
          by = goal.side;
        }
      }

      const colour = kitCss(match, by);
      const x = side === 0 ? CageLeft - 4 : CageRight;
      const glow = 0.55 + lit * 0.45;
      rect(c, x, mouth[1] - GoalHalf - 2, 4, 4, alpha(colour, glow));
      rect(c, x, mouth[1] + GoalHalf - 2, 4, 4, alpha(colour, glow));
      line(c, x + 2, mouth[1] - GoalHalf, x + 2, mouth[1] + GoalHalf, alpha(colour, 0.25 + lit * 0.6));
      if (lit <= 0) continue;
      for (let ring = 1; ring <= 3; ring++) {
        const grow = ring * 5;
        frameRect(c, x - grow, mouth[1] - GoalHalf - grow, 4 + grow * 2, (GoalHalf + grow) * 2, alpha(colour, lit * 0.5 / ring));
      }
      circle(c, x + 2, mouth[1], 26 * lit + 6, alpha(colour, lit * 0.18));
    }
  }

  /** A white impact frame where a check lands, and bolts from the wall into a shocked player. */
  drawImpacts(c) {
    for (const hit of this.hits) {
      const age = this.t - hit.time;
      if (age < 0 || age >= 0.1) continue;
      const size = 6 + hit.severity * 3;
      circle(c, hit.contact[0], hit.contact[1], size * (1 - age * 5), 'rgba(255,255,255,0.85)');
      for (let ray = 0; ray < 8; ray++) {
        const a = ray * TAU / 8 + hit.index;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const reach = size * 2.2;
        line(c, hit.contact[0] + cos * size, hit.contact[1] + sin * size, hit.contact[0] + cos * reach, hit.contact[1] + sin * reach, '#FFFFFF');
      }
    }

    for (const zap of this.zaps) {
      const age = this.t - zap.time;
      if (age < -ArmTime || age >= 0.6) continue;
      if (age < 0) {
        // crackles along the arming rail
        if (this.fxFloat() < 0.5) {
          this.bolt(c, [zap.contact[0] - 30 + this.fxFloat() * 20, zap.contact[1]], [zap.contact[0] + 10 + this.fxFloat() * 20, zap.contact[1]], 3, alpha(ARC, 0.7));
        }
        continue;
      }
      const at = this.pos[zap.doll];
      this.bolt(c, zap.contact, head(zap.doll, at, this.rot[zap.doll]), 6, '#FFFFFF');
      this.bolt(c, [zap.contact[0] - 12, zap.contact[1]], at, 5, ARC);
      this.bolt(c, [zap.contact[0] + 12, zap.contact[1]], [at[0], at[1] + 8], 5, alpha(ARC, 0.7));
    }
  }

  bolt(c, from, to, jitter, colour) {
    let normal = sub(to, from);
    normal = lengthSq(normal) > 0.01 ? normalize([-normal[1], normal[0]]) : [0, 1];
    const points = 7;
    c.beginPath();
    for (let i = 0; i < points; i++) {
      const shake = i === 0 || i === points - 1 ? 0 : (this.fxFloat() - 0.5) * 2 * jitter;
      const at = add(vlerp(from, to, i / (points - 1)), mul(normal, shake));
      if (i === 0) c.moveTo(at[0], at[1]);
      else c.lineTo(at[0], at[1]);
    }
    c.strokeStyle = colour;
    c.lineWidth = 1.4;
    c.stroke();
  }

  /** Cracks across the visor of everyone who took a hard check, worse for harder ones; the worst fill with blood. */
  drawVisors(c) {
    for (let doll = 0; doll < Dolls; doll++) {
      const crack = this.crack[doll];
      if (crack === 0) continue;
      const visor = head(doll, this.pos[doll], this.rot[doll]);
      if (crack === 3) circle(c, visor[0], visor[1], 3.5, alpha(BLOOD, 0.55));
      const spin = -this.rot[doll] * Math.PI / 180;
      for (let n = 0; n < crack * 2 + 1; n++) {
        const angle = hash(this.id, doll, n + 40) * TAU + spin;
        const reach = 2.5 + hash(this.id, doll, n + 60) * 2.5;
        const out = [Math.cos(angle), Math.sin(angle)];
        const bend = mul(turn(out, 0.6), reach * 0.5);
        const mid = add(visor, mul(out, reach * 0.5));
        line(c, visor[0], visor[1], mid[0], mid[1], 'rgba(255,255,255,0.9)');
        line(c, mid[0], mid[1], mid[0] + bend[0], mid[1] + bend[1], 'rgba(255,255,255,0.7)');
      }
    }
  }

  /** The score in the middle of the top bar, still while the cage shakes. The team with the ball gets a light. */
  drawScoreboard(c, match) {
    const centre = ArenaWidth / 2;
    let holder = -1;
    const leg = this.legs[this.ballLeg];
    if (leg && (leg.kind === Kind.Held || leg.kind === Kind.Flight)) holder = Math.trunc(leg.holder / Squad);

    c.font = `bold 10px ${this.font}`;
    c.textBaseline = 'top';
    for (let side = 0; side < 2; side++) {
      const colour = kitCss(match, side);
      const box = side === 0 ? centre - 27 : centre + 5;
      const lit = this.fresh === side && (Math.trunc(this.real * 6) & 1) === 0;
      rect(c, box, 4, 22, 17, lit ? GOLD : '#1B2230');
      frameRect(c, box, 4, 22, 17, alpha(colour, 0.8));
      c.textAlign = 'center';
      c.fillStyle = lit ? '#000000' : '#FFFFFF';
      c.fillText(String(Math.min(this.score[side], 9)), box + 11, 6);

      const chip = side === 0 ? centre - 40 : centre + 34;
      rect(c, chip, 7, 6, 11, colour);
      c.textAlign = side === 0 ? 'right' : 'left';
      c.fillStyle = '#FFFFFF';
      c.fillText(this.names[side], side === 0 ? chip - 5 : chip + 11, 7);
      if (holder === side) circle(c, chip + 3, 22, 1.5, '#7CFF00');
    }
    rect(c, centre - 2, 12, 4, 1.5, 'rgba(255,255,255,0.7)');
  }
}

defineSport(Sport.ZeroGBall, { play: (random, entrants, winner) => playZeroG(random, winner), Arena: ZeroGArena });
