// An open locker: a deep metal alcove in perspective with vent slots, a shelf and a hook rail, and the open door's
// edge beside it.
import { PIXEL, paint, hex, mix, ramp, num, BLACK, WHITE } from '../_kit.js';
import { GROUP, stageParams, layout, divider, fillStage, pool } from './_stage.js';

export default {
  id: 'stage-locker',
  name: 'Locker alcove',
  group: GROUP,
  tags: ['stage', 'military', 'industrial'],
  params: [
    ...stageParams({ side: 'right', width: 0.36, bg: '#161A16', light: '#DDF2FF' }),
    { key: 'metal', label: 'Locker', type: 'color', default: '#4A5A4A' },
    { key: 'inside', label: 'Inside', type: 'color', default: '#22282A' },
    { key: 'shelf', label: 'Shelf height', type: 'range', min: 0.15, max: 0.6, step: 0.01, default: 0.3 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const s = layout(g, p, seed);
      const metal = hex(p.metal);
      const inside = hex(p.inside);
      const rim = Math.round(5 * g.u);
      const depth = Math.round(7 * g.u);
      fillStage(g, s, (x, y) => ramp([metal, mix(metal, BLACK, 0.2)], y / g.h + ((x - s.x) % Math.round(3 * g.u) === 0 ? 0.25 : 0), x, y));
      const x0 = s.x + rim;
      const x1 = s.x1 - rim;
      const y0 = rim;
      const y1 = g.h - Math.round(3 * g.u);
      // Inside: back wall, then side and top faces in perspective.
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const dl = x - x0;
          const dr = x1 - 1 - x;
          const dt = y - y0;
          const db = y1 - 1 - y;
          let c = inside;
          if (dt < depth && dt <= Math.min(dl, dr)) c = mix(inside, BLACK, 0.45);
          else if (dl < depth && dl <= Math.min(dt, db)) c = mix(inside, BLACK, 0.25);
          else if (dr < depth && dr <= Math.min(dt, db)) c = mix(inside, WHITE, 0.06);
          else if (db < depth && db <= Math.min(dl, dr)) c = mix(inside, WHITE, 0.12);
          g.set(x, y, c);
        }
      }
      // Vent slots at the top of the back wall.
      for (let k = 0; k < 4; k++) g.rect(x0 + depth + 2, y0 + depth + 2 + k * 3, x1 - x0 - depth * 2 - 4, 1, mix(inside, BLACK, 0.6));
      // Shelf and hook rail.
      const sy = Math.round(g.h * num(p.shelf, 0.3)) + depth;
      g.rect(x0 + depth, sy, x1 - x0 - depth * 2, 2, mix(metal, WHITE, 0.2));
      g.rect(x0 + depth, sy + 2, x1 - x0 - depth * 2, 1, mix(metal, BLACK, 0.4));
      g.rect(x0 + depth, sy + Math.round(5 * g.u), x1 - x0 - depth * 2, 1, mix(metal, WHITE, 0.35));
      for (let hx = x0 + depth + 4; hx < x1 - depth - 2; hx += Math.round(10 * g.u)) g.rect(hx, sy + Math.round(5 * g.u), 1, Math.round(3 * g.u), mix(metal, WHITE, 0.35));
      pool(g, { x: x0, x1 }, (x0 + x1) / 2, y0, (x1 - x0) * 0.7, g.h * 0.7, s.light, 0.2);
      // Rim bevel and the open door's edge.
      g.rect(x0 - 1, y0 - 1, x1 - x0 + 2, 1, mix(metal, BLACK, 0.5));
      g.rect(x0 - 1, y1, x1 - x0 + 2, 1, mix(metal, WHITE, 0.3));
      const dx = s.x === 0 ? s.x1 - Math.round(2 * g.u) : s.x;
      g.rect(dx, 0, Math.round(2 * g.u), g.h, mix(metal, WHITE, 0.25));
      divider(g, s, metal);
    });
  },
};
