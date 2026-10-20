// A desk at night: a wall with a warm pool of lamplight falling across it, and a desk top with a front edge and a
// blotter, for paperwork, a radio, a mug.
import { PIXEL, paint, hex, mix, ramp, num, BLACK, WHITE } from '../_kit.js';
import { GROUP, stageParams, layout, divider, fillStage, pool, fbm } from './_stage.js';

export default {
  id: 'stage-desk',
  name: 'Desk with lamplight',
  group: GROUP,
  tags: ['stage', 'office', 'noir'],
  params: [
    ...stageParams({ side: 'right', width: 0.48, bg: '#12100E', light: '#FFC870' }),
    { key: 'wall', label: 'Wall', type: 'color', default: '#2E2A30' },
    { key: 'desk', label: 'Desk', type: 'color', default: '#5A3820' },
    { key: 'blotter', label: 'Blotter', type: 'color', default: '#2A4A36' },
    { key: 'deskY', label: 'Desk height', type: 'range', min: 0.5, max: 0.9, step: 0.01, default: 0.7 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const s = layout(g, p, seed);
      const wall = hex(p.wall);
      const desk = hex(p.desk);
      const blot = hex(p.blotter);
      const dy = Math.round(g.h * num(p.deskY, 0.7));
      const lampX = s.x === 0 ? s.x + s.w * 0.2 : s.x1 - s.w * 0.2;
      fillStage(g, s, (x, y) => (y < dy ? ramp([mix(wall, BLACK, 0.45), wall], 1 - y / dy * 0.4 + (fbm(s.n, x * 0.05, y * 0.05, 2) - 0.5) * 0.3, x, y) : desk));
      pool(g, s, lampX, dy, s.w * 0.75, g.h * 0.75, s.light, 0.45);
      // Desk top in perspective: a lighter top band, grain, the front edge.
      const top = Math.round((g.h - dy) * 0.55);
      for (let y = dy; y < g.h; y++) {
        for (let x = s.x; x < s.x1; x++) {
          const onTop = y < dy + top;
          const v = (onTop ? 0.2 : 0.75) + (fbm(s.n, x * 0.04, y * 0.6, 2) - 0.5) * 0.5;
          g.set(x, y, ramp([mix(desk, WHITE, 0.15), desk, mix(desk, BLACK, 0.4)], v, x, y));
        }
      }
      g.rect(s.x, dy, s.w, 1, mix(desk, WHITE, 0.3));
      g.rect(s.x, dy + top, s.w, 1, mix(desk, WHITE, 0.25));
      g.rect(s.x, dy + top + 1, s.w, 1, mix(desk, BLACK, 0.5));
      // Blotter.
      const bw = Math.round(s.w * 0.5);
      const bx = Math.round(s.x + (s.w - bw) / 2);
      g.rect(bx, dy + 1, bw, top - 2, blot);
      g.rect(bx, dy + 1, bw, 1, mix(blot, WHITE, 0.3));
      g.rect(bx, dy + 1, Math.round(3 * g.u), top - 2, mix(blot, BLACK, 0.4));
      g.rect(bx + bw - Math.round(3 * g.u), dy + 1, Math.round(3 * g.u), top - 2, mix(blot, BLACK, 0.4));
      pool(g, s, lampX, dy + top / 2, s.w * 0.45, top * 1.5, s.light, 0.3);
      divider(g, s, wall);
    });
  },
};
