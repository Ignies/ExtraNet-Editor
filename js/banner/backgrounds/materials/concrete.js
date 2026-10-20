// Concrete: mottled cement with aggregate specks, water stains running down, hairline cracks, and optional
// formwork seams with tie holes.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, fbm, hash, num, BLACK, WHITE } from '../_kit.js';
import { GROUP, LIGHT, VIGNETTE, light, tones } from './_mat.js';

export default {
  id: 'mat-concrete',
  name: 'Concrete',
  group: GROUP,
  tags: ['material', 'industrial', 'street'],
  params: [
    { key: 'concrete', label: 'Concrete', type: 'color', default: '#8C8A86' },
    { key: 'stain', label: 'Stains', type: 'color', default: '#4A4640' },
    { key: 'stains', label: 'Stains', type: 'range', min: 0, max: 1, step: 0.05, default: 0.4 },
    { key: 'cracks', label: 'Cracks', type: 'range', min: 0, max: 1, step: 0.05, default: 0.35 },
    { key: 'forms', label: 'Formwork', type: 'select', default: 'yes', options: [['yes', 'Seams and tie holes'], ['no', 'Plain']] },
    LIGHT,
    VIGNETTE,
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const con = hex(p.concrete);
      const stain = hex(p.stain);
      const sk = num(p.stains, 0.4);
      const r = rng(seed);
      const n = makeNoise(seed);
      const t = tones(con, 4, 0.3);
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          let v = 0.5 + (fbm(n, x * 0.05 / g.u, y * 0.05 / g.u, 4) - 0.5) * 0.8 + (hash(x, y, seed) - 0.5) * 0.5;
          let c = ramp(t, v, x, y);
          // Streaky stains running down from the top.
          const st = fbm(n, x * 0.08 / g.u, y * 0.008 / g.u + 20, 3) * (0.6 + 0.4 * (1 - y / g.h));
          if (st > 1 - sk * 0.45) c = mix(c, stain, 0.35);
          if (hash(y, x, seed + 2) < 0.02) c = mix(c, hash(x, y, 3) < 0.5 ? BLACK : WHITE, 0.25);
          g.set(x, y, c);
        }
      }
      if (p.forms !== 'no') {
        const fw = Math.round(64 * g.u);
        const fh = Math.round(34 * g.u);
        for (let x = fw; x < g.w; x += fw) g.rect(x, 0, 1, g.h, mix(con, BLACK, 0.25));
        for (let y = fh; y < g.h; y += fh) g.rect(0, y, g.w, 1, mix(con, BLACK, 0.25));
        for (let x = fw / 2; x < g.w; x += fw) {
          for (let y = fh / 2; y < g.h; y += fh) {
            g.disc(x, y, 1.6 * g.u, mix(con, BLACK, 0.55));
            g.set(x - g.u, y - g.u, mix(con, WHITE, 0.2));
          }
        }
      }
      for (let i = 0, k = Math.round(num(p.cracks, 0.35) * 6 * (g.w / g.h) / 4); i < k; i++) {
        let x = r() * g.w;
        let y = r() * g.h;
        let ang = r() * Math.PI * 2;
        const len = (20 + r() * 60) * g.u;
        for (let s = 0; s < len; s++) {
          ang += (r() - 0.5) * 0.6;
          x += Math.cos(ang);
          y += Math.sin(ang);
          g.set(x, y, mix(con, BLACK, 0.55));
          if (r() < 0.04) ang += (r() - 0.5) * 1.5;
        }
      }
      light(g, p);
    });
  },
};
