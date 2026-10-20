// A CRT screen in phosphor glow: a dithered bloom from the middle, faint snow, a rolling bright band, scanlines and
// dark curved corners.
import { PIXEL, paint, hex, mix, ramp, hash, rng, num, BLACK } from './_kit.js';

export default {
  id: 'crt-phosphor',
  name: 'CRT phosphor',
  tags: ['terminal', 'retro'],
  params: [
    { key: 'screen', label: 'Screen', type: 'color', default: '#050C08' },
    { key: 'phosphor', label: 'Phosphor', type: 'color', default: '#2FD35A' },
    { key: 'glow', label: 'Glow', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
    { key: 'lines', label: 'Scanlines', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
    { key: 'snow', label: 'Snow', type: 'range', min: 0, max: 1, step: 0.05, default: 0.3 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const screen = hex(p.screen);
      const ph = hex(p.phosphor);
      const glow = num(p.glow, 0.5);
      const snow = num(p.snow, 0.3);
      const r = rng(seed);
      const tones = [screen, mix(screen, ph, 0.12), mix(screen, ph, 0.24), mix(screen, ph, 0.38), mix(screen, ph, 0.55)];
      const band = r() * g.h;
      const bandH = g.h * 0.18;
      const cx = g.w / 2;
      const cy = g.h / 2;
      for (let y = 0; y < g.h; y++) {
        const ny = (y + 0.5 - cy) / cy;
        let bd = (y - band) / bandH;
        bd = Math.exp(-bd * bd) * 0.12;
        for (let x = 0; x < g.w; x++) {
          const nx = (x + 0.5 - cx) / cx;
          let v = 0.12 + Math.exp(-(nx * nx * 0.9 + ny * ny * 1.5) * 1.3) * glow * 1.3 + bd;
          if (hash(x, y, seed) < snow * 0.12) v += 0.25 * hash(y, x, seed + 7);
          // Curved screen corners.
          const q = Math.pow(Math.pow(Math.abs(nx), 6) + Math.pow(Math.abs(ny), 6), 1 / 6);
          let c = ramp(tones, v, x, y);
          if (q > 0.86) c = ramp([c, mix(c, BLACK, 0.5), BLACK], (q - 0.86) / 0.16, x, y);
          g.set(x, y, c);
        }
      }
      g.scanlines(num(p.lines, 0.5) * 0.45, 2);
    });
  },
};
