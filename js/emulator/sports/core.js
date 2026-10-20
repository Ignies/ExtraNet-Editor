// The sportsbook's leagues, a port of CMUSports.cs: .NET's System.Random, the sports and their events, the teams
// and athletes, and Play, which works a whole match out from its seed and winner. Each sport's simulation lives
// in its own module (sprint.js, boxing.js, baseball.js, zerog.js) and registers itself with defineSport, along
// with the arena that draws it.
//
// Matches use .NET's System.Random (the seeded Net5CompatSeedImpl) and the same float rounding as the C#
// (Math.fround where the C# uses float), so a seed and winner play the same match as in game. A simulation must
// make the same random calls in the same order as its C# twin.

// ---------------------------------------------------------------- System.Random

const MBIG = 2147483647;
const MSEED = 161803398;

/**
 * .NET's System.Random(seed): Knuth's subtractive generator as in Net5CompatSeedImpl. The seeding works in C#
 * ints, whose sums wrap: for large seeds they do, so the arithmetic there goes through | 0.
 */
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
      mk = (mj - mk) | 0;
      if (mk < 0) mk += MBIG;
      mj = a[ii];
    }
    for (let k = 1; k < 5; k++) {
      for (let i = 1; i < 56; i++) {
        let n = i + 30;
        if (n >= 55) n -= 55;
        a[i] = (a[i] - a[1 + n]) | 0;
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

/** The C#'s float: every float result of the simulations goes through this. */
export const f = Math.fround;

/** Math.Round: halves go to the even neighbour. */
export function roundEven(x) {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

// ---------------------------------------------------------------- CMUSports

/** CMUSport. */
export const Sport = { Sprint: 0, Boxing: 1, Baseball: 2, ZeroGBall: 3 };
export const SPORTS = [Sport.Sprint, Sport.Boxing, Sport.Baseball, Sport.ZeroGBall];
export const SPORT_KEYS = ['Sprint', 'Boxing', 'Baseball', 'ZeroGBall'];

/**
 * CMUSportsAction. Injury: someone gets hurt and bleeds (side: the hurt side or lane, value: the player or 0,
 * extra: how bad, 1 to 3). Special: a moment only one sport knows (value: the kind, from that sport's own
 * constants; extra and state: its data).
 */
export const Action = {
  Finish: 0, Punch: 1, Knockdown: 2, Knockout: 3, Bell: 4, AtBat: 5, Pass: 6, Goal: 7, Injury: 8, Special: 9,
};

export const SprintStart = 8;
export const BoxingRounds = 3;
export const RoundLength = 24;
export const RoundRest = 6;
export const Innings = 6;
export const Squad = 3;

/** Kit colours. A team or lane wears the jumpsuit and shoes of its colour. */
export const Colours = ['Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple', 'White', 'Brown'];
/** Teams, each in the colour at the same index. */
export const Teams = [
  'Gateway Comets', 'Titan Dockers', 'Hadley Hawks', 'Thedus Tritons', 'Sol Strikers', 'Rim Runners',
  'Arcturus Aces', 'Fiorina Furies',
];
export const Athletes = [
  'Dex Mbeki', 'Ivo Laszlo', 'Rana Holt', 'Tomas Reyes', 'Kit Okonkwo', 'June Sato', 'Marco Bell',
  'Ada Novak', 'Sam Ferreira', 'Lena Dubois', 'Pike Hanlon', 'Oni Adeyemi', 'Viktor Saar', 'Bea Quinlan',
];

/** The athletes who are women, by index into Athletes, for their screams. */
const Women = new Set([2, 5, 7, 9, 13]);

export function usesTeams(sport) {
  return sport === Sport.Baseball || sport === Sport.ZeroGBall;
}

/** Whether an entrant is a woman. Team players all use the default doll, so they are not. */
export function female(sport, entrant) {
  return !usesTeams(sport) && Women.has(entrant);
}

export function entrantCount(sport) {
  return sport === Sport.Sprint ? 5 : 2;
}

/** How long a match runs from kickoff, in seconds. */
export function sportLength(sport) {
  if (sport === Sport.Sprint) return 30;
  if (sport === Sport.Boxing) return BoxingRounds * (RoundLength + RoundRest) + 4;
  return 120;
}

export function entrantName(sport, entrant) {
  const names = usesTeams(sport) ? Teams : Athletes;
  return entrant >= 0 && entrant < names.length ? names[entrant] : '?';
}

/** CMUBetMatch.Name: the name in a match's slot. */
export function matchName(match, slot) {
  return slot >= 0 && slot < match.entrants.length ? entrantName(match.sport, match.entrants[slot]) : '?';
}

/** The colour index an entrant wears: a team's own, a sprinter's lane, a boxer's corner. */
export function kitColour(sport, slot, entrant) {
  if (sport === Sport.Boxing) return slot === 0 ? 0 : 1;
  if (sport === Sport.Sprint) return slot % Colours.length;
  return entrant % Colours.length;
}

/** CMUSportsEvent. Times are floats, like the C# record's. */
export function ev(time, action, side, value, extra = 0, state = 0) {
  return { time: f(time), action, side, value, extra, state };
}

/** CMUSports.Range: a float between min and max. */
export function range(random, min, max) {
  return f(min + random.nextDouble() * (max - min));
}

// ---------------------------------------------------------------- the sports

const sports = new Map();

/**
 * Registers a sport's module: play(random, entrants, winner) returns { events, score, result } like the C#
 * simulation, and Arena is its subclass of the base Arena.
 */
export function defineSport(sport, { play, Arena }) {
  sports.set(sport, { play, Arena });
}

/** The registered module of a sport. */
export function sportModule(sport) {
  const module = sports.get(sport);
  if (!module) throw new Error(`sport ${sport} is not loaded`);
  return module;
}

/** CMUSports.Play: the whole match from its seed and winner. */
export function playMatch(sport, seed, entrants, winner) {
  const random = new NetRandom(seed);
  const play = sportModule(sport).play(random, entrants, winner);
  // List.Sort is unstable in .NET; events never share a time in practice, so a stable sort gives the same order.
  play.events.sort((a, b) => a.time - b.time);
  return play;
}

// ---------------------------------------------------------------- strings (personal-computers.ftl, Games/common.ftl)

export const SPORT_NAMES = ['100 m dash', 'Boxing', 'Baseball', 'Zero-g ball'];

/** The strings the sportsbook and every arena share. Each sport keeps its own in its module. */
export const L = {
  loading: 'Querying the bureau...',
  slip: (amount, team, sport) => `$${amount} on ${team} (${sport})`,
  kickoff: seconds => `Betting closes in ${seconds}s`,
  closed: 'In play, betting closed',
  result: (sport, winner, result) => `${sport}: ${winner} won, ${result}`,
  replay: 'Watch again',
  amount: 'Stake in dollars',
  betOn: (team, odds) => `Bet on ${team} (x${odds})`,
  entrant: (team, odds) => `${team} (x${odds})`,
  slips: 'Your bets',
  results: 'Latest results',
  starts: seconds => `Starts in ${seconds}s`,
  final: 'FINAL',
  winner: name => `${name} wins!`,
  tabLive: name => `${name} (LIVE)`,
  arenaLive: 'LIVE',
  arenaReplay: 'REPLAY',
};
