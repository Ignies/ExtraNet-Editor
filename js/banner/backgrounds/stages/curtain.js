// A stage with curtains: drapes gathered at both sides, a scalloped valance, a wooden stage floor and a spotlight
// pool in the middle.
import { PIXEL, paint, hex, mix, ramp, num, BLACK, WHITE } from '../_kit.js';
import { GROUP, stageParams, layout, divider, fillStage, pool } from './_stage.js';

export default {
  id: 'stage-curtain',
  name: 'Curtain stage',
  group: GROUP,
  tags: ['stage', 'leisure', 'music'],
  params: [
    ...stageParams({ side: 'right', width: 0.5, bg: '#140C10', light: '#FFE8B0' }),
    { key: 'curtain', label: 'Curtains', type: 'color', default: '#A01828' },
    { key: 'back', label: 'Back wall', type: 'color', default: '#1A1018' },
    { key: 'floor', label: 'Floor', type: 'color', default: '#7A4A2A' },
    { key: 'open', label: 'Curtains open', type: 'range', min: 0.3, max: 0.9, step: 0.01, default: 0.62 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const s = layout(g, p, seed);
      const cur = hex(p.curtain);
      const back = hex(p.back);
      const floor = hex(p.floor);
      const fy = Math.round(g.h * 0.8);
      const open = num(p.open, 0.62);
      const drape = s.w * (1 - open) / 2;
      const fold = Math.max(3, 5 * g.u);
      const ctones = [mix(cur, WHITE, 0.2), cur, mix(cur, BLACK, 0.35), mix(cur, BLACK, 0.65)];
      fillStage(g, s, (x, y) => {
        if (y >= fy) {
          const plank = Math.floor((y - fy) / Math.max(2, 2 * g.u));
          return ramp([mix(floor, WHITE, 0.12), floor, mix(floor, BLACK, 0.35)], (y - fy) / (g.h - fy) + (plank % 2) * 0.2, x, y);
        }
        return back;
      });
      pool(g, s, s.x + s.w / 2, fy, s.w * 0.4, g.h * 0.16, s.light, 0.55);
      pool(g, s, s.x + s.w / 2, fy * 0.6, s.w * 0.3, g.h * 0.55, s.light, 0.12);
      // Drapes: folds as a cosine, gathered (narrower folds) towards the outside edge and tied near the bottom.
      for (let y = 0; y < g.h; y++) {
        const tie = y > fy * 0.7 ? Math.min(1, (y - fy * 0.7) / (fy * 0.3)) : 0;
        const wNow = drape * (1 - tie * 0.25) + (y > fy ? 0 : 0);
        for (const left of [true, false]) {
          for (let k = 0; k < wNow; k++) {
            const x = left ? s.x + k : s.x1 - 1 - k;
            const v = 0.5 + 0.5 * Math.cos((k / fold) * Math.PI * 2);
            g.set(x, y, ramp(ctones, 1 - v * 0.85 + (k > wNow - 2 ? 0.4 : 0), x, y));
          }
        }
      }
      // Valance with scallops.
      const vh = Math.round(g.h * 0.14);
      const sc = Math.round(12 * g.u);
      for (let x = s.x; x < s.x1; x++) {
        const t = ((x - s.x) % sc) / sc;
        const bottom = vh + Math.round(Math.sin(t * Math.PI) * 3 * g.u);
        for (let y = 0; y < bottom; y++) g.set(x, y, ramp(ctones, 0.3 + y / bottom * 0.6, x, y));
        g.set(x, bottom, [214, 170, 70]);
      }
      divider(g, s, cur);
    });
  },
};
