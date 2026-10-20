// A nebula: domain-warped noise clouds in two colours over dark space, with dust lanes and a sprinkle of stars.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, fbm, num, clamp, WHITE } from './_kit.js';

export default {
  id: 'nebula',
  name: 'Nebula',
  tags: ['space'],
  params: [
    { key: 'bg', label: 'Space', type: 'color', default: '#05030C' },
    { key: 'cloudA', label: 'Cloud', type: 'color', default: '#4A2A8C' },
    { key: 'cloudB', label: 'Core', type: 'color', default: '#E8507F' },
    { key: 'amount', label: 'Amount', type: 'range', min: 0, max: 1, step: 0.05, default: 0.55 },
    { key: 'scale', label: 'Scale', type: 'range', min: 0.3, max: 2, step: 0.05, default: 1 },
    { key: 'stars', label: 'Stars', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const bg = hex(p.bg);
      const a = hex(p.cloudA);
      const b = hex(p.cloudB);
      const amount = num(p.amount, 0.55);
      const r = rng(seed);
      const n = makeNoise(seed);
      const m = makeNoise(seed + 101);
      const tones = [bg, mix(bg, a, 0.3), mix(bg, a, 0.65), a, mix(a, b, 0.5), b, mix(b, WHITE, 0.45)];
      const sc = 1.6 / (g.h * num(p.scale, 1));
      const ox = r() * 50;
      const oy = r() * 50;
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          const px = x * sc + ox;
          const py = y * sc * 1.25 + oy;
          const qx = fbm(n, px, py, 3);
          const qy = fbm(n, px + 5.2, py + 1.3, 3);
          let v = fbm(n, px + 1.8 * qx, py + 1.8 * qy, 3);
          const lane = fbm(m, px * 1.8, py * 1.8, 3);
          v = (v - (0.6 - amount * 0.4)) * 2.1;
          v -= Math.max(0, lane - 0.55) * 1.6;
          g.set(x, y, ramp(tones, clamp(v), x, y));
        }
      }
      const area = g.w * g.h;
      const k = num(p.stars, 0.5);
      for (let i = 0, c = area * 0.006 * k; i < c; i++) g.blend(r() * g.w, r() * g.h, WHITE, 0.3 + r() * 0.7);
      for (let i = 0, c = area * 0.0003 * k; i < c; i++) {
        const x = Math.floor(r() * g.w);
        const y = Math.floor(r() * g.h);
        g.set(x, y, WHITE);
        g.blend(x + 1, y, WHITE, 0.4);
        g.blend(x - 1, y, WHITE, 0.4);
        g.blend(x, y + 1, WHITE, 0.4);
        g.blend(x, y - 1, WHITE, 0.4);
      }
    });
  },
};
