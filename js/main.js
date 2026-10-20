// ExtraNet editor: a block builder for site packages, with the in-game preview, checks and zip export.

import { el, debounce, download, rgba, mix, hexOf } from './util.js';
import { icon } from './icons.js';
import { CodeEditor } from './editor.js';
import { BrowserPreview } from './browser.js';
import { THEMES, themeColours, over, cleanStyle, pageStyleOf } from './render.js';
import { renderSiteForm } from './ui-site.js';
import { renderPages, renderImages, addImage } from './ui-files.js';
import { pickSprite } from './ui-sprites.js';
import { toast, confirmDialog, modal, field, textInput, button, buttonRow, select } from './ui-dialog.js';
import { emptyPackage, packageFromFiles, saveWorking, loadWorking, normalisePackage, attributionsYaml, siteYaml, folderFromTitle, pageForPath } from './package.js';
import { exportZip, importZip, importFolderFiles, importDirectoryHandle } from './zip.js';
import { validateSync, validateAsync } from './validate.js';
import { setRepoBase, getRepoBase, setLocalProvider, DEFAULT_REPO, GITHUB_REPO, BUNDLED, localCheckoutBase, repoLabel } from './repo.js';
import { onFontLoaded } from './fonts.js';
import { TEMPLATE_FILES, TEMPLATE_FOLDER } from './template.js';
import { TEMPLATES, templateById } from './templates.js';
import { YamlError } from './yaml.js';
import { BLOCK_TYPES, PALETTE_GROUPS, block, importPage, generatePage, findBlock, targetList, cloneBlock, walkBlocks } from './blocks.js';
import { BlockCanvas, startPaletteDrag, endDrag } from './canvas.js';
import { renderProps, linkPicker } from './ui-props.js';
import { renderTabStrip } from './ui-tabs.js';
import { History } from './history.js';
import { linkChipNode } from './richedit.js';
import { normalizePath, lineCol } from './markup.js';
import { attributionFor, setAttribution } from './package.js';
import { renderLibrary } from './ui-library.js';
import { openEntry, exportChanges, userEntry } from './library.js';

const SETTINGS_KEY = 'extranet-editor-settings';

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch {
    return {};
  }
}

/** Settings saved by an older version: the old default source, the Personal-Computers branch, becomes the snapshot. */
function migrateSettings(settings) {
  if (!settings.repoVersion) {
    if (!settings.repo || settings.repo === GITHUB_REPO) settings.repo = BUNDLED;
    settings.repoVersion = 2;
  }
  return settings;
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(app.settings));
  } catch {
    // settings stay for this visit only
  }
}

const history = new History();

/** The emulator (#emulator). Set to false to hide it from the rail and the address. */
const EMULATOR = true;

const app = {
  pkg: emptyPackage(),
  currentFile: 'index.xml',
  selected: null,
  settings: migrateSettings({ theme: 'CMUOsSeegson', colony: 'Stable Garrison', mapFolder: '', boardMode: 'sample', repo: DEFAULT_REPO, leftTab: 'blocks', view: 'blocks', ...loadSettings() }),
  issues: [],
  blockIssues: new Map(),
  handlers: [],
  lastAttribution: null,
  pages: new Map(),
  positions: new Map(),

  on(event, fn, scope = 'global') {
    this.handlers.push({ event, fn, scope });
  },
  off(scope) {
    this.handlers = this.handlers.filter(h => h.scope !== scope);
  },
  emit(event) {
    for (const h of [...this.handlers]) if (h.event === event) h.fn();
  },

  // ---------------------------------------------------------- model

  /** The block model of a page, read from its text the first time it is needed. */
  pageModel(file = this.currentFile) {
    if (!file || !(file in this.pkg.texts)) return null;
    if (!this.pages.has(file)) {
      const page = importPage(this.pkg.texts[file]);
      this.pages.set(file, page);
      this.positions.set(file, generatePage(page, this.markupColours()).positions);
    }
    return this.pages.get(file);
  },

  page() {
    return this.pageModel();
  },

  currentPageEntry() {
    return this.pkg.site.pages.find(p => p.file === this.currentFile) || null;
  },

  isIndex() {
    const page = this.currentPageEntry();
    return !!page && normalizePath(page.path) === '';
  },

  colours() {
    const theme = THEMES[this.settings.theme] || THEMES.CMUOsSeegson;
    return { theme, ...themeColours(theme) };
  },

  /** The site's resolved colours, for @values in new blocks and the tab strip. */
  markupColours() {
    const style = over(cleanStyle(this.pkg.site.style), this.colours().defaultStyle);
    const hex = v => {
      const c = rgba(v) || (typeof v === 'string' && v.startsWith('rgba(') ? v.slice(5, -1).split(',').map((n, i) => (i < 3 ? Number(n) / 255 : Number(n))) : null);
      return c ? hexOf(c) : '#888888';
    };
    const background = rgba(hex(style.background));
    const link = rgba(hex(style.link));
    return {
      background: hex(style.background),
      text: hex(style.text),
      heading: hex(style.heading || style.text),
      link: hex(style.link),
      panel: hexOf(mix(background, link, 0.12)),
      address: this.pkg.site.address,
    };
  },

  /** The current page's style: site style, then its CMUNetStyle line. */
  style() {
    const text = this.pkg.texts[this.currentFile] || '';
    return pageStyleOf(text, this.pkg.site.style, this.colours());
  },

  findSelected() {
    const page = this.page();
    return page && this.selected ? findBlock(page.blocks, this.selected) : null;
  },

  linkTargets() {
    const site = this.pkg.site;
    return site.pages.map(p => {
      const tab = site.tabs.find(t => normalizePath(t.path || '') === normalizePath(p.path));
      const name = tab ? tab.title : p.path || 'Home page';
      const address = p.path ? `${site.address}/${p.path}` : site.address;
      return { value: address, label: `${name}${p.path === '' ? ' (home)' : ''}: ${address}` };
    });
  },

  /** Writes the current page's blocks back to its text and lets everything else know. */
  commit(group = null, { canvas = true, props = false } = {}) {
    const file = this.currentFile;
    const page = this.pages.get(file);
    if (page) {
      const out = generatePage(page, this.markupColours());
      this.pkg.texts[file] = out.text;
      this.positions.set(file, out.positions);
    }
    if (this.settings.view === 'markup') editor.value = this.pkg.texts[file] || '';
    afterChange(group);
    if (canvas) canvasView.render();
    if (props) renderRight();
  },

  editBlock(id, fn, group = null, refreshProps = false) {
    const found = findBlock(this.page().blocks, id);
    if (!found) return;
    fn(found.block);
    this.commit(group, { props: refreshProps });
  },

  /** Typing on the canvas: the model changes, the canvas keeps its cursor. */
  editText(id, fn) {
    const page = this.page();
    const found = page && findBlock(page.blocks, id);
    if (!found) return;
    fn(found.block);
    this.commit('typing', { canvas: false });
  },

  editSite(fn, group = null) {
    fn();
    this.changed('site', group);
  },

  select(id, { keepCanvas = false } = {}) {
    this.selected = id;
    if (!keepCanvas) canvasView.markSelected(id);
    renderRight();
  },

  /** Something outside the blocks changed (site settings, images, files). */
  changed(kind, group = null) {
    if (kind === 'pages' || kind === 'images') renderLeft();
    if (kind === 'pages') this.emit('pages');
    if (kind === 'site') {
      this.emit('site-yaml');
      // @colours and link targets follow the site; pages are read again from their text.
      this.pages.clear();
    }
    afterChange(group || kind);
    renderTabs();
    canvasView.render();
  },

  openFile(file) {
    this.currentFile = file;
    this.selected = null;
    if (this.settings.view === 'markup') editor.value = file ? this.pkg.texts[file] ?? '' : '';
    renderTabs();
    canvasView.render();
    renderRight();
    updateMarks();
    updateStatus();
    if (this.settings.leftTab === 'files' || this.settings.leftTab === 'pages') renderLeft();
    const page = this.pkg.site.pages.find(p => p.file === file);
    if (page) preview.showPage(page.path);
    else if (file && file.includes('/')) {
      const base = this.pkg.site.pages.find(p => p.file === file.split('/').slice(1).join('/'));
      if (base) {
        this.settings.mapFolder = file.split('/')[0];
        mapInput.value = this.settings.mapFolder;
        saveSettings();
        preview.showPage(base.path);
      }
    }
  },

  attributionsYaml() {
    return attributionsYaml(this.pkg);
  },

  async openSpritePicker() {
    const r = await pickSprite();
    if (r) addBlock('sprite', { attrs: { Rsi: r.rsi, State: r.state, Scale: r.scale, Align: r.align } });
  },

  insertImage(name) {
    addBlock('image', { attrs: { Path: `./${name}`, MaxHeight: '150' } });
  },

  /** Opens the Banner Studio; with a name, the package's <name>.design.json is opened for editing. */
  async openBannerStudio(options = {}) {
    // Loaded on demand, so a problem in the studio or its art never stops the editor itself.
    let studio;
    try {
      studio = await import('./banner/studio.js');
    } catch (e) {
      toast(`The Banner Studio could not load: ${e.message}`, 'error');
      return null;
    }
    const name = (options.name || 'banner').replace(/^\.\//, '').replace(/\.png$/i, '');
    const designFile = `${name}.design.json`;
    const design = designFile in this.pkg.other ? studio.readPackageDesign(this.pkg, designFile) : null;
    return studio.openStudio(this, { ...options, name, design: options.design || design });
  },

  /** The studio wrote <png> into the package: license it and put it on the page as the banner. */
  bannerMade(pngName, { blockId, height, attribution }) {
    if (!attributionFor(this.pkg, pngName)) setAttribution(this.pkg, pngName, attribution);
    const path = `./${pngName}`;
    const page = this.page();
    if (page) {
      let found = blockId ? findBlock(page.blocks, blockId) : null;
      if (!found) {
        walkBlocks(page.blocks, (b, list, index) => {
          if (!found && b.type === 'image' && b.attrs && b.attrs.Path === path) found = { block: b, list, index };
        });
      }
      if (found) {
        found.block.attrs.Path = path;
        this.selected = found.block.id;
      } else {
        const b = block('image', { attrs: { Path: path, MaxHeight: String(height) } });
        let at = 0;
        while (at < page.blocks.length && page.blocks[at].type === 'style') at++;
        page.blocks.splice(at, 0, b);
        this.selected = b.id;
      }
      this.commit('banner', { props: true });
    }
    this.changed('images', 'banner');
    toast(`Banner saved as ${path} with its design file. Its licence is filled in: check it under Images.`);
  },

  uploadImages(callback) {
    const input = el('input', { type: 'file', accept: 'image/png', multiple: true });
    input.addEventListener('change', async () => {
      const names = [];
      for (const file of input.files) {
        const name = await addImage(this, file);
        if (name) names.push(name);
      }
      callback(names);
    });
    input.click();
  },

  // ---------------------------------------------------------- block operations

  op(o) {
    const page = this.page();
    if (!page && o.op !== 'removeBoard') return;
    switch (o.op) {
      case 'add': {
        if (BLOCK_TYPES[o.type] && BLOCK_TYPES[o.type].pseudo) {
          enableBoard();
          return;
        }
        const list = targetList(page.blocks, o.target);
        if (!list) return;
        const b = block(o.type);
        list.splice(Math.min(o.index, list.length), 0, b);
        this.selected = b.id;
        this.commit('add', { props: true });
        return;
      }
      case 'move': {
        const found = findBlock(page.blocks, o.id);
        const list = targetList(page.blocks, o.target);
        if (!found || !list) return;
        let index = Math.min(o.index, list.length);
        if (found.list === list && found.index < index) index--;
        found.list.splice(found.index, 1);
        list.splice(index, 0, found.block);
        this.selected = o.id;
        this.commit('move');
        return;
      }
      case 'delete': {
        const found = findBlock(page.blocks, o.id);
        if (!found) return;
        found.list.splice(found.index, 1);
        if (this.selected === o.id) this.selected = null;
        this.commit('delete', { props: true });
        toast('Block deleted. Ctrl+Z brings it back.');
        return;
      }
      case 'duplicate': {
        const found = findBlock(page.blocks, o.id);
        if (!found) return;
        const copy = cloneBlock(found.block);
        found.list.splice(found.index + 1, 0, copy);
        this.selected = copy.id;
        this.commit('duplicate', { props: true });
        return;
      }
      case 'nudge': {
        const found = findBlock(page.blocks, o.id);
        if (!found) return;
        let to = found.index + o.delta;
        while (to >= 0 && to < found.list.length && found.list[to].type === 'style') to += o.delta;
        if (to < 0 || to >= found.list.length) return;
        found.list.splice(found.index, 1);
        found.list.splice(to, 0, found.block);
        this.commit('move');
        return;
      }
      case 'insertAfter': {
        const found = findBlock(page.blocks, o.id);
        if (!found) return;
        const b = block(o.type, o.content);
        found.list.splice(found.index + 1, 0, b);
        this.selected = b.id;
        blurEditing();
        this.commit('add', { props: true });
        if (o.focus) focusBlock(b.id);
        return;
      }
      case 'listInsert': {
        const found = findBlock(page.blocks, o.id);
        if (!found) return;
        found.block.items.splice(o.index, 0, '');
        blurEditing();
        this.commit('add');
        focusBlock(o.id, o.index);
        return;
      }
      case 'listRemove': {
        const found = findBlock(page.blocks, o.id);
        if (!found) return;
        found.block.items.splice(o.index, 1);
        blurEditing();
        this.commit('delete');
        focusBlock(o.id, Math.max(0, o.index - 1));
        return;
      }
      case 'removeBoard':
        confirmDialog('Remove the board', 'Stop this site being a board? Players will no longer post under its front page.', 'Remove').then(ok => {
          if (!ok) return;
          this.pkg.site.board = null;
          this.selected = null;
          this.changed('site');
          renderRight();
        });
        return;
      default:
    }
  },

  // ---------------------------------------------------------- page style

  pageStyleBlock() {
    const page = this.page();
    if (!page) return null;
    let found = null;
    walkBlocks(page.blocks, b => {
      if (!found && b.type === 'style') found = b;
    });
    return found;
  },

  /** Sets one CMUNetStyle attribute on the page (adding the line if needed); null removes the line. */
  setPageStyle(key, value) {
    const page = this.page();
    let style = this.pageStyleBlock();
    if (key === null) {
      if (style) {
        const found = findBlock(page.blocks, style.id);
        found.list.splice(found.index, 1);
      }
    } else {
      if (!style) {
        style = block('style', { attrs: {} });
        page.blocks.unshift(style);
      }
      if (value) style.attrs[key] = value;
      else delete style.attrs[key];
      if (!Object.keys(style.attrs).length) {
        const found = findBlock(page.blocks, style.id);
        found.list.splice(found.index, 1);
      }
    }
    this.commit('style', { props: true });
    renderTabs();
  },

  // ---------------------------------------------------------- pages and tabs

  pageOp(o) {
    pageOp(o);
  },

  editChip(chip, node) {
    openLinkDialog(chip.dataset.text, chip.dataset.link).then(r => {
      if (!r) return;
      if (r.remove) {
        chip.replaceWith(document.createTextNode(chip.dataset.text));
      } else {
        chip.dataset.text = r.text;
        chip.dataset.link = r.link;
        delete chip.dataset.bare;
        chip.textContent = r.text;
        chip.title = r.link;
      }
      node.dispatchEvent(new Event('input'));
    });
  },

  onEditorFocus(node, kind) {
    showFloatBar(node, kind);
  },

  onEditorBlur() {
    setTimeout(() => {
      if (!floatBar.contains(document.activeElement) && !floatBar.dataset.busy) hideFloatBar();
    }, 150);
  },
};

setRepoBase(app.settings.repo);
setLocalProvider(name => {
  const bytes = app.pkg.images[name] || app.pkg.other[name];
  if (!bytes) return null;
  return new Blob([bytes], { type: /\.png$/i.test(name) ? 'image/png' : /\.json$/i.test(name) ? 'application/json' : 'application/octet-stream' });
});

function blurEditing() {
  const a = document.activeElement;
  if (a && a.isContentEditable) a.blur();
}

// ---------------------------------------------------------------- layout

/** A title bar button: icon, label (hidden on small windows) and a tooltip with its shortcut. */
function ghost(iconName, label, onclick, tip = label, key = '') {
  const b = el('button.ghost', { type: 'button', onclick, dataset: { tip, key } }, iconName ? icon(iconName) : null, el('span.lbl', { text: label }));
  b.setAttribute('aria-label', label);
  return b;
}

const leftBody = el('div.left-body');
const panelTitle = el('span.panel-title');
const panelSub = el('span.panel-sub');
const saveState = el('span.sb-item', { text: 'not saved yet' });
const saveDot = el('span.dot');
const tabStrip = el('div.tab-strip');
const canvasHost = el('div.canvas-host');
const codeHost = el('div.editor-host.code-host');
const propsHost = el('div.props-host');
const previewHost = el('div.preview-host');
const pageLabel = el('span.work-title', { text: '' });
const pageSub = el('span.work-sub');
const pageMeta = el('span');
const docName = el('span.doc', { text: '' });
const docDirty = el('span.dirty', { title: 'Changes since the last export' });
const undoButton = ghost('undo', 'Undo', () => undo(), 'Undo', 'Ctrl+Z');
const redoButton = ghost('redo', 'Redo', () => redo(), 'Redo', 'Ctrl+Y');
const viewToggle = el('button.mini.view-toggle', { type: 'button', dataset: { tip: 'Show the page\'s XML, or go back to blocks' }, onclick: () => setView(app.settings.view === 'markup' ? 'blocks' : 'markup') });
const floatBar = el('div.float-bar', { style: { display: 'none' } });
const checkBadge = el('span.rail-badge.ok');
const statusIssues = el('button.sb-link', { type: 'button', dataset: { tip: 'Open the Check panel', key: 'Alt+6' }, onclick: () => setLeft('check') });
const statusPages = el('span.sb-item');
const statusPage = el('span.sb-item');
const statusRepo = el('span.sb-item');
const tip = el('div.tip');

const zipInput = el('input', { type: 'file', accept: '.zip,application/zip', style: { display: 'none' } });
const folderInput = el('input', { type: 'file', webkitdirectory: true, multiple: true, style: { display: 'none' } });

const themeSelect = select(Object.values(THEMES).map(t => [t.id, t.label]), app.settings.theme, { dataset: { tip: 'Which computer opens the page' } });
const colonyInput = textInput(app.settings.colony, { className: 'input input-small', dataset: { tip: '{colony} on pages becomes this name' } });
const mapInput = textInput(app.settings.mapFolder, { placeholder: 'map folder', className: 'input input-small', dataset: { tip: 'A map id or colony folder: shows that colony\'s own version of a page when the package has one' } });
const boardSelect = select([['sample', 'Board: sample post'], ['reader', 'Board: reader'], ['empty', 'Board: empty']], app.settings.boardMode, { dataset: { tip: 'How a board\'s postings show under the front page' } });

const PANELS = [
  { id: 'library', icon: 'library', title: 'Library', sub: 'Every site in the game, to open and curate', key: 'Alt+0' },
  { id: 'blocks', icon: 'blocks', title: 'Blocks', sub: 'Drag onto the page, or click to add', key: 'Alt+1' },
  { id: 'pages', icon: 'pages', title: 'Pages', sub: 'Each page is a tab of the site', key: 'Alt+2' },
  { id: 'site', icon: 'site', title: 'Site', sub: 'Address, look, tabs and board', key: 'Alt+3' },
  { id: 'images', icon: 'image', title: 'Images', sub: 'Banners and uploaded art', key: 'Alt+4' },
  { id: 'files', icon: 'files', title: 'Files', sub: 'Every file in the package', key: 'Alt+5' },
  { id: 'check', icon: 'checklist', title: 'Check', sub: 'The game\'s rules for pages', key: 'Alt+6' },
];
const railButtons = new Map();

/** Switches the left panel; picking the open one again folds the panel away. */
function setLeft(id, { toggle = false } = {}) {
  const app_ = document.querySelector('.app');
  if (toggle && app.settings.leftTab === id && app_) {
    const narrow = window.matchMedia('(max-width: 1100px)').matches;
    app_.classList.toggle(narrow ? 'panel-open' : 'panel-closed');
    return;
  }
  app.settings.leftTab = id;
  saveSettings();
  if (app_) {
    app_.classList.remove('panel-closed');
    if (window.matchMedia('(max-width: 1100px)').matches) app_.classList.add('panel-open');
  }
  renderLeft();
}

function header() {
  const glyph = el('button.glyph-btn#glyph', { type: 'button', dataset: { tip: 'CMU' }, onclick: () => setWoke(!document.documentElement.classList.contains('woke')) },
    el('img.glyph', { src: 'img/cmu.png', alt: '' }));
  return el('header.titlebar', {},
    el('div.brand', {}, glyph, el('span.name', { text: 'ExtraNet Editor' }), el('span.sep', { text: '/' }), docName, docDirty),
    el('nav.title-actions', {},
      ghost(null, 'New site', newSite, 'Start a new site from a layout'),
      ghost(null, 'Open zip', () => zipInput.click(), 'Open a site package zip (or drop one on the window)'),
      ghost(null, 'Open folder', openFolder, 'Open a site package folder'),
      ghost(null, 'Export zip', exportPackage, 'Download the package as a zip to unzip into Packages/', 'Ctrl+S saves in the browser'),
      el('span.top-sep'),
      undoButton, redoButton),
    el('div.title-right', {}, ghost('help', 'Help', help, 'How to use the editor')),
    zipInput, folderInput);
}

function rail() {
  const top = PANELS.map(p => {
    const b = el('button.rail-btn', { type: 'button', dataset: { tip: `${p.title}: ${p.sub}`, key: p.key }, onclick: () => setLeft(p.id, { toggle: true }) }, icon(p.icon), p.id === 'check' ? checkBadge : null);
    b.setAttribute('aria-label', p.title);
    railButtons.set(p.id, b);
    return b;
  });
  return el('nav.rail', {}, ...top,
    el('div.rail-bottom', {},
      EMULATOR ? el('button.rail-btn', { type: 'button', dataset: { tip: 'Emulator: the in-game computer, with every site' }, onclick: () => {
        location.hash = '#emulator';
      } }, icon('monitor')) : null,
      el('button.rail-btn', { type: 'button', dataset: { tip: 'Banner Studio: design a banner for the site' }, onclick: () => app.openBannerStudio() }, icon('spark')),
      el('button.rail-btn', { type: 'button', dataset: { tip: 'Repository: where game art is read from' }, onclick: () => repoSettings() }, icon('repo')),
      el('button.rail-btn', { type: 'button', dataset: { tip: 'Help', key: 'F1' }, onclick: () => help() }, icon('help'))));
}

function renderLeft() {
  app.off('site-form');
  const tab = PANELS.some(p => p.id === app.settings.leftTab) ? app.settings.leftTab : 'blocks';
  const meta = PANELS.find(p => p.id === tab);
  panelTitle.textContent = meta.title;
  panelSub.textContent = meta.sub;
  for (const [id, b] of railButtons) b.classList.toggle('on', id === tab);
  if (tab === 'library') renderLibrary(leftBody, libraryContext());
  else if (tab === 'site') renderSiteForm(leftBody, app);
  else if (tab === 'files') renderPages(leftBody, app);
  else if (tab === 'images') renderImages(leftBody, app);
  else if (tab === 'check') renderChecks();
  else if (tab === 'pages') renderPagesPanel();
  else renderPalette();
}

function renderPalette() {
  leftBody.replaceChildren(el('p.note', {}, 'Drag a block onto the page, or click one to add it after the selected block. Drop blocks into boxes, panels and columns too.'));
  for (const group of PALETTE_GROUPS) {
    const items = Object.entries(BLOCK_TYPES).filter(([, m]) => m.group === group);
    if (!items.length) continue;
    const grid = el('div.palette-grid');
    for (const [type, meta] of items) {
      const card = el('div.palette-item', { draggable: true, tabIndex: 0, dataset: { type, tip: `${meta.label}: written as ${meta.tag}` } },
        el('span.palette-icon', { text: meta.icon }), el('span.palette-label', { text: meta.label }));
      card.addEventListener('dragstart', e => startPaletteDrag(e, type));
      card.addEventListener('dragend', endDrag);
      card.addEventListener('click', () => (meta.pseudo ? enableBoard() : addBlock(type)));
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter') card.click();
      });
      grid.append(card);
    }
    leftBody.append(el('div.palette-group', {}, el('h3.section-title', { text: group === 'Live' ? 'Live game widgets' : group }), grid));
  }
}

/** Pages: one row per page, in tab order. Click to open, drag to reorder. */
function renderPagesPanel() {
  const site = app.pkg.site;
  leftBody.replaceChildren();
  leftBody.append(el('div.section-title', {}, el('span', { text: 'Pages' }), el('button.mini.accent', { type: 'button', text: '+ Add page', onclick: () => addPageDialog() })));
  const list = el('div.page-list-rows');
  let dragFrom = null;
  for (const path of orderedPaths()) {
    const page = pageForPath(site, path);
    if (!page) continue;
    const tab = site.tabs.find(t => normalizePath(t.path || '') === path);
    const home = path === '';
    const row = el(`div.page-row${app.currentFile === page.file ? '.active' : ''}`, { draggable: true, dataset: { tip: `${page.file}${tab ? '' : ' (not in the tab strip)'}` } },
      el(`span.kdot${home ? '.home' : tab ? '.tab' : ''}`),
      el('span.page-main', {}, el('span.page-name', { text: tab ? tab.title || '(no title)' : path || 'Home page' }), el('span.page-path', { text: home ? 'home' : `/${path}` })),
      el('span.row-btns', {},
        home ? null : el('button.row-btn', { type: 'button', dataset: { tip: 'Make this the home page' }, onclick: e => {
          e.stopPropagation();
          pageOp({ op: 'makeHome', path });
        } }, icon('home')),
        home ? null : el('button.row-btn.danger', { type: 'button', dataset: { tip: 'Delete this page' }, onclick: e => {
          e.stopPropagation();
          pageOp({ op: 'delete', path });
        } }, icon('trash'))));
    row.addEventListener('click', () => app.openFile(page.file));
    row.addEventListener('dragstart', e => {
      dragFrom = path;
      e.dataTransfer.setData('text/plain', `page:${path}`);
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => row.classList.remove('dragging'));
    row.addEventListener('dragover', e => {
      if (dragFrom === null) return;
      e.preventDefault();
      const r = row.getBoundingClientRect();
      row.classList.toggle('drop-above', e.clientY < r.top + r.height / 2);
      row.classList.toggle('drop-below', e.clientY >= r.top + r.height / 2);
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop-above', 'drop-below'));
    row.addEventListener('drop', e => {
      e.preventDefault();
      const r = row.getBoundingClientRect();
      const after = e.clientY >= r.top + r.height / 2;
      row.classList.remove('drop-above', 'drop-below');
      const from = dragFrom;
      dragFrom = null;
      if (from !== null && from !== path) pageOp({ op: 'reorder', path: from, before: path, after });
    });
    list.append(row);
  }
  leftBody.append(list,
    el('p.note', {}, 'The dot shows the home page (green), pages in the tab strip (blue) and pages reached only by links (grey). Rename a page by double clicking its tab above the page; its address and colours are in the page settings (click empty space on the page).'));
}

function renderTabs() {
  renderTabStrip(tabStrip, app);
}

function renderRight() {
  if (propsHost.contains(document.activeElement) && document.activeElement.matches('input, textarea, select')) return;
  renderProps(propsHost, app);
}

/** The status bar and title: autosave, checks, pages and the page on screen. */
function updateStatus() {
  const site = app.pkg.site;
  docName.textContent = site.title || app.pkg.folder || 'untitled';
  const { errors, warnings } = counts();
  const notes = app.issues.length - errors - warnings;
  statusIssues.replaceChildren(
    el(`span${errors ? '.sb-err' : ''}`, { text: `${errors} error${errors === 1 ? '' : 's'}` }),
    el(`span${warnings ? '.sb-warn' : ''}`, { text: `${warnings} warning${warnings === 1 ? '' : 's'}` }),
    el('span', { text: `${notes} note${notes === 1 ? '' : 's'}` }));
  statusPages.textContent = `${site.pages.length} page${site.pages.length === 1 ? '' : 's'}`;
  const page = app.currentPageEntry();
  statusPage.textContent = page ? `${page.path ? `/${page.path}` : 'home'}  ${page.file}` : app.currentFile || '';
  statusRepo.textContent = repoLabel();
  const tab = page && site.tabs.find(t => normalizePath(t.path || '') === normalizePath(page.path));
  pageLabel.textContent = tab ? tab.title : page ? page.path || 'Home page' : app.currentFile || 'No page';
  pageSub.textContent = page ? `${site.address}${page.path ? `/${page.path}` : ''}` : '';
  const model = app.pages.get(app.currentFile);
  let count = 0;
  if (model) walkBlocks(model.blocks, b => {
    if (b.type !== 'style') count++;
  });
  pageMeta.textContent = model ? `${count} block${count === 1 ? '' : 's'}` : '';
}

function build() {
  const appEl = el('div.app', {},
    header(),
    rail(),
    el('aside.side-panel', {}, el('section.card.panel-card', {}, el('div.panel-head', {}, panelTitle, panelSub), leftBody)),
    el('main.center', {},
      el('section.card.work-card', {},
        el('header.work-head', {}, pageLabel, pageSub, el('div.work-meta', {}, pageMeta, viewToggle)),
        el('div.tabs-row', {}, tabStrip),
        canvasHost, codeHost)),
    el('aside.inspector', {},
      el('section.card.preview-card', {},
        el('div.card-head', {}, el('span', { text: 'In game' }), el('button.mini', { type: 'button', text: '↻ Reload', dataset: { tip: 'Draw the preview again' }, onclick: () => refreshPreview.flush() })),
        el('div.preview-tools', {}, themeSelect, boardSelect, colonyInput, mapInput),
        previewHost),
      el('section.card.props-card', {}, propsHost)),
    el('footer.statusbar', {},
      saveDot, saveState, el('span.sb-sep'),
      statusIssues, el('span.sb-sep'),
      statusPages, el('span.sb-sep'),
      statusPage,
      el('span.grow'),
      statusRepo));
  document.body.append(appEl, floatBar, tip);
  wireTooltips();
}

/** Tooltips from data-tip (and data-key for a shortcut), placed beside the rail or under the control. */
function wireTooltips() {
  let timer = null;
  document.addEventListener('mouseover', e => {
    const target = e.target.closest && e.target.closest('[data-tip]');
    clearTimeout(timer);
    if (!target) {
      tip.classList.remove('on');
      return;
    }
    timer = setTimeout(() => {
      tip.replaceChildren(target.dataset.tip, target.dataset.key ? el('kbd', { text: target.dataset.key }) : '');
      const r = target.getBoundingClientRect();
      const beside = target.closest('.rail');
      const left = beside ? r.right + 10 : Math.max(8, Math.min(innerWidth - tip.offsetWidth - 10, r.left));
      const below = r.bottom + 8 + tip.offsetHeight > innerHeight ? r.top - tip.offsetHeight - 8 : r.bottom + 8;
      tip.style.left = `${left}px`;
      tip.style.top = `${beside ? r.top + r.height / 2 - tip.offsetHeight / 2 : below}px`;
      tip.classList.add('on');
    }, 380);
  });
  document.addEventListener('mousedown', () => {
    clearTimeout(timer);
    tip.classList.remove('on');
  });
}

const WOKE_KEY = 'extranet-editor-woke';

/** The CMU emblem's colours, and the app's theme with them (as in Open Vehicles). */
function setWoke(on) {
  document.documentElement.classList.toggle('woke', on);
  const btn = document.getElementById('glyph');
  if (btn) {
    btn.classList.remove('pop');
    void btn.offsetWidth;
    if (on) btn.classList.add('pop');
  }
  try {
    localStorage.setItem(WOKE_KEY, on ? '1' : '0');
  } catch {
    // the choice lasts for this visit
  }
}

try {
  if (localStorage.getItem(WOKE_KEY) === '1') document.documentElement.classList.add('woke');
} catch {
  // storage blocked: default theme
}

/** First visit: three ways to start. */
function showWelcome() {
  const center = document.querySelector('.center');
  if (!center || center.querySelector('.welcome')) return;
  const close = () => {
    overlay.remove();
    try {
      localStorage.setItem('extranet-editor-welcomed', '1');
    } catch {
      // shown again next visit
    }
  };
  const option = (iconName, title, text, fn, primary = false) => el(`button.welcome-option${primary ? '.primary' : ''}`, { type: 'button', onclick: () => {
    close();
    fn();
  } }, icon(iconName), el('strong', { text: title }), el('span', { text }));
  const overlay = el('div.welcome', {},
    el('section.card.welcome-card', {},
      el('div.welcome-title', {}, el('img', { src: 'img/cmu.png', alt: '' }), 'Build a site for the colony network'),
      el('p.welcome-sub', { text: 'Make an in-game ExtraNet site from blocks, see it as players will, and export a zip that drops straight into the game.' }),
      el('div.welcome-options', {},
        option('blocks', 'Start from a layout', 'A forum, a shop, news, a fan page, a cult board or an 80s page.', newSite, true),
        option('folder', 'Open a zip or folder', 'Keep editing a package you exported or wrote by hand.', () => zipInput.click()),
        option('write', 'Edit the example site', 'The Colony Lost and Found board, ready to change.', () => {})),
      el('div.welcome-foot', {}, el('span', { text: 'Everything you do is saved in this browser. Export a zip to keep a copy.' }),
        el('button.mini', { type: 'button', text: 'Close', onclick: close }))));
  center.append(overlay);
}

// ---------------------------------------------------------------- floating text toolbar

let floatTarget = null;
let savedRange = null;

function keepFocus(node) {
  node.addEventListener('mousedown', e => e.preventDefault());
  return node;
}

function buildFloatBar(kind) {
  floatBar.replaceChildren();
  const cmd = (label, title, fn, cls = '') => keepFocus(el(`button.float-btn${cls}`, { type: 'button', text: label, title, onclick: fn }));
  if (kind === 'rich') {
    floatBar.append(cmd('B', 'Bold', () => exec('bold'), '.fb-bold'), cmd('I', 'Italic', () => exec('italic'), '.fb-italic'));
    const colour = el('input.float-colour', { type: 'color', value: app.markupColours().heading, title: 'Colour the selected text' });
    colour.addEventListener('mousedown', () => {
      saveRange();
      floatBar.dataset.busy = '1';
    });
    colour.addEventListener('change', () => {
      restoreRange();
      exec('foreColor', colour.value);
      delete floatBar.dataset.busy;
    });
    floatBar.append(colour, cmd('Link', 'Make a link to a page', () => insertLink()));
  }
  floatBar.append(cmd('{colony}', 'The round\'s colony name', () => exec('insertText', '{colony}')));
}

function exec(command, value = null) {
  if (!floatTarget) return;
  floatTarget.focus();
  document.execCommand('styleWithCSS', false, false);
  document.execCommand(command, false, value);
}

function saveRange() {
  const sel = document.getSelection();
  savedRange = sel.rangeCount && floatTarget && floatTarget.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
}

function restoreRange() {
  if (!floatTarget) return;
  floatTarget.focus();
  if (savedRange) {
    const sel = document.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }
}

async function insertLink() {
  saveRange();
  floatBar.dataset.busy = '1';
  const target = floatTarget;
  const selected = savedRange ? savedRange.toString() : '';
  const r = await openLinkDialog(selected || 'Read more', app.linkTargets()[0] ? app.linkTargets()[0].value : app.pkg.site.address);
  delete floatBar.dataset.busy;
  if (!r || r.remove || !target) return;
  floatTarget = target;
  restoreRange();
  const sel = document.getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const chip = linkChipNode(r.text, r.link);
  range.insertNode(chip);
  range.setStartAfter(chip);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  target.dispatchEvent(new Event('input'));
}

function openLinkDialog(text, link) {
  return modal('Link', (body, close) => {
    const t = textInput(text);
    let value = link;
    body.append(field('Link text', t),
      field('Goes to', linkPicker(app, link, v => {
        value = v;
      }), 'One of this site\'s pages, a random site, or another site\'s address.'),
      buttonRow(button('OK', () => close({ text: t.value.trim() || 'link', link: value || app.pkg.site.address }), '.btn-primary'),
        button('Remove link', () => close({ remove: true }), '.btn-danger'),
        button('Cancel', () => close(null))));
  });
}

function showFloatBar(node, kind) {
  floatTarget = node;
  buildFloatBar(kind);
  floatBar.style.display = 'flex';
  const r = node.getBoundingClientRect();
  floatBar.style.top = `${Math.max(4, r.top - 36)}px`;
  floatBar.style.left = `${Math.max(4, Math.min(window.innerWidth - 280, r.left))}px`;
}

function hideFloatBar() {
  floatBar.style.display = 'none';
  floatTarget = null;
}

// ---------------------------------------------------------------- views

build();

const canvasView = new BlockCanvas(canvasHost, app);

const editor = new CodeEditor(codeHost, {
  onChange(text) {
    if (!app.currentFile) return;
    app.pkg.texts[app.currentFile] = text;
    app.pages.delete(app.currentFile);
    afterChange('code');
  },
  onCursor() {},
});

const preview = new BrowserPreview(previewHost, () => app.pkg, () => app.settings, () => {});
const refreshPreview = debounce(() => preview.refresh(), 250);
onFontLoaded(debounce(() => {
  preview.refresh();
  canvasView.render();
}, 150));

for (const [input, key, event] of [[themeSelect, 'theme', 'change'], [colonyInput, 'colony', 'input'], [mapInput, 'mapFolder', 'input'], [boardSelect, 'boardMode', 'change']]) {
  input.addEventListener(event, () => {
    app.settings[key] = input.value;
    saveSettings();
    refreshPreview();
    if (key === 'theme' || key === 'boardMode') {
      canvasView.render();
      renderTabs();
    }
  });
}

function setView(view) {
  app.settings.view = view;
  saveSettings();
  const markup = view === 'markup';
  viewToggle.textContent = markup ? '▦ Back to blocks' : '</> Show markup';
  viewToggle.classList.toggle('active', markup);
  canvasHost.style.display = markup ? 'none' : '';
  codeHost.style.display = markup ? '' : 'none';
  if (markup) {
    editor.value = app.pkg.texts[app.currentFile] || '';
    updateMarks();
  } else {
    app.pages.delete(app.currentFile);
    app.selected = null;
    canvasView.render();
    renderRight();
    updateMarks();
  }
}

/** Adds a block after the selected one (or into the selected container, or at the end of the page). */
function addBlock(type, content = null) {
  const page = app.page();
  if (!page) {
    toast('Open a page first.', 'error');
    return;
  }
  if (app.settings.view === 'markup') setView('blocks');
  const b = block(type, content || {});
  const found = app.selected && app.selected !== '@board' ? findBlock(app.page().blocks, app.selected) : null;
  if (found && found.block.columns) found.block.columns[0].children.push(b);
  else if (found && found.block.children) found.block.children.push(b);
  else if (found) found.list.splice(found.index + 1, 0, b);
  else app.page().blocks.push(b);
  app.selected = b.id;
  app.commit('add', { props: true });
  const node = canvasHost.querySelector(`.blk[data-id="${b.id}"]`);
  if (node) node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function focusBlock(id, itemIndex = null) {
  requestAnimationFrame(() => {
    const node = canvasHost.querySelector(`.blk[data-id="${id}"]`);
    if (!node) return;
    const editables = node.querySelectorAll('[contenteditable="true"], [contenteditable="plaintext-only"]');
    const target = itemIndex === null ? editables[0] : editables[itemIndex];
    if (!target) return;
    target.focus();
    const sel = document.getSelection();
    sel.selectAllChildren(target);
    sel.collapseToEnd();
  });
}

function enableBoard() {
  const site = app.pkg.site;
  if (!site.board) {
    site.board = { postLabel: 'Post a notice', empty: 'Nothing posted this shift.', posters: [], posterWhitelist: null, anyonePosts: true, showTerminals: false, bounties: false, leaks: false, hijackable: false, extra: null };
    toast('This site is now a board: postings run under its front page.');
  }
  const index = site.pages.find(p => normalizePath(p.path) === '');
  if (index && app.currentFile !== index.file) app.openFile(index.file);
  app.selected = '@board';
  app.changed('site');
  renderRight();
}

// ---------------------------------------------------------------- page operations

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'page';
}

function uniquePath(base) {
  let path = base;
  for (let i = 2; pageForPath(app.pkg.site, path); i++) path = `${base}-${i}`;
  return path;
}

function fileFor(path) {
  const base = (path || 'index').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'page';
  let name = `${base}.xml`;
  for (let i = 2; name in app.pkg.texts; i++) name = `${base}_${i}.xml`;
  return name;
}

/** Points links at pages of this site somewhere else: map is { oldPath: newPath }. */
function relink(map) {
  const site = app.pkg.site;
  const host = site.address.trim().toLowerCase();
  for (const file of Object.keys(app.pkg.texts)) {
    // link= and Link= values, and the text of a bare [netlink="host/path"] (its text is its address).
    app.pkg.texts[file] = app.pkg.texts[file].replace(/(\s(?:link|Link)="|\[netlink=")([^"]*)("\]|")/g, (m, a, value, b) => {
      if (a.startsWith('[') && b !== '"]') return m;
      const v = value.trim().toLowerCase().replace(/\/+$/, '');
      if (!(v === host || v.startsWith(host + '/'))) return m;
      const path = v === host ? '' : v.slice(host.length + 1);
      if (!(path in map)) return m;
      const to = map[path];
      return `${a}${to ? `${site.address}/${to}` : site.address}${b}`;
    });
  }
  app.pages.clear();
}

async function pageOp(o) {
  const site = app.pkg.site;
  const page = o.path !== undefined ? pageForPath(site, o.path) : null;
  switch (o.op) {
    case 'add':
      addPageDialog();
      return;
    case 'delete': {
      if (!page) return;
      if (!(await confirmDialog('Delete page', `Delete the page "${page.path}" (${page.file}) and its blocks? Ctrl+Z brings it back.`, 'Delete'))) return;
      site.pages = site.pages.filter(p => p !== page);
      site.tabs = site.tabs.filter(t => normalizePath(t.path || '') !== normalizePath(page.path));
      if (!site.pages.some(p => p.file === page.file)) delete app.pkg.texts[page.file];
      app.pages.delete(page.file);
      if (app.currentFile === page.file) app.openFile((site.pages[0] || {}).file || null);
      app.changed('pages', 'page');
      return;
    }
    case 'retitle': {
      if (!page) return;
      const tab = site.tabs.find(t => normalizePath(t.path || '') === normalizePath(page.path));
      if (tab) tab.title = o.title;
      else site.tabs.push({ title: o.title, path: page.path });
      app.changed('pages', 'page');
      renderRight();
      return;
    }
    case 'toggleTab': {
      if (!page) return;
      if (o.on) {
        if (!site.tabs.some(t => normalizePath(t.path || '') === normalizePath(page.path))) site.tabs.push({ title: page.path ? page.path.replace(/(^|[-_/])(\w)/g, (m, a, c) => (a ? ' ' : '') + c.toUpperCase()) : 'Home', path: page.path });
      } else {
        site.tabs = site.tabs.filter(t => normalizePath(t.path || '') !== normalizePath(page.path));
      }
      app.changed('pages', 'page');
      renderRight();
      return;
    }
    case 'repath': {
      if (!page || page.path === '') return;
      const to = normalizePath(o.to);
      if (!to || /\s/.test(to)) {
        toast('A page path needs letters, digits, - or /, and no spaces.', 'error');
        renderRight();
        return;
      }
      if (to === page.path) return;
      if (pageForPath(site, to)) {
        toast(`There is already a page "${to}".`, 'error');
        renderRight();
        return;
      }
      const from = page.path;
      for (const tab of site.tabs) if (normalizePath(tab.path || '') === from) tab.path = to;
      page.path = to;
      relink({ [from]: to });
      app.changed('pages', 'page');
      renderRight();
      return;
    }
    case 'makeHome': {
      const index = pageForPath(site, '');
      if (!page || !index || page === index) return;
      const old = page.path;
      page.path = '';
      index.path = old;
      for (const tab of site.tabs) {
        const p = normalizePath(tab.path || '');
        if (p === old) tab.path = '';
        else if (p === '') tab.path = old;
      }
      relink({ '': old, [old]: '' });
      toast('Home page changed. Links between the two pages were updated.');
      app.changed('pages', 'page');
      return;
    }
    case 'reorder': {
      const order = orderedPaths();
      const from = order.indexOf(normalizePath(o.path));
      if (from < 0) return;
      const [moved] = order.splice(from, 1);
      let to = order.indexOf(normalizePath(o.before));
      if (to < 0) to = order.length;
      else if (o.after) to++;
      order.splice(to, 0, moved);
      site.tabs.sort((a, b) => order.indexOf(normalizePath(a.path || '')) - order.indexOf(normalizePath(b.path || '')));
      site.pages.sort((a, b) => order.indexOf(normalizePath(a.path)) - order.indexOf(normalizePath(b.path)));
      app.changed('pages', 'page');
      return;
    }
    default:
  }
}

function orderedPaths() {
  const site = app.pkg.site;
  const out = site.tabs.map(t => normalizePath(t.path || ''));
  for (const p of site.pages) if (!out.includes(normalizePath(p.path))) out.push(normalizePath(p.path));
  return out;
}

/** A template page's markup with the template's own address swapped for this site's. */
function templatePage(template, pageIndex = 0) {
  let xml = template.pages[pageIndex].xml;
  if (!template.address) return xml;
  // The template's other pages are not added with it, so links to them go to this site's home page.
  const own = template.address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  xml = xml.replace(new RegExp(`${own}/[a-z0-9/-]+`, 'g'), template.address);
  return xml.split(template.address).join(app.pkg.site.address);
}

function addPageDialog() {
  return modal('Add a page', (body, close) => {
    const title = textInput('New page');
    let chosen = 'blank';
    const tab = el('input', { type: 'checkbox', checked: true });
    body.append(field('Tab title', title, 'Its address path is made from the title; change it later in the page settings.'),
      el('label.check', {}, tab, 'Show it in the tab strip'),
      el('div.field-label', { text: 'Start from' }),
      templateCards(id => {
        chosen = id;
      }, true),
      buttonRow(button('Add page', () => {
        const site = app.pkg.site;
        const path = uniquePath(slug(title.value));
        const file = fileFor(path);
        const xml = chosen === '@copy' ? app.pkg.texts[app.currentFile] || templatePage(templateById('blank')) : templatePage(templateById(chosen));
        site.pages.push({ path, file });
        if (tab.checked) {
          if (!site.tabs.length) site.tabs.push({ title: 'Home', path: '' });
          site.tabs.push({ title: title.value.trim() || path, path });
        }
        app.pkg.texts[file] = xml;
        close(true);
        app.changed('pages', 'page');
        app.openFile(file);
      }, '.btn-primary'), button('Cancel', () => close(null))));
  }, { wide: true });
}

/** Starter layout cards. */
function templateCards(onPick, withCopy = false) {
  const grid = el('div.template-grid');
  const items = TEMPLATES.map(t => [t.id, t.name, t.blurb, t.style]);
  if (withCopy) items.push(['@copy', 'Copy of this page', 'The page you are on, as a starting point.', null]);
  items.forEach(([id, name, blurb, style], i) => {
    const swatch = style
      ? el('div.template-swatch', { style: { background: style.background, color: style.heading, fontFamily: style.font === 'Mono' || style.font === 'Terminal' ? 'monospace' : 'inherit' } },
        el('div.template-swatch-h', { text: name.toUpperCase() }),
        el('div.template-swatch-l', { style: { background: style.text } }),
        el('div.template-swatch-l.short', { style: { background: style.link } }))
      : el('div.template-swatch.template-swatch-copy', { text: '⧉' });
    const card = el(`button.template-card${i === 0 ? '.chosen' : ''}`, { type: 'button', dataset: { template: id } }, swatch, el('strong', { text: name }), el('span.muted', { text: blurb }));
    card.addEventListener('click', () => {
      for (const c of grid.children) c.classList.toggle('chosen', c === card);
      onPick(id);
    });
    grid.append(card);
  });
  return grid;
}

function newSite() {
  return modal('New site', (body, close) => {
    const title = textInput('My Site');
    const address = textInput('mysite.colony');
    let chosen = 'blank';
    const banner = el('input', { type: 'checkbox', checked: false });
    body.append(
      el('p.note', { text: 'Pick a starter layout. Every part of it becomes blocks you can change. The current site is replaced; export it first to keep it.' }),
      el('div.grid-2', {}, field('Site title', title), field('Address', address, 'Lowercase, no slashes: what players type.')),
      el('div.field-label', { text: 'Layout' }),
      templateCards(id => {
        chosen = id;
      }),
      el('label.check', {}, banner, 'Design a banner for it in the Banner Studio'),
      buttonRow(button('Create site', () => {
        const addr = address.value.trim().toLowerCase().replace(/[\s/]+/g, '');
        if (!addr) {
          toast('Give the site an address.', 'error');
          return;
        }
        close(true);
        setPackage(packageFromTemplate(templateById(chosen), title.value.trim() || 'My Site', addr), `New site from the ${templateById(chosen).name} layout.`);
        if (banner.checked) app.openBannerStudio();
      }, '.btn-primary'), button('Open the LostAndFound example', () => {
        close(true);
        fromExample();
      }), button('Cancel', () => close(null))));
  }, { wide: true });
}

function packageFromTemplate(template, title, address) {
  const pkg = emptyPackage();
  const name = folderFromTitle(title);
  pkg.folder = name;
  pkg.site.id = `CMUNetSitePackage${name}`;
  pkg.site.title = title;
  pkg.site.address = address;
  pkg.site.style = { ...template.style };
  pkg.site.board = template.board ? JSON.parse(JSON.stringify(template.board)) : null;
  if (template.deep) {
    pkg.site.networks = ['CMUNetDeep'];
    pkg.site.unlisted = true;
  }
  pkg.texts = {};
  pkg.site.pages = [];
  pkg.site.tabs = [];
  for (const page of template.pages) {
    const file = page.path ? `${page.path.replace(/[^a-z0-9]+/g, '_')}.xml` : 'index.xml';
    pkg.site.pages.push({ path: page.path, file });
    pkg.site.tabs.push({ title: page.tab, path: page.path });
    pkg.texts[file] = template.address ? page.xml.split(template.address).join(address) : page.xml;
  }
  if (template.pages.length < 2) pkg.site.tabs = [];
  return pkg;
}

// ---------------------------------------------------------------- validation

let validateToken = 0;
const revalidate = debounce(async () => {
  const token = ++validateToken;
  const { issues, parsedPages } = validateSync(app.pkg);
  app.issues = issues;
  updateChecks();
  const more = await validateAsync(app.pkg, parsedPages);
  if (token !== validateToken) return;
  app.issues = issues.concat(more);
  updateChecks();
}, 400);

function counts() {
  const errors = app.issues.filter(i => i.level === 'error').length;
  const warnings = app.issues.filter(i => i.level === 'warning').length;
  return { errors, warnings };
}

function updateChecks() {
  const { errors, warnings } = counts();
  checkBadge.textContent = errors ? String(errors) : warnings ? String(warnings) : '';
  checkBadge.className = `rail-badge ${errors ? 'bad' : warnings ? 'warn' : 'ok'}`;
  updateStatus();
  updateMarks();
  if (app.settings.leftTab === 'check') renderChecks();
  if (app.selected && app.selected !== '@board') renderRight();
}

/** Ties each issue on the current page to the innermost block covering its line. */
function updateMarks() {
  const file = app.currentFile;
  const text = app.pkg.texts[file] || '';
  const positions = app.positions.get(file);
  const byBlock = new Map();
  const lineMarks = new Map();
  const rank = { info: 1, warning: 2, error: 3 };
  const spans = positions ? [...positions].map(([id, [start, end]]) => [id, lineCol(text, start).line, lineCol(text, Math.max(start, end - 1)).line]) : [];
  for (const issue of app.issues) {
    if (issue.file !== file || !issue.line) continue;
    const prev = lineMarks.get(issue.line);
    if (!prev || rank[issue.level] > rank[prev]) lineMarks.set(issue.line, issue.level);
    if (issue.level === 'info') continue;
    let best = null;
    let bestSpan = Infinity;
    for (const [id, a, b] of spans) {
      if (issue.line >= a && issue.line <= b && b - a <= bestSpan) {
        best = id;
        bestSpan = b - a;
      }
    }
    if (best) {
      if (!byBlock.has(best)) byBlock.set(best, []);
      byBlock.get(best).push(issue);
    }
  }
  app.blockIssues = byBlock;
  editor.setMarks(lineMarks);
  canvasView.updateMarks();
}

function renderChecks() {
  const { errors, warnings } = counts();
  const infos = app.issues.length - errors - warnings;
  leftBody.replaceChildren();
  leftBody.append(el(`div.check-summary${errors ? '.bad' : '.good'}`, {},
    errors ? `${errors} error${errors === 1 ? '' : 's'}: CMUExtraNetTest would fail.` : 'No errors: the package passes the game\'s checks the editor knows.',
    el('br'), el('span.muted', { text: `${warnings} warning${warnings === 1 ? '' : 's'}, ${infos} note${infos === 1 ? '' : 's'}` })));
  const order = { error: 0, warning: 1, info: 2 };
  const sorted = [...app.issues].sort((a, b) => order[a.level] - order[b.level] || String(a.file).localeCompare(String(b.file)) || (a.line || 0) - (b.line || 0));
  const list = el('div.issue-list');
  for (const issue of sorted) {
    const where = issue.line ? `${issue.file}:${issue.line}` : issue.file;
    list.append(el(`div.issue.issue-${issue.level}`, { onclick: () => jumpTo(issue) },
      el('span.issue-level', { text: issue.level === 'error' ? 'ERR' : issue.level === 'warning' ? 'WARN' : 'NOTE' }),
      el('span.issue-where', { text: where }),
      el('span.issue-text', { text: issue.message })));
  }
  leftBody.append(list,
    el('p.note', { text: 'Checks follow CMUExtraNetTest and the tags\' own rules. Problems on the page are outlined on their block. Links to other sites are notes only: a package can link anywhere.' }));
}

function jumpTo(issue) {
  if (issue.file in app.pkg.texts) {
    if (app.currentFile !== issue.file) app.openFile(issue.file);
    if (app.settings.view === 'markup') {
      if (issue.line) editor.goToLine(issue.line);
      return;
    }
    const hit = [...app.blockIssues.entries()].find(([, list]) => list.includes(issue));
    if (hit) {
      app.select(hit[0]);
      const node = canvasHost.querySelector(`.blk[data-id="${hit[0]}"]`);
      if (node) node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else if (issue.line) {
      setView('markup');
      editor.goToLine(issue.line);
    }
    return;
  }
  if (issue.file === 'site.yml') app.settings.leftTab = 'site';
  else if (issue.file === 'attributions.yml' || issue.file === 'images') app.settings.leftTab = 'images';
  else return;
  saveSettings();
  renderLeft();
}

// ---------------------------------------------------------------- history and saving

function snapshot() {
  return { site: app.pkg.site, folder: app.pkg.folder, texts: app.pkg.texts, attributions: app.pkg.attributions, file: app.currentFile };
}

const recordTyping = debounce(() => {
  history.record(snapshot());
  updateUndoButtons();
}, 600);

function record(group) {
  if (group === 'typing' || group === 'code') recordTyping();
  else {
    recordTyping.flush();
    history.record(snapshot());
    updateUndoButtons();
  }
}

function updateUndoButtons() {
  undoButton.disabled = !history.canUndo;
  redoButton.disabled = !history.canRedo;
}

function applySnapshot(state) {
  if (!state) return;
  app.pkg.site = state.site;
  app.pkg.folder = state.folder;
  app.pkg.texts = state.texts;
  app.pkg.attributions = state.attributions;
  app.pages.clear();
  app.selected = null;
  const file = state.file in app.pkg.texts ? state.file : Object.keys(app.pkg.texts)[0];
  renderLeft();
  app.openFile(file);
  autosave();
  revalidate();
  refreshPreview();
  updateUndoButtons();
}

function undo() {
  recordTyping.flush();
  applySnapshot(history.undo());
}

function redo() {
  applySnapshot(history.redo());
}

function afterChange(group) {
  autosave();
  revalidate();
  refreshPreview();
  if (group) record(group);
  docDirty.classList.add('on');
  updateStatus();
  if (app.settings.leftTab === 'library' && app.pkg.origin) refreshLibrary();
}

const refreshLibrary = debounce(() => {
  if (app.settings.leftTab === 'library' && !leftBody.contains(document.activeElement)) renderLeft();
}, 800);

// ---------------------------------------------------------------- library

/** A function, so the panel can be drawn before this part of the file has run. */
function libraryContext() {
  return {
    app,
    rerender: () => renderLeft(),
    async open(entry) {
      if (docDirty.classList.contains('on') && !app.pkg.origin && !(await confirmDialog('Open a site', 'The site you are editing has changes since its last export. It stays autosaved only until another site replaces it. Open anyway?', 'Open'))) return;
      toast(`Opening ${entry.title}…`);
      await loadResult(openEntry(entry), entry.title);
    },
    exportPackage: () => exportPackage(),
    async exportChanges() {
      try {
        const { blob, diff } = await exportChanges(app.pkg);
        download(blob, `${app.pkg.folder || 'site'}-changes.zip`);
        toast(`Exported ${diff.changed.length + diff.added.length} page file${diff.changed.length + diff.added.length === 1 ? '' : 's'} with CHANGES.md: unzip at the repository root.`);
      } catch (e) {
        toast(`Export failed: ${e.message}`, 'error');
      }
    },
    setRepo(url) {
      app.settings.repo = url;
      setRepoBase(url);
      saveSettings();
      revalidate();
      refreshPreview.flush();
      canvasView.render();
      renderLeft();
      toast(`Reading game files from ${repoLabel()}`);
    },
  };
}

const autosave = debounce(async () => {
  const where = await saveWorking(app.pkg);
  saveState.textContent = where ? `autosaved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'autosave unavailable';
  saveDot.className = `dot ${where ? 'ready' : 'error'}`;
  saveState.title = where === 'localstorage' ? 'Saved to localStorage: images are not kept across reloads.' : where ? 'Saved in this browser (IndexedDB).' : 'This browser blocks storage; export a zip to keep your work.';
}, 600);

function setPackage(pkg, message) {
  app.pkg = pkg;
  app.pages.clear();
  app.positions.clear();
  app.selected = null;
  const first = pkg.site.pages.find(p => p.path === '') || pkg.site.pages[0];
  renderLeft();
  preview.history = [];
  preview.index = -1;
  app.openFile(first ? first.file : Object.keys(pkg.texts)[0] || null);
  history.reset(snapshot());
  updateUndoButtons();
  autosave();
  revalidate.flush();
  docDirty.classList.remove('on');
  updateStatus();
  if (message) toast(message);
}

async function fromExample() {
  const encoder = new TextEncoder();
  const files = Object.fromEntries(Object.entries(TEMPLATE_FILES).map(([k, v]) => [k, encoder.encode(v)]));
  const { pkg } = packageFromFiles(TEMPLATE_FOLDER, files);
  setPackage(pkg, 'Opened the LostAndFound example. Rename it under Site before exporting.');
}

async function loadResult(promise, label) {
  try {
    const { pkg, warnings } = await promise;
    setPackage(pkg, `Opened ${label}: ${pkg.folder}`);
    for (const w of warnings) toast(w, 'warn');
  } catch (e) {
    toast(e instanceof YamlError ? e.message : `Could not open ${label}: ${e.message}`, 'error');
  }
}

zipInput.addEventListener('change', () => {
  const file = zipInput.files[0];
  zipInput.value = '';
  if (file) loadResult(importZip(file), file.name);
});

folderInput.addEventListener('change', () => {
  const files = [...folderInput.files];
  folderInput.value = '';
  if (files.length) loadResult(importFolderFiles(files), 'folder');
});

async function openFolder() {
  if (window.showDirectoryPicker) {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      await loadResult(importDirectoryHandle(handle), handle.name);
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  folderInput.click();
}

async function exportPackage() {
  revalidate.flush();
  const { errors } = counts();
  if (errors && !(await confirmDialog('Export with errors', `The package has ${errors} error${errors === 1 ? '' : 's'} the game's tests would catch. Export anyway?`, 'Export'))) return;
  try {
    const blob = await exportZip(app.pkg);
    download(blob, `${app.pkg.folder || 'Package'}.zip`);
    docDirty.classList.remove('on');
    toast(`Exported ${app.pkg.folder}.zip: unzip it into Content.CMU/Resources/ServerInfo/CMU14/ExtraNet/Packages/.`);
  } catch (e) {
    toast(`Export failed: ${e.message}`, 'error');
  }
}

document.addEventListener('dragover', e => {
  if ([...e.dataTransfer.items].some(i => i.kind === 'file')) e.preventDefault();
});
document.addEventListener('drop', e => {
  const file = [...e.dataTransfer.files].find(f => /\.zip$/i.test(f.name));
  if (!file) return;
  e.preventDefault();
  loadResult(importZip(file), file.name);
});

function typingTarget(t) {
  return t && t.closest && t.closest('input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]');
}

/** Pasting page markup onto the canvas turns it into blocks after the selected one. */
export function pasteMarkup(text) {
  const page = app.page();
  if (!page) return 0;
  const pasted = importPage(text);
  const found = app.selected && app.selected !== '@board' ? findBlock(page.blocks, app.selected) : null;
  const list = found ? found.list : page.blocks;
  const at = found ? found.index + 1 : list.length;
  // The page keeps its own style line; a pasted page's one is dropped.
  const blocks = pasted.blocks.filter(b => b.type !== 'style').map(cloneBlock);
  list.splice(at, 0, ...blocks);
  app.commit('paste');
  return blocks.length;
}

document.addEventListener('paste', e => {
  if (typingTarget(e.target) || e.target.closest('dialog') || document.querySelector('.studio') || app.settings.view !== 'blocks') return;
  const text = e.clipboardData.getData('text/plain');
  if (!/<Document>|<CMUNet|<CMUGuide|^\s*#/.test(text)) return;
  e.preventDefault();
  const count = pasteMarkup(text);
  toast(`Pasted ${count} block${count === 1 ? '' : 's'}.`);
});

document.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey;
  if (e.key === 'F1') {
    e.preventDefault();
    help();
    return;
  }
  if (e.altKey && !mod && /^[0-6]$/.test(e.key) && !document.querySelector('dialog[open], .studio, .emu')) {
    e.preventDefault();
    setLeft(PANELS.find(p => p.key === `Alt+${e.key}`).id);
    return;
  }
  if (mod && e.key.toLowerCase() === 's') {
    e.preventDefault();
    autosave.flush();
    toast('Saved in this browser. Use Export zip to get the files.');
    return;
  }
  if (document.querySelector('dialog[open], .studio')) return;
  const typing = typingTarget(e.target);
  if (mod && !typing && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault();
    undo();
    return;
  }
  if (mod && !typing && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
    e.preventDefault();
    redo();
    return;
  }
  if (typing || !app.selected || app.selected === '@board' || app.settings.view !== 'blocks') return;
  if (e.key === 'Delete') {
    e.preventDefault();
    app.op({ op: 'delete', id: app.selected });
  } else if (mod && e.key.toLowerCase() === 'd') {
    e.preventDefault();
    app.op({ op: 'duplicate', id: app.selected });
  } else if (e.key === 'Escape') {
    app.select(null);
  } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault();
    app.op({ op: 'nudge', id: app.selected, delta: e.key === 'ArrowUp' ? -1 : 1 });
  }
});

function repoSettings() {
  modal('Repository', (body, close) => {
    const repo = textInput(getRepoBase());
    const local = localCheckoutBase();
    body.append(
      el('p.note', { text: 'Game sprites, textures, fonts, ads and wallpapers are read from here. "bundled" is the snapshot of the game\'s ExtraNet pages and CMU art shipped with the editor, with GitHub master behind it for the other game sprites. A raw repository URL (a fork or branch) or a local checkout reads everything from there.' }),
      field('Source', repo, 'bundled, or https://raw.githubusercontent.com/<owner>/<repo>/<branch>/'),
      buttonRow(button('Bundled snapshot', () => {
        repo.value = BUNDLED;
      }), button('GitHub Personal-Computers', () => {
        repo.value = GITHUB_REPO;
      }), local ? button('This checkout', () => {
        repo.value = local;
      }) : null),
      buttonRow(button('Save', () => {
        app.settings.repo = repo.value.trim() || DEFAULT_REPO;
        setRepoBase(app.settings.repo);
        saveSettings();
        close(true);
        revalidate();
        refreshPreview.flush();
        canvasView.render();
        renderLeft();
        toast(`Reading game files from ${repoLabel()}`);
      }, '.btn-primary'), button('Cancel', () => close(null))));
  });
}

function help() {
  modal('How to use', body => {
    body.append(el('div.help', { html: `
      <p><b>The screen.</b> The rail on the left switches the panel next to it: Library (<kbd>Alt+0</kbd>), then
        Blocks, Pages, Site, Images, Files and Check (<kbd>Alt+1</kbd> to <kbd>Alt+6</kbd>; click the open one again to
        fold it away). The page you build
        is in the middle. On the right are the page as the game draws it, and the settings of what you selected. The
        bar at the bottom shows autosave, the checks (click them to open Check) and the page on screen.</p>
      <p><b>1. Pages are tabs.</b> The strip above the page holds one tab per page. Click to open, double click to
        rename, drag to reorder, &#8962; to make one the home page, <b>+ Page</b> to add one from a starter layout. The
        <b>Pages</b> panel lists them too.</p>
      <p><b>2. Blocks.</b> Drag blocks from the <b>Blocks</b> list onto the page, between other blocks or into boxes,
        panels and columns. Drag a block by its &#10303; handle to move it. Click a block to edit its settings on the
        right; type straight onto headings, paragraphs and lists. Select text for bold, italic, colour and links.</p>
      <p><b>3. Look.</b> The site's colours and font are in the <b>Site</b> tab and theme every page. A page can
        override them in its page settings (click empty space on the page).</p>
      <p><b>4. Art.</b> Use <b>Game sprite</b> for anything that exists in game. Upload a PNG only for banners and
        backgrounds, and give each a licence (it goes into attributions.yml).</p>
      <p><b>5. Check and export.</b> Fix every error in <b>Check</b> (the block with the problem is outlined in red),
        then <b>Export zip</b> and unzip it into <code>Content.CMU/Resources/ServerInfo/CMU14/ExtraNet/Packages/</code>.</p>
      <p><b>Curating the game's sites.</b> <b>Library</b> lists every site in the game. Click one to open it here,
        mark it Reviewed or Needs work with a note, and use <b>Export changes</b> for a zip of the changed pages at
        their repository paths with a CHANGES.md. The monitor icon opens the <b>emulator</b>: the in-game computer,
        browsing every site with the live widgets running.</p>
      <p><b>6. Banner.</b> The &#10022; button on the rail opens the Banner Studio for the site's banner.</p>
      <p><b>Keys:</b> <kbd>Ctrl+Z</kbd> undo, <kbd>Ctrl+Y</kbd> redo, <kbd>Del</kbd> deletes the selected block,
        <kbd>Ctrl+D</kbd> duplicates it, <kbd>Alt+Up/Down</kbd> moves it, <kbd>Ctrl+S</kbd> saves in the browser,
        <kbd>F1</kbd> this help. Paste page markup onto the page to turn it into blocks. <b>Show markup</b> shows the
        page's XML; edits there come back as blocks.</p>` }));
  });
}

// ---------------------------------------------------------------- start

setView(app.settings.view === 'markup' ? 'markup' : 'blocks');

(async () => {
  let restored = null;
  try {
    restored = await loadWorking();
  } catch {
    restored = null;
  }
  if (restored && restored.pkg && restored.pkg.site) {
    setPackage(normalisePackage(restored.pkg));
    saveState.textContent = 'restored from this browser';
    saveDot.className = 'dot ready';
  } else {
    await fromExample();
  }
  let welcomed = false;
  try {
    welcomed = localStorage.getItem('extranet-editor-welcomed') === '1';
  } catch {
    welcomed = false;
  }
  if ((!welcomed && !/[?&]linkcheck/.test(location.search)) || /[?&]welcome/.test(location.search)) showWelcome();
})();

// ---------------------------------------------------------------- emulator

/** #emulator opens the in-game computer over the editor; leaving the hash closes it. */
async function routeEmulator() {
  if (!EMULATOR) return;
  const module = await import('./emulator/emulator.js');
  if (location.hash === '#emulator') {
    module.openEmulator({
      // The site open in the editor is live on the emulator's ExtraNet, over a game site at the same address.
      userSites: () => (app.pkg && app.pkg.site && app.pkg.site.address ? [userEntry(app.pkg)] : []),
      onClose: () => {
        history_.replaceState(null, '', location.pathname + location.search);
        module.closeEmulator();
      },
    });
  } else {
    module.closeEmulator();
  }
}
const history_ = window.history;
window.addEventListener('hashchange', routeEmulator);
routeEmulator();

// The link sweep: ?linkcheck shows its report; extranetEditor.linkCheck() returns it.
async function linkCheck() {
  const { linkCheck: run, formatReport } = await import('./emulator/linkcheck.js');
  const report = await run({ extraSites: () => (app.pkg && app.pkg.site.address ? [userEntry(app.pkg)] : []) });
  return { report, text: formatReport(report) };
}
if (/[?&]linkcheck/.test(location.search)) {
  linkCheck().then(({ text }) => {
    console.log(text);
    modal('Link check', body => body.append(el('pre.linkcheck', { text })), { wide: true });
  }).catch(e => toast(`Link check failed: ${e.message}`, 'error'));
}

// For tests from the console.
window.extranetEditor = { app, siteYaml: () => siteYaml(app.pkg), preview, editor, canvas: canvasView, history, undo, redo, setView, pageOp, addBlock, pasteMarkup, packageFromTemplate, setPackage, linkCheck };
