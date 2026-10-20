// The page code editor: a textarea over a syntax coloured copy of its text, with line numbers and marks for
// lines the validator flagged.

import { el } from './util.js';

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Colours markup, rich text tags, headings, list bullets, comments and {colony}. */
export function highlight(text) {
  let out = '';
  let i = 0;
  const n = text.length;
  let lineStart = true;
  while (i < n) {
    const c = text[i];
    if (text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i + 4);
      const stop = end < 0 ? n : end + 3;
      out += `<span class="hl-comment">${escapeHtml(text.slice(i, stop))}</span>`;
      i = stop;
      lineStart = false;
      continue;
    }
    if (c === '<') {
      const m = /^<\/?\s*[\w.]*/.exec(text.slice(i));
      let j = i + m[0].length;
      let html = `<span class="hl-tag">${escapeHtml(m[0])}</span>`;
      while (j < n && text[j] !== '>' && text[j] !== '<') {
        const attr = /^(\s*)([A-Za-z0-9]+)(=)("(?:\\.|[^"\\])*"?)/.exec(text.slice(j));
        if (attr) {
          html += escapeHtml(attr[1]) + `<span class="hl-attr">${attr[2]}</span>=<span class="hl-value">${escapeHtml(attr[4])}</span>`;
          j += attr[0].length;
        } else if (text.startsWith('/>', j)) {
          break;
        } else {
          html += escapeHtml(text[j]);
          j++;
        }
      }
      if (text.startsWith('/>', j)) {
        html += '<span class="hl-tag">/&gt;</span>';
        j += 2;
      } else if (text[j] === '>') {
        html += '<span class="hl-tag">&gt;</span>';
        j++;
      }
      out += html;
      i = j;
      lineStart = false;
      continue;
    }
    if (c === '[') {
      const end = text.indexOf(']', i);
      const nl = text.indexOf('\n', i);
      if (end > 0 && (nl < 0 || end < nl)) {
        const tag = text.slice(i, end + 1);
        const cls = /^\[\/?netlink/.test(tag) ? 'hl-link' : 'hl-rich';
        out += `<span class="${cls}">${escapeHtml(tag).replace(/"([^"]*)"/g, '"<span class="hl-value">$1</span>"')}</span>`;
        i = end + 1;
        lineStart = false;
        continue;
      }
    }
    if (text.startsWith('{colony}', i)) {
      out += '<span class="hl-colony">{colony}</span>';
      i += 8;
      lineStart = false;
      continue;
    }
    if (lineStart && (c === '#' || c === '-')) {
      const nl = text.indexOf('\n', i);
      const stop = nl < 0 ? n : nl;
      if (c === '#') {
        out += `<span class="hl-heading">${escapeHtml(text.slice(i, stop))}</span>`;
        i = stop;
      } else {
        out += '<span class="hl-bullet">-</span>';
        i++;
      }
      lineStart = false;
      continue;
    }
    if (c === '\n') lineStart = true;
    else if (c !== ' ' && c !== '\t') lineStart = false;
    out += escapeHtml(c);
    i++;
  }
  // A trailing newline needs something after it or the last line collapses.
  return out + '\n';
}

export class CodeEditor {
  constructor(host, { onChange, onCursor }) {
    this.onChange = onChange;
    this.onCursor = onCursor || (() => {});
    this.gutter = el('div.code-gutter');
    this.highlightLayer = el('pre.code-highlight', { 'aria-hidden': 'true' });
    this.textarea = el('textarea.code-input', { spellcheck: false, autocapitalize: 'off', autocomplete: 'off', wrap: 'off', 'aria-label': 'Page markup' });
    this.marks = new Map();
    this.wrap = el('div.code-wrap', {}, this.highlightLayer, this.textarea);
    host.replaceChildren(el('div.code-editor', {}, this.gutter, this.wrap));

    this.textarea.addEventListener('input', () => {
      this.render();
      this.onChange(this.textarea.value);
    });
    this.textarea.addEventListener('scroll', () => this.syncScroll());
    // Toolbar buttons and dialogs take focus; the last cursor position in the editor is kept so their
    // snippets land there.
    this.saved = [0, 0];
    const save = () => {
      this.saved = [this.textarea.selectionStart, this.textarea.selectionEnd];
    };
    for (const event of ['selectionchange', 'select', 'keyup', 'mouseup', 'input', 'blur']) this.textarea.addEventListener(event, save);
    this.textarea.addEventListener('keydown', e => this.keydown(e));
    for (const event of ['keyup', 'click', 'select']) this.textarea.addEventListener(event, () => this.onCursor(this.cursorLine()));
  }

  get value() {
    return this.textarea.value;
  }

  set value(text) {
    this.textarea.value = text;
    // Until the cursor is placed, snippets go at the end of the document, inside it.
    const end = text.lastIndexOf('</Document>');
    const at = end >= 0 ? end : text.length;
    this.textarea.setSelectionRange(at, at);
    this.textarea.scrollTop = 0;
    this.saved = [at, at];
    this.render();
  }

  setDisabled(disabled) {
    this.textarea.disabled = disabled;
  }

  /** Flags lines: Map(line -> 'error' | 'warning' | 'info'). */
  setMarks(marks) {
    this.marks = marks;
    this.renderGutter();
  }

  render() {
    this.highlightLayer.innerHTML = highlight(this.textarea.value);
    this.renderGutter();
    this.syncScroll();
  }

  renderGutter() {
    const lines = this.textarea.value.split('\n').length;
    const parts = [];
    for (let i = 1; i <= lines; i++) {
      const mark = this.marks.get(i);
      parts.push(mark ? `<div class="gl gl-${mark}" title="${mark}">${i}</div>` : `<div class="gl">${i}</div>`);
    }
    this.gutter.innerHTML = parts.join('');
    this.syncScroll();
  }

  syncScroll() {
    this.highlightLayer.scrollTop = this.textarea.scrollTop;
    this.highlightLayer.scrollLeft = this.textarea.scrollLeft;
    this.gutter.scrollTop = this.textarea.scrollTop;
  }

  cursorLine() {
    return this.textarea.value.slice(0, this.textarea.selectionStart).split('\n').length;
  }

  keydown(e) {
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      if (e.shiftKey) this.outdent();
      else this.insert('  ');
    } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      // Keep the indentation of the line.
      const start = this.textarea.selectionStart;
      const line = this.textarea.value.slice(0, start).split('\n').pop();
      const indent = /^\s*/.exec(line)[0];
      e.preventDefault();
      this.insert('\n' + indent);
    }
  }

  outdent() {
    const t = this.textarea;
    const start = t.value.lastIndexOf('\n', t.selectionStart - 1) + 1;
    if (t.value.startsWith('  ', start)) {
      t.setSelectionRange(start, start + 2);
      this.insert('');
    }
  }

  /** Puts the focus back in the editor with the cursor where it was before a toolbar button or dialog. */
  restore() {
    const t = this.textarea;
    const [start, end] = this.saved;
    if (document.activeElement !== t) t.focus();
    if (t.selectionStart !== start || t.selectionEnd !== end) t.setSelectionRange(start, end);
  }

  /** Inserts text at the cursor (replacing the selection), keeping the undo history where the browser allows. */
  insert(text, selectFrom = null, selectTo = null) {
    const t = this.textarea;
    this.restore();
    const start = t.selectionStart;
    let done = false;
    try {
      done = document.execCommand('insertText', false, text);
    } catch {
      done = false;
    }
    if (!done) {
      t.setRangeText(text, t.selectionStart, t.selectionEnd, 'end');
      t.dispatchEvent(new Event('input'));
    }
    if (selectFrom !== null) t.setSelectionRange(start + selectFrom, start + (selectTo ?? selectFrom));
  }

  selection() {
    this.restore();
    const t = this.textarea;
    return t.value.slice(t.selectionStart, t.selectionEnd);
  }

  /** Wraps the selection, or inserts before + placeholder + after with the placeholder selected. */
  wrapSelection(before, after, placeholder) {
    const selected = this.selection();
    const inner = selected || placeholder;
    this.insert(before + inner + after, before.length, before.length + inner.length);
  }

  /** Inserts a block on its own line, indented like the current line. */
  insertBlock(block) {
    this.restore();
    const t = this.textarea;
    const start = t.selectionStart;
    const lineStart = t.value.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = t.value.indexOf('\n', start);
    if (lineEnd < 0) lineEnd = t.value.length;
    const line = t.value.slice(lineStart, lineEnd);
    let indent = /^[ \t]*/.exec(line)[0].slice(0, 12);
    // Inside <Document> blocks go one level in from the opening tag's line.
    if (/^\s*<Document>\s*$/.test(line)) indent += '  ';
    if (/^\s*<\/Document>\s*$/.test(line)) indent += '  ';
    if (!indent) indent = '  ';
    const lines = block.split('\n').map(l => indent + l);
    if (/^\s*<\/Document>\s*$/.test(line)) {
      // On the closing tag the block goes just above it, still inside the document.
      t.setSelectionRange(lineStart, lineStart);
      this.insert(lines.join('\n') + '\n');
    } else if (line.trim() === '') {
      // An empty line is replaced by the block.
      t.setSelectionRange(lineStart, lineEnd);
      this.insert(lines.join('\n'));
    } else {
      // Otherwise the block goes on a new line after the current one.
      t.setSelectionRange(lineEnd, lineEnd);
      this.insert('\n' + lines.join('\n'));
    }
  }

  /** Puts a prefix at the start of the current line (headings, list items). */
  prefixLine(prefix) {
    this.restore();
    const t = this.textarea;
    const lineStart = t.value.lastIndexOf('\n', t.selectionStart - 1) + 1;
    const indent = /^[ \t]*/.exec(t.value.slice(lineStart))[0];
    const at = lineStart + indent.length;
    const rest = t.value.slice(at);
    const existing = /^(#{1,3} |- )/.exec(rest);
    t.setSelectionRange(at, at + (existing ? existing[0].length : 0));
    this.insert(prefix);
  }

  goToLine(line) {
    const t = this.textarea;
    const lines = t.value.split('\n');
    let offset = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) offset += lines[i].length + 1;
    t.focus();
    t.setSelectionRange(offset, offset + (lines[line - 1] || '').length);
    const lineHeight = parseFloat(getComputedStyle(t).lineHeight) || 18;
    t.scrollTop = Math.max(0, (line - 4) * lineHeight);
    this.syncScroll();
  }
}
