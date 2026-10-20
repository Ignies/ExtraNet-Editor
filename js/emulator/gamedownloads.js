// Arcade games downloaded to the desktop, ported from CMUGameDownloads.cs (the cabinet's DOWNLOAD button with its
// progress bar, the downloaded game's window and stage), CMUComputerDesktop.Games.cs (the desktop icons) and
// CMUGameDownloadSystem (the computer's list of downloads, here kept in localStorage like the saved links). An icon
// is deleted like a saved link, with a right click. A game's window opens maximized, with the screen as big as
// fits at a whole number of pixels per game unit, so it stays sharp.

import { el } from '../util.js';
import { loadRsi, loadStateSheet, stateFrames } from '../sprites.js';
import { playSound } from './audio.js';
import { createSoundButton, setGameColours } from './gameui.js';

/** CMUArcadeGame, by name. */
const GAMES = ['HuggerRun', 'TrackerReflex'];
/** cmu-arcade-<Game>. */
const TITLES = { HuggerRun: 'Hugger Run', TrackerReflex: 'Tracker Reflex' };
const DOWNLOADS = 'extranet-emulator-downloads';
const SCREEN_W = 320;
const SCREEN_H = 224;
const GREEN = '#3FE05A';
const DURATION = 2.6;

/** Games/common.ftl. */
const T = {
  download: 'DOWNLOAD',
  tooltip: "Put this game on the computer's desktop, to play it full window.",
  hint: 'Put it on the desktop and play it full window.',
  downloading: percent => `DOWNLOADING... ${percent}%`,
  installing: 'Installing...',
  done: 'Saved to desktop',
  onDesktop: 'ON DESKTOP',
  iconTip: name => `${name}\nDownloaded game. Right click to delete it.`,
};

/** The sprite each game's icon shows: the hugger mid stride facing the way it runs, and the motion tracker. */
const ICONS = {
  HuggerRun: { rsi: '/Textures/_RMC14/Mobs/Xenonids/Parasite/parasite.rsi', state: 'running', direction: 2 },
  TrackerReflex: { rsi: '/Textures/_RMC14/Objects/Tools/motion_detector.rsi', state: 'detector', direction: 0 },
};

const STYLE_ID = 'emu-downloads-style';
const STYLE = `
.emu-download { display: flex; align-items: center; gap: 8px; min-height: 24px; }
.emu-download-btn { padding: 3px 10px; font: inherit; color: var(--emu-game-fg, ${GREEN}); cursor: pointer;
  background: var(--emu-game-btn, transparent); border: 1px solid var(--emu-game-dim, ${GREEN}); }
.emu-download-btn:hover:not(:disabled) { border-color: var(--emu-game-fg, ${GREEN}); background: var(--emu-game-btn-hover, transparent); }
.emu-download-btn:disabled { opacity: 0.6; cursor: default; }
.emu-download-bar { display: inline-flex; gap: 1px; width: 126px; height: 8px; padding: 1px;
  border: 1px solid var(--emu-game-fg, ${GREEN}); background: #000; }
.emu-download-bar[hidden] { display: none; }
.emu-download-bar i { flex: 1; background: transparent; }
.emu-download-bar i.on { background: var(--emu-game-fg, ${GREEN}); }
.emu-icon-art canvas.emu-game-icon { width: 32px; height: 32px; image-rendering: pixelated; }
.emu-gamewin { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.emu-gamewin-stage { flex: 1; min-height: 0; min-width: 0; display: grid; place-items: center; overflow: hidden;
  background: #000; cursor: pointer; }
.emu-gamewin-stage canvas.emu-arcade-screen { max-width: none; align-self: center; }
.emu-gamewin-bar { display: flex; align-items: center; gap: 8px; padding: 3px 6px; }
.emu-gamewin-help { flex: 1; white-space: pre-line; color: var(--dim); font-size: 12px; }
`;

function injectStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE;
  document.head.appendChild(style);
}

/** The desktop on screen, which the cabinets download to. Set when it draws its icons. */
let desktop = null;

function liveDesktop() {
  return desktop && desktop.root.isConnected ? desktop : null;
}

/** CMUPersonalComputerComponent.Downloads: the games on this desktop, in the order they came. */
function downloads() {
  try {
    const list = JSON.parse(localStorage.getItem(DOWNLOADS) || '[]');
    return Array.isArray(list) ? list.filter(game => GAMES.includes(game)) : [];
  } catch {
    return [];
  }
}

function keepDownloads(list) {
  try {
    localStorage.setItem(DOWNLOADS, JSON.stringify(list));
  } catch {
    // this visit only
  }
}

function onDesktop(game) {
  return downloads().includes(game);
}

/** A still of the game's sprite for its icon, 32 by 32. */
async function iconCanvas(game) {
  const { rsi: path, state: name, direction } = ICONS[game];
  const rsi = await loadRsi(path);
  const state = rsi.states.get(name);
  if (!state) throw new Error(`state "${name}" is not in ${path}`);
  const image = await loadStateSheet(rsi.path, name);
  const frame = stateFrames(rsi, state, image, Math.min(direction, state.directions - 1))[0];
  const canvas = document.createElement('canvas');
  canvas.className = 'emu-game-icon';
  canvas.width = rsi.size.x;
  canvas.height = rsi.size.y;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, frame.sx, frame.sy, rsi.size.x, rsi.size.y, 0, 0, rsi.size.x, rsi.size.y);
  return canvas;
}

// The cabinet's download button ----------------------------------------------------------------------------------

/**
 * CMUGameDownloadButton: DOWNLOAD, a short download with a progress bar in blocks, then the game is on the desktop.
 * Only on a page shown on the emulator's desktop.
 */
export function createDownloadRow(game) {
  injectStyle();
  const button = el('button.emu-download-btn', { type: 'button', text: T.download, title: T.tooltip });
  const blocks = Array.from({ length: 16 }, () => el('i'));
  const bar = el('span.emu-download-bar', {}, blocks);
  bar.hidden = true;
  const status = el('span.emu-download-status');
  const row = el('div.emu-download', {}, button, bar, status);
  let saved = null;
  let busy = false;

  const show = isSaved => {
    saved = isSaved;
    bar.hidden = true;
    button.disabled = isSaved;
    button.textContent = isSaved ? T.onDesktop : T.download;
    status.textContent = isSaved ? T.done : T.hint;
  };

  button.addEventListener('click', () => {
    const target = liveDesktop();
    if (busy || !target) return;
    busy = true;
    button.disabled = true;
    bar.hidden = false;
    playSound('/Audio/Machines/quickbeep.ogg', { volume: -4, source: row });
    const started = performance.now();
    const step = now => {
      const done = Math.max(0, (now - started) / 1000 / DURATION);
      if (done < 1) {
        // a colony uplink: it comes in chunks, with a stall or two
        const shown = Math.floor(Math.pow(done, 1.4) * 24) / 24;
        blocks.forEach((block, i) => block.classList.toggle('on', i < Math.floor(shown * blocks.length)));
        status.textContent = T.downloading(Math.floor(shown * 100));
        requestAnimationFrame(step);
        return;
      }
      blocks.forEach(block => block.classList.add('on'));
      status.textContent = T.installing;
      setTimeout(() => {
        busy = false;
        if (!onDesktop(game)) keepDownloads([...downloads(), game]);
        (liveDesktop() || target).buildIcons();
        show(true);
        playSound('/Audio/Machines/twobeep.ogg', { volume: -4, source: row });
      }, 300);
    };
    requestAnimationFrame(step);
  });

  // whether the game is still on the desktop, checked twice a second like the desktop's own icons
  let seen = false;
  let idle = 0;
  const check = () => {
    if (row.isConnected) seen = true;
    else if (seen || ++idle > 600) return;
    const available = !!liveDesktop();
    button.hidden = !available;
    status.hidden = !available;
    if (available && !busy && saved !== onDesktop(game)) show(onDesktop(game));
    setTimeout(check, 500);
  };
  check();
  return row;
}

// The desktop icon and window ------------------------------------------------------------------------------------

/** The downloaded games' desktop icons (CMUComputerDesktop.AddGameIcons), for the Desktop drawing them. */
export function gameIcons(owner) {
  desktop = owner;
  injectStyle();
  return downloads().map(game => {
    const title = TITLES[game];
    const node = owner.icon('game', title, () => openGame(owner, game, title), T.iconTip(title));
    const art = node.querySelector('.emu-icon-art');
    iconCanvas(game).then(canvas => art.replaceChildren(canvas)).catch(() => {});
    node.addEventListener('contextmenu', e => {
      e.preventDefault();
      keepDownloads(downloads().filter(other => other !== game));
      owner.buildIcons();
    });
    return node;
  });
}

function hexRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Sizes the screen to the stage: whole device pixels per game unit when it fits, else just fit it. */
function fit(screen, stage) {
  const ratio = window.devicePixelRatio || 1;
  const available = Math.min(stage.clientWidth * ratio / SCREEN_W, stage.clientHeight * ratio / SCREEN_H);
  if (!(available > 0)) return;
  const perUnit = available >= 1 ? Math.floor(available) : Math.max(available, 0.25);
  if (screen.dpr === perUnit && screen.canvas.width === Math.round(SCREEN_W * perUnit)) return;
  screen.dpr = perUnit;
  screen.canvas.width = Math.round(SCREEN_W * perUnit);
  screen.canvas.height = Math.round(SCREEN_H * perUnit);
  screen.canvas.style.width = `${SCREEN_W * perUnit / ratio}px`;
  screen.canvas.style.height = `${SCREEN_H * perUnit / ratio}px`;
}

/** CMUComputerDesktop.OpenGame: the game in its own maximized window, or the one already open brought back. */
export async function openGame(owner, game, title) {
  const open = owner.windows.find(win => win.game === game);
  if (open) {
    open.minimized = false;
    open.node.hidden = false;
    open.node.dispatchEvent(new PointerEvent('pointerdown'));
    return open;
  }

  const { createGameScreen } = await import('./arcade.js');
  const screen = createGameScreen(game);
  const stage = el('div.emu-gamewin-stage', {}, screen.canvas);
  stage.addEventListener('pointerdown', () => screen.canvas.focus());
  const content = el('div.emu-gamewin', {}, stage,
    el('div.emu-gamewin-bar', {}, el('div.emu-gamewin-help', { text: screen.help }), createSoundButton()));
  setGameColours(content, hexRgb(owner.theme.phosphor) || hexRgb(GREEN));

  const win = owner.addWindow('game', title, content, [680, 520]);
  win.game = game;
  // maximized as a double click on the title does, so a double click gives back the usual size
  const node = win.node;
  win.restore = { left: node.style.left, top: node.style.top, width: node.style.width, height: node.style.height };
  Object.assign(node.style, { left: '0px', top: '0px', width: `${owner.area.clientWidth}px`, height: `${owner.area.clientHeight}px` });

  const observer = new ResizeObserver(() => {
    if (!stage.isConnected) {
      observer.disconnect();
      return;
    }
    fit(screen, stage);
  });
  observer.observe(stage);
  fit(screen, stage);
  return win;
}
