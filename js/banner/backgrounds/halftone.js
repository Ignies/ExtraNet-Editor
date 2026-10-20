// Newsprint halftone: two rotated dot screens (ink and a spot colour) over grainy paper, with tone running across
// the banner or in blobs, and a faint fold.
import { PIXEL, paint, hex, mix, rng, makeNoise, fbm, hash, num, clamp, BLACK } from './_kit.js';

function screen(x, y, angle, cell) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const u = (x * c + y * s) / cell;
  const v = (-x * s + y * c) / cell;
  const fu = u - Math.floor(u) - 0.5;
  const fv = v - Math.floor(v) - 0.5;
  return Math.sqrt(fu * fu + fv * fv);
}

export default {
  id: 'halftone',
  name: 'Newspaper halftone',
  tags: ['tabloid', 'print'],
  params: [
    { key: 'paper', label: 'Paper', type: 'color', default: '#EFE7D4' },
    { key: 'ink', label: 'Ink', type: 'color', default: '#1D1C21' },
    { key: 'spot', label: 'Spot colour', type: 'color', default: '#D8312B' },
    { key: 'size', label: 'Dot size', type: 'range', min: 0.5, max: 2.5, step: 0.05, default: 1 },
    { key: 'tone', label: 'Tone', type: 'select', default: 'fade', options: [['fade', 'Fades left to right'], ['blobs', 'Blobs'], ['burst', 'Burst']] },
    { key: 'amount', label: 'Ink amount', type: 'range', min: 0, max: 1, step: 0.05, default: 0.4 },
    { key: 'spotAmount', label: 'Spot amount', type: 'range', min: 0, max: 1, step: 0.05, default: 0.25 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const paper = hex(p.paper);
      const ink = hex(p.ink);
      const spot = hex(p.spot);
      const r = rng(seed);
      const n = makeNoise(seed);
      const cell = Math.max(4, 7 * g.u * num(p.size, 1));
      const amount = num(p.amount, 0.5);
      const spotAmount = num(p.spotAmount, 0.35);
      const bx = g.w * (0.6 + r() * 0.3);
      const by = g.h * (0.3 + r() * 0.4);
      const fold = Math.round(g.w * (0.3 + r() * 0.4));
      const sc = 3 / g.h;
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          let t;
          let ts;
          if (p.tone === 'blobs') {
            t = fbm(n, x * sc, y * sc, 3) * 1.6 - 0.45;
            ts = fbm(n, x * sc + 30, y * sc, 3) * 1.6 - 0.5;
          } else if (p.tone === 'burst') {
            const d = Math.hypot((x - bx) / g.w, (y - by) / g.h * 0.35);
            t = 1 - d * 1.8;
            ts = 1 - d * 2.6;
          } else {
            t = (x / g.w - 0.35) * 1.6;
            ts = (0.5 - x / g.w) * 1.6 + (fbm(n, x * sc, y * sc, 2) - 0.5) * 0.6;
          }
          t = clamp(t) * amount;
          ts = clamp(ts) * spotAmount;
          let c = paper;
          if (hash(x, y, seed) < 0.06) c = mix(paper, BLACK, 0.07);
          if (screen(x, y, 0.26, cell * 1.05) < Math.sqrt(ts) * 0.62) c = mix(c, spot, 0.9);
          if (screen(x, y, Math.PI / 4, cell) < Math.sqrt(t) * 0.62) c = ink;
          if (x === fold) c = mix(c, BLACK, 0.12);
          if (x === fold + 1) c = mix(c, paper, 0.5);
          g.set(x, y, c);
        }
      }
    });
  },
};
