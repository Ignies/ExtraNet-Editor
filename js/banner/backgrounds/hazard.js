// Painted hazard stripes on steel: diagonal bands with chipped paint, grime and scratches, bevelled top and bottom.
import { PIXEL, paint, hex, mix, ramp, makeNoise, fbm, hash, num, BLACK, WHITE } from './_kit.js';

export default {
  id: 'hazard-stripes',
  name: 'Hazard stripes',
  tags: ['industrial', 'military'],
  params: [
    { key: 'a', label: 'Paint', type: 'color', default: '#E8B423' },
    { key: 'b', label: 'Stripe', type: 'color', default: '#17150F' },
    { key: 'metal', label: 'Bare metal', type: 'color', default: '#6B6E70' },
    { key: 'width', label: 'Stripe width', type: 'range', min: 0.2, max: 2, step: 0.05, default: 0.7 },
    { key: 'dir', label: 'Direction', type: 'select', default: 'right', options: [['right', 'Lean right'], ['left', 'Lean left']] },
    { key: 'wear', label: 'Wear', type: 'range', min: 0, max: 1, step: 0.05, default: 0.4 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const ca = hex(p.a);
      const cb = hex(p.b);
      const metal = hex(p.metal);
      const wear = num(p.wear, 0.4);
      const sw = Math.max(2, Math.round(10 * g.u * num(p.width, 0.7)));
      const turn = p.dir === 'left' ? -1 : 1;
      const n = makeNoise(seed);
      const sc = 5 / g.h;
      const shadeA = [mix(ca, BLACK, 0.35), mix(ca, BLACK, 0.15), ca];
      const shadeB = [mix(cb, BLACK, 0.3), cb, mix(cb, WHITE, 0.06)];
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          const s = Math.floor((x + turn * y + 10000 * sw) / sw) % 2 === 0;
          const grime = fbm(n, x * sc, y * sc * 1.6, 4);
          const chip = fbm(n, x * sc * 3 + 40, y * sc * 3, 3);
          let c;
          if (chip > 1 - wear * 0.32) c = ramp([mix(metal, BLACK, 0.3), metal], (chip - (1 - wear * 0.32)) * 8, x, y);
          else c = ramp(s ? shadeA : shadeB, 1.2 - grime * wear * 1.6, x, y);
          g.set(x, y, c);
        }
      }
      // Scratches.
      const count = g.w * wear * 0.12;
      for (let i = 0; i < count; i++) {
        const x = hash(i, 1, seed) * g.w;
        const y = hash(i, 2, seed) * g.h;
        const len = 2 + hash(i, 3, seed) * 10 * g.u;
        g.line(x, y, x + len, y + (hash(i, 4, seed) - 0.5) * 3, metal, 0.7);
      }
      // Bevelled edges.
      const t = Math.max(1, Math.round(g.u));
      g.rect(0, 0, g.w, t, WHITE, 0.25);
      g.rect(0, g.h - t, g.w, t, BLACK, 0.45);
    });
  },
};
