// A torn paper split: one colour ripped away to show the other, with a ragged white paper edge and a shadow.
import { PIXEL, paint, hex, mix, makeNoise, fbm, hash, num, WHITE } from '../_kit.js';
import { GROUP, textureParams, paintRegions, edgeShadow } from './_split.js';

export default {
  id: 'split-torn',
  name: 'Torn paper',
  group: GROUP,
  tags: ['split', 'tabloid', 'print'],
  params: [
    { key: 'a', label: 'Top paper', type: 'color', default: '#F4EFE4' },
    { key: 'b', label: 'Underneath', type: 'color', default: '#2B2D42' },
    { key: 'accent', label: 'Torn edge', type: 'color', default: '#FFFFFF' },
    { key: 'pos', label: 'Tear position', type: 'range', min: 0.15, max: 0.85, step: 0.01, default: 0.58 },
    { key: 'dir', label: 'Tear', type: 'select', default: 'vertical', options: [['vertical', 'Down the banner'], ['horizontal', 'Across the banner']] },
    { key: 'rough', label: 'Roughness', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
    ...textureParams('lines', 'b'),
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const cols = [hex(p.a), hex(p.b), hex(p.accent)];
      const n = makeNoise(seed);
      const rough = num(p.rough, 0.5);
      const vertical = p.dir !== 'horizontal';
      const pos = num(p.pos, 0.58);
      const amp = g.h * (0.12 + rough * 0.4);
      const edge = t => (fbm(n, t * 0.05 / g.u, 1.5, 3) - 0.5) * amp * 2 + (n(t * 0.45 / g.u, 9) - 0.5) * amp * 0.35 + (hash(Math.round(t), 3, seed) - 0.5) * 2 * g.u * rough;
      const rim = Math.max(1, Math.round(2 * g.u));
      const dist = (x, y) => (vertical ? x - (g.w * pos + edge(y)) : y - (g.h * pos + edge(x)));
      paintRegions(g, p, cols, (x, y) => {
        const d = dist(x, y);
        if (d < 0) return 0;
        // The torn white fibre edge is ragged itself.
        if (d < rim + (n(x * 0.7, y * 0.7) > 0.5 ? 1 : 0)) return 2;
        return 1;
      }, seed);
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) edgeShadow(g, x, y, dist(x, y) - rim, 6 * g.u, 0.45);
      void mix;
      void WHITE;
    });
  },
};
