// A brick wall: running bond with per-brick colour, lit top edges, recessed mortar, speckle and grime that
// gathers towards the bottom with drips.
import { PIXEL, paint, hex, mix, ramp, makeNoise, fbm, hash, num, clamp, BLACK, WHITE } from './_kit.js';

export default {
  id: 'brick',
  name: 'Brick wall',
  tags: ['colony', 'street'],
  params: [
    { key: 'brick', label: 'Brick', type: 'color', default: '#8A3B2A' },
    { key: 'mortar', label: 'Mortar', type: 'color', default: '#4A443E' },
    { key: 'grime', label: 'Grime', type: 'color', default: '#17120F' },
    { key: 'dirt', label: 'Dirt', type: 'range', min: 0, max: 1, step: 0.05, default: 0.45 },
    { key: 'size', label: 'Brick size', type: 'range', min: 0.5, max: 2, step: 0.05, default: 1 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const brick = hex(p.brick);
      const mortar = hex(p.mortar);
      const grime = hex(p.grime);
      const dirt = num(p.dirt, 0.45);
      const n = makeNoise(seed);
      const bh = Math.max(3, Math.round(8 * g.u * num(p.size, 1)));
      const bw = Math.round(bh * 2.75);
      const sc = 4 / g.h;
      const drips = new Float32Array(g.w);
      for (let x = 0; x < g.w; x++) drips[x] = hash(x >> 1, 0, seed) < 0.08 ? hash(x >> 1, 1, seed) : 0;
      for (let y = 0; y < g.h; y++) {
        const row = Math.floor(y / bh);
        const ry = y % bh;
        const shift = row % 2 ? Math.floor(bw / 2) : 0;
        for (let x = 0; x < g.w; x++) {
          const col = Math.floor((x + shift) / bw);
          const rx = (x + shift) % bw;
          let c;
          if (ry === bh - 1 || rx === bw - 1) {
            c = ramp([mix(mortar, BLACK, 0.3), mortar], hash(x, y, seed), x, y);
          } else {
            const tone = hash(col, row, seed) - 0.5;
            const base = tone > 0 ? mix(brick, WHITE, tone * 0.18) : mix(brick, BLACK, -tone * 0.35);
            const tones = [mix(base, BLACK, 0.3), base, mix(base, WHITE, 0.15)];
            let v = 0.5 + (hash(x, y, seed + 2) - 0.5) * 0.5;
            if (ry === 0) v += 0.4;
            if (rx === 0) v += 0.2;
            if (ry === bh - 2) v -= 0.35;
            c = ramp(tones, v, x, y);
          }
          const gm = fbm(n, x * sc, y * sc, 4) * 0.8 + (y / g.h) * 0.45 + drips[x] * (y / g.h) * 0.8;
          const a = clamp((gm - 0.75 + dirt * 0.55) * 1.6) * dirt;
          if (a > 0) c = ramp([c, mix(c, grime, 0.5), grime], a, x, y);
          g.set(x, y, c);
        }
      }
      g.vignette(BLACK, 0.45);
    });
  },
};
