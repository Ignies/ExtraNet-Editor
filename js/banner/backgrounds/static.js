// Dead-channel static: grainy noise with brighter and darker rows, a few torn lines, a rolling bar and specks of
// colour bleed.
import { PIXEL, paint, hex, mix, rng, hash, num, BLACK } from './_kit.js';

export default {
  id: 'static-noise',
  name: 'Static noise',
  tags: ['deep', 'retro'],
  params: [
    { key: 'dark', label: 'Dark', type: 'color', default: '#0A0A0D' },
    { key: 'light', label: 'Light', type: 'color', default: '#B9BEC8' },
    { key: 'tint', label: 'Colour bleed', type: 'color', default: '#3A5CFF' },
    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 1, step: 0.05, default: 0.55 },
    { key: 'tears', label: 'Tears', type: 'range', min: 0, max: 1, step: 0.05, default: 0.4 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const dk = hex(p.dark);
      const lt = hex(p.light);
      const tint = hex(p.tint);
      const k = num(p.intensity, 0.55);
      const tears = num(p.tears, 0.4);
      const r = rng(seed);
      const rowGain = new Float32Array(g.h);
      const rowShift = new Int32Array(g.h);
      for (let y = 0; y < g.h; y++) {
        rowGain[y] = 0.8 + r() * 0.4;
        if (r() < tears * 0.08) {
          const len = 1 + Math.floor(r() * 3);
          const sh = Math.floor((r() - 0.5) * g.w * 0.4);
          for (let j = 0; j < len && y + j < g.h; j++) {
            rowShift[y + j] = sh;
            rowGain[y + j] = 1.4;
          }
        }
      }
      const bar = r() * g.h;
      const barH = g.h * 0.25;
      const levels = [dk, mix(dk, lt, 0.25), mix(dk, lt, 0.5), mix(dk, lt, 0.75), lt];
      for (let y = 0; y < g.h; y++) {
        let b = (y - bar) / barH;
        b = Math.exp(-b * b) * 0.2;
        for (let x = 0; x < g.w; x++) {
          const sx = x + rowShift[y];
          let v = hash(sx, y, seed);
          v = Math.pow(v, 2.2 - k * 1.4) * rowGain[y] * (0.45 + k * 0.6) + b;
          const i = Math.max(0, Math.min(4, Math.floor(v * 5)));
          let c = levels[i];
          if (hash(sx, y, seed + 5) < 0.015 * k) c = mix(c, tint, 0.7);
          g.set(x, y, c);
        }
      }
      g.scanlines(0.2, 2);
      g.vignette(BLACK, 0.5);
    });
  },
};
