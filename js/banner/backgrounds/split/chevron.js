// A chevron split: one colour breaks into the other with an arrow-shaped edge, doubled by an accent band.
import { PIXEL, paint, hex, num } from '../_kit.js';
import { GROUP, textureParams, paintRegions, edgeShadow, ACCENT } from './_split.js';

export default {
  id: 'split-chevron',
  name: 'Chevron split',
  group: GROUP,
  tags: ['split', 'sports', 'military'],
  params: [
    { key: 'a', label: 'Arrow', type: 'color', default: '#2A9D8F' },
    { key: 'b', label: 'Behind', type: 'color', default: '#264653' },
    { key: 'accent', label: 'Accent', type: 'color', default: '#E9C46A' },
    { key: 'pos', label: 'Point', type: 'range', min: 0.15, max: 0.85, step: 0.01, default: 0.4 },
    { key: 'sharp', label: 'Sharpness', type: 'range', min: 0.2, max: 2, step: 0.05, default: 0.6 },
    { key: 'dir', label: 'Points', type: 'select', default: 'right', options: [['right', 'Right'], ['left', 'Left']] },
    ACCENT,
    ...textureParams('halftone', 'b'),
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const cols = [hex(p.a), hex(p.b), hex(p.accent)];
      const px = g.w * num(p.pos, 0.4);
      const k = num(p.sharp, 0.6);
      const st = p.accentOn === 'no' ? 0 : Math.max(2, Math.round(4 * g.u));
      const flip = p.dir === 'left';
      const dist = (x, y) => (flip ? g.w - 1 - x : x) - (px - Math.abs(y - g.h / 2) * k);
      paintRegions(g, p, cols, (x, y) => {
        const d = dist(x, y);
        return d < 0 ? 0 : d < st ? 1 : d < st * 2 ? 2 : 1;
      }, seed);
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) edgeShadow(g, x, y, dist(x, y), 4 * g.u);
    });
  },
};
