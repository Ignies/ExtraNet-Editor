// Printing (CMUComputerPrintSystem, CMUComputerPanel.Print): a desk terminal prints a note from Files, or a WeyBay
// receipt, onto a sheet of paper fed out of the printer's slot. The printer needs CMUComputerPrinting.Cooldown
// between sheets; a laptop has no printer at all.
//
// In game the server spawns a CMPaper where the machine stands, named "printout (NAME.TXT)", its content a titled
// sheet of the text with the markup escaped, signed "Printed for" whoever wrote it, and plays the printer's sound at
// it; the paper is an item in the world, picked up and opened with its own window (PaperWindow). The emulator has no
// world: the torn sheet lies on the desk in front of the machine, a click opens it in a paper window like the
// game's, and closing the window puts the sheet away.

import { el } from '../util.js';
import { imageUrl } from '../repo.js';
import { spriteCanvas } from '../sprites.js';
import { L } from './data.js';
import * as sound from './pcsound.js';

/** CMUComputerPrinting.Cooldown: how long a terminal's printer takes between sheets. */
const COOLDOWN = 8000;
const PRINT_SOUND = '/Audio/Machines/printer.ogg';
const PRINT_VOLUME = -4;
// The paper item's sprite (CMPaper) and its pick up sound (RMCPaperPickup, -4 dB)
const PAPER_RSI = '/Textures/_RMC14/Objects/Misc/paper.rsi';
const PICKUP_SOUND = '/Audio/_RMC14/Handling/paper_pickup.ogg';
const PAPER_BACKGROUND = '/Textures/Interface/Paper/paper_background_default.svg.96dpi.png';
/** At most this many sheets lie on the desk; the oldest goes when another comes out. */
const DESK_SHEETS = 6;

/** The English strings, for a locale without them yet. */
const FALLBACK = {
  'cmu-notes-print': 'Print',
  'cmu-print-name': 'printout ({ $name })',
  'cmu-print-signed': 'Printed for { $author }',
  'cmu-print-none': 'This machine has no printer.',
  'cmu-print-busy': 'The printer is still busy with the last sheet.',
  'paper-ui-blank-page-message': 'This page intentionally left blank',
};

export function say(strings, id, vars) {
  return L(strings[id] === undefined ? FALLBACK : strings, id, vars);
}

export class Printer {
  /**
   * machine: the Machine, whose panel feeds the paper. desk: where the torn sheets lie. overlay: where paper windows
   * open. strings: the locale.
   */
  constructor({ machine, desk, overlay, strings }) {
    this.machine = machine;
    this.desk = desk;
    this.overlay = overlay;
    this.strings = strings || {};
    this.ready = 0;
  }

  /** CMUComputerPrintSystem.CanPrint: the casing decides (no printer in a laptop). */
  get canPrint() {
    return this.machine.canPrint;
  }

  /**
   * TryPrint: a titled sheet of plain text, signed when there is an author. 'none' with no printer, 'busy' while it
   * is still on the last sheet, else 'printed'.
   */
  print(name, text, author = '') {
    if (!this.canPrint) return 'none';
    const now = performance.now();
    if (now < this.ready) return 'busy';
    this.ready = now + COOLDOWN;
    const sheet = { name, text, author, title: say(this.strings, 'cmu-print-name', { name }) };
    sound.play(PRINT_SOUND, PRINT_VOLUME);
    this.machine.print(() => this.lay(sheet));
    return 'printed';
  }

  /** The torn sheet on the desk in front of the printer: the paper item's sprite, with writing on it. */
  lay(sheet) {
    if (!this.desk.isConnected) return;
    const art = el('span.emu-sheet-art');
    const node = el('button.emu-sheet', { type: 'button', title: sheet.title, 'aria-label': sheet.title }, art);
    Promise.all([spriteCanvas(PAPER_RSI, 'paper', 3), spriteCanvas(PAPER_RSI, 'paper_words', 3)])
      .then(layers => art.replaceChildren(...layers))
      .catch(() => art.classList.add('emu-sheet-plain'));
    node.addEventListener('click', () => {
      sound.play(PICKUP_SOUND, -4);
      this.open(sheet, node);
    });
    const sheets = this.desk.querySelectorAll('.emu-sheet');
    if (sheets.length >= DESK_SHEETS) sheets[0].remove();
    // each one a little further along, as they pile up
    const count = this.desk.children.length;
    node.style.setProperty('--n', String(count % DESK_SHEETS));
    this.desk.append(node);
  }

  /** PaperWindow: the close button over the sheet, the paper's own background, the writing in dark ink. */
  open(sheet, item) {
    for (const old of this.overlay.querySelectorAll('.emu-paper')) old.remove();
    const close = el('button.emu-paper-close', { type: 'button', title: 'Close', 'aria-label': 'Close', text: '×' });
    const content = el('div.emu-paper-content', {},
      el('div.emu-paper-head', { text: sheet.name }),
      el('div.emu-paper-text', { text: sheet.text }),
      sheet.author ? el('div.emu-paper-text', { text: `\n${say(this.strings, 'cmu-print-signed', { author: sheet.author })}` }) : null);
    const paper = el('div.emu-paper-sheet', {}, el('div.emu-paper-scroll', {}, content));
    imageUrl(PAPER_BACKGROUND).then(url => {
      paper.style.borderImageSource = `url("${url}")`;
      paper.classList.add('emu-paper-textured');
    }).catch(() => {});
    const win = el('div.emu-paper', { role: 'dialog', 'aria-label': sheet.title },
      el('div.emu-paper-top', {}, el('span.emu-paper-closer', {}, close)),
      paper);
    close.addEventListener('click', () => {
      win.remove();
      // put away: the emulator has nowhere else to keep it
      if (item) item.remove();
    });
    // drag by the top strip, as a window is dragged by its background
    const top = win.firstChild;
    top.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      const start = { x: e.clientX, y: e.clientY, left: win.offsetLeft, top: win.offsetTop };
      top.setPointerCapture(e.pointerId);
      const move = ev => {
        win.style.left = `${start.left + ev.clientX - start.x}px`;
        win.style.top = `${Math.max(0, start.top + ev.clientY - start.y)}px`;
      };
      const up = () => {
        top.removeEventListener('pointermove', move);
        top.removeEventListener('pointerup', up);
      };
      top.addEventListener('pointermove', move);
      top.addEventListener('pointerup', up);
    });
    this.overlay.append(win);
    // SetSize 510 x 660, held inside the stage
    const box = this.overlay.getBoundingClientRect();
    const width = Math.min(510, box.width - 24);
    const height = Math.min(660, box.height - 24);
    Object.assign(win.style, { width: `${width}px`, height: `${height}px`, left: `${(box.width - width) / 2}px`, top: `${Math.max(8, (box.height - height) / 2)}px` });
  }

  /** The sheets lying about go when the emulator resets or the machine changes. */
  clear() {
    this.desk.replaceChildren();
    for (const old of this.overlay.querySelectorAll('.emu-paper')) old.remove();
  }
}
