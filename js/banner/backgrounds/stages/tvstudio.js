// A TV studio set: a rig of lamps across the top, a glowing backdrop with a sweep of stripes, and the front of a
// presenter's desk along the bottom.
import { PIXEL, paint, hex, mix, ramp, num, BLACK, WHITE } from '../_kit.js';
import { GROUP, stageParams, layout, divider, fillStage, pool } from './_stage.js';

export default {
  id: 'stage-tv-studio',
  name: 'TV studio set',
  group: GROUP,
  tags: ['stage', 'tabloid', 'news'],
  params: [
    ...stageParams({ side: 'right', width: 0.5, bg: '#0E1424', light: '#FFF6E0' }),
    { key: 'backdrop', label: 'Backdrop', type: 'color', default: '#2050A0' },
    { key: 'stripe', label: 'Stripes', type: 'color', default: '#FF4A6A' },
    { key: 'desk', label: 'Desk', type: 'color', default: '#E8E8F0' },
    { key: 'deskH', label: 'Desk height', type: 'range', min: 0, max: 0.45, step: 0.01, default: 0.26 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const s = layout(g, p, seed);
      const back = hex(p.backdrop);
      const stripe = hex(p.stripe);
      const desk = hex(p.desk);
      const cx = s.x + s.w / 2;
      const rig = Math.round(6 * g.u);
      const tones = [mix(back, WHITE, 0.25), back, mix(back, BLACK, 0.35), mix(back, BLACK, 0.6)];
      fillStage(g, s, (x, y) => {
        const d = Math.hypot((x - cx) / s.w, (y - g.h * 0.55) / g.h);
        return ramp(tones, d * 1.6, x, y);
      });
      // A sweep of three stripes across the backdrop.
      for (let k = 0; k < 3; k++) {
        for (let x = s.x; x < s.x1; x++) {
          const t = (x - s.x) / s.w;
          const y = g.h * (0.75 - t * 0.45) + k * 4 * g.u;
          g.rect(x, y, 1, Math.max(1, Math.round(2 * g.u) - k), k === 1 ? mix(stripe, WHITE, 0.4) : stripe);
        }
      }
      // Lighting rig.
      g.rect(s.x, 0, s.w, rig, mix(back, BLACK, 0.75));
      g.rect(s.x, rig - 1, s.w, 1, mix(back, BLACK, 0.5));
      for (let lx = s.x + Math.round(10 * g.u); lx < s.x1 - 4; lx += Math.round(22 * g.u)) {
        g.rect(lx - 2, rig, 5, Math.round(3 * g.u), [40, 40, 46]);
        g.rect(lx - 1, rig + Math.round(3 * g.u), 3, 1, mix(s.light, WHITE, 0.6));
        pool(g, s, lx, rig + 3 * g.u, 14 * g.u, g.h * 0.5, s.light, 0.2);
      }
      // Desk front.
      const dh = Math.round(g.h * num(p.deskH, 0.26));
      if (dh > 0) {
        const dy = g.h - dh;
        const inset = Math.round(s.w * 0.1);
        g.rect(s.x + inset, dy, s.w - inset * 2, dh, desk);
        g.rect(s.x + inset, dy, s.w - inset * 2, Math.round(2 * g.u), mix(desk, WHITE, 0.6));
        g.rect(s.x + inset, dy + Math.round(2 * g.u), s.w - inset * 2, 1, mix(desk, BLACK, 0.35));
        g.rect(s.x + inset, dy + Math.round(dh * 0.55), s.w - inset * 2, Math.max(1, Math.round(2 * g.u)), stripe);
        g.rect(s.x1 - inset - 2, dy, 2, dh, mix(desk, BLACK, 0.3));
      }
      divider(g, s, back);
    });
  },
};
