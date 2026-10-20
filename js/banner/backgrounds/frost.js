// Ice: cracked plates (Voronoi cells with bright fracture lines), cloudy depth inside the ice, feathery frost
// creeping in from the edges and a few sparkles.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, fbm, hash, num, clamp, WHITE } from './_kit.js';

export default {
  id: 'frost',
  name: 'Ice and frost',
  tags: ['colony', 'cold'],
  params: [
    { key: 'deep', label: 'Deep ice', type: 'color', default: '#0C2C48' },
    { key: 'ice', label: 'Ice', type: 'color', default: '#5FA8CF' },
    { key: 'frost', label: 'Frost', type: 'color', default: '#EEF8FF' },
    { key: 'cracks', label: 'Cracks', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
    { key: 'edge', label: 'Edge frost', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const deep = hex(p.deep);
      const ice = hex(p.ice);
      const frost = hex(p.frost);
      const cracks = num(p.cracks, 0.5);
      const edge = num(p.edge, 0.5);
      const r = rng(seed);
      const n = makeNoise(seed);
      const tones = [deep, mix(deep, ice, 0.35), mix(deep, ice, 0.7), ice, mix(ice, frost, 0.5)];
      // Voronoi sites on a jittered grid, looked up by cell for speed.
      const cs = Math.max(6, Math.round(g.h * (0.55 - cracks * 0.3)));
      const gx = Math.ceil(g.w / cs) + 2;
      const gy = Math.ceil(g.h / cs) + 2;
      const sites = new Float32Array(gx * gy * 3);
      for (let j = 0; j < gy; j++) {
        for (let i = 0; i < gx; i++) {
          const k = (j * gx + i) * 3;
          sites[k] = (i - 1 + r()) * cs;
          sites[k + 1] = (j - 1 + r()) * cs;
          sites[k + 2] = r();
        }
      }
      const sc = 3 / g.h;
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          const ci = Math.floor(x / cs) + 1;
          const cj = Math.floor(y / cs) + 1;
          let d1 = 1e9;
          let d2 = 1e9;
          let tone = 0;
          for (let j = cj - 1; j <= cj + 1; j++) {
            for (let i = ci - 1; i <= ci + 1; i++) {
              if (i < 0 || j < 0 || i >= gx || j >= gy) continue;
              const k = (j * gx + i) * 3;
              const ddx = x - sites[k];
              const ddy = y - sites[k + 1];
              const d = ddx * ddx + ddy * ddy;
              if (d < d1) {
                d2 = d1;
                d1 = d;
                tone = sites[k + 2];
              } else if (d < d2) d2 = d;
            }
          }
          d1 = Math.sqrt(d1);
          d2 = Math.sqrt(d2);
          const cloudy = fbm(n, x * sc, y * sc, 3);
          let v = 0.25 + tone * 0.3 + (cloudy - 0.5) * 0.7 - (d1 / cs) * 0.15;
          let c = ramp(tones, v, x, y);
          const crack = d2 - d1;
          if (cracks > 0 && crack < 0.9) c = crack < 0.45 ? frost : mix(ice, frost, 0.5);
          else if (cracks > 0 && crack < 1.8) c = mix(c, deep, 0.3);
          // Frost from the edges, feathered by noise.
          const ex = Math.min(x, g.w - 1 - x) / g.h;
          const ey = Math.min(y, g.h - 1 - y) / g.h;
          const near = Math.min(ex * 1.2, ey);
          const f = near > edge * 0.22 + 0.2 ? 0 : clamp((edge * 0.22 - near + (fbm(n, x * sc * 4 + 9, y * sc * 4, 3) - 0.5) * 0.3) * 8);
          if (f > 0) c = ramp([c, mix(c, frost, 0.5), frost], f, x, y);
          g.set(x, y, c);
        }
      }
      for (let i = 0, c = g.w * 0.08; i < c; i++) {
        const x = Math.floor(r() * g.w);
        const y = Math.floor(r() * g.h);
        g.set(x, y, WHITE);
        if (hash(x, y, seed) < 0.3) {
          g.blend(x + 1, y, WHITE, 0.5);
          g.blend(x - 1, y, WHITE, 0.5);
          g.blend(x, y + 1, WHITE, 0.5);
          g.blend(x, y - 1, WHITE, 0.5);
        }
      }
    });
  },
};
