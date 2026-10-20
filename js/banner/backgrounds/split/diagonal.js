// A diagonal split: two colours divided by a slanted edge, with an accent stripe running along the cut.
import { PIXEL, paint, hex, num } from '../_kit.js';
import { GROUP, textureParams, paintRegions, edgeShadow, ACCENT } from './_split.js';

export default {
  id: 'split-diagonal',
  name: 'Diagonal split',
  group: GROUP,
  tags: ['split', 'sports'],
  params: [
    { key: 'a', label: 'Colour one', type: 'color', default: '#14213D' },
    { key: 'b', label: 'Colour two', type: 'color', default: '#FCA311' },
    { key: 'accent', label: 'Accent', type: 'color', default: '#FFFFFF' },
    { key: 'pos', label: 'Split', type: 'range', min: 0.1, max: 0.9, step: 0.01, default: 0.62 },
    { key: 'angle', label: 'Slant', type: 'range', min: -60, max: 60, step: 1, default: 25 },
    ACCENT,
    ...textureParams('lines', 'b'),
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const cols = [hex(p.a), hex(p.b), hex(p.accent)];
      const k = Math.tan((num(p.angle, 25) * Math.PI) / 180);
      const px = g.w * num(p.pos, 0.62);
      const st = p.accentOn === 'no' ? 0 : Math.max(2, Math.round(3 * g.u));
      // Signed horizontal distance from the cut through (px, middle).
      const dist = (x, y) => x - (px + (y - g.h / 2) * k);
      paintRegions(g, p, cols, (x, y) => {
        const d = dist(x, y);
        return d < 0 ? 0 : d < st ? 2 : 1;
      }, seed);
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) edgeShadow(g, x, y, dist(x, y) - st, 4 * g.u);
    });
  },
};
