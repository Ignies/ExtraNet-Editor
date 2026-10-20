// Diamond plate: a tread plate of raised lozenges in alternating directions, each with a lit and a shaded side, on
// worn, grimy metal.
import { PIXEL, paint, hex, mix, ramp, makeNoise, fbm, num, WHITE, BLACK } from '../_kit.js';
import { GROUP, LIGHT, VIGNETTE, light, tones } from './_mat.js';

export default {
  id: 'mat-diamond-plate',
  name: 'Diamond plate',
  group: GROUP,
  tags: ['material', 'industrial', 'military'],
  params: [
    { key: 'metal', label: 'Metal', type: 'color', default: '#7C838C' },
    { key: 'grime', label: 'Grime', type: 'color', default: '#2A2622' },
    { key: 'size', label: 'Pattern size', type: 'range', min: 0.5, max: 2, step: 0.05, default: 1 },
    { key: 'wear', label: 'Wear', type: 'range', min: 0, max: 1, step: 0.05, default: 0.35 },
    LIGHT,
    VIGNETTE,
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const metal = hex(p.metal);
      const grime = hex(p.grime);
      const wear = num(p.wear, 0.35);
      const n = makeNoise(seed);
      const t = tones(metal, 4, 0.45);
      const cell = Math.max(6, Math.round(12 * g.u * num(p.size, 1)));
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          const ci = Math.floor(x / cell);
          const cj = Math.floor(y / cell);
          const u = (x % cell) / cell - 0.5;
          const v = (y % cell) / cell - 0.5;
          // Each cell holds one lozenge, turned one way or the other in a checker.
          const flip = (ci + cj) % 2 === 0;
          const a = flip ? u + v : u - v;
          const b = flip ? u - v : u + v;
          // A raised bar: lit on the side facing up-left, shaded on the other, with a thin shadow beside it.
          let k = 0.42 + (n(x * 0.15, y * 0.15) - 0.5) * 0.15;
          if (Math.abs(a) < 0.4 && Math.abs(b) < 0.16) k = b < 0 ? 1 : b < 0.06 ? 0.7 : 0.18;
          else if (Math.abs(a) < 0.44 && b > 0 && b < 0.24) k = 0.2;
          let c = ramp(t, k, x, y);
          const gm = fbm(n, x * 0.04 / g.u, y * 0.04 / g.u, 3);
          if (gm > 1 - wear * 0.5) c = ramp([c, mix(c, grime, 0.5), grime], (gm - (1 - wear * 0.5)) * 6, x, y);
          g.set(x, y, c);
        }
      }
      void WHITE;
      void BLACK;
      light(g, p);
    });
  },
};
