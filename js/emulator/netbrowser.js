// The ExtraNet browser on the emulated desktop (CMUNetBrowser): back, forward, home, the directory, the address
// bar, the site's tab strip, the page with its pop ups and live widgets, and the status line. The same browser in
// red is The deeps.exi, whose home page scans for hidden nodes.

import { el, css, rgba } from '../util.js';
import { renderDocument, themeColours, over, cleanStyle, applyPageVars, netLink } from '../render.js';
import { imageUrl } from '../repo.js';
import { ensureFont } from '../fonts.js';
import { text } from '../library.js';
import { L } from './data.js';
import { boardView } from './boards.js';

export class NetBrowser {
  /**
   * net: Network. theme: the OS theme (or the deeps skin). deeps: The deeps.exi. home: the home address.
   * hooks: { onTitle(title), onSave({ title, address }), widget(name, args, style, { navigate(address), deeps }),
   *          onWallpaper(id), user, click() }
   */
  constructor(net, theme, strings, { deeps = false, home, hooks = {} } = {}) {
    this.net = net;
    this.theme = theme;
    this.strings = strings;
    this.deeps = deeps;
    this.homeAddress = home || (deeps ? 'deeps://home' : theme.home);
    this.hooks = hooks;
    this.history = [];
    this.index = -1;
    this.timers = [];
    this.popups = [];
    this.elapsed = 0;
    this.last = performance.now();
    this.serial = 0;
    this.build();
    const loop = now => {
      if (this.root.isConnected || !this.attached) {
        if (this.root.isConnected) this.attached = true;
        this.frame(now);
        requestAnimationFrame(loop);
      }
    };
    requestAnimationFrame(loop);
  }

  t(id, vars) {
    return L(this.strings, id, vars);
  }

  build() {
    const button = (label, title, onclick) => el('button.term-btn', { type: 'button', text: label, title, onclick });
    this.back = button('<', this.t('cmu-pc-browser-back'), () => this.goHistory(-1));
    this.forward = button('>', this.t('cmu-pc-browser-forward'), () => this.goHistory(1));
    this.home = button(this.t('cmu-pc-browser-home'), '', () => this.navigate(this.homeAddress, true));
    this.dir = button(this.t('cmu-pc-browser-directory'), this.t('cmu-pc-browser-directory-title'), () => this.navigate('sys://directory', true));
    this.address = el('input.term-address', { type: 'text', spellcheck: false, placeholder: this.t('cmu-pc-browser-address-placeholder') });
    this.address.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.navigate(this.address.value);
    });
    this.go = button(this.t('cmu-pc-browser-go'), '', () => this.navigate(this.address.value, true));
    this.save = button(this.t('cmu-pc-browser-save'), this.t('cmu-pc-browser-save-tooltip'), () => {
      if (this.current && this.hooks.onSave) {
        this.hooks.onSave({ title: this.currentTitle || this.current, address: this.current });
        this.status.textContent = this.t('cmu-pc-browser-status-saved');
      }
    });
    this.tabs = el('div.term-tabs');
    this.background = el('div.page-bgimage');
    this.scroll = el('div.page-scroll');
    this.overlay = el('div.page-overlay');
    this.view = el('div.page-view', {}, this.background, this.scroll, this.overlay);
    this.status = el('span.term-status');
    this.root = el('div.emu-browser', {},
      el('div.term-nav', {}, this.back, this.forward, this.home, this.dir, this.address, this.go, this.save),
      el('div.term-rule'),
      this.tabs,
      this.view,
      el('div.term-rule'),
      el('div.term-statusbar', {}, this.status));
    const s = this.root.style;
    s.setProperty('--phosphor', this.theme.phosphor);
    s.setProperty('--os-bg', this.theme.background);
    s.setProperty('--dim', this.theme.dim);
    s.setProperty('--phosphor-80', css(rgba(this.theme.phosphor), 0.8));
    s.setProperty('--phosphor-60', css(rgba(this.theme.phosphor), 0.6));
    ensureFont('Mono');
    this.root.addEventListener('pointerdown', () => this.hooks.click && this.hooks.click());
  }

  colours() {
    return themeColours(this.theme);
  }

  /**
   * fromPage: a link, tab or button on the page (CMUNetBrowser.Click), where deep sites' fixed names work; the
   * address bar's Enter is not.
   */
  navigate(address, fromPage = false) {
    let trimmed = (address || '').trim();
    if (!trimmed) return;
    // The webring link picks its site before it reaches the history, as in game.
    if (trimmed.toLowerCase() === 'net://random') {
      const list = this.net.directory();
      if (!list.length) return;
      trimmed = list[Math.floor(Math.random() * list.length)].address;
    }
    if (/^cam:\/\//i.test(trimmed)) {
      this.status.textContent = 'CAMERA FEED: opens the camera console in game';
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

  setTitle(title) {
    this.currentTitle = title;
    if (this.hooks.onTitle) this.hooks.onTitle(title);
  }

  async show(address, fromPage = false) {
    const serial = ++this.serial;
    this.back.disabled = this.index <= 0;
    this.forward.disabled = this.index >= this.history.length - 1;
    this.status.textContent = this.t('cmu-pc-browser-status-loading');
    if (this.hooks.busy) this.hooks.busy(0.5);
    const page = this.net.resolve(address, this.deeps, fromPage);
    const shown = page.address || address.trim();
    this.address.value = page.kind === 'directory' ? 'sys://directory' : page.kind === 'deephome' ? 'deeps://home' : shown;
    // History keeps the address as shown, so going back to a deep page needs no fixed name.
    if (page.address && page.kind !== 'unknown' && this.index >= 0) this.history[this.index] = page.address;
    this.current = this.address.value;
    this.showTabs(null);

    if (page.kind === 'directory') {
      this.setTitle(this.t('cmu-pc-browser-directory-title'));
      this.systemPage(this.t('cmu-pc-browser-directory-title'), null, box => {
        const style = this.colours().defaultStyle;
        for (const entry of this.net.directory()) {
          box.append(el('div.dir-row', {}, el('span.dir-cell', {}, netLink(entry.address, entry.address, style.link, style.background, a => this.navigate(a, true))),
            el('span', { text: this.net.title(entry) })));
        }
      });
      this.status.textContent = this.t('cmu-pc-browser-status-done');
      return;
    }
    if (page.kind === 'deephome') {
      this.setTitle(this.t('cmu-pc-app-deeps'));
      this.deepHome();
      this.status.textContent = this.t('cmu-pc-browser-status-done');
      return;
    }
    // A dark terminal is not refused: nothing on the colony network hears it at all (sim/colony.js retunes it).
    if (page.kind === 'denied' && this.net.dark) {
      this.setTitle(this.t('cmu-pc-browser-dark-title'));
      this.systemPage(this.t('cmu-pc-browser-dark-title'), this.t('cmu-pc-browser-dark-body', { address: shown }), null, true);
      this.status.textContent = this.t('cmu-pc-browser-status-error');
      return;
    }
    if (page.kind === 'unknown' || page.kind === 'denied') {
      const denied = page.kind === 'denied';
      this.setTitle(this.t(denied ? 'cmu-pc-browser-denied-title' : 'cmu-pc-browser-unknown-host-title'));
      this.systemPage(this.t(denied ? 'cmu-pc-browser-denied-title' : 'cmu-pc-browser-unknown-host-title'),
        this.t(denied ? 'cmu-pc-browser-denied-body' : 'cmu-pc-browser-unknown-host-body', { address: shown }), null, true);
      this.status.textContent = this.t(denied ? 'cmu-pc-browser-status-denied' : 'cmu-pc-browser-status-error');
      return;
    }
    if (page.kind === 'missing') {
      this.showTabs(page.entry, page.address.split('/').slice(1).join('/'));
      this.setTitle(this.net.title(page.entry));
      this.systemPage(this.t('cmu-pc-browser-missing-page-title'), this.t('cmu-pc-browser-missing-page-body', { address: shown }), null, true);
      this.status.textContent = this.t('cmu-pc-browser-status-error');
      return;
    }

    let markup;
    let siteStyle = {};
    if (page.kind === 'ad') {
      markup = await this.net.adPage(page.host);
      this.setTitle(this.t('cmu-deep-home-ad'));
    } else {
      markup = await this.net.pageText(page.entry, page.file);
      siteStyle = page.entry.site.style;
      this.setTitle(this.net.title(page.entry));
    }
    if (serial !== this.serial) return;
    if (markup === null) {
      this.systemPage(this.t('cmu-pc-browser-missing-page-title'), this.t('cmu-pc-browser-missing-page-body', { address: shown }), null, true);
      this.status.textContent = this.t('cmu-pc-browser-status-error');
      return;
    }
    if (page.entry) this.showTabs(page.entry, page.path);
    const rendered = renderDocument(markup, siteStyle, {
      colours: this.colours(),
      onLink: link => this.navigate(link, true),
      // live tags that follow links or look across the ExtraNet are told which browser they are in
      widget: this.hooks.widget && ((name, args, style) => this.hooks.widget(name, args, style, { navigate: a => this.navigate(a, true), deeps: this.deeps })),
      onWallpaper: this.hooks.onWallpaper,
    });
    this.mount(rendered);
    if (page.entry && page.entry.site.board && page.path === '' && !rendered.error) {
      this.scroll.firstChild.append(boardView(page.entry, rendered.style, this.strings, this.hooks.user || {}));
    }
    this.scroll.scrollTop = 0;
    this.status.textContent = this.t('cmu-pc-browser-status-done');
  }

  mount(rendered) {
    const style = rendered.style;
    this.view.style.background = colourCss(style.background);
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
    this.elapsed = 0;
    for (const popup of this.popups) popup.style.visibility = 'hidden';
  }

  /** Error and directory pages, in the OS's default page style. */
  systemPage(title, body, build, homeLink = false) {
    const style = this.colours().defaultStyle;
    const page = el('div.page-content');
    applyPageVars(page, style);
    ensureFont('Sans');
    page.append(el('div.page-heading.h-heading', { text: title }));
    if (body) page.append(el('div.page-text.sys-body', { text: body }));
    if (build) build(page);
    if (homeLink) page.append(el('div.sys-home', {}, netLink(this.t('cmu-pc-browser-return-home'), this.homeAddress, style.link, style.background, a => this.navigate(a, true))));
    this.mount({ page, popups: [], timers: [], style });
  }

  /** The site's tab strip in its colours, the open page's tab filled. */
  showTabs(entry, openPath = null) {
    this.tabs.replaceChildren();
    const tabs = entry ? entry.site.tabs : [];
    const visible = entry && openPath !== null && tabs.length > 0;
    this.tabs.style.display = visible ? 'flex' : 'none';
    if (!visible) return;
    const style = over(cleanStyle(entry.site.style), this.colours().defaultStyle);
    const link = colourCss(style.link);
    const background = colourCss(style.background);
    for (const tab of tabs) {
      const path = (tab.path || '').trim().replace(/^\/+|\/+$/g, '').toLowerCase();
      const active = path === openPath;
      const button = el('button.term-btn.term-tab', { type: 'button', text: text(this.strings, tab.title), onclick: () => this.navigate(path ? `${entry.address}/${path}` : entry.address, true) });
      button.style.background = active ? link : background;
      button.style.color = active ? background : link;
      button.style.borderColor = link;
      this.tabs.append(button);
    }
  }

  /** CMUDeepHome: scan for nodes, the list of what was found, and the door hint. */
  deepHome() {
    const style = this.colours().defaultStyle;
    const page = el('div.page-content.emu-deephome');
    applyPageVars(page, style);
    const status = el('span.emu-deep-status');
    const scan = el('button.term-btn', { type: 'button', text: this.t('cmu-deep-home-scan'), title: this.t('cmu-deep-home-scan-tooltip') });
    const found = el('div.emu-deep-found');
    const draw = () => {
      found.replaceChildren();
      const list = this.net.state.discovered;
      if (!list.length) found.append(el('div.page-text', { text: this.t('cmu-deep-home-nothing') }));
      for (let i = list.length - 1; i >= 0; i--) {
        found.append(el('div.emu-deep-node', {}, el('div', { text: this.net.foundTitle(list[i]) }),
          el('div', {}, netLink(list[i], list[i], style.link, style.background, a => this.navigate(a, true)))));
      }
    };
    const tick = () => {
      const wait = Math.ceil(((this.net.nextScan || 0) - performance.now()) / 1000);
      scan.disabled = wait > 0;
      status.textContent = wait > 0 ? this.t('cmu-deep-home-cooling', { seconds: wait }) : this.t('cmu-deep-home-ready');
      if (page.isConnected) setTimeout(tick, 250);
    };
    scan.addEventListener('click', async () => {
      this.net.nextScan = performance.now() + 8000;
      scan.disabled = true;
      await this.net.scan();
      draw();
    });
    page.append(
      el('div.page-heading.h-bigger', { text: this.t('cmu-deep-home-title') }),
      el('div.page-text', { text: this.t('cmu-deep-home-intro') }),
      el('div.page-text.emu-dim', { text: this.t('cmu-deep-home-doors', { mark: '::' }) }),
      el('div.emu-deep-scan', {}, scan, status),
      el('div.page-heading.h-heading', { text: this.t('cmu-deep-home-found') }),
      found);
    draw();
    this.mount({ page, popups: [], timers: [], style });
    tick();
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
        // Each pop up makes the OS's error sound when it first appears (OnPopupShown).
        if (popup.style.visibility !== 'visible' && this.hooks.popupShown) this.hooks.popupShown();
        popup.style.visibility = 'visible';
        popup.style.left = `${Math.max(0, width - popup.offsetWidth) * Number(popup.dataset.x)}px`;
        popup.style.top = `${Math.max(0, height - popup.offsetHeight) * Number(popup.dataset.y)}px`;
      }
    }
  }
}

function colourCss(value) {
  const c = rgba(value);
  return c ? css(c) : value;
}
