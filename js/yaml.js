// A small YAML reader and the site.yml writer.
// The reader covers what prototype files use: block maps and lists (lists may sit at their key's indent),
// quoted and plain scalars, flow lists and maps, and comments. It is not a general YAML parser.

export class YamlError extends Error {
  constructor(message, line) {
    super(line ? `site.yml line ${line}: ${message}` : message);
    this.line = line;
  }
}

/** Removes a trailing comment that is not inside quotes. */
function stripComment(text) {
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\' && quote === '"') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '#' && (i === 0 || /\s/.test(text[i - 1]))) {
      return text.slice(0, i).trimEnd();
    }
  }
  return text.trimEnd();
}

function tokenize(source) {
  const lines = [];
  source.replace(/\r\n?/g, '\n').split('\n').forEach((raw, index) => {
    if (raw.includes('\t') && /^\s*\t/.test(raw)) throw new YamlError('tabs are not allowed for indentation', index + 1);
    const content = stripComment(raw);
    if (content.trim() === '' || content.trim() === '---') return;
    const indent = content.length - content.trimStart().length;
    lines.push({ indent, text: content.trim(), line: index + 1 });
  });
  return lines;
}

/** Finds the ": " (or ":" at the end) that separates a key from its value, outside quotes and brackets. */
function findColon(text) {
  let quote = null;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\' && quote === '"') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') depth--;
    else if (c === ':' && depth === 0 && (i === text.length - 1 || text[i + 1] === ' ')) return i;
  }
  return -1;
}

function isSequenceItem(text) {
  return text === '-' || text.startsWith('- ');
}

class FlowParser {
  constructor(text, line) {
    this.s = text;
    this.i = 0;
    this.line = line;
  }

  ws() {
    while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++;
  }

  value() {
    this.ws();
    const c = this.s[this.i];
    if (c === '[') return this.list();
    if (c === '{') return this.map();
    if (c === '"' || c === "'") return this.quoted();
    const start = this.i;
    while (this.i < this.s.length && !',]}'.includes(this.s[this.i])) {
      if (this.s[this.i] === ':' && /[\s,\]}]/.test(this.s[this.i + 1] ?? ' ')) break;
      this.i++;
    }
    return plainScalar(this.s.slice(start, this.i).trim());
  }

  quoted() {
    const quote = this.s[this.i];
    const start = this.i;
    this.i++;
    while (this.i < this.s.length) {
      if (quote === '"' && this.s[this.i] === '\\') {
        this.i += 2;
        continue;
      }
      if (this.s[this.i] === quote) {
        if (quote === "'" && this.s[this.i + 1] === "'") {
          this.i += 2;
          continue;
        }
        this.i++;
        return unquote(this.s.slice(start, this.i), this.line);
      }
      this.i++;
    }
    throw new YamlError('unterminated quoted string', this.line);
  }

  list() {
    this.i++;
    const out = [];
    for (;;) {
      this.ws();
      if (this.s[this.i] === ']') {
        this.i++;
        return out;
      }
      out.push(this.value());
      this.ws();
      if (this.s[this.i] === ',') this.i++;
      else if (this.s[this.i] !== ']') throw new YamlError('expected , or ] in a flow list', this.line);
    }
  }

  map() {
    this.i++;
    const out = {};
    for (;;) {
      this.ws();
      if (this.s[this.i] === '}') {
        this.i++;
        return out;
      }
      const key = this.value();
      this.ws();
      if (this.s[this.i] !== ':') throw new YamlError('expected : in a flow map', this.line);
      this.i++;
      out[String(key)] = this.value();
      this.ws();
      if (this.s[this.i] === ',') this.i++;
      else if (this.s[this.i] !== '}') throw new YamlError('expected , or } in a flow map', this.line);
    }
  }
}

function unquote(text, line) {
  if (text.startsWith("'")) return text.slice(1, -1).replace(/''/g, "'");
  try {
    return JSON.parse(text.replace(/\\([0abtnvfre /\\N_LP])/g, (m, c) => {
      const map = { '0': '\\u0000', a: '\\u0007', v: '\\u000b', e: '\\u001b', ' ': ' ', '/': '/', N: '\\u0085', _: '\\u00a0', L: '\\u2028', P: '\\u2029' };
      return map[c] ?? m;
    }));
  } catch {
    throw new YamlError(`bad quoted string ${text}`, line);
  }
}

function plainScalar(text) {
  if (text === '' || text === '~' || text === 'null' || text === 'Null' || text === 'NULL') return null;
  if (/^(true|True|TRUE)$/.test(text)) return true;
  if (/^(false|False|FALSE)$/.test(text)) return false;
  return text;
}

function scalar(text, line) {
  if (text.startsWith('"') || text.startsWith("'")) {
    const parser = new FlowParser(text, line);
    const value = parser.quoted();
    if (parser.i !== text.length) throw new YamlError(`unexpected text after ${text.slice(0, parser.i)}`, line);
    return value;
  }
  if (text.startsWith('[') || text.startsWith('{')) {
    const parser = new FlowParser(text, line);
    return parser.value();
  }
  if (text === '|' || text === '>' || /^[|>][-+]?$/.test(text)) throw new YamlError('block scalars (| and >) are not supported', line);
  return plainScalar(text);
}

class BlockParser {
  constructor(lines) {
    this.lines = lines;
    this.i = 0;
  }

  peek() {
    return this.lines[this.i];
  }

  block(indent) {
    const first = this.peek();
    if (!first || first.indent < indent) return null;
    return isSequenceItem(first.text) ? this.sequence(first.indent) : this.mapping(first.indent);
  }

  sequence(indent) {
    const out = [];
    while (this.peek() && this.peek().indent === indent && isSequenceItem(this.peek().text)) {
      const item = this.peek();
      const rest = item.text === '-' ? '' : item.text.slice(2).trim();
      if (rest === '') {
        this.i++;
        const next = this.peek();
        out.push(next && next.indent > indent ? this.block(next.indent) : null);
        continue;
      }
      if (!rest.startsWith('[') && !rest.startsWith('{') && findColon(rest) > 0 && !isWholeQuoted(rest)) {
        // "- key: value" starts a map whose keys sit two columns in.
        const inner = item.indent + (item.text.length - rest.length);
        this.lines[this.i] = { indent: inner, text: rest, line: item.line };
        out.push(this.mapping(inner));
        continue;
      }
      this.i++;
      out.push(scalar(rest, item.line));
    }
    return out;
  }

  mapping(indent) {
    const out = {};
    while (this.peek() && this.peek().indent === indent && !isSequenceItem(this.peek().text)) {
      const entry = this.peek();
      const colon = findColon(entry.text);
      if (colon < 0) throw new YamlError(`expected "key: value", found "${entry.text}"`, entry.line);
      let key = entry.text.slice(0, colon).trim();
      if (key.startsWith('"') || key.startsWith("'")) key = unquote(key, entry.line);
      const rest = entry.text.slice(colon + 1).trim();
      this.i++;
      if (Object.prototype.hasOwnProperty.call(out, key)) throw new YamlError(`duplicate key ${key}`, entry.line);
      if (rest !== '') {
        out[key] = scalar(rest, entry.line);
        continue;
      }
      const next = this.peek();
      if (next && next.indent > indent) out[key] = this.block(next.indent);
      else if (next && next.indent === indent && isSequenceItem(next.text)) out[key] = this.sequence(indent);
      else out[key] = null;
    }
    const stray = this.peek();
    if (stray && stray.indent > indent) throw new YamlError(`unexpected indentation at "${stray.text}"`, stray.line);
    return out;
  }
}

function isWholeQuoted(text) {
  try {
    const parser = new FlowParser(text, 0);
    parser.quoted();
    return parser.i === text.length;
  } catch {
    return false;
  }
}

/** Parses a YAML document into plain objects. Returns { value, header } where header holds the leading comment lines. */
export function parseYaml(source) {
  const header = [];
  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    if (raw.trim().startsWith('#')) header.push(raw.trimEnd());
    else if (raw.trim() === '') continue;
    else break;
  }
  const lines = tokenize(source);
  const parser = new BlockParser(lines);
  const value = lines.length ? parser.block(lines[0].indent) : null;
  if (parser.peek()) throw new YamlError(`unexpected "${parser.peek().text}"`, parser.peek().line);
  return { value, header };
}

// ---------------------------------------------------------------- writing

const RESERVED = /^(true|false|yes|no|on|off|null|~|y|n)$/i;

/** A scalar as the game's files write it: plain when safe, otherwise double quoted. */
export function yamlString(value) {
  const text = String(value);
  if (text === '') return '""';
  const needsQuotes = RESERVED.test(text)
    || /^[-+]?(\d|\.\d)/.test(text) && /^[-+]?[\d._]+([eE][-+]?\d+)?$/.test(text)
    || /^[\s]|[\s]$/.test(text)
    || /^[-?:,[\]{}#&*!|>'"%@`]/.test(text) && !/^-[^\s-]/.test(text)
    || /: |:$| #|[\n\t\\"]/.test(text)
    || /^\.(inf|nan)$/i.test(text);
  return needsQuotes ? JSON.stringify(text) : text;
}

function quoted(value) {
  return JSON.stringify(String(value));
}

function isColour(key) {
  return ['background', 'text', 'heading', 'link'].includes(key);
}

/** Writes any leftover value (fields the editor does not know) in block style. */
function writeGeneric(value, indent, out) {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const keys = Object.keys(item);
        keys.forEach((key, index) => {
          const prefix = index === 0 ? `${pad}- ` : `${pad}  `;
          writeEntry(key, item[key], prefix, indent + 2, out);
        });
        if (keys.length === 0) out.push(`${pad}- {}`);
      } else {
        out.push(`${pad}- ${scalarOut(item)}`);
      }
    }
    return;
  }
  for (const [key, child] of Object.entries(value)) writeEntry(key, child, pad, indent, out);
}

function writeEntry(key, value, prefix, indent, out) {
  if (value && typeof value === 'object') {
    if (Array.isArray(value) && value.length === 0) {
      out.push(`${prefix}${yamlString(key)}: []`);
      return;
    }
    out.push(`${prefix}${yamlString(key)}:`);
    writeGeneric(value, Array.isArray(value) ? indent : indent + 2, out);
    return;
  }
  out.push(`${prefix}${yamlString(key)}: ${scalarOut(value)}`);
}

function scalarOut(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  return yamlString(value);
}

export const DEFAULT_HEADER = [
  '# A site package: this folder is the whole site. Drop it in /ServerInfo/CMU14/ExtraNet/Packages/ and the',
  '# game picks it up. Made with the ExtraNet editor (Content.CMU/Tools/ExtraNetEditor).',
];

/**
 * Writes a site package's site.yml in the same layout as the game's own files
 * (see Packages/LostAndFound/site.yml).
 */
export function writeSiteYaml(site) {
  const out = [];
  const header = site.header && site.header.length ? site.header : DEFAULT_HEADER;
  out.push(...header);
  out.push('- type: cmuNetSite');
  out.push(`  id: ${yamlString(site.id)}`);
  if (site.aliasSuffix && site.networks.includes('CMUNetDeep') && site.aliasSuffix !== '.deep') out.push(`  aliasSuffix: ${yamlString(site.aliasSuffix)}`);
  out.push(`  address: ${yamlString(site.address)}`);
  out.push(`  title: ${yamlString(site.title)}`);
  if (site.unlisted) out.push('  unlisted: true');
  if (site.hidden) out.push('  hidden: true');
  out.push('  networks:');
  for (const network of site.networks) out.push(`  - ${yamlString(network)}`);
  if (site.root) out.push(`  root: ${yamlString(site.root)}`);

  const style = site.style || {};
  const styleKeys = ['background', 'text', 'heading', 'link', 'font', 'backgroundImage', 'backgroundMode'].filter(k => style[k]);
  if (styleKeys.length) {
    out.push('  style:');
    for (const key of styleKeys) out.push(`    ${key}: ${isColour(key) ? quoted(style[key]) : yamlString(style[key])}`);
  }

  out.push('  pages:');
  for (const page of site.pages) out.push(`    ${page.path === '' ? '""' : yamlString(page.path)}: ${yamlString(page.file)}`);

  if (site.tabs.length) {
    out.push('  tabs:');
    for (const tab of site.tabs) {
      out.push(`  - title: ${yamlString(tab.title)}`);
      if (tab.path) out.push(`    path: ${yamlString(tab.path)}`);
    }
  }

  if (site.board) {
    const board = site.board;
    out.push('  board:');
    out.push(`    postLabel: ${yamlString(board.postLabel)}`);
    out.push(`    empty: ${yamlString(board.empty)}`);
    if (board.posters.length) {
      out.push('    posters:');
      for (const job of board.posters) out.push(`    - ${yamlString(job)}`);
    }
    if (board.posterWhitelist) {
      out.push('    posterWhitelist:');
      writeGeneric(board.posterWhitelist, 6, out);
    }
    for (const flag of ['anyonePosts', 'showTerminals', 'bounties', 'leaks', 'hijackable']) {
      if (board[flag]) out.push(`    ${flag}: true`);
    }
    if (board.extra) {
      for (const [key, value] of Object.entries(board.extra)) writeEntry(key, value, '    ', 4, out);
    }
  }

  if (site.extra) {
    for (const [key, value] of Object.entries(site.extra)) writeEntry(key, value, '  ', 2, out);
  }

  return out.join('\n') + '\n';
}

const SITE_KEYS = ['type', 'id', 'address', 'title', 'networks', 'unlisted', 'hidden', 'aliasSuffix', 'root', 'style', 'pages', 'tabs', 'board'];
const BOARD_KEYS = ['postLabel', 'empty', 'posters', 'posterWhitelist', 'anyonePosts', 'showTerminals', 'bounties', 'leaks', 'hijackable'];

function str(value) {
  return value === null || value === undefined ? '' : String(value);
}

/** Reads a site.yml into the editor's site model. Throws YamlError on syntax errors. */
export function readSiteYaml(source) {
  const { value, header } = parseYaml(source);
  const warnings = [];
  if (!Array.isArray(value)) throw new YamlError('site.yml must be a list of prototypes starting with "- type: cmuNetSite"');
  const sites = value.filter(v => v && typeof v === 'object' && v.type === 'cmuNetSite');
  if (sites.length === 0) throw new YamlError('site.yml has no "- type: cmuNetSite" entry');
  if (sites.length > 1) warnings.push('site.yml holds more than one site; only the first one is edited and exported.');
  if (value.length > sites.length) warnings.push('site.yml holds other prototypes besides the site; they are not kept on export.');
  const raw = sites[0];

  const style = {};
  for (const [key, val] of Object.entries(raw.style || {})) style[key] = str(val);

  const pages = Object.entries(raw.pages || {}).map(([path, file]) => ({ path: str(path), file: str(file) }));
  const tabs = (raw.tabs || []).map(tab => ({ title: str(tab && tab.title), path: str(tab && tab.path) }));

  let board = null;
  if (raw.board && typeof raw.board === 'object') {
    const b = raw.board;
    const posters = Array.isArray(b.posters) ? b.posters.map(str) : [];
    const extra = {};
    for (const [key, val] of Object.entries(b)) if (!BOARD_KEYS.includes(key)) extra[key] = val;
    board = {
      postLabel: str(b.postLabel),
      empty: str(b.empty),
      posters,
      posterWhitelist: b.posterWhitelist ?? null,
      anyonePosts: b.anyonePosts === true,
      showTerminals: b.showTerminals === true,
      bounties: b.bounties === true,
      leaks: b.leaks === true,
      hijackable: b.hijackable === true,
      extra: Object.keys(extra).length ? extra : null,
    };
  }

  const extra = {};
  for (const [key, val] of Object.entries(raw)) if (!SITE_KEYS.includes(key)) extra[key] = val;
  if (Object.keys(extra).length) warnings.push(`Unknown site fields kept as they are: ${Object.keys(extra).join(', ')}.`);

  const site = {
    id: str(raw.id),
    address: str(raw.address),
    title: str(raw.title),
    networks: Array.isArray(raw.networks) ? raw.networks.map(str) : [],
    unlisted: raw.unlisted === true,
    hidden: raw.hidden === true,
    aliasSuffix: str(raw.aliasSuffix),
    root: str(raw.root),
    style,
    pages,
    tabs,
    board,
    extra: Object.keys(extra).length ? extra : null,
    header,
  };
  return { site, warnings };
}

/** attributions.yml: a list of { files, license, copyright, source }. */
export function readAttributions(source) {
  const { value } = parseYaml(source);
  if (!Array.isArray(value)) return [];
  return value.filter(v => v && typeof v === 'object').map(v => ({
    files: Array.isArray(v.files) ? v.files.map(str) : [],
    license: str(v.license),
    copyright: str(v.copyright),
    source: str(v.source),
  }));
}

/** Writes attributions.yml in the format the game's texture folders use. */
export function writeAttributions(entries) {
  const out = [];
  for (const entry of entries) {
    if (!entry.files.length) continue;
    out.push(`- files: [${entry.files.map(quoted).join(', ')}]`);
    out.push(`  license: ${quoted(entry.license)}`);
    out.push(`  copyright: ${quoted(entry.copyright)}`);
    out.push(`  source: ${quoted(entry.source)}`);
    out.push('');
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.length ? out.join('\n') + '\n' : '';
}
