// Camouflage in four colours: woodland blobs, blocky digital pixels, or long tiger stripes.
import { PIXEL, paint, hex, makeNoise, fbm, num } from './_kit.js';

export default {
  id: 'camo',
  name: 'Camouflage',
  tags: ['military'],
  params: [
    { key: 'c1', label: 'Base', type: 'color', default: '#5A5F38' },
    { key: 'c2', label: 'Second', type: 'color', default: '#3A4426' },
    { key: 'c3', label: 'Third', type: 'color', default: '#7A6844' },
    { key: 'c4', label: 'Dark', type: 'color', default: '#1E1F18' },
    { key: 'scale', label: 'Scale', type: 'range', min: 0.3, max: 2.5, step: 0.05, default: 1 },
    { key: 'style', label: 'Pattern', type: 'select', default: 'woodland', options: [['woodland', 'Woodland'], ['digital', 'Digital'], ['tiger', 'Tiger stripe']] },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const cols = [hex(p.c1), hex(p.c2), hex(p.c3), hex(p.c4)];
      const n1 = makeNoise(seed);
      const n2 = makeNoise(seed + 11);
      const n3 = makeNoise(seed + 23);
      const s = 3.2 / (g.h * num(p.scale, 1));
      const digital = p.style === 'digital';
      const tiger = p.style === 'tiger';
      const q = Math.max(2, Math.round(3 * g.u * num(p.scale, 1)));
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          let fx = x;
          let fy = y;
          if (digital) {
            fx = Math.floor(x / q) * q;
            fy = Math.floor(y / q) * q;
          }
          const sx = tiger ? s * 0.35 : s;
          const sy = tiger ? s * 2.2 : s;
          const a = fbm(n1, fx * sx, fy * sy, 3);
          const b = fbm(n2, fx * sx * 1.3 + 7, fy * sy * 1.3, 3);
          const c = fbm(n3, fx * sx * 1.7 - 3, fy * sy * 1.7, 3);
          let k = 0;
          if (a > 0.54) k = 1;
          if (b > 0.58) k = 2;
          if (c > 0.6) k = 3;
          g.set(x, y, cols[k]);
        }
      }
    });
  },
};
