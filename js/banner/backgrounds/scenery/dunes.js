// Desert dunes: a low sun, three ranges of dunes with a lit face and a shadow face each, and drifting sand.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, num, WHITE, BLACK } from '../_kit.js';
import { GROUP, FOCUS, timeParam, tod, weight, sky, stars, titleShade } from './_scene.js';

export default {
  id: 'scene-dunes',
  name: 'Desert dunes',
  group: GROUP,
  tags: ['scenery', 'desert'],
  params: [
    { key: 'skyTop', label: 'Sky top', type: 'color', default: '#3A1E4A' },
    { key: 'skyLow', label: 'Sky low', type: 'color', default: '#F08A4B' },
    { key: 'sand', label: 'Sand', type: 'color', default: '#C9773E' },
    { key: 'sun', label: 'Sun', type: 'color', default: '#FFE2A0' },
    { key: 'height', label: 'Dune height', type: 'range', min: 0.2, max: 1, step: 0.05, default: 0.6 },
    FOCUS,
    timeParam('dusk'),
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const time = p.time;
      const top = tod(hex(p.skyTop), time);
      const low = tod(hex(p.skyLow), time, 0.8);
      const sand = tod(hex(p.sand), time, 0.6);
      const sun = hex(p.sun);
      const hk = num(p.height, 0.6);
      const r = rng(seed);
      const n = makeNoise(seed);
      sky(g, top, low, 0, g.h, 7);
      if (time === 'night') stars(g, seed, 1, Math.round(g.h * 0.55));
      const sx = p.focus === 'left' ? g.w * 0.22 : p.focus === 'center' ? g.w * 0.5 : g.w * 0.78;
      const sy = g.h * 0.36;
      const sr = g.h * 0.16;
      if (time !== 'night') {
        g.glow(sx, sy, sr * 4, sr * 2.2, sun, 0.35);
        g.disc(sx, sy, sr, sun);
      } else g.disc(sx, g.h * 0.25, sr * 0.6, mix(sun, WHITE, 0.6));
      // Dunes: a crest shape (steep lee face, long windward slope) from a warped sine; the face turned to the sun
      // is lit, the other is in shadow.
      const sunSide = sx > g.w / 2 ? 1 : -1;
      const ranges = [[0.36, 0.25, 60], [0.22, 0.6, 95], [0.08, 1, 150]];
      ranges.forEach(([base, near, wl], i) => {
        const col = mix(sand, low, 0.5 * (1 - near));
        const shadow = mix(col, top, 0.4 + 0.15 * near);
        const lit = mix(col, sun, 0.3);
        const off = r() * 100;
        const len = wl * g.u;
        for (let x = 0; x < g.w; x++) {
          const wgt = 0.35 + 0.65 * weight(p.focus, x, g.w);
          const ph = (x / len + off + 0.25 * Math.sin(x / len * 2.1 + off)) % 1;
          // Sawtooth-like crest: rises slowly, drops fast.
          const shape = ph < 0.7 ? Math.sin((ph / 0.7) * Math.PI / 2) : Math.cos(((ph - 0.7) / 0.3) * Math.PI / 2);
          const h = g.h * (base + shape * 0.34 * hk * (0.25 + 0.75 * wgt) * (0.5 + near * 0.5) + (n(x * 0.02 / g.u, i * 5) - 0.5) * 0.04);
          const y0 = Math.floor(g.h - h);
          const facing = (ph < 0.7 ? 1 : -1) * sunSide > 0;
          for (let y = Math.max(0, y0); y < g.h; y++) {
            const depth = (y - y0) / g.h;
            g.set(x, y, facing ? ramp([lit, col], depth * 4, x, y) : ramp([col, shadow], 0.6 + depth * 2, x, y));
          }
          g.set(x, y0, facing ? mix(lit, WHITE, 0.3) : mix(col, sun, 0.15));
        }
      });
      titleShade(g, p.focus, mix(top, BLACK, 0.4), 0.25);
    });
  },
};
