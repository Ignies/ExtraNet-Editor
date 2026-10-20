// Old paper or parchment: mottled fibres, coffee rings and spots, a fold crease, scorched or yellowed edges, and
// optional ruled lines.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, fbm, hash, num, clamp, BLACK, WHITE } from './_kit.js';

export default {
  id: 'paper',
  name: 'Paper and stains',
  tags: ['print', 'cult', 'colony'],
  params: [
    { key: 'paper', label: 'Paper', type: 'color', default: '#E6D6AC' },
    { key: 'stain', label: 'Stains', type: 'color', default: '#8A5A2B' },
    { key: 'rule', label: 'Ruled lines', type: 'color', default: '#7E9BC4' },
    { key: 'age', label: 'Age', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
    { key: 'lines', label: 'Lines', type: 'select', default: 'none', options: [['none', 'Plain'], ['ruled', 'Ruled'], ['grid', 'Graph paper']] },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const paper = hex(p.paper);
      const stain = hex(p.stain);
      const rule = hex(p.rule);
      const age = num(p.age, 0.5);
      const r = rng(seed);
      const n = makeNoise(seed);
      const tones = [mix(paper, stain, 0.28), mix(paper, stain, 0.14), paper, mix(paper, WHITE, 0.25)];
      const sc = 4 / g.h;
      const edgeK = 0.2 + age * 0.45;
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          let v = 0.55 + (fbm(n, x * sc, y * sc, 4) - 0.5) * (0.7 + age * 0.6) + (n(x * 0.4, y * 3) - 0.5) * 0.2;
          // Darker towards ragged edges.
          const ex = Math.min(x, g.w - 1 - x) / (g.h * 0.5);
          const ey = Math.min(y, g.h - 1 - y) / (g.h * 0.5);
          const e = Math.min(ex, ey) + (fbm(n, x * sc * 3, y * sc * 3, 2) - 0.5) * 0.4;
          v -= clamp(1 - e * 3.2) * edgeK;
          g.set(x, y, ramp(tones, v, x, y));
          if (age > 0.55 && e < 0.05 * (age - 0.55)) g.set(x, y, mix(stain, BLACK, 0.45));
        }
      }
      if (p.lines === 'ruled' || p.lines === 'grid') {
        const step = Math.max(4, Math.round(7 * g.u));
        for (let y = step * 2; y < g.h; y += step) for (let x = 0; x < g.w; x++) g.blend(x, y, rule, 0.45);
        if (p.lines === 'grid') for (let x = step; x < g.w; x += step) for (let y = 0; y < g.h; y++) g.blend(x, y, rule, 0.3);
        else for (let y = 0; y < g.h; y++) g.blend(Math.round(g.h * 0.55), y, [200, 60, 60], 0.5);
      }
      // Coffee rings: a dark rim and a faint fill.
      const rings = Math.round(age * 3 * (g.w / g.h) / 4 + (age > 0.2 ? 1 : 0));
      for (let i = 0; i < rings; i++) {
        const cx = r() * g.w;
        const cy = r() * g.h;
        const rad = (8 + r() * 10) * g.u;
        const gap = r() * Math.PI * 2;
        for (let y = Math.floor(cy - rad - 2); y <= cy + rad + 2; y++) {
          for (let x = Math.floor(cx - rad - 2); x <= cx + rad + 2; x++) {
            const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
            const a = Math.atan2(y - cy, x - cx);
            const broken = Math.cos(a - gap) > 0.85;
            const wob = (n(a * 2 + i * 9, i) - 0.5) * 2 * g.u;
            const rim = Math.abs(d - rad - wob);
            if (rim < 1.1 * g.u && !broken) g.blend(x, y, stain, 0.45);
            else if (d < rad + wob) g.blend(x, y, stain, 0.07);
          }
        }
      }
      // Spots and a fold crease.
      for (let i = 0, c = age * 30 * (g.w / g.h) / 4; i < c; i++) g.disc(r() * g.w, r() * g.h, (0.5 + r() * 1.5) * g.u, stain, 0.25 + r() * 0.3);
      const fx = Math.round(g.w * (0.35 + r() * 0.3));
      for (let y = 0; y < g.h; y++) {
        g.blend(fx, y, BLACK, 0.12 + hash(fx, y, seed) * 0.06);
        g.blend(fx + 1, y, WHITE, 0.2);
      }
    });
  },
};
