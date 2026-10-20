// Brushed steel: fine straight streaks, a soft band of sheen running across, and light scratches.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, num, WHITE, BLACK } from '../_kit.js';
import { GROUP, LIGHT, VIGNETTE, light, tones } from './_mat.js';

export default {
  id: 'mat-steel',
  name: 'Brushed steel',
  group: GROUP,
  tags: ['material', 'corporate', 'industrial'],
  params: [
    { key: 'steel', label: 'Steel', type: 'color', default: '#8A929C' },
    { key: 'sheen', label: 'Sheen', type: 'color', default: '#E8EEF4' },
    { key: 'dir', label: 'Brushing', type: 'select', default: 'horizontal', options: [['horizontal', 'Horizontal'], ['vertical', 'Vertical']] },
    { key: 'streaks', label: 'Streaks', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6 },
    { key: 'scratches', label: 'Scratches', type: 'range', min: 0, max: 1, step: 0.05, default: 0.3 },
    LIGHT,
    VIGNETTE,
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const steel = hex(p.steel);
      const sheen = hex(p.sheen);
      const sk = num(p.streaks, 0.6);
      const r = rng(seed);
      const n = makeNoise(seed);
      const vertical = p.dir === 'vertical';
      const t = [...tones(steel, 4, 0.4), mix(steel, sheen, 0.6)];
      const band = r();
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          const a = vertical ? y : x;
          const c = vertical ? x : y;
          const streak = n(a * 0.01, c * 1.3) - 0.5 + (n(a * 0.05, c * 3.1 + 40) - 0.5) * 0.6;
          // A diagonal sheen band.
          const s = Math.exp(-Math.pow((x / g.w - band + (y / g.h) * 0.4 - 0.2) * 3.5, 2));
          g.set(x, y, ramp(t, 0.45 + streak * 0.5 * sk + s * 0.45, x, y));
        }
      }
      for (let i = 0, k = num(p.scratches, 0.3) * 40 * (g.w / g.h) / 4; i < k; i++) {
        const x = r() * g.w;
        const y = r() * g.h;
        const len = (5 + r() * 30) * g.u;
        const ang = (r() - 0.5) * 1.2;
        g.line(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len, r() < 0.5 ? mix(sheen, WHITE, 0.3) : mix(steel, BLACK, 0.3), 0.45);
      }
      light(g, p);
    });
  },
};
