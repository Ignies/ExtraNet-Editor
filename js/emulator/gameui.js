// What the sportsbook and the arcade tags share on the page: the tab strip (the game's TabContainer, drawn in the
// page's colours) and the sound button (CMUGameSoundButton). Both read the colours their tag's root sets:
// --emu-game-fg, --emu-game-dim, --emu-game-btn and --emu-game-btn-hover.

import { isMuted, setMuted, onMutedChanged } from './audio.js';

const STYLE_ID = 'emu-game-ui-style';
const STYLE = `
.emu-game-tabs { display: flex; flex-direction: column; min-width: 0; }
.emu-game-tabbar { display: flex; flex-wrap: wrap; gap: 2px; }
.emu-game-tab { padding: 3px 10px; font: inherit; color: var(--emu-game-fg); background: transparent; cursor: pointer;
  border: 1px solid var(--emu-game-dim); border-bottom: 0; opacity: 0.7; }
.emu-game-tab:hover { opacity: 1; background: var(--emu-game-btn); }
.emu-game-tab[aria-selected="true"] { opacity: 1; background: var(--emu-game-btn-hover); border-color: var(--emu-game-fg);
  font-weight: bold; }
.emu-game-tab:focus-visible { outline: 1px dashed var(--emu-game-fg); outline-offset: -3px; }
.emu-game-panel { border: 1px solid var(--emu-game-dim); padding: 6px; min-width: 0; }
.emu-game-panel[hidden] { display: none; }
.emu-game-sound { align-self: flex-start; padding: 3px 8px; font: inherit; color: var(--emu-game-fg);
  background: var(--emu-game-btn); border: 1px solid var(--emu-game-dim); cursor: pointer; }
.emu-game-sound:hover { border-color: var(--emu-game-fg); background: var(--emu-game-btn-hover); }
.emu-game-sound[aria-pressed="false"] { opacity: 0.7; }
`;

export function injectGameStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE;
  document.head.appendChild(style);
}

/** Sets the shared colours on a tag's root from an [r, g, b] phosphor. */
export function setGameColours(root, rgb) {
  const rgba = a => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
  root.style.setProperty('--emu-game-fg', `rgb(${rgb.join(',')})`);
  root.style.setProperty('--emu-game-dim', rgba(0.5));
  root.style.setProperty('--emu-game-btn', rgba(0.08));
  root.style.setProperty('--emu-game-btn-hover', rgba(0.18));
}

function readTab(key) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function writeTab(key, index) {
  try {
    localStorage.setItem(key, String(index));
  } catch {
    // this visit only
  }
}

/**
 * A TabContainer: one tab per panel, the first (or the one last picked, when storageKey is given) on show.
 * Returns { root, select(index), selected(), setTitle(index, text) }; onChange(index, previous) runs on a switch.
 */
export function createTabs(titles, panels, { storageKey = null, onChange = null } = {}) {
  injectGameStyle();
  const root = document.createElement('div');
  root.className = 'emu-game-tabs';
  const bar = document.createElement('div');
  bar.className = 'emu-game-tabbar';
  bar.setAttribute('role', 'tablist');
  root.appendChild(bar);
  const buttons = titles.map((title, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'emu-game-tab';
    button.setAttribute('role', 'tab');
    button.textContent = title;
    button.addEventListener('click', () => select(i));
    bar.appendChild(button);
    const panel = panels[i];
    panel.classList.add('emu-game-panel');
    panel.setAttribute('role', 'tabpanel');
    root.appendChild(panel);
    return button;
  });

  let current = -1;
  function select(index, store = true) {
    index = Math.max(0, Math.min(panels.length - 1, index));
    if (index === current) return;
    const previous = current;
    current = index;
    buttons.forEach((button, i) => {
      button.setAttribute('aria-selected', String(i === index));
      button.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
    if (store && storageKey) writeTab(storageKey, index);
    if (onChange && previous >= 0) onChange(index, previous);
  }
  select(storageKey ? readTab(storageKey) : 0, false);

  return {
    root,
    select,
    selected: () => current,
    setTitle(index, text) {
      if (buttons[index] && buttons[index].textContent !== text) buttons[index].textContent = text;
    },
  };
}

/** The sound button: mutes or unmutes every game and arena, and follows a change made by another one. */
export function createSoundButton() {
  injectGameStyle();
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'emu-game-sound';
  const refresh = () => {
    button.textContent = isMuted() ? 'Sound: off' : 'Sound: on';
    button.setAttribute('aria-pressed', String(!isMuted()));
  };
  button.addEventListener('click', () => setMuted(!isMuted()));
  let seen = false;
  const stop = onMutedChanged(() => {
    // a button taken off the page lets go of the listener
    if (button.isConnected) seen = true;
    else if (seen) return stop();
    refresh();
  });
  refresh();
  return button;
}
