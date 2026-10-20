// A corner flash: a bold triangle across one corner with a parallel accent stripe, and a big starburst badge on
// it for a price or "NEW".
import { PIXEL, paint, hex, num } from '../_kit.js';
import { GROUP, textureParams, paintRegions, starburst, ACCENT } from './_split.js';

export default {
  id: 'split-corner-flash',
  name: 'Corner flash',
  group: GROUP,
  tags: ['split', 'shop', 'tabloid'],
  params: [
    { key: 'a', label: 'Background', type: 'color', default: '#1E5AA8' },
    { key: 'b', label: 'Flash', type: 'color', default: '#FFD23A' },
    { key: 'accent', label: 'Stripe', type: 'color', default: '#FFFFFF' },
    { key: 'd', label: 'Starburst', type: 'color', default: '#E0245E' },
    { key: 'pos', label: 'Flash size', type: 'range', min: 0.15, max: 0.7, step: 0.01, default: 0.36 },
    { key: 'corner', label: 'Corner', type: 'select', default: 'right', options: [['right', 'Bottom right'], ['left', 'Bottom left'], ['topright', 'Top right'], ['topleft', 'Top left']] },
    { key: 'burst', label: 'Starburst', type: 'select', default: 'yes', options: [['yes', 'Show'], ['no', 'Hide']] },
    ACCENT,
    ...textureParams('dots', 'a'),
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const cols = [hex(p.a), hex(p.b), hex(p.accent)];
      const size = g.w * num(p.pos, 0.36);
      const right = p.corner === 'right' || p.corner === 'topright';
      const bottom = p.corner === 'right' || p.corner === 'left';
      const st = p.accentOn === 'no' ? 0 : Math.max(2, Math.round(3 * g.u));
      // Distance into the corner along the diagonal.
      const dist = (x, y) => (right ? x : g.w - 1 - x) + (bottom ? y : g.h - 1 - y) * 1.6 - (g.w - size + g.h * 0.6);
      paintRegions(g, p, cols, (x, y) => {
        const d = dist(x, y);
        if (d >= 0) return 1;
        if (d > -st * 2 && d <= -st) return 2;
        return 0;
      }, seed);
      if (p.burst !== 'no') {
        const r = g.h * 0.28;
        starburst(g, right ? g.w - r - 5 * g.u : r + 5 * g.u, bottom ? g.h - r - 4 * g.u : r + 4 * g.u, r, hex(p.d), cols[2], 16, 0.78);
      }
    });
  },
};
