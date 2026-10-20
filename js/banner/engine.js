// Banner rendering: backgrounds, text with outline, shadow, glow, 3D extrude and bevel, and game sprites, with
// an optional pixel look. Used by the studio for the live canvas and for the exported PNG.

import { getBackground, backgroundParams } from './backgrounds/index.js';
import { FONTS, getFont } from './fonts.js';
import { loadRsi, loadStateSheet, stateFrames } from '../sprites.js';
import { ensureFont } from '../fonts.js';

export const DEFAULT_SIZE = { width: 528, height: 136 };
export const FORMAT = 'cmu-extranet-banner';

let nextLayer = 1;
export function layerId(prefix = 'layer') {
  return `${prefix}${Date.now().toString(36)}${(nextLayer++).toString(36)}`;
}

export function textLayer(props = {}) {
  return {
    id: layerId('text'),
    type: 'text',
    name: 'Text',
    visible: true,
    locked: false,
    x: DEFAULT_SIZE.width / 2,
    y: DEFAULT_SIZE.height / 2,
    rotation: 0,
    opacity: 1,
    text: 'TEXT',
    font: 'game-sans',
    size: 40,
    letterSpacing: 0,
    lineHeight: 1.1,
    align: 'center',
    upper: false,
    skew: 0,
    fill: { type: 'solid', color: '#FFFFFF' },
    outline: null,
    shadow: null,
    glow: null,
    extrude: null,
    bevel: null,
    ...props,
  };
}

export function spriteLayer(source, props = {}) {
  return {
    id: layerId('sprite'),
    type: 'sprite',
    name: source.label || source.state || 'Sprite',
    visible: true,
    locked: false,
    x: DEFAULT_SIZE.width / 2,
    y: DEFAULT_SIZE.height / 2,
    rotation: 0,
    opacity: 1,
    scale: 2,
    flipX: false,
    flipY: false,
    shadow: null,
    source,
    ...props,
  };
}

export function emptyDesign() {
  return normaliseDesign({
    name: 'Banner',
    background: { type: 'procedural', id: 'gradient', seed: 1, params: {} },
    layers: [
      textLayer({ id: 'title', name: 'Title', text: 'SITE TITLE', size: 52, y: 58, upper: true, font: 'game-display', outline: { color: '#000000', width: 2 } }),
      textLayer({ id: 'subtitle', name: 'Subtitle', text: 'A subtitle for the site', size: 18, y: 104, font: 'game-sans', fill: { type: 'solid', color: '#D8E6FF' } }),
    ],
  });
}

/** Fills in anything a design (from a file or a starter) leaves out. */
export function normaliseDesign(d) {
  const design = {
    format: FORMAT,
    version: 1,
    name: d.name || 'Banner',
    width: Math.max(16, Math.min(2048, Math.round(Number(d.width) || DEFAULT_SIZE.width))),
    height: Math.max(16, Math.min(1024, Math.round(Number(d.height) || DEFAULT_SIZE.height))),
    pixel: [1, 2, 3].includes(Number(d.pixel)) ? Number(d.pixel) : 1,
    background: d.background && d.background.type ? { ...d.background } : { type: 'procedural', id: 'solid', seed: 1, params: {} },
    layers: [],
  };
  if (design.background.type === 'procedural') {
    design.background.seed = Number(design.background.seed) || 1;
    design.background.params = { ...(design.background.params || {}) };
  }
  for (const layer of d.layers || []) {
    if (layer.type === 'text') design.layers.push(textLayer({ ...layer, id: layer.id || layerId('text') }));
    else if (layer.type === 'sprite' && layer.source) design.layers.push(spriteLayer(layer.source, { ...layer, id: layer.id || layerId('sprite') }));
    else if (layer.type === 'shape') design.layers.push(shapeLayer({ ...layer, id: layer.id || layerId('shape') }));
  }
  return design;
}

// ---------------------------------------------------------------- colours

function parseColour(value) {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, m[2] ? parseInt(m[2], 16) / 255 : 1];
}

/** A canvas colour from #RRGGBB or #RRGGBBAA. */
export function colour(value, fallback = '#FFFFFF') {
  const c = parseColour(value) || parseColour(fallback);
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3]})`;
}

function darken(value, amount) {
  const c = parseColour(value) || [128, 128, 128, 1];
  const k = Math.max(0, 1 - amount);
  return `rgba(${Math.round(c[0] * k)}, ${Math.round(c[1] * k)}, ${Math.round(c[2] * k)}, ${c[3]})`;
}

function baseFillColour(fill) {
  if (!fill) return '#FFFFFF';
  if (fill.type === 'gradient' && fill.stops && fill.stops.length) return fill.stops[Math.floor(fill.stops.length / 2)].color;
  return fill.color || '#FFFFFF';
}

// ---------------------------------------------------------------- fonts

const fontLoads = new Map();

function loadStylesheet(href) {
  return new Promise(resolve => {
    const existing = document.querySelector(`link[data-banner-font="${href}"]`);
    if (existing) {
      resolve();
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.bannerFont = href;
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.append(link);
  });
}

/** Loads one banner font. Resolves when it can be drawn with (or after a timeout, using a fallback). */
export function loadFont(id) {
  const font = getFont(id);
  if (fontLoads.has(font.id)) return fontLoads.get(font.id);
  const spec = `${font.weight} 40px "${font.family}"`;
  const promise = (async () => {
    if (font.google) await loadStylesheet(`https://fonts.googleapis.com/css2?family=${font.google}&display=block`);
    if (font.game) ensureFont(font.game);
    const until = Date.now() + 6000;
    while (Date.now() < until) {
      try {
        await document.fonts.load(spec, 'AZaz09');
        if (document.fonts.check(spec, 'AZaz09')) return true;
      } catch {
        // keep waiting
      }
      await new Promise(r => setTimeout(r, 150));
    }
    return false;
  })();
  fontLoads.set(font.id, promise);
  return promise;
}

export function loadAllFonts() {
  return Promise.all(FONTS.map(f => loadFont(f.id)));
}

export function fontCss(layer, size) {
  const font = getFont(layer.font);
  const weight = layer.weight || font.weight;
  return `${weight} ${size}px "${font.family}", sans-serif`;
}

// ---------------------------------------------------------------- sprites

const spriteCache = new Map();

function frameCanvas(rsi, state, image) {
  const frame = stateFrames(rsi, rsi.states.get(state), image, 0)[0];
  const c = document.createElement('canvas');
  c.width = rsi.size.x;
  c.height = rsi.size.y;
  c.getContext('2d').drawImage(image, frame.sx, frame.sy, rsi.size.x, rsi.size.y, 0, 0, rsi.size.x, rsi.size.y);
  return c;
}

/** A sprite source as a canvas: the first frame facing south, layers stacked, or the uploaded image. */
export function loadSprite(source) {
  const key = JSON.stringify(source);
  if (spriteCache.has(key)) return spriteCache.get(key);
  const promise = (async () => {
    if (source.kind === 'image') {
      const img = new Image();
      img.src = source.src;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      return c;
    }
    const parts = source.kind === 'layers' ? source.layers : [{ rsi: source.rsi, state: source.state }];
    const frames = [];
    for (const part of parts) {
      const rsi = await loadRsi(part.rsi);
      if (!rsi.states.has(part.state)) throw new Error(`no state ${part.state} in ${part.rsi}`);
      const image = await loadStateSheet(rsi.path, part.state);
      frames.push(frameCanvas(rsi, part.state, image));
    }
    const w = Math.max(...frames.map(f => f.width));
    const h = Math.max(...frames.map(f => f.height));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    for (const f of frames) ctx.drawImage(f, Math.round((w - f.width) / 2), Math.round((h - f.height) / 2));
    return c;
  })();
  promise.catch(() => spriteCache.delete(key));
  spriteCache.set(key, promise);
  return promise;
}

const imageCache = new Map();
function loadImage(src) {
  if (!imageCache.has(src)) {
    const img = new Image();
    img.src = src;
    imageCache.set(src, img.decode().then(() => img));
  }
  return imageCache.get(src);
}

/** Loads everything a design draws with. Returns { sprites: Map(layerId -> canvas|null), background: image|null }. */
export async function prepare(design) {
  const sprites = new Map();
  const jobs = [];
  for (const layer of design.layers) {
    if (layer.type === 'text') jobs.push(loadFont(layer.font));
    if (layer.type === 'sprite') {
      jobs.push(loadSprite(layer.source).then(c => sprites.set(layer.id, c)).catch(() => sprites.set(layer.id, null)));
    }
  }
  let background = null;
  // A background that draws loaded files has preload(); draw() then uses them synchronously.
  if (design.background.type === 'procedural') jobs.push(preloadBackground(getBackground(design.background.id)));
  if (design.background.type === 'image' && design.background.src) {
    jobs.push(loadImage(design.background.src).then(img => {
      background = img;
    }).catch(() => {}));
  }
  await Promise.all(jobs);
  return { sprites, background };
}

// ---------------------------------------------------------------- drawing

export function drawBackground(ctx, background, width, height, image) {
  ctx.save();
  if (background.type === 'image') {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    if (image) {
      const fit = background.fit || 'cover';
      ctx.imageSmoothingEnabled = false;
      if (fit === 'tile') {
        const pattern = ctx.createPattern(image, 'repeat');
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, width, height);
      } else {
        const sx = width / image.naturalWidth;
        const sy = height / image.naturalHeight;
        const s = fit === 'contain' ? Math.min(sx, sy) : Math.max(sx, sy);
        const w = image.naturalWidth * s;
        const h = image.naturalHeight * s;
        ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
      }
    }
  } else {
    const bg = getBackground(background.id);
    try {
      bg.draw(ctx, width, height, backgroundParams(bg, background.params), background.seed || 1);
    } catch (e) {
      ctx.fillStyle = '#300';
      ctx.fillRect(0, 0, width, height);
      console.error(`background ${bg.id} failed`, e);
    }
  }
  ctx.restore();
}

/** Lines of a text layer with their widths, measured in the layer's font. */
function layout(ctx, layer) {
  const text = layer.upper ? String(layer.text).toUpperCase() : String(layer.text);
  const lines = text.split('\n');
  ctx.font = fontCss(layer, layer.size);
  const spacing = Number(layer.letterSpacing) || 0;
  const widths = lines.map(line => {
    if (!spacing) return ctx.measureText(line).width;
    let w = 0;
    for (const ch of line) w += ctx.measureText(ch).width;
    return w + spacing * Math.max(0, [...line].length - 1);
  });
  const lh = layer.size * (Number(layer.lineHeight) || 1.1);
  return { lines, widths, width: Math.max(1, ...widths), height: lh * lines.length, lh, spacing };
}

function drawLines(ctx, layer, lay, method, dx = 0, dy = 0) {
  const n = lay.lines.length;
  lay.lines.forEach((line, i) => {
    const y = dy + (i - (n - 1) / 2) * lay.lh;
    const w = lay.widths[i];
    let x = dx;
    if (layer.align === 'center') x -= w / 2;
    else if (layer.align === 'right') x -= w;
    ctx.textAlign = 'left';
    if (!lay.spacing) {
      ctx[method](line, x, y);
      return;
    }
    for (const ch of line) {
      ctx[method](ch, x, y);
      x += ctx.measureText(ch).width + lay.spacing;
    }
  });
}

/** Where a text layer's box sits, relative to its x, y (before rotation). */
function textBox(layer, lay) {
  const left = layer.align === 'center' ? -lay.width / 2 : layer.align === 'right' ? -lay.width : 0;
  return { left, top: -lay.height / 2, width: lay.width, height: lay.height };
}

function fillStyle(ctx, fill, box) {
  if (!fill || fill.type !== 'gradient' || !fill.stops || fill.stops.length < 2) return colour(fill && fill.color, '#FFFFFF');
  const a = ((Number(fill.angle) || 0) * Math.PI) / 180;
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const half = (Math.abs(dx) * box.width + Math.abs(dy) * box.height) / 2;
  const g = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
  for (const stop of [...fill.stops].sort((p, q) => p.at - q.at)) g.addColorStop(Math.min(1, Math.max(0, Number(stop.at))), colour(stop.color));
  return g;
}

function layerTransform(ctx, layer, s) {
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.translate(layer.x, layer.y);
  ctx.rotate(((Number(layer.rotation) || 0) * Math.PI) / 180);
}

function drawText(ctx, layer, width, height, s) {
  const o = document.createElement('canvas');
  o.width = width;
  o.height = height;
  const t = o.getContext('2d');
  layerTransform(t, layer, s);
  const skew = Math.tan(((Number(layer.skew) || 0) * Math.PI) / 180);
  if (skew) t.transform(1, 0, -skew, 1, 0, 0);
  const lay = layout(t, layer);
  const box = textBox(layer, lay);
  t.font = fontCss(layer, layer.size);
  t.textBaseline = 'middle';
  t.lineJoin = 'round';
  t.miterLimit = 2;
  const outline = layer.outline && Number(layer.outline.width) > 0 ? layer.outline : null;

  if (layer.extrude && Number(layer.extrude.depth) > 0) {
    const e = layer.extrude;
    const depth = Math.round(Number(e.depth));
    const a = ((Number(e.angle) || 0) * Math.PI) / 180;
    const base = e.color || null;
    for (let i = depth; i >= 1; i--) {
      const k = i / depth;
      t.fillStyle = base ? darken(base, (Number(e.shade) || 0) * k) : darken(baseFillColour(layer.fill), 0.45 + (Number(e.shade) || 0) * 0.45 * k);
      const dx = Math.cos(a) * i;
      const dy = Math.sin(a) * i;
      if (outline) {
        t.strokeStyle = colour(outline.color, '#000000');
        t.lineWidth = Number(outline.width) * 2;
        drawLines(t, layer, lay, 'strokeText', dx, dy);
      }
      drawLines(t, layer, lay, 'fillText', dx, dy);
    }
  }
  if (outline) {
    t.strokeStyle = colour(outline.color, '#000000');
    t.lineWidth = Number(outline.width) * 2;
    drawLines(t, layer, lay, 'strokeText');
  }
  t.fillStyle = fillStyle(t, layer.fill, box);
  drawLines(t, layer, lay, 'fillText');

  if (layer.bevel && Number(layer.bevel.strength) > 0) {
    const b = layer.bevel;
    const size = Math.max(0.5, Number(b.size) || 1);
    for (const [tone, sign] of [[b.light || '#FFFFFF', 1], [b.dark || '#000000', -1]]) {
      const rim = document.createElement('canvas');
      rim.width = width;
      rim.height = height;
      const r = rim.getContext('2d');
      r.setTransform(t.getTransform());
      r.font = t.font;
      r.textBaseline = 'middle';
      r.fillStyle = colour(tone);
      drawLines(r, layer, lay, 'fillText');
      r.globalCompositeOperation = 'destination-out';
      r.fillStyle = '#000';
      drawLines(r, layer, lay, 'fillText', sign * size, sign * size);
      t.save();
      t.setTransform(1, 0, 0, 1, 0, 0);
      t.globalAlpha = Math.min(1, Number(b.strength));
      t.globalCompositeOperation = 'source-atop';
      t.drawImage(rim, 0, 0);
      t.restore();
    }
  }

  composite(ctx, o, layer, s);
  return { ...box, skew };
}

/** Draws a layer's offscreen image onto the banner with its glow, drop shadow and opacity. */
function composite(ctx, o, layer, s) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = Math.min(1, Math.max(0, Number(layer.opacity ?? 1)));
  if (layer.glow && Number(layer.glow.blur) > 0) {
    ctx.shadowColor = colour(layer.glow.color, '#FFFFFF');
    ctx.shadowBlur = Number(layer.glow.blur) * s;
    for (let i = 0; i < Math.max(1, Math.min(3, Number(layer.glow.strength) || 1)); i++) ctx.drawImage(o, 0, 0);
  }
  if (layer.shadow) {
    ctx.shadowColor = colour(layer.shadow.color, '#000000');
    ctx.shadowBlur = (Number(layer.shadow.blur) || 0) * s;
    ctx.shadowOffsetX = (Number(layer.shadow.x) || 0) * s;
    ctx.shadowOffsetY = (Number(layer.shadow.y) || 0) * s;
    ctx.drawImage(o, 0, 0);
  }
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.drawImage(o, 0, 0);
  ctx.restore();
}

// ---------------------------------------------------------------- shapes

export const SHAPE_KINDS = [
  ['rect', 'Rectangle'],
  ['ellipse', 'Ellipse or circle'],
  ['line', 'Line'],
  ['arrow', 'Arrow'],
  ['triangle', 'Triangle'],
  ['polygon', 'Regular polygon'],
  ['star', 'Star or burst'],
  ['path', 'Free polygon'],
];

export function shapeLayer(props = {}) {
  return {
    id: layerId('shape'),
    type: 'shape',
    name: 'Shape',
    visible: true,
    locked: false,
    x: DEFAULT_SIZE.width / 2,
    y: DEFAULT_SIZE.height / 2,
    rotation: 0,
    opacity: 1,
    shape: 'rect',
    w: 120,
    h: 60,
    radius: 0,
    sides: 6,
    points: 5,
    inner: 0.5,
    path: [],
    closed: true,
    fill: { type: 'solid', color: '#1D4E7A' },
    stroke: { color: '#FFFFFF', width: 2, dash: 'solid' },
    pixel: false,
    shadow: null,
    glow: null,
    ...props,
  };
}

/** Whether a shape is drawn as an open line (no fill). */
export function isOpenShape(layer) {
  return layer.shape === 'line' || layer.shape === 'arrow' || (layer.shape === 'path' && !layer.closed);
}

/** The shape's outline as a list of points in its own coordinates, or null for ellipses and rounded boxes. */
function shapePoints(layer) {
  const w = Number(layer.w) || 1;
  const h = Number(layer.h) || 1;
  switch (layer.shape) {
    case 'line':
    case 'arrow':
      return [[-w / 2, 0], [w / 2, 0]];
    case 'triangle':
      return [[0, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
    case 'polygon': {
      const n = Math.max(3, Math.min(12, Math.round(Number(layer.sides) || 6)));
      return Array.from({ length: n }, (_, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        return [(Math.cos(a) * w) / 2, (Math.sin(a) * h) / 2];
      });
    }
    case 'star': {
      const n = Math.max(3, Math.min(40, Math.round(Number(layer.points) || 5)));
      const inner = Math.max(0.05, Math.min(0.98, Number(layer.inner) || 0.5));
      return Array.from({ length: n * 2 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / n;
        const r = i % 2 ? inner : 1;
        return [(Math.cos(a) * w * r) / 2, (Math.sin(a) * h * r) / 2];
      });
    }
    case 'path':
      return (layer.path || []).map(p => [Number(p[0]) || 0, Number(p[1]) || 0]);
    default:
      return null;
  }
}

/** The box a shape covers in its own coordinates, for handles and hit testing. */
export function shapeBox(layer) {
  if (layer.shape === 'path') {
    const pts = shapePoints(layer);
    if (!pts.length) return { left: -8, top: -8, width: 16, height: 16, skew: 0 };
    const xs = pts.map(p => p[0]);
    const ys = pts.map(p => p[1]);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    return { left, top, width: Math.max(4, Math.max(...xs) - left), height: Math.max(4, Math.max(...ys) - top), skew: 0 };
  }
  const w = Number(layer.w) || 1;
  let h = Number(layer.h) || 1;
  if (layer.shape === 'line') h = Math.max(6, Number(layer.stroke && layer.stroke.width) || 1);
  if (layer.shape === 'arrow') h = Math.max(10, (Number(layer.stroke && layer.stroke.width) || 1) * 4);
  return { left: -w / 2, top: -h / 2, width: w, height: h, skew: 0 };
}

function tracePath(t, layer) {
  const w = Number(layer.w) || 1;
  const h = Number(layer.h) || 1;
  t.beginPath();
  if (layer.shape === 'ellipse') {
    t.ellipse(0, 0, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
    return;
  }
  if (layer.shape === 'rect') {
    const r = Math.max(0, Math.min(Number(layer.radius) || 0, Math.abs(w) / 2, Math.abs(h) / 2));
    if (r && t.roundRect) t.roundRect(-w / 2, -h / 2, w, h, r);
    else t.rect(-w / 2, -h / 2, w, h);
    return;
  }
  const pts = shapePoints(layer) || [];
  pts.forEach(([x, y], i) => (i ? t.lineTo(x, y) : t.moveTo(x, y)));
  if (!isOpenShape(layer) && pts.length > 2) t.closePath();
}

function dashFor(stroke) {
  const w = Math.max(1, Number(stroke.width) || 1);
  if (stroke.dash === 'dashed') return [w * 4, w * 3];
  if (stroke.dash === 'dotted') return [w, w * 2];
  return [];
}

/** Hard edges for the pixel option: every pixel either fully drawn or not at all. */
function hardenAlpha(canvas, threshold = 128) {
  const c = canvas.getContext('2d');
  const img = c.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] === 0) continue;
    // Used on coverage masks: a pixel covered at least this much is in, anything less is out.
    d[i] = d[i] >= threshold ? 255 : 0;
  }
  c.putImageData(img, 0, 0);
}

/**
 * Paints one part of a shape (its fill or its line). The part's coverage is drawn as a mask; for pixel edges
 * the mask is made hard (each pixel fully in or out), then the paint (colour or gradient, with its own
 * transparency) is laid through the mask.
 */
function paintPart(o, layer, s, coverage, paint, threshold = 128) {
  const { width, height } = o;
  const mask = document.createElement('canvas');
  mask.width = width;
  mask.height = height;
  const m = mask.getContext('2d');
  layerTransform(m, layer, s);
  coverage(m);
  if (layer.pixel) hardenAlpha(mask, threshold);
  const part = document.createElement('canvas');
  part.width = width;
  part.height = height;
  const p = part.getContext('2d');
  layerTransform(p, layer, s);
  p.fillStyle = paint(p);
  const big = (width + height) / s + 4096;
  p.fillRect(-big, -big, big * 2, big * 2);
  p.setTransform(1, 0, 0, 1, 0, 0);
  p.globalCompositeOperation = 'destination-in';
  p.drawImage(mask, 0, 0);
  o.getContext('2d').drawImage(part, 0, 0);
}

function drawShape(ctx, layer, width, height, s) {
  const o = document.createElement('canvas');
  o.width = width;
  o.height = height;
  const box = shapeBox(layer);
  const stroke = layer.stroke && Number(layer.stroke.width) > 0 ? layer.stroke : null;
  if (layer.fill && !isOpenShape(layer)) {
    paintPart(o, layer, s, m => {
      tracePath(m, layer);
      m.fillStyle = '#000';
      m.fill();
    }, p => fillStyle(p, layer.fill, box));
  }
  if (stroke) {
    paintPart(o, layer, s, m => {
      m.lineJoin = layer.pixel ? 'miter' : 'round';
      m.lineCap = stroke.dash === 'dotted' ? 'round' : layer.pixel ? 'butt' : 'round';
      m.strokeStyle = '#000';
      // At least one rendered pixel wide, so thin lines survive the pixel look.
      m.lineWidth = Math.max(Number(stroke.width), layer.pixel ? 1 / s : 0);
      m.setLineDash(dashFor(stroke));
      tracePath(m, layer);
      m.stroke();
      if (layer.shape === 'arrow') {
        const head = Math.max(6, Number(stroke.width) * 3.5);
        const end = Number(layer.w) / 2;
        m.setLineDash([]);
        m.beginPath();
        m.moveTo(end + Number(stroke.width), 0);
        m.lineTo(end - head, -head * 0.7);
        m.lineTo(end - head, head * 0.7);
        m.closePath();
        m.fillStyle = '#000';
        m.fill();
      }
      // Thin lines keep any pixel they touch a fair amount, so a 1 px ring stays unbroken.
    }, () => colour(stroke.color, '#FFFFFF'), 48);
  }
  composite(ctx, o, layer, s);
  return box;
}

function drawSprite(ctx, layer, image, s) {
  const scale = Number(layer.scale) || 1;
  const w = image ? image.width * scale : 32 * scale;
  const h = image ? image.height * scale : 32 * scale;
  ctx.save();
  layerTransform(ctx, layer, s);
  ctx.globalAlpha = Math.min(1, Math.max(0, Number(layer.opacity ?? 1)));
  ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
  ctx.imageSmoothingEnabled = !!layer.smooth;
  if (layer.shadow) {
    ctx.shadowColor = colour(layer.shadow.color, '#000000');
    ctx.shadowBlur = (Number(layer.shadow.blur) || 0) * s;
    ctx.shadowOffsetX = (Number(layer.shadow.x) || 0) * s;
    ctx.shadowOffsetY = (Number(layer.shadow.y) || 0) * s;
  }
  if (image) {
    ctx.drawImage(image, -w / 2, -h / 2, w, h);
  } else {
    ctx.strokeStyle = '#FF5F56';
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
  }
  ctx.restore();
  return { left: -w / 2, top: -h / 2, width: w, height: h, skew: 0 };
}

/**
 * Draws a design. Returns { canvas, boxes } where canvas is width x height (scaled up from the pixel look) and
 * boxes maps layer ids to { x, y, rotation, left, top, width, height } in banner pixels, for hit testing.
 */
export function renderDesign(design, assets, { only = null } = {}) {
  const p = design.pixel || 1;
  const rw = Math.max(1, Math.round(design.width / p));
  const rh = Math.max(1, Math.round(design.height / p));
  const s = rw / design.width;
  const work = document.createElement('canvas');
  work.width = rw;
  work.height = rh;
  const ctx = work.getContext('2d');
  drawBackground(ctx, design.background, rw, rh, assets.background);
  const boxes = new Map();
  for (const layer of design.layers) {
    if (!layer.visible || (only && !only.has(layer.id))) continue;
    let box;
    if (layer.type === 'text') box = drawText(ctx, layer, rw, rh, s);
    else if (layer.type === 'shape') box = drawShape(ctx, layer, rw, rh, s);
    else box = drawSprite(ctx, layer, assets.sprites.get(layer.id), s);
    boxes.set(layer.id, { x: layer.x, y: layer.y, rotation: Number(layer.rotation) || 0, ...box });
  }
  if (p === 1) return { canvas: work, boxes };
  const out = document.createElement('canvas');
  out.width = design.width;
  out.height = design.height;
  const o = out.getContext('2d');
  o.imageSmoothingEnabled = false;
  o.drawImage(work, 0, 0, design.width, design.height);
  return { canvas: out, boxes };
}

/** Loads what a background draws with, if it has a preload(). Never rejects. */
export function preloadBackground(def) {
  if (!def || typeof def.preload !== 'function') return Promise.resolve();
  try {
    return Promise.resolve(def.preload()).catch(e => console.warn(`background ${def.id}: could not load its art`, e));
  } catch (e) {
    console.warn(`background ${def.id}: could not load its art`, e);
    return Promise.resolve();
  }
}

/** A background on its own, small, for the picker. One with a preload() redraws itself once its files are in. */
export function backgroundThumb(background, width = 132, height = 34) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  drawBackground(c.getContext('2d'), background, width, height, null);
  const def = background.type === 'procedural' ? getBackground(background.id) : null;
  if (def && typeof def.preload === 'function' && !(def.ready && def.ready())) {
    preloadBackground(def).then(() => drawBackground(c.getContext('2d'), background, width, height, null));
  }
  return c;
}

/** The attribution credit of a design's background (its `credit`), or ''. */
export function backgroundCredit(background) {
  if (!background || background.type !== 'procedural') return '';
  const def = getBackground(background.id);
  return def && def.id === background.id && def.credit ? def.credit : '';
}

/** The PNG bytes of a rendered design. */
export function canvasToPng(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async blob => {
      if (!blob) {
        reject(new Error('could not make the PNG'));
        return;
      }
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, 'image/png');
  });
}
