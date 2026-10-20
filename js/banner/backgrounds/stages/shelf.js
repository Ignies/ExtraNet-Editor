// A shop shelf: a back wall under a strip light with wooden shelves, each with a lit top, a front lip and a
// shadow, ready for item sprites.
import { PIXEL, paint, hex, mix, ramp, num, BLACK, WHITE } from '../_kit.js';
import { GROUP, stageParams, layout, divider, fillStage, tube, fbm } from './_stage.js';

export default {
  id: 'stage-shelf',
  name: 'Shop shelf',
  group: GROUP,
  tags: ['stage', 'shop'],
  params: [
    ...stageParams({ side: 'right', width: 0.45, bg: '#1C1A22', light: '#FFF0C8' }),
    { key: 'wall', label: 'Back wall', type: 'color', default: '#3A3442' },
    { key: 'wood', label: 'Shelves', type: 'color', default: '#8A5A34' },
    { key: 'shelves', label: 'Shelves', type: 'range', min: 1, max: 3, step: 1, default: 2 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const s = layout(g, p, seed);
      const wall = hex(p.wall);
      const wood = hex(p.wood);
      const tones = [mix(wall, BLACK, 0.35), mix(wall, BLACK, 0.15), wall];
      fillStage(g, s, (x, y) => ramp(tones, 1 - y / g.h * 0.7 + (fbm(s.n, x * 0.08, y * 0.02, 2) - 0.5) * 0.3, x, y));
      tube(g, s, s.light);
      const count = Math.round(num(p.shelves, 2));
      const th = Math.max(2, Math.round(3 * g.u));
      for (let i = 1; i <= count; i++) {
        const y = Math.round(g.h * (i / (count + 0.35))) - th;
        const inset = Math.round(3 * g.u);
        // Shadow under the shelf, the board's top, its front lip.
        g.rect(s.x + inset, y + th * 2, s.w - inset * 2, Math.round(3 * g.u), BLACK, 0.35);
        g.rect(s.x + inset, y, s.w - inset * 2, 1, mix(wood, WHITE, 0.35));
        g.rect(s.x + inset, y + 1, s.w - inset * 2, th - 1, mix(wood, WHITE, 0.1));
        for (let x = s.x + inset; x < s.x1 - inset; x++) {
          for (let yy = y + th; yy < y + th * 2; yy++) g.set(x, yy, ramp([mix(wood, BLACK, 0.15), mix(wood, BLACK, 0.4)], (yy - y - th) / th + (fbm(s.n, x * 0.2, yy * 0.8, 2) - 0.5) * 0.6, x, yy));
        }
        // Brackets.
        g.rect(s.x + inset + 2, y + th * 2, 1, th, mix(wall, BLACK, 0.6));
        g.rect(s.x1 - inset - 3, y + th * 2, 1, th, mix(wall, BLACK, 0.6));
      }
      // Side uprights.
      g.rect(s.x, 0, Math.round(2 * g.u), g.h, mix(wood, BLACK, 0.45));
      g.rect(s.x1 - Math.round(2 * g.u), 0, Math.round(2 * g.u), g.h, mix(wood, BLACK, 0.45));
      divider(g, s, wall);
    });
  },
};
