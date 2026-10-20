// The in-game ExtraNet browser around the page (CMUNetBrowser): the terminal window, navigation bar, the site's
// tab strip, the page with its pop ups, the status line, and a sample posting under a board's index page.

import { el, css, rgba, hash } from './util.js';
import { renderDocument, themeColours, THEMES, over, cleanStyle, applyPageVars, netLink } from './render.js';
import { splitAddress, isCamera } from './markup.js';
import { pageForPath } from './package.js';
import { imageUrl } from './repo.js';
import { ensureFont } from './fonts.js';

const STRINGS = {
  back: 'Back',
  forward: 'Forward',
  home: 'HOME',
  directory: 'DIR',
  go: 'GO',
  save: 'SAVE LINK',
  ready: 'READY',
  error: 'ERROR',
  unknownTitle: 'HOST UNREACHABLE',
  unknownBody: address => `No ExtraNet node answers at ${address}. Check the address and try again.`,
  missingTitle: 'ERROR 404: DOCUMENT NOT FOUND',
  missingBody: address => `The server answered, but holds no document at ${address}.`,
  returnHome: 'Return to home page',
  directoryTitle: 'ExtraNet directory',
};

export class BrowserPreview {
  /**
   * host: element to draw into. options: () => { theme, colony, mapFolder, boardMode }.
   * getPackage: () => pkg. onNavigate(file|null): the page the preview now shows.
   */
  constructor(host, getPackage, options, onNavigate) {
    this.host = host;
    this.getPackage = getPackage;
    this.options = options;
    this.onNavigate = onNavigate;
    this.history = [];
    this.index = -1;
    this.timers = [];
    this.popups = [];
    this.elapsed = 0;
    this.last = performance.now();
    this.build();
    requestAnimationFrame(t => this.frame(t));
  }

  build() {
    const button = (text, title, onclick) => el('button.term-btn', { type: 'button', text, title, onclick });
    this.back = button('<', STRINGS.back, () => this.goHistory(-1));
    this.forward = button('>', STRINGS.forward, () => this.goHistory(1));
    this.home = button(STRINGS.home, 'In game: the computer\'s home page. Here: this site\'s index.', () => this.navigate(this.siteHome()));
    this.dir = button(STRINGS.directory, 'ExtraNet directory', () => this.navigate('sys://directory'));
    this.address = el('input.term-address', { type: 'text', spellcheck: false, placeholder: 'Enter an ExtraNet address' });
    this.address.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.navigate(this.address.value, false);
    });
    this.go = button(STRINGS.go, '', () => this.navigate(this.address.value, false));
    this.save = button(STRINGS.save, 'Save this page to the desktop.', () => {
      this.status.textContent = 'SAVED TO DESKTOP';
    });
    this.title = el('span.term-title-text');
    this.tabs = el('div.term-tabs');
    this.background = el('div.page-bgimage');
    this.scroll = el('div.page-scroll');
    this.overlay = el('div.page-overlay');
    this.view = el('div.page-view', {}, this.background, this.scroll, this.overlay);
    this.status = el('span.term-status');

    this.window = el('div.term-window', {},
      el('div.term-titlebar', {}, el('span.term-icon', { text: '▣' }), this.title,
        el('span.term-title-btn', { text: '_' }), el('span.term-title-btn', { text: 'X' })),
      el('div.term-nav', {}, this.back, this.forward, this.home, this.dir, this.address, this.go, this.save),
      el('div.term-rule'),
      this.tabs,
      this.view,
      el('div.term-rule'),
      el('div.term-statusbar', {}, this.status),
      el('div.term-scanlines'));
    this.host.replaceChildren(el('div.term-desk', {}, this.window));
  }

  colours() {
    const theme = THEMES[this.options().theme] || THEMES.CMUOsSeegson;
    return { theme, ...themeColours(theme) };
  }

  applyTheme() {
    const c = this.colours();
    const w = this.window.style;
    w.setProperty('--phosphor', css(c.phosphor));
    w.setProperty('--phosphor-80', css(c.phosphor, 0.8));
    w.setProperty('--phosphor-60', css(c.phosphor, 0.6));
    w.setProperty('--os-bg', css(c.background));
    w.setProperty('--dim', css(c.dim));
    ensureFont('Mono');
  }

  /** The alias a deep site gets each round; the preview makes up a steady one. */
  deepAlias() {
    const site = this.getPackage().site;
    const letters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let h = hash(site.id || site.address);
    let name = '';
    for (let i = 0; i < 6; i++) {
      name += letters[h % letters.length];
      h = Math.floor(h / letters.length) + i * 7919;
    }
    return name + (site.aliasSuffix || '.deep');
  }

  isDeep() {
    return this.getPackage().site.networks.includes('CMUNetDeep');
  }

  siteHome() {
    return this.getPackage().site.address;
  }

  /** Shows a page of the package by its page path. */
  showPage(path) {
    const site = this.getPackage().site;
    this.navigate(path ? `${site.address}/${path}` : site.address);
  }

  navigate(address, fromPage = true) {
    const trimmed = (address || '').trim();
    if (!trimmed) return;
    if (isCamera(trimmed)) {
      this.status.textContent = `CAMERA FEED: ${trimmed.slice(6)} (opens on the computer in game)`;
      return;
    }
    if (this.index < this.history.length - 1) this.history.splice(this.index + 1);
    this.history.push(trimmed);
    this.index = this.history.length - 1;
    this.show(trimmed, fromPage);
  }

  goHistory(offset) {
    const index = this.index + offset;
    if (index < 0 || index >= this.history.length) return;
    this.index = index;
    this.show(this.history[index], false);
  }

  /** Re-renders the address on screen (after an edit), keeping the scroll position. */
  refresh() {
    if (this.index < 0) return;
    const top = this.scroll.scrollTop;
    this.show(this.history[this.index], true, true);
    this.scroll.scrollTop = top;
  }

  resolve(address) {
    const pkg = this.getPackage();
    const site = pkg.site;
    const own = site.address.trim().toLowerCase();
    const { host, path } = splitAddress(address);
    const alias = this.isDeep() ? this.deepAlias() : null;
    if (host === own || (alias && host === alias)) {
      const page = pageForPath(site, path);
      const shown = this.isDeep() ? (path ? `${alias}/${path}` : alias) : (path ? `${own}/${path}` : own);
      if (!page) return { result: 'missing', address: shown, path };
      return { result: 'found', address: shown, path, page };
    }
    return { result: 'unknown', address: path ? `${host}/${path}` : host };
  }

  show(address, fromPage, keepPopups = false) {
    this.applyTheme();
    this.back.disabled = this.index <= 0;
    this.forward.disabled = this.index >= this.history.length - 1;
    const pkg = this.getPackage();
    const site = pkg.site;
    const colours = this.colours();
    const lower = address.trim().toLowerCase();

    if (lower.startsWith('sys://')) {
      this.address.value = 'sys://directory';
      this.showTabs(null);
      this.systemPage(STRINGS.directoryTitle, null, page => {
        const listed = !site.unlisted;
        page.append(el('div.page-text', { text: listed
          ? 'In game this lists every listed site the computer can reach. Your site appears as:'
          : 'Your site is unlisted, so the directory does not show it. Players find it by its address (deep sites: with The deeps.exi scan).' }));
        if (listed) {
          page.append(el('div.dir-row', {}, el('span.dir-cell', {}, netLink(site.address, site.address, colours.defaultStyle.link, colours.defaultStyle.background, a => this.navigate(a))), el('span', { text: site.title })));
        }
      });
      this.setStatus(STRINGS.directoryTitle, STRINGS.ready);
      this.onNavigate(null);
      return;
    }
    if (lower.startsWith('net://') || lower.startsWith('deeps://')) {
      this.address.value = address.trim();
      this.showTabs(null);
      const random = lower.startsWith('net://');
      this.systemPage(random ? 'RANDOM SITE' : 'THE DEEPS.EXI', random
        ? 'In game, net://random opens a random listed site this computer can reach. The editor cannot know which one, so it shows this page instead.'
        : 'deeps:// pages are drawn by The deeps.exi in game.', null);
      this.setStatus(random ? 'Random site (picked in game)' : 'The deeps.exi', STRINGS.ready);
      this.onNavigate(null);
      return;
    }

    const page = this.resolve(address);
    if (this.index >= 0 && page.result !== 'unknown') this.history[this.index] = page.address;
    this.address.value = page.address;
    this.address.title = this.isDeep() ? 'Deep sites get a new random address every round; this one is made up for the preview.' : '';

    if (page.result === 'unknown') {
      this.showTabs(null);
      this.systemPage(STRINGS.unknownTitle, STRINGS.unknownBody(page.address), null, true);
      this.setStatus('', STRINGS.error);
      this.onNavigate(null);
      return;
    }

    this.showTabs(page.path);
    if (page.result === 'missing') {
      this.systemPage(STRINGS.missingTitle, STRINGS.missingBody(page.address), null, true);
      this.setStatus(site.title, STRINGS.error);
      this.onNavigate(null);
      return;
    }

    const file = this.colonyFile(page.page.file);
    const text = pkg.texts[file];
    if (text === undefined) {
      this.systemPage(STRINGS.missingTitle, STRINGS.missingBody(page.address), null, true);
      this.setStatus(site.title, STRINGS.error);
      this.onNavigate(page.page.file);
      return;
    }
    const filled = text.split('{colony}').join(this.options().colony || 'the colony');
    const rendered = renderDocument(filled, site.style, {
      colours,
      onLink: link => this.navigate(link),
    });
    this.mount(rendered, keepPopups);
    if (site.board && page.path === '' && !rendered.error) this.scroll.firstChild.append(this.board(rendered.style));
    this.setStatus(site.title, STRINGS.ready);
    this.onNavigate(page.page.file);
  }

  /** A site's own version of a page for the chosen map folder, as ColonyFile does. */
  colonyFile(file) {
    const folder = (this.options().mapFolder || '').trim();
    if (!folder) return file;
    const variant = `${folder}/${file}`;
    return variant in this.getPackage().texts ? variant : file;
  }

  mount(rendered, keepPopups) {
    const style = rendered.style;
    this.view.style.background = cssColour(style.background);
    this.background.style.backgroundImage = '';
    if (style.backgroundImage) {
      imageUrl(style.backgroundImage).then(url => {
        this.background.style.backgroundImage = `url("${url}")`;
        const mode = style.backgroundMode || 'Stretch';
        this.background.style.backgroundRepeat = mode === 'Tile' ? 'repeat' : 'no-repeat';
        this.background.style.backgroundSize = mode === 'Stretch' ? '100% 100%' : 'auto';
        this.background.style.backgroundPosition = mode === 'Center' ? 'center' : 'top left';
      }).catch(() => {});
    }
    this.scroll.replaceChildren(rendered.page);
    applyPageVars(this.overlay, style);
    this.overlay.replaceChildren(...rendered.popups);
    this.timers = rendered.timers;
    this.popups = rendered.popups;
    if (!keepPopups) this.elapsed = 0;
    for (const popup of this.popups) popup.style.visibility = 'hidden';
  }

  /** Error and directory pages, drawn in the OS's default page style. */
  systemPage(title, body, build, homeLink = false) {
    const colours = this.colours();
    const style = colours.defaultStyle;
    const page = el('div.page-content');
    applyPageVars(page, style);
    ensureFont('Sans');
    page.append(el('div.page-heading.h-heading', { text: title }));
    if (body) page.append(el('div.page-text.sys-body', { text: body }));
    if (build) build(page);
    if (homeLink) {
      page.append(el('div.sys-home', {}, netLink(STRINGS.returnHome, this.siteHome(), style.link, style.background, a => this.navigate(a))));
    }
    this.mount({ page, popups: [], timers: [], style }, false);
  }

  /** The site's tab strip in its colours, the open page's tab filled. */
  showTabs(openPath) {
    const site = this.getPackage().site;
    this.tabs.replaceChildren();
    const visible = openPath !== null && site.tabs.length > 0;
    this.tabs.style.display = visible ? 'flex' : 'none';
    if (!visible) return;
    const style = over(cleanStyle(site.style), this.colours().defaultStyle);
    const link = cssColour(style.link);
    const background = cssColour(style.background);
    for (const tab of site.tabs) {
      const path = (tab.path || '').trim().replace(/^\/+|\/+$/g, '').toLowerCase();
      const active = path === openPath;
      const button = el('button.term-btn.term-tab', { type: 'button', text: tab.title || '(no title)', onclick: () => this.navigate(path ? `${site.address}/${path}` : site.address) });
      button.style.background = active ? link : background;
      button.style.color = active ? background : link;
      button.style.borderColor = link;
      this.tabs.append(button);
    }
  }

  setStatus(title, status) {
    this.title.textContent = title ? `ExtraNet: ${title}` : 'ExtraNet';
    this.status.textContent = status;
  }

  /** CMUNetBoardView with one made up posting, so posters see the layout under the index page. */
  board(style) {
    const site = this.getPackage().site;
    const b = site.board;
    const mode = this.options().boardMode || 'sample';
    const text = rgba(style.text) || [1, 1, 1, 1];
    const heading = rgba(style.heading || style.text) || text;
    const link = rgba(style.link) || [1, 1, 1, 1];
    const background = rgba(style.background) || [0, 0, 0, 1];
    const box = el('div.board');
    box.style.setProperty('--b-link', css(link));
    box.style.setProperty('--b-bg', css(background));
    box.append(el('div.board-rule', { style: { background: css(link, 0.5) } }));
    const button = label => el('button.board-btn', { type: 'button', text: label });
    const canPost = mode !== 'reader';
    if (canPost) box.append(el('div', {}, button(`+ ${b.postLabel || 'Post'}`)));
    const posts = el('div.board-posts');
    box.append(posts);
    if (mode === 'empty') {
      posts.append(el('div.board-label', { text: b.empty || '', style: { color: css(text) } }));
      return box;
    }
    const terminal = b.showTerminals ? ' | Terminal #3' : '';
    const post = el('div.board-post');
    const header = el('div.board-post-header', {}, el('div.page-heading.h-heading.board-title', { text: 'Sample posting: this is what a post looks like' }));
    if (b.bounties) header.append(el('span.board-badge', { text: 'BOUNTY $250', style: { background: css(link), color: css(background) } }));
    post.append(header);
    post.append(el('div.board-label', { text: `By Jo Calder, Colonist, at 06:42${terminal}`, style: { color: css(text, 0.65) } }));
    post.append(el('div.board-body', { text: 'Players write postings in game. Their text is shown plain, never as markup. This one is made up by the editor so you can see the layout under your page.', style: { color: css(text) } }));
    const comments = el('div.board-comments');
    comments.append(el('div.board-label', { text: `Ana Ruiz (Visitor) at 06:51${terminal}:`, style: { color: css(heading, 0.8) } }));
    comments.append(el('div.board-body', { text: 'Comments go under each posting.', style: { color: css(text) } }));
    comments.append(el('div.board-comment-line', {}, el('input.board-field', { type: 'text', placeholder: 'Leave a comment', disabled: true }), button('Send')));
    post.append(comments);
    post.append(el('div.board-rule', { style: { background: css(link, 0.25), marginTop: '6px' } }));
    posts.append(post);
    return box;
  }

  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.elapsed += dt;
    for (const timer of this.timers) timer(dt);
    if (this.popups.length) {
      const width = this.view.clientWidth;
      const height = this.view.clientHeight;
      for (const popup of this.popups) {
        if (popup.dataset.closed || this.elapsed < Number(popup.dataset.delay)) continue;
        popup.style.visibility = 'visible';
        const roomX = Math.max(0, width - popup.offsetWidth);
        const roomY = Math.max(0, height - popup.offsetHeight);
        popup.style.left = `${roomX * Number(popup.dataset.x)}px`;
        popup.style.top = `${roomY * Number(popup.dataset.y)}px`;
      }
    }
    requestAnimationFrame(t => this.frame(t));
  }
}

function cssColour(value) {
  const c = rgba(value);
  return c ? css(c) : value;
}

