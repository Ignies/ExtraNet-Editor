// A broadcast colour-bar test card: seven bars, the reversed castellation strip, the blue/white/purple and black
// level blocks along the bottom, an identification box in the middle, scanlines and an optional tape tracking line.
// Fills the whole frame.
import { PIXEL, paint, mix, hash, bayer, BLACK, WHITE } from '../_kit.js';
import { GROUP } from './_stage.js';
import { textWidth } from '../scenery/_broadcast.js';

const BARS = [[192, 192, 192], [192, 192, 0], [0, 192, 192], [0, 192, 0], [192, 0, 192], [192, 0, 0], [0, 0, 192]];
const CASTLE = [[0, 0, 192], [19, 19, 19], [192, 0, 192], [19, 19, 19], [0, 192, 192], [19, 19, 19], [192, 192, 192]];

export default {
  id: 'stage-test-card',
  name: 'Test card',
  group: GROUP,
  tags: ['tv', 'retro', 'signal'],
  params: [
    {
      key: 'label', label: 'Identification', type: 'select', default: 'TEST',
      options: [['TEST', 'TEST'], ['CH 4', 'CH 4'], ['NO SIGNAL', 'NO SIGNAL'], ['YOUTAPE', 'YOUTAPE'], ['', 'None']],
    },
    { key: 'tracking', label: 'Tape tracking', type: 'select', default: 'yes', options: [['yes', 'Wobbly'], ['no', 'Clean']] },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const W = g.w;
      const H = g.h;
      const u = g.u;
      const y1 = Math.round(H * 0.66);
      const y2 = Math.round(H * 0.75);
      const col = (x, n) => Math.min(n - 1, Math.floor((x / W) * n));
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let c;
          if (y < y1) c = BARS[col(x, 7)];
          else if (y < y2) c = CASTLE[col(x, 7)];
          else {
            // -I, white, +Q, black, then the three-step black level blocks, then black.
            const f = x / W;
            const bar = W / 7;
            if (f < 1.25 / 7) c = [0, 33, 76];
            else if (f < 2.5 / 7) c = [235, 235, 235];
            else if (f < 3.75 / 7) c = [50, 0, 106];
            else if (f < 5 / 7) c = [19, 19, 19];
            else if (x < 5 * bar + bar / 3) c = [9, 9, 9];
            else if (x < 5 * bar + (bar * 2) / 3) c = [19, 19, 19];
            else if (x < 6 * bar) c = [29, 29, 29];
            else c = [19, 19, 19];
          }
          g.set(x, y, c);
        }
      }
      // Identification box with a white rule round it.
      if (p.label) {
        const s = Math.max(1, Math.round(u));
        const tw = textWidth(p.label, s);
        const bw = tw + 10 * s;
        const bh = 5 * s + 8 * s;
        const bx = Math.round((W - bw) / 2);
        const by = Math.round(y1 * 0.5 - bh / 2);
        g.rect(bx, by, bw, bh, [12, 12, 14]);
        g.rect(bx + s, by + s, bw - 2 * s, 1, WHITE);
        g.rect(bx + s, by + bh - s - 1, bw - 2 * s, 1, WHITE);
        g.rect(bx + s, by + s, 1, bh - 2 * s, WHITE);
        g.rect(bx + bw - s - 1, by + s, 1, bh - 2 * s, WHITE);
        g.text(bx + 5 * s, by + 4 * s, p.label, WHITE, s);
      }
      // Scanlines, a little tape noise and, if wobbly, a tracking band that tears the picture sideways.
      g.scanlines(0.12);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (hash(x, y, seed) < 0.01) g.blend(x, y, WHITE, 0.4);
      if (p.tracking === 'yes') {
        const ty = Math.round(H * (0.82 + hash(seed, 7) * 0.12));
        const th = Math.max(2, Math.round(3 * u));
        for (let y = ty; y < Math.min(H, ty + th); y++) {
          const shift = Math.round((hash(y, 1, seed) - 0.3) * 10 * u);
          const row = [];
          for (let x = 0; x < W; x++) row.push(g.get(x - shift, y));
          for (let x = 0; x < W; x++) {
            const nz = hash(x, y, seed + 5);
            g.set(x, y, nz > 0.7 ? mix(row[x], WHITE, 0.6) : nz < 0.15 ? mix(row[x], BLACK, 0.5) : row[x]);
          }
        }
        for (let x = 0; x < W; x++) if (bayer(x, ty - 1) > 0.5) g.blend(x, ty - 1, WHITE, 0.3);
      }
    });
  },
};
