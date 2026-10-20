// An 80s neon grid tunnel: a perspective grid on the floor and the ceiling running to a glowing vanishing line,
// with a halo around every line.
import { PIXEL, paint, hex, mix, ramp, num, clamp, BLACK, WHITE } from './_kit.js';

export default {
  id: 'neon-grid',
  name: '80s neon grid',
  tags: ['80s', 'retro'],
  params: [
    { key: 'bg', label: 'Background', type: 'color', default: '#08020F' },
    { key: 'floor', label: 'Floor lines', type: 'color', default: '#FF2BD6' },
    { key: 'ceiling', label: 'Ceiling lines', type: 'color', default: '#2BE3FF' },
    { key: 'glow', label: 'Glow', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6 },
    { key: 'spacing', label: 'Grid size', type: 'range', min: 0.5, max: 2, step: 0.05, default: 1 },
    { key: 'mode', label: 'Grids', type: 'select', default: 'both', options: [['both', 'Floor and ceiling'], ['floor', 'Floor only'], ['ceiling', 'Ceiling only']] },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const bg = hex(p.bg);
      const fl = hex(p.floor);
      const ce = hex(p.ceiling);
      const glow = num(p.glow, 0.6);
      const sp = num(p.spacing, 1);
      const W = g.w;
      const H = g.h;
      const hz = Math.round(H / 2);
      const cx = W / 2;
      const dark = mix(bg, BLACK, 0.4);
      for (let y = 0; y < H; y++) {
        const dy = Math.abs(y + 0.5 - hz) / hz;
        const col = y >= hz ? fl : ce;
        const tones = [mix(bg, col, 0.22), mix(bg, col, 0.08), bg, dark];
        for (let x = 0; x < W; x++) g.set(x, y, ramp(tones, clamp(dy * 2.4), x, y));
      }
      const shift = ((seed * 0.37) % 1) * 0.34;
      const spread = Math.max(6, 24 * g.u * sp);
      const ratio = 0.62 + 0.1 * (sp - 1);
      const drawGrid = (dir, col) => {
        const half = dir > 0 ? H - hz : hz;
        const lineCol = mix(col, WHITE, 0.15);
        for (let pass = 0; pass < 2; pass++) {
          const put = (x0, y0, x1, y1, halo = true) => {
            if (pass === 0) {
              if (!halo) return;
              for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.line(x0 + ox, y0 + oy, x1 + ox, y1 + oy, col, 0.3 * glow);
            } else g.line(x0, y0, x1, y1, lineCol);
          };
          for (let dy = half * (1 - shift); dy >= 3 * g.u; dy *= ratio) {
            const y = Math.round(hz + dir * dy);
            put(0, y, W - 1, y, dy > 8 * g.u);
          }
          for (let k = -40; k <= 40; k++) {
            const bx = cx + k * spread;
            // Lines end where they would crowd closer than 3 pixels; the halo stops where they come within 6.
            const at = d => [cx + (bx - cx) * (d / half), hz + dir * d];
            // Outer lines run almost flat near the horizon, so each row would get a long run of them: stop them
            // once a row's run is longer than about half the gap to the next line (dy < 1.5 |k|).
            const end = Math.max(2, (3 * half) / spread, 1.5 * Math.abs(k));
            if (end >= half) continue;
            const haloEnd = Math.max(end, (6 * half) / spread);
            const [hx, hy] = at(haloEnd);
            const [ex, ey] = at(end);
            put(bx, dir > 0 ? H - 1 : 0, hx, hy);
            put(hx, hy, ex, ey, false);
          }
        }
      };
      if (p.mode !== 'ceiling') drawGrid(1, fl);
      if (p.mode !== 'floor') drawGrid(-1, ce);
      g.glow(cx, hz, W * 0.5, H * 0.08, WHITE, 0.3 * glow);
      g.glow(cx, hz, W * 0.9, H * 0.2, mix(fl, ce, 0.5), 0.22 * glow);
      g.rect(0, hz, W, 1, mix(mix(fl, ce, 0.5), WHITE, 0.6));
    });
  },
};
