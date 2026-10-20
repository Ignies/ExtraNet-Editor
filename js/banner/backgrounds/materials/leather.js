// Leather: a pebbled grain of small rounded cells, a soft sheen, and an optional stitched border.
import { PIXEL, paint, hex, mix, ramp, makeNoise, fbm, num, WHITE, BLACK } from '../_kit.js';
import { GROUP, LIGHT, VIGNETTE, light, tones } from './_mat.js';

export default {
  id: 'mat-leather',
  name: 'Leather',
  group: GROUP,
  tags: ['material', 'western', 'luxury'],
  params: [
    { key: 'leather', label: 'Leather', type: 'color', default: '#5A2E1C' },
    { key: 'thread', label: 'Stitching', type: 'color', default: '#E2C48C' },
    { key: 'grain', label: 'Grain', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6 },
    { key: 'stitch', label: 'Stitching', type: 'select', default: 'yes', options: [['yes', 'Stitched border'], ['no', 'None']] },
    LIGHT,
    VIGNETTE,
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const lea = hex(p.leather);
      const thread = hex(p.thread);
      const gk = num(p.grain, 0.6);
      const n = makeNoise(seed);
      const t = tones(lea, 5, 0.4);
      const s = 0.55 / g.u;
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          // Pebbles: thresholded noise gives rounded cells; the edge facing up-left is lit.
          const a = n(x * s, y * s);
          const b = n((x + 1) * s, (y + 1) * s);
          const creases = Math.abs(n(x * s * 0.5 + 9, y * s * 0.5) - 0.5) < 0.03 ? -0.35 : 0;
          const v = 0.5 + (a - 0.5) * 0.6 * gk + (a - b) * 2.2 * gk + creases * gk + (fbm(n, x * 0.02, y * 0.02, 2) - 0.5) * 0.4;
          g.set(x, y, ramp(t, v, x, y));
        }
      }
      if (p.stitch !== 'no') {
        const m = Math.round(5 * g.u);
        const dash = Math.max(2, Math.round(3 * g.u));
        for (let x = m; x < g.w - m; x++) {
          if ((x - m) % (dash * 2) < dash) {
            g.set(x, m, thread);
            g.set(x, g.h - m - 1, thread);
            g.set(x, m + 1, mix(lea, BLACK, 0.4));
            g.set(x, g.h - m, mix(lea, BLACK, 0.4));
          }
        }
        for (let y = m; y < g.h - m; y++) {
          if ((y - m) % (dash * 2) < dash) {
            g.set(m, y, thread);
            g.set(g.w - m - 1, y, thread);
            g.set(m + 1, y, mix(lea, BLACK, 0.4));
            g.set(g.w - m, y, mix(lea, BLACK, 0.4));
          }
        }
        g.rect(m - 2, m - 2, g.w - 2 * m + 4, 1, mix(lea, WHITE, 0.12));
      }
      light(g, p);
    });
  },
};
