// A museum case: a dark gallery, a plinth with a brass label plate, and a glass box above it with lit edges and a
// light strip in its lid.
import { PIXEL, paint, hex, mix, ramp, num, BLACK, WHITE } from '../_kit.js';
import { GROUP, stageParams, layout, divider, fillStage, pool } from './_stage.js';

export default {
  id: 'stage-museum-case',
  name: 'Museum case',
  group: GROUP,
  tags: ['stage', 'product', 'cult'],
  params: [
    ...stageParams({ side: 'right', width: 0.4, bg: '#12100E', light: '#FFE8B8' }),
    { key: 'gallery', label: 'Gallery wall', type: 'color', default: '#2A2220' },
    { key: 'plinth', label: 'Plinth', type: 'color', default: '#3A3436' },
    { key: 'glass', label: 'Glass tint', type: 'color', default: '#9FD0E0' },
    { key: 'plinthH', label: 'Plinth height', type: 'range', min: 0.15, max: 0.45, step: 0.01, default: 0.28 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const s = layout(g, p, seed);
      const wall = hex(p.gallery);
      const plinth = hex(p.plinth);
      const glass = hex(p.glass);
      fillStage(g, s, (x, y) => ramp([mix(wall, BLACK, 0.4), wall], 1 - y / g.h, x, y));
      const m = Math.round(s.w * 0.12);
      const x0 = s.x + m;
      const x1 = s.x1 - m;
      const py = g.h - Math.round(g.h * num(p.plinthH, 0.28));
      const gy = Math.round(g.h * 0.1);
      // Plinth with a top lip and a label plate.
      for (let y = py; y < g.h; y++) for (let x = x0 - 2; x < x1 + 2; x++) g.set(x, y, ramp([mix(plinth, WHITE, 0.1), plinth, mix(plinth, BLACK, 0.4)], (x - x0) / (x1 - x0), x, y));
      g.rect(x0 - 3, py, x1 - x0 + 6, Math.round(2 * g.u), mix(plinth, WHITE, 0.25));
      const lw = Math.round((x1 - x0) * 0.4);
      const ly = py + Math.round((g.h - py) * 0.45);
      g.rect((x0 + x1 - lw) / 2, ly, lw, Math.round(3 * g.u), [184, 150, 80]);
      g.rect((x0 + x1 - lw) / 2, ly, lw, 1, [236, 210, 140]);
      // Glass box: tint, edges, lid light.
      pool(g, s, (x0 + x1) / 2, gy, (x1 - x0) * 0.8, (py - gy) * 1.2, s.light, 0.4);
      for (let y = gy; y < py; y++) for (let x = x0; x < x1; x++) g.blend(x, y, glass, 0.08);
      g.rect(x0, gy, x1 - x0, Math.round(3 * g.u), mix(plinth, BLACK, 0.3));
      g.rect(x0 + 2, gy + Math.round(3 * g.u), x1 - x0 - 4, 1, mix(s.light, WHITE, 0.5));
      for (const ex of [x0, x1 - 1]) g.rect(ex, gy, 1, py - gy, mix(glass, WHITE, 0.5));
      g.rect(x0 + Math.round(2 * g.u), gy + Math.round(5 * g.u), 1, py - gy - Math.round(8 * g.u), mix(glass, WHITE, 0.3));
      for (let y = gy; y < py; y++) g.blend(x0 + (x1 - x0) * 0.3 + (py - y) * 0.4, y, WHITE, 0.25);
      divider(g, s, wall);
    });
  },
};
