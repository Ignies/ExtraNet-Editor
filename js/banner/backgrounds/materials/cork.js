// Cork: granules of several browns packed together, with darker pits and a few lighter flecks.
import { PIXEL, paint, hex, mix, ramp, makeNoise, hash, num, BLACK, WHITE } from '../_kit.js';
import { GROUP, LIGHT, VIGNETTE, light } from './_mat.js';

export default {
  id: 'mat-cork',
  name: 'Cork',
  group: GROUP,
  tags: ['material', 'board', 'colony'],
  params: [
    { key: 'cork', label: 'Cork', type: 'color', default: '#B4844E' },
    { key: 'dark', label: 'Pits', type: 'color', default: '#5A3A1E' },
    { key: 'size', label: 'Granule size', type: 'range', min: 0.5, max: 3, step: 0.05, default: 1 },
    { key: 'pits', label: 'Pits', type: 'range', min: 0, max: 1, step: 0.05, default: 0.4 },
    LIGHT,
    VIGNETTE,
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const cork = hex(p.cork);
      const dark = hex(p.dark);
      const pk = num(p.pits, 0.4);
      const n = makeNoise(seed);
      const s = 0.6 / (g.u * num(p.size, 1));
      const t = [mix(cork, dark, 0.55), mix(cork, dark, 0.25), cork, mix(cork, WHITE, 0.15)];
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          // Granules: cells of noise quantised so each has its own tone.
          const a = n(x * s, y * s);
          const cell = Math.floor(a * 6);
          let v = (cell / 5) * 0.7 + 0.2 + (hash(x, y, seed) - 0.5) * 0.3;
          if (n(x * s * 2.3 + 50, y * s * 2.3) < 0.18 * pk) v = 0;
          let c = ramp(t, v, x, y);
          if (hash(y, x, seed + 1) < 0.01) c = mix(cork, WHITE, 0.35);
          g.set(x, y, c);
        }
      }
      void BLACK;
      light(g, p);
    });
  },
};
