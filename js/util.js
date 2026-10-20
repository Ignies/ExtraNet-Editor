// Small shared helpers: DOM building, colours, timing.

/** el('div.cls#id', { attrs/props/on* }, children...) */
export function el(spec, props = {}, ...children) {
  const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(spec);
  const node = document.createElement((m && m[1]) || 'div');
  if (m && m[2]) {
    for (const part of m[2].match(/[.#][\w-]+/g)) {
      if (part[0] === '.') node.classList.add(part.slice(1));
      else node.id = part.slice(1);
    }
  }
  for (const [key, value] of Object.entries(props || {})) {
    if (value === undefined || value === null) continue;
    if (value === false) {
      if (key in node && typeof node[key] === 'boolean') node[key] = false;
      continue;
    }
    if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key in node && typeof value !== 'string') node[key] = value;
    else if (key === 'className') node.className = value;
    else if (key === 'value') node.value = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function debounce(fn, ms) {
  let timer = null;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  wrapped.flush = (...args) => {
    clearTimeout(timer);
    fn(...args);
  };
  return wrapped;
}

/** [r, g, b, a] with channels 0..1 from #RGB, #RGBA, #RRGGBB or #RRGGBBAA, or null. */
export function rgba(hex) {
  if (typeof hex !== 'string' || !/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex)) return null;
  let h = hex.slice(1);
  if (h.length <= 4) h = [...h].map(c => c + c).join('');
  if (h.length === 6) h += 'ff';
  return [0, 2, 4, 6].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
}

export function css(c, alpha) {
  const a = alpha === undefined ? c[3] : c[3] * alpha;
  return `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${+a.toFixed(3)})`;
}

/** Color.InterpolateBetween */
export function mix(a, b, t) {
  return a.map((v, i) => v + (b[i] - v) * t);
}

export const WHITE = [1, 1, 1, 1];
export const BLACK = [0, 0, 0, 1];

export function hexOf(c) {
  return '#' + c.slice(0, 3).map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** A stable small hash, for the fake deep web alias. */
export function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
