// Three vertical stripes, like a flag or a team kit: three colours with adjustable widths and thin separators.
import { PIXEL, paint, hex, num } from '../_kit.js';
import { GROUP, textureParams, paintRegions, ACCENT } from './_split.js';

export default {
  id: 'split-stripes',
  name: 'Three stripes',
  group: GROUP,
  tags: ['split', 'sports', 'government'],
  params: [
    { key: 'a', label: 'Left', type: 'color', default: '#1F3A6E' },
    { key: 'b', label: 'Middle', type: 'color', default: '#F2EEE4' },
    { key: 'd', label: 'Right', type: 'color', default: '#B3202E' },
    { key: 'accent', label: 'Separators', type: 'color', default: '#D9B24C' },
    { key: 'left', label: 'Left width', type: 'range', min: 0.1, max: 0.6, step: 0.01, default: 0.2 },
    { key: 'right', label: 'Right width', type: 'range', min: 0.1, max: 0.6, step: 0.01, default: 0.2 },
    ACCENT,
    ...textureParams('none', 'b'),
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const cols = [hex(p.a), hex(p.b), hex(p.accent), hex(p.d)];
      const l = Math.round(g.w * num(p.left, 0.2));
      const r = g.w - Math.round(g.w * num(p.right, 0.2));
      const st = p.accentOn === 'no' ? 0 : Math.max(1, Math.round(2 * g.u));
      paintRegions(g, p, cols, x => {
        if (x < l) return 0;
        if (x < l + st) return 2;
        if (x >= r) return 3;
        if (x >= r - st) return 2;
        return 1;
      }, seed);
    });
  },
};
