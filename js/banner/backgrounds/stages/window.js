// A framed product window: a bevelled frame around a softly lit backdrop, glass glare streaks and a sill along
// the bottom.
import { PIXEL, paint, hex, mix, ramp, num, BLACK, WHITE } from '../_kit.js';
import { GROUP, stageParams, layout, divider, fillStage, pool } from './_stage.js';

export default {
  id: 'stage-window',
  name: 'Product window',
  group: GROUP,
  tags: ['stage', 'shop', 'product'],
  params: [
    ...stageParams({ side: 'right', width: 0.42, bg: '#0F1A2A', light: '#E8F6FF' }),
    { key: 'frame', label: 'Frame', type: 'color', default: '#C8CCD4' },
    { key: 'backdrop', label: 'Backdrop', type: 'color', default: '#3A78B8' },
    { key: 'glare', label: 'Glass glare', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const s = layout(g, p, seed);
      const frame = hex(p.frame);
      const back = hex(p.backdrop);
      const glare = num(p.glare, 0.5);
      const fw = Math.max(3, Math.round(4 * g.u));
      const m = Math.round(4 * g.u);
      const x0 = s.x + m;
      const x1 = s.x1 - m;
      const y0 = m;
      const y1 = g.h - Math.round(9 * g.u);
      fillStage(g, s, () => mix(s.bg, BLACK, 0.2));
      // Frame with bevel: light top-left, dark bottom-right.
      g.rect(x0, y0, x1 - x0, y1 - y0, frame);
      g.rect(x0, y0, x1 - x0, 1, mix(frame, WHITE, 0.5));
      g.rect(x0, y0, 1, y1 - y0, mix(frame, WHITE, 0.35));
      g.rect(x0, y1 - 1, x1 - x0, 1, mix(frame, BLACK, 0.45));
      g.rect(x1 - 1, y0, 1, y1 - y0, mix(frame, BLACK, 0.35));
      const ix0 = x0 + fw;
      const ix1 = x1 - fw;
      const iy0 = y0 + fw;
      const iy1 = y1 - fw;
      const tones = [mix(back, WHITE, 0.35), back, mix(back, BLACK, 0.35)];
      for (let y = iy0; y < iy1; y++) for (let x = ix0; x < ix1; x++) g.set(x, y, ramp(tones, (y - iy0) / (iy1 - iy0) * 0.9 + 0.1, x, y));
      pool(g, { x: ix0, x1: ix1 }, (ix0 + ix1) / 2, iy0, (ix1 - ix0) * 0.6, (iy1 - iy0) * 0.9, s.light, 0.35);
      g.rect(ix0, iy0, ix1 - ix0, 1, mix(frame, BLACK, 0.55));
      g.rect(ix0, iy0, 1, iy1 - iy0, mix(frame, BLACK, 0.45));
      // Glare: two diagonal streaks.
      if (glare > 0) {
        for (const [off, wdt] of [[0.18, 4], [0.32, 2]]) {
          for (let y = iy0; y < iy1; y++) {
            const sx = ix0 + (ix1 - ix0) * off + (iy1 - y) * 0.6;
            for (let k = 0; k < wdt * g.u; k++) g.blend(sx + k, y, WHITE, glare * 0.35);
          }
        }
      }
      // Sill.
      g.rect(x0 - 2, y1, x1 - x0 + 4, Math.round(3 * g.u), mix(frame, WHITE, 0.15));
      g.rect(x0 - 2, y1 + Math.round(3 * g.u), x1 - x0 + 4, 1, mix(frame, BLACK, 0.5));
      divider(g, s, frame);
    });
  },
};
