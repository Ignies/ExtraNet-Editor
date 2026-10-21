// The access tuner's window (CMUDeepHackWindow): an oscilloscope where three dials bring the tuner's wave onto the
// terminal's carrier, then a circuit board whose tiles turn to carry it to the core. A retune is only the dials. A
// trace bar runs across the top the whole time. Every action goes to the simulated server (colony.js), which
// answers with the next state; the window draws exactly what puzzle.js checks.
//
// Source: Content.CMU/Client/PersonalComputers/DeepWeb/CMUDeepHackWindow.cs (CMUDeepHackWindow, CMUDeepTraceBar,
// CMUDeepScope, CMUDeepBoard).

import { el } from '../../util.js';
import { ensureFont } from '../../fonts.js';
import { L } from '../data.js';
import { Rng } from '../net.js';
import { connections, powered, wave, NORTH, EAST, SOUTH, WEST, MAX_FREQUENCY, MAX_AMPLITUDE, PHASE_STEPS } from './puzzle.js';
import { shownState, lock, rotate, onChange, closeShown, STAGE } from './colony.js';

const GREEN = '#3FE05A';
const DIM = '#1F8A33';
const BACK = '#050A06';
const AMBER = '#FFB000';
const RED = '#E0303A';
const FONT = '13px "GameMono", "Roboto Mono", Consolas, monospace';

const CSS = `
.sim-tuner{position:absolute;display:flex;flex-direction:column;background:#1b1b1e;border:1px solid #3a3a42;color:#d6d6da;
  font:400 14.67px "GameSans","Noto Sans",sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.6)}
.sim-tuner-bar{flex:0 0 auto;display:flex;align-items:center;gap:6px;padding:4px 6px 4px 10px;background:#25252a;
  border-bottom:2px solid #3e6189;cursor:move;touch-action:none;user-select:none}
.sim-tuner-title{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-weight:700;color:#e6e6ea}
.sim-tuner-x{width:22px;height:22px;padding:0;border:0;background:none;color:#b8b8be;font:700 18px/18px "GameSans",sans-serif;cursor:pointer}
.sim-tuner-x:hover{color:#ff8a80}
.sim-tuner-body{flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;padding:10px 14px;background:${BACK};overflow:auto;
  font:${FONT};color:${GREEN}}
.sim-tuner-line{white-space:pre-wrap;overflow-wrap:anywhere}
.sim-tuner-dim{color:${DIM}}
.sim-tuner-red{color:${RED}}
.sim-tuner-trace{display:block;width:100%;height:18px;flex:0 0 auto}
.sim-tuner-stage{flex:1;min-height:0;display:flex;flex-direction:column}
.sim-tuner-scope{display:block;width:100%;height:220px;flex:0 0 auto}
.sim-tuner-board{display:block;width:100%;flex:1;min-height:260px;cursor:pointer}
.sim-tuner-dials{display:flex;flex-wrap:wrap;align-items:center;gap:18px;margin:8px 0}
.sim-tuner-dial{display:flex;align-items:center;gap:4px}
.sim-tuner-value{min-width:24px;text-align:center;color:${AMBER}}
.sim-tuner-btn{background:${BACK};color:${GREEN};border:1px solid ${GREEN};font:${FONT};padding:2px 8px;cursor:pointer}
.sim-tuner-btn:hover{background:#0c1a0e}
.sim-tuner-rule{height:1px;background:${DIM};flex:0 0 auto}
`;

/** Open tuner windows, one per terminal. */
const open = new Map();

function alpha(hex, a) {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}

/** A canvas drawn at the screen's pixel density; draw(ctx, width, height) in CSS pixels. */
function paint(canvas, draw) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  draw(ctx, w, h);
}

function line(ctx, x1, y1, x2, y2, colour) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function outline(ctx, x, y, w, h, colour) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

/** CMUDeepTraceBar: fills as the trace closes in, turns red near the end; full while locked out. */
function drawTrace(ctx, w, h, state, strings) {
  const now = Date.now();
  const total = state.traceEnds - state.traceStarted;
  const done = now < state.lockedUntil ? 1 : total <= 0 ? 0 : Math.min(1, Math.max(0, (now - state.traceStarted) / total));
  const colour = done > 0.8 ? RED : done > 0.5 ? AMBER : GREEN;
  ctx.fillStyle = BACK;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = alpha(colour, 0.7);
  ctx.fillRect(0, 0, w * done, h);
  outline(ctx, 0, 0, w, h, GREEN);
  ctx.font = FONT;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(L(strings, 'cmu-deep-hack-trace', { percent: Math.floor(done * 100) }), 6, 1);
}

/** CMUDeepScope: the carrier under static, the tuner's wave over it, and a grid. */
function drawScope(ctx, w, h, state, tuner, time) {
  ctx.fillStyle = '#020602';
  ctx.fillRect(0, 0, w, h);
  const grid = alpha(DIM, 0.35);
  for (let i = 1; i < 10; i++) line(ctx, w * i / 10, 0, w * i / 10, h, grid);
  for (let i = 1; i < 6; i++) line(ctx, 0, h * i / 6, w, h * i / 6, grid);
  const middle = h / 2;
  const unit = h / 2 / (MAX_AMPLITUDE + 1);
  const steps = Math.max(64, Math.floor(w / 2));
  // The carrier jitters with static that changes every frame, so it has to be read, not just copied.
  const noise = new Rng(Math.floor(time * 12) + 1);
  const trace = (colour, y) => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = i / steps;
      const px = x * w;
      const py = middle - y(x) * unit;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  };
  trace(DIM, x => wave(state.frequency, state.amplitude, state.phase, x) + (noise.float() * 2 - 1) * state.noise * 2.5);
  const matched = state.frequency === tuner[0] && state.amplitude === tuner[1] && state.phase === tuner[2];
  trace(matched ? '#FFFFFF' : AMBER, x => wave(tuner[0], tuner[1], tuner[2], x));
  outline(ctx, 0, 0, w, h, GREEN);
}

/** Tiles are square and centred, with room on each side for the tuner and core labels. */
function boardLayout(w, h, state) {
  const margin = 70;
  const size = Math.min((w - margin * 2) / state.width, h / state.height);
  return { size, x: (w - size * state.width) / 2, y: (h - size * state.height) / 2 };
}

/** CMUDeepBoard: trace tiles drawn as lines, lit where the carrier reaches. */
function drawBoard(ctx, w, h, state, strings) {
  if (!state.width) return;
  const { size, x: ox, y: oy } = boardLayout(w, h, state);
  const lit = powered(state.cells, state.width, state.height, state.sourceRow);
  const thick = Math.max(2, size * 0.14);
  const rect = (x1, y1, x2, y2) => ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
  state.cells.forEach((cell, i) => {
    const left = ox + (i % state.width) * size;
    const top = oy + Math.floor(i / state.width) * size;
    ctx.fillStyle = cell.locked ? '#1A0606' : '#030A04';
    ctx.fillRect(left, top, size, size);
    outline(ctx, left, top, size, size, alpha(DIM, 0.4));
    ctx.fillStyle = cell.locked ? RED : lit[i] ? '#FFFFFF' : GREEN;
    const m = connections(cell);
    const cx = left + size / 2;
    const cy = top + size / 2;
    if (m & NORTH) rect(cx - thick / 2, top, cx + thick / 2, cy + thick / 2);
    if (m & SOUTH) rect(cx - thick / 2, cy - thick / 2, cx + thick / 2, top + size);
    if (m & EAST) rect(cx - thick / 2, cy - thick / 2, left + size, cy + thick / 2);
    if (m & WEST) rect(left, cy - thick / 2, cx + thick / 2, cy + thick / 2);
    if (m) rect(cx - thick, cy - thick, cx + thick, cy + thick);
  });
  // The tuner feeds in from the left, the core waits on the right.
  ctx.font = FONT;
  ctx.textBaseline = 'top';
  const sy = oy + (state.sourceRow + 0.5) * size;
  ctx.fillStyle = '#FFFFFF';
  rect(ox - 18, sy - thick / 2, ox, sy + thick / 2);
  ctx.fillStyle = AMBER;
  ctx.fillText(L(strings, 'cmu-deep-hack-source'), ox - 68, sy - 9);
  const cx = ox + state.width * size;
  const cy = oy + (state.coreRow + 0.5) * size;
  const coreLit = lit.length > 0 && lit[state.coreRow * state.width + state.width - 1];
  ctx.fillStyle = coreLit ? '#FFFFFF' : DIM;
  rect(cx, cy - thick / 2, cx + 18, cy + thick / 2);
  ctx.fillStyle = AMBER;
  ctx.fillText(L(strings, 'cmu-deep-hack-core'), cx + 22, cy - 9);
}

function logText(strings, entry) {
  return Array.isArray(entry) ? L(strings, entry[0], entry[1]) : L(strings, entry);
}

/**
 * Opens the tuner on a terminal of the colony, in the emulator's overlay (the game opens it as a window of its
 * own, over the screen). id: the terminal; onClosed(): the window went.
 */
export function openTuner({ overlay, strings, id, onClosed = () => {} }) {
  // a window left in an emulator that has since closed goes with it
  if (open.has(id) && !open.get(id).root.isConnected) open.get(id).close();
  if (open.has(id)) {
    open.get(id).front();
    open.get(id).update();
    return open.get(id);
  }
  ensureFont('Mono');
  const title = L(strings, 'cmu-deep-hack-title');
  const x = el('button.sim-tuner-x', { type: 'button', title: 'Close', 'aria-label': 'Close', text: '×' });
  const bar = el('div.sim-tuner-bar', {}, el('span.sim-tuner-title', { text: title }), x);
  const header = el('div.sim-tuner-line');
  const traceBar = el('canvas.sim-tuner-trace');
  const help = el('div.sim-tuner-line.sim-tuner-dim');
  const stage = el('div.sim-tuner-stage');
  const log = el('div');
  const body = el('div.sim-tuner-body', {}, header, traceBar, help, stage, el('div.sim-tuner-rule'), log);
  const win = el('div.sim-tuner', { role: 'dialog', 'aria-label': title }, el('style', { text: CSS }), bar, body);
  const box = overlay.getBoundingClientRect();
  const width = Math.min(640, Math.max(320, box.width - 16));
  const height = Math.min(560, Math.max(300, box.height - 16));
  Object.assign(win.style, { width: `${width}px`, height: `${height}px`, left: `${Math.max(8, (box.width - width) / 2)}px`, top: `${Math.max(8, (box.height - height) / 2)}px` });

  const dials = [1, 1, 0];
  let shownStage = null;
  let scope = null;
  let board = null;
  let state = null;
  let time = 0;
  let last = performance.now();

  const button = (text, onclick) => el('button.sim-tuner-btn', { type: 'button', text, onclick });

  /** A dial as a value between two arrow buttons; it wraps around at either end. */
  const dial = (label, index, min, max) => {
    const value = el('span.sim-tuner-value', { text: String(dials[index]) });
    const turn = by => {
      const range = max - min + 1;
      dials[index] = ((dials[index] - min + by + range) % range) + min;
      value.textContent = String(dials[index]);
    };
    return el('div.sim-tuner-dial', {}, el('span', { text: L(strings, label) }), button('<', () => turn(-1)), value, button('>', () => turn(1)));
  };

  const buildTune = () => {
    help.textContent = L(strings, 'cmu-deep-hack-tune-help');
    board = null;
    scope = el('canvas.sim-tuner-scope');
    stage.append(scope, el('div.sim-tuner-dials', {},
      dial('cmu-deep-hack-frequency', 0, 1, MAX_FREQUENCY),
      dial('cmu-deep-hack-amplitude', 1, 1, MAX_AMPLITUDE),
      dial('cmu-deep-hack-phase', 2, 0, PHASE_STEPS - 1),
      button(L(strings, 'cmu-deep-hack-lock'), () => lock(id, dials[0], dials[1], dials[2]))));
  };

  const buildRoute = () => {
    help.textContent = L(strings, 'cmu-deep-hack-route-help');
    scope = null;
    board = el('canvas.sim-tuner-board');
    board.addEventListener('click', e => {
      if (!state || !state.width) return;
      const r = board.getBoundingClientRect();
      const { size, x: ox, y: oy } = boardLayout(r.width, r.height, state);
      const cx = Math.floor((e.clientX - r.left - ox) / size);
      const cy = Math.floor((e.clientY - r.top - oy) / size);
      if (cx < 0 || cy < 0 || cx >= state.width || cy >= state.height) return;
      rotate(id, cy * state.width + cx);
    });
    stage.append(board);
  };

  /** UpdateState: the header, the trace, the last four log lines, then the stage or the lockout banner. */
  const update = () => {
    state = shownState(id);
    if (!state) {
      close();
      return;
    }
    header.textContent = L(strings, !state.retune ? 'cmu-deep-hack-header' : state.toDark ? 'cmu-pc-retune-header-dark' : 'cmu-pc-retune-header-colony');
    log.replaceChildren(...state.log.slice(-4).map(entry => el('div.sim-tuner-line', { text: logText(strings, entry) })));
    // traced: the board is gone and no state follows, so the banner stays until the window closes
    if (state.traced || Date.now() < state.lockedUntil) {
      stage.replaceChildren(el('div.sim-tuner-line.sim-tuner-red', { text: L(strings, 'cmu-deep-hack-locked-banner') }));
      shownStage = null;
      scope = null;
      board = null;
      help.textContent = '';
      return;
    }
    if (shownStage !== state.stage) {
      shownStage = state.stage;
      stage.replaceChildren();
      if (state.stage === STAGE.Tune) buildTune();
      else buildRoute();
    }
  };

  const frame = now => {
    if (!win.isConnected) return;
    time += (now - last) / 1000;
    last = now;
    if (state) {
      paint(traceBar, (ctx, w, h) => drawTrace(ctx, w, h, state, strings));
      if (scope) paint(scope, (ctx, w, h) => drawScope(ctx, w, h, state, dials, time));
      if (board) paint(board, (ctx, w, h) => drawBoard(ctx, w, h, state, strings));
    }
    requestAnimationFrame(frame);
  };

  const front = () => {
    let z = 10;
    for (const other of overlay.children) z = Math.max(z, Number(other.style.zIndex) || 10);
    if (Number(win.style.zIndex) !== z) win.style.zIndex = String(z + 1);
  };

  const unsubscribe = onChange(() => update());
  const close = () => {
    if (!open.has(id)) return;
    open.delete(id);
    unsubscribe();
    win.remove();
    // closing the window leaves a live board running: the trace goes on, as the server's does
    closeShown(id);
    onClosed();
  };
  x.addEventListener('click', close);
  win.addEventListener('pointerdown', front);
  bar.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    const start = { x: e.clientX, y: e.clientY, left: win.offsetLeft, top: win.offsetTop };
    bar.setPointerCapture(e.pointerId);
    const move = ev => {
      win.style.left = `${start.left + ev.clientX - start.x}px`;
      win.style.top = `${Math.max(0, start.top + ev.clientY - start.y)}px`;
    };
    const up = () => {
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', up);
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
  });
  overlay.append(win);
  front();
  const handle = { front, update, close, root: win };
  open.set(id, handle);
  update();
  requestAnimationFrame(frame);
  return handle;
}

/** Closes every tuner window (the emulator going away). */
export function closeTuners() {
  for (const handle of [...open.values()]) handle.close();
}
