// Burlap or canvas: a coarse over-and-under weave of threads with uneven thickness (slubs), loose fibres and the
// gaps between threads.
import { PIXEL, paint, hex, mix, ramp, makeNoise, hash, num, BLACK, WHITE } from '../_kit.js';
import { GROUP, LIGHT, VIGNETTE, light, tones } from './_mat.js';

export default {
  id: 'mat-burlap',
  name: 'Burlap and canvas',
  group: GROUP,
  tags: ['material', 'colony', 'military'],
  params: [
    { key: 'thread', label: 'Threads', type: 'color', default: '#A8875A' },
    { key: 'gap', label: 'Gaps', type: 'color', default: '#3A2A18' },
    { key: 'size', label: 'Weave size', type: 'range', min: 3, max: 8, step: 1, default: 4 },
    { key: 'coarse', label: 'Coarseness', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
    LIGHT,
    VIGNETTE,
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const thread = hex(p.thread);
      const gap = hex(p.gap);
      const ck = num(p.coarse, 0.5);
      const n = makeNoise(seed);
      const s = Math.max(3, Math.round(num(p.size, 4) * Math.max(1, g.u * 0.8)));
      const t = tones(thread, 4, 0.35);
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          const i = Math.floor(x / s);
          const j = Math.floor(y / s);
          const u = ((x % s) + 0.5) / s;
          const v = ((y % s) + 0.5) / s;
          const over = (i + j) % 2 === 0;
          // Each cell is one thread bump: rounded across the thread, a little darker where it dives under; the
          // holes sit where four bumps meet.
          const slub = over ? n(x * 0.08, j * 3.1) * ck : n(i * 3.1, y * 0.08) * ck;
          const across = over ? v : u;
          const along = over ? u : v;
          let c;
          if (u < 1 / s && v < 1 / s) c = gap;
          else {
            const shade = Math.sin(across * Math.PI) * (0.55 + slub * 0.4) + Math.sin(along * Math.PI) * 0.25 - 0.05;
            c = ramp(t, shade + (hash(x, y, seed) - 0.5) * 0.4 * ck, x, y);
          }
          g.set(x, y, c);
        }
      }
      // Loose fibres.
      for (let i = 0, k = g.w * 0.15 * ck; i < k; i++) {
        const x = hash(i, 1, seed) * g.w;
        const y = hash(i, 2, seed) * g.h;
        const a = hash(i, 3, seed) * Math.PI;
        const len = (3 + hash(i, 4, seed) * 6) * g.u;
        g.line(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, mix(thread, WHITE, 0.2), 0.5);
      }
      void BLACK;
      light(g, p);
    });
  },
};
