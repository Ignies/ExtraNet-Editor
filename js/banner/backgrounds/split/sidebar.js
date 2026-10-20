// A sidebar with a diagonal cut: a solid side panel for an emblem or sprite, ending in a slanted edge with an
// accent stripe, and the main colour behind the title.
import { PIXEL, paint, hex, num } from '../_kit.js';
import { GROUP, textureParams, paintRegions, edgeShadow, ACCENT } from './_split.js';

export default {
  id: 'split-sidebar',
  name: 'Cut sidebar',
  group: GROUP,
  tags: ['split', 'corporate'],
  params: [
    { key: 'a', label: 'Sidebar', type: 'color', default: '#D8312B' },
    { key: 'b', label: 'Main', type: 'color', default: '#1B1E26' },
    { key: 'accent', label: 'Accent', type: 'color', default: '#F2C230' },
    { key: 'side', label: 'Side', type: 'select', default: 'left', options: [['left', 'Left'], ['right', 'Right']] },
    { key: 'pos', label: 'Width', type: 'range', min: 0.1, max: 0.6, step: 0.01, default: 0.26 },
    { key: 'cut', label: 'Cut', type: 'range', min: 0, max: 0.4, step: 0.01, default: 0.12 },
    ACCENT,
    ...textureParams('grain', 'b'),
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const cols = [hex(p.a), hex(p.b), hex(p.accent)];
      const w = g.w * num(p.pos, 0.26);
      const cut = g.w * num(p.cut, 0.12);
      const st = p.accentOn === 'no' ? 0 : Math.max(2, Math.round(3 * g.u));
      const flip = p.side === 'right';
      // Distance past the sidebar's slanted edge (wider at the top).
      const dist = (x, y) => (flip ? g.w - 1 - x : x) - (w + cut * (1 - y / g.h));
      paintRegions(g, p, cols, (x, y) => {
        const d = dist(x, y);
        return d < 0 ? 0 : d < st ? 2 : d < st * 2 ? 1 : d < st * 3 ? 2 : 1;
      }, seed);
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) edgeShadow(g, x, y, dist(x, y) - st * 3, 5 * g.u);
    });
  },
};
