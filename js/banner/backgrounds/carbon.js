// Carbon fibre: a 2x2 twill of rounded tows. The two weave directions catch two different sheen bands, so the
// pattern shimmers diagonally like the real material.
import { PIXEL, paint, hex, mix, ramp, num, BLACK } from './_kit.js';

export default {
  id: 'carbon-fibre',
  name: 'Carbon fibre',
  tags: ['sports', 'tech'],
  params: [
    { key: 'base', label: 'Base', type: 'color', default: '#0C0D10' },
    { key: 'weave', label: 'Weave', type: 'color', default: '#2B2F36' },
    { key: 'sheen', label: 'Sheen', type: 'color', default: '#7C8696' },
    { key: 'shine', label: 'Shine', type: 'range', min: 0, max: 1, step: 0.05, default: 0.55 },
    { key: 'size', label: 'Weave size', type: 'range', min: 2, max: 8, step: 1, default: 3 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const base = hex(p.base);
      const weave = hex(p.weave);
      const sheen = hex(p.sheen);
      const shine = num(p.shine, 0.55);
      const s = Math.max(2, Math.round(num(p.size, 3) * Math.max(1, g.u * 0.75)));
      const tones = [base, mix(base, weave, 0.5), weave, mix(weave, sheen, 0.4), sheen];
      const off = ((seed * 0.6180339) % 1) * 0.6;
      for (let y = 0; y < g.h; y++) {
        const j = Math.floor(y / s);
        const yy = (y % s + 0.5) / s;
        for (let x = 0; x < g.w; x++) {
          const i = Math.floor(x / s);
          const xx = (x % s + 0.5) / s;
          const horiz = (((i - j) % 4) + 4) % 4 < 2;
          const across = horiz ? yy : xx;
          const along = horiz ? xx : yy;
          let v = Math.sin(across * Math.PI) * 0.55 + 0.1;
          // Thin gaps at tow edges and where tows dive under.
          if (across < 0.12 || across > 0.88) v *= 0.35;
          v *= 0.85 + 0.15 * Math.sin(along * Math.PI);
          const d = x / g.w - off - (y / g.h) * 0.35;
          const band = horiz ? Math.exp(-Math.pow((d - 0.25) * 4, 2)) : Math.exp(-Math.pow((d - 0.55) * 4, 2));
          v += band * shine * 0.5;
          g.set(x, y, ramp(tones, v, x, y));
        }
      }
      g.vignette(BLACK, 0.3);
    });
  },
};
