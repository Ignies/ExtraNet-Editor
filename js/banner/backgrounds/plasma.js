// A demoscene plasma: summed sine waves mapped through a looping three colour palette, posterised into dithered
// steps.
import { PIXEL, paint, hex, mix, ramp, rng, num } from './_kit.js';

export default {
  id: 'plasma',
  name: 'Plasma',
  tags: ['80s', 'retro', 'cult'],
  params: [
    { key: 'c1', label: 'Dark', type: 'color', default: '#160033' },
    { key: 'c2', label: 'Middle', type: 'color', default: '#E0287D' },
    { key: 'c3', label: 'Bright', type: 'color', default: '#FFD84A' },
    { key: 'scale', label: 'Scale', type: 'range', min: 0.3, max: 3, step: 0.05, default: 1 },
    { key: 'steps', label: 'Colour steps', type: 'range', min: 3, max: 12, step: 1, default: 7 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const c1 = hex(p.c1);
      const c2 = hex(p.c2);
      const c3 = hex(p.c3);
      const r = rng(seed);
      const n = Math.round(num(p.steps, 7));
      const pal = [];
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        pal.push(t < 0.5 ? mix(c1, c2, t * 2) : mix(c2, c3, (t - 0.5) * 2));
      }
      const f = 1 / (g.h * 0.28 * num(p.scale, 1));
      const a1 = r() * 6;
      const a2 = r() * 6;
      const a3 = r() * 6;
      const px = g.w * (0.3 + r() * 0.4);
      const py = g.h * r();
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          let v = Math.sin(x * f + a1);
          v += Math.sin(y * f * 1.3 + a2);
          v += Math.sin((x + y) * f * 0.7 + a3);
          v += Math.sin(Math.hypot(x - px, y - py) * f * 1.2);
          // Fold into a 0..1 triangle wave so the palette loops dark-bright-dark.
          const t = (v / 4 + 1) / 2;
          const tri = 1 - Math.abs(((t * 2.5) % 2) - 1);
          g.set(x, y, ramp(pal, tri, x, y));
        }
      }
    });
  },
};
