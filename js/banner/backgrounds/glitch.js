// Deep-web glitch: a dark corrupted screen with RGB-split slabs, displaced rows, blocky compression artefacts,
// noise blocks and hairline streaks.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, fbm, hash, num, BLACK, WHITE } from './_kit.js';

export default {
  id: 'glitch',
  name: 'Deep-web glitch',
  tags: ['deep', 'cult'],
  params: [
    { key: 'bg', label: 'Background', type: 'color', default: '#09070D' },
    { key: 'a', label: 'Red channel', type: 'color', default: '#FF2A6D' },
    { key: 'b', label: 'Cyan channel', type: 'color', default: '#05D9E8' },
    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 1, step: 0.05, default: 0.55 },
    { key: 'blocks', label: 'Block size', type: 'range', min: 0.3, max: 2, step: 0.05, default: 1 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const bg = hex(p.bg);
      const ca = hex(p.a);
      const cb = hex(p.b);
      const k = num(p.intensity, 0.55);
      const bs = num(p.blocks, 1);
      const r = rng(seed);
      const n = makeNoise(seed);
      const tones = [mix(bg, BLACK, 0.4), bg, mix(bg, WHITE, 0.05), mix(bg, mix(ca, cb, 0.5), 0.12)];
      const sc = 3 / g.h;
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) g.set(x, y, ramp(tones, fbm(n, x * sc * 0.4, y * sc * 3, 3) * 1.4 - 0.25, x, y));
      // Compression artefacts: 8x8 blocks flattened to one tone.
      const q = Math.max(4, Math.round(8 * g.u * bs));
      for (let by = 0; by < g.h; by += q) {
        for (let bx = 0; bx < g.w; bx += q) {
          if (hash(bx, by, seed) > k * 0.25) continue;
          const c = ramp([bg, mix(bg, ca, 0.35), mix(bg, cb, 0.35), mix(bg, WHITE, 0.15)], hash(by, bx, seed), bx, by);
          g.rect(bx, by, q, q, c);
          if (hash(bx, by, seed + 1) < 0.5) g.rect(bx, by, q, 1, mix(c, WHITE, 0.2));
        }
      }
      // RGB-split slabs: the same bar in both channels, offset, white where they overlap.
      const slabs = Math.round(2 + k * 10 * (g.w / g.h) / 4);
      for (let i = 0; i < slabs; i++) {
        const y = Math.floor(r() * g.h);
        const h = Math.max(1, Math.floor((1 + r() * 6) * g.u * bs));
        const x = Math.floor(r() * g.w * 1.1 - g.w * 0.1);
        const w = Math.floor((10 + r() * 80) * g.u * bs);
        const off = Math.max(1, Math.round((1 + r() * 3) * g.u));
        const al = 0.45 + r() * 0.5;
        g.rect(x - off, y, w, h, ca, al);
        g.rect(x + off, y, w, h, cb, al);
        g.rect(x + off, y, w - 2 * off, h, mix(mix(ca, cb, 0.5), WHITE, 0.6), al * 0.7);
      }
      // Displaced rows: copy a strip of pixels sideways.
      const rows = Math.round(k * g.h * 0.3);
      for (let i = 0; i < rows; i++) {
        const y = Math.floor(r() * g.h);
        const sh = Math.floor((r() - 0.5) * 30 * g.u);
        const x0 = Math.floor(r() * g.w);
        const len = Math.floor(r() * g.w * 0.5);
        const copy = [];
        for (let x = x0; x < x0 + len; x++) copy.push(g.get(x, y));
        copy.forEach((c, j) => g.set(x0 + j + sh, y, c));
      }
      // Noise blocks.
      const nb = Math.round(k * 6);
      for (let i = 0; i < nb; i++) {
        const x = Math.floor(r() * g.w);
        const y = Math.floor(r() * g.h);
        const w = Math.floor((6 + r() * 30) * g.u * bs);
        const h = Math.floor((2 + r() * 8) * g.u * bs);
        const pal = [ca, cb, WHITE, bg, bg];
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (hash(xx, yy, seed + 2) < 0.6) g.set(xx, yy, pal[Math.floor(hash(yy, xx, seed + 3) * pal.length)]);
      }
      // Hairline streaks across the whole width.
      for (let i = 0, c = 1 + k * 4; i < c; i++) {
        const y = Math.floor(r() * g.h);
        const col = r() < 0.5 ? ca : cb;
        for (let x = 0; x < g.w; x++) if (hash(x >> 2, y, seed + 4) < 0.8) g.blend(x, y, col, 0.6);
      }
      g.scanlines(0.25, 2);
      g.vignette(BLACK, 0.5);
    });
  },
};
