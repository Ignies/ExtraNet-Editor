// The OS desktop (CMUComputerDesktop, CMUDesktopWindow, CMUDesktopIcon, CMUComputerApps): wallpaper, program
// icons and saved links filling down columns, program windows that drag, resize, maximize and minimize, and a
// taskbar with the start menu and the shift clock. Also the login screen that waits for an ID card.

import { el } from '../util.js';
import { imageUrl } from '../repo.js';
import { renderDocument, themeColours } from '../render.js';
import { L } from './data.js';
import { NetBrowser } from './netbrowser.js';

const ICON_ROOT = '/Textures/CMU14/PersonalComputers/Icons/';
const SIZES = { browser: [640, 440], files: [560, 380], mail: [620, 420], deeps: [640, 440], system: [560, 300] };

function store(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function keep(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // this visit only
  }
}

/** The shift clock: the round starts at 06:00. */
function shiftClock(since) {
  const minutes = 6 * 60 + Math.floor((performance.now() - since) / 60000);
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** A phosphor glyph for programs the OS has no icon for, as CMUDesktopIcon.DrawGlyph. */
function glyph(app) {
  const body = app === 'browser' || app === 'deeps'
    ? '<circle cx="16" cy="16" r="14" fill="currentColor" fill-opacity=".18" stroke="currentColor"/><circle cx="16" cy="16" r="6.3" fill="none" stroke="currentColor"/><path d="M2 16h28M16 2v28" stroke="currentColor"/>'
    : app === 'files'
      ? '<rect x="2" y="3" width="13" height="5" fill="currentColor"/><rect x="2" y="8" width="28" height="23" fill="currentColor" fill-opacity=".18" stroke="currentColor"/><path d="M2 13h28" stroke="currentColor"/>'
      : '<rect x="3" y="1" width="26" height="22" fill="currentColor" fill-opacity=".18" stroke="currentColor"/><path d="M7 6h12M7 11h12M7 16h12" stroke="currentColor"/><rect x="13" y="23" width="6" height="6" fill="currentColor"/><rect x="5" y="29" width="22" height="3" fill="currentColor"/>';
  const span = el('span.emu-glyph');
  span.innerHTML = `<svg viewBox="0 0 32 32" width="32" height="32" shape-rendering="crispEdges">${body}</svg>`;
  return span;
}

async function appIcon(theme, app) {
  for (const name of [`${theme.id.toLowerCase()}_${app}.png`, `${app}.png`]) {
    try {
      return await imageUrl(ICON_ROOT + name);
    } catch {
      // try the next
    }
  }
  return null;
}

function iconNode(theme, app) {
  const holder = el('span.emu-icon-art', {}, glyph(app));
  appIcon(theme, app).then(url => {
    if (url) holder.replaceChildren(el('img', { src: url, alt: '' }));
  });
  return holder;
}

export class Desktop {
  /**
   * ctx = { net, theme, deepTheme, strings, user: { name, job }, terminal, colony, deep, widget(name, args, style),
   *         wallpapers: Map, onShutDown(), onLogOff(), busy(seconds) }
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.theme = ctx.theme;
    this.strings = ctx.strings;
    this.windows = [];
    this.z = 10;
    this.booted = performance.now();
    this.area = el('div.emu-area');
    this.icons = el('div.emu-icons');
    this.tasks = el('div.emu-tasks');
    this.clock = el('span.emu-clock');
    this.startMenu = this.buildStartMenu();
    this.startMenu.hidden = true;
    const start = el('button.emu-start', { type: 'button', text: this.theme.startLabel, onclick: e => {
      e.stopPropagation();
      this.startMenu.hidden = !this.startMenu.hidden;
    } });
    this.area.append(this.icons, this.startMenu);
    this.area.addEventListener('pointerdown', e => {
      if (e.target === this.area || e.target === this.icons) {
        this.select(null);
        this.startMenu.hidden = true;
      }
    });
    this.root = el('div.emu-desktop', {}, this.area, el('div.emu-rule'), el('div.emu-taskbar', {}, start, this.tasks, this.clock));
    this.applyWallpaper();
    this.buildIcons();
    const tick = () => {
      if (!this.root.isConnected && this.attached) return;
      if (this.root.isConnected) this.attached = true;
      this.clock.textContent = shiftClock(this.booted);
      setTimeout(tick, 1000);
    };
    tick();
  }

  t(id, vars) {
    return L(this.strings, id, vars);
  }

  // ------------------------------------------------------------ wallpaper and icons

  /** A wallpaper found on the ExtraNet takes over from the OS one. Without one: a faint grid and the OS name. */
  applyWallpaper() {
    const id = store('extranet-emulator-wallpaper', null);
    const wallpaper = id && this.ctx.wallpapers.get(id);
    const path = wallpaper ? wallpaper.path : this.theme.os.wallpaper;
    this.area.classList.toggle('emu-gridded', !path);
    this.area.dataset.osname = this.theme.name;
    this.area.style.backgroundImage = '';
    if (path) {
      imageUrl(path).then(url => {
        this.area.style.backgroundImage = `url("${url}")`;
      }).catch(() => this.area.classList.add('emu-gridded'));
    }
  }

  setWallpaper(id) {
    keep('extranet-emulator-wallpaper', id);
    this.applyWallpaper();
  }

  shortcuts() {
    return store('extranet-emulator-shortcuts', []);
  }

  buildIcons() {
    this.icons.replaceChildren();
    const programs = [['browser', 'cmu-pc-app-browser'], ['files', 'cmu-pc-app-files'], ['system', 'cmu-pc-app-system'], ['mail', 'cmu-pc-app-mail']];
    if (this.ctx.deep) programs.push(['deeps', 'cmu-pc-app-deeps']);
    for (const [app, label] of programs) this.icons.append(this.icon(app, this.t(label), () => this.open(app)));
    for (const shortcut of this.shortcuts()) {
      const deep = this.ctx.deep && (/^deeps:\/\//.test(shortcut.address) || /\.ad$|\.deep$/.test(shortcut.address.split('/')[0]));
      const icon = this.icon(deep ? 'deeps' : 'browser', shortcut.title, () => this.openLink(shortcut.address, deep), `${shortcut.title}\n${shortcut.address}`);
      icon.addEventListener('contextmenu', e => {
        e.preventDefault();
        keep('extranet-emulator-shortcuts', this.shortcuts().filter(s => s.address !== shortcut.address));
        this.buildIcons();
      });
      this.icons.append(icon);
    }
  }

  icon(app, label, open, tip = label) {
    const short = label.length <= 13 ? label : label.slice(0, 12) + '~';
    const node = el('button.emu-icon', { type: 'button', title: tip }, iconNode(this.theme, app), el('span.emu-icon-label', { text: short }));
    node.addEventListener('click', () => this.select(node));
    node.addEventListener('dblclick', () => {
      this.ctx.busy(0.4);
      open();
    });
    return node;
  }

  select(node) {
    for (const icon of this.icons.children) icon.classList.toggle('on', icon === node);
  }

  saveLink({ title, address }) {
    const list = this.shortcuts().filter(s => s.address !== address);
    list.push({ title: title.slice(0, 40), address });
    keep('extranet-emulator-shortcuts', list);
    this.buildIcons();
  }

  // ------------------------------------------------------------ start menu and taskbar

  buildStartMenu() {
    const menu = el('div.emu-startmenu');
    menu.append(el('div.emu-start-name', { text: this.theme.name }), el('div.emu-rule'));
    const apps = [['browser', 'cmu-pc-app-browser'], ['files', 'cmu-pc-app-files'], ['system', 'cmu-pc-app-system'], ['deeps', 'cmu-pc-app-deeps']];
    for (const [app, label] of apps) {
      if (app === 'deeps' && !this.ctx.deep) continue;
      menu.append(el('button.emu-btn.emu-app-btn', { type: 'button', onclick: () => {
        menu.hidden = true;
        this.open(app);
      } }, iconNode(this.theme, app), el('span', { text: this.t(label) })));
    }
    menu.append(el('button.emu-btn', { type: 'button', text: this.t('cmu-pc-start-log-off'), onclick: () => {
      menu.hidden = true;
      this.ctx.onLogOff();
    } }));
    menu.append(el('div.emu-rule'), el('button.emu-btn', { type: 'button', text: this.t('cmu-pc-start-shut-down'), onclick: () => this.ctx.onShutDown() }));
    return menu;
  }

  // ------------------------------------------------------------ windows

  addWindow(app, title, content, [w, h]) {
    const area = this.area.getBoundingClientRect();
    const offset = 10 + (this.windows.length % 6) * 24;
    const width = Math.min(w, Math.max(260, area.width - offset - 6));
    const height = Math.min(h, Math.max(160, area.height - offset - 6));
    const titleText = el('span.emu-win-title', { text: title });
    const min = el('button.emu-win-btn', { type: 'button', text: '_', title: this.t('cmu-pc-window-minimize') });
    const close = el('button.emu-win-btn', { type: 'button', text: 'X', title: this.t('cmu-pc-window-close') });
    const bar = el('div.emu-win-bar', {}, iconNode(this.theme, app), titleText, min, close);
    const grip = el('div.emu-win-grip');
    const node = el('div.emu-window', {}, bar, el('div.emu-win-body', {}, content), grip);
    if (app === 'deeps') this.skin(node, this.ctx.deepTheme);
    Object.assign(node.style, { left: `${offset}px`, top: `${offset}px`, width: `${width}px`, height: `${height}px` });
    const task = el('button.emu-task', { type: 'button', text: title });
    const win = { node, task, titleText, app, minimized: false, restore: null };
    const focus = () => {
      node.style.zIndex = String(++this.z);
      for (const other of this.windows) other.task.classList.toggle('on', other === win);
    };
    node.addEventListener('pointerdown', focus);
    task.addEventListener('click', () => {
      if (win.minimized || node.style.zIndex !== String(this.z)) {
        win.minimized = false;
        node.hidden = false;
        focus();
      } else {
        win.minimized = true;
        node.hidden = true;
      }
    });
    min.addEventListener('click', e => {
      e.stopPropagation();
      win.minimized = true;
      node.hidden = true;
    });
    close.addEventListener('click', e => {
      e.stopPropagation();
      node.remove();
      task.remove();
      this.windows = this.windows.filter(x => x !== win);
    });
    // Drag by the title bar; double click maximizes and restores.
    bar.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      const start = { x: e.clientX, y: e.clientY, left: node.offsetLeft, top: node.offsetTop };
      bar.setPointerCapture(e.pointerId);
      const move = ev => {
        const maxLeft = this.area.clientWidth - 40;
        const maxTop = this.area.clientHeight - 20;
        node.style.left = `${Math.max(-node.offsetWidth + 40, Math.min(maxLeft, start.left + ev.clientX - start.x))}px`;
        node.style.top = `${Math.max(0, Math.min(maxTop, start.top + ev.clientY - start.y))}px`;
      };
      const up = () => {
        bar.removeEventListener('pointermove', move);
        bar.removeEventListener('pointerup', up);
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up);
    });
    bar.addEventListener('dblclick', e => {
      if (e.target.closest('button')) return;
      if (win.restore) {
        Object.assign(node.style, win.restore);
        win.restore = null;
      } else {
        win.restore = { left: node.style.left, top: node.style.top, width: node.style.width, height: node.style.height };
        Object.assign(node.style, { left: '0px', top: '0px', width: `${this.area.clientWidth}px`, height: `${this.area.clientHeight}px` });
      }
    });
    grip.addEventListener('pointerdown', e => {
      e.stopPropagation();
      const start = { x: e.clientX, y: e.clientY, w: node.offsetWidth, h: node.offsetHeight };
      grip.setPointerCapture(e.pointerId);
      const move = ev => {
        node.style.width = `${Math.max(260, Math.min(this.area.clientWidth - node.offsetLeft, start.w + ev.clientX - start.x))}px`;
        node.style.height = `${Math.max(160, Math.min(this.area.clientHeight - node.offsetTop, start.h + ev.clientY - start.y))}px`;
      };
      const up = () => {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
    });
    this.area.append(node);
    this.tasks.append(task);
    this.windows.push(win);
    focus();
    return win;
  }

  skin(node, theme) {
    node.style.setProperty('--phosphor', theme.phosphor);
    node.style.setProperty('--os-bg', theme.background);
    node.style.setProperty('--accent', theme.accent);
    node.style.setProperty('--dim', theme.dim);
  }

  open(app) {
    this.ctx.busy(0.5);
    const size = SIZES[app];
    if (app === 'browser' || app === 'deeps') {
      const browser = this.browser(app === 'deeps');
      const win = this.addWindow(app, this.t(app === 'deeps' ? 'cmu-pc-app-deeps' : 'cmu-pc-app-browser'), browser.root, size);
      browser.hooks.onTitle = title => {
        const text = this.t('cmu-pc-browser-window-title', { page: title });
        win.titleText.textContent = text;
        win.task.textContent = text;
      };
      browser.navigate(browser.homeAddress);
      return { win, browser };
    }
    if (app === 'files') return { win: this.addWindow(app, this.t('cmu-pc-app-files'), this.files(), size) };
    if (app === 'mail') return { win: this.addWindow(app, this.t('cmu-pc-app-mail'), this.mail(), size) };
    return { win: this.addWindow('system', this.t('cmu-pc-app-system'), this.system(), size) };
  }

  /** A saved page, always in a new window of the browser it belongs to. */
  openLink(address, deep = false) {
    const browser = this.browser(deep);
    const win = this.addWindow(deep ? 'deeps' : 'browser', this.t(deep ? 'cmu-pc-app-deeps' : 'cmu-pc-app-browser'), browser.root, SIZES.browser);
    browser.hooks.onTitle = title => {
      win.titleText.textContent = this.t('cmu-pc-browser-window-title', { page: title });
      win.task.textContent = win.titleText.textContent;
    };
    browser.navigate(address);
    return { win, browser };
  }

  browser(deeps) {
    return new NetBrowser(this.ctx.net, deeps ? this.ctx.deepTheme : this.theme, this.strings, {
      deeps,
      hooks: {
        onSave: link => this.saveLink(link),
        widget: this.ctx.widget,
        onWallpaper: id => this.setWallpaper(id),
        user: this.ctx.user,
        busy: s => this.ctx.busy(s),
      },
    });
  }

  // ------------------------------------------------------------ programs

  /** Files: the OS's documents, then this terminal's notes. */
  files() {
    const list = el('div.emu-list');
    const reader = el('div.emu-reader');
    const notes = () => store('extranet-emulator-notes', []);
    const draw = () => {
      list.replaceChildren();
      for (const doc of this.theme.documents) {
        list.append(el('button.emu-btn.emu-file', { type: 'button', text: doc.name, onclick: () => showDocument(doc) }));
      }
      for (const note of notes()) list.append(el('button.emu-btn.emu-file', { type: 'button', text: note.name, onclick: () => editNote(note) }));
      if (!this.theme.documents.length && !notes().length) list.append(el('div.emu-dim', { text: this.t('cmu-pc-files-empty') }));
      list.append(el('button.emu-btn', { type: 'button', text: this.t('cmu-notes-new'), onclick: () => editNote(null) }));
    };
    const showDocument = async doc => {
      reader.replaceChildren(el('div.emu-dim', { text: '...' }));
      const markup = await this.ctx.net.document(doc.path);
      if (markup === null) {
        reader.replaceChildren(el('div.emu-dim', { text: this.t('cmu-pc-files-empty') }));
        return;
      }
      const rendered = renderDocument(markup.split('{colony}').join(this.ctx.colony.name), {}, { colours: themeColours(this.theme), onLink: () => {} });
      reader.replaceChildren(rendered.page);
    };
    const editNote = note => {
      const name = el('input.emu-field', { value: note ? note.name : '', placeholder: this.t('cmu-notes-name'), maxLength: 40 });
      const body = el('textarea.emu-field.emu-note', { value: note ? note.text : '', maxLength: 4000 });
      const saveButton = el('button.emu-btn', { type: 'button', text: this.t('cmu-notes-save'), onclick: () => {
        const all = notes().filter(n => !note || n.id !== note.id);
        all.push({ id: note ? note.id : Date.now(), name: name.value.trim() || 'NOTE.TXT', text: body.value, author: this.ctx.user.name });
        keep('extranet-emulator-notes', all);
        this.ctx.busy(0.6);
        draw();
      } });
      const remove = el('button.emu-btn', { type: 'button', text: this.t('cmu-notes-delete'), onclick: () => {
        keep('extranet-emulator-notes', notes().filter(n => !note || n.id !== note.id));
        reader.replaceChildren();
        draw();
      } });
      reader.replaceChildren(name, body,
        note && note.author ? el('div.emu-dim', { text: this.t('cmu-notes-by', { author: note.author }) }) : null,
        el('div.emu-row', {}, saveButton, note ? remove : null));
    };
    draw();
    return el('div.emu-app.emu-split', {}, list, reader);
  }

  /** Mail: a sample inbox, the sent folder and a compose form. */
  mail() {
    const user = this.ctx.user.name;
    const inbox = [
      { from: 'Colony Administration', to: user, subject: 'Shift rota for this week', body: `${user}, you are on the day shift until further notice. Report to your supervisor at 06:00.`, time: '05:58' },
      { from: 'Weyland-Yutani Payroll', to: user, subject: 'Your wage statement', body: 'Your wages for the last cycle have been credited, less company store deductions and the housing levy.', time: '06:03' },
      { from: 'The Colony Herald', to: user, subject: 'Tips wanted', body: 'Seen something the notices will not tell you? File it with the Herald at herald.colony.news.', time: '06:10' },
    ];
    const list = el('div.emu-list');
    const reader = el('div.emu-reader');
    let folder = 'inbox';
    const sent = () => store('extranet-emulator-mail-sent', []);
    const draw = () => {
      list.replaceChildren();
      const mails = folder === 'inbox' ? inbox : sent();
      if (!mails.length) list.append(el('div.emu-dim', { text: this.t('cmu-mail-empty') }));
      for (const mail of mails) {
        list.append(el('button.emu-btn.emu-file', { type: 'button', text: mail.subject, onclick: () => read(mail) }));
      }
    };
    const read = mail => {
      reader.replaceChildren(
        el('div.emu-strong', { text: mail.subject }),
        el('div.emu-dim', { text: folder === 'sent' ? this.t('cmu-mail-to-line', { to: mail.to, time: mail.time }) : this.t('cmu-mail-from-line', { from: mail.from, time: mail.time }) }),
        el('div.emu-rule'),
        el('div.emu-mail-body', { text: mail.body }),
        folder === 'inbox' ? el('button.emu-btn', { type: 'button', text: this.t('cmu-mail-compose'), onclick: () => compose(mail.from, `Re: ${mail.subject}`) }) : null);
    };
    const compose = (to = '', subject = '') => {
      const toField = el('input.emu-field', { value: to, placeholder: this.t('cmu-mail-to') });
      const subjectField = el('input.emu-field', { value: subject, placeholder: this.t('cmu-mail-subject') });
      const body = el('textarea.emu-field.emu-note');
      reader.replaceChildren(toField, subjectField, body, el('button.emu-btn', { type: 'button', text: this.t('cmu-mail-send'), onclick: () => {
        if (!toField.value.trim() || !body.value.trim()) return;
        const all = sent();
        all.unshift({ from: user, to: toField.value.trim(), subject: subjectField.value.trim() || '(no subject)', body: body.value, time: shiftClock(this.booted) });
        keep('extranet-emulator-mail-sent', all);
        folder = 'sent';
        draw();
        reader.replaceChildren(el('div.emu-dim', { text: 'Sent (kept in this browser; in game it reaches the colony directory).' }));
      } }));
    };
    const tabs = el('div.emu-row', {},
      el('button.emu-btn', { type: 'button', text: this.t('cmu-mail-inbox'), onclick: () => { folder = 'inbox'; draw(); } }),
      el('button.emu-btn', { type: 'button', text: this.t('cmu-mail-sent'), onclick: () => { folder = 'sent'; draw(); } }),
      el('button.emu-btn', { type: 'button', text: this.t('cmu-mail-compose'), onclick: () => compose() }));
    draw();
    return el('div.emu-app', {}, tabs, el('div.emu-split', {}, list, reader));
  }

  /** System: the OS, this terminal, its user and networks, uptime, and the wallpapers found so far. */
  system() {
    const uptime = el('div');
    const networks = this.theme.networks.map(id => this.t(`cmu-net-network-${id.replace(/^CMUNet/, '').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`));
    const box = el('div.emu-app.emu-system', {},
      el('div.emu-strong', { text: this.theme.name }),
      this.theme.bootLines[0] ? el('div.emu-dim', { text: this.theme.bootLines[0] }) : null,
      el('div.emu-rule'),
      el('div', { text: this.t('cmu-pc-system-terminal', { name: this.ctx.terminalName }) }),
      el('div', { text: this.t('cmu-pc-system-terminal-id', { id: this.ctx.terminal }) }),
      el('div', { text: this.t('cmu-pc-system-user', { name: this.ctx.user.name, job: this.ctx.user.job }) }),
      el('div', { text: this.t('cmu-pc-system-networks') }),
      ...networks.map(n => el('div', { text: `  ${n}` })),
      uptime);
    const wallpapers = el('div.emu-row.emu-wrap');
    const found = [...this.ctx.wallpapers.values()];
    wallpapers.append(el('button.emu-btn', { type: 'button', text: 'OS default', onclick: () => this.setWallpaper(null) }));
    for (const w of found) wallpapers.append(el('button.emu-btn', { type: 'button', text: this.t(w.name), onclick: () => this.setWallpaper(w.id) }));
    box.append(el('div.emu-rule'), el('div.emu-dim', { text: 'Wallpaper (in game: found on ExtraNet pages):' }), wallpapers);
    const tick = () => {
      const up = (performance.now() - this.booted) / 1000;
      uptime.textContent = this.t('cmu-pc-system-uptime', { time: `${String(Math.floor(up / 60)).padStart(2, '0')}:${String(Math.floor(up % 60)).padStart(2, '0')}` });
      if (box.isConnected || !box.dataset.seen) {
        if (box.isConnected) box.dataset.seen = '1';
        setTimeout(tick, 1000);
      }
    };
    tick();
    return box;
  }
}

/** CMUComputerLogin: the OS name, the terminal number and a blinking prompt to insert a card. */
export function loginScreen(theme, strings, terminal) {
  const prompt = el('div.emu-login-prompt', { text: L(strings, 'cmu-pc-login-prompt') });
  return el('div.emu-login', {},
    el('div.emu-login-name', { text: theme.name }),
    el('div.emu-rule'),
    el('div.emu-strong', { text: L(strings, 'cmu-pc-login-title', { id: terminal }) }),
    prompt);
}
