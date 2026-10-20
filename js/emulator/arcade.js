// The ExtraNet arcade (<CMUNetArcade/>, or <CMUNetArcade Game="HuggerRun"/> / Game="TrackerReflex"), ported from
// the CMUNetArcade tag and CMUArcadeCabinet of Content.CMU/Client/PersonalComputers/CMUComputerFunUi.cs. With no
// Game it shows a sound button and every cabinet in its own tab; with one, just that cabinet. The screen base
// (keyboard and drawing) is arcade/screen.js and each game is its own module beside it.
// The server's per round high score board is emulated in localStorage.

import { HuggerRun } from './arcade/hugger.js';
import { TrackerReflex } from './arcade/tracker.js';
import { TEXT } from './arcade/screen.js';
import { setGameColours, createTabs, createSoundButton } from './gameui.js';

export { ArcadeScreen, Key, mapKey, SCREEN_W, SCREEN_H } from './arcade/screen.js';

/** CMUArcadeGame, in enum order, with each cabinet's title (cmu-arcade-<Game>). */
const GAMES = {
  HuggerRun: { title: 'Hugger Run', Screen: HuggerRun },
  TrackerReflex: { title: 'Tracker Reflex', Screen: TrackerReflex },
};

// CMUArcadeLimits.MaxScore; the emulator keeps a top 5 (the server keeps CMUArcadeLimits.Board = 10).
const MAX_SCORE = 9999;
const BOARD = 5;
const DEFAULT_GREEN = '#3FE05A';
const DEFAULT_DIM = '#1F8A33';

const STYLE_ID = 'emu-arcade-style';
const STYLE = `
.emu-arcade { display: flex; flex-direction: column; gap: 6px; margin: 6px 0; padding: 8px;
  font: 13px GameSans, "Noto Sans", "Segoe UI", Arial, sans-serif; box-sizing: border-box; max-width: 100%; }
.emu-arcade-cabinet { display: flex; flex-direction: column; gap: 6px; }
.emu-arcade-heading { font-weight: bold; font-size: 15px; }
.emu-arcade-key { font-weight: bold; }
.emu-arcade-help { white-space: pre-line; }
.emu-arcade-screen { display: block; width: 320px; height: 224px; max-width: 100%; touch-action: manipulation;
  cursor: pointer; image-rendering: pixelated; align-self: flex-start; outline: none; }
.emu-arcade-scores { display: flex; flex-direction: column; gap: 2px; }
`;

function injectStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE;
  document.head.appendChild(style);
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(rgb, alpha) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// High scores ---------------------------------------------------------------------------------------------------

function storageKey(game) {
  return `extranet-emulator-arcade-${game}`;
}

function loadScores(game) {
  try {
    const raw = window.localStorage.getItem(storageKey(game));
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list
      .filter((s) => s && typeof s.name === 'string' && Number.isFinite(s.score))
      .slice(0, BOARD);
  } catch {
    return [];
  }
}

function submitScore(game, score) {
  // CMUComputerFunSystem.OnArcadeSubmit: zero and unbelievable scores are dropped.
  if (score <= 0 || score > MAX_SCORE) return loadScores(game);
  const scores = loadScores(game);
  scores.push({ name: 'You', score });
  scores.sort((a, b) => b.score - a.score);
  scores.length = Math.min(scores.length, BOARD);
  try {
    window.localStorage.setItem(storageKey(game), JSON.stringify(scores));
  } catch {
    // Storage blocked: the board just does not keep it.
  }
  return scores;
}

// The cabinet ---------------------------------------------------------------------------------------------------

/** CMUArcadeCabinet: one game's title, how to play it, its screen, and the high scores under it. */
function createCabinet(game, colors) {
  const info = GAMES[game];
  const screen = new info.Screen(colors);
  const root = el('div', 'emu-arcade-cabinet');
  root.dataset.game = game;
  root.append(el('div', 'emu-arcade-heading', info.title), el('div', 'emu-arcade-help', screen.help), screen.canvas,
    el('div', 'emu-arcade-key', TEXT.scores));
  const scoresBox = el('div', 'emu-arcade-scores');
  root.appendChild(scoresBox);

  const showScores = (scores) => {
    scoresBox.replaceChildren();
    if (scores.length === 0) scoresBox.appendChild(el('div', null, TEXT.noScores));
    scores.forEach((s, i) => scoresBox.appendChild(el('div', null, TEXT.line(i + 1, s.name, s.score))));
  };
  showScores(loadScores(game));
  screen.onGameOver = (score) => showScores(submitScore(game, score));
  return { root, screen };
}

/**
 * The arcade tag. game is the Game attribute: undefined for every cabinet in tabs, or one of HuggerRun and
 * TrackerReflex for just that one.
 * @param {string|undefined} game
 * @param {{phosphor?: string, background?: string}} options
 * @returns {HTMLElement}
 */
export function createArcade(game, options = {}) {
  injectStyle();
  const phosphor = hexToRgb(options.phosphor) ? options.phosphor : DEFAULT_GREEN;
  const background = options.background || '#0A0E12';
  const greenRgb = hexToRgb(phosphor);
  const dim = phosphor.toUpperCase() === DEFAULT_GREEN
    ? DEFAULT_DIM
    : rgba(greenRgb.map((c) => Math.round(c * 0.55)), 1);
  const colors = { green: phosphor, greenRgb, dim };

  const root = el('div', 'emu-arcade');
  root.style.background = background;
  root.style.color = phosphor;
  root.style.setProperty('--emu-arcade-green', phosphor);
  setGameColours(root, greenRgb);

  if (game !== undefined) {
    // CMUNetArcade.TryParseTag fails on a game it does not know, and the page shows a parser error
    if (!Object.hasOwn(GAMES, game)) {
      root.textContent = `Unknown arcade game: ${String(game)}`;
      return root;
    }
    root.appendChild(createCabinet(game, colors).root);
    return root;
  }

  const cabinets = Object.keys(GAMES).map(name => createCabinet(name, colors));
  const tabs = createTabs(Object.values(GAMES).map(info => info.title), cabinets.map(cabinet => cabinet.root), {
    storageKey: 'extranet-emulator-arcade-tab',
    // a game left in a hidden tab must not keep the keyboard
    onChange: () => cabinets.forEach(cabinet => cabinet.screen.release()),
  });
  root.append(createSoundButton(), tabs.root);
  return root;
}
