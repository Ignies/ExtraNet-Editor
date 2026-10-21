// The colony simulator's server: a few named terminals in the colony's areas with their users and statuses, the
// colony security network's unauthorized-use log, retuning terminals dark and back, and the access tuner's boards.
// The emulator is one player with no round, so this plays the server's part for the seat the player sits at and
// for the terminals around it.
//
// Sources: Content.CMU/Server/PersonalComputers/CMUSecurityNetSystem.cs (Report, Terminals, Status),
// CMUComputerRetuneSystem.cs (SetDark) and DeepWeb/CMUDeepWebSystem.cs (TryStartHack, TryStartRetune, NewBoard,
// NewRetuneBoard, OnLock, OnRotate, Fail, Solve), with the numbers of CMUDeepWebHackableComponent.

import { Rng } from '../net.js';
import { newBoard, solved, MAX_FREQUENCY, MAX_AMPLITUDE, PHASE_STEPS, TILE } from './puzzle.js';

const KEY = 'extranet-emulator-sim';

/** The colony's areas; the same names the camera consoles give the map's rooms, so both draw the same map. */
export const AREAS = ['Colony Bar', 'Hydroponics', 'Engineering', 'Medbay Lobby', 'Cargo Bay', 'Dormitory B', 'Mining Office', 'Marshal Office', 'Security Post', 'Landing Pad', 'Administration'];

/** CMUSecurityEvent */
export const EVENT = { LoginRefused: 'LoginRefused', WentDark: 'WentDark', Rejoined: 'Rejoined', HackStarted: 'HackStarted', LogWiped: 'LogWiped', LogForged: 'LogForged', DeepLookup: 'DeepLookup' };

/** CMUSecurityStatus */
export const STATUS = { Online: 'Online', LoggedIn: 'LoggedIn', Off: 'Off', Unpowered: 'Unpowered', Dark: 'Dark' };

/** CMUDeepWebHackableComponent: SkillLevel, Trace, RetuneTrace, MissPenalty, Lockout. */
export const HACKABLE = { skillLevel: 2, trace: 75, retuneTrace: 40, missPenalty: 8, lockout: 60 };

/** CMUSecurityNetSystem.MaxEntries */
const MAX_ENTRIES = 80;

/** The engineering skill levels the dock offers (RMCSkillEngineer). */
export const SKILLS = [[0, 'Untrained (0)'], [2, 'Trained (2)'], [3, 'Skilled (3)'], [4, 'Expert (4)']];

/**
 * The colony's terminals. seat: one the player can sit at, as the machine of computers.js MACHINES it is; the
 * others are other colonists' terminals, each with what it is doing.
 */
function freshTerminals() {
  return [
    { id: 14, machine: 'RMCPersonalDesktop', area: 0, seat: true, on: true, powered: true, user: null },
    { id: 22, machine: 'RMCPersonalDesktop', area: 5, seat: true, on: true, powered: true, user: null },
    { id: 31, machine: 'CMUPersonalDesktopSecurity', area: 8, seat: true, on: true, powered: true, user: null },
    { id: 9, machine: 'RMCPersonalDesktop', area: 1, on: true, powered: true, user: 'Ray Okafor' },
    { id: 17, machine: 'RMCPersonalDesktop', area: 2, on: false, powered: true, user: null },
    { id: 26, machine: 'RMCPersonalDesktop', area: 6, on: false, powered: false, user: null },
    { id: 35, machine: 'RMCPersonalDesktop', area: 3, on: true, powered: true, user: null, guest: true },
    { id: 41, machine: 'RMCPersonalDesktop', area: 4, on: true, powered: true, user: null, dark: true, hacked: true, hackSeen: true, lastSeen: 4 },
    { id: 44, machine: 'CMUPersonalDesktopWeyland', area: 10, on: true, powered: true, user: 'Ellen Marsh' },
    { id: 48, machine: 'CMUPersonalDesktopMarshal', area: 7, on: true, powered: true, user: 'Hal Brandt' },
  ];
}

/** What the shift had already reported, minutes ago. */
function freshEntries(now) {
  const at = minutes => now - minutes * 60000;
  return [
    { time: at(4), id: 22, kind: EVENT.DeepLookup, location: AREAS[5], name: null, detail: 'wyleaks.deep' },
    { time: at(9), id: 35, kind: EVENT.LogWiped, location: AREAS[3], name: null },
    { time: at(18), id: 9, kind: EVENT.LoginRefused, location: AREAS[1], name: 'Tomas Reyes' },
    { time: at(30), id: 41, kind: EVENT.WentDark, location: AREAS[4], name: 'Tomas Reyes' },
    { time: at(32), id: 41, kind: EVENT.HackStarted, location: AREAS[4], name: 'Tomas Reyes' },
  ];
}

function fresh() {
  const now = Date.now();
  // the shift started 40 minutes before the simulator did (CMUNetCmbPanel.Clock: 06:00 plus the round's time)
  return { version: 1, started: now - 40 * 60000, seat: 14, skill: 3, collapsed: false, terminals: freshTerminals(), entries: freshEntries(now) };
}

let state = null;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // this visit only
  }
}

/**
 * The simulator's state, kept in localStorage. The emulator bar's Reset clears every emulator key, this one
 * included: a state saved before and missing now starts the colony over.
 */
export function sim() {
  if (state) {
    let missing = false;
    try {
      missing = localStorage.getItem(KEY) === null;
    } catch {
      missing = false;
    }
    if (!missing) return state;
  }
  const kept = read();
  state = kept && kept.version === 1 && Array.isArray(kept.terminals) ? kept : fresh();
  save();
  return state;
}

const listeners = new Set();

/** fn(): called whenever the colony changes (a report, a retune, a board). Returns the unsubscribe. */
export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function changed() {
  save();
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch {
      // a listener gone wrong does not stop the others
    }
  }
}

/** The simulator back to its first shift. */
export function resetSim() {
  const collapsed = state ? state.collapsed : false;
  state = fresh();
  state.collapsed = collapsed;
  boards.clear();
  lastStates.clear();
  changed();
}

export function terminal(id) {
  return sim().terminals.find(t => t.id === id) || null;
}

export function seats() {
  return sim().terminals.filter(t => t.seat);
}

/** The seat the player sits at, when the emulator's computer is that seat's machine; else null. */
export function seatFor(machine) {
  const seat = terminal(sim().seat);
  return seat && seat.seat && seat.machine === machine ? seat : null;
}

/**
 * How the player's own seat is doing right now, from the emulator (on, the card's name, a guest, deep access);
 * set by the dock. Other terminals keep the status they were given.
 */
let probe = null;

export function setSeatProbe(fn) {
  probe = fn;
}

function live(t) {
  if (!probe || t.id !== sim().seat) return t;
  const now = probe();
  if (!now) return t;
  return { ...t, on: now.on, user: now.user, guest: now.guest, hacked: now.hacked };
}

/** CMUSecurityNetSystem.Location: the area a terminal stands in. */
export function location(t) {
  return AREAS[t.area] || `terminal #${t.id}`;
}

/** CMUSecurityNetSystem.Status */
export function status(t) {
  const now = live(t);
  if (now.dark) return STATUS.Dark;
  if (!now.powered) return STATUS.Unpowered;
  if (!now.on) return STATUS.Off;
  return now.user || now.guest ? STATUS.LoggedIn : STATUS.Online;
}

/**
 * CMUSecurityNetSystem.Report: a line on the unauthorized-use log. A dark terminal reports nothing; going dark is
 * reported just before it drops off, and the map keeps it where it was then.
 */
export function report(id, kind, name = null, detail = null) {
  const t = terminal(id);
  if (!t || t.dark) return;
  const s = sim();
  s.entries.unshift({ time: Date.now(), id, kind, location: location(t), name: name ?? live(t).user ?? null, detail });
  if (s.entries.length > MAX_ENTRIES) s.entries.length = MAX_ENTRIES;
  if (kind === EVENT.HackStarted) t.hackSeen = true;
  if (kind === EVENT.WentDark) t.lastSeen = t.area;
  changed();
}

/** The unauthorized-use log, newest first: { time, id, kind, location, name, detail }. */
export function entries() {
  return sim().entries;
}

/** The log's clock: the shift starts at 06:00 (CMUNetCmbPanel.Clock). */
export function clock(time) {
  const minutes = 6 * 60 + Math.floor((time - sim().started) / 60000);
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(((minutes % 60) + 60) % 60).padStart(2, '0')}`;
}

/**
 * CMUSecurityNetSystem.Terminals: every terminal, dark ones where they were last seen. Each is
 * { id, area, status, hacked, location }; hacked only where security saw the port opened and it is in the deep.
 */
export function mapTerminals() {
  const out = [];
  for (const t of sim().terminals) {
    const now = live(t);
    const st = status(t);
    const hacked = !!(t.hackSeen && now.hacked);
    if (st === STATUS.Dark) {
      // a terminal security never saw go dark is not on its map
      if (t.lastSeen === undefined || t.lastSeen === null) continue;
      out.push({ id: t.id, area: t.lastSeen, status: st, hacked, location: AREAS[t.lastSeen] || location(t) });
      continue;
    }
    out.push({ id: t.id, area: t.area, status: st, hacked, location: location(t) });
  }
  return out;
}

/** The dock's own record of the seat's deep access, kept in step with the emulator's Deep web access. */
export function setHacked(id, hacked) {
  const t = terminal(id);
  if (!t || !!t.hacked === !!hacked) return;
  t.hacked = !!hacked;
  changed();
}

export function setSeat(id) {
  const s = sim();
  if (s.seat === id) return;
  s.seat = id;
  changed();
}

export function setSkill(skill) {
  sim().skill = skill;
  changed();
}

export function setCollapsed(collapsed) {
  sim().collapsed = collapsed;
  save();
}

/**
 * CMUComputerRetuneSystem.SetDark. Security hears of it either way: going dark is the last thing the terminal
 * reports. Returns whether it changed.
 */
export function setDark(id, dark) {
  const t = terminal(id);
  if (!t || !!t.dark === dark) return false;
  if (dark) report(id, EVENT.WentDark);
  t.dark = dark;
  if (!dark) report(id, EVENT.Rejoined);
  changed();
  return true;
}

// ---------------------------------------------------------------- the access tuner (CMUDeepWebSystem)

/** CMUDeepHackStage */
export const STAGE = { Tune: 'Tune', Route: 'Route' };

/** Each terminal's open tuner board (CMUDeepWebHackableComponent.Board), for this visit. */
const boards = new Map();
let ticker = null;

function lockedUntil(t) {
  return t.lockedUntil || 0;
}

/**
 * CanTune: the skill to get into the terminal's internals, and no lockout. Returns null, or the popup that
 * refuses: { text, vars, caution }.
 */
function refusal(t, skill) {
  if (skill < HACKABLE.skillLevel) return { text: 'cmu-deep-hack-no-skill', caution: true };
  const now = Date.now();
  if (now < lockedUntil(t)) return { text: 'cmu-deep-hack-locked', vars: { seconds: Math.ceil((lockedUntil(t) - now) / 1000) }, caution: true };
  return null;
}

/** The skill steps of NewBoard and NewRetuneBoard: static on the carrier and time on the trace. */
function steps(skill) {
  if (skill >= 4) return { width: 5, height: 4, anchors: 3, noise: 0.15, trace: 1.3 };
  if (skill === 3) return { width: 6, height: 5, anchors: 2, noise: 0.35, trace: 1.1 };
  return { width: 7, height: 5, anchors: 1, noise: 0.55, trace: 1.0 };
}

/**
 * NewBoard: a fresh attempt. Better engineers get a cleaner carrier, a smaller board, more anchors and more time;
 * experts are handed the carrier and only route it.
 */
function hackBoard(skill) {
  const { width, height, anchors, noise, trace } = steps(skill);
  const rng = new Rng((Math.random() * 2 ** 31) | 0);
  const sourceRow = rng.next(height);
  const coreRow = rng.next(height);
  const cells = newBoard(rng, width, height, sourceRow, coreRow, anchors);
  const now = Date.now();
  const board = {
    retune: false,
    toDark: false,
    stage: skill >= 4 ? STAGE.Route : STAGE.Tune,
    frequency: rng.next(1, MAX_FREQUENCY + 1),
    amplitude: rng.next(1, MAX_AMPLITUDE + 1),
    phase: rng.next(PHASE_STEPS),
    noise,
    width,
    height,
    sourceRow,
    coreRow,
    cells,
    traceStarted: now,
    traceEnds: now + HACKABLE.trace * trace * 1000,
    log: [],
  };
  board.log.push(board.stage === STAGE.Tune ? 'cmu-deep-hack-log-tune' : 'cmu-deep-hack-log-route');
  return board;
}

/** NewRetuneBoard: only the carrier lock, with the same skill steps for static and time as a hack. */
function retuneBoard(skill, toDark) {
  const { noise, trace } = steps(skill);
  const now = Date.now();
  return {
    retune: true,
    toDark,
    stage: STAGE.Tune,
    frequency: 1 + Math.floor(Math.random() * MAX_FREQUENCY),
    amplitude: 1 + Math.floor(Math.random() * MAX_AMPLITUDE),
    phase: Math.floor(Math.random() * PHASE_STEPS),
    noise,
    width: 0,
    height: 0,
    sourceRow: 0,
    coreRow: 0,
    cells: [],
    traceStarted: now,
    traceEnds: now + HACKABLE.retuneTrace * trace * 1000,
    log: [toDark ? 'cmu-pc-retune-log-dark' : 'cmu-pc-retune-log-colony'],
  };
}

/**
 * The window's state (CMUDeepHackState): the board, the trace, the lockout and the log. Log lines are locale ids,
 * or [id, vars].
 */
export function hackState(id) {
  const t = terminal(id);
  const board = boards.get(id);
  if (!t || !board) return null;
  return { ...board, cells: board.cells.map(c => ({ ...c })), log: [...board.log], lockedUntil: lockedUntil(t) };
}

/**
 * TryStartHack, for the seat's terminal. Security sees the maintenance port open, unless the terminal is already
 * dark. hacked: whether it already has deep access. Returns { ok, popup }.
 */
export function startHack(id, skill, hacked) {
  const t = terminal(id);
  if (!t) return { ok: false };
  if (hacked) return { ok: false, popup: { text: 'cmu-deep-hack-already' } };
  const refused = refusal(t, skill);
  if (refused) return { ok: false, popup: refused };
  lastStates.delete(id);
  const board = boards.get(id);
  if (!board || board.retune) {
    boards.set(id, hackBoard(skill));
    report(id, EVENT.HackStarted);
  }
  tick();
  changed();
  return { ok: true };
}

/** TryStartRetune: lock onto the carrier before the trace and it goes dark, or back onto the colony if it was. */
export function startRetune(id, skill) {
  const t = terminal(id);
  if (!t) return { ok: false };
  const refused = refusal(t, skill);
  if (refused) return { ok: false, popup: refused };
  lastStates.delete(id);
  const board = boards.get(id);
  if (!board || !board.retune) boards.set(id, retuneBoard(skill, !t.dark));
  tick();
  changed();
  return { ok: true };
}

/**
 * Hooks for what the server does on success and failure, set by the dock: done({ kind: 'retune'|'hack',
 * toDark }) when the tuner closes on a solve, then popup({ text, vars, caution }) for the tuner's user.
 */
let outcome = { done: () => {}, popup: () => {} };

export function setOutcome(hooks) {
  outcome = { ...outcome, ...hooks };
}

/** OnLock: the dials against the carrier. A wrong lock speeds the trace up. */
export function lock(id, frequency, amplitude, phase) {
  const board = boards.get(id);
  if (!board || board.stage !== STAGE.Tune) return;
  const matched = frequency === board.frequency && amplitude === board.amplitude && phase === board.phase;
  if (matched && board.retune) {
    boards.delete(id);
    setDark(id, board.toDark);
    outcome.done({ kind: 'retune', toDark: board.toDark });
    outcome.popup({ text: board.toDark ? 'cmu-pc-retune-dark-done' : 'cmu-pc-retune-colony-done' });
    changed();
    return;
  }
  if (matched) {
    board.stage = STAGE.Route;
    board.log.push('cmu-deep-hack-log-locked-on', 'cmu-deep-hack-log-route');
  } else {
    board.traceEnds -= HACKABLE.missPenalty * 1000;
    board.log.push(['cmu-deep-hack-log-miss', { seconds: HACKABLE.missPenalty }]);
  }
  changed();
}

/** OnRotate: turns a tile a quarter clockwise; the board solved jacks the terminal into the deep. */
export function rotate(id, index) {
  const board = boards.get(id);
  if (!board || board.stage !== STAGE.Route || index < 0 || index >= board.cells.length) return;
  const cell = board.cells[index];
  if (cell.locked || cell.tile === TILE.Empty) return;
  board.cells[index] = { ...cell, rotation: (cell.rotation + 1) % 4 };
  if (solved(board.cells, board.width, board.height, board.sourceRow, board.coreRow)) {
    // Solve
    boards.delete(id);
    outcome.done({ kind: 'hack' });
    outcome.popup({ text: 'cmu-deep-hack-success' });
  }
  changed();
}

/** The tuner's window closes on a solve or a retune: whether this terminal still has a board open. */
export function hasBoard(id) {
  return boards.has(id);
}

/** The board each trace caught, as the window keeps showing it under the lockout banner. */
const lastStates = new Map();

/** Fail: the trace caught up. The terminal locks out, the window shows the lockout, and the board is gone. */
function fail(id) {
  const t = terminal(id);
  const board = boards.get(id);
  if (!t || !board) return;
  t.lockedUntil = Date.now() + HACKABLE.lockout * 1000;
  board.log.push('cmu-deep-hack-log-traced');
  lastStates.set(id, { ...board, cells: board.cells.map(c => ({ ...c })), log: [...board.log], lockedUntil: t.lockedUntil, traced: true });
  boards.delete(id);
  outcome.popup({ text: 'cmu-deep-hack-traced', caution: true });
  changed();
}

/** The state a window shows for a terminal: its live board, or the one the trace caught. */
export function shownState(id) {
  return hackState(id) || lastStates.get(id) || null;
}

/** Forgets the caught board once its window has closed. */
export function closeShown(id) {
  lastStates.delete(id);
}

/** CMUDeepWebSystem.Update: a board whose trace ran out fails, window open or not. */
function tick() {
  if (ticker) return;
  ticker = setInterval(() => {
    const now = Date.now();
    for (const [id, board] of [...boards]) if (now >= board.traceEnds) fail(id);
    if (!boards.size) {
      clearInterval(ticker);
      ticker = null;
    }
  }, 200);
}
