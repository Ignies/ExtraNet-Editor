// Shared pixel-art toolkit for the procedural banner backgrounds. Not a background itself (it is not listed in
// index.js).
//
// The game's hand-made site banners are drawn on a half-size grid (264x68 for a 528x136 banner) and scaled up 2x
// without smoothing, with ordered (Bayer) dithering between a few ramp colours. paint() does the same: it gives a
// background a low resolution Grid to fill pixel by pixel, then scales it up to the canvas without smoothing.
//
// Sizes inside a background are in grid pixels and relative to the grid's height (grid.u is 1 on a 68 pixel tall
// grid), so a background looks the same at any banner size, in the studio's pixel look, and as a tiny thumbnail.

/**
 * The same seeded generator as rng() in index.js (mulberry32), kept here so this file does not import index.js:
 * index.js imports every background, and a cycle back to it would break when a background is loaded on its own.
 */
export function rng(seed) {
  let a = (Number(seed) || 1) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The standard "Pixel size" control: grid pixels per banner pixel on a 136 pixel tall banner. */
export const PIXEL = { key: 'pixel', label: 'Pixel size', type: 'range', min: 1, max: 4, step: 1, default: 2 };

// -- Colour --------------------------------------------------------------------------------------------------------

const hexCache = new Map();

/** '#RRGGBB' (or '#RGB', '#RRGGBBAA') to [r, g, b]. */
export function hex(c) {
  let v = hexCache.get(c);
  if (v) return v;
  let s = String(c || '#000000').replace('#', '');
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s.slice(0, 6), 16) || 0;
  v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  if (hexCache.size > 512) hexCache.clear();
  hexCache.set(c, v);
  return v;
}

export function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export const BLACK = [0, 0, 0];
export const WHITE = [255, 255, 255];

export function dark(c, t) {
  return mix(c, BLACK, t);
}

export function light(c, t) {
  return mix(c, WHITE, t);
}

/** Relative brightness 0..1. */
export function luma(c) {
  return (c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114) / 255;
}

// -- Dithering -------------------------------------------------------------------------------------------------------

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

/** The 4x4 ordered dither threshold at a pixel, 0..1. */
export function bayer(x, y) {
  return BAYER[((y & 3) << 2) | (x & 3)];
}

/** A colour from a ramp: v 0..1 runs along the ramp; the step between two ramp colours is dithered. */
export function ramp(colours, v, x, y) {
  const n = colours.length - 1;
  if (v <= 0) return colours[0];
  if (v >= 1) return colours[n];
  const f = v * n;
  const i = Math.floor(f);
  return f - i > bayer(x, y) ? colours[i + 1] : colours[i];
}

/** A ramp of n colours from a to b. */
export function steps(a, b, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(mix(a, b, n === 1 ? 0 : i / (n - 1)));
  return out;
}

// -- Noise -----------------------------------------------------------------------------------------------------------

/** Seeded smooth value noise: noise(x, y) gives 0..1, with features about 1 unit apart. */
export function makeNoise(seed) {
  const r = rng(seed);
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    perm[i] = i;
    vals[i] = r();
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = perm[i];
    perm[i] = perm[j];
    perm[j] = t;
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  return (x, y) => {
    const xf0 = Math.floor(x);
    const yf0 = Math.floor(y);
    const xi = xf0 & 255;
    const yi = yf0 & 255;
    const xf = x - xf0;
    const yf = y - yf0;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = vals[perm[xi + perm[yi]]];
    const b = vals[perm[xi + 1 + perm[yi]]];
    const c = vals[perm[xi + perm[yi + 1]]];
    const d = vals[perm[xi + 1 + perm[yi + 1]]];
    const top = a + (b - a) * u;
    const bot = c + (d - c) * u;
    return top + (bot - top) * v;
  };
}

/** Fractal noise from a noise function: 0..1 (roughly), octaves of halving size. */
export function fbm(noise, x, y, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * f + i * 17.31, y * f - i * 9.17) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

/** A hash of two integers and a seed to 0..1, for per-pixel or per-cell randomness without a running generator. */
export function hash(x, y, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function clamp(v, lo = 0, hi = 1) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function smooth(a, b, v) {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}

export function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// -- The pixel grid --------------------------------------------------------------------------------------------------

export class Grid {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.u = h / 68;
    this.d = new Uint8ClampedArray(w * h * 4);
  }

  fill(c) {
    const d = this.d;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = 255;
    }
  }

  set(x, y, c) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.d[i] = c[0];
    this.d[i + 1] = c[1];
    this.d[i + 2] = c[2];
    this.d[i + 3] = 255;
  }

  get(x, y) {
    x = x < 0 ? 0 : x >= this.w ? this.w - 1 : x | 0;
    y = y < 0 ? 0 : y >= this.h ? this.h - 1 : y | 0;
    const i = (y * this.w + x) * 4;
    return [this.d[i], this.d[i + 1], this.d[i + 2]];
  }

  /** Mixes a colour into a pixel by a (0..1). */
  blend(x, y, c, a) {
    x |= 0;
    y |= 0;
    if (a <= 0 || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    if (a > 1) a = 1;
    const i = (y * this.w + x) * 4;
    const d = this.d;
    d[i] += (c[0] - d[i]) * a;
    d[i + 1] += (c[1] - d[i + 1]) * a;
    d[i + 2] += (c[2] - d[i + 2]) * a;
  }

  /** Sets a pixel when a beats the dither threshold: pixel-art transparency with no new colours. */
  dot(x, y, c, a = 1) {
    if (a >= 1 || a > bayer(x | 0, y | 0)) this.set(x, y, c);
  }

  rect(x, y, w, h, c, a = 1) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w));
    const y1 = Math.min(this.h, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        if (a >= 1) this.set(xx, yy, c);
        else this.blend(xx, yy, c, a);
      }
    }
  }

  /** A dithered rectangle: pixels kept where a beats the threshold. */
  ditherRect(x, y, w, h, c, a) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w));
    const y1 = Math.min(this.h, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.dot(xx, yy, c, a);
  }

  /** A one pixel line (Bresenham). a < 1 blends. */
  line(x0, y0, x1, y1, c, a = 1) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 4096; n++) {
      if (a >= 1) this.set(x0, y0, c);
      else this.blend(x0, y0, c, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** A circle outline (midpoint). */
  circle(cx, cy, r, c, a = 1) {
    cx = Math.round(cx);
    cy = Math.round(cy);
    r = Math.round(r);
    let x = r;
    let y = 0;
    let err = 1 - r;
    const put = (px, py) => (a >= 1 ? this.set(px, py, c) : this.blend(px, py, c, a));
    while (x >= y) {
      put(cx + x, cy + y);
      put(cx + y, cy + x);
      put(cx - y, cy + x);
      put(cx - x, cy + y);
      put(cx - x, cy - y);
      put(cx - y, cy - x);
      if (y !== 0) {
        put(cx + y, cy - x);
        put(cx + x, cy - y);
      }
      y++;
      if (err < 0) err += 2 * y + 1;
      else {
        x--;
        err += 2 * (y - x) + 1;
      }
    }
  }

  disc(cx, cy, r, c, a = 1) {
    const x0 = Math.floor(cx - r);
    const x1 = Math.ceil(cx + r);
    const y0 = Math.floor(cy - r);
    const y1 = Math.ceil(cy + r);
    const r2 = r * r;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) {
          if (a >= 1) this.set(x, y, c);
          else this.blend(x, y, c, a);
        }
      }
    }
  }

  /** A soft round glow, dithered so it stays in a few colours. */
  glow(cx, cy, rx, ry, c, strength = 0.5) {
    const x0 = Math.max(0, Math.floor(cx - rx));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + rx));
    const y0 = Math.max(0, Math.floor(cy - ry));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + ry));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const d = dx * dx + dy * dy;
        if (d < 1) {
          const a = (1 - d) * (1 - d) * strength;
          const q = Math.round(a * 4 + bayer(x, y) - 0.5) / 4;
          if (q > 0) this.blend(x, y, c, q);
        }
      }
    }
  }

  /** Every other row darker, like the hand-made banners' scanlines. */
  scanlines(k = 0.12, every = 2) {
    if (k <= 0) return;
    const d = this.d;
    const m = 1 - k;
    for (let y = every - 1; y < this.h; y += every) {
      for (let x = 0, i = y * this.w * 4; x < this.w; x++, i += 4) {
        d[i] *= m;
        d[i + 1] *= m;
        d[i + 2] *= m;
      }
    }
  }

  /** Darkens (or tints) towards the edges. k is the strength at the corners. */
  vignette(c = BLACK, k = 0.5, power = 2.2) {
    if (k <= 0) return;
    const cx = this.w / 2;
    const cy = this.h / 2;
    for (let y = 0; y < this.h; y++) {
      const ny = (y + 0.5 - cy) / cy;
      for (let x = 0; x < this.w; x++) {
        const nx = (x + 0.5 - cx) / cx;
        const a = k * Math.pow((nx * nx + ny * ny) / 2, power / 2) - 0.04;
        if (a > 0.01) {
          const q = Math.round(a * 6 + bayer(x, y) - 0.5) / 6;
          if (q > 0) this.blend(x, y, c, q);
        }
      }
    }
  }

  /** Sparse single-pixel speckle. */
  speckle(c, density, seed, a = 1) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (hash(x, y, seed) < density) {
          if (a >= 1) this.set(x, y, c);
          else this.blend(x, y, c, a);
        }
      }
    }
  }

  /** Draws text in the tiny 3x5 pixel font. Returns the width drawn. */
  text(x, y, str, c, scale = 1, a = 1) {
    let cx = Math.round(x);
    const s = Math.max(1, Math.round(scale));
    for (const ch of String(str).toUpperCase()) {
      const g = GLYPHS[ch] || GLYPHS[' '];
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 3; col++) {
          if (g[row * 3 + col] === '1') {
            for (let sy = 0; sy < s; sy++) {
              for (let sx = 0; sx < s; sx++) {
                const px = cx + col * s + sx;
                const py = Math.round(y) + row * s + sy;
                if (a >= 1) this.set(px, py, c);
                else this.blend(px, py, c, a);
              }
            }
          }
        }
      }
      cx += 4 * s;
    }
    return cx - Math.round(x);
  }
}

// -- The tiny font ---------------------------------------------------------------------------------------------------

/** A 3x5 pixel font for the little labels some backgrounds draw (dimensions, tape, gauges). */
export const GLYPHS = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
  0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010',
  8: '111101111101111', 9: '111101111001110',
  '-': '000000111000000', '.': '000000000000010', '/': '001001010100100', ':': '000010000010000',
  '#': '101111101111101', '+': '000010111010000', '>': '100010001010100', '<': '001010100010001',
  '=': '000111000111000', '!': '010010010000010', '?': '110001010000010', "'": '010010000000000',
  ' ': '000000000000000',
};

/** A 1-bit strip of text in the tiny font: { w, h: 5, bits } with bits[y * w + x] set for ink. */
export function textStrip(str, gap = 1) {
  const chars = [...String(str).toUpperCase()];
  const w = chars.length * (3 + gap);
  const bits = new Uint8Array(w * 5);
  chars.forEach((ch, i) => {
    const g = GLYPHS[ch] || GLYPHS[' '];
    for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) if (g[row * 3 + col] === '1') bits[row * w + i * (3 + gap) + col] = 1;
  });
  return { w, h: 5, bits };
}

// -- Painting --------------------------------------------------------------------------------------------------------

let surface = null;

function scratch(w, h) {
  if (!surface) surface = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas');
  if (surface.width !== w) surface.width = w;
  if (surface.height !== h) surface.height = h;
  return surface;
}

/** Grid pixels per canvas pixel for a "Pixel size" value at this canvas height. */
export function blockSize(pixel, height) {
  return Math.max(1, Math.round(num(pixel, 2) * height / 136));
}

/** Gives fn a Grid sized for the canvas and the pixel size, then scales it up onto ctx without smoothing. */
export function paint(ctx, width, height, pixel, fn) {
  const block = blockSize(pixel, height);
  const gw = Math.max(1, Math.ceil(width / block));
  const gh = Math.max(1, Math.ceil(height / block));
  const g = new Grid(gw, gh);
  fn(g);
  const s = scratch(gw, gh);
  s.getContext('2d').putImageData(new ImageData(g.d, gw, gh), 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(s, 0, 0, gw, gh, 0, 0, gw * block, gh * block);
}
