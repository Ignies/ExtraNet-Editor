// Page parser: a port of the guidebook's document grammar (Content.Client/Guidebook/DocumentParsingManager*.cs)
// and of Robust's rich text markup parser (FormattedMessage.MarkupParser.cs). It follows the same rules, including
// the odd ones (a single newline is a space, "<" anywhere in text starts a tag, unknown tags fail the page), so the
// preview and the validator see a page the way the game does.

/** Every document tag the game registers (classes implementing IDocumentTag). An unknown tag fails the page. */
export const DOCUMENT_TAGS = new Set([
  'Document', 'Box', 'ColorBox', 'Table', 'CMUGuideImage', 'CMUGuideZoomImage', 'CMUGuideOutfitEmbed',
  'CMUNetStyle', 'CMUNetSprite', 'CMUNetBlink', 'CMUNetMarquee', 'CMUNetPopup', 'CMUNetAd', 'CMUNetWallpaper',
  'CMUNetRecipes', 'CMUNetArcade', 'CMUNetSportsbook', 'CMUNetSpaceGpt', 'CMUNetMarket', 'CMUNetCmbPanel',
  'CMUNetSearch', 'CMUNetTape', 'CMUNetReels', 'CMUNetTapeLink', 'CommandButton', 'GuideEntityEmbed', 'GuideLawsetEmbed', 'GuideLawsetListEmbed', 'GuideMicrowaveEmbed',
  'GuideMicrowaveGroupEmbed', 'GuideReagentEmbed', 'GuideReagentGroupEmbed', 'GuideTechDisciplineEmbed',
  'GuideTechnologyEmbed',
]);

/** Rich text tags the guidebook allows in page text (GuidebookRichTextTags). Others are skipped, their text kept. */
export const RICH_TAGS = new Set(['bold', 'bolditalic', 'bullet', 'color', 'head', 'italic', 'textlink', 'keybind', 'protodata', 'netlink']);

export class ParseError extends Error {
  constructor(message, offset) {
    super(message);
    this.offset = offset;
  }
}

/** 1-based line and column of an offset. */
export function lineCol(text, offset) {
  let line = 1;
  let last = -1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') {
      line++;
      last = i;
    }
  }
  return { line, col: offset - last };
}

const isWs = c => c !== undefined && /\s/.test(c);
const isLetterOrDigit = c => c !== undefined && /[\p{L}\p{Nd}]/u.test(c);
const isLetter = c => c !== undefined && /\p{L}/u.test(c);
const ESCAPES = { '<': '<', '>': '>', '\\': '\\', '-': '-', '=': '=', '"': '"', ' ': ' ', n: '\n', t: '\t' };

class DocumentParser {
  constructor(text) {
    this.s = text;
    this.i = 0;
  }

  skipWs() {
    while (isWs(this.s[this.i])) this.i++;
  }

  /** SkipWhitespaces then any number of comments, each followed by whitespace. */
  skipWsAndComments() {
    this.skipWs();
    while (this.s.startsWith('<!--', this.i)) {
      const end = this.s.indexOf('-->', this.i + 4);
      if (end < 0) throw new ParseError('unterminated comment <!--', this.i);
      this.i = end + 3;
      this.skipWs();
    }
  }

  /** Whitespace.SkipUntil(Char('\n')) from pos: whitespace up to and including the first newline. */
  skipNewline(pos) {
    let p = pos;
    for (;;) {
      const c = this.s[p];
      if (c === '\n') return p + 1;
      if (isWs(c)) p++;
      else return -1;
    }
  }

  skipWsFrom(pos) {
    let p = pos;
    while (isWs(this.s[p])) p++;
    return p;
  }

  /** TryLookTextEnd: a tag, a list item on a new line, a blank line, or only whitespace to the end. */
  atTextEnd(pos) {
    if (this.s[pos] === '<') return true;
    const nl = this.skipNewline(pos);
    if (nl >= 0) {
      const after = this.skipWsFrom(nl);
      if (this.s[after] === '-') return true;
      if (this.skipNewline(nl) >= 0) return true;
    }
    return this.skipWsFrom(pos) >= this.s.length;
  }

  parseDocument() {
    const controls = [];
    this.skipWsAndComments();
    while (this.i < this.s.length) {
      controls.push(this.control());
      this.skipWsAndComments();
    }
    return controls;
  }

  control() {
    const c = this.s[this.i];
    if (c === '<') return this.tag();
    if (c === '#') return this.heading();
    if (c === '-') return this.list();
    return this.text();
  }

  heading() {
    const start = this.i;
    let level = 0;
    while (level < 3 && this.s[this.i] === '#') {
      level++;
      this.i++;
    }
    this.skipWs();
    const from = this.i;
    while (this.i < this.s.length && this.s[this.i] !== '\n') this.i++;
    if (this.i === from) throw new ParseError('a heading needs text after the #', start);
    return { kind: 'heading', level, text: this.s.slice(from, this.i), start, end: this.i };
  }

  list() {
    const start = this.i;
    this.i++;
    this.skipWs();
    if (this.i >= this.s.length) throw new ParseError('a list item needs text after the -', start);
    const text = this.text();
    return { kind: 'list', item: text, start, end: this.i };
  }

  /** TextChar: escapes, a single newline (and the indentation after it) as a space, or any character. */
  textChar(notes) {
    const c = this.s[this.i];
    if (c === '\\' && ESCAPES[this.s[this.i + 1]] !== undefined) {
      const out = ESCAPES[this.s[this.i + 1]];
      this.i += 2;
      return out;
    }
    const nl = this.skipNewline(this.i);
    if (nl >= 0) {
      this.i = this.skipWsFrom(nl);
      if (this.s[this.i] === '#' && notes) notes.push({ type: 'merged-heading', offset: this.i });
      return ' ';
    }
    this.i++;
    return c;
  }

  text() {
    const start = this.i;
    const notes = [];
    let out = this.textChar(notes);
    while (this.i < this.s.length && !this.atTextEnd(this.i)) out += this.textChar(notes);
    // "Only whitespace to the end" ends the text without consuming it.
    const end = this.i;
    const node = { kind: 'text', raw: out, start, end, notes };
    node.rich = parseRich(out);
    return node;
  }

  tag() {
    const start = this.i;
    this.i++;
    this.skipWs();
    let name = '';
    for (;;) {
      if (this.i >= this.s.length) throw new ParseError('the tag is never closed with > or />', start);
      if (isWs(this.s[this.i])) {
        this.skipWs();
        break;
      }
      if (this.s[this.i] === '>' || this.s.startsWith('/>', this.i)) break;
      name += this.textChar(null);
    }
    if (!DOCUMENT_TAGS.has(name)) {
      if (name.startsWith('/')) throw new ParseError(`closing tag <${name}> without a matching opening tag`, start);
      throw new ParseError(`unknown tag: <${name}>`, start);
    }

    const args = [];
    while (!(this.s[this.i] === '>' || this.s.startsWith('/>', this.i))) {
      if (this.i >= this.s.length) throw new ParseError(`<${name}> is never closed with > or />`, start);
      const keyStart = this.i;
      let key = '';
      while (this.s[this.i] !== '=') {
        if (!isLetterOrDigit(this.s[this.i])) {
          throw new ParseError(`bad attribute in <${name}>: expected Name="value", found "${this.s.slice(keyStart, this.i + 1)}"`, this.i);
        }
        key += this.s[this.i++];
      }
      this.i++;
      if (this.s[this.i] !== '"') throw new ParseError(`attribute ${key} of <${name}> needs a "quoted" value`, this.i);
      this.i++;
      let value = '';
      for (;;) {
        if (this.i >= this.s.length) throw new ParseError(`attribute ${key} of <${name}> has no closing quote`, keyStart);
        const c = this.s[this.i];
        if (c === '\\' && ESCAPES[this.s[this.i + 1]] !== undefined) {
          value += ESCAPES[this.s[this.i + 1]];
          this.i += 2;
          continue;
        }
        if (c === '"') {
          this.i++;
          break;
        }
        value += c;
        this.i++;
      }
      if (args.some(([k]) => k === key)) throw new ParseError(`attribute ${key} appears twice in <${name}>`, keyStart);
      args.push([key, value]);
      this.skipWs();
    }

    const node = { kind: 'tag', name, args: Object.fromEntries(args), argOrder: args.map(a => a[0]), children: [], start, end: 0 };
    // end is just past the tag's last ">", before the whitespace the grammar skips after it.
    if (this.s.startsWith('/>', this.i)) {
      this.i += 2;
      node.end = this.i;
      this.skipWs();
      return node;
    }
    this.i++;
    this.skipWs();
    node.contentStart = this.i;
    for (;;) {
      if (this.i >= this.s.length) throw new ParseError(`<${name}> is never closed: add </${name}>`, start);
      const closeStart = this.i;
      if (this.tryTerminator(name)) {
        node.closeStart = closeStart;
        break;
      }
      node.children.push(this.control());
      this.skipWsAndComments();
    }
    node.end = this.closedAt;
    return node;
  }

  tryTerminator(name) {
    if (!this.s.startsWith('</', this.i)) return false;
    let p = this.skipWsFrom(this.i + 2);
    if (!this.s.startsWith(name, p)) return false;
    p = this.skipWsFrom(p + name.length);
    if (this.s[p] !== '>') return false;
    this.closedAt = p + 1;
    this.i = this.skipWsFrom(p + 1);
    return true;
  }
}

/** Parses a page. Returns { controls } or { error: { message, offset, line, col } }. */
export function parseDocument(text) {
  const parser = new DocumentParser(text);
  try {
    return { controls: parser.parseDocument() };
  } catch (e) {
    if (!(e instanceof ParseError)) throw e;
    const { line, col } = lineCol(text, e.offset);
    return { error: { message: e.message, offset: e.offset, line, col } };
  }
}

// ---------------------------------------------------------------- rich text

/**
 * Robust's markup: text, [tag=param attr=param], [tag/] and [/tag]. Params are "strings", colours (#hex or a
 * name) or whole numbers. Returns { nodes } or { error }. A lone backslash stops parsing silently, as in game.
 */
export function parseRich(text) {
  const nodes = [];
  let i = 0;
  let truncated = false;
  const err = (message, at) => ({ error: { message, offset: at } });

  const ws = () => {
    while (isWs(text[i])) i++;
  };

  const identifier = () => {
    if (!isLetter(text[i])) return null;
    const from = i;
    i++;
    while (isLetterOrDigit(text[i])) i++;
    return text.slice(from, i);
  };

  const parameter = () => {
    // '=' already consumed
    ws();
    if (text[i] === '"') {
      i++;
      let value = '';
      for (;;) {
        if (i >= text.length) return { failed: 'unterminated "string" in a [tag]' };
        if (text[i] === '\\' && '\\[]"/'.includes(text[i + 1] ?? '\0')) {
          value += text[i + 1];
          i += 2;
          continue;
        }
        if (text[i] === '"') {
          i++;
          return { kind: 'string', value };
        }
        value += text[i++];
      }
    }
    if (text[i] === '#' || isLetter(text[i])) {
      const from = i;
      i++;
      while (/[#a-zA-Z0-9]/.test(text[i] ?? '')) i++;
      return { kind: 'color', value: text.slice(from, i) };
    }
    const m = /^[-+]?\d+/.exec(text.slice(i));
    if (m) {
      i += m[0].length;
      return { kind: 'number', value: Number(m[0]) };
    }
    return { failed: 'a [tag=value] needs a "string", a #colour or a number after =' };
  };

  /** KeyValuePair, Between(SkipWhitespaces). Returns null when nothing was consumed. */
  const pair = () => {
    const from = i;
    ws();
    const name = identifier();
    if (name === null) {
      if (i !== from) return { failed: 'expected a tag name or attribute' };
      return null;
    }
    ws();
    let param = null;
    if (text[i] === '=') {
      i++;
      param = parameter();
      if (param.failed) return param;
    }
    ws();
    return { name, param };
  };

  while (i < text.length) {
    const c = text[i];
    if (c === '\\') {
      if ('\\[]/'.includes(text[i + 1] ?? '\0')) {
        pushText(nodes, text[i + 1]);
        i += 2;
        continue;
      }
      truncated = true;
      break;
    }
    if (c !== '[') {
      pushText(nodes, c);
      i++;
      continue;
    }
    const start = i;
    i++;
    if (text[i] === '/') {
      i++;
      ws();
      const name = identifier();
      if (name === null) return err('expected a tag name after [/', start);
      ws();
      if (text[i] !== ']') return err(`expected ] to close [/${name}`, start);
      i++;
      nodes.push({ type: 'close', name, start });
      continue;
    }
    const head = pair();
    if (!head || head.failed) return err(head ? `bad [tag]: ${head.failed}` : 'a [ starts a tag; write \\[ for a literal bracket', start);
    const attrs = {};
    for (;;) {
      const save = i;
      const attr = pair();
      if (attr === null) {
        i = save;
        break;
      }
      if (attr.failed) return err(`bad attribute in [${head.name}]: ${attr.failed}`, start);
      if (!(attr.name in attrs)) attrs[attr.name] = attr.param;
    }
    let selfClosing = false;
    if (text[i] === '/') {
      i++;
      ws();
      if (text[i] !== ']') return err(`expected /] to close [${head.name}`, start);
      selfClosing = true;
    } else if (text[i] !== ']') {
      return err(`expected ] to close [${head.name}`, start);
    }
    i++;
    nodes.push({ type: 'open', name: head.name, param: head.param, attrs, start, end: i });
    if (selfClosing) nodes.push({ type: 'close', name: head.name, start });
  }
  return { nodes, truncated: truncated ? i : -1 };
}

function pushText(nodes, c) {
  const last = nodes[nodes.length - 1];
  if (last && last.type === 'text') last.value += c;
  else nodes.push({ type: 'text', value: c });
}

/** Plain text of rich nodes, markup removed. */
export function richPlainText(nodes) {
  return nodes.filter(n => n.type === 'text').map(n => n.value).join('');
}

/** Walks every control, depth first. */
export function* walk(controls) {
  for (const control of controls) {
    yield control;
    if (control.kind === 'tag') yield* walk(control.children);
    if (control.kind === 'list') yield control.item;
  }
}

/** Netlinks in a text node: [{ text, link, start }]. */
export function netlinks(textNode) {
  const out = [];
  if (!textNode.rich || !textNode.rich.nodes) return out;
  for (const node of textNode.rich.nodes) {
    if (node.type !== 'open' || node.name !== 'netlink') continue;
    const text = node.param && node.param.kind === 'string' ? node.param.value : null;
    const linkParam = node.attrs.link;
    const link = linkParam && linkParam.kind === 'string' ? linkParam.value : text;
    out.push({ text, link, param: node.param, node });
  }
  return out;
}

// ---------------------------------------------------------------- colours and values, as Robust reads them

/** Color.TryFromHex: #RGB, #RGBA, #RRGGBB or #RRGGBBAA. Returns a CSS colour or null. */
export function hexColour(value) {
  if (typeof value !== 'string' || !/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) return null;
  let hex = value.slice(1);
  if (hex.length <= 4) hex = [...hex].map(c => c + c).join('');
  if (hex.length === 6) return `#${hex}`;
  const a = parseInt(hex.slice(6, 8), 16) / 255;
  return `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)}, ${a.toFixed(3)})`;
}

/** float.TryParse with the invariant culture (roughly). */
export function parseFloatInvariant(value) {
  if (typeof value !== 'string' || !/^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?\s*$/.test(value)) return null;
  return Number(value);
}

export const FONTS = ['Sans', 'Display', 'Mono', 'Terminal', 'Pixel'];
export const BACKGROUND_MODES = ['Stretch', 'Tile', 'Center'];
export const H_ALIGN = ['Stretch', 'Left', 'Center', 'Right'];
export const V_ALIGN = ['Stretch', 'Top', 'Center', 'Bottom'];
export const NETWORKS = ['CMUNetPublic', 'CMUNetSeegson', 'CMUNetWeylandYutani', 'CMUNetUSCM', 'CMUNetCMB', 'CMUNetDeep'];

/** Enum.TryParse, case sensitive, as the tags call it. */
export function enumValue(value, names) {
  return names.includes(value) ? value : null;
}

/** CMUExtraNetSystem.Split: lowercase host and a path without surrounding slashes; a scheme is ignored. */
export function splitAddress(address) {
  let trimmed = address.trim();
  const scheme = trimmed.indexOf('://');
  if (scheme >= 0) trimmed = trimmed.slice(scheme + 3);
  const slash = trimmed.indexOf('/');
  if (slash < 0) return { host: trimmed.trim().toLowerCase(), path: '' };
  return { host: trimmed.slice(0, slash).trim().toLowerCase(), path: normalizePath(trimmed.slice(slash + 1)) };
}

export function normalizePath(path) {
  return path.trim().replace(/^\/+|\/+$/g, '').toLowerCase();
}

/** Built in addresses the browser handles itself: sys://, deeps:// and net:// (net://random). */
export function isBuiltIn(address) {
  return /^(sys|deeps|net):\/\//i.test(address.trim());
}

export function isCamera(address) {
  return /^cam:\/\//i.test(address.trim());
}
