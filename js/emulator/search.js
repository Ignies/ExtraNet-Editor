// Yotta!'s search box (<CMUNetSearch/>), ported from CMUNetSearch and CMUNetSearchIndex in
// Content.CMU/Client/PersonalComputers/CMUNetSearch.cs. It searches the words of every listed page the terminal
// reaches, titles and addresses first, and lists what it finds as links with a line of each page. Deep, hidden and
// unlisted sites are never found. In game the index is the page files the client ships; here it is every site the
// emulator's ExtraNet knows (the library, and the site open in the editor), read the same way.
// Optional colours: Text, Link, Background, Muted.

import { el } from '../util.js';
import { hexColour } from '../markup.js';
import { netLink } from '../render.js';
import { fontStack, ensureFont, px } from '../fonts.js';
import { text as localText } from '../library.js';
import { DEEP } from './net.js';

const MAX_RESULTS = 10;
const SNIPPET_BEFORE = 40;
const SNIPPET_LENGTH = 110;
const MARKUP = /<[^>]*>|\[[^\]]*\]/g;
const SPACE = /\s+/g;
const SEPARATORS = /[ \t,./!?]+/;

/** The English strings, for a repository whose locale does not have them yet. */
const FALLBACK = {
  'cmu-net-search-placeholder': 'Type words and press enter',
  'cmu-net-search-button': 'SEARCH',
  'cmu-net-search-none': 'Yotta! found nothing for "{ $query }". Try fewer words, or the directory.',
  'cmu-net-search-count': 'Yotta! found { $count -> [one] one page *[other] { $count } pages } for "{ $query }":',
};

const STYLE_ID = 'emu-search-style';
const STYLE = `
.emu-search { display: flex; flex-direction: column; gap: 4px; margin: 4px 0; min-width: 0; }
.emu-search-row { display: flex; flex-direction: row; gap: 4px; align-items: center; min-width: 0; }
.emu-search-input { flex: 1 1 auto; min-width: 0; box-sizing: border-box; border: 1px solid; padding: 3px 5px; outline: none; }
.emu-search-input::placeholder { color: var(--ph); }
.emu-search-go { background: none; border: 0; padding: 0; cursor: pointer; flex: none; }
.emu-search-results { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.emu-search-entry { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; }
.emu-search-line { white-space: pre; overflow: hidden; align-self: stretch; min-width: 0; }
`;

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  document.head.append(el('style', { id: STYLE_ID, text: STYLE }));
}

/** Color.TryFromHex, else the default. */
function colour(args, key, fallback) {
  return hexColour(args[key]) ? args[key] : fallback;
}

/** A locale string, with { $var } and a { $var -> [one] ... *[other] ... } select filled as Fluent does. */
function format(strings, id, vars) {
  const template = strings[id] ?? FALLBACK[id] ?? id;
  let out = '';
  for (let i = 0; i < template.length;) {
    const select = /^\{\s*\$(\w+)\s*->/.exec(template.slice(i));
    if (!select) {
      out += template[i++];
      continue;
    }
    // the select runs to its own closing brace, past the placeables in its variants
    let depth = 0;
    let end = i;
    for (; end < template.length; end++) {
      if (template[end] === '{') depth++;
      else if (template[end] === '}' && --depth === 0) break;
    }
    const body = template.slice(i + select[0].length, end);
    const variants = [];
    const re = /(\*?)\[([^\]]+)\]\s*((?:[^[{*]|\{[^}]*\})*)/g;
    let m;
    while ((m = re.exec(body))) variants.push({ star: !!m[1], key: m[2].trim(), text: m[3].trim() });
    const value = vars[select[1]];
    const category = Number(value) === 1 ? 'one' : 'other';
    const pick = variants.find(v => v.key === String(value)) || variants.find(v => v.key === category)
      || variants.find(v => v.star) || variants[0];
    out += pick ? pick.text : '';
    i = end + 1;
  }
  return out.replace(/\{\s*\$(\w+)\s*\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

/** CMUNetSearchIndex.Terms: the query's words, lower case, each once. */
export function terms(query) {
  return [...new Set(query.toLowerCase().split(SEPARATORS).filter(Boolean))];
}

/** CMUNetSearchIndex.Clean: page text without tags, markup or heading marks, on one line. */
export function clean(page) {
  const textValue = page.replace(MARKUP, ' ').split('#').join(' ').split('{colony}').join('the colony');
  return textValue.replace(SPACE, ' ').trim();
}

/** Each page's clean text, read once per page file (the game reads them once per client). */
const texts = new Map();

function pageWords(net, entry, file) {
  // the user's own site is read fresh each time, so edits are found
  const key = `${entry.key}|${file}`;
  if (entry.kind !== 'user' && texts.has(key)) return texts.get(key);
  const promise = net.rawText(entry, file).then(raw => clean(raw ?? '')).catch(() => '');
  if (entry.kind !== 'user') texts.set(key, promise);
  return promise;
}

/**
 * The index: every page of every listed, non-deep, non-hidden site, with its title and address
 * (CMUNetSearchIndex's constructor). The emulator's networks are checked when searching, as in game.
 */
async function buildIndex(net, strings) {
  const out = [];
  for (const entry of net.sites()) {
    const site = entry.site;
    if (entry.unlisted || entry.hidden || entry.networks.includes(DEEP)) continue;
    const siteTitle = net.title(entry);
    for (const page of site.pages || []) {
      const file = (page.file || '').replace(/^\.\//, '');
      const path = (page.path || '').replace(/^\/+|\/+$/g, '');
      const tab = (site.tabs || []).find(t => (t.path || '').replace(/^\/+|\/+$/g, '').toLowerCase() === path.toLowerCase());
      const title = path.length === 0 || !tab ? siteTitle : `${siteTitle}: ${localText(strings, tab.title)}`;
      const address = path.length === 0 ? site.address : `${site.address}/${path}`;
      out.push({ entry, title, address, words: pageWords(net, entry, file) });
    }
  }
  for (const item of out) {
    item.text = await item.words;
    item.lower = item.text.toLowerCase();
  }
  return out;
}

function count(textValue, term) {
  let n = 0;
  for (let at = textValue.indexOf(term); at >= 0; at = textValue.indexOf(term, at + term.length)) n++;
  return n;
}

/** About a line of the page round the first place the term appears. */
function snippet(item, term) {
  let at = item.lower.indexOf(term);
  if (at < 0) at = 0;
  const start = Math.max(0, at - SNIPPET_BEFORE);
  const end = Math.min(item.text.length, start + SNIPPET_LENGTH);
  return (start > 0 ? '...' : '') + item.text.slice(start, end) + (end < item.text.length ? '...' : '');
}

/** CMUNetSearchIndex.Find: pages with every term, best first; a term in the title or address counts most. */
export function find(index, words, reaches) {
  const hits = [];
  for (const item of index) {
    if (reaches && !reaches(item.entry)) continue;
    const title = item.title.toLowerCase();
    const address = item.address.toLowerCase();
    let score = 0;
    let all = true;
    for (const term of words) {
      const inText = count(item.lower, term);
      const inTitle = title.includes(term);
      const inAddress = address.includes(term);
      if (inText === 0 && !inTitle && !inAddress) {
        all = false;
        break;
      }
      score += Math.min(inText, 10) + (inTitle ? 20 : 0) + (inAddress ? 10 : 0);
    }
    if (all) hits.push({ title: item.title, address: item.address, snippet: snippet(item, words[0]), score });
  }
  return hits.sort((a, b) => b.score - a.score || (a.address < b.address ? -1 : a.address > b.address ? 1 : 0));
}

/**
 * The tag. args: its attributes. style: the page style. ctx: { net, strings, deeps, navigate(address) }.
 */
export function createSearch(args = {}, style = {}, ctx = {}) {
  injectStyle();
  const strings = ctx.strings || {};
  const textColour = colour(args, 'Text', '#1A1030');
  const link = colour(args, 'Link', '#0033CC');
  const background = colour(args, 'Background', '#F4F0FF');
  const muted = colour(args, 'Muted', '#7A6A90');
  const pageText = style.text || '#FFFFFF';
  const pageLink = style.link || pageText;

  ensureFont('Mono');
  const query = el('input.emu-search-input', { type: 'text', spellcheck: false, placeholder: format(strings, 'cmu-net-search-placeholder', {}) });
  // page fields: the Mono font in the page's text colour, boxed in its background with a link coloured edge
  Object.assign(query.style, {
    font: `${px(12)} ${fontStack('Mono')}`,
    color: pageText,
    background: style.background || 'transparent',
    borderColor: `color-mix(in srgb, ${pageLink} 60%, transparent)`,
    caretColor: pageLink,
  });
  query.style.setProperty('--ph', `color-mix(in srgb, ${pageText} 45%, transparent)`);
  // a page button has no face of its own: just its label in the page's text
  const go = el('button.emu-search-go', { type: 'button', text: format(strings, 'cmu-net-search-button', {}) });
  Object.assign(go.style, { font: 'inherit', color: pageText });
  const results = el('div.emu-search-results');
  const root = el('div.emu-search', {}, el('div.emu-search-row', {}, query, go), results);

  const line = (value, colourValue) => {
    const node = el('div.emu-search-line', { text: value });
    node.style.color = colourValue;
    return node;
  };

  let serial = 0;
  const search = async () => {
    const run = ++serial;
    results.replaceChildren();
    const words = terms(query.value);
    if (!words.length || !ctx.net) return;
    const index = await buildIndex(ctx.net, strings);
    if (run !== serial) return;
    const found = find(index, words, entry => ctx.net.reaches(entry, !!ctx.deeps)).slice(0, MAX_RESULTS);
    const shown = query.value.trim();
    results.append(line(found.length === 0
      ? format(strings, 'cmu-net-search-none', { query: shown })
      : format(strings, 'cmu-net-search-count', { count: found.length, query: shown }), muted));
    for (const hit of found) {
      const entry = el('div.emu-search-entry', {}, netLink(hit.title, hit.address, link, background, address => ctx.navigate && ctx.navigate(address)));
      entry.append(line(hit.address, muted));
      if (hit.snippet.length > 0) entry.append(line(hit.snippet, textColour));
      results.append(entry);
    }
  };
  query.addEventListener('keydown', e => {
    if (e.key === 'Enter') search();
  });
  go.addEventListener('click', search);
  root.run = value => {
    query.value = value;
    return search();
  };
  return root;
}
