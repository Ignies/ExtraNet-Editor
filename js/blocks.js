// The block model: a page as a list of blocks that map one to one onto the game's page markup.
// importPage() turns page XML into blocks (anything it does not understand becomes a raw markup block), and
// generatePage() writes them back. Blocks that were not touched are written back exactly as they were read,
// so importing and exporting an untouched page gives the same bytes.

import { parseDocument } from './markup.js';

let nextId = 1;
export function newId() {
  return `b${nextId++}`;
}

// ---------------------------------------------------------------- block types

/**
 * Every block type: palette group and label, the game tag it becomes, and its starting content.
 * Container types hold nested blocks (children, or columns of children).
 */
export const BLOCK_TYPES = {
  heading: { group: 'Text', label: 'Heading', icon: 'H', tag: '# / ## / ###', make: () => ({ level: 1, text: 'HEADING' }) },
  paragraph: { group: 'Text', label: 'Paragraph', icon: '\u00B6', tag: 'text', make: () => ({ text: 'Write something here. Use the toolbar for [bold]bold[/bold], [italic]italic[/italic] and links.' }) },
  list: { group: 'Text', label: 'Bullet list', icon: '\u2022', tag: '- items', make: () => ({ items: ['First point.', 'Second point.'] }) },
  linklist: { group: 'Text', label: 'Link list', icon: '\u21AA', tag: '- [netlink]', make: () => ({ items: [{ text: 'Home page', link: '@home', extra: '' }] }) },
  note: { group: 'Text', label: 'Note box', icon: '\u25A4', tag: 'ColorBox', preset: 'panel', make: () => panelPreset('note') },
  quote: { group: 'Text', label: 'Quote', icon: '\u201C', tag: 'ColorBox', preset: 'panel', make: () => panelPreset('quote') },
  divider: { group: 'Text', label: 'Divider', icon: '\u2015', tag: 'ColorBox (empty)', make: () => ({ attrs: { Color: '@link', OutlineColor: '@link', OutlineThickness: '1', Margin: '4' } }) },

  image: { group: 'Media', label: 'Banner / image', icon: '\u25A3', tag: 'CMUGuideImage', make: () => ({ attrs: { Path: '', MaxHeight: '150' } }) },
  sprite: { group: 'Media', label: 'Game sprite', icon: '\u2726', tag: 'CMUNetSprite', make: () => ({ attrs: { Rsi: '/Textures/_RMC14/Objects/Fun/plushies.rsi', State: 'bee', Scale: '2', Align: 'Center' } }) },
  wallpaper: { group: 'Media', label: 'Wallpaper offer', icon: '\u25A6', tag: 'CMUNetWallpaper', make: () => ({ attrs: { Id: 'CMUWallpaperSynthwave' } }) },

  blink: { group: 'Effects', label: 'Blink', icon: '\u2737', tag: 'CMUNetBlink', container: 'children', make: () => ({ attrs: { Rate: '0.6' }, children: [block('paragraph', { text: '[bold]BLINKING TEXT[/bold]' })] }) },
  marquee: { group: 'Effects', label: 'Marquee', icon: '\u21C6', tag: 'CMUNetMarquee', make: () => ({ attrs: { Text: 'LATEST  ///  Write your ticker here  ///  It scrolls right to left', Speed: '60' } }) },
  popup: { group: 'Effects', label: 'Pop up', icon: '\u2750', tag: 'CMUNetPopup', make: () => ({ attrs: { Title: 'NOTICE', Text: 'You have one new message.', X: '0.6', Y: '0.2', Delay: '1.5' } }) },

  ad: { group: 'Commerce', label: 'Product ad', icon: '$', tag: 'CMUNetAd', make: () => ({ attrs: { Id: 'CMUDeepAdMre' } }) },

  columns: { group: 'Layout', label: 'Columns', icon: '\u2016', tag: 'Box + Box', container: 'columns', make: () => columnsPreset(2) },
  box: { group: 'Layout', label: 'Row / centred box', icon: '\u2B1A', tag: 'Box', container: 'children', make: () => ({ attrs: {}, children: [] }) },
  panel: { group: 'Layout', label: 'Panel', icon: '\u25A2', tag: 'ColorBox + Box', container: 'children', make: () => panelPreset('panel') },

  board: { group: 'Live', label: 'Board postings', icon: '\u2709', tag: 'site.yml board:', pseudo: true },
  arcade: { group: 'Live', label: 'Arcade', icon: '\u265F', tag: 'CMUNetArcade', make: () => ({ attrs: {} }) },
  sportsbook: { group: 'Live', label: 'Sportsbook', icon: '\u26BD', tag: 'CMUNetSportsbook', make: () => ({ attrs: {} }) },
  spacegpt: { group: 'Live', label: 'SpaceGPT', icon: '?', tag: 'CMUNetSpaceGpt', make: () => ({ attrs: {} }) },
  search: { group: 'Live', label: 'Search box', icon: '\u2315', tag: 'CMUNetSearch', make: () => ({ attrs: {} }) },
  tape: { group: 'Live', label: 'Tape player', icon: '\u25B6', tag: 'CMUNetTape', make: () => ({ attrs: {} }) },
  recipes: { group: 'Live', label: 'Cookbook', icon: '\u2668', tag: 'CMUNetRecipes Kind="Food"', make: () => ({ attrs: { Kind: 'Food' } }) },

  raw: { group: 'Advanced', label: 'Raw markup', icon: '</>', tag: 'anything', make: () => ({ markup: '<Box>\n  Any markup the game understands.\n</Box>' }) },

  style: { hidden: true, tag: 'CMUNetStyle' },
};

export const PALETTE_GROUPS = ['Text', 'Media', 'Effects', 'Commerce', 'Layout', 'Live', 'Advanced'];

/** Tags each simple block type writes. */
const TAG_OF = {
  image: 'CMUGuideImage', sprite: 'CMUNetSprite', wallpaper: 'CMUNetWallpaper', marquee: 'CMUNetMarquee',
  popup: 'CMUNetPopup', ad: 'CMUNetAd', arcade: 'CMUNetArcade', sportsbook: 'CMUNetSportsbook',
  spacegpt: 'CMUNetSpaceGpt', recipes: 'CMUNetRecipes', search: 'CMUNetSearch', tape: 'CMUNetTape', style: 'CMUNetStyle',
  divider: 'ColorBox',
};
const TYPE_OF_TAG = Object.fromEntries(Object.entries(TAG_OF).filter(([t]) => t !== 'divider').map(([t, tag]) => [tag, t]));

export const ARCADE_GAMES = ['HuggerRun', 'TrackerReflex'];
export const RECIPE_GROUPS = ['', 'Savory', 'Soup', 'Breads', 'Cake', 'Dessert'];

export function block(type, content = {}) {
  const base = BLOCK_TYPES[type] && BLOCK_TYPES[type].make ? BLOCK_TYPES[type].make() : {};
  return { id: newId(), type, ...base, ...content };
}

function panelPreset(kind) {
  const attrs = { Color: '@panel', OutlineColor: '@link', OutlineThickness: '1', Margin: '4' };
  const inner = { Orientation: 'Vertical', HorizontalAlignment: 'Stretch', Margin: '6' };
  if (kind === 'note') return { type: 'panel', attrs, inner, children: [block('paragraph', { text: '[bold]Note.[/bold] Something readers should not miss.' })] };
  if (kind === 'quote') return { type: 'panel', attrs: { ...attrs, OutlineColor: '@heading' }, inner, children: [block('paragraph', { text: '[italic]A quote, a testimonial or a pull out line.[/italic]' })] };
  return { attrs, inner, children: [block('paragraph', { text: 'Panel text.' })] };
}

export function columnsPreset(count) {
  const columns = [];
  for (let i = 0; i < count; i++) {
    columns.push({ attrs: columnAttrs(), children: [block('paragraph', { text: `Column ${i + 1}.` })] });
  }
  return { attrs: { HorizontalAlignment: 'Stretch', VerticalAlignment: 'Top' }, columns };
}

export function columnAttrs() {
  return { Orientation: 'Vertical', HorizontalAlignment: 'Stretch', VerticalAlignment: 'Top', Margin: '4' };
}

/** Values like @link stand for the site's colours; they are resolved when markup is written. */
export function resolveAttr(value, colours) {
  if (typeof value !== 'string' || !value.startsWith('@')) return value;
  return colours[value.slice(1)] || '#888888';
}

// ---------------------------------------------------------------- import

function tightEnd(text, end) {
  let e = end;
  while (e > 0 && /\s/.test(text[e - 1])) e--;
  return e;
}

const LINK_ITEM = /^\[netlink="((?:[^"\\]|\\.)*)"(?:\s+link="((?:[^"\\]|\\.)*)")?\s*\]([\s\S]*)$/;

function unescapeParam(text) {
  return text.replace(/\\(["\\[\]/])/g, '$1');
}

/** Converts the controls of one container into blocks. */
function importControls(text, controls) {
  const out = [];
  let i = 0;
  while (i < controls.length) {
    const node = controls[i];
    if (node.kind === 'list') {
      // A run of list items is one block.
      let j = i;
      while (j + 1 < controls.length && controls[j + 1].kind === 'list') j++;
      const run = controls.slice(i, j + 1);
      const items = run.map(n => n.item.raw.trim());
      const links = items.map(item => LINK_ITEM.exec(item));
      const b = links.every(Boolean)
        ? block('linklist', { items: links.map(m => ({ text: unescapeParam(m[1]), link: m[2] === undefined ? unescapeParam(m[1]) : unescapeParam(m[2]), extra: m[3].replace(/\s+$/, ''), bare: m[2] === undefined })) })
        : block('list', { items });
      attachSource(b, text, run[0].start, run[run.length - 1].end, run[0].start);
      out.push(b);
      i = j + 1;
      continue;
    }
    out.push(importControl(text, node));
    i++;
  }
  // Remember the original spacing between neighbours, so untouched pages come back byte for byte.
  for (let k = 1; k < out.length; k++) {
    out[k].prevId = out[k - 1].id;
    out[k].gap = text.slice(out[k - 1].srcEnd, out[k].srcStart);
  }
  return out;
}

function attachSource(b, text, start, end) {
  const e = tightEnd(text, end);
  b.srcStart = start;
  b.srcEnd = e;
  b.src = text.slice(start, e);
}

function rawBlock(text, start, end) {
  const b = block('raw', { markup: text.slice(start, tightEnd(text, end)) });
  attachSource(b, text, start, end);
  return b;
}

function importControl(text, node) {
  let b;
  if (node.kind === 'heading') {
    b = block('heading', { level: node.level, text: node.text.trimEnd() });
  } else if (node.kind === 'text') {
    b = node.rich.error || node.rich.truncated >= 0 ? null : block('paragraph', { text: node.raw.trim() });
  } else if (node.kind === 'tag') {
    b = importTag(text, node);
  }
  if (!b) return rawBlock(text, node.start, node.end);
  attachSource(b, text, node.start, node.end);
  return b;
}

const isVerticalBox = n => n.kind === 'tag' && n.name === 'Box' && n.args.Orientation === 'Vertical';

function importTag(text, node) {
  const attrs = { ...node.args };
  const type = TYPE_OF_TAG[node.name];
  if (type && node.children.length === 0) {
    if (type === 'recipes' && attrs.Kind !== 'Food') return null;
    return block(type, { attrs });
  }
  if (node.name === 'CMUNetBlink') return block('blink', { attrs, children: importControls(text, node.children) });
  if (node.name === 'Box') {
    const cols = node.children;
    if (attrs.Orientation !== 'Vertical' && attrs.HorizontalAlignment === 'Stretch' && cols.length >= 2 && cols.length <= 3 && cols.every(isVerticalBox)) {
      return block('columns', {
        attrs,
        columns: cols.map(c => {
          const column = { attrs: { ...c.args }, children: importControls(text, c.children) };
          column.srcStart = c.start;
          return column;
        }),
      });
    }
    return block('box', { attrs, children: importControls(text, node.children) });
  }
  if (node.name === 'ColorBox') {
    if (node.children.length === 0) return block('divider', { attrs });
    if (node.children.length === 1 && isVerticalBox(node.children[0])) {
      return block('panel', { attrs, inner: { ...node.children[0].args }, children: importControls(text, node.children[0].children) });
    }
  }
  return null;
}

/**
 * A page as blocks: { head, tail, blocks, error }. With a <Document> root, head is everything before its first
 * block and tail everything after its last. A page that does not parse is one raw block.
 */
export function importPage(text) {
  const parsed = parseDocument(text);
  if (parsed.error) {
    const b = block('raw', { markup: text });
    b.src = text;
    return finish({ head: '', tail: '', blocks: [b], error: parsed.error });
  }
  const top = parsed.controls;
  if (top.length === 1 && top[0].kind === 'tag' && top[0].name === 'Document') {
    const doc = top[0];
    const blocks = importControls(text, doc.children);
    if (!blocks.length) return finish({ head: text.slice(0, doc.contentStart), tail: text.slice(doc.contentStart), blocks, error: null, emptyDoc: true });
    return finish({ head: text.slice(0, blocks[0].srcStart), tail: text.slice(blocks[blocks.length - 1].srcEnd), blocks, error: null });
  }
  const blocks = importControls(text, top);
  if (!blocks.length) return finish({ head: text, tail: '', blocks, error: null });
  return finish({ head: text.slice(0, blocks[0].srcStart), tail: text.slice(blocks[blocks.length - 1].srcEnd), blocks, error: null });
}

function finish(page) {
  walkBlocks(page.blocks, b => {
    b.sig = signature(b);
  });
  return page;
}

// ---------------------------------------------------------------- traversal

/** Calls fn(block, list, index, parent) for every block, depth first. */
export function walkBlocks(list, fn, parent = null) {
  list.forEach((b, i) => {
    fn(b, list, i, parent);
    if (b.children) walkBlocks(b.children, fn, b);
    if (b.columns) b.columns.forEach(c => walkBlocks(c.children, fn, b));
  });
}

export function findBlock(blocks, id) {
  let found = null;
  walkBlocks(blocks, (b, list, index, parent) => {
    if (b.id === id) found = { block: b, list, index, parent };
  });
  return found;
}

/** The list a drop target names: { blockId: null } is the page, { blockId, column } a column, else children. */
export function targetList(blocks, target) {
  if (!target.blockId) return blocks;
  const found = findBlock(blocks, target.blockId);
  if (!found) return null;
  if (found.block.columns) return found.block.columns[target.column || 0].children;
  return found.block.children || null;
}

export function contains(b, id) {
  let hit = false;
  walkBlocks([b], x => {
    if (x.id === id) hit = true;
  });
  return hit;
}

/** A deep copy with fresh ids and no source (it is new content). */
export function cloneBlock(b) {
  const copy = JSON.parse(JSON.stringify(b, (k, v) => (['src', 'sig', 'gap', 'prevId', 'srcStart', 'srcEnd'].includes(k) ? undefined : v)));
  walkBlocks([copy], x => {
    x.id = newId();
  });
  return copy;
}

const SKIP = new Set(['id', 'src', 'sig', 'gap', 'prevId', 'srcStart', 'srcEnd']);

/** What a block says, without ids or source positions: equal signatures write equal markup. */
export function signature(b) {
  return JSON.stringify(b, (k, v) => (SKIP.has(k) ? undefined : v));
}

// ---------------------------------------------------------------- generate

function escapeAttr(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function openTag(name, attrs, colours, selfClose) {
  const parts = Object.entries(attrs || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}="${escapeAttr(resolveAttr(v, colours))}"`);
  return `<${name}${parts.length ? ' ' + parts.join(' ') : ''}${selfClose ? '/>' : '>'}`;
}

/** Text as a paragraph line: one line, "<" escaped, and a leading - or # kept from becoming a list or heading. */
export function paragraphLine(text) {
  let line = String(text).replace(/\s*\n\s*/g, ' ').trim().replace(/</g, '\\<');
  if (line.startsWith('-')) line = '\\' + line;
  if (line.startsWith('#')) line = '[italic][/italic]' + line;
  return line;
}

const TEXT_ENDING = new Set(['paragraph', 'list', 'linklist']);

function endsWithText(b) {
  if (TEXT_ENDING.has(b.type)) return true;
  if (b.type === 'raw') return !/>\s*$/.test(b.markup);
  return false;
}

/** The whitespace between two neighbours: a blank line wherever text would otherwise run into the next block. */
function computedGap(prev, cur, indent) {
  const blank = endsWithText(prev) || (cur.type === 'heading' && cur.level <= 2 && prev.type !== 'heading');
  return (blank ? '\n\n' : '\n') + indent;
}

class Writer {
  constructor(colours) {
    this.colours = colours;
    this.out = '';
    this.positions = new Map();
  }

  write(text) {
    this.out += text;
  }

  /** Writes a list of blocks; the caller has already written the indentation of the first line. */
  list(blocks, indent) {
    blocks.forEach((b, i) => {
      if (i > 0) {
        const prev = blocks[i - 1];
        this.write(b.prevId === prev.id && b.gap !== undefined ? b.gap : computedGap(prev, b, indent));
      }
      this.block(b, indent);
    });
  }

  block(b, indent) {
    const start = this.out.length;
    if (b.src !== undefined && b.sig === signature(b)) {
      this.write(b.src);
      this.mapSource(b, start);
      return;
    }
    const inner = indent + '  ';
    const c = this.colours;
    switch (b.type) {
      case 'heading':
        this.write(`${'#'.repeat(b.level)} ${String(b.text).replace(/\s*\n\s*/g, ' ').trim() || 'HEADING'}`);
        break;
      case 'paragraph':
        this.write(paragraphLine(b.text) || '...');
        break;
      case 'list':
        this.write(b.items.map(item => `- ${paragraphLine(item).replace(/^\\-/, '-') || '...'}`).join(`\n${indent}`));
        break;
      case 'linklist':
        this.write(b.items.map(item => {
          const link = resolveLink(item.link, c);
          const tag = item.bare && link === item.text ? `[netlink="${escapeAttr(item.text)}"]` : `[netlink="${escapeAttr(item.text)}" link="${escapeAttr(link)}"]`;
          return `- ${tag}${item.extra ? item.extra : ''}`;
        }).join(`\n${indent}`));
        break;
      case 'raw':
        this.write(reindent(b.markup, indent));
        break;
      case 'blink':
        this.container('CMUNetBlink', b.attrs, b.children, indent);
        break;
      case 'box':
        this.container('Box', b.attrs, b.children, indent);
        break;
      case 'panel': {
        this.write(openTag('ColorBox', b.attrs, c, false) + `\n${inner}`);
        this.container('Box', b.inner, b.children, inner);
        this.write(`\n${indent}</ColorBox>`);
        break;
      }
      case 'columns': {
        this.write(openTag('Box', b.attrs, c, false));
        for (const column of b.columns) {
          this.write(`\n${inner}`);
          this.container('Box', column.attrs, column.children, inner);
        }
        this.write(`\n${indent}</Box>`);
        break;
      }
      default: {
        const tag = TAG_OF[b.type];
        if (tag) this.write(openTag(tag, b.attrs, c, true));
      }
    }
    this.positions.set(b.id, [start, this.out.length]);
  }

  container(name, attrs, children, indent) {
    this.write(openTag(name, attrs, this.colours, false));
    if (children.length) {
      this.write(`\n${indent}  `);
      this.list(children, indent + '  ');
    }
    this.write(`\n${indent}</${name}>`);
  }

  /** Positions of a block written from its source, and of the blocks inside it. */
  mapSource(b, start) {
    const origin = b.srcStart;
    walkBlocks([b], x => {
      if (x.srcStart === undefined || origin === undefined) return;
      this.positions.set(x.id, [start + x.srcStart - origin, start + (x.srcEnd ?? x.srcStart) - origin]);
    });
    if (!this.positions.has(b.id)) this.positions.set(b.id, [start, this.out.length]);
  }
}

function resolveLink(link, colours) {
  if (link === '@home') return colours.address || '';
  if (typeof link === 'string' && link.startsWith('@page:')) {
    const path = link.slice(6);
    return path ? `${colours.address}/${path}` : colours.address;
  }
  return link;
}

/** Re-indents lines after the first of edited raw markup to the block's depth. */
function reindent(markup, indent) {
  const lines = String(markup).replace(/\r\n?/g, '\n').replace(/\s+$/, '').split('\n');
  if (lines.length === 1) return lines[0].trim();
  const rest = lines.slice(1).filter(l => l.trim());
  // Lines after the first keep their shape relative to the least indented of them (the closing tag).
  const common = rest.length ? Math.min(...rest.map(l => /^ */.exec(l)[0].length)) : 0;
  return [lines[0].trim(), ...lines.slice(1).map(l => (l.trim() ? indent + l.slice(common) : ''))].join('\n');
}

/**
 * Writes a page. colours: { link, heading, text, background, panel, address } for @values.
 * Returns { text, positions: Map(blockId -> [start, end]) }.
 */
export function generatePage(page, colours) {
  const w = new Writer(colours);
  let head = page.head;
  let tail = page.tail;
  if (page.emptyDoc && page.blocks.length) {
    head = head.replace(/\s*$/, '\n  ');
    tail = '\n' + tail.replace(/^\s*/, '');
  }
  const indent = /(^|\n)([ \t]*)$/.exec(head)[2] || '';
  w.write(head);
  w.list(page.blocks, indent);
  w.write(tail);
  return { text: w.out, positions: w.positions };
}

/** A new page: an empty document. */
export function emptyPage() {
  return { head: '<Document>\n  ', tail: '\n</Document>\n', blocks: [], error: null };
}

/** The text a block writes on its own (for previews). */
export function blockMarkup(b, colours) {
  const w = new Writer(colours);
  w.block(b, '');
  return w.out;
}
