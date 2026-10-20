// A workbench: a pegboard wall under a work lamp's glow, and a thick bench top with a front edge, for tools and
// parts.
import { PIXEL, paint, hex, mix, ramp, num, BLACK, WHITE } from '../_kit.js';
import { GROUP, stageParams, layout, divider, fillStage, pool, tube, fbm } from './_stage.js';

export default {
  id: 'stage-workbench',
  name: 'Workbench',
  group: GROUP,
  tags: ['stage', 'industrial', 'tools'],
  params: [
    ...stageParams({ side: 'right', width: 0.46, bg: '#1A1C1E', light: '#FFE6B0' }),
    { key: 'board', label: 'Pegboard', type: 'color', default: '#9A7A54' },
    { key: 'bench', label: 'Bench', type: 'color', default: '#5A4A3A' },
    { key: 'benchY', label: 'Bench height', type: 'range', min: 0.55, max: 0.9, step: 0.01, default: 0.76 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const s = layout(g, p, seed);
      const board = hex(p.board);
      const bench = hex(p.bench);
      const by = Math.round(g.h * num(p.benchY, 0.76));
      const step = Math.max(3, Math.round(5 * g.u));
      const tones = [mix(board, BLACK, 0.3), board, mix(board, WHITE, 0.08)];
      fillStage(g, s, (x, y) => {
        if (y >= by) return bench;
        const hole = (x - s.x) % step === Math.floor(step / 2) && y % step === Math.floor(step / 2);
        if (hole) return mix(board, BLACK, 0.7);
        return ramp(tones, 0.5 + (fbm(s.n, x * 0.1, y * 0.3, 2) - 0.5) * 0.5 - y / by * 0.25, x, y);
      });
      tube(g, s, s.light, 1);
      // Bench: top edge, thick front with grain, shadow on the wall above.
      g.rect(s.x, by - Math.round(2 * g.u), s.w, Math.round(2 * g.u), BLACK, 0.35);
      g.rect(s.x, by, s.w, 1, mix(bench, WHITE, 0.4));
      g.rect(s.x, by + 1, s.w, Math.round(3 * g.u), mix(bench, WHITE, 0.15));
      const fy = by + 1 + Math.round(3 * g.u);
      for (let y = fy; y < g.h; y++) for (let x = s.x; x < s.x1; x++) g.set(x, y, ramp([mix(bench, BLACK, 0.15), mix(bench, BLACK, 0.45)], (y - fy) / (g.h - fy) + (fbm(s.n, x * 0.08, y * 0.9, 2) - 0.5) * 0.6, x, y));
      g.rect(s.x, fy, s.w, 1, mix(bench, BLACK, 0.55));
      pool(g, s, s.x + s.w / 2, by, s.w * 0.5, g.h * 0.12, s.light, 0.25);
      divider(g, s, board);
    });
  },
};
