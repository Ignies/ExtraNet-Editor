// A display pedestal under a spotlight: a dark backdrop, a cone of light from above, and a plinth whose lit top
// is the place for one hero sprite.
import { PIXEL, paint, hex, mix, ramp, num, clamp, BLACK, WHITE } from '../_kit.js';
import { GROUP, stageParams, layout, divider, fillStage, pool } from './_stage.js';

export default {
  id: 'stage-pedestal',
  name: 'Spotlit pedestal',
  group: GROUP,
  tags: ['stage', 'product'],
  params: [
    ...stageParams({ side: 'right', width: 0.4, bg: '#101016', light: '#FFF4D6' }),
    { key: 'backdrop', label: 'Backdrop', type: 'color', default: '#1E1A2C' },
    { key: 'plinth', label: 'Plinth', type: 'color', default: '#8C8A96' },
    { key: 'height', label: 'Plinth height', type: 'range', min: 0.15, max: 0.55, step: 0.01, default: 0.32 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const s = layout(g, p, seed);
      const back = hex(p.backdrop);
      const plinth = hex(p.plinth);
      const cx = s.x + s.w / 2;
      const floorY = Math.round(g.h * 0.86);
      fillStage(g, s, (x, y) => (y >= floorY ? ramp([mix(back, WHITE, 0.05), mix(back, BLACK, 0.4)], (y - floorY) / (g.h - floorY), x, y) : mix(back, BLACK, 0.25)));
      // The cone: brightest in the middle, widening downward.
      for (let y = 0; y < floorY; y++) {
        const half = s.w * (0.08 + 0.32 * y / floorY);
        for (let x = s.x; x < s.x1; x++) {
          const d = Math.abs(x + 0.5 - cx) / half;
          if (d < 1) g.dot(x, y, mix(back, s.light, 0.35), (1 - d) * 0.8);
        }
      }
      pool(g, s, cx, floorY + 2, s.w * 0.45, g.h * 0.12, s.light, 0.5);
      // Plinth: a column with a lit top ellipse and shading across.
      const ph = Math.round(g.h * num(p.height, 0.32));
      const pw = Math.round(s.w * 0.42);
      const top = floorY - ph;
      const tones = [mix(plinth, WHITE, 0.3), plinth, mix(plinth, BLACK, 0.35), mix(plinth, BLACK, 0.6)];
      for (let y = top; y < floorY; y++) {
        for (let x = Math.round(cx - pw / 2); x < cx + pw / 2; x++) g.set(x, y, ramp(tones, clamp((x - (cx - pw / 2)) / pw) * 0.9 + 0.1, x, y));
      }
      const ery = Math.max(2, Math.round(3 * g.u));
      for (let y = top - ery; y <= top + ery; y++) {
        for (let x = Math.round(cx - pw / 2); x < cx + pw / 2; x++) {
          const dx = (x + 0.5 - cx) / (pw / 2);
          const dy = (y - top) / ery;
          if (dx * dx + dy * dy <= 1) g.set(x, y, dy < 0.4 ? mix(plinth, WHITE, 0.55) : mix(plinth, WHITE, 0.25));
        }
      }
      g.rect(Math.round(cx - pw / 2) - 2, floorY - 2, pw + 4, 2, mix(plinth, BLACK, 0.5));
      g.rect(s.x, 0, s.w, 2, mix(back, BLACK, 0.5));
      g.rect(Math.round(cx - 4 * g.u), 0, Math.round(8 * g.u), Math.round(2 * g.u), mix(s.light, WHITE, 0.5));
      divider(g, s, back);
    });
  },
};
