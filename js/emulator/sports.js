// The ExtraNet sportsbook (<CMUNetSportsbook/>) for the PC emulator: a port of CMUSports.cs (the match
// simulation), CMUSportsArena.cs (the arena that plays a match) and the CMUNetSportsbook tag of
// CMUComputerFunUi.cs (the betting board). The schedule the server keeps (CMUComputerFunSystem.Schedule) is
// worked out here from the date instead, and bets come out of a local wallet.
//
// Matches use .NET's System.Random (the seeded Net5CompatSeedImpl) and the same float rounding as the C#, so a
// seed and winner play the same match as in game.
//
// The people are composited from the same RSIs the game's dolls wear: the AppearanceCMUHuman body parts
// (Mobs/Species/Human/parts.rsi, male, default skin tone), its eyes (Mobs/Customization/eyes.rsi), and the
// CMUSportsKit<Role><Colour> starting gear: ClothingUniformJumpsuitColor<Colour>, ClothingShoesColor<Colour>,
// ClothingHandsGlovesBoxingRed/Blue for boxers and ClothingHeadHelmetEVA for zero-g players, each in its
// prototype's clothingVisuals colour. Balls and the bat are the Basketball, TennisBall and BaseBallBat icons.

import { loadRsi, loadStateSheet, stateFrames } from '../sprites.js';

// ---------------------------------------------------------------- System.Random

const MBIG = 2147483647;
const MSEED = 161803398;

/** .NET's System.Random(seed): Knuth's subtractive generator as in Net5CompatSeedImpl. */
export class NetRandom {
  constructor(seed) {
    seed |= 0;
    const a = new Array(56).fill(0);
    const subtraction = seed === -2147483648 ? MBIG : Math.abs(seed);
    let mj = MSEED - subtraction;
    a[55] = mj;
    let mk = 1;
    let ii = 0;
    for (let i = 1; i < 55; i++) {
      if ((ii += 21) >= 55) ii -= 55;
      a[ii] = mk;
      mk = mj - mk;
      if (mk < 0) mk += MBIG;
      mj = a[ii];
    }
    for (let k = 1; k < 5; k++) {
      for (let i = 1; i < 56; i++) {
        let n = i + 30;
        if (n >= 55) n -= 55;
        a[i] -= a[1 + n];
        if (a[i] < 0) a[i] += MBIG;
      }
    }
    this.a = a;
    this.inext = 0;
    this.inextp = 21;
  }

  internalSample() {
    let inext = this.inext + 1;
    if (inext >= 56) inext = 1;
    let inextp = this.inextp + 1;
    if (inextp >= 56) inextp = 1;
    let ret = this.a[inext] - this.a[inextp];
    if (ret === MBIG) ret--;
    if (ret < 0) ret += MBIG;
    this.a[inext] = ret;
    this.inext = inext;
    this.inextp = inextp;
    return ret;
  }

  sample() {
    return this.internalSample() * (1.0 / MBIG);
  }

  nextDouble() {
    return this.sample();
  }

  /** Next(), Next(max) or Next(min, max). */
  next(a, b) {
    if (a === undefined) return this.internalSample();
    if (b === undefined) return Math.trunc(this.sample() * a);
    return Math.trunc(this.sample() * (b - a)) + a;
  }
}

const f = Math.fround;

/** Math.Round: halves go to the even neighbour. */
function roundEven(x) {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

// ---------------------------------------------------------------- CMUSports

export const Sport = { Sprint: 0, Boxing: 1, Baseball: 2, ZeroGBall: 3 };
const SPORT_KEYS = ['Sprint', 'Boxing', 'Baseball', 'ZeroGBall'];
const Action = { Finish: 0, Punch: 1, Knockdown: 2, Knockout: 3, Bell: 4, AtBat: 5, Pass: 6, Goal: 7 };

const SprintStart = 8;
const BoxingRounds = 3;
const RoundLength = 24;
const RoundRest = 6;
const Innings = 6;
const Squad = 3;

const Colours = ['Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple', 'White', 'Brown'];
const Teams = [
  'Gateway Comets', 'Titan Dockers', 'Hadley Hawks', 'Thedus Tritons', 'Sol Strikers', 'Rim Runners',
  'Arcturus Aces', 'Fiorina Furies',
];
const Athletes = [
  'Dex Mbeki', 'Ivo Laszlo', 'Rana Holt', 'Tomas Reyes', 'Kit Okonkwo', 'June Sato', 'Marco Bell',
  'Ada Novak', 'Sam Ferreira', 'Lena Dubois', 'Pike Hanlon', 'Oni Adeyemi', 'Viktor Saar', 'Bea Quinlan',
];

const usesTeams = sport => sport === Sport.Baseball || sport === Sport.ZeroGBall;
const entrantCount = sport => (sport === Sport.Sprint ? 5 : 2);

function sportLength(sport) {
  if (sport === Sport.Sprint) return 30;
  if (sport === Sport.Boxing) return BoxingRounds * (RoundLength + RoundRest) + 4;
  return 120;
}

function entrantName(sport, entrant) {
  const names = usesTeams(sport) ? Teams : Athletes;
  return entrant >= 0 && entrant < names.length ? names[entrant] : '?';
}

function kitColour(sport, slot, entrant) {
  if (sport === Sport.Boxing) return slot === 0 ? 0 : 1;
  if (sport === Sport.Sprint) return slot % Colours.length;
  return entrant % Colours.length;
}

const ev = (time, action, side, value, extra = 0, state = 0) => ({ time: f(time), action, side, value, extra, state });
const range = (random, min, max) => f(min + random.nextDouble() * (max - min));

/** CMUSports.Play: the whole match from its seed and winner. */
export function playMatch(sport, seed, entrants, winner) {
  const random = new NetRandom(seed);
  const play = sport === Sport.Sprint ? playSprint(random, entrants, winner)
    : sport === Sport.Boxing ? playBoxing(random, winner)
      : sport === Sport.Baseball ? playBaseball(random, winner)
        : playZeroG(random, winner);
  // List.Sort is unstable in .NET; events never share a time in practice, so a stable sort gives the same order.
  play.events.sort((a, b) => a.time - b.time);
  return play;
}

function playSprint(random, lanes, winner) {
  const play = { events: [], score: new Array(lanes).fill(0), result: '' };
  const best = roundEven(f(range(random, 9.6, 10.4) * 100));
  for (let lane = 0; lane < lanes; lane++) {
    const time = lane === winner ? best : best + 5 + random.next(110);
    play.score[lane] = time;
    play.events.push(ev(SprintStart + f(time / 100), Action.Finish, lane, time));
  }
  play.result = `${f(best / 100).toFixed(2)}s`;
  return play;
}

function playBoxing(random, winner) {
  const play = { events: [], score: [0, 0], result: '' };
  const loser = 1 - winner;
  const koRound = random.nextDouble() < 0.45 ? random.next(1, BoxingRounds + 1) : 0;
  const koTime = range(random, 8, RoundLength - 2);
  const downRound = koRound === 0 && random.nextDouble() < 0.35 ? random.next(1, BoxingRounds + 1) : 0;
  const downTime = range(random, 6, RoundLength - 8);

  for (let round = 1; round <= BoxingRounds; round++) {
    const start = f(4 + (round - 1) * (RoundLength + RoundRest));
    play.events.push(ev(start, Action.Bell, 0, round));
    const end = round === koRound ? koTime : RoundLength;
    const down = round === downRound ? downTime : -1;
    for (let time = f(0.8); time < end; time = f(time + range(random, 0.7, 1.8))) {
      if (down >= 0 && time > f(down - 0.5) && time < f(down + 4)) continue;
      const side = random.nextDouble() < 0.58 ? winner : loser;
      const landed = random.nextDouble() < (side === winner ? 0.55 : 0.4);
      if (landed) play.score[side]++;
      play.events.push(ev(f(start + time), Action.Punch, side, landed ? 1 : 0));
    }

    if (down >= 0) {
      play.score[winner]++;
      play.events.push(ev(f(f(start + down) - f(0.3)), Action.Punch, winner, 1));
      play.events.push(ev(f(start + down), Action.Knockdown, loser, 0));
    }

    if (round !== koRound) continue;
    play.score[winner]++;
    play.events.push(ev(f(start + koTime), Action.Punch, winner, 1));
    play.events.push(ev(f(f(start + koTime) + f(0.3)), Action.Knockout, loser, round));
    play.result = `KO R${round}`;
    return play;
  }

  play.result = `UD 30-${27 + random.next(3)}`;
  return play;
}

function playBaseball(random, winner) {
  let innings = [[], []];
  for (let side = 0; side < 2; side++) {
    for (let inning = 0; inning < Innings; inning++) {
      const half = innings[side][inning] = [];
      let outs = 0;
      while (outs < 3) {
        const roll = random.nextDouble();
        const outcome = half.length >= 8 || roll < 0.64 ? 0 : roll < 0.82 ? 1 : roll < 0.91 ? 2 : roll < 0.95 ? 3 : 4;
        half.push(outcome);
        if (outcome === 0) outs++;
      }
    }
  }

  const totals = [runs(innings[0]), runs(innings[1])];
  if (totals[winner] < totals[1 - winner]) innings = [innings[1], innings[0]];
  if (totals[0] === totals[1]) {
    const last = innings[winner][Innings - 1];
    last.splice(last.length - 1, 0, 4);
  }

  // away (side 1) bats in the top of each inning, home (side 0) in the bottom
  const halves = [];
  for (let inning = 0; inning < Innings; inning++) halves.push([1, inning], [0, inning]);
  let appearances = 0;
  for (const [side, inning] of halves) appearances += innings[side][inning].length;

  const play = { events: [], score: [0, 0], result: '' };
  const slot = f((sportLength(Sport.Baseball) - 8) / (appearances + halves.length));
  let time = f(3);
  for (const [side, inning] of halves) {
    if (inning === Innings - 1 && side === 0 && play.score[0] > play.score[1]) break;
    play.events.push(ev(time, Action.Bell, side, inning + 1));
    time = f(time + slot);
    const bases = { value: 0 };
    let outs = 0;
    for (const outcome of innings[side][inning]) {
      const scored = advance(bases, outcome);
      if (outcome === 0) outs++;
      play.score[side] += scored;
      play.events.push(ev(time, Action.AtBat, side, outcome, scored, bases.value | (outs << 4)));
      time = f(time + slot);
    }
  }

  play.result = `${play.score[0]} - ${play.score[1]}`;
  return play;
}

function runs(innings) {
  let total = 0;
  for (const half of innings) {
    const bases = { value: 0 };
    for (const outcome of half) total += advance(bases, outcome);
  }
  return total;
}

/** Moves every runner as many bases as the batter took. Bits 0 to 2 are first to third. */
function advance(bases, outcome) {
  if (outcome === 0) return 0;
  if (outcome === 4) {
    const home = bitCount(bases.value) + 1;
    bases.value = 0;
    return home;
  }
  bases.value = (bases.value << outcome) | (1 << (outcome - 1));
  const scored = bitCount(bases.value >> 3);
  bases.value &= 7;
  return scored;
}

function bitCount(bits) {
  let count = 0;
  for (; bits !== 0; bits >>= 1) count += bits & 1;
  return count;
}

function playZeroG(random, winner) {
  const play = { events: [], score: [0, 0], result: '' };
  const length = sportLength(Sport.ZeroGBall);
  const winning = random.next(1, 6);
  const losing = random.next(0, winning);
  const goals = [];
  for (let i = 0; i < winning; i++) goals.push(winner);
  for (let i = 0; i < losing; i++) goals.push(1 - winner);

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
    }

    const shooter = random.next(Squad);
    play.events.push(ev(f(goal - 1.5), Action.Pass, side, shooter));
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
  }

  play.result = `${play.score[0]} - ${play.score[1]}`;
  return play;
}

// ---------------------------------------------------------------- schedule

// CMUBetLimits
const MinBet = 10;
const MaxBet = 2000;
const Upcoming = 2;
const BettingWindow = 120;
const Gap = 30;
const DAY = 86400;

// The server keeps a chain of matches, each kicking off a gap after the last one ends, never the same sport
// twice in a row. Here every UTC day has its own chain from midnight, drawn from System.Random seeded with the
// day number, and the last match of a day ends before the next day's first, so the chain never jumps.
const dayCache = new Map();

function dayMatches(day) {
  if (dayCache.has(day)) return dayCache.get(day);
  const random = new NetRandom(day * 7919 + 2026);
  const start = day * DAY;
  const endOfDay = start + DAY;
  const matches = [];
  let last = null;
  for (let k = 0; k < 1990; k++) {
    let kickoff = start + BettingWindow;
    if (last && last.end + Gap > kickoff) kickoff = last.end + Gap;
    const sports = [0, 1, 2, 3].filter(s => s !== last?.sport);
    const sport = sports[random.next(sports.length)];
    if (kickoff + sportLength(sport) + Gap > endOfDay) break;
    // Robust's Shuffle
    const roster = Array.from({ length: usesTeams(sport) ? Teams.length : Athletes.length }, (_, i) => i);
    for (let n = roster.length; n > 1; n--) {
      const r = random.next(n);
      [roster[r], roster[n - 1]] = [roster[n - 1], roster[r]];
    }
    const entrants = roster.slice(0, entrantCount(sport));
    const weights = entrants.map(() => f(0.5 + f(random.nextDouble()) * 1.5));
    const total = f(weights.reduce((sum, w) => sum + w, 0));
    const odds = weights.map(w => f(Math.max(1.1, roundEven(f(total / w) * 0.9 * 10) / 10)));
    let roll = f(f(random.nextDouble()) * total);
    let winner = 0;
    for (; winner < weights.length - 1; winner++) {
      roll = f(roll - weights[winner]);
      if (roll < 0) break;
    }
    const match = {
      id: (day % 100000) * 2000 + k,
      sport,
      entrants,
      odds,
      kickoff,
      end: kickoff + sportLength(sport),
      seed: random.next(),
      winner,
      result: null,
    };
    matches.push(match);
    last = match;
  }
  dayCache.set(day, matches);
  if (dayCache.size > 4) dayCache.delete(dayCache.keys().next().value);
  return matches;
}

function findMatch(id) {
  const day = Math.floor(id / 2000);
  const today = Math.floor(Date.now() / 1000 / DAY);
  // ids keep the day number modulo 100000
  const full = today - ((today % 100000) - day + 100000) % 100000;
  return dayMatches(full).find(m => m.id === id) || null;
}

const resultCache = new Map();

function resultOf(match) {
  if (!resultCache.has(match.id)) {
    resultCache.set(match.id, playMatch(match.sport, match.seed, match.entrants.length, match.winner).result);
    if (resultCache.size > 64) resultCache.delete(resultCache.keys().next().value);
  }
  return resultCache.get(match.id);
}

/** CMUBetMatch.Public: seed and winner stay hidden until kickoff. */
function publicMatch(match, now) {
  const result = now >= match.end ? resultOf(match) : null;
  return now >= match.kickoff ? { ...match, result } : { ...match, seed: 0, winner: -1, result };
}

/** What SendBets shows: the live and next matches, then the latest six results, newest first. */
function boardState(now) {
  const day = Math.floor(now / DAY);
  const all = [...dayMatches(day - 1), ...dayMatches(day)];
  const open = [];
  let upcoming = 0;
  for (const match of all) {
    if (now >= match.end) continue;
    if (match.kickoff > now) {
      if (upcoming >= Upcoming) break;
      upcoming++;
    }
    open.push(match);
  }
  const done = all.filter(m => now >= m.end).slice(-6).reverse();
  return [...open, ...done].map(m => publicMatch(m, now));
}

const matchName = (match, slot) => (slot >= 0 && slot < match.entrants.length ? entrantName(match.sport, match.entrants[slot]) : '?');

// ---------------------------------------------------------------- wallet

const WALLET_KEY = 'extranet-emulator-wallet';
const BETS_KEY = 'extranet-emulator-sportsbook-bets';
const START_BALANCE = 500;

function readBalance() {
  try {
    const raw = localStorage.getItem(WALLET_KEY);
    if (raw === null) return START_BALANCE;
    const value = Number(raw);
    if (Number.isFinite(value)) return Math.floor(value);
    const parsed = JSON.parse(raw);
    const nested = Number(parsed?.balance ?? parsed?.credits);
    return Number.isFinite(nested) ? Math.floor(nested) : START_BALANCE;
  } catch {
    return START_BALANCE;
  }
}

function writeBalance(value) {
  try {
    localStorage.setItem(WALLET_KEY, String(value));
  } catch {
    // the wallet lives for this page only
  }
}

let memoryBets = [];

function readBets() {
  try {
    const raw = localStorage.getItem(BETS_KEY);
    const bets = raw ? JSON.parse(raw) : [];
    return Array.isArray(bets) ? bets : [];
  } catch {
    return memoryBets;
  }
}

function writeBets(bets) {
  memoryBets = bets;
  try {
    localStorage.setItem(BETS_KEY, JSON.stringify(bets));
  } catch {
    // kept in memory
  }
}

/** CMUComputerFunSystem.Play: winners get their stake times the odds; everyone else already paid. */
function settle(now) {
  const bets = readBets();
  const keep = [];
  let payout = 0;
  for (const bet of bets) {
    const match = findMatch(bet.match);
    if (!match) continue;
    if (now < match.end) {
      keep.push(bet);
      continue;
    }
    if (bet.entrant === match.winner) payout += Math.trunc(f(bet.amount * match.odds[match.winner]));
  }
  if (keep.length !== bets.length) {
    if (payout) writeBalance(readBalance() + payout);
    writeBets(keep);
  }
  return payout;
}

// ---------------------------------------------------------------- strings (personal-computers.ftl)

const SPORT_NAMES = ['100 m dash', 'Boxing', 'Baseball', 'Zero-g ball'];
const L = {
  loading: 'Querying the bureau...',
  slip: (amount, team, sport) => `$${amount} on ${team} (${sport})`,
  open: (sport, entrants) => `${sport}: ${entrants}`,
  kickoff: seconds => `Betting closes in ${seconds}s`,
  closed: 'In play, betting closed',
  result: (sport, winner, result) => `${sport}: ${winner} won, ${result}`,
  replay: 'Watch again',
  amount: 'Stake in dollars',
  betOn: (team, odds) => `Bet on ${team} (x${odds})`,
  slips: 'Your bets',
  results: 'Latest results',
  starts: seconds => `Starts in ${seconds}s`,
  final: 'FINAL',
  winner: name => `${name} wins!`,
  marks: 'On your marks',
  set: 'Set',
  go: 'GO!',
  round: round => `ROUND ${round}`,
  roundClock: (round, clock) => `Round ${round}  ${clock}`,
  landed: count => `Landed: ${count}`,
  ko: 'K.O.!',
  inning: (inning, half) => `Inning ${inning} ${half}`,
  outs: outs => `Outs: ${outs}`,
  hits: ['OUT', 'SINGLE!', 'DOUBLE!', 'TRIPLE!', 'HOME RUN!'],
  runs: n => (n === 1 ? '+1 run' : `+${n} runs`),
  goal: team => `GOAL! ${team}`,
};

// ---------------------------------------------------------------- dolls (real RSIs)

const PARTS = 'Mobs/Species/Human/parts.rsi';
const EYES = 'Mobs/Customization/eyes.rsi';
const JUMPSUIT = 'Clothing/Uniforms/Jumpsuits/Color/color.rsi';
const SHOES = 'Clothing/Shoes/color.rsi';
const HELMET = 'Clothing/Head/Helmets/eva.rsi';
const GLOVES = ['Clothing/Hands/Gloves/Boxing/boxingred.rsi', 'Clothing/Hands/Gloves/Boxing/boxingblue.rsi'];
// HumanTonedSkinColoration.FromUnary(20), the Human species' default tone: HSV 25, 20%, 100%.
const SKIN = '#FFE1CC';
// HumanoidCharacterAppearance's default eye colour
const EYE_COLOUR = '#000000';

// clothingVisuals colours of ClothingUniformJumpsuitColor<Colour> and ClothingShoesColor<Colour>
const JUMPSUIT_TINT = {
  Red: '#eb0c07', Blue: '#52aecc', Green: '#9ed63a', Yellow: '#ffe14d', Orange: '#ff8c19', Purple: '#9f70cc', White: null, Brown: '#a17229',
};
const SHOE_TINT = {
  Red: '#940000', Blue: '#0089EF', Green: '#5ABF2F', Yellow: '#EBE216', Orange: '#EF8100', Purple: '#9C0DE1', White: '#EAE8E8', Brown: '#592D01',
};

const BALL = { rsi: 'Objects/Fun/Balls/basketball.rsi', state: 'icon' };
const TENNIS = { rsi: 'Objects/Fun/Balls/tennisball.rsi', state: 'icon' };
const BAT = { rsi: 'Objects/Weapons/Melee/baseball_bat.rsi', state: 'icon' };

/** One layer's first frame facing a direction, tinted like a sprite layer colour (multiply, alpha kept). */
async function layerCanvas(rsiPath, stateName, direction, tint) {
  const rsi = await loadRsi(rsiPath);
  const state = rsi.states.get(stateName);
  if (!state) throw new Error(`state "${stateName}" is not in ${rsi.path}`);
  const image = await loadStateSheet(rsi.path, stateName);
  const frame = stateFrames(rsi, state, image, Math.min(direction, state.directions - 1))[0];
  const canvas = document.createElement('canvas');
  canvas.width = rsi.size.x;
  canvas.height = rsi.size.y;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, frame.sx, frame.sy, rsi.size.x, rsi.size.y, 0, 0, rsi.size.x, rsi.size.y);
  if (tint) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(image, frame.sx, frame.sy, rsi.size.x, rsi.size.y, 0, 0, rsi.size.x, rsi.size.y);
    ctx.globalCompositeOperation = 'source-over';
  }
  return canvas;
}

/** The layers of a dressed doll in BaseSpeciesAppearance order. */
function kitLayers(role, colour) {
  const name = Colours[colour % Colours.length];
  const layers = [
    [PARTS, 'torso_m', SKIN], [PARTS, 'head_m', SKIN], [EYES, 'eyes', EYE_COLOUR],
    [PARTS, 'r_arm', SKIN], [PARTS, 'l_arm', SKIN], [PARTS, 'r_leg', SKIN], [PARTS, 'l_leg', SKIN],
    [JUMPSUIT, 'equipped-INNERCLOTHING', JUMPSUIT_TINT[name]], [JUMPSUIT, 'trinkets-equipped-INNERCLOTHING', null],
    [PARTS, 'l_foot', SKIN], [PARTS, 'r_foot', SKIN], [PARTS, 'l_hand', SKIN], [PARTS, 'r_hand', SKIN],
  ];
  if (role === 'Boxer' && colour < 2) layers.push([GLOVES[colour], 'equipped-HAND', null]);
  layers.push([SHOES, 'equipped-FEET', SHOE_TINT[name]]);
  layers.push([SHOES, name === 'White' ? 'contrastedsoles-equipped-FEET' : 'soles-equipped-FEET', null]);
  if (role === 'Spacer') layers.push([HELMET, 'equipped-HELMET', null]);
  return layers;
}

const dollCache = new Map();

/** A composited doll facing a direction (0 south, 1 north, 2 east, 3 west), as a 32x32 canvas. */
function dollCanvas(role, colour, direction) {
  const key = `${role}|${colour}|${direction}`;
  if (dollCache.has(key)) return dollCache.get(key);
  const promise = (async () => {
    const layers = await Promise.all(kitLayers(role, colour).map(([rsi, state, tint]) =>
      layerCanvas(rsi, state, direction, tint).catch(e => {
        console.warn(`sportsbook: ${e.message}`);
        return null;
      })));
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    for (const layer of layers) if (layer) ctx.drawImage(layer, 0, 0);
    return canvas;
  })();
  dollCache.set(key, promise);
  return promise;
}

const itemCache = new Map();

function itemCanvas(item) {
  const key = `${item.rsi}|${item.state}`;
  if (!itemCache.has(key)) {
    itemCache.set(key, layerCanvas(item.rsi, item.state, 0, null).catch(e => {
      console.warn(`sportsbook: ${e.message}`);
      return null;
    }));
  }
  return itemCache.get(key);
}

/** Resolved images by key, so the frame loop draws whatever has loaded. */
const ready = new Map();

function readyImage(key, promise) {
  if (ready.has(key)) return ready.get(key);
  ready.set(key, null);
  promise.then(canvas => ready.set(key, canvas));
  return null;
}

// ---------------------------------------------------------------- arena (CMUSportsArena)

const ArenaWidth = 520;
const ArenaHeight = 240;
const Bar = 26;
const Hits = ['POW!', 'BAM!', 'WHAM!', 'THUD!', 'SMACK!'];
const Dir = { South: 0, North: 1, East: 2, West: 3 };

const WHITE = [255, 255, 255];
const GOLD = '#FFD700';
const LIME = '#00FF00';
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

const TrackTop = Bar + 10;
const Lane = 38;
const StartLine = 110;
const FinishLine = 470;
const RingFloor = 132;
const BoxerY = 160;
const Home = [260, 214];
const Mound = [260, 150];
const Bases = [[340, 150], [260, 92], [180, 150]];
const CageLeft = 16;
const CageRight = ArenaWidth - 16;
const CageTop = Bar + 8;
const CageBottom = ArenaHeight - 8;
const Formation = [[150, 80], [200, 136], [150, 192]];

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const shortName = team => team.split(' ').pop().toUpperCase();
const two = n => String(n).padStart(2, '0');

const TEAM_COLOURS = {
  Red: '#E04040', Blue: '#4080FF', Green: '#40C060', Yellow: '#F0D040', Orange: '#F09030', Purple: '#A060E0', Brown: '#A07040',
};

class Arena {
  constructor(font) {
    this.font = font;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'emu-sports-arena';
    this.ctx = this.canvas.getContext('2d');
    this.ratio = 0;
    this.match = null;
    this.play = null;
    this.start = 0;
    this.dolls = [];
  }

  /** Shows a match, live from its kickoff, or from now when replay is set. */
  show(match, now, replay = false) {
    const known = this.match && this.match.id === match.id && this.match.winner === match.winner;
    this.match = match;
    if (known && !replay) return;
    this.play = match.winner >= 0 ? playMatch(match.sport, match.seed, match.entrants.length, match.winner) : null;
    this.start = replay ? now : match.kickoff;
    this.rebuild();
  }

  rebuild() {
    this.dolls = [];
    const match = this.match;
    if (!match) return;
    const add = (role, colour, scale) => this.dolls.push({ role, colour, scale, visible: false, x: 0, y: 0, dir: Dir.South, rot: 0 });
    switch (match.sport) {
      case Sport.Sprint:
        for (let lane = 0; lane < match.entrants.length; lane++) add('Runner', kitColour(match.sport, lane, match.entrants[lane]), 1.25);
        break;
      case Sport.Boxing:
        add('Boxer', 0, 2);
        add('Boxer', 1, 2);
        break;
      case Sport.Baseball:
        // per side: pitcher, batter, then runners on first, second and third
        for (let side = 0; side < 2; side++) for (let i = 0; i < 5; i++) add('Player', kitColour(match.sport, side, match.entrants[side]), 1.25);
        break;
      default:
        for (let side = 0; side < 2; side++) for (let i = 0; i < Squad; i++) add('Spacer', kitColour(match.sport, side, match.entrants[side]), 1.25);
        break;
    }
    this.ballItem = match.sport === Sport.Baseball ? TENNIS : BALL;
    this.ballScale = match.sport === Sport.Baseball ? 0.75 : 1;
  }

  pose(doll, x, y, dir, rotation = 0) {
    const d = this.dolls[doll];
    if (!d) return;
    Object.assign(d, { visible: true, x, y, dir, rot: rotation });
  }

  hide(doll) {
    if (this.dolls[doll]) this.dolls[doll].visible = false;
  }

  /** Big calls are centred on their spot; labels hang from it, or end at it when right aligned. */
  say(text, x, y, colour, big = false, right = false) {
    this.texts.push({ text, x, y, colour, big, right });
  }

  frame(now) {
    this.texts = [];
    this.ball = null;
    this.bat = null;
    const match = this.match;
    if (!match) return this.draw();
    const t = now - this.start;
    const length = sportLength(match.sport);
    this.header = SPORT_NAMES[match.sport].toUpperCase();
    this.clock = this.play == null
      ? L.starts(Math.max(0, Math.trunc(-t)))
      : t >= length ? L.final : `${Math.trunc(Math.trunc(t) / 60)}:${two(Math.trunc(t) % 60)}`;
    const play = this.play;
    const time = play == null ? -1 : Math.min(t, length);
    if (match.sport === Sport.Sprint) this.updateSprint(match, play, time);
    else if (match.sport === Sport.Boxing) this.updateBoxing(match, play, time);
    else if (match.sport === Sport.Baseball) this.updateBaseball(match, play, time);
    else this.updateZeroG(match, play, time);
    if (play != null && t >= length) this.say(L.winner(matchName(match, match.winner)), ArenaWidth / 2, ArenaHeight - 30, GOLD, true);
    this.draw();
  }

  // ---- sprint

  updateSprint(match, play, t) {
    const running = t - SprintStart;
    const finished = [];
    for (let lane = 0; lane < match.entrants.length; lane++) {
      let y = TrackTop + Lane * lane + Lane / 2 - 6;
      let x = StartLine - 6;
      if (play != null && running > 0) {
        const finish = play.score[lane] / 100;
        const progress = clamp(running / finish, 0, 1);
        const distance = progress - 0.1 * Math.sin(Math.PI * progress);
        x = StartLine + distance * (FinishLine - StartLine);
        if (running >= finish) {
          x = FinishLine + Math.min(1, running - finish) * 22;
          finished.push(lane);
        } else {
          y -= Math.abs(Math.sin(running * 14 + lane)) * 3;
        }
      }
      this.pose(lane, x, y, Dir.East);
      this.say(matchName(match, lane), 6, TrackTop + Lane * lane + 2, rgba(WHITE, 0.75));
    }

    if (play == null || running < 0) {
      const call = play == null || running < -4 ? L.marks : running < -1 ? L.set : null;
      if (call) this.say(call, ArenaWidth / 2, ArenaHeight / 2, '#FFFFFF', true);
      return;
    }

    if (running < 1) this.say(L.go, ArenaWidth / 2, ArenaHeight / 2, LIME, true);
    else if (finished.length === 0) this.clock = running.toFixed(2);

    const order = finished.slice().sort((a, b) => play.score[a] - play.score[b]);
    order.forEach((lane, place) => {
      this.say(`${place + 1}. ${(play.score[lane] / 100).toFixed(2)}`, FinishLine - 70, TrackTop + Lane * lane + 2, place === 0 ? GOLD : '#FFFFFF');
    });
  }

  drawSprint(c) {
    rect(c, 0, Bar, ArenaWidth, ArenaHeight - Bar, '#2E5A2A');
    const lanes = this.match?.entrants.length ?? 5;
    rect(c, 0, TrackTop, ArenaWidth, Lane * lanes, '#B5482F');
    for (let i = 0; i <= lanes; i++) rect(c, 0, TrackTop + Lane * i - 1, ArenaWidth, 2, rgba(WHITE, 0.8));
    rect(c, StartLine - 2, TrackTop, 3, Lane * lanes, '#FFFFFF');
    for (let y = 0; y < Math.trunc(Lane * lanes / 6); y++) {
      for (let x = 0; x < 2; x++) rect(c, FinishLine + x * 6, TrackTop + y * 6, 6, 6, (x + y) % 2 === 0 ? '#FFFFFF' : '#000000');
    }
  }

  // ---- boxing

  updateBoxing(match, play, t) {
    this.say(matchName(match, 0), 40, Bar + 6, '#FF6B6B');
    this.say(matchName(match, 1), ArenaWidth - 40, Bar + 6, '#6BA8FF', false, true);
    if (play == null || t < 4) {
      this.pose(0, 80, BoxerY, Dir.East);
      this.pose(1, ArenaWidth - 80, BoxerY, Dir.West);
      if (play != null) this.say(L.round(1), ArenaWidth / 2, 80, '#FFFFFF', true);
      return;
    }

    const round = Math.min(BoxingRounds, Math.trunc((t - 4) / (RoundLength + RoundRest)) + 1);
    const into = t - 4 - (round - 1) * (RoundLength + RoundRest);
    const landed = [0, 0];
    let down = null;
    let downSide = -1;
    let knockedOut = false;
    for (const e of play.events) {
      if (e.time > t) break;
      if (e.action === Action.Punch && e.value === 1) landed[e.side]++;
      else if ((e.action === Action.Knockdown || e.action === Action.Knockout) && (e.action === Action.Knockout || t < e.time + 4)) {
        down = t - e.time;
        downSide = e.side;
        knockedOut = e.action === Action.Knockout;
      }
    }

    const shown = Math.trunc(Math.min(into, RoundLength));
    this.clock = L.roundClock(round, `${Math.trunc(shown / 60)}:${two(shown % 60)}`);
    this.say(L.landed(landed[0]), 40, Bar + 20, rgba(WHITE, 0.8));
    this.say(L.landed(landed[1]), ArenaWidth - 40, Bar + 20, rgba(WHITE, 0.8), false, true);

    const resting = into > RoundLength && !knockedOut;
    if (resting || (knockedOut && down > 6)) {
      this.pose(0, 80, BoxerY, Dir.East);
      this.pose(1, ArenaWidth - 80, BoxerY, Dir.West);
      if (knockedOut) this.pose(downSide, downSide === 0 ? 80 : ArenaWidth - 80, BoxerY + 18, Dir.South, downSide === 0 ? -90 : 90);
      if (resting && round < BoxingRounds) this.say(L.round(round + 1), ArenaWidth / 2, 80, '#FFFFFF', true);
      else if (knockedOut) this.say(L.ko, ArenaWidth / 2, 80, '#FF0000', true);
      return;
    }

    const centre = ArenaWidth / 2 + Math.sin(t * 0.7) * 50;
    const x = [centre - 36 + Math.sin(t * 3) * 4, centre + 36 + Math.sin(t * 3 + 1.5) * 4];
    const y = [BoxerY + Math.sin(t * 5) * 2, BoxerY + Math.sin(t * 5 + 2) * 2];
    let index = 0;
    for (const e of play.events) {
      index++;
      if (e.action !== Action.Punch || e.time > t || t > e.time + 0.6) continue;
      const age = t - e.time;
      const towards = e.side === 0 ? 1 : -1;
      if (age < 0.35) x[e.side] += towards * 18 * Math.sin(Math.PI * age / 0.35);
      if (e.value !== 1 || age < 0.12) continue;
      const defender = 1 - e.side;
      x[defender] += towards * 10 * Math.sin(Math.PI * Math.min(1, (age - 0.12) / 0.48));
      this.say(Hits[index % Hits.length], x[defender], y[defender] - 46 - age * 20, '#FFFF00');
    }

    for (let side = 0; side < 2; side++) {
      if (side === downSide && down != null) {
        this.pose(side, x[side] - (side === 0 ? 14 : -14), BoxerY + 18, Dir.South, side === 0 ? -90 : 90);
        const count = Math.min(10, Math.trunc(down / (knockedOut ? 0.6 : 0.9)) + 1);
        this.say(knockedOut && count >= 10 ? L.ko : String(count), ArenaWidth / 2, 80, knockedOut ? '#FF0000' : '#FFFFFF', true);
        continue;
      }
      this.pose(side, x[side], y[side], side === 0 ? Dir.East : Dir.West);
    }
  }

  drawBoxing(c) {
    rect(c, 0, Bar, ArenaWidth, ArenaHeight - Bar, '#14121A');
    // the crowd, as rows of faint heads
    for (let row = 0; row < 3; row++) {
      for (let seat = 0; seat < 40; seat++) {
        circle(c, 8 + seat * 13 + (row % 2) * 6, Bar + 16 + row * 12, 5, rgba([0x3A, 0x33, 0x46], 0.6 + 0.1 * ((seat * 7 + row * 3) % 4)));
      }
    }
    rect(c, 30, RingFloor, ArenaWidth - 60, 76, '#C9D3DE');
    rect(c, 30, RingFloor + 76, ArenaWidth - 60, 14, '#2A3B6E');
    for (let rope = 0; rope < 3; rope++) rect(c, 30, RingFloor - 52 + rope * 16, ArenaWidth - 60, 3, rope === 1 ? '#FFFFFF' : '#C8102E');
    rect(c, 26, RingFloor - 60, 8, 150, '#C8102E');
    rect(c, ArenaWidth - 34, RingFloor - 60, 8, 150, '#1F4FC8');
  }

  // ---- baseball

  updateBaseball(match, play, t) {
    const runsSoFar = [0, 0];
    let batting = 1;
    let inning = 1;
    let state = 0;
    let current = null;
    let next = null;
    if (play != null) {
      for (const e of play.events) {
        if (e.time > t) {
          if (e.action === Action.AtBat) next = e;
          break;
        }
        if (e.action === Action.Bell) {
          batting = e.side;
          inning = e.value;
          state = 0;
          current = null;
        } else if (e.action === Action.AtBat) {
          current = e;
          runsSoFar[e.side] += e.extra;
          if (t > e.time + 0.8) state = e.state;
        }
      }
    }

    const fielding = 1 - batting;
    this.pose(fielding * 5, Mound[0], Mound[1] - 14, Dir.South);
    this.pose(batting * 5 + 1, Home[0] - 26, Home[1] - 12, Dir.East);
    this.hide(batting * 5);
    this.hide(fielding * 5 + 1);
    for (let i = 0; i < 3; i++) {
      this.hide(fielding * 5 + 2 + i);
      if ((state & (1 << i)) !== 0) this.pose(batting * 5 + 2 + i, Bases[i][0], Bases[i][1] - 14, Dir.South);
      else this.hide(batting * 5 + 2 + i);
    }

    this.clock = L.inning(inning, batting === 1 ? '▲' : '▼');
    this.say(`${shortName(matchName(match, 1))} ${runsSoFar[1]}`, 12, Bar + 6, batting === 1 ? GOLD : '#FFFFFF');
    this.say(`${shortName(matchName(match, 0))} ${runsSoFar[0]}`, 12, Bar + 20, batting === 0 ? GOLD : '#FFFFFF');
    this.say(L.outs(state >> 4), ArenaWidth - 70, Bar + 6, '#FFFFFF');

    // the bat rests on the shoulder and swings through the zone at contact
    let swing = next && t > next.time - 0.12 ? Math.min(1, (t - next.time + 0.12) / 0.25) : 0;
    if (current && t - current.time < 0.3) swing = 1;
    this.bat = { x: Home[0] - 12, y: Home[1] - 22, rot: -45 - 150 * swing };

    if (next && t > next.time - 0.5 && t <= next.time) {
      const travel = (t - (next.time - 0.5)) / 0.5;
      const at = lerp(Mound, [Home[0], Home[1] - 10], travel);
      this.ball = { x: at[0], y: at[1], rot: 0 };
      return;
    }

    if (!current || t - current.time > 1.6) return;
    const last = current;
    const age = t - last.time;
    this.say(L.hits[last.value], ArenaWidth / 2, 70, last.value === 4 ? GOLD : last.value === 0 ? '#FFFFFF' : LIME, true);
    if (last.extra > 0) this.say(L.runs(last.extra), ArenaWidth / 2, 96, GOLD);
    if (age > 0.9) return;

    // hits fly to the outfield, home runs out of the park, outs drop into a glove
    const angle = ((Math.trunc(last.time * 7) % 3) - 1) * 0.6;
    const reach = last.value === 0 ? 60 : last.value === 4 ? 260 : 90 + last.value * 30;
    const flight = age / 0.9;
    const target = [Home[0] + Math.sin(angle) * reach, Home[1] - Math.cos(angle) * reach];
    const arc = Math.sin(Math.PI * flight) * (last.value === 4 ? 60 : 25);
    const at = lerp(Home, target, flight);
    this.ball = { x: at[0], y: at[1] - arc, rot: 0 };
  }

  drawBaseball(c) {
    rect(c, 0, Bar, ArenaWidth, ArenaHeight - Bar, '#3E7D34');
    for (let stripe = 0; stripe < 10; stripe++) rect(c, stripe * 52, Bar, 26, ArenaHeight - Bar, '#468C3B');
    const dirt = '#B07A4A';
    const g = 18;
    poly(c, dirt, [Home[0], Home[1] + g], [Bases[0][0] + g, Bases[0][1]], [Bases[1][0], Bases[1][1] - g], [Bases[2][0] - g, Bases[2][1]]);
    poly(c, '#3E7D34', [Home[0], Home[1] - 26], [Bases[0][0] - 26, Bases[0][1]], [Bases[1][0], Bases[1][1] + 26], [Bases[2][0] + 26, Bases[2][1]]);
    circle(c, Mound[0], Mound[1], 12, dirt);
    circle(c, Home[0], Home[1], 16, dirt);
    for (const bag of Bases) rect(c, bag[0] - 5, bag[1] - 5, 10, 10, '#FFFFFF');
    const [hx, hy] = Home;
    poly(c, '#FFFFFF', [hx - 6, hy - 4], [hx + 6, hy - 4], [hx + 6, hy + 2], [hx, hy + 6], [hx - 6, hy + 2]);
  }

  // ---- zero-g ball

  player(side, player, t) {
    let [sx, sy] = Formation[player % Formation.length];
    if (side === 1) sx = ArenaWidth - sx;
    const phase = side * 3 + player * 1.7 + (this.match?.id ?? 0);
    return [sx + Math.sin(t * 0.6 + phase) * 40, sy + Math.cos(t * 0.8 + phase * 1.3) * 22];
  }

  goal(side) {
    // side 0 shoots at the right goal, side 1 at the left
    return [side === 0 ? CageRight - 6 : CageLeft + 6, (CageTop + CageBottom) / 2];
  }

  updateZeroG(match, play, t) {
    const score = [0, 0];
    let holder = null;
    let previous = null;
    let goal = null;
    if (play != null) {
      for (const e of play.events) {
        if (e.time > t) break;
        if (e.action === Action.Pass) {
          previous = holder;
          holder = e;
          goal = null;
        } else if (e.action === Action.Goal) {
          score[e.side]++;
          goal = e;
        }
      }
    }

    const clock = Math.max(0, t);
    for (let side = 0; side < 2; side++) {
      for (let player = 0; player < Squad; player++) {
        const at = this.player(side, player, clock);
        const spin = (clock * 25 + side * 90 + player * 50) % 360;
        this.pose(side * Squad + player, at[0], at[1], side === 0 ? Dir.East : Dir.West, play == null ? 0 : spin);
      }
    }

    this.say(`${shortName(matchName(match, 0))} ${score[0]}`, 30, Bar + 4, '#FFFFFF');
    this.say(`${score[1]} ${shortName(matchName(match, 1))}`, ArenaWidth - 30, Bar + 4, '#FFFFFF', false, true);

    let ball;
    if (goal) {
      const age = t - goal.time;
      const from = this.player(goal.side, goal.value, goal.time);
      ball = lerp(from, this.goal(goal.side), Math.min(1, age / 0.6));
      if (age < 2.5) this.say(L.goal(matchName(match, goal.side)), ArenaWidth / 2, ArenaHeight / 2 - 10, GOLD, true);
    } else if (holder) {
      const off = s => [s === 0 ? 12 : -12, -4];
      const p = this.player(holder.side, holder.value, clock);
      let at = [p[0] + off(holder.side)[0], p[1] + off(holder.side)[1]];
      const age = t - holder.time;
      if (previous && age < 0.5) {
        const q = this.player(previous.side, previous.value, holder.time);
        at = lerp([q[0] + off(previous.side)[0], q[1] + off(previous.side)[1]], at, age / 0.5);
      }
      ball = at;
    } else {
      ball = [ArenaWidth / 2, (CageTop + CageBottom) / 2 + Math.sin(t * 2) * 4];
    }
    this.ball = { x: ball[0], y: ball[1], rot: (clock * 90) % 360 };
  }

  teamColour(side) {
    const match = this.match;
    if (!match || side >= match.entrants.length) return '#FFFFFF';
    return TEAM_COLOURS[Colours[kitColour(match.sport, side, match.entrants[side])]] || '#FFFFFF';
  }

  drawZeroG(c) {
    rect(c, 0, Bar, ArenaWidth, ArenaHeight - Bar, '#05060E');
    let seed = Math.imul(this.match?.id ?? 1, 7919);
    for (let star = 0; star < 70; star++) {
      seed = (Math.imul(seed, 1103515245) + 12345) & 0x7FFFFFFF;
      const x = seed % ArenaWidth;
      seed = (Math.imul(seed, 1103515245) + 12345) & 0x7FFFFFFF;
      const y = Bar + (seed % (ArenaHeight - Bar));
      rect(c, x, y, 1.5, 1.5, rgba(WHITE, 0.3 + (star % 5) * 0.12));
    }
    const cage = [0x3F, 0xD8, 0xFF];
    frameRect(c, CageLeft, CageTop, CageRight - CageLeft, CageBottom - CageTop, rgba(cage, 0.7));
    rect(c, ArenaWidth / 2 - 1, CageTop, 2, CageBottom - CageTop, rgba(cage, 0.25));
    c.beginPath();
    c.arc(ArenaWidth / 2, (CageTop + CageBottom) / 2, 30, 0, Math.PI * 2);
    c.strokeStyle = rgba(cage, 0.25);
    c.lineWidth = 1;
    c.stroke();
    for (let side = 0; side < 2; side++) {
      const colour = this.teamColour(side);
      const goal = this.goal(1 - side);
      c.globalAlpha = 0.35;
      rect(c, goal[0] - 6, goal[1] - 34, 12, 68, colour);
      c.globalAlpha = 1;
      frameRect(c, goal[0] - 6, goal[1] - 34, 12, 68, colour);
    }
  }

  // ---- drawing

  draw() {
    const ratio = Math.max(1, Math.min(3, Math.round(window.devicePixelRatio || 1)));
    if (ratio !== this.ratio) {
      this.ratio = ratio;
      this.canvas.width = ArenaWidth * ratio;
      this.canvas.height = ArenaHeight * ratio;
    }
    const c = this.ctx;
    c.setTransform(ratio, 0, 0, ratio, 0, 0);
    c.imageSmoothingEnabled = false;
    switch (this.match?.sport) {
      case Sport.Sprint: this.drawSprint(c); break;
      case Sport.Boxing: this.drawBoxing(c); break;
      case Sport.Baseball: this.drawBaseball(c); break;
      case Sport.ZeroGBall: this.drawZeroG(c); break;
      default: rect(c, 0, 0, ArenaWidth, ArenaHeight, '#000000');
    }
    rect(c, 0, 0, ArenaWidth, Bar, '#0C0F14');
    rect(c, 0, Bar - 2, ArenaWidth, 2, '#7CFF00');

    // the dolls, then the bat and the ball, like the arena's children
    for (const d of this.dolls) {
      if (!d.visible) continue;
      const image = readyImage(`doll|${d.role}|${d.colour}|${d.dir}`, dollCanvas(d.role, d.colour, d.dir));
      if (image) sprite(c, image, d.x, d.y, 32 * d.scale, d.rot);
    }
    if (this.bat) {
      const image = readyImage(`item|${BAT.rsi}`, itemCanvas(BAT));
      if (image) sprite(c, image, this.bat.x, this.bat.y, 32, this.bat.rot);
    }
    if (this.ball && this.ballItem) {
      const image = readyImage(`item|${this.ballItem.rsi}`, itemCanvas(this.ballItem));
      if (image) sprite(c, image, this.ball.x, this.ball.y, 32 * this.ballScale, this.ball.rot);
    }

    // the text layer
    if (this.match) {
      c.font = `bold 10px ${this.font}`;
      c.textBaseline = 'top';
      c.textAlign = 'left';
      c.fillStyle = '#7CFF00';
      c.fillText(this.header || '', 8, 7);
      c.textAlign = 'right';
      c.fillStyle = '#FFFFFF';
      c.fillText(this.clock || '', ArenaWidth - 8, 7);
    }
    c.lineJoin = 'round';
    for (const text of this.texts || []) {
      c.font = `bold ${text.big ? 18 : 10}px ${this.font}`;
      c.textAlign = text.big ? 'center' : text.right ? 'right' : 'left';
      c.textBaseline = text.big ? 'middle' : 'top';
      c.lineWidth = 3;
      c.strokeStyle = '#000000';
      c.strokeText(text.text, text.x, text.y);
      c.fillStyle = text.colour;
      c.fillText(text.text, text.x, text.y);
    }
  }
}

function rect(c, x, y, w, h, colour) {
  c.fillStyle = colour;
  c.fillRect(x, y, w, h);
}

function frameRect(c, x, y, w, h, colour) {
  c.strokeStyle = colour;
  c.lineWidth = 1;
  c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function circle(c, x, y, r, colour) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = colour;
  c.fill();
}

function poly(c, colour, ...points) {
  c.beginPath();
  c.moveTo(points[0][0], points[0][1]);
  for (const p of points.slice(1)) c.lineTo(p[0], p[1]);
  c.closePath();
  c.fillStyle = colour;
  c.fill();
}

/**
 * A sprite centred on its spot. Robust angles turn anticlockwise on screen, so a world rotation of -90 lies the
 * doll down clockwise, as the arena's SpriteView.WorldRotation does.
 */
function sprite(c, image, x, y, size, degrees) {
  c.save();
  c.translate(x, y);
  if (degrees) c.rotate(-degrees * Math.PI / 180);
  c.drawImage(image, -size / 2, -size / 2, size, size);
  c.restore();
}

// ---------------------------------------------------------------- the page tag (CMUNetSportsbook)

let styled = false;

function injectStyle() {
  if (styled) return;
  styled = true;
  const style = document.createElement('style');
  style.textContent = `
.emu-sports-root { box-sizing: border-box; width: 100%; max-width: 560px; display: flex; flex-direction: column; gap: 6px;
  margin: 6px 0; color: var(--emu-sports-fg); background: var(--emu-sports-bg); font-family: var(--emu-sports-font);
  font-size: 13px; line-height: 1.35; }
.emu-sports-root * { box-sizing: border-box; }
.emu-sports-frame { align-self: flex-start; max-width: 100%; border: 2px solid var(--emu-sports-fg); line-height: 0; }
.emu-sports-arena { display: block; width: 520px; max-width: 100%; height: auto; aspect-ratio: 520 / 240; image-rendering: pixelated; }
.emu-sports-board { display: flex; flex-direction: column; gap: 6px; }
.emu-sports-heading { font-weight: bold; font-size: 15px; }
.emu-sports-key { font-weight: bold; opacity: 0.85; text-transform: none; margin-top: 4px; }
.emu-sports-wallet { display: flex; justify-content: space-between; gap: 8px; opacity: 0.9; }
.emu-sports-note { opacity: 0.75; min-height: 1em; }
.emu-sports-input { width: 140px; min-width: 120px; padding: 3px 6px; font: inherit; color: var(--emu-sports-fg);
  background: transparent; border: 1px solid var(--emu-sports-dim); outline: none; }
.emu-sports-input:focus { border-color: var(--emu-sports-fg); }
.emu-sports-input::placeholder { color: var(--emu-sports-fg); opacity: 0.45; }
.emu-sports-picks { display: grid; grid-template-columns: repeat(3, max-content); gap: 4px 6px; }
.emu-sports-button { padding: 3px 8px; font: inherit; color: var(--emu-sports-fg); background: var(--emu-sports-btn);
  border: 1px solid var(--emu-sports-dim); cursor: pointer; text-align: left; }
.emu-sports-button:hover { border-color: var(--emu-sports-fg); background: var(--emu-sports-btn-hover); }
.emu-sports-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
@media (max-width: 600px) { .emu-sports-picks { grid-template-columns: 1fr; } }
`;
  document.head.appendChild(style);
}

function hexToRgb(hex, fallback) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return fallback;
  let h = m[1];
  if (h.length === 3) h = h.split('').map(x => x + x).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const formatOdds = odds => String(Number(odds.toFixed(1)));

/**
 * The sportsbook page: plays the live match, or the next one's lineup, in an arena; takes bets from the local
 * wallet until kickoff; lists the open bets and the latest results, each of which can be watched again.
 */
export function createSportsbook(options = {}) {
  injectStyle();
  const fg = hexToRgb(options.phosphor, [0x3F, 0xE0, 0x5A]);
  const bg = options.background || '#0A0E12';
  const font = options.font || '"GameTerminal", Consolas, "Courier New", monospace';
  const arenaFont = 'GameSans, "Noto Sans", "Segoe UI", Arial, sans-serif';

  const root = el('div', 'emu-sports-root');
  root.style.setProperty('--emu-sports-fg', `rgb(${fg.join(',')})`);
  root.style.setProperty('--emu-sports-dim', rgba(fg, 0.5));
  root.style.setProperty('--emu-sports-btn', rgba(fg, 0.08));
  root.style.setProperty('--emu-sports-btn-hover', rgba(fg, 0.18));
  root.style.setProperty('--emu-sports-bg', bg);
  root.style.setProperty('--emu-sports-font', font);

  const arena = new Arena(arenaFont);
  const frame = el('div', 'emu-sports-frame');
  frame.appendChild(arena.canvas);
  const wallet = el('div', 'emu-sports-wallet');
  const balanceLabel = el('span');
  const note = el('span', 'emu-sports-note');
  wallet.append(balanceLabel, note);
  const board = el('div', 'emu-sports-board');
  board.appendChild(el('div', null, L.loading));
  root.append(frame, wallet, board);

  let state = null;
  let shown = '';
  let countdowns = [];
  let replayEnds = null;
  let noteUntil = 0;
  let lastRefresh = -Infinity;
  let detached = 0;
  let stopped = false;
  let wasConnected = false;
  const created = performance.now();

  const nowSeconds = () => Date.now() / 1000;

  const say = (text, seconds = 4) => {
    note.textContent = text;
    noteUntil = nowSeconds() + seconds;
  };

  const refreshBalance = () => {
    balanceLabel.textContent = `Balance: $${readBalance()}`;
  };

  /** The arena plays the match in progress, or else shows the lineup of the next one. */
  const feature = now => {
    if (replayEnds != null || !state) return;
    const live = state.find(m => m.result == null && m.kickoff <= now)
      ?? state.filter(m => m.result == null).sort((a, b) => a.kickoff - b.kickoff)[0]
      ?? state[0];
    if (live) arena.show(live, now);
  };

  const place = (matchId, entrant, text) => {
    const stake = /^\d{1,5}$/.test(text) ? Number(text) : NaN;
    const now = nowSeconds();
    const match = findMatch(matchId);
    // the server ignores a bet it cannot take; the emulator says why
    if (!Number.isFinite(stake)) return say('Enter a stake.');
    if (stake < MinBet || stake > MaxBet) return say(`Stakes run from $${MinBet} to $${MaxBet}.`);
    if (!match || now >= match.kickoff) return say(L.closed);
    const balance = readBalance();
    if (balance < stake) return say('Not enough money in the account.');
    writeBalance(balance - stake);
    const bets = readBets();
    bets.push({ match: matchId, entrant, amount: stake });
    writeBets(bets);
    say(`Bet placed: ${L.slip(stake, matchName(match, entrant), SPORT_NAMES[match.sport])}`);
    refreshBalance();
    shown = '';
    onState(now);
  };

  const addUpcoming = (match, now) => {
    const names = match.entrants.map((_, slot) => matchName(match, slot));
    board.appendChild(el('div', 'emu-sports-heading', L.open(SPORT_NAMES[match.sport], names.join(' vs '))));
    const countdown = el('div');
    countdowns.push({ label: countdown, kickoff: match.kickoff });
    board.appendChild(countdown);
    if (match.kickoff <= now) return;

    const amount = el('input', 'emu-sports-input');
    amount.type = 'text';
    amount.inputMode = 'numeric';
    amount.placeholder = L.amount;
    amount.dataset.match = String(match.id);
    let valid = '';
    amount.addEventListener('input', () => {
      if (amount.value.length <= 5 && /^\d*$/.test(amount.value)) valid = amount.value;
      else amount.value = valid;
    });
    const picks = el('div', 'emu-sports-picks');
    match.entrants.forEach((_, slot) => {
      const pick = el('button', 'emu-sports-button', L.betOn(matchName(match, slot), formatOdds(match.odds[slot])));
      pick.type = 'button';
      pick.addEventListener('click', () => place(match.id, slot, amount.value));
      picks.appendChild(pick);
    });
    board.append(amount, picks);
  };

  const onState = now => {
    state = boardState(now);
    feature(now);
    const bets = readBets();
    const slips = bets.map(bet => {
      const match = findMatch(bet.match);
      return match ? L.slip(bet.amount, matchName(match, bet.entrant), SPORT_NAMES[match.sport]) : null;
    }).filter(Boolean);

    // only rebuild when something changed, so a half typed stake survives the refresh
    const key = state.map(m => `${m.id}:${m.winner}:${m.result}`).join(';') + slips.join(';');
    if (key === shown) return;
    shown = key;
    // keep a stake being typed when the board rebuilds anyway
    const focused = document.activeElement?.closest?.('.emu-sports-root') === root ? document.activeElement : null;
    const typed = new Map([...board.querySelectorAll('input')].map(input => [input.dataset.match, input.value]));
    const focusedMatch = focused?.tagName === 'INPUT' ? focused.dataset.match : null;
    board.replaceChildren();
    countdowns = [];
    for (const match of state.filter(m => m.result == null).sort((a, b) => a.kickoff - b.kickoff)) addUpcoming(match, now);

    if (slips.length > 0) {
      board.appendChild(el('div', 'emu-sports-key', L.slips));
      for (const slip of slips) board.appendChild(el('div', null, slip));
    }

    board.appendChild(el('div', 'emu-sports-key', L.results));
    for (const match of state.filter(m => m.result != null)) {
      const row = el('div', 'emu-sports-row');
      row.appendChild(el('span', null, L.result(SPORT_NAMES[match.sport], matchName(match, match.winner), match.result)));
      const replay = el('button', 'emu-sports-button', L.replay);
      replay.type = 'button';
      replay.addEventListener('click', () => {
        const t = nowSeconds();
        replayEnds = t + sportLength(match.sport) + 6;
        arena.show(match, t, true);
      });
      row.appendChild(replay);
      board.appendChild(row);
    }
    for (const input of board.querySelectorAll('input')) {
      if (typed.has(input.dataset.match)) input.value = typed.get(input.dataset.match);
      if (input.dataset.match === focusedMatch) input.focus();
    }
    updateCountdowns(now);
  };

  const updateCountdowns = now => {
    for (const { label, kickoff } of countdowns) {
      const wait = kickoff - now;
      label.textContent = wait > 0 ? L.kickoff(Math.trunc(wait)) : L.closed;
    }
  };

  let lastStep = 0;
  let interval = 0;

  const step = () => {
    if (stopped) return false;
    if (!root.isConnected) {
      // not yet placed: wait; removed: give a page that moves the element around a moment, then stop for good
      if (!wasConnected) {
        if (performance.now() - created > 60000) stop();
      } else if (!detached) detached = performance.now();
      else if (performance.now() - detached > 2000) stop();
      return !stopped;
    }
    detached = 0;
    wasConnected = true;
    lastStep = performance.now();
    const now = nowSeconds();
    if (now - lastRefresh >= 1) {
      lastRefresh = now;
      if (settle(now)) say('Bets settled: winnings paid into the account.', 6);
      refreshBalance();
      onState(now);
    }
    updateCountdowns(now);
    if (replayEnds != null && now > replayEnds) {
      replayEnds = null;
      feature(now);
    }
    if (noteUntil && now > noteUntil) {
      noteUntil = 0;
      note.textContent = '';
    }
    arena.frame(now);
    return true;
  };

  // animation frames draw the arena; a slow interval keeps the board and the bets going when frames stop
  const tick = () => {
    if (step()) requestAnimationFrame(tick);
  };

  const stop = () => {
    stopped = true;
    clearInterval(interval);
  };

  interval = setInterval(() => {
    if (performance.now() - lastStep > 400) step();
  }, 500);
  requestAnimationFrame(tick);
  return root;
}
