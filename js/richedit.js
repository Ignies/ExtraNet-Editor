// Inline editing of page text: rich text markup ([bold], [italic], [color], [netlink]) to editable HTML and back.

import { parseRich } from './markup.js';
import { el } from './util.js';

const EDITABLE_TAGS = new Set(['bold', 'italic', 'color', 'netlink']);

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Markup to HTML for a contenteditable. Returns { html, editable }: editable is false when the text uses tags
 * the inline editor cannot round trip (head, bullet, keybind...), which are then edited as markup instead.
 */
export function markupToHtml(text) {
  const parsed = parseRich(text);
  if (parsed.error || parsed.truncated >= 0) return { html: escapeHtml(text), editable: false };
  let html = '';
  const stack = [];
  let editable = true;
  for (const node of parsed.nodes) {
    if (node.type === 'text') {
      html += escapeHtml(node.value);
      continue;
    }
    if (!EDITABLE_TAGS.has(node.name)) {
      editable = false;
      continue;
    }
    if (node.type === 'close') {
      if (node.name === 'netlink') continue;
      const index = stack.lastIndexOf(node.name);
      if (index < 0) {
        editable = false;
        continue;
      }
      // Close down to the matching tag, reopening anything closed early.
      const reopen = stack.splice(index);
      for (let i = reopen.length - 1; i >= 0; i--) html += closing(reopen[i]);
      for (const name of reopen.slice(1)) {
        html += opening(name);
        stack.push(name);
      }
      continue;
    }
    if (node.name === 'netlink') {
      if (!node.param || node.param.kind !== 'string') {
        editable = false;
        continue;
      }
      const link = node.attrs.link && node.attrs.link.kind === 'string' ? node.attrs.link.value : null;
      html += linkChip(node.param.value, link);
      continue;
    }
    if (node.name === 'color') {
      if (!node.param || node.param.kind !== 'color') {
        editable = false;
        continue;
      }
      html += `<font color="${escapeHtml(node.param.value)}">`;
      stack.push('color');
      continue;
    }
    if (Object.keys(node.attrs).length || node.param) editable = false;
    html += opening(node.name);
    stack.push(node.name);
  }
  for (let i = stack.length - 1; i >= 0; i--) html += closing(stack[i]);
  return { html, editable };
}

function opening(name) {
  return name === 'bold' ? '<b>' : name === 'italic' ? '<i>' : '<font>';
}

function closing(name) {
  return name === 'bold' ? '</b>' : name === 'italic' ? '</i>' : '</font>';
}

export function linkChip(text, link) {
  const target = link === null || link === undefined ? text : link;
  const bare = link === null || link === undefined;
  return `<span class="netlink-chip" contenteditable="false" data-text="${escapeHtml(text)}" data-link="${escapeHtml(target)}"${bare ? ' data-bare="1"' : ''} title="${escapeHtml(target)}">${escapeHtml(text)}</span>`;
}

export function linkChipNode(text, link) {
  const holder = el('span');
  holder.innerHTML = linkChip(text, link);
  return holder.firstChild;
}

function escapeText(text) {
  // A [ typed as text would start a markup tag.
  return text.replace(/\[/g, '\\[').replace(/ /g, ' ');
}

function escapeParam(text) {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function normaliseColour(value) {
  if (!value) return null;
  if (/^#[0-9a-f]{3,8}$/i.test(value)) return value.toUpperCase();
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(value);
  if (m) return '#' + [m[1], m[2], m[3]].map(v => Number(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  return value;
}

/** HTML from a contenteditable back to markup, on one line. */
export function htmlToMarkup(root) {
  let out = '';
  const walk = (node, state) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        out += escapeText(child.nodeValue.replace(/\n/g, ' '));
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = child.tagName.toLowerCase();
      if (child.classList.contains('netlink-chip')) {
        const text = child.dataset.text || child.textContent;
        const link = child.dataset.link || text;
        out += child.dataset.bare && link === text ? `[netlink="${escapeParam(text)}"]` : `[netlink="${escapeParam(text)}" link="${escapeParam(link)}"]`;
        continue;
      }
      if (tag === 'br') {
        out += ' ';
        continue;
      }
      const wraps = [];
      const bold = tag === 'b' || tag === 'strong' || /^(bold|[6-9]00)$/.test(child.style && child.style.fontWeight);
      const italic = tag === 'i' || tag === 'em' || (child.style && child.style.fontStyle === 'italic');
      const colour = normaliseColour(tag === 'font' ? child.getAttribute('color') : child.style && child.style.color);
      if (colour && !state.colour) wraps.push(['color', colour]);
      if (bold && !state.bold) wraps.push(['bold']);
      if (italic && !state.italic) wraps.push(['italic']);
      for (const [name, value] of wraps) out += value ? `[${name}=${value}]` : `[${name}]`;
      if ((tag === 'div' || tag === 'p') && out && !out.endsWith(' ')) out += ' ';
      walk(child, { bold: state.bold || bold, italic: state.italic || italic, colour: state.colour || !!colour });
      for (let i = wraps.length - 1; i >= 0; i--) out += `[/${wraps[i][0]}]`;
    }
  };
  walk(root, { bold: false, italic: false, colour: false });
  // Drop empty pairs the browser leaves behind, like [bold][/bold].
  let prev;
  do {
    prev = out;
    out = out.replace(/\[(bold|italic)\]\[\/\1\]/g, '').replace(/\[color=[^\]]+\]\[\/color\]/g, '');
  } while (out !== prev);
  return out.replace(/\n/g, ' ').trim();
}
