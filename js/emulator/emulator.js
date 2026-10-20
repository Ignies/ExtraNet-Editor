// The emulator: the in-game personal computer in the browser, at #emulator. The machine is drawn from the game's
// art; its power key boots the chosen OS, its card reader logs in, and the desktop browses every site of the
// library with the live widgets running in the page.

import { el } from '../util.js';
import { icon } from '../icons.js';
import { fontStack } from '../fonts.js';
import { loadIndex } from '../library.js';
import { gameData, theme as makeTheme } from './data.js';
import { Network } from './net.js';
import { Machine, CHROME } from './machine.js';
import { bootSplash } from './boot.js';
import { Desktop, loginScreen } from './desktop.js';

const SETTINGS = 'extranet-emulator-settings';

function loadSettings() {
  try {
    return { os: 'CMUOsSeegson', colony: 'StableGarrison', deep: true, name: 'Alex Reyes', job: 'Colonist', ...JSON.parse(localStorage.getItem(SETTINGS) || '{}') };
  } catch {
    return { os: 'CMUOsSeegson', colony: 'StableGarrison', deep: true, name: 'Alex Reyes', job: 'Colonist' };
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS, JSON.stringify(settings));
  } catch {
    // this visit only
  }
}

function terminalNumber() {
  try {
    let n = sessionStorage.getItem('extranet-emulator-terminal');
    if (!n) {
      n = String(1 + Math.floor(Math.random() * 98));
      sessionStorage.setItem('extranet-emulator-terminal', n);
    }
    return Number(n);
  } catch {
    return 7;
  }
}

let current = null;

/**
 * Opens the emulator over the editor. onClose: called when its back button is pressed. userSites(): the user's
 * own sites as library entries, asked for on every page load so edits show up.
 */
export async function openEmulator({ onClose, userSites = () => [] } = {}) {
  if (current) return current;
  const emu = new Emulator(onClose, userSites);
  current = emu;
  document.body.append(emu.root);
  document.documentElement.classList.add('emu-open');
  await emu.start();
  return emu;
}

export function closeEmulator() {
  if (!current) return;
  current.root.remove();
  current.dispose();
  current = null;
  document.documentElement.classList.remove('emu-open');
}

class Emulator {
  constructor(onClose, userSites) {
    this.userSites = userSites;
    this.settings = loadSettings();
    this.onClose = onClose;
    this.state = 'off';
    this.cardIn = false;
    this.terminal = terminalNumber();
    this.status = el('span.emu-bar-status', { text: 'Reading the ExtraNet…' });
    this.osSelect = el('select.input.emu-bar-select', { title: 'Operating system' });
    this.colonySelect = el('select.input.emu-bar-select', { title: 'Colony: fills {colony} and picks colony versions of pages' });
    this.deepToggle = el('input', { type: 'checkbox', checked: this.settings.deep });
    this.nameInput = el('input.input.emu-bar-name', { value: this.settings.name, title: 'The name on the ID card', maxLength: 30 });
    this.machine = new Machine({
      onPower: () => this.power(),
      onReader: () => this.reader(),
      tips: { power: 'Power', reader: 'Card reader: insert or take out an ID card' },
    });
    this.stage = el('div.emu-stage', {}, this.machine.root);
    const back = el('button.btn.btn-small', { type: 'button', onclick: () => this.onClose && this.onClose() }, icon('undo'), ' Editor');
    const reset = el('button.btn.btn-small', { type: 'button', dataset: { tip: 'Clear the emulator\'s notes, mail, links, wallpaper, board posts and wallet' }, onclick: () => this.reset() }, 'Reset');
    this.bar = el('header.emu-bar', {},
      back,
      el('span.emu-bar-title', { text: 'Emulator' }),
      el('label.emu-bar-field', {}, el('span', { text: 'OS' }), this.osSelect),
      el('label.emu-bar-field', {}, el('span', { text: 'Colony' }), this.colonySelect),
      el('label.emu-bar-field', {}, el('span', { text: 'Card' }), this.nameInput),
      el('label.emu-bar-check', { title: 'A computer hacked with an access tuner: The deeps.exi on the desktop, and a corrupted boot' }, this.deepToggle, el('span', { text: 'Deep web access' })),
      this.status,
      reset);
    this.root = el('div.emu', {}, this.bar, this.stage);
    this.onResize = () => this.fit();
    window.addEventListener('resize', this.onResize);
    for (const control of [this.osSelect, this.colonySelect, this.deepToggle]) control.addEventListener('change', () => this.reconfigure());
    this.nameInput.addEventListener('change', () => {
      this.settings.name = this.nameInput.value.trim() || 'Alex Reyes';
      saveSettings(this.settings);
    });
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
  }

  async start() {
    try {
      const [data, entries] = await Promise.all([gameData(), loadIndex()]);
      this.data = data;
      this.entries = entries;
    } catch (e) {
      this.status.textContent = `Could not read the game data: ${e.message}`;
      return;
    }
    for (const colony of this.data.colonies) this.colonySelect.append(el('option', { value: colony.id, text: colony.name }));
    this.fillOsNames();
    this.osSelect.value = this.settings.os;
    this.colonySelect.value = this.settings.colony;
    this.fillOsNames();
    this.osSelect.value = this.settings.os;
    if (!this.osSelect.value) this.osSelect.value = this.data.systems[0].id;
    if (!this.colonySelect.value) this.colonySelect.value = 'StableGarrison';
    await this.configure();
    this.fit();
    this.status.textContent = this.idleStatus();
  }

  idleStatus() {
    const own = this.net ? this.net.sites().filter(e => e.kind === 'user') : [];
    const mine = own.length ? `, your ${own.map(e => e.address).join(', ')} included` : '';
    return `${this.net ? this.net.sites().length : this.entries.length} sites on the ExtraNet${mine}. Press the power key.`;
  }

  /** The OS names as the game shows them on this colony: Seegson takes the colony's (GARRISONLINK). */
  fillOsNames() {
    const colony = this.data.colonies.find(c => c.id === this.colonySelect.value) || this.data.colonies[0];
    const value = this.osSelect.value;
    this.osSelect.replaceChildren(...this.data.systems.map(os => el('option', { value: os.id, text: makeTheme(os, this.data.strings, colony).name })));
    if (value) this.osSelect.value = value;
  }

  async configure() {
    this.fillOsNames();
    this.settings.os = this.osSelect.value;
    this.settings.colony = this.colonySelect.value;
    this.settings.deep = this.deepToggle.checked;
    saveSettings(this.settings);
    const os = this.data.systems.find(o => o.id === this.settings.os) || this.data.systems[0];
    this.colony = this.data.colonies.find(c => c.id === this.settings.colony) || this.data.colonies[0];
    this.theme = makeTheme(os, this.data.strings, this.colony);
    this.deepTheme = makeTheme(this.data.deepOs, this.data.strings, null);
    this.net = new Network(this.entries, this.theme, this.colony, this.data.strings, { deep: this.settings.deep, extraSites: this.userSites });
    const s = this.machine.screen.style;
    s.setProperty('--phosphor', this.theme.phosphor);
    s.setProperty('--os-bg', this.theme.background);
    s.setProperty('--accent', this.theme.accent);
    s.setProperty('--dim', this.theme.dim);
    s.setProperty('--bar', this.theme.bar);
    s.setProperty('--os-text', this.theme.text);
    await this.machine.setCasing(this.theme.casing).catch(e => {
      this.status.textContent = `Machine art missing: ${e.message}`;
    });
    this.fit();
  }

  async reconfigure() {
    const wasOn = this.state !== 'off';
    this.shutDown();
    await this.configure();
    if (wasOn) this.power();
  }

  /** The biggest screen that fits the window, up to 1200 x 760. */
  fit() {
    const width = this.stage.clientWidth || window.innerWidth;
    const height = this.stage.clientHeight || window.innerHeight - 52;
    const w = Math.max(560, Math.min(1200, width - 32 - CHROME.x));
    const h = Math.max(380, Math.min(760, height - 24 - CHROME.y));
    this.machine.resize(Math.floor(w), Math.floor(h));
  }

  screen(...children) {
    this.machine.screen.replaceChildren(...children, el('div.emu-scanlines'));
  }

  async power() {
    if (this.state !== 'off') {
      this.shutDown();
      return;
    }
    this.state = 'booting';
    this.status.textContent = 'Booting… (click the screen to skip)';
    this.machine.on = true;
    this.machine.pulse(3);
    this.screen();
    const boot = this.machine.screen;
    await bootSplash(boot, this.theme, this.data.strings, { corrupted: this.settings.deep });
    if (this.state !== 'booting') return;
    this.state = 'on';
    this.showSession();
  }

  shutDown() {
    if (this.data) this.status.textContent = this.idleStatus();
    this.state = 'off';
    this.machine.on = false;
    this.desktop = null;
    this.machine.screen.replaceChildren();
  }

  reader() {
    this.cardIn = !this.cardIn;
    this.machine.setCard(this.cardIn);
    if (this.state === 'on') {
      // The card animation plays before the screen changes, as the reader takes a moment.
      setTimeout(() => this.showSession(), this.cardIn ? 800 : 300);
    }
  }

  showSession() {
    if (this.state !== 'on') return;
    if (!this.cardIn) {
      this.status.textContent = 'Click the card reader to insert an ID card.';
      this.desktop = null;
      this.screen(loginScreen(this.theme, this.data.strings, this.terminal));
      return;
    }
    this.desktop = new Desktop({
      net: this.net,
      theme: this.theme,
      deepTheme: this.deepTheme,
      strings: this.data.strings,
      user: { name: this.settings.name, job: this.settings.job },
      terminal: this.terminal,
      terminalName: 'personal desktop',
      colony: this.colony,
      deep: this.settings.deep,
      wallpapers: this.data.wallpapers,
      widget: (name, args, style) => this.widget(name, args, style),
      onShutDown: () => this.shutDown(),
      onLogOff: () => this.reader(),
      busy: seconds => this.machine.pulse(seconds),
    });
    this.status.textContent = `Logged in as ${this.settings.name}. Double click an icon; the card reader logs off.`;
    const popup = el('div.emu-login-popup', { text: (this.data.strings['cmu-pc-login-popup'] || 'Logged in as {$name}.').replace(/\{\s*\$name\s*\}/, this.settings.name) });
    this.screen(this.desktop.root, popup);
    setTimeout(() => popup.remove(), 2500);
  }

  /** Live page tags: drawn by the emulator's own ports of the game's widgets. */
  widget(name, args, style) {
    const options = {
      phosphor: style.link, background: style.background, text: style.text, link: style.link, heading: style.heading,
      font: fontStack(style.font || 'Sans'),
    };
    const holder = el('div.emu-widget', { text: 'Loading…' });
    const make = {
      CMUNetSportsbook: () => import('./sports.js').then(m => m.createSportsbook(options)),
      CMUNetArcade: () => import('./arcade.js').then(m => m.createArcade(args.Game, options)),
      CMUNetSpaceGpt: () => import('./widgets.js').then(m => m.createSpaceGpt(options)),
      CMUNetRecipes: () => import('./widgets.js').then(m => m.createRecipes(args, options)),
      CMUNetMarket: () => import('./widgets.js').then(m => m.createMarket(options)),
      CMUNetCmbPanel: () => import('./widgets.js').then(m => m.createCmbPanel(args.Kind, options)),
    }[name];
    if (!make) return null;
    make().then(node => holder.replaceChildren(node)).catch(e => {
      holder.textContent = `${name} could not start: ${e.message}`;
    });
    return holder;
  }

  reset() {
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('extranet-emulator-') && key !== SETTINGS) localStorage.removeItem(key);
        if (key.startsWith('emu-w-')) localStorage.removeItem(key);
      }
      for (const key of Object.keys(sessionStorage)) if (key.startsWith('extranet-emulator-')) sessionStorage.removeItem(key);
    } catch {
      // nothing kept
    }
    this.reconfigure();
    this.status.textContent = 'Emulator storage cleared; deep aliases are new.';
  }
}
