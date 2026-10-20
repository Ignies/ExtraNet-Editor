// A duotone halftone split: two colours that blend through a band of halftone dots growing from one into the
// other, like a two-ink print.
import { PIXEL, paint, hex, num, clamp } from '../_kit.js';
import { GROUP } from './_split.js';

export default {
  id: 'split-duotone',
  name: 'Duotone halftone',
  group: GROUP,
  tags: ['split', 'print', '80s'],
  params: [
    { key: 'a', label: 'Colour one', type: 'color', default: '#FF4F79' },
    { key: 'b', label: 'Colour two', type: 'color', default: '#2B1E4A' },
    { key: 'pos', label: 'Middle', type: 'range', min: 0.1, max: 0.9, step: 0.01, default: 0.5 },
    { key: 'spread', label: 'Blend width', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.5 },
    { key: 'dot', label: 'Dot size', type: 'range', min: 0.5, max: 2.5, step: 0.05, default: 1 },
    { key: 'angle', label: 'Direction', type: 'range', min: 0, max: 180, step: 5, default: 0 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const ca = hex(p.a);
      const cb = hex(p.b);
      const pos = num(p.pos, 0.5);
      const spread = num(p.spread, 0.5);
      const cell = Math.max(3, 6 * g.u * num(p.dot, 1));
      const ang = (num(p.angle, 0) * Math.PI) / 180;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const span = Math.abs(dx) * g.w + Math.abs(dy) * g.h;
      const c45 = Math.SQRT1_2;
      void seed;
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          const along = ((x - g.w / 2) * dx + (y - g.h / 2) * dy) / span + 0.5;
          const t = clamp((along - pos) / spread + 0.5);
          // Dot screen at 45 degrees; dot radius grows with t until the dots merge.
          const u = (x * c45 + y * c45) / cell;
          const v = (-x * c45 + y * c45) / cell;
          const fu = u - Math.floor(u) - 0.5;
          const fv = v - Math.floor(v) - 0.5;
          const d = Math.sqrt(fu * fu + fv * fv);
          g.set(x, y, d < Math.sqrt(t) * 0.72 ? cb : ca);
        }
      }
    });
  },
};
