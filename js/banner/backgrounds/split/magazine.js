// A magazine cover header: a deep masthead band with a double rule under it, a corner box for an issue number or
// price, and a footer strip.
import { PIXEL, paint, hex, mix, num, WHITE, BLACK } from '../_kit.js';
import { GROUP, textureParams, paintRegions, ACCENT } from './_split.js';

export default {
  id: 'split-magazine',
  name: 'Magazine header',
  group: GROUP,
  tags: ['split', 'tabloid', 'print'],
  params: [
    { key: 'a', label: 'Masthead', type: 'color', default: '#101820' },
    { key: 'b', label: 'Page', type: 'color', default: '#F2AA4C' },
    { key: 'accent', label: 'Rules', type: 'color', default: '#F2EEE4' },
    { key: 'd', label: 'Corner box', type: 'color', default: '#D8312B' },
    { key: 'pos', label: 'Masthead height', type: 'range', min: 0.3, max: 0.8, step: 0.01, default: 0.6 },
    { key: 'box', label: 'Corner box', type: 'select', default: 'right', options: [['right', 'Right'], ['left', 'Left'], ['none', 'None']] },
    ACCENT,
    ...textureParams('halftone', 'b'),
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const cols = [hex(p.a), hex(p.b), hex(p.accent), hex(p.d)];
      const my = Math.round(g.h * num(p.pos, 0.6));
      const r1 = p.accentOn === 'no' ? 0 : Math.max(1, Math.round(g.u));
      const foot = Math.round(g.h * 0.1);
      const bw = Math.round(g.h * 0.55);
      const bx = p.box === 'left' ? Math.round(4 * g.u) : g.w - bw - Math.round(4 * g.u);
      paintRegions(g, p, cols, (x, y) => {
        if (p.box !== 'none' && x >= bx && x < bx + bw && y >= Math.round(4 * g.u) && y < my - Math.round(4 * g.u)) return 3;
        if (y < my) return 0;
        if (r1 && (y === my + r1 || y === my + r1 * 3)) return 2;
        if (y >= g.h - foot) return 0;
        return 1;
      }, seed);
      if (p.box !== 'none') {
        g.rect(bx, Math.round(4 * g.u), bw, 1, mix(cols[3], WHITE, 0.4));
        g.rect(bx, my - Math.round(4 * g.u), bw, 1, mix(cols[3], BLACK, 0.4));
      }
      if (r1) g.rect(0, g.h - foot, g.w, r1, cols[2]);
    });
  },
};
