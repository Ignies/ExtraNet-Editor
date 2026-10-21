// The ExtraNet sportsbook (<CMUNetSportsbook/>) for the PC emulator: a port of the CMUNetSportsbook tag of
// CMUComputerFunUi.cs (a tab per sport, each with its arena and its betting board). The leagues and the match
// simulation are in sports/core.js, the arena in sports/arena.js and each sport in its own module beside them.
// The schedule the server keeps (CMUComputerFunSystem.Schedule) is worked out here from the date instead, and
// bets come out of a local wallet.

import {
  NetRandom, f, roundEven, SPORTS, Teams, Athletes, L, SPORT_NAMES, usesTeams, entrantCount, sportLength, matchName, playMatch,
} from './sports/core.js';
import { Arena, rgba } from './sports/arena.js';
import './sports/sprint.js';
import './sports/boxing.js';
import './sports/baseball.js';
import './sports/zerog.js';
import { setGameColours, createTabs, createSoundButton } from './gameui.js';

export { NetRandom, Sport, playMatch } from './sports/core.js';

// ---------------------------------------------------------------- schedule

// CMUBetLimits
const MinBet = 10;
const MaxBet = 2000;
const Upcoming = 1;
const Results = 4;
const BettingWindow = 120;
const Gap = 30;
const DAY = 86400;
/** Ids hold the day, the sport and the match's place in that sport's day, which never reaches this. */
const PER_SPORT = 2000;

// The server keeps a chain of matches per sport: the next one is scheduled the moment the last one kicks off,
// and kicks off when its betting window closes or a gap after the last one ends, whichever is later. Here every
// UTC day has its own chain per sport from midnight, drawn from System.Random seeded with the day and the sport,
// and the last match of a day ends before the next day's first, so a chain never jumps.
const dayCache = new Map();

function dayMatches(day, sport) {
  const key = `${day}:${sport}`;
  if (dayCache.has(key)) return dayCache.get(key);
  const random = new NetRandom(day * 7919 + 2026 + sport * 104729);
  const start = day * DAY;
  const endOfDay = start + DAY;
  const matches = [];
  let last = null;
  for (let k = 0; k < PER_SPORT; k++) {
    let kickoff = (last ? last.kickoff : start) + BettingWindow;
    if (last && last.end + Gap > kickoff) kickoff = last.end + Gap;
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
      id: (day % 100000) * SPORTS.length * PER_SPORT + sport * PER_SPORT + k,
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
  dayCache.set(key, matches);
  if (dayCache.size > 16) dayCache.delete(dayCache.keys().next().value);
  return matches;
}

function findMatch(id) {
  const day = Math.floor(id / (SPORTS.length * PER_SPORT));
  const sport = Math.floor((id % (SPORTS.length * PER_SPORT)) / PER_SPORT);
  const today = Math.floor(Date.now() / 1000 / DAY);
  // ids keep the day number modulo 100000
  const full = today - ((today % 100000) - day + 100000) % 100000;
  return dayMatches(full, sport).find(m => m.id === id) || null;
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

/** What SendBets shows: for every sport, its live and next matches, then its latest results, newest first. */
function boardState(now) {
  const day = Math.floor(now / DAY);
  const shown = [];
  for (const sport of SPORTS) {
    const all = [...dayMatches(day - 1, sport), ...dayMatches(day, sport)];
    let upcoming = 0;
    for (const match of all) {
      if (now >= match.end) continue;
      if (match.kickoff > now && ++upcoming > Upcoming) break;
      shown.push(match);
    }
    shown.push(...all.filter(m => now >= m.end).slice(-Results).reverse());
  }
  return shown.map(m => publicMatch(m, now));
}

/**
 * The round's finished matches, as a page sees them in the bet state (CMUNetTape.OnBets keeps the ones with a
 * result and a winner): for YouTape's sports tapes to replay.
 */
export function finishedMatches(now = Date.now() / 1000) {
  return boardState(now).filter(m => m.result !== null && m.winner >= 0);
}

// ---------------------------------------------------------------- wallet

const WALLET_KEY = 'extranet-emulator-wallet';
const BETS_KEY = 'extranet-emulator-sportsbook-slips';
/** Bets on the old single chain of matches, whose ids no longer find them. */
const OLD_BETS_KEY = 'extranet-emulator-sportsbook-bets';
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

/** Gives back the stakes of bets made on the old schedule. Returns the refund. */
function refundOldBets() {
  try {
    const raw = localStorage.getItem(OLD_BETS_KEY);
    if (raw === null) return 0;
    localStorage.removeItem(OLD_BETS_KEY);
    const bets = JSON.parse(raw);
    const refund = Array.isArray(bets) ? bets.reduce((sum, bet) => sum + (Number(bet?.amount) || 0), 0) : 0;
    if (refund > 0) writeBalance(readBalance() + refund);
    return refund;
  } catch {
    return 0;
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

/** CMUBetSlip: the open bets, with what the board shows of each. */
function readSlips() {
  return readBets().map(bet => {
    const match = findMatch(bet.match);
    return match ? { match: match.id, sport: match.sport, entrant: bet.entrant, team: matchName(match, bet.entrant), amount: bet.amount } : null;
  }).filter(Boolean);
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
.emu-sports-tab { display: flex; flex-direction: column; gap: 6px; }
.emu-sports-frame { align-self: flex-start; max-width: 100%; border: 2px solid #7CFF00; line-height: 0; }
.emu-sports-arena { display: block; width: 520px; max-width: 100%; height: auto; aspect-ratio: 520 / 240; image-rendering: pixelated; }
/* the board keeps to the arena's width (520 + its border), so a long lineup wraps instead of running off */
.emu-sports-board { display: flex; flex-direction: column; gap: 6px; width: 524px; max-width: 100%; }
.emu-sports-heading { font-weight: bold; font-size: 15px; }
.emu-sports-key { font-weight: bold; opacity: 0.85; text-transform: none; margin-top: 4px; }
.emu-sports-wallet { display: flex; justify-content: space-between; gap: 8px; opacity: 0.9; }
.emu-sports-note { opacity: 0.75; min-height: 1em; }
.emu-sports-input { align-self: flex-start; width: 170px; min-width: 120px; padding: 3px 6px; font: inherit; color: var(--emu-sports-fg);
  background: transparent; border: 1px solid var(--emu-sports-dim); outline: none; }
.emu-sports-input:focus { border-color: var(--emu-sports-fg); }
.emu-sports-input::placeholder { color: var(--emu-sports-fg); opacity: 0.45; }
.emu-sports-picks { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 6px; }
.emu-sports-picks > * { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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

/** CMUSportsbookTab: one sport's arena, its open match, the user's bets on it and its latest results. */
class SportsbookTab {
  constructor(sport, font, place) {
    this.sport = sport;
    this.place = place;
    this.arena = Arena.create(sport, font);
    this.root = el('div', 'emu-sports-tab');
    const frame = el('div', 'emu-sports-frame');
    frame.appendChild(this.arena.canvas);
    this.board = el('div', 'emu-sports-board');
    this.board.appendChild(el('div', null, L.loading));
    this.root.append(frame, this.board);
    this.matches = [];
    this.shown = '';
    this.countdowns = [];
    this.replayEnds = null;
  }

  /** Whether this sport has a match being played right now. */
  inPlay(now) {
    return this.matches.some(m => m.result == null && m.kickoff <= now);
  }

  /** The arena plays the match in progress, or else shows the lineup of the next one. */
  feature(now) {
    if (this.replayEnds != null) return;
    const live = this.matches.find(m => m.result == null && m.kickoff <= now)
      ?? this.matches.filter(m => m.result == null).sort((a, b) => a.kickoff - b.kickoff)[0]
      ?? this.matches[0];
    if (live) this.arena.show(live, now);
  }

  setState(state, allSlips, now) {
    this.matches = state.filter(m => m.sport === this.sport);
    const slips = allSlips.filter(s => s.sport === this.sport);
    this.feature(now);

    // only rebuild when something changed, so a half typed stake survives the refresh
    const key = this.matches.map(m => `${m.id}:${m.winner}:${m.result}`).join(';')
      + slips.map(s => `${s.match}:${s.entrant}:${s.amount}`).join(';');
    if (key === this.shown) return;
    this.shown = key;
    // keep a stake being typed when the board rebuilds anyway
    const focused = this.board.contains(document.activeElement) ? document.activeElement : null;
    const typed = new Map([...this.board.querySelectorAll('input')].map(input => [input.dataset.match, input.value]));
    const focusedMatch = focused?.tagName === 'INPUT' ? focused.dataset.match : null;
    this.board.replaceChildren();
    this.countdowns = [];
    for (const match of this.matches.filter(m => m.result == null).sort((a, b) => a.kickoff - b.kickoff)) this.addUpcoming(match, now);

    if (slips.length > 0) {
      this.board.appendChild(el('div', 'emu-sports-key', L.slips));
      for (const slip of slips) this.board.appendChild(el('div', null, L.slip(slip.amount, slip.team, SPORT_NAMES[slip.sport])));
    }

    this.board.appendChild(el('div', 'emu-sports-key', L.results));
    for (const match of this.matches.filter(m => m.result != null)) {
      const row = el('div', 'emu-sports-row');
      row.appendChild(el('span', null, L.result(SPORT_NAMES[match.sport], matchName(match, match.winner), match.result)));
      const replay = el('button', 'emu-sports-button', L.replay);
      replay.type = 'button';
      replay.addEventListener('click', () => {
        const t = Date.now() / 1000;
        this.replayEnds = t + sportLength(match.sport) + 6;
        this.arena.show(match, t, true);
      });
      row.appendChild(replay);
      this.board.appendChild(row);
    }
    for (const input of this.board.querySelectorAll('input')) {
      if (typed.has(input.dataset.match)) input.value = typed.get(input.dataset.match);
      if (input.dataset.match === focusedMatch) input.focus();
    }
    this.updateCountdowns(now);
  }

  /**
   * The sport's next or live match: a countdown, then its entrants two to a row, as bet buttons while it takes bets
   * and as names with their odds once it is in play.
   */
  addUpcoming(match, now) {
    this.board.appendChild(el('div', 'emu-sports-heading', SPORT_NAMES[match.sport]));
    const countdown = el('div');
    this.countdowns.push({ label: countdown, kickoff: match.kickoff });
    this.board.appendChild(countdown);
    if (match.kickoff <= now) {
      const lineup = el('div', 'emu-sports-picks');
      match.entrants.forEach((_, slot) => lineup.appendChild(el('div', null,
        L.entrant(matchName(match, slot), formatOdds(match.odds[slot])))));
      this.board.appendChild(lineup);
      return;
    }

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
      pick.addEventListener('click', () => this.place(match.id, slot, amount.value));
      picks.appendChild(pick);
    });
    this.board.append(amount, picks);
  }

  updateCountdowns(now) {
    for (const { label, kickoff } of this.countdowns) {
      const wait = kickoff - now;
      const text = wait > 0 ? L.kickoff(Math.trunc(wait)) : L.closed;
      if (label.textContent !== text) label.textContent = text;
    }
  }

  /** Every frame: the countdowns, the end of a replay and, while the tab is on show, the arena. */
  step(now, onShow) {
    if (this.replayEnds != null && now > this.replayEnds) {
      this.replayEnds = null;
      this.feature(now);
    }
    if (!onShow) return;
    this.updateCountdowns(now);
    this.arena.frame(now);
  }
}

/**
 * The sportsbook page: a sound button and a tab per sport. Each tab plays that sport's live match, or the next
 * one's lineup, in its arena; takes bets from the local wallet until kickoff; lists the open bets on that sport
 * and its latest results, each of which can be watched again. A tab whose sport is in play says so in its title.
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
  setGameColours(root, fg);

  const wallet = el('div', 'emu-sports-wallet');
  const balanceLabel = el('span');
  const note = el('span', 'emu-sports-note');
  wallet.append(balanceLabel, note);

  let noteUntil = 0;
  const nowSeconds = () => Date.now() / 1000;
  const say = (text, seconds = 4) => {
    note.textContent = text;
    noteUntil = nowSeconds() + seconds;
  };
  const refreshBalance = () => {
    balanceLabel.textContent = `Balance: $${readBalance()}`;
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
    onState(now);
  };

  const sports = SPORTS.map(sport => new SportsbookTab(sport, arenaFont, place));
  const tabs = createTabs(sports.map(tab => SPORT_NAMES[tab.sport]), sports.map(tab => tab.root),
    { storageKey: 'extranet-emulator-sportsbook-tab' });
  root.append(createSoundButton(), wallet, tabs.root);

  const refreshTitles = now => {
    sports.forEach((tab, i) => {
      const name = SPORT_NAMES[tab.sport];
      tabs.setTitle(i, tab.inPlay(now) ? L.tabLive(name) : name);
    });
  };

  const onState = now => {
    const state = boardState(now);
    const slips = readSlips();
    for (const tab of sports) tab.setState(state, slips, now);
    refreshTitles(now);
  };

  const refund = refundOldBets();
  if (refund > 0) say(`The schedule changed: $${refund} in open bets went back into the account.`, 8);

  let lastRefresh = -Infinity;
  let detached = 0;
  let stopped = false;
  let wasConnected = false;
  const created = performance.now();
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
    if (noteUntil && now > noteUntil) {
      noteUntil = 0;
      note.textContent = '';
    }
    const onShow = root.getClientRects().length > 0;
    sports.forEach((tab, i) => tab.step(now, onShow && i === tabs.selected()));
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
