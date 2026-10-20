// The 100 metre dash: the simulation (CMUSports.Sprint.cs) and its arena (Sports/CMUSprintArena.cs). Five lanes
// under the colony dome: crouched starts and the starter's pistol, dust and sweat at speed, the crowd on its feet
// as the leader pulls away, a photo-finish snapshot and a split board in the infield. A runner who goes down skids
// face first and leaves a smear down the lane, and still crosses the line at their real time: every motion curve
// is planned around the times the match drew.

import { Sport, Action, SprintStart, defineSport, f, roundEven, range, ev, kitColour, matchName, female, sportLength, playMatch } from './core.js';
import {
  Arena, ArenaWidth, ArenaHeight, Bar, Dir, BLOOD, DARK_BLOOD, clamp, kitCss, shortName, rect, frameRect, circle, line, poly, texture,
} from './arena.js';

const T = {
  marks: 'On your marks',
  set: 'Set',
  go: 'GO!',
  title: '100 M',
  intro: (lane, name) => `LANE ${lane} ${name}`,
  lane: lane => `LANE ${lane}`,
  lead: name => `LEAD ${name}`,
  split: time => `50m ${time}`,
  reaction: time => `RT ${time}`,
  rank: place => (place === 1 ? '1st' : place === 2 ? '2nd' : place === 3 ? '3rd' : `${place}th`),
  place: (place, time) => `${T.rank(place)} ${time}`,
  falseStart: 'FALSE START!',
  faceplant: 'FACEPLANT!',
  hamstring: 'HAMSTRING!',
  tangled: 'TANGLED!',
  down: 'DOWN!',
  hurt: 'HURT',
  photo: 'PHOTO FINISH',
  finishCam: 'FINISH CAM',
  record: 'MEET RECORD!',
};

// ---------------------------------------------------------------- the simulation

/** A runner leaves the blocks. Side: the lane. Extra: the reaction to the gun, in milliseconds. */
export const SprintReaction = 0;
/** A runner breaks before the gun and the field is called back. Side: the lane. */
export const SprintFalseStart = 1;
/** A runner pulls a hamstring and limps home. Side: the lane. State: the time they were on for. */
export const SprintHamstring = 2;
/**
 * A runner drifts into the next lane and clips the runner there, who goes down (an Injury just after). Side: the
 * lane that drifts. Extra: the lane that falls. State: the time the drifter was on for.
 */
export const SprintCollision = 3;

/**
 * CMUSports.Sprint. Times are in hundredths from the gun and include the reaction. A runner who falls (an Injury:
 * extra how bad, state the time they were on for), pulls up or gets tangled loses time but still finishes at their
 * score; it is never the winner. The random calls are the C#'s, in its order.
 */
export function playSprint(random, lanes, winner) {
  const play = { events: [], score: new Array(lanes).fill(0), result: '' };
  const best = roundEven(f(range(random, 9.6, 10.4) * 100));
  for (let lane = 0; lane < lanes; lane++) play.score[lane] = lane === winner ? best : best + 5 + random.next(110);

  const reaction = new Array(lanes).fill(0);
  for (let lane = 0; lane < lanes; lane++) {
    reaction[lane] = 120 + random.next(90);
    play.events.push(ev(SprintStart + f(reaction[lane] / 1000), Action.Special, lane, SprintReaction, reaction[lane]));
  }

  if (random.nextDouble() < 0.3) {
    const jumper = random.next(lanes);
    play.events.push(ev(range(random, 4.7, 5.6), Action.Special, jumper, SprintFalseStart));
  }

  const losers = [];
  for (let lane = 0; lane < lanes; lane++) if (lane !== winner) losers.push(lane);

  const mishap = random.next(100);
  if (mishap >= 35 && losers.length > 0) {
    if (mishap < 65) {
      const lane = losers[random.next(losers.length)];
      const into = 0.3 + random.nextDouble() * 0.4;
      sprintFall(random, play, lane, sprintOn(play, reaction, lane, into));
    } else if (mishap < 80) {
      const lane = losers[random.next(losers.length)];
      const into = 0.25 + random.nextDouble() * 0.35;
      const time = sprintOn(play, reaction, lane, into);
      play.events.push(ev(time, Action.Special, lane, SprintHamstring, 0, play.score[lane]));
      play.score[lane] += 200 + random.next(150);
    } else {
      // neighbours, neither of them the winner: the slower one drifts into the faster one's heels
      const pairs = [];
      for (let lane = 0; lane + 1 < lanes; lane++) if (lane !== winner && lane + 1 !== winner) pairs.push(lane);
      if (pairs.length > 0) {
        const pair = pairs[random.next(pairs.length)];
        const faller = play.score[pair + 1] < play.score[pair] ? pair + 1 : pair;
        const drifter = faller === pair ? pair + 1 : pair;
        const into = 0.3 + random.nextDouble() * 0.35;
        const time = sprintOn(play, reaction, faller, into);
        play.events.push(ev(time, Action.Special, drifter, SprintCollision, faller, play.score[drifter]));
        sprintFall(random, play, faller, time + 0.04);
        play.score[drifter] += 30 + random.next(40);
      }
    }
  }

  for (let lane = 0; lane < lanes; lane++) {
    const time = play.score[lane];
    play.events.push(ev(SprintStart + f(time / 100), Action.Finish, lane, time));
  }

  play.result = `${f(best / 100).toFixed(2)}s`;
  return play;
}

/** Seconds from kickoff when a lane is into of its way through its race, in doubles like the C#. */
function sprintOn(play, reaction, lane, into) {
  return SprintStart + reaction[lane] / 1000 + into * (play.score[lane] / 100 - reaction[lane] / 1000);
}

/** A runner goes down face first: the worse the fall, the longer on the track. */
function sprintFall(random, play, lane, time) {
  const severity = 1 + random.next(3);
  play.events.push(ev(time, Action.Injury, lane, 0, severity, play.score[lane]));
  play.score[lane] += 130 + severity * 30 + random.next(60);
}

// ---------------------------------------------------------------- the arena

const TrackTop = 70;
const Lane = 26;
/** Where the feet meet the track, from the top of a lane. */
const Ground = 20;
const StartLine = 116;
const Blocks = StartLine - 22;
const Behind = StartLine - 28;
const FinishLine = 470;
/** Feet at the line when the chest is on it. */
const FinishFeet = FinishLine - 8;
/** From a doll's centre to its feet, at scale 1. */
const Body = 15;
const Stride = 11;
/** How long a sprinter takes to reach top speed, as a share of the race. */
const Accel = 0.13;
const Stumble = 0.2;
const GetUp = 0.5;
const Brake = 1.15;

const BoardX = 84;
const BoardY = 203;
const Column = 66;
const ScreenX = 198;
const ScreenY = 27;
const ScreenW = 124;
const ScreenH = 38;
const PhotoX = 140;
const PhotoY = 74;
const PhotoW = 170;
const PhotoH = 124;
const PhotoShow = 2.8;
const CloseFinish = 0.1;
const RecordTime = 970;
const StarterX = 44;
const StarterY = 216;

const CurveNorm = 1 - Accel * (1 - Math.exp(-1 / Accel));
const PISTOL = 'Objects/Weapons/Guns/Pistols/viper.rsi';
const TAU = Math.PI * 2;

const Gunshot = '/Audio/_RMC14/Weapons/Guns/Gunshots/gun_m1984_1.ogg';
const Recall = '/Audio/_RMC14/Weapons/Guns/Gunshots/gun_m1984_2.ogg';
const Cock = '/Audio/_RMC14/Weapons/Guns/Cock/gun_pistol_cocked.ogg';
const Marks = '/Audio/Items/Whistle/whistle_1.ogg';
const Beam = '/Audio/Machines/quickbeep.ogg';
const Camera = '/Audio/Misc/camera_snap.ogg';
const CheerSmall = '/Audio/CMU14/PersonalComputers/Games/crowd_cheer_small.ogg';
const Fall = '/Audio/CMU14/PersonalComputers/Games/fall.ogg';
const Slap = '/Audio/Effects/Footsteps/meatslap.ogg';
const SighMale = '/Audio/Voice/Human/male_sigh.ogg';
const SighFemale = '/Audio/Voice/Human/female_sigh.ogg';
const Claps = ['/Audio/Effects/Emotes/clap1.ogg', '/Audio/Effects/Emotes/clap2.ogg', '/Audio/Effects/Emotes/clap3.ogg', '/Audio/Effects/Emotes/clap4.ogg'];
const Whistles = ['/Audio/Voice/Human/whistle_1.ogg', '/Audio/Voice/Human/whistle_2.ogg', '/Audio/Voice/Human/whistle_3.ogg', '/Audio/Voice/Human/whistle_4.ogg'];
const Gasps = [
  '/Audio/Effects/Gasp/gasp_male1.ogg', '/Audio/Effects/Gasp/gasp_male2.ogg', '/Audio/Effects/Gasp/gasp_female1.ogg',
  '/Audio/Effects/Gasp/gasp_female2.ogg', '/Audio/Effects/Gasp/gasp_female3.ogg',
];
const Steps = ['/Audio/Effects/Footsteps/grass1.ogg', '/Audio/Effects/Footsteps/grass2.ogg', '/Audio/Effects/Footsteps/grass3.ogg', '/Audio/Effects/Footsteps/grass4.ogg'];
const Splashes = ['/Audio/Effects/Fluids/blood1.ogg', '/Audio/Effects/Fluids/blood2.ogg'];
/** The big cheers are long: one plays per race, at the winner, and runs out by itself. */
const Cheers = ['/Audio/CMU14/PersonalComputers/Games/crowd_cheer_1.ogg', '/Audio/CMU14/PersonalComputers/Games/crowd_cheer_2.ogg'];
const Swooshes = [
  '/Audio/CMU14/PersonalComputers/Games/swoosh_1.ogg', '/Audio/CMU14/PersonalComputers/Games/swoosh_2.ogg',
  '/Audio/CMU14/PersonalComputers/Games/swoosh_3.ogg',
];
const Pops = ['/Audio/Effects/Emotes/snap1.ogg', '/Audio/Effects/Emotes/snap2.ogg', '/Audio/Effects/Emotes/snap3.ogg'];

const TRACK = '#B5482F';
const TRACK_GRAIN = '#9F3C26';
const GRASS = '#2E5A2A';
const GRASS_STRIPE = '#346732';
const DUST = '#D08A68';
const SWEAT = '#CFEFFF';
const SMOKE = '#C8C8C8';
const AMBER = '#FFB000';
const GOLD = '#FFD24A';
const SILVER = '#D6DCE4';
const BRONZE = '#D9944A';
const ALARM = '#FF4A3A';
const WHITE = '#FFFFFF';

const SKINS = ['#F1C27D', '#E0AC69', '#C68642', '#8D5524', '#FFDBAC', '#5C3A21'];
const SHIRTS = ['#E04040', '#4080FF', '#40C060', '#F0D040', '#F09030', '#A060E0', '#DDDDDD', '#555A66', '#2E3440', '#7A4A2A'];
const FLAGS = [34, 150, 372, 478];

const Mishap = { None: 0, Fall: 1, Hamstring: 2, Stagger: 3 };

/** A hex colour (#RRGGBB) with an alpha, as CSS. */
function alpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

function dim(hex, shade) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round((n >> 16) * shade)},${Math.round(((n >> 8) & 255) * shade)},${Math.round((n & 255) * shade)})`;
}

const lerp = (a, b, k) => a + (b - a) * k;

function smooth(k) {
  k = clamp(k, 0, 1);
  return k * k * (3 - 2 * k);
}

function easeOut(k) {
  k = clamp(k, 0, 1);
  return 1 - (1 - k) * (1 - k);
}

function rotate([x, y], angle) {
  const sin = Math.sin(angle), cos = Math.cos(angle);
  return [x * cos - y * sin, x * sin + y * cos];
}

/** A small seeded generator for the fixed crowd and track grain, the C#'s LCG over uint. */
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s;
  };
}

const CROWD = (() => {
  const fans = [];
  const step = lcg(0x5EED);
  const next = () => (step() >>> 8) / 16777216;
  for (let row = 0; row < 3; row++) {
    const shade = 0.7 + row * 0.15;
    for (let x = 4 + (row % 2) * 4; x < ArenaWidth; x += 8.5 + next() * 2) {
      if (x > ScreenX - 6 && x < ScreenX + ScreenW + 6) continue;
      const skin = SKINS[Math.trunc(next() * SKINS.length) % SKINS.length];
      const shirt = SHIRTS[Math.trunc(next() * SHIRTS.length) % SHIRTS.length];
      fans.push({
        x, y: 41 + row * 8 + next(), skin: dim(skin, shade), shirt: dim(shirt, shade), phase: next() * TAU, speed: next() * 3,
        arms: next(), size: 2.6 + row * 0.3,
      });
    }
  }
  return fans;
})();

const GRAIN = (() => {
  const step = lcg(0x7A11);
  const grain = [];
  for (let i = 0; i < 90; i++) {
    const x = (step() >>> 8) % ArenaWidth;
    const y = (step() >>> 8) % 130;
    grain.push([x, y]);
  }
  return grain;
})();

/** The sprinter's distance curve: from nothing in the blocks to top speed, then holding it. */
function curve(u) {
  u = clamp(u, 0, 1);
  return (u - Accel * (1 - Math.exp(-u / Accel))) / CurveNorm;
}

function slope(u) {
  u = clamp(u, 0, 1);
  return (1 - Math.exp(-u / Accel)) / CurveNorm;
}

/** How far down the track a runner is, 0 to 1, run seconds after the gun. */
function progress(r, run) {
  if (run <= r.reaction) return 0;
  if (run >= r.finish) return 1;
  if (r.mishap === Mishap.None || run < r.at) return curve((run - r.reaction) / Math.max(0.5, r.base - r.reaction));
  const u = run - r.at;
  let s;
  if (r.mishap === Mishap.Fall) {
    if (u < Stumble) {
      s = r.atS + r.atV * u;
    } else if (u < Stumble + r.slide) {
      const w = u - Stumble;
      s = r.atS + r.atV * (Stumble + w - w * w * w / (3 * r.slide * r.slide));
    } else if (run < r.recoverAt) {
      s = r.recoverS;
    } else {
      s = r.recoverS + (1 - r.recoverS) * curve((run - r.recoverAt) / Math.max(0.1, r.finish - r.recoverAt));
    }
  } else if (r.mishap === Mishap.Hamstring) {
    if (run < r.recoverAt) {
      s = r.atS + r.atV * (u - 0.65 * u * u);
    } else {
      const limp = run - r.recoverAt;
      s = r.recoverS + r.limpSpeed * (limp - 0.12 * r.limpPeriod / TAU * Math.sin(TAU * limp / r.limpPeriod));
    }
  } else if (run < r.recoverAt) {
    s = r.atS + r.atV * (u - 0.6875 * u * u);
  } else {
    const w = run - r.recoverAt;
    const span = Math.max(0.1, r.finish - r.recoverAt);
    const rest = 1 - r.recoverS;
    s = r.recoverS + r.recoverV * w + (rest - r.recoverV * span) * curve(w / span);
  }
  return clamp(s, 0, 1);
}

/** Where a runner's feet are, carrying on past the line and slowing down after it. */
function feetX(r, run) {
  if (run >= r.finish) return FinishFeet + r.endSpeed / Brake * (1 - Math.exp(-Brake * (run - r.finish)));
  return Blocks + progress(r, run) * (FinishFeet - Blocks);
}

/** When a runner gets share of the way down the track, after the gun. */
function reach(r, share) {
  let low = r.reaction, high = r.finish;
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    if (progress(r, mid) >= share) high = mid;
    else low = mid;
  }
  return high;
}

/** Works out the phases of a runner's mishap so they get back up in time to finish at their score. */
function settle(r) {
  if (r.mishap !== Mishap.None) {
    const span = Math.max(1, r.base - r.reaction);
    const into = clamp((r.at - r.reaction) / span, 0, 1);
    r.atS = curve(into);
    r.atV = slope(into) / span;
    if (r.mishap === Mishap.Fall) {
      r.slide = 1.2 + 0.2 * r.severity;
      r.recoverS = r.atS + r.atV * (Stumble + 2 * r.slide / 3);
      // no faster than a fresh sprinter once back up: lie there for what is left over
      const need = (1 - r.recoverS) * span / 1.12;
      const down = r.at + Stumble + r.slide;
      const lie = clamp(r.finish - need - GetUp - down, 0.35, 3);
      r.recoverAt = Math.min(down + lie + GetUp, r.finish - 0.5);
      r.upAt = r.recoverAt - GetUp;
    } else if (r.mishap === Mishap.Hamstring) {
      r.recoverAt = r.at + 0.5;
      r.recoverS = r.atS + r.atV * 0.3375;
      const limp = Math.max(0.5, r.finish - r.recoverAt);
      const steps = Math.max(1, Math.round(limp / 0.42));
      r.limpPeriod = limp / steps;
      r.limpSpeed = (1 - r.recoverS) / limp;
    } else {
      r.recoverAt = r.at + 0.4;
      r.recoverS = r.atS + r.atV * 0.29;
      r.recoverV = 0.45 * r.atV;
      const rest = 1 - r.recoverS;
      const left = Math.max(0.5, r.finish - r.recoverAt);
      if (rest - r.recoverV * left < 0.1 * rest) r.recoverV = 0.9 * rest / left;
    }
  }
  r.endSpeed = (feetX(r, r.finish - 0.001) - feetX(r, r.finish - 0.051)) / 0.05;
}

function newRunner(score, isFemale) {
  return {
    score, reaction: 0.15, finish: score / 100, base: score / 100, mishap: Mishap.None, at: 0, severity: 1, into: -1, slide: 1.1,
    atS: 0, atV: 0, upAt: 0, recoverAt: 0, recoverS: 0, recoverV: 0, limpSpeed: 0, limpPeriod: 1, endSpeed: 0, split: NaN,
    rank: 1, female: isFemale,
  };
}

const groundY = lane => TrackTop + Lane * lane + Ground;

/** The doll's centre for a stance: the body pivots on its feet, so a lean tips it forward. */
function centreOf(stance, ground) {
  const angle = stance.lean * Math.PI / 180;
  return [stance.x + Body * Math.sin(angle), ground + stance.swerve - Body * Math.cos(angle) - stance.lift];
}

const rankColour = rank => (rank === 1 ? GOLD : rank === 2 ? SILVER : rank === 3 ? BRONZE : WHITE);

export class SprintArena extends Arena {
  build(match) {
    this.lanes = match.entrants.length;
    this.runners = [];
    this.stance = [];
    this.snap = [];
    this.centre = [];
    this.dust = [];
    this.sweat = [];
    this.drip = [];
    this.smear = [];
    this.pool = [];
    this.names = [];
    this.board = [];
    this.boardStage = [];
    this.ranks = [];
    this.planned = null;
    this.racing = false;
    this.falseLane = -1;
    this.falseAt = NaN;
    this.winner = 0;
    this.winAt = Infinity;
    this.roarAt = Infinity;
    this.photoClose = false;
    this.record = false;
    this.time = -1;
    this.prev = NaN;
    this.clockTime ??= 0;
    this.excite = 0.3;
    this.step = 0;
    this.boardAlpha = 1;
    this.photoAge = -1;
    this.lastReal = 0;
    for (let lane = 0; lane < this.lanes; lane++) {
      this.runners.push(newRunner(1000, false));
      this.stance.push({ x: 0, lift: 0, lean: 0, swerve: 0, speed: 0, dir: Dir.East, prone: false });
      this.centre.push([0, 0]);
      this.dust.push(0);
      this.sweat.push(0);
      this.drip.push(0);
      this.smear.push(NaN);
      this.pool.push(0);
      this.names.push(shortName(matchName(match, lane)).slice(0, 9));
      this.board.push('');
      this.boardStage.push(-1);
      this.ranks.push('');
      this.addDoll('Runner', kitColour(match.sport, lane, match.entrants[lane]), 1);
    }
    // the starter, in the officials' white
    this.addDoll('Runner', 6, 1);
    this.preload(Gunshot, Recall, Cock, Marks, Beam, Camera, CheerSmall, Fall, Slap, SighMale, SighFemale,
      Cheers, Swooshes, Claps, Whistles, Gasps, Steps, Splashes, Pops);
  }

  // ---------------------------------------------------------------- the plan

  /** Reads the match's events into each lane's race: reactions, the false start, falls, the order home. */
  plan(match, play) {
    this.planned = `${match.id}|${match.seed}|${match.winner}`;
    this.racing = true;
    this.falseLane = -1;
    this.falseAt = NaN;
    for (let lane = 0; lane < this.lanes; lane++) {
      const score = lane < play.score.length ? play.score[lane] : 1000;
      this.runners[lane] = newRunner(score, female(match.sport, match.entrants[lane]));
    }

    for (const e of play.events) {
      if (e.side < 0 || e.side >= this.lanes) continue;
      const r = this.runners[e.side];
      const at = e.time - SprintStart;
      if (e.action === Action.Injury) {
        Object.assign(r, { mishap: Mishap.Fall, at, severity: clamp(e.extra, 1, 3), base: e.state / 100 });
        continue;
      }
      if (e.action !== Action.Special) continue;
      if (e.value === SprintReaction) r.reaction = e.extra / 1000;
      else if (e.value === SprintFalseStart) {
        this.falseLane = e.side;
        this.falseAt = e.time;
      } else if (e.value === SprintHamstring) Object.assign(r, { mishap: Mishap.Hamstring, at, base: e.state / 100 });
      else if (e.value === SprintCollision) Object.assign(r, { mishap: Mishap.Stagger, at, base: e.state / 100, into: e.extra });
    }

    for (const r of this.runners) settle(r);

    this.winner = clamp(match.winner, 0, this.lanes - 1);
    this.winAt = this.runners[this.winner].finish;
    let second = Infinity;
    for (let lane = 0; lane < this.lanes; lane++) {
      const r = this.runners[lane];
      if (lane !== this.winner) second = Math.min(second, r.finish);
      r.rank = 1;
      for (let other = 0; other < this.lanes; other++) {
        const them = this.runners[other];
        if (them.score < r.score || (them.score === r.score && other < lane)) r.rank++;
      }
      r.split = reach(r, 0.5);
      this.ranks[lane] = T.rank(r.rank);
    }

    this.photoClose = second - this.winAt <= CloseFinish;
    this.record = this.runners[this.winner].score <= RecordTime;

    // the crowd gets up when someone opens a gap, or anyway as the line comes
    this.roarAt = this.winAt - 1.2;
    for (let run = 0.5; run < this.winAt; run += 0.05) {
      let first = 0, next = 0;
      for (const r of this.runners) {
        const s = progress(r, run);
        if (s > first) {
          next = first;
          first = s;
        } else if (s > next) {
          next = s;
        }
      }
      if (first >= 0.35 && first - next >= 0.045) {
        this.roarAt = run;
        break;
      }
    }

    for (let lane = 0; lane < this.lanes; lane++) this.snap[lane] = this.stanceAt(lane, SprintStart + this.winAt);
  }

  // ---------------------------------------------------------------- poses

  /** A lane's stance t seconds from kickoff. */
  stanceAt(lane, t) {
    const r = this.runners[lane];
    const run = t - SprintStart;
    const stance = { x: 0, lift: 0, lean: 0, swerve: 0, speed: 0, dir: Dir.East, prone: false };
    if (run < r.reaction) {
      this.waiting(lane, t, stance);
      return stance;
    }

    const x = feetX(r, run);
    stance.x = x;
    stance.speed = (x - feetX(r, run - 0.04)) / 0.04;
    const phase = x / Stride * Math.PI;
    const pace = clamp(stance.speed / 36, 0, 1);
    const since = run - r.reaction;
    stance.lean = lerp(58, 11, easeOut(since / 1.6)) + 3 * Math.sin(phase) * pace;
    stance.lift = Math.abs(Math.sin(phase)) * 2.2 * pace;
    if (run >= r.finish) {
      this.finished(lane, run - r.finish, stance);
      return stance;
    }

    // the dip for the line
    const left = r.finish - run;
    if (left < 0.15) stance.lean += 24 * (1 - left / 0.15);
    if (run < r.at - 0.3 || r.mishap === Mishap.None) return stance;

    const u = run - r.at;
    if (r.mishap === Mishap.Fall && u >= 0) {
      if (u < Stumble) {
        const k = u / Stumble;
        stance.lean = 12 + 78 * k * k;
        stance.lift = Math.sin(k * Math.PI) * 3;
      } else if (run < r.upAt) {
        stance.lean = 90;
        stance.prone = true;
        const w = u - Stumble;
        stance.lift = w < 0.2 ? Math.sin(w / 0.2 * Math.PI) * 2.5 : 0;
      } else if (run < r.recoverAt) {
        const k = smooth((run - r.upAt) / GetUp);
        stance.lean = lerp(90, 48, k);
        stance.lift = 0;
        stance.prone = k < 0.5;
      } else {
        stance.lean = lerp(48, 11, easeOut((run - r.recoverAt) / 1.1)) + 3 * Math.sin(phase) * pace;
      }
    } else if (r.mishap === Mishap.Hamstring && u >= 0) {
      if (run < r.recoverAt) {
        stance.lean = 11 + 22 * Math.sin(Math.PI * u / 0.5);
        stance.lift = 0;
      } else {
        // a hop on the good leg, a shuffle on the bad one
        const step = (run - r.recoverAt) / r.limpPeriod;
        const hop = Math.abs(Math.sin(Math.PI * step));
        stance.lean = 6 + 7 * hop;
        stance.lift = hop * (Math.trunc(step) % 2 === 0 ? 3.5 : 1.2);
      }
    } else if (r.mishap === Mishap.Stagger) {
      const sign = r.into > lane ? 1 : -1;
      const drift = u < 0 ? smooth((u + 0.3) / 0.3) : 1 - smooth(u / 0.7);
      stance.swerve = sign * 13 * drift;
      if (u >= 0) stance.lean += 16 * Math.sin(u * 22) * Math.exp(-3 * u);
    }
    return stance;
  }

  /** Before the gun: behind the blocks, down on the marks, hips up at set, and the false start if there is one. */
  waiting(lane, t, stance) {
    const bounce = Math.abs(Math.sin(t * 4 + lane * 1.7)) * 1.4;
    const stepIn = smooth((t - 2.8) / 0.4);
    let x = lerp(Behind, Blocks, stepIn);
    let lift = bounce * (1 - stepIn);
    let crouch = smooth((t - 3.2) / 0.5) + smooth((t - 4) / 0.35);
    let lean = NaN;
    if (!Number.isNaN(this.falseAt) && t >= this.falseAt) {
      const u = t - this.falseAt;
      if (u < 1.3) {
        if (lane === this.falseLane) {
          crouch = 0;
          if (u < 0.6) {
            // out of the blocks before the gun, then pulling up at the recall
            x = Blocks + 16 * easeOut(u / 0.45);
            lean = lerp(50, 0, smooth(u / 0.6));
            lift = 0;
          } else {
            const back = smooth((u - 0.6) / 0.7);
            x = lerp(Blocks + 16, Behind, back);
            lift = Math.abs(Math.sin(u * 10)) * 1.2;
            stance.dir = back < 0.95 ? Dir.West : Dir.East;
          }
        } else {
          crouch = 2 * (1 - smooth((u - 0.35) / 0.3));
          x = lerp(Blocks, Behind, smooth((u - 0.45) / 0.5));
          lift = 0;
        }
      } else {
        const again = smooth((u - 1.3) / 0.25);
        x = lerp(Behind, Blocks, again);
        lift = bounce * (1 - again);
        crouch = smooth((u - 1.5) / 0.3) + smooth((u - 1.9) / 0.3);
      }
    }

    if (Number.isNaN(lean)) {
      if (crouch <= 1) {
        lean = 72 * crouch;
        lift = lerp(lift, -3, crouch);
      } else {
        lean = 72 - 14 * (crouch - 1);
        lift = lerp(-3, 0, crouch - 1);
      }
      // nerves in the set position
      if (crouch > 1.9) lift += Math.sin(t * 47 + lane * 2.3) * 0.35;
    }
    stance.x = x;
    stance.lean = lean;
    stance.lift = lift;
  }

  /** Past the line: the winner jumps and turns to the crowd, the rest bend over, hands on knees. */
  finished(lane, u, stance) {
    stance.lean = Math.max(0, 35 * (1 - u / 0.35));
    stance.lift *= Math.max(0, 1 - u);
    if (lane === this.winner) {
      if (u > 0.9 && u < 2.7) stance.lift = Math.abs(Math.sin((u - 0.9) * 6.5)) * 6;
      if (u >= 2.9) {
        stance.dir = Dir.South;
        stance.lift = Math.abs(Math.sin(u * 3)) * 1.5;
      }
      return;
    }
    if (u > 1.1) {
      stance.lean = 26 * smooth((u - 1.1) / 0.5) + Math.sin(u * 5 + lane) * 1.2;
      stance.lift = 0;
    }
  }

  // ---------------------------------------------------------------- the frame

  updateMatch(match, play, t) {
    if (play != null && this.planned !== `${match.id}|${match.seed}|${match.winner}`) this.plan(match, play);

    const real = performance.now();
    const delta = this.lastReal ? clamp((real - this.lastReal) / 1000, 0, 0.1) : 0;
    this.lastReal = real;
    this.clockTime += delta;
    this.time = t;
    if (Number.isNaN(this.prev) || t < this.prev) this.prev = t;

    const racing = play != null && this.racing;
    const run = t - SprintStart;
    const intro = Math.trunc(this.clockTime / 1.6) % Math.max(1, this.lanes);
    for (let lane = 0; lane < this.lanes; lane++) {
      // before the off the lineup waits, and each runner in turn waves to the camera
      const stance = racing
        ? this.stanceAt(lane, t)
        : {
          x: Behind, lift: Math.abs(Math.sin(this.clockTime * 4 + lane * 1.7)) * 1.4, lean: 0, swerve: 0, speed: 0,
          dir: lane === intro ? Dir.South : Dir.East, prone: false,
        };
      this.stance[lane] = stance;
      const centre = centreOf(stance, groundY(lane));
      this.centre[lane] = centre;
      this.pose(lane, centre[0], centre[1], stance.dir, -stance.lean);
      this.say(matchName(match, lane), 16, TrackTop + Lane * lane + 6, 'rgba(255,255,255,0.85)');
    }

    this.pose(this.lanes, StarterX, StarterY, Dir.East);
    this.excite = racing ? this.excitement(t, run) : 0.3 + 0.05 * Math.sin(this.clockTime * 0.7);

    this.calls(t, run, racing);
    this.screen(match, t, run, racing, intro);
    this.drawBoard(match, run, racing);
    if (racing) {
      this.cues(run);
      this.effects(run, delta);
      if (run >= 0 && run < this.winAt) this.clock = run.toFixed(2);
      else if (run >= this.winAt && t < sportLength(match.sport)) this.clock = this.winAt.toFixed(2);
      for (let lane = 0; lane < this.lanes; lane++) {
        const r = this.runners[lane];
        if (run >= r.finish + 0.3) this.say(this.ranks[lane], FinishLine - 4, TrackTop + Lane * lane + 2, rankColour(r.rank), false, true);
      }
    }

    this.photoAge = racing ? run - this.winAt - 0.05 : -1;
    if (this.photoAge >= 0 && this.photoAge < PhotoShow) this.photoText(match);
    this.prev = t;
  }

  // ---------------------------------------------------------------- calls, screens and the board

  calls(t, run, racing) {
    const x = ArenaWidth / 2;
    const y = 136;
    if (!racing) return;
    const falseStart = !Number.isNaN(this.falseAt);
    if (t >= 0.3 && t < 3.9) this.say(T.marks, x, y, WHITE, true);
    else if (t >= 4 && t < 5.6 && (!falseStart || t < this.falseAt)) this.say(T.set, x, y, WHITE, true);
    else if (falseStart && t >= this.falseAt && t < this.falseAt + 1.5) this.say(T.falseStart, x, y, ALARM, true);
    else if (falseStart && t >= this.falseAt + 1.9 && t < Math.min(this.falseAt + 3, 7.6)) this.say(T.set, x, y, WHITE, true);
    else if (run >= 0 && run < 0.7) this.say(T.go, x, y, '#00FF00', true);
  }

  /** The big screen in the stands: the field before the off, the race clock, the split, the winning time. */
  screen(match, t, run, racing, intro) {
    const middle = ScreenX + ScreenW / 2;
    const big = ScreenY + 12;
    const small = ScreenY + 24;
    if (!racing || run < 0) {
      this.say(T.title, middle, big, AMBER, true);
      const lane = racing ? Math.trunc(Math.max(0, t) / 1.6) % Math.max(1, this.lanes) : intro;
      this.say(T.intro(lane + 1, this.names[lane]), ScreenX + 5, small, kitCss(match, lane));
      return;
    }

    if (run < this.winAt) {
      this.say(run.toFixed(2), middle, big, AMBER, true);
      let leader = 0;
      let split = Infinity;
      for (let lane = 0; lane < this.lanes; lane++) {
        if (this.stance[lane].x > this.stance[leader].x) leader = lane;
        split = Math.min(split, this.runners[lane].split);
      }
      if (run >= split && run < split + 2.5) this.say(T.split(split.toFixed(2)), ScreenX + 5, small, WHITE);
      else this.say(T.lead(this.names[leader]), ScreenX + 5, small, kitCss(match, leader));
      return;
    }

    const blink = run - this.winAt < 3 && this.clockTime % 0.5 < 0.18;
    if (!blink) this.say(this.winAt.toFixed(2), middle, big, GOLD, true);
    const record = this.record && this.clockTime % 1.6 < 0.8;
    this.say(record ? T.record : this.names[this.winner], ScreenX + 5, small, record ? ALARM : kitCss(match, this.winner));
  }

  /** The split board in the infield: each lane's reaction, then its 50 m split, then its place and time. */
  drawBoard(match, run, racing) {
    const length = sportLength(match.sport);
    this.boardAlpha = racing ? clamp((length - SprintStart - run) / 0.6, 0, 1) : 1;
    if (this.boardAlpha <= 0) return;
    for (let lane = 0; lane < this.lanes; lane++) {
      const x = BoardX + lane * Column + 6;
      this.say(this.names[lane], x, BoardY + 2, alpha(kitCss(match, lane), this.boardAlpha));
      const r = this.runners[lane];
      let stage;
      if (!racing || run < r.reaction) stage = 0;
      else if (run >= r.finish) stage = 4;
      else if ((r.mishap === Mishap.Fall || r.mishap === Mishap.Hamstring) && run >= r.at && run < r.recoverAt + 0.6) stage = 3;
      else if (run >= r.split) stage = 2;
      else stage = 1;

      if (stage !== this.boardStage[lane]) {
        this.boardStage[lane] = stage;
        this.board[lane] = stage === 0 ? T.lane(lane + 1)
          : stage === 1 ? T.reaction(r.reaction.toFixed(3))
            : stage === 2 ? T.split(r.split.toFixed(2))
              : stage === 3 ? (r.mishap === Mishap.Fall ? T.down : T.hurt)
                : T.place(r.rank, r.finish.toFixed(2));
      }
      let colour;
      if (stage === 3) colour = alpha(ALARM, (this.clockTime % 0.6 < 0.4 ? 1 : 0.35) * this.boardAlpha);
      else if (stage === 4) colour = alpha(rankColour(r.rank), this.boardAlpha);
      else if (stage === 0) colour = alpha(WHITE, 0.5 * this.boardAlpha);
      else colour = alpha(WHITE, this.boardAlpha);
      this.say(this.board[lane], x, BoardY + 17, colour);
    }
  }

  photoText(match) {
    this.say(this.photoClose ? T.photo : T.finishCam, PhotoX + 6, PhotoY + 3, this.photoClose ? GOLD : WHITE);
    const row = (PhotoH - 22) / Math.max(1, this.lanes);
    for (let lane = 0; lane < this.lanes; lane++) {
      const y = PhotoY + 20 + row * lane + row / 2 - 7;
      this.say(`${lane + 1}`, PhotoX + 5, y, kitCss(match, lane));
      const gap = this.runners[lane].finish - this.winAt;
      if (lane === this.winner) this.say(this.winAt.toFixed(2), PhotoX + 16, y, GOLD);
      else if (gap < 1.5) this.say(`+${gap.toFixed(2)}`, PhotoX + 16, y, WHITE);
    }
  }

  // ---------------------------------------------------------------- sound and effects

  /** True once, on the frame a moment of the match passes while someone is watching. */
  cue(at) {
    return this.live && this.prev < at && at <= this.time && this.time - at < 0.5;
  }

  cues(run) {
    if (this.cue(0.5)) this.sound(Marks, -10);
    if (this.cue(4)) this.sound(Cock, -3);
    if (!Number.isNaN(this.falseAt)) {
      if (this.cue(this.falseAt + 0.3)) this.shot(Recall);
      if (this.cue(this.falseAt + 0.5)) this.shot(Gunshot);
      if (this.cue(this.falseAt + 1) && this.falseLane >= 0) this.sound(this.runners[this.falseLane].female ? SighFemale : SighMale, -2);
      if (this.cue(this.falseAt + 1.9)) this.sound(Cock, -3);
    }
    if (this.cue(SprintStart)) {
      this.shot(Gunshot);
      this.shake(1.2, 0.2);
    }
    if (this.cue(SprintStart + 0.5)) this.soundAny(Claps, -8);
    if (this.cue(SprintStart + this.roarAt)) {
      this.sound(CheerSmall, -2);
    }

    const won = SprintStart + this.winAt;
    if (this.cue(won + 0.15)) this.soundAny(Cheers, 0, 0);
    if (this.cue(won + 0.3)) this.sound(Camera, -2, 1.15);
    if (this.cue(won + 0.9)) this.soundAny(Whistles, -5);
    if (this.record && this.cue(won + 0.8)) this.pop(T.record, ScreenX + ScreenW / 2, ScreenY + ScreenH + 14, ALARM, true, 1.6, 10);

    for (let lane = 0; lane < this.lanes; lane++) {
      const r = this.runners[lane];
      const at = SprintStart + r.at;
      // the whoosh of the dip for the line
      if (this.cue(SprintStart + r.finish - 0.12)) this.soundAny(Swooshes, -7);
      if (r.mishap === Mishap.Fall) {
        if (this.cue(at + Stumble)) this.impact(lane, r);
        if (this.cue(at + Stumble + 0.12)) this.soundAny(Swooshes, -1);
        if (this.cue(at + 0.45)) this.soundAny(Gasps, -6);
      } else if (r.mishap === Mishap.Hamstring && this.cue(at + 0.35)) {
        this.soundAny(Gasps, -6);
      }
    }
  }

  /** The pistol goes off: a crack, a flash at the muzzle and a curl of smoke. */
  shot(sound) {
    this.sound(sound);
    const { muzzle } = this.gun(this.time);
    this.burst(muzzle[0], muzzle[1], 10, alpha(SMOKE, 0.55), 22, { life: 1.3, size: 3.2, direction: -Math.PI / 2, spread: 1.3, gravity: -30, drag: 1.4 });
    this.burst(muzzle[0], muzzle[1], 6, '#FFE08A', 90, { life: 0.12, size: 1.4, direction: -1.2, spread: 0.9, streak: true });
  }

  /** The face meets the track: the thud, the spray, the camera shake. */
  impact(lane, r) {
    const ground = groundY(lane);
    const [hx, hy] = this.head(lane);
    this.sound(Fall);
    this.sound(Slap, -2);
    this.soundAny(Splashes, -4);
    this.bleed(hx, hy, ground + 1, r.severity, -Math.PI / 2 + 0.5, 1.4);
    this.burst(hx - 6, ground, 14, DUST, 60, { life: 0.6, size: 2.6, direction: Math.PI + 0.4, spread: 1.6, gravity: 140, floor: ground + 2 });
    this.shake(1.5 + r.severity * 0.8, 0.35);
    this.flash('rgba(158,11,11,0.15)', 0.2);
  }

  /** Where the head of a lane's doll is now, whichever way it leans. */
  head(lane) {
    const angle = this.stance[lane].lean * Math.PI / 180;
    const [cx, cy] = this.centre[lane];
    return [cx + Math.sin(angle) * 11, cy - Math.cos(angle) * 11];
  }

  effects(run, delta) {
    let moving = 0;
    for (let lane = 0; lane < this.lanes; lane++) {
      const r = this.runners[lane];
      const stance = this.stance[lane];
      const ground = groundY(lane) + stance.swerve;
      const pace = clamp(stance.speed / 36, 0, 1);
      if (stance.speed > 12 && !stance.prone) moving++;

      // dust off the spikes, thickest in the drive out of the blocks
      const since = run - r.reaction;
      const drive = since >= 0 && since < 1.2 ? 1 - since / 1.2 : 0;
      this.dust[lane] += delta * (pace * 9 + drive * 22) * (stance.prone ? 0 : 1);
      while (this.dust[lane] >= 1) {
        this.dust[lane] -= 1;
        this.burst(stance.x - 2, ground, 1, alpha(DUST, 0.8), 40, { life: 0.5, size: 2.4, direction: Math.PI + 0.45, spread: 0.9, gravity: 120, floor: ground + 2 });
      }

      // sweat flicked off at speed
      this.sweat[lane] += delta * pace * 1.6;
      if (this.sweat[lane] >= 1) {
        this.sweat[lane] -= 1;
        const [hx, hy] = this.head(lane);
        this.burst(hx, hy, 2, alpha(SWEAT, 0.8), 45, { life: 0.45, size: 1.3, direction: Math.PI + 0.9, spread: 0.8, gravity: 280, floor: ground });
      }

      if (r.mishap !== Mishap.Fall) continue;
      this.smearOn(lane, r, run);

      // a bloody nose on the way home, worse the harder the fall
      if (run >= r.upAt && run < r.finish + 1) {
        this.drip[lane] += delta * (1.5 + 1.5 * r.severity);
        if (this.drip[lane] >= 1) {
          this.drip[lane] -= 1;
          const [hx, hy] = this.head(lane);
          this.burst(hx + 3, hy + 2, 1, BLOOD, 25, { life: 1.2, size: 1.6 + r.severity * 0.3, direction: Math.PI / 2, spread: 1, gravity: 320, floor: ground, stains: true });
        }
      }
    }

    this.step += delta * moving * 1.4;
    if (this.step >= 1) {
      this.step = 0;
      this.soundAny(Steps, -15, 0.15);
    }

    // camera flashes popping in the stands when the crowd is up
    if (this.excite > 0.75 && this.fxFloat() < delta * 14 * (this.excite - 0.6)) this.cameraFlash();
  }

  cameraFlash() {
    const fan = CROWD[Math.floor(this.fxFloat() * CROWD.length)];
    this.burst(fan.x, fan.y + 2, 1, WHITE, 0, { life: 0.1, size: 3.5 });
  }

  /**
   * Paints the smear behind a face skidding down the track while it skids, then the pool where it stops. While
   * catching up the whole lot is stamped at once.
   */
  smearOn(lane, r, run) {
    if (Number.isNaN(this.smear[lane])) return;
    const ground = groundY(lane);
    const start = feetX(r, r.at + Stumble) + 27;
    const end = feetX(r, r.at + Stumble + r.slide) + 27;
    const face = run >= r.at + Stumble + r.slide ? end : feetX(r, run) + 27;
    while (this.smear[lane] <= face && this.smear[lane] <= end) {
      this.stampSmear(r, start, end, this.smear[lane], ground);
      this.smear[lane] += 3.2;
    }
    const lying = run - (r.at + Stumble + r.slide);
    while (this.pool[lane] < 3 && lying >= 0.1 + this.pool[lane] * 0.4) this.stampPool(lane, r, end, ground);
    if (this.pool[lane] >= 3 && this.smear[lane] > end) this.smear[lane] = NaN;
  }

  /** One step of the smear: the face's, and the knees' and hands' scrape behind it. */
  stampSmear(r, start, end, x, ground) {
    const along = clamp((x - start) / Math.max(1, end - start), 0, 1);
    this.splat(x, ground - 1 + (this.fxFloat() - 0.5) * 2, lerp(8, 4, along) + r.severity * 1.5, this.fxFloat() < 0.3 ? DARK_BLOOD : BLOOD);
    this.splat(x - 19, ground + (this.fxFloat() - 0.5) * 2, lerp(5, 3, along) + r.severity, BLOOD);
  }

  stampPool(lane, r, face, ground) {
    const size = 11 + r.severity * 3 - this.pool[lane] * 2;
    this.splat(face + (this.fxFloat() - 0.5) * 5, ground - 1 + (this.fxFloat() - 0.5) * 2, size, this.pool[lane] === 0 ? BLOOD : DARK_BLOOD);
    this.pool[lane]++;
  }

  onEvent(match, e, index, live) {
    if (this.planned !== `${match.id}|${match.seed}|${match.winner}` && match.winner >= 0) {
      this.plan(match, playMatch(match.sport, match.seed, match.entrants.length, match.winner));
    }
    if (e.side < 0 || e.side >= this.lanes) return;

    const lane = e.side;
    const r = this.runners[lane];
    const ground = groundY(lane);
    const hx = feetX(r, e.time - SprintStart) + 4;
    const hy = ground - 26;
    if (e.action === Action.Injury) {
      const start = feetX(r, r.at + Stumble) + 27;
      this.smear[lane] = start;
      this.pool[lane] = 0;
      if (!live) {
        // nobody saw it go down, but the track did
        const end = feetX(r, r.at + Stumble + r.slide) + 27;
        for (let x = start; x <= end; x += 3.2) this.stampSmear(r, start, end, x, ground);
        while (this.pool[lane] < 3) this.stampPool(lane, r, end, ground);
        this.smear[lane] = NaN;
        return;
      }
      this.scream(r.female);
      this.pop(T.faceplant, hx + 14, ground - 12, ALARM, true, 1.1, 18);
    } else if (e.action === Action.Special && live) {
      if (e.value === SprintReaction) {
        this.burst(Blocks - 2, ground, 10, alpha(DUST, 0.85), 70, { life: 0.6, size: 2.5, direction: Math.PI + 0.3, spread: 1.2, gravity: 160, floor: ground + 2 });
      } else if (e.value === SprintFalseStart) {
        this.soundAny(Gasps, -5);
        this.shake(0.6, 0.15);
      } else if (e.value === SprintHamstring) {
        this.soundAny(Pops, 2, 0.05);
        this.scream(r.female);
        this.shake(1, 0.2);
        this.pop(T.hamstring, hx, hy, '#FF9A3C', false, 1.1, 18);
      } else if (e.value === SprintCollision) {
        this.sound(Fall, -2);
        this.shake(1.6, 0.25);
        this.burst(hx + 6, hy + 6, 8, alpha(SWEAT, 0.8), 60, { life: 0.4, size: 1.5 });
        this.pop(T.tangled, hx - 20, hy - 8, '#FFFF00', false, 1.1, 18);
      }
    } else if (e.action === Action.Finish && live) {
      this.sound(Beam, -7);
      if (lane === match.winner) this.won(match, lane, ground);
    }
  }

  /** The winner breaks the tape: the photo flash, streamers off the stands, the crowd's cameras. */
  won(match, lane, ground) {
    this.sound(Camera);
    this.flash('rgba(255,255,255,0.5)', 0.3);
    this.burst(FinishLine, ground - 16, 14, WHITE, 80, { life: 0.5, size: 1.6, direction: 0, spread: 1.6, gravity: 60 });
    for (const colour of [kitCss(match, lane), GOLD, WHITE]) {
      this.burst(FinishLine - 40, TrackTop - 8, 16, colour, 120, { life: 1.6, size: 2.2, direction: Math.PI / 2, spread: 2.6, gravity: 90, drag: 1.2 });
      this.burst(FinishLine + 30, TrackTop - 8, 12, colour, 110, { life: 1.6, size: 2.2, direction: Math.PI / 2, spread: 2.6, gravity: 90, drag: 1.2 });
    }
    for (let i = 0; i < 10; i++) this.cameraFlash();
  }

  /** How loud the stands are: chatter, a hush for the set, up with the gun, on their feet at the end. */
  excitement(t, run) {
    let level;
    if (t < 4) level = 0.35;
    else if (run < 0) level = !Number.isNaN(this.falseAt) && t >= this.falseAt && t < this.falseAt + 1.2 ? 0.6 : 0.06;
    else if (run < this.roarAt) level = 0.5 + 0.2 * clamp(run / Math.max(1, this.roarAt), 0, 1);
    else if (run < this.winAt) level = 0.9;
    else level = 1 - 0.4 * clamp((run - this.winAt - 3) / 6, 0, 1);
    for (const r of this.runners) {
      if ((r.mishap === Mishap.Fall || r.mishap === Mishap.Hamstring) && run >= r.at && run < r.at + 1.5) level = Math.max(level, 0.85);
    }
    return level;
  }

  /** The starter's pistol: its muzzle and its angle, down at the hip until set, up at the sky for the gun. */
  gun(t) {
    const up = smooth((t - 3.9) / 0.25) * (1 - smooth((t - SprintStart - 1.6) / 0.4));
    const hand = [StarterX + 6 + up, StarterY + 3 - 18 * up];
    const rotation = lerp(1, -1.3, up);
    // the barrel's end on the sprite, from its centre
    const [ox, oy] = rotate([5.6, -3.4], rotation);
    return { muzzle: [hand[0] + ox, hand[1] + oy], rotation };
  }

  // ---------------------------------------------------------------- drawing

  drawField(c) {
    const lanes = Math.max(1, this.lanes ?? 5);
    const bottom = TrackTop + Lane * lanes;
    this.drawStands(c);

    rect(c, 0, TrackTop, ArenaWidth, Lane * lanes, TRACK);
    for (const [x, y] of GRAIN) if (y < Lane * lanes) rect(c, x, TrackTop + y, 2, 1, TRACK_GRAIN);
    for (let i = 0; i <= lanes; i++) rect(c, 0, TrackTop + Lane * i - 1, ArenaWidth, 2, 'rgba(255,255,255,0.8)');
    for (let lane = 0; lane < lanes; lane++) {
      const top = TrackTop + Lane * lane;
      rect(c, 2, top + 7, 11, 13, this.match ? kitCss(this.match, lane) : '#808080');
      // the 50 m mark
      rect(c, (Blocks + FinishFeet) / 2 + 4, top + 1, 2, 5, 'rgba(255,255,255,0.7)');
    }
    rect(c, StartLine - 1, TrackTop, 3, Lane * lanes, WHITE);
    for (let y = 0; y < Math.trunc(Lane * lanes / 5); y++) {
      for (let x = 0; x < 2; x++) rect(c, FinishLine + x * 5, TrackTop + y * 5, 5, 5, (x + y) % 2 === 0 ? WHITE : '#000000');
    }

    rect(c, 0, bottom + 1, ArenaWidth, ArenaHeight - bottom, GRASS);
    for (let x = 0; x < ArenaWidth; x += 52) rect(c, x, bottom + 1, 26, ArenaHeight - bottom, GRASS_STRIPE);

    if (this.boardAlpha > 0) {
      const width = Column * lanes;
      rect(c, BoardX - 3, BoardY - 2, width + 6, 35, alpha('#0B0D10', 0.95 * this.boardAlpha));
      frameRect(c, BoardX - 3, BoardY - 2, width + 6, 35, alpha('#3A4250', this.boardAlpha));
      for (let lane = 0; lane < lanes && this.match; lane++) {
        rect(c, BoardX + lane * Column + 1, BoardY + 2, 2, 27, alpha(kitCss(this.match, lane), this.boardAlpha));
      }
    }
  }

  /** The dome's stands: lights, three rows of fans who stand and cheer with the race, flags, the screen, the boards. */
  drawStands(c) {
    rect(c, 0, Bar, ArenaWidth, TrackTop - Bar, '#171A22');
    rect(c, 0, Bar, ArenaWidth, 6, '#0E1015');
    for (let i = 0; i < 6; i++) {
      const x = 40 + i * 88;
      circle(c, x, Bar + 3, 12, 'rgba(255,244,200,0.06)');
      rect(c, x - 8, Bar + 1, 16, 4, '#FFF4C8');
    }

    const excite = this.excite ?? 0.3;
    const clock = this.clockTime ?? 0;
    for (const fan of CROWD) {
      const bob = Math.max(0, Math.sin(clock * (4 + fan.speed) + fan.phase)) * 3 * excite;
      const y = fan.y - bob;
      rect(c, fan.x - 3.5, y + 2.5, 7, 7, fan.shirt);
      circle(c, fan.x, y, fan.size, fan.skin);
      if (excite <= 0.55 || fan.arms >= (excite - 0.55) * 2.2) continue;
      const wave = Math.sin(clock * 9 + fan.phase) * 1.5;
      line(c, fan.x - 3, y + 3, fan.x - 5 + wave, y - 5, fan.skin);
      line(c, fan.x + 3, y + 3, fan.x + 5 + wave, y - 5, fan.skin);
    }

    if (this.match) {
      for (let i = 0; i < FLAGS.length; i++) {
        const x = FLAGS[i];
        const colour = kitCss(this.match, i % Math.max(1, this.lanes));
        line(c, x, 62, x, 36, '#9AA0A8');
        for (let part = 0; part < 4; part++) {
          const flutter = Math.sin(clock * (5 + excite * 4) + part * 0.9 + i) * (0.6 + part * 0.5) * (0.4 + excite);
          rect(c, x + 1 + part * 3, 36 + flutter, 3, 7, colour);
        }
      }
    }

    // the screen
    rect(c, ScreenX - 3, ScreenY - 1, ScreenW + 6, ScreenH + 2, '#2B2F38');
    rect(c, ScreenX, ScreenY, ScreenW, ScreenH, '#06080A');
    for (let y = 0; y < ScreenH; y += 2) rect(c, ScreenX, ScreenY + y, ScreenW, 1, 'rgba(26,34,48,0.35)');

    // advertising boards along the front of the stands
    rect(c, 0, TrackTop - 7, ArenaWidth, 7, '#0F2A44');
    for (let i = 0; i < 8; i++) {
      rect(c, i * 65 + 2, TrackTop - 6, 61, 5, i % 2 === 0 ? '#1E5F8C' : '#3E7D2A');
      rect(c, i * 65 + 8, TrackTop - 4, 20 + (i * 7) % 24, 1, 'rgba(255,255,255,0.6)');
    }
  }

  drawOverDecals(c) {
    for (let lane = 0; lane < (this.lanes ?? 0); lane++) {
      const ground = groundY(lane);
      const stance = this.stance[lane];
      // the blocks
      rect(c, Blocks - 6, ground - 4, 3, 5, '#8A8F99');
      rect(c, Blocks - 1, ground - 2, 3, 3, '#8A8F99');
      rect(c, Blocks - 7, ground, 11, 1, '#4A4F59');

      const shadow = 'rgba(0,0,0,0.28)';
      const y = ground + stance.swerve;
      if (stance.prone) rect(c, stance.x - 2, y - 1, 32, 3, shadow);
      else rect(c, stance.x - 7 + stance.lean * 0.12, y - 1, 14 - stance.lift, 3, shadow);

      // speed lines at full tilt
      const tilt = clamp((stance.speed - 32) / 12, 0, 1);
      if (tilt <= 0 || stance.prone || !this.match) continue;
      const kit = kitCss(this.match, lane);
      const [cx, cy] = this.centre[lane];
      for (let i = 0; i < 3; i++) {
        const length = (10 + (i % 2) * 8) * tilt;
        const lx = cx - 8, ly = cy - 7 + i * 6;
        line(c, lx - length, ly, lx, ly, alpha(i === 1 ? WHITE : kit, 0.4 * tilt));
      }
    }
    this.drawTape(c);
  }

  /** The finish tape: straight across until the winner breaks it, then two halves blowing out from the posts. */
  drawTape(c) {
    const lanes = Math.max(1, this.lanes ?? 5);
    const top = [FinishLine + 11, TrackTop - 3];
    const bottom = [FinishLine + 11, TrackTop + Lane * lanes + 3];
    const since = this.racing ? this.time - SprintStart - this.winAt : -1;
    if (since < 0 || !this.lanes) {
      line(c, top[0], top[1], bottom[0], bottom[1], 'rgba(255,255,255,0.85)');
      return;
    }
    const breakAt = groundY(this.winner) - 14;
    const fade = clamp(1 - (since - 6) / 2, 0, 1);
    if (fade <= 0) return;
    const blow = Math.min(1, since * 3);
    for (let half = 0; half < 2; half++) {
      const from = half === 0 ? top : bottom;
      const length = half === 0 ? breakAt - top[1] : bottom[1] - breakAt;
      const sign = half === 0 ? 1 : -1;
      let last = from;
      for (let i = 1; i <= 6; i++) {
        const k = i / 6;
        const flutter = Math.sin(this.clockTime * 11 + i * 1.3 + half) * 2.5 * k * Math.exp(-since * 0.5);
        const point = [from[0] + blow * 16 * k * k + flutter, from[1] + sign * length * k * (1 - 0.35 * blow)];
        line(c, last[0], last[1], point[0], point[1], `rgba(255,255,255,${0.85 * fade})`);
        last = point;
      }
    }
  }

  drawOverlay(c) {
    // the finish posts with their timing eyes
    const bottom = TrackTop + Lane * Math.max(1, this.lanes ?? 5);
    rect(c, FinishLine + 10, TrackTop - 8, 3, 8, '#C9CED6');
    rect(c, FinishLine + 10, bottom, 3, 8, '#C9CED6');
    const eye = `rgba(255,48,48,${0.6 + 0.4 * Math.sin((this.clockTime ?? 0) * 8)})`;
    rect(c, FinishLine + 10, TrackTop - 6, 3, 2, eye);
    rect(c, FinishLine + 10, bottom + 2, 3, 2, eye);

    this.drawGun(c);

    if (this.falseLane >= 0 && this.time >= this.falseAt + 0.6 && this.boardAlpha > 0) {
      rect(c, BoardX + this.falseLane * Column + Column - 10, BoardY + 3, 6, 8, alpha('#F2D21B', this.boardAlpha));
    }
    if (this.photoAge >= 0 && this.photoAge < PhotoShow) this.drawPhoto(c);
  }

  drawGun(c) {
    const { muzzle, rotation } = this.gun(this.time ?? -1);
    const [ox, oy] = rotate([5.6, -3.4], rotation);
    const image = this.sprite(PISTOL, 'icon');
    if (image) texture(c, image, muzzle[0] - ox, muzzle[1] - oy, 18, 18, rotation);
    if (!this.racing) return;
    const shots = !Number.isNaN(this.falseAt)
      ? Math.min(this.since(this.falseAt + 0.3), this.since(this.falseAt + 0.5), this.since(SprintStart))
      : this.since(SprintStart);
    if (shots < 0.08) {
      circle(c, muzzle[0], muzzle[1], 6, 'rgba(255,200,69,0.7)');
      circle(c, muzzle[0], muzzle[1], 3, WHITE);
    }
  }

  /** Seconds since a moment, or a long time if it is still to come. */
  since(at) {
    return this.time >= at ? this.time - at : Infinity;
  }

  /** The slit camera's frame of the moment the winner hit the line, every lane frozen where it was. */
  drawPhoto(c) {
    const match = this.match;
    if (!match) return;
    rect(c, PhotoX + 3, PhotoY + 3, PhotoW, PhotoH, 'rgba(0,0,0,0.35)');
    rect(c, PhotoX, PhotoY, PhotoW, PhotoH, '#E7DFC8');
    for (let x = 2; x < PhotoW; x += 6) rect(c, PhotoX + x, PhotoY + 18, 1, PhotoH - 18, 'rgba(107,97,82,0.12)');
    rect(c, PhotoX, PhotoY, PhotoW, 18, '#1B1F27');
    const row = (PhotoH - 22) / Math.max(1, this.lanes);
    const finish = PhotoX + PhotoW - 44;
    for (let lane = 0; lane < this.lanes; lane++) {
      const floor = PhotoY + 20 + row * (lane + 1) - 3;
      rect(c, PhotoX + 2, floor + 2, PhotoW - 4, 1, 'rgba(142,132,111,0.5)');
      const snap = this.snap[lane];
      const angle = snap.lean * Math.PI / 180;
      const chest = snap.x + Body * Math.sin(angle);
      const x = clamp(finish + (chest - FinishLine) * 2.2, PhotoX + 52, PhotoX + PhotoW - 6);
      this.silhouette(c, x - Body * 0.9 * Math.sin(angle), floor, snap.lean, kitCss(match, lane), 0.9);
    }
    rect(c, finish, PhotoY + 18, 2, PhotoH - 18, '#D02020');
    frameRect(c, PhotoX, PhotoY, PhotoW, PhotoH, WHITE);
    const flash = 1 - this.photoAge / 0.3;
    if (flash > 0) rect(c, PhotoX, PhotoY, PhotoW, PhotoH, `rgba(255,255,255,${flash})`);
  }

  /** A runner's silhouette for the photo: legs, a leaning torso and a head, in the lane's colour. */
  silhouette(c, fx, fy, lean, colour, scale) {
    const angle = lean * Math.PI / 180;
    const up = [Math.sin(angle), -Math.cos(angle)];
    const side = [-up[1], up[0]];
    const at = (k, s = 0) => [fx + up[0] * k * scale + side[0] * s * scale, fy + up[1] * k * scale + side[1] * s * scale];
    const hip = at(7), shoulder = at(14), head = at(17.5);
    const dark = '#2A241C';
    const [lx, ly] = at(0, 3.5), [rx, ry] = at(0, -3.5);
    line(c, hip[0], hip[1], lx, ly, dark);
    line(c, hip[0], hip[1], rx, ry, dark);
    poly(c, colour, at(7, 2), at(14, 2), at(14, -2), at(7, -2));
    const [ax, ay] = at(10, 4), [bx, by] = at(11, -4);
    line(c, shoulder[0], shoulder[1], ax, ay, dark);
    line(c, shoulder[0], shoulder[1], bx, by, dark);
    circle(c, head[0], head[1], 2.6 * scale, dark);
  }
}

defineSport(Sport.Sprint, { play: playSprint, Arena: SprintArena });
