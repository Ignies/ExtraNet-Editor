// A circuit board: solder mask with faint texture, chips with pins, and traces that run on a grid with 45 degree
// bends, ending in pads and vias.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, fbm, num, BLACK, WHITE } from './_kit.js';

const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

export default {
  id: 'circuit',
  name: 'Circuit traces',
  tags: ['tech', 'terminal'],
  params: [
    { key: 'board', label: 'Board', type: 'color', default: '#0A2A1C' },
    { key: 'trace', label: 'Traces', type: 'color', default: '#39A468' },
    { key: 'pad', label: 'Pads', type: 'color', default: '#D9B24C' },
    { key: 'density', label: 'Density', type: 'range', min: 0, max: 1, step: 0.05, default: 0.55 },
    { key: 'chips', label: 'Chips', type: 'range', min: 0, max: 6, step: 1, default: 2 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const board = hex(p.board);
      const trace = hex(p.trace);
      const pad = hex(p.pad);
      const density = num(p.density, 0.55);
      const r = rng(seed);
      const n = makeNoise(seed);
      const tones = [mix(board, BLACK, 0.25), board, mix(board, trace, 0.08)];
      const sc = 5 / g.h;
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) g.set(x, y, ramp(tones, fbm(n, x * sc, y * sc, 3) * 1.3 - 0.15, x, y));
      const s = Math.max(3, Math.round(4 * g.u));
      const cols = Math.floor(g.w / s);
      const rows = Math.floor(g.h / s);
      const used = new Uint8Array((cols + 1) * (rows + 1));
      const mark = (i, j) => {
        if (i >= 0 && j >= 0 && i <= cols && j <= rows) used[j * (cols + 1) + i] = 1;
      };
      const free = (i, j) => i >= 0 && j >= 0 && i <= cols && j <= rows && !used[j * (cols + 1) + i];
      const starts = [];
      // Chips: a dark body with pins on the long sides; traces leave from the pins.
      const chipCount = Math.round(num(p.chips, 2) * (g.w / g.h) / 4);
      for (let c = 0; c < chipCount; c++) {
        const cw = 3 + Math.floor(r() * 4);
        const chh = 2 + Math.floor(r() * 2);
        const ci = 1 + Math.floor(r() * (cols - cw - 2));
        const cj = 2 + Math.floor(r() * Math.max(1, rows - chh - 4));
        for (let i = ci - 1; i <= ci + cw + 1; i++) for (let j = cj - 1; j <= cj + chh + 1; j++) mark(i, j);
        const x0 = ci * s;
        const y0 = cj * s;
        g.rect(x0 + 1, y0 + 1, cw * s, chh * s, BLACK, 0.5);
        g.rect(x0, y0, cw * s, chh * s, mix(board, BLACK, 0.8));
        g.rect(x0, y0, cw * s, 1, WHITE, 0.12);
        g.disc(x0 + 2.5, y0 + 2.5, 1, mix(board, WHITE, 0.2));
        for (let i = ci; i <= ci + cw; i++) {
          g.rect(i * s, y0 - 2, 1, 2, pad);
          g.rect(i * s, y0 + chh * s, 1, 2, pad);
          starts.push([i, cj - 1, 6]);
          starts.push([i, cj + chh + 1, 2]);
        }
      }
      const count = Math.round(density * cols * rows * 0.06);
      for (let k = 0; k < count; k++) starts.push([Math.floor(r() * cols), Math.floor(r() * rows), Math.floor(r() * 8)]);
      const lineCol = trace;
      const shadow = mix(board, BLACK, 0.55);
      for (const [si, sj, sd] of starts) {
        if (!free(si, sj) && r() < 0.5) continue;
        let i = si;
        let j = sj;
        let d = sd;
        const pts = [[i, j]];
        mark(i, j);
        const len = 3 + Math.floor(r() * 14 * (0.5 + density));
        for (let step = 0; step < len; step++) {
          if (r() < 0.25) d = (d + (r() < 0.5 ? 1 : 7)) % 8;
          const [dx, dy] = DIRS[d];
          if (!free(i + dx, j + dy)) {
            const alt = (d + (r() < 0.5 ? 1 : 7)) % 8;
            const [ax, ay] = DIRS[alt];
            if (!free(i + ax, j + ay)) break;
            d = alt;
          }
          i += DIRS[d][0];
          j += DIRS[d][1];
          mark(i, j);
          pts.push([i, j]);
        }
        if (pts.length < 2) continue;
        for (let q = 1; q < pts.length; q++) {
          const [ax, ay] = pts[q - 1];
          const [bx, by] = pts[q];
          g.line(ax * s + 1, ay * s + 1, bx * s + 1, by * s + 1, shadow);
          g.line(ax * s, ay * s, bx * s, by * s, lineCol);
        }
        const [ex, ey] = pts[pts.length - 1];
        if (r() < 0.6) {
          g.rect(ex * s - 1, ey * s - 1, 3, 3, pad);
          g.set(ex * s, ey * s, mix(board, BLACK, 0.6));
        } else {
          g.rect(ex * s - 1, ey * s - 1, 3, 3, mix(pad, BLACK, 0.2));
          g.set(ex * s - 1, ey * s - 1, mix(pad, WHITE, 0.4));
        }
      }
      g.vignette(BLACK, 0.4);
    });
  },
};
