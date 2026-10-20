// Deep space in three layers: a faint galactic haze band, a dust of far stars, brighter mid stars and a few near
// stars with cross glints.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, fbm, num, WHITE } from './_kit.js';

export default {
  id: 'starfield',
  name: 'Starfield',
  tags: ['space', 'retro'],
  params: [
    { key: 'bg', label: 'Space', type: 'color', default: '#03050C' },
    { key: 'haze', label: 'Haze', type: 'color', default: '#1B2552' },
    { key: 'stars', label: 'Stars', type: 'color', default: '#DCE6FF' },
    { key: 'warm', label: 'Warm stars', type: 'color', default: '#FFC27A' },
    { key: 'density', label: 'Density', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
    { key: 'band', label: 'Haze band', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const bg = hex(p.bg);
      const haze = hex(p.haze);
      const star = hex(p.stars);
      const warm = hex(p.warm);
      const density = num(p.density, 0.5);
      const bandK = num(p.band, 0.6);
      const r = rng(seed);
      const n = makeNoise(seed);
      const tones = [bg, mix(bg, haze, 0.35), mix(bg, haze, 0.7), haze];
      const tilt = (r() - 0.5) * 0.8;
      const off = (r() - 0.5) * 0.4;
      const sc = 6 / g.h;
      for (let y = 0; y < g.h; y++) {
        const ny = (y / g.h) * 2 - 1;
        for (let x = 0; x < g.w; x++) {
          const nx = (x / g.w) * 2 - 1;
          const d = (ny - off - tilt * nx) * 2.4;
          const v = Math.exp(-d * d) * (0.35 + 0.9 * fbm(n, x * sc, y * sc * 1.4, 4)) * bandK;
          g.set(x, y, ramp(tones, v, x, y));
        }
      }
      const area = g.w * g.h;
      const tint = () => (r() < 0.2 ? warm : star);
      // Far dust.
      for (let i = 0, c = area * 0.02 * density; i < c; i++) {
        const x = r() * g.w;
        const y = r() * g.h;
        g.blend(x, y, tint(), 0.25 + r() * 0.35);
      }
      // Mid stars.
      for (let i = 0, c = area * 0.0035 * density; i < c; i++) {
        const x = r() * g.w;
        const y = r() * g.h;
        g.set(x, y, mix(tint(), WHITE, r() * 0.3));
      }
      // Near stars with glints.
      for (let i = 0, c = Math.max(1, area * 0.0004 * density); i < c; i++) {
        const x = Math.floor(r() * g.w);
        const y = Math.floor(r() * g.h);
        const c2 = tint();
        const arm = 1 + Math.floor(r() * 2.5 * g.u);
        for (let k = 1; k <= arm; k++) {
          const a = 0.8 - k / (arm + 1) * 0.6;
          g.blend(x + k, y, c2, a);
          g.blend(x - k, y, c2, a);
          g.blend(x, y + k, c2, a);
          g.blend(x, y - k, c2, a);
        }
        g.set(x, y, WHITE);
      }
    });
  },
};
