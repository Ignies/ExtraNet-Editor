// The block canvas: the page drawn in its in-game style, one block per frame. Blocks are dragged in from the
// palette, dragged to reorder or into boxes and columns, selected to edit their settings, and text is typed
// straight onto the page.

import { el } from './util.js';
import { BLOCK_TYPES, blockMarkup, findBlock, contains } from './blocks.js';
import { renderSnippet, applyPageVars } from './render.js';
import { markupToHtml, htmlToMarkup } from './richedit.js';
import { BrowserPreview } from './browser.js';
import { ensureFont } from './fonts.js';
import { hexColour } from './markup.js';
import { resolveAttr } from './blocks.js';

/** What is being dragged: { kind: 'new', type } or { kind: 'move', id }. */
let dragging = null;

export function startPaletteDrag(event, type) {
  dragging = { kind: 'new', type };
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData('text/plain', `block:${type}`);
}

export function endDrag() {
  dragging = null;
  document.querySelectorAll('.drop-indicator').forEach(n => n.remove());
  document.querySelectorAll('.drop-over').forEach(n => n.classList.remove('drop-over'));
}

const ALIGN = { Left: 'flex-start', Center: 'center', Right: 'flex-end', Stretch: 'stretch' };

export class BlockCanvas {
  /**
   * app: { page(), style(), colours(), selected, select(id), op(...), editText(id, fn), isIndex(), pkg, settings,
   *        onEditorFocus(el, kind), blockIssues }
   */
  constructor(host, app) {
    this.app = app;
    this.host = host;
    this.timers = [];
    this.pendingRender = false;
    this.scroll = el('div.canvas-scroll');
    this.pageEl = el('div.canvas-page.page-content');
    this.scroll.append(this.pageEl);
    host.replaceChildren(this.scroll);
    this.wireDrops();
    let last = performance.now();
    const tick = now => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      for (const t of this.timers) t(dt);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    this.scroll.addEventListener('click', e => {
      if (e.target === this.scroll || e.target === this.pageEl || e.target.classList.contains('drop-root')) app.select(null);
    });
  }

  /** True while the person is typing in a block; redrawing then would lose their cursor. */
  editing() {
    const a = document.activeElement;
    return !!(a && this.pageEl.contains(a) && a.isContentEditable);
  }

  render() {
    if (this.editing()) {
      this.pendingRender = true;
      this.updateMarks();
      return;
    }
    this.pendingRender = false;
    const page = this.app.page();
    const style = this.app.style();
    const top = this.scroll.scrollTop;
    this.timers = [];
    this.style = style;
    ensureFont(style.font);
    applyPageVars(this.pageEl, style);
    this.pageEl.style.background = cssColour(style.background);
    this.scroll.style.background = cssColour(style.background);
    this.pageEl.replaceChildren();
    if (!page) {
      this.pageEl.append(el('div.canvas-empty', { text: 'No page open.' }));
      return;
    }
    if (page.error) {
      this.pageEl.append(el('div.canvas-banner.canvas-banner-error', { text: `This page does not parse (line ${page.error.line}: ${page.error.message}). It is kept as one raw markup block; fix it there or in the markup view.` }));
    }
    const root = this.list(page.blocks, { blockId: null }, 'y');
    root.classList.add('drop-root');
    this.pageEl.append(root);
    if (this.app.isIndex() && this.app.pkg.site.board) this.pageEl.append(this.boardBlock(style));
    this.scroll.scrollTop = top;
    this.updateMarks();
  }

  /** A drop zone holding a list of blocks. */
  list(blocks, target, axis) {
    const list = el(`div.drop-list.drop-${axis}`, { dataset: { target: JSON.stringify(target), axis } });
    blocks.forEach((b, index) => {
      if (b.type === 'style') return;
      const node = this.block(b, index);
      if (node) list.append(node);
    });
    if (!blocks.some(b => b.type !== 'style')) {
      list.append(el('div.drop-empty', { text: target.blockId ? 'Drop blocks here' : 'Drag blocks here from the left, or pick a starter layout with + next to the tabs.' }));
    }
    return list;
  }

  block(b, index) {
    const meta = BLOCK_TYPES[b.type] || { label: b.type };
    const selected = this.app.selected === b.id;
    const wrap = el(`div.blk.blk-${b.type}${selected ? '.selected' : ''}`, { dataset: { id: b.id, index: String(index) } });
    const handle = el('span.blk-handle', { title: 'Drag to move', text: '⠿' });
    const bar = el('div.blk-bar', {},
      handle,
      el('span.blk-label', { text: meta.label + (b.type === 'heading' ? ` ${b.level}` : '') }),
      el('button.blk-btn', { type: 'button', title: 'Duplicate (Ctrl+D)', text: '⧉', onclick: e => {
        e.stopPropagation();
        this.app.op({ op: 'duplicate', id: b.id });
      } }),
      el('button.blk-btn.blk-del', { type: 'button', title: 'Delete (Del)', text: '✕', onclick: e => {
        e.stopPropagation();
        this.app.op({ op: 'delete', id: b.id });
      } }));
    handle.addEventListener('mousedown', () => {
      wrap.draggable = true;
    });
    handle.addEventListener('mouseup', () => {
      wrap.draggable = false;
    });
    wrap.addEventListener('dragstart', e => {
      if (!wrap.draggable) return;
      e.stopPropagation();
      dragging = { kind: 'move', id: b.id };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', `move:${b.id}`);
      wrap.classList.add('dragging');
    });
    wrap.addEventListener('dragend', () => {
      wrap.draggable = false;
      wrap.classList.remove('dragging');
      endDrag();
    });
    wrap.addEventListener('mousedown', e => {
      if (e.target.closest('.blk') !== wrap) return;
      if (this.app.selected !== b.id) this.app.select(b.id, { keepCanvas: true });
      this.markSelected(b.id);
    });
    const body = el('div.blk-body');
    body.append(...this.body(b));
    wrap.append(bar, body);
    return wrap;
  }

  markSelected(id) {
    for (const node of this.pageEl.querySelectorAll('.blk.selected')) node.classList.remove('selected');
    const node = id && this.pageEl.querySelector(`.blk[data-id="${id}"]`);
    if (node) node.classList.add('selected');
  }

  ctx() {
    return { colours: this.app.colours(), onLink: () => {} };
  }

  snippet(b) {
    const markup = blockMarkup(b, this.app.markupColours());
    const r = renderSnippet(markup, this.style, this.ctx());
    this.timers.push(...r.timers.filter(() => b.type === 'marquee'));
    for (const popup of r.popups) {
      popup.classList.add('net-popup-inline');
      r.nodes.push(popup);
    }
    return r.nodes;
  }

  body(b) {
    switch (b.type) {
      case 'heading':
        return [this.headingEditor(b)];
      case 'paragraph':
        return [this.richEditor(b, 'text', el('div.page-text'))];
      case 'list':
        return [this.listEditor(b)];
      case 'blink':
        return [el('div.frame-tag', { text: `blinks every ${b.attrs.Rate || '0.6'} s` }), this.list(b.children, { blockId: b.id }, 'y')];
      case 'box': {
        const vertical = b.attrs.Orientation === 'Vertical';
        const list = this.list(b.children, { blockId: b.id }, vertical ? 'y' : 'x');
        list.classList.add('gb-box-list');
        list.style.alignSelf = ALIGN[b.attrs.HorizontalAlignment || 'Center'];
        if (b.attrs.Margin) list.style.margin = `${parseFloat(b.attrs.Margin) || 0}px`;
        return [list];
      }
      case 'columns': {
        const row = el('div.cols-row');
        b.columns.forEach((column, i) => {
          const list = this.list(column.children, { blockId: b.id, column: i }, 'y');
          list.classList.add('col-list');
          if (column.attrs.Margin) list.style.margin = `${parseFloat(column.attrs.Margin) || 0}px`;
          row.append(list);
        });
        return [row];
      }
      case 'panel': {
        const c = this.app.markupColours();
        const panel = el('div.gb-colorbox.panel-frame');
        panel.style.background = cssColour(resolveAttr(b.attrs.Color, c) || '#00000000');
        panel.style.borderColor = cssColour(resolveAttr(b.attrs.OutlineColor, c) || '#FFFFFF');
        panel.style.borderWidth = `${parseFloat(b.attrs.OutlineThickness ?? '1') || 0}px`;
        if (b.attrs.Margin) panel.style.margin = `${parseFloat(b.attrs.Margin) || 0}px`;
        const list = this.list(b.children, { blockId: b.id }, 'y');
        if (b.inner && b.inner.Margin) list.style.margin = `${parseFloat(b.inner.Margin) || 0}px`;
        panel.append(list);
        return [panel];
      }
      case 'raw':
        return [el('div.frame-tag.frame-raw', { text: 'raw markup' }), ...this.snippet(b)];
      case 'linklist':
      case 'divider':
        return this.snippet(b);
      case 'arcade':
      case 'sportsbook':
      case 'spacegpt':
      case 'recipes':
      case 'search':
      case 'tape':
      case 'tapelink':
      case 'reels':
      case 'shop':
        return [this.widget(b)];
      case 'image':
        if (!b.attrs.Path) return [el('div.media-empty', { text: 'Banner or image: choose an uploaded PNG or a game texture in the settings on the right.' })];
        return this.snippet(b);
      default:
        return this.snippet(b);
    }
  }

  widget(b) {
    const names = { arcade: b.attrs.Game ? `Arcade cabinet: ${b.attrs.Game}` : 'Arcade: every game in tabs', sportsbook: 'Zero-g ball sportsbook', spacegpt: 'SpaceGPT, answered by ghosts', recipes: `Cookbook: ${b.attrs.Group || 'all'} food recipes`,
      search: 'Search box: every listed page the terminal reaches', tape: 'YouTape player: random tapes, a shelf and live broadcasts',
      tapelink: `Tape link: ${b.attrs.Number ? b.attrs.Number + ' ' : ''}${b.attrs.Title || '(no title)'}`, reels: 'YouTape Reels: short tall tapes, one after another',
      shop: `Shop: the ${b.attrs.Catalog || '(no catalogue)'} catalogue, bought with the card in the reader` };
    return el('div.tag-placeholder.widget', {}, el('strong', { text: names[b.type] }), el('div.tag-placeholder-note', { text: 'Drawn live by the game in play.' }));
  }

  headingEditor(b) {
    const cls = ['', 'h-bigger', 'h-heading', 'h-key'][b.level];
    const node = el(`div.page-heading.${cls}.inline-edit`, { text: b.text });
    node.contentEditable = 'plaintext-only';
    if (node.contentEditable !== 'plaintext-only') node.contentEditable = 'true';
    node.spellcheck = false;
    node.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        node.blur();
      }
    });
    node.addEventListener('input', () => this.app.editText(b.id, x => {
      x.text = node.textContent.replace(/\s*\n\s*/g, ' ');
    }));
    this.wireFocus(node, 'plain');
    return node;
  }

  /** A paragraph or list item typed in place. Text using tags the inline editor cannot keep is shown read only. */
  richEditor(b, key, node, index = null) {
    const value = index === null ? b[key] : b[key][index];
    const { html, editable } = markupToHtml(value);
    node.classList.add('rt', 'inline-edit');
    node.innerHTML = html;
    if (!editable) {
      const r = renderSnippet(index === null ? value : `- ${value}`, this.style, this.ctx());
      const shown = el('div.readonly-text', { title: 'Uses markup the inline editor cannot keep; edit it in the settings on the right.' }, ...r.nodes);
      return shown;
    }
    node.contentEditable = 'true';
    node.spellcheck = true;
    node.addEventListener('input', () => this.app.editText(b.id, x => {
      const text = htmlToMarkup(node);
      if (index === null) x[key] = text;
      else x[key][index] = text;
    }));
    node.addEventListener('keydown', e => this.richKeys(e, b, node, index));
    this.wireFocus(node, 'rich');
    return node;
  }

  richKeys(e, b, node, index) {
    if (e.key !== 'Enter' && e.key !== 'Backspace') return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === null) this.app.op({ op: 'insertAfter', id: b.id, type: 'paragraph', content: { text: '' }, focus: true });
      else this.app.op({ op: 'listInsert', id: b.id, index: index + 1 });
      return;
    }
    if (index !== null && node.textContent === '' && b.items.length > 1) {
      e.preventDefault();
      this.app.op({ op: 'listRemove', id: b.id, index });
    }
  }

  listEditor(b) {
    const box = el('div.list-edit');
    b.items.forEach((item, i) => {
      const line = el('div.page-text.list-line');
      box.append(el('div.page-list', {}, el('span.page-bullet', { text: '  › ' }), this.richEditor(b, 'items', line, i)));
    });
    return box;
  }

  wireFocus(node, kind) {
    node.addEventListener('focus', () => this.app.onEditorFocus(node, kind));
    node.addEventListener('blur', () => {
      this.app.onEditorBlur(node);
      setTimeout(() => {
        if (this.pendingRender && !this.editing()) this.render();
      }, 0);
    });
    // Links inside text are chips; clicking one selects the block instead of following it.
    node.addEventListener('click', e => {
      const chip = e.target.closest('.netlink-chip');
      if (chip) this.app.editChip(chip, node);
    });
  }

  boardBlock(style) {
    const selected = this.app.selected === '@board';
    const wrap = el(`div.blk.blk-board${selected ? '.selected' : ''}`, { dataset: { id: '@board' } },
      el('div.blk-bar', {}, el('span.blk-label', { text: 'Board postings (always last on the front page)' }),
        el('button.blk-btn.blk-del', { type: 'button', title: 'Remove the board', text: '✕', onclick: e => {
          e.stopPropagation();
          this.app.op({ op: 'removeBoard' });
        } })));
    wrap.addEventListener('mousedown', () => this.app.select('@board'));
    const preview = BrowserPreview.prototype.board.call({ getPackage: () => this.app.pkg, options: () => this.app.settings }, style);
    wrap.append(el('div.blk-body', {}, preview));
    return wrap;
  }

  /** Outlines blocks the checks flagged. */
  updateMarks() {
    const issues = this.app.blockIssues || new Map();
    for (const node of this.pageEl.querySelectorAll('.blk')) {
      const list = issues.get(node.dataset.id) || [];
      const level = list.some(i => i.level === 'error') ? 'error' : list.some(i => i.level === 'warning') ? 'warning' : null;
      node.classList.toggle('blk-has-error', level === 'error');
      node.classList.toggle('blk-has-warning', level === 'warning');
      let badge = node.querySelector(':scope > .blk-issue');
      if (level) {
        if (!badge) {
          badge = el('div.blk-issue');
          node.append(badge);
        }
        badge.textContent = list.map(i => i.message).join('\n');
      } else if (badge) {
        badge.remove();
      }
    }
  }

  // ------------------------------------------------------------ dropping

  wireDrops() {
    const indicator = el('div.drop-indicator');
    this.scroll.addEventListener('dragover', e => {
      if (!dragging) return;
      const spot = this.dropSpot(e);
      if (!spot) {
        indicator.remove();
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = dragging.kind === 'new' ? 'copy' : 'move';
      const r = this.scroll.getBoundingClientRect();
      const lr = spot.rect;
      if (spot.axis === 'y') {
        Object.assign(indicator.style, { left: `${lr.left - r.left + this.scroll.scrollLeft}px`, width: `${lr.width}px`, top: `${spot.at - r.top + this.scroll.scrollTop - 2}px`, height: '4px' });
      } else {
        Object.assign(indicator.style, { top: `${lr.top - r.top + this.scroll.scrollTop}px`, height: `${lr.height}px`, left: `${spot.at - r.left + this.scroll.scrollLeft - 2}px`, width: '4px' });
      }
      if (!indicator.isConnected) this.scroll.append(indicator);
      document.querySelectorAll('.drop-over').forEach(n => n.classList.remove('drop-over'));
      spot.list.classList.add('drop-over');
    });
    this.scroll.addEventListener('dragleave', e => {
      if (!this.scroll.contains(e.relatedTarget)) {
        indicator.remove();
        document.querySelectorAll('.drop-over').forEach(n => n.classList.remove('drop-over'));
      }
    });
    this.scroll.addEventListener('drop', e => {
      if (!dragging) return;
      const spot = this.dropSpot(e);
      e.preventDefault();
      const drag = dragging;
      endDrag();
      if (!spot) return;
      if (drag.kind === 'new') this.app.op({ op: 'add', type: drag.type, target: spot.target, index: spot.index });
      else this.app.op({ op: 'move', id: drag.id, target: spot.target, index: spot.index });
    });
  }

  /** Where a drop would land: the innermost list under the pointer and the index between its blocks. */
  dropSpot(e) {
    let list = e.target.closest ? e.target.closest('.drop-list') : null;
    if (!list || !this.pageEl.contains(list)) list = this.pageEl.querySelector('.drop-root');
    if (!list) return null;
    const target = JSON.parse(list.dataset.target);
    if (dragging.kind === 'move' && target.blockId) {
      const page = this.app.page();
      const moving = findBlock(page.blocks, dragging.id);
      if (moving && contains(moving.block, target.blockId)) return null;
    }
    if (dragging.kind === 'new' && BLOCK_TYPES[dragging.type] && BLOCK_TYPES[dragging.type].pseudo) {
      return { list, target: { blockId: null }, index: Infinity, axis: 'y', rect: list.getBoundingClientRect(), at: list.getBoundingClientRect().bottom };
    }
    const axis = list.dataset.axis;
    const items = [...list.children].filter(c => c.classList.contains('blk'));
    const rect = list.getBoundingClientRect();
    let index = null;
    let at = axis === 'y' ? rect.bottom : rect.right;
    for (const item of items) {
      const r = item.getBoundingClientRect();
      const mid = axis === 'y' ? r.top + r.height / 2 : r.left + r.width / 2;
      const pos = axis === 'y' ? e.clientY : e.clientX;
      if (pos < mid) {
        index = Number(item.dataset.index);
        at = axis === 'y' ? r.top : r.left;
        break;
      }
    }
    if (index === null) {
      index = Infinity;
      if (items.length) {
        const r = items[items.length - 1].getBoundingClientRect();
        at = axis === 'y' ? r.bottom : r.right;
      } else {
        at = axis === 'y' ? rect.top + 6 : rect.left + 6;
      }
    }
    return { list, target, index, axis, rect, at };
  }
}

function cssColour(value) {
  return hexColour(value) || value;
}

