// The emulator: the in-game personal computer in the browser, at #emulator. The machine is drawn from the game's
// art; its power key boots the chosen OS, its card reader logs in, and the desktop browses every site of the
// library with the live widgets running in the page. The bar picks the computer (a desk, the laptop, or a bridged
// console whose own window is a program on it), its OS and its casing; a desk prints onto paper from its printer.

import { el, hash } from '../util.js';
import { icon } from '../icons.js';
import { fontStack } from '../fonts.js';
import { errorBox } from '../render.js';
import { loadIndex } from '../library.js';
import { gameData, theme as makeTheme } from './data.js';
import { Network } from './net.js';
import { Machine, CHROME } from './machine.js';
import { bootSplash } from './boot.js';
import { Desktop, loginScreen } from './desktop.js';
import * as sound from './pcsound.js';
import { MACHINES, CASINGS, machineById, casingOf } from './computers.js';
import { Printer, say as printSay } from './printer.js';
import { consolePrograms } from './consoles.js';
import { seatFor } from './sim/colony.js';

const SETTINGS = 'extranet-emulator-settings';

const DEFAULTS = { os: 'CMUOsSeegson', colony: 'StableGarrison', deep: true, name: 'Alex Reyes', job: 'Colonist', machine: 'RMCPersonalDesktop', casing: '' };

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

/** The card's bank account (IdCardComponent.AccountNumber): six digits, the same for the same name. */
function accountOf(name) {
  return 100000 + (hash(name || 'card') % 900000);
}

/** CMUNoteLimits: a terminal's Files hold this many notes, names cut to this length. */
const NOTE_COUNT = 12;
const NOTE_NAME = 32;
const NOTE_TEXT = 2000;
const NOTES_KEY = 'extranet-emulator-notes';

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
 * What the terminal keeps while nobody is at it, as the server does (CMUPersonalComputerComponent): whether it is
 * on and since when, the card in the reader, and the programs left open on screen. Leaving the emulator is walking
 * away from the computer; coming back finds it as it was left, as long as the OS, colony and deep access are the
 * same machine.
 */
let kept = null;

/** A machine switched on this recently boots again for whoever opens it (CMUPersonalComputerWindow.JustSwitchedOn). */
const JUST_SWITCHED_ON = 2;

/** Room under the machine for the paper its printer puts on the desk. */
const DESK_ROOM = 40;

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
  kept = current.kept();
  current.root.remove();
  current.dispose();
  // Leaving the emulator silences it, the hum included.
  sound.stopAll();
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
    // browsing as a guest from the login screen, with no card (CMUPersonalComputerComponent.Guest)
    this.guest = false;
    this.terminal = terminalNumber();
    this.status = el('span.emu-bar-status', { text: 'Reading the ExtraNet…' });
    this.machineSelect = el('select.input.emu-bar-select', { title: 'The computer: a desk, the laptop, or a colony console running the OS with its own window as a program' });
    this.osSelect = el('select.input.emu-bar-select', { title: 'Operating system' });
    this.casingSelect = el('select.input.emu-bar-select', { title: "The casing: the computer's own, else its OS's (CMUPersonalComputerComponent.Casing); or any casing the game has" });
    this.colonySelect = el('select.input.emu-bar-select', { title: 'Colony: fills {colony} and picks colony versions of pages' });
    this.deepToggle = el('input', { type: 'checkbox', checked: this.settings.deep });
    this.nameInput = el('input.input.emu-bar-name', { value: this.settings.name, title: 'The name on the ID card', maxLength: 30 });
    this.machine = new Machine({
      onPower: () => this.power(),
      onReader: () => this.reader(),
      tips: { power: 'Power', reader: 'Card reader: insert or take out an ID card' },
    });
    // where printed sheets land, in front of the printer, and where windows of their own open (paper, consoles)
    this.desk = el('div.emu-desk');
    this.machine.root.append(this.desk);
    this.overlay = el('div.emu-overlay');
    this.stage = el('div.emu-stage', {}, this.machine.root, this.overlay);
    const back = el('button.btn.btn-small', { type: 'button', onclick: () => this.onClose && this.onClose() }, icon('undo'), ' Editor');
    this.muteButton = el('button.btn.btn-small.emu-mute', { type: 'button', dataset: { tip: 'Mute the computer\'s sounds' }, onclick: () => {
      sound.setMuted(!sound.isMuted());
      this.showMute();
    } });
    this.volumeSlider = el('input.emu-volume', { type: 'range', min: 0, max: 100, step: 1, value: String(Math.round(sound.getVolume() * 100)), title: 'Volume of the computer\'s sounds' });
    this.volumeSlider.addEventListener('input', () => {
      sound.setVolume(Number(this.volumeSlider.value) / 100);
      if (sound.isMuted()) sound.setMuted(false);
      this.showMute();
    });
    this.showMute();
    const reset = el('button.btn.btn-small', { type: 'button', dataset: { tip: 'Clear the emulator\'s notes, mail, links, wallpaper, board posts, wallet and WeyBay orders' }, onclick: () => this.reset() }, 'Reset');
    this.bar = el('header.emu-bar', {},
      back,
      el('span.emu-bar-title', { text: 'Emulator' }),
      el('label.emu-bar-field', {}, el('span', { text: 'Computer' }), this.machineSelect),
      el('label.emu-bar-field', {}, el('span', { text: 'OS' }), this.osSelect),
      el('label.emu-bar-field', {}, el('span', { text: 'Casing' }), this.casingSelect),
      el('label.emu-bar-field', {}, el('span', { text: 'Colony' }), this.colonySelect),
      el('label.emu-bar-field', {}, el('span', { text: 'Card' }), this.nameInput),
      el('label.emu-bar-check', { title: 'A computer hacked with an access tuner: The deeps.exi on the desktop, and a corrupted boot' }, this.deepToggle, el('span', { text: 'Deep web access' })),
      this.status,
      el('span.emu-sound', {}, this.muteButton, this.volumeSlider),
      reset);
    this.root = el('div.emu', {}, this.bar, this.stage);
    this.onResize = () => this.fit();
    window.addEventListener('resize', this.onResize);
    for (const control of [this.osSelect, this.casingSelect, this.colonySelect, this.deepToggle]) control.addEventListener('change', () => this.reconfigure());
    // a computer comes with its own OS, where it has one (the bar's OS can still be changed after)
    this.machineSelect.addEventListener('change', () => {
      const machine = machineById(this.machineSelect.value);
      if (machine.os) this.osSelect.value = machine.os;
      this.reconfigure();
    });
    // Keys typed into the computer's fields and clicks on its controls make its sounds (OnKeyTyped, OnClicked).
    this.machine.screen.addEventListener('keydown', e => {
      if (!e.target.matches || !e.target.matches('input, textarea')) return;
      if (e.key.length === 1 || ['Backspace', 'Delete', 'Enter', 'Space'].includes(e.key)) sound.keystroke(this.sounds);
    }, true);
    this.machine.screen.addEventListener('pointerdown', e => {
      // a machine found running starts its sound on the first touch, if the browser held it back
      if (this.state !== 'off') sound.unlock();
      if (e.button !== 0 || !e.target.closest) return;
      if (e.target.closest('button, .netlink, .emu-icon, .emu-win-bar, select, .term-tab')) this.click();
    }, true);
    this.nameInput.addEventListener('change', () => {
      this.settings.name = this.nameInput.value.trim() || 'Alex Reyes';
      saveSettings(this.settings);
    });
    // WeyBay's freight runs go on while the emulator is open, page or no page (CMUShopSystem.Update)
    this.shopTimer = setInterval(() => this.shopTick(), 1000);
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    clearInterval(this.shopTimer);
    this.boots = (this.boots || 0) + 1;
  }

  /** Delivers WeyBay orders that are due, once the shop has been used. */
  shopTick() {
    let pending = false;
    try {
      pending = localStorage.getItem('extranet-emulator-shop-orders') !== null;
    } catch {
      // nothing ordered that lasts
    }
    if (!pending || !this.data) return;
    import('./shop.js').then(m => (m.ordersPending() ? m.deliverDue(this.shopContext()) : null)).catch(() => {});
  }

  /**
   * What WeyBay asks of the terminal: the card in the reader (none for a guest), and where its mail and popups go.
   * The game's popups appear over the computer; the emulator shows them over its screen.
   */
  shopContext() {
    return {
      strings: this.data.strings,
      session: () => (this.state === 'on' && this.cardIn ? { buyer: this.settings.name, account: accountOf(this.settings.name) } : null),
      mail: mail => this.desktop && this.desktop.deliver(mail),
      popup: (text, caution) => this.popup(text, caution),
      time: () => (this.desktop ? this.desktop.clockText() : ''),
      // ICMUComputerHost.CanPrint, and the receipt going to Files or the printer (CMUShopSystem.OnReceipt)
      canPrint: () => this.printer.canPrint,
      print: (name, text, author) => this.printer.print(name, text, author),
      saveNote: (name, text, author) => this.addNote(name, text, author),
    };
  }

  /**
   * CMUPersonalComputerSystem.AddNote: into the terminal's Files, replacing a note of the same name, the oldest
   * going when it is full.
   */
  addNote(name, text, author) {
    let notes = [];
    try {
      notes = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]');
    } catch {
      // a fresh list
    }
    const cut = name.slice(0, NOTE_NAME);
    notes = notes.filter(n => n.name.toLowerCase() !== cut.toLowerCase());
    if (notes.length >= NOTE_COUNT) notes.shift();
    notes.push({ id: Date.now(), name: cut, text: text.slice(0, NOTE_TEXT), author });
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    } catch {
      // this visit only
    }
    if (this.desktop) this.desktop.refreshFiles();
  }

  /** CMUComputerPrintSystem.OnPrintNote: the note's sheet, NAME.TXT; quietly nothing while the printer is busy. */
  printNote(note) {
    const name = /\.txt$/i.test(note.name) ? note.name : `${note.name}.TXT`;
    this.printer.print(name, note.text, note.author || '');
  }

  /** The computer picked in the bar (computers.js). */
  get computer() {
    return machineById(this.settings.machine);
  }

  /** A popup over the screen, as the game pops one over the computer for whoever uses it. */
  popup(text, caution = false) {
    if (this.state !== 'on') return;
    const node = el(`div.emu-login-popup${caution ? '.emu-caution' : ''}`, { text });
    for (const old of this.machine.screen.querySelectorAll('.emu-login-popup')) old.remove();
    this.machine.screen.append(node);
    setTimeout(() => node.remove(), 2500);
  }

  showMute() {
    const off = sound.isMuted() || sound.getVolume() === 0;
    this.muteButton.replaceChildren(el('span', { text: off ? 'Sound off' : 'Sound on' }));
    this.muteButton.classList.toggle('off', off);
  }

  click() {
    if (this.sounds && this.state !== 'off') sound.play(this.sounds.click, sound.VOLUME.click);
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
    const group = (label, list) => el('optgroup', { label }, ...list.map(m => el('option', { value: m.id, text: m.suffix ? `${m.name} (${m.suffix})` : m.name, title: m.note || m.id })));
    this.machineSelect.append(group('Desks', MACHINES.filter(m => m.group === 'desk')), group('Consoles running the OS', MACHINES.filter(m => m.group === 'console')));
    this.machineSelect.value = this.computer.id;
    this.casingSelect.append(el('option', { value: '', text: 'As built' }), ...CASINGS.map(([id, label]) => el('option', { value: id, text: label })));
    this.casingSelect.value = this.settings.casing || '';
    this.printer = new Printer({ machine: this.machine, desk: this.desk, overlay: this.overlay, strings: this.data.strings });
    this.fillOsNames();
    this.osSelect.value = this.settings.os;
    this.colonySelect.value = this.settings.colony;
    this.fillOsNames();
    this.osSelect.value = this.settings.os;
    if (!this.osSelect.value) this.osSelect.value = this.data.systems[0].id;
    if (!this.colonySelect.value) this.colonySelect.value = 'StableGarrison';
    await this.configure();
    import('./sim/dock.js').then(m => m.simDock(this)).catch(() => {});
    this.fit();
    this.status.textContent = this.idleStatus();
    const left = kept;
    kept = null;
    if (left && left.os === this.settings.os && left.colony === this.settings.colony && left.deep === this.settings.deep
      && left.machine === this.settings.machine && left.casing === this.settings.casing) this.resume(left);
  }

  /** The terminal's state for whoever comes to it next: see kept. */
  kept() {
    return {
      os: this.settings.os,
      colony: this.settings.colony,
      deep: this.settings.deep,
      machine: this.settings.machine,
      casing: this.settings.casing,
      on: this.state !== 'off',
      poweredAt: this.poweredAt,
      cardIn: this.cardIn,
      guest: this.guest,
      // only a running session keeps its screen, a guest's too; the server clears it at power on, power off and log off
      screen: this.state === 'on' && (this.cardIn || this.guest) && this.desktop ? this.desktop.snapshot() : [],
    };
  }

  /**
   * Back at a terminal left running (CMUPersonalComputerWindow.UpdatePower): switched on just now, it boots for us;
   * a little longer ago, the hum straight away and the rest of the boot; long enough ago, straight to whatever is
   * on screen, with the windows the session left open.
   */
  resume(left) {
    this.cardIn = left.cardIn;
    this.machine.setCard(left.cardIn, false);
    if (!left.on) return;
    this.guest = !!left.guest && !left.cardIn;
    this.poweredAt = left.poweredAt;
    this.screenKept = left.screen;
    this.quietLogin = true;
    sound.unlock();
    sound.preload(this.sounds);
    const since = (performance.now() - left.poweredAt) / 1000;
    if (since < JUST_SWITCHED_ON) {
      this.bootUp(true);
      return;
    }
    if (since < this.sounds.bootLength) {
      this.bootUp(false);
      return;
    }
    this.state = 'on';
    this.machine.on = true;
    sound.startHum(this.sounds.running);
    this.showSession();
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
    const option = os => el('option', { value: os.id, text: makeTheme(os, this.data.strings, colony).name });
    this.osSelect.replaceChildren(
      el('optgroup', { label: "The game's" }, ...this.data.systems.map(option)),
      el('optgroup', { label: 'Shell previews (no OS uses them yet)' }, ...this.data.previews.map(os => {
        const node = option(os);
        node.textContent = `${node.textContent} - ${os.shell}`;
        return node;
      })));
    if (value) this.osSelect.value = value;
  }

  async configure() {
    this.fillOsNames();
    this.settings.os = this.osSelect.value;
    this.settings.colony = this.colonySelect.value;
    this.settings.deep = this.deepToggle.checked;
    this.settings.machine = this.machineSelect.value || this.settings.machine;
    this.settings.casing = this.casingSelect.value;
    saveSettings(this.settings);
    const os = [...this.data.systems, ...this.data.previews].find(o => o.id === this.settings.os) || this.data.systems[0];
    this.sounds = await sound.soundsOf(os);
    this.colony = this.data.colonies.find(c => c.id === this.settings.colony) || this.data.colonies[0];
    this.theme = makeTheme(os, this.data.strings, this.colony);
    // The computer's own settings beat its OS's: its home page, networks (a bridged console's go on top of its
    // OS's), guests and casing (CMUPersonalComputerComponent, CMUComputerBridgeServerSystem.Bridge).
    const computer = this.computer;
    if (computer.home) this.theme.home = computer.home;
    if (computer.networks) this.theme.networks = [...computer.networks];
    if (computer.extraNetworks) this.theme.networks = [...new Set([...this.theme.networks, ...computer.extraNetworks])];
    if (computer.guests === false) this.theme.allowGuests = false;
    // the colony simulator's seat (sim/): its terminal number, and retuned dark it reaches no colony network
    const seat = seatFor(computer.id);
    if (seat) this.terminal = seat.id;
    if (seat && seat.dark) this.theme.networks = [];
    this.theme.casing = casingOf(computer, os, this.settings.casing).toLowerCase();
    if (this.consoles) this.consoles.closeAll();
    this.consoles = consolePrograms(computer, {
      overlay: this.overlay,
      colony: this.colony.id,
      // OnOpenConsole: the machine on, and a card in the reader
      allowed: () => this.state === 'on' && this.cardIn,
    });
    if (this.printer) this.printer.clear();
    this.deepTheme = makeTheme(this.data.deepOs, this.data.strings, null);
    this.net = new Network(this.entries, this.theme, this.colony, this.data.strings, { deep: this.settings.deep, extraSites: this.userSites });
    this.net.dark = !!(seat && seat.dark);
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
    const h = Math.max(380, Math.min(760, height - 24 - DESK_ROOM - CHROME.y));
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
    // Switched on: a fresh screen, nothing kept from before.
    this.poweredAt = performance.now();
    this.screenKept = [];
    this.quietLogin = false;
    // The power key is the gesture browsers wait for before they play sound.
    sound.unlock();
    sound.preload(this.sounds);
    await this.bootUp(true);
  }

  /** The boot splash, then the session. withSound: the boot sound and the hum after it; else the hum at once. */
  async bootUp(withSound) {
    this.state = 'booting';
    this.status.textContent = 'Booting… (click the screen to skip)';
    const run = this.boots = (this.boots || 0) + 1;
    if (withSound) {
      sound.stopHum();
      sound.play(this.sounds.boot, sound.VOLUME.boot);
      if (this.settings.deep) sound.play(this.sounds.glitch, sound.VOLUME.glitch);
      // The running hum takes over where the boot sound settles, for as long as the machine stays on.
      setTimeout(() => {
        if (run === this.boots && this.state !== 'off') sound.startHum(this.sounds.running);
      }, this.sounds.bootLength * 1000);
      this.machine.pulse(3);
    } else {
      // already running when we got there: just the hum
      sound.startHum(this.sounds.running);
    }
    this.machine.on = true;
    this.screen();
    const boot = this.machine.screen;
    await bootSplash(boot, this.theme, this.data.strings, { corrupted: this.settings.deep });
    if (this.state !== 'booting' || run !== this.boots) return;
    this.state = 'on';
    this.showSession();
  }

  shutDown() {
    if (this.data) this.status.textContent = this.idleStatus();
    this.boots = (this.boots || 0) + 1;
    if (this.state !== 'off') {
      sound.stopHum();
      sound.play(this.sounds.shutdown, sound.VOLUME.shutdown);
    }
    this.state = 'off';
    this.machine.on = false;
    // switching off ends a guest's session too (SwitchOff, EndSession), and closes the console's windows
    this.guest = false;
    if (this.consoles) this.consoles.closeAll();
    this.desktop = null;
    this.screenKept = [];
    this.machine.screen.replaceChildren();
  }

  reader() {
    this.cardIn = !this.cardIn;
    this.machine.setCard(this.cardIn);
    // the card out ends the session: the console's windows close (CloseConsoleApps)
    if (!this.cardIn && this.consoles) this.consoles.closeAll();
    // A card put in at a guest session turns it into this user's own, on a clean screen (LogIn).
    if (this.cardIn && this.guest) {
      this.guest = false;
      this.screenKept = [];
    }
    if (this.state === 'on') {
      // The card animation plays before the screen changes, as the reader takes a moment.
      setTimeout(() => this.showSession(), this.cardIn ? 800 : 300);
    }
  }

  /** BROWSE AS GUEST (OnGuestLogin): only at the login screen of a terminal that allows it; a fresh screen. */
  loginGuest() {
    if (this.state !== 'on' || this.cardIn || this.guest || !this.theme.allowGuests) return;
    this.guest = true;
    this.screenKept = [];
    this.quietLogin = true;
    this.showSession();
  }

  /** Log off from the start menu: hands the card back, or ends a guest's session (OnLogout, EndSession). */
  logOff() {
    if (this.cardIn) {
      this.reader();
      return;
    }
    this.guest = false;
    this.showSession();
  }

  showSession() {
    if (this.state !== 'on') return;
    if (!this.cardIn && !this.guest) {
      this.status.textContent = this.theme.allowGuests
        ? 'Click the card reader to insert an ID card, or browse as a guest.'
        : 'Click the card reader to insert an ID card.';
      // the session ended: whatever it had open is gone
      this.screenKept = [];
      this.quietLogin = false;
      this.desktop = null;
      this.screen(loginScreen(this.theme, this.data.strings, this.terminal, { onGuest: () => this.loginGuest() }));
      return;
    }
    const guest = !this.cardIn;
    this.desktop = new Desktop({
      net: this.net,
      theme: this.theme,
      deepTheme: this.deepTheme,
      strings: this.data.strings,
      user: { name: this.settings.name, job: this.settings.job },
      guest,
      terminal: this.terminal,
      terminalName: this.computer.name,
      // the console's own windows, as programs; the printer, where the machine has one
      consoleApps: this.consoles ? this.consoles.programs : [],
      printer: {
        canPrint: this.printer.canPrint,
        label: printSay(this.data.strings, 'cmu-notes-print'),
        printNote: note => this.printNote(note),
      },
      colony: this.colony,
      deep: this.settings.deep,
      wallpapers: this.data.wallpapers,
      widget: (name, args, style, browser) => this.widget(name, args, style, browser),
      onShutDown: () => this.shutDown(),
      onLogOff: () => this.logOff(),
      busy: seconds => this.machine.pulse(seconds),
      poweredAt: this.poweredAt,
      sounds: {
        mail: () => sound.play(this.sounds.mail, sound.VOLUME.mail),
        error: () => sound.play(this.sounds.error, sound.VOLUME.error),
      },
    });
    // whatever the session left open, for whoever looks at the terminal now; once, then this desktop keeps it
    if (this.screenKept && this.screenKept.length) {
      const screen = this.screenKept;
      const desktop = this.desktop;
      this.screenKept = [];
      requestAnimationFrame(() => desktop.restoreScreen(screen));
    }
    const how = ['Classic', 'Weyland'].includes(this.theme.shell) ? 'Double click an icon' : 'Click a menu entry';
    this.status.textContent = guest
      ? `Browsing as a guest: no mail, no account. ${how}; log off from the menu, or insert a card to log in.`
      : `Logged in as ${this.settings.name}. ${how}; the card reader logs off.`;
    // back at a session already logged in, or a guest's (nobody logs in): no login notice
    if (this.quietLogin) {
      this.quietLogin = false;
      this.screen(this.desktop.root);
      return;
    }
    this.screen(this.desktop.root);
    this.popup((this.data.strings['cmu-pc-login-popup'] || 'Logged in as {$name}.').replace(/\{\s*\$name\s*\}/, this.settings.name));
  }

  /**
   * Live page tags: drawn by the emulator's own ports of the game's widgets. browser: { navigate(address), deeps },
   * the browser showing the page.
   */
  widget(name, args, style, browser = {}) {
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
      CMUNetCmbPanel: () => import('./widgets.js').then(m => m.createCmbPanel(args.Kind, { ...options, colony: this.colony.id })),
      CMUNetSecurityPanel: () => import('./widgets.js').then(m => m.createSecurityPanel(args.Kind, options, { colony: this.colony.id, networks: this.theme.networks, strings: this.data.strings })),
      CMUNetSearch: () => import('./search.js').then(m => m.createSearch(args, style, { net: this.net, strings: this.data.strings, ...browser })),
      CMUNetTape: () => import('./youtape.js').then(m => m.createTape(args, style, { strings: this.data.strings, colony: this.colony.name })),
      CMUNetReels: () => import('./youtape.js').then(m => m.createReels(args, style, { strings: this.data.strings, colony: this.colony.name })),
      CMUNetTapeLink: () => import('./youtape.js').then(m => m.createTapeLink(args, style, { strings: this.data.strings })
        || Object.assign(document.createElement('div'), { textContent: '<CMUNetTapeLink> needs Title="..."' })),
      CMUNetShop: () => import('./shop.js').then(m => m.createShop(args, style, this.shopContext()))
        .then(node => node || errorBox('Failed to parse CMUNetShop args', `No cmuShopCatalog with id ${args.Catalog ?? '(none)'}.`)),
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
    if (this.printer) this.printer.clear();
    this.reconfigure();
    this.status.textContent = 'Emulator storage cleared; deep aliases are new.';
  }
}
