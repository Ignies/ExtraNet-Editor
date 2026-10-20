// A poster board: a framed cork board with a few coloured push pins, for pinning paper, photos and notes on.
import { PIXEL, paint, hex, mix, ramp, rng, hash, num, BLACK, WHITE } from '../_kit.js';
import { GROUP, stageParams, layout, divider, fillStage, fbm } from './_stage.js';

export default {
  id: 'stage-corkboard',
  name: 'Poster board',
  group: GROUP,
  tags: ['stage', 'board', 'colony'],
  params: [
    ...stageParams({ side: 'right', width: 0.46, bg: '#1E1A16', light: '#FFF2D8' }),
    { key: 'cork', label: 'Cork', type: 'color', default: '#B68A58' },
    { key: 'frame', label: 'Frame', type: 'color', default: '#5A3A22' },
    { key: 'pins', label: 'Pins', type: 'range', min: 0, max: 12, step: 1, default: 5 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const s = layout(g, p, seed);
      const cork = hex(p.cork);
      const frame = hex(p.frame);
      const r = rng(seed);
      const fw = Math.max(3, Math.round(4 * g.u));
      const m = Math.round(3 * g.u);
      const tones = [mix(cork, BLACK, 0.35), mix(cork, BLACK, 0.15), cork, mix(cork, WHITE, 0.15)];
      fillStage(g, s, (x, y) => {
        if (x < s.x + m || x >= s.x1 - m || y < m || y >= g.h - m) return mix(s.bg, BLACK, 0.2);
        if (x < s.x + m + fw || x >= s.x1 - m - fw || y < m + fw || y >= g.h - m - fw) {
          const edge = x < s.x + m + 1 || y < m + 1 ? 0.25 : x >= s.x1 - m - 1 || y >= g.h - m - 1 ? -0.4 : 0;
          return edge > 0 ? mix(frame, WHITE, edge) : mix(frame, BLACK, -edge + (fbm(s.n, x * 0.3, y * 0.3, 2) - 0.5) * 0.3);
        }
        return ramp(tones, 0.55 + (hash(x, y, seed) - 0.5) * 0.9 + (fbm(s.n, x * 0.1, y * 0.1, 2) - 0.5) * 0.4, x, y);
      });
      // Inner shadow under the top and left frame.
      g.rect(s.x + m + fw, m + fw, s.w - 2 * (m + fw), 1, BLACK, 0.35);
      g.rect(s.x + m + fw, m + fw, 1, g.h - 2 * (m + fw), BLACK, 0.25);
      const pinCols = [[220, 50, 50], [60, 120, 230], [240, 200, 40], [60, 180, 90], [230, 230, 230]];
      for (let i = 0, c = Math.round(num(p.pins, 5)); i < c; i++) {
        const px = s.x + m + fw + 3 + r() * (s.w - 2 * (m + fw) - 8);
        const py = m + fw + 3 + r() * (g.h - 2 * (m + fw) - 8);
        const col = pinCols[Math.floor(r() * pinCols.length)];
        g.disc(px + 1.5, py + 1.5, 1.6 * g.u, BLACK, 0.35);
        g.disc(px, py, 1.6 * g.u, col);
        g.set(px - g.u * 0.5, py - g.u * 0.5, mix(col, WHITE, 0.6));
      }
      divider(g, s, frame);
    });
  },
};
