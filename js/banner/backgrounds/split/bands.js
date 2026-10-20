// Top and bottom bands, like The Colony Tattler: a bold header band, a light lower band, a thin accent stripe
// between them and an optional starburst in a corner.
import { PIXEL, paint, hex, num } from '../_kit.js';
import { GROUP, textureParams, paintRegions, starburst, ACCENT } from './_split.js';

export default {
  id: 'split-bands',
  name: 'Header bands',
  group: GROUP,
  tags: ['split', 'tabloid'],
  params: [
    { key: 'a', label: 'Top band', type: 'color', default: '#E0245E' },
    { key: 'b', label: 'Lower band', type: 'color', default: '#F6F0E2' },
    { key: 'accent', label: 'Accent', type: 'color', default: '#1D1C21' },
    { key: 'burst', label: 'Starburst', type: 'color', default: '#FFD23A' },
    { key: 'pos', label: 'Split', type: 'range', min: 0.2, max: 0.8, step: 0.01, default: 0.5 },
    ACCENT,
    { key: 'corner', label: 'Starburst', type: 'select', default: 'right', options: [['right', 'Top right'], ['left', 'Top left'], ['none', 'None']] },
    ...textureParams('dots', 'a'),
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const cols = [hex(p.a), hex(p.b), hex(p.accent)];
      const sy = Math.round(g.h * num(p.pos, 0.5));
      const st = p.accentOn === 'no' ? 0 : Math.max(1, Math.round(2 * g.u));
      paintRegions(g, p, cols, (x, y) => (y < sy ? 0 : y < sy + st ? 2 : 1), seed);
      if (st) g.rect(0, g.h - st, g.w, st, cols[2]);
      if (p.corner !== 'none') {
        const r = g.h * 0.3;
        const cx = p.corner === 'left' ? r + 3 * g.u : g.w - r - 3 * g.u;
        starburst(g, cx, Math.min(sy, r + 3 * g.u), r, hex(p.burst), cols[2]);
      }
    });
  },
};
