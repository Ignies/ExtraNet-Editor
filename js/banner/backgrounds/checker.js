// A checkerboard: flat, as a perspective floor running to a horizon, or rippling like a waving flag.
import { PIXEL, paint, hex, mix, ramp, num, clamp, BLACK, WHITE } from './_kit.js';

export default {
  id: 'checkerboard',
  name: 'Checkerboard',
  tags: ['retro', 'sports', '80s'],
  params: [
    { key: 'a', label: 'Colour one', type: 'color', default: '#ECE6DA' },
    { key: 'b', label: 'Colour two', type: 'color', default: '#17161C' },
    { key: 'sky', label: 'Sky (floor)', type: 'color', default: '#2A1A4A' },
    { key: 'size', label: 'Square size', type: 'range', min: 0.3, max: 3, step: 0.05, default: 1 },
    { key: 'mode', label: 'Style', type: 'select', default: 'flat', options: [['flat', 'Flat'], ['floor', 'Perspective floor'], ['wave', 'Waving flag']] },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const ca = hex(p.a);
      const cb = hex(p.b);
      const sky = hex(p.sky);
      const s = Math.max(2, Math.round(8 * g.u * num(p.size, 1)));
      const phase = (seed % 100) / 100 * Math.PI * 2;
      if (p.mode === 'floor') {
        const hz = Math.round(g.h * 0.32);
        const skyTones = [mix(sky, BLACK, 0.4), sky, mix(sky, WHITE, 0.25)];
        for (let y = 0; y < hz; y++) for (let x = 0; x < g.w; x++) g.set(x, y, ramp(skyTones, y / hz, x, y));
        const cx = g.w / 2;
        for (let y = hz; y < g.h; y++) {
          const dy = y - hz + 0.5;
          const z = (g.h * 1.6) / dy;
          const fog = clamp(1 - dy / (g.h - hz) * 1.6);
          for (let x = 0; x < g.w; x++) {
            const X = ((x - cx) / dy) * (s * 0.18);
            const on = (Math.floor(X) + Math.floor(z * (s * 0.05) * 4)) % 2 === 0;
            const c = on ? ca : cb;
            g.set(x, y, fog > 0.6 ? ramp([c, mix(sky, WHITE, 0.25)], (fog - 0.6) * 2.5, x, y) : c);
          }
        }
        g.rect(0, hz, g.w, 1, mix(sky, WHITE, 0.5));
        return;
      }
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          let fx = x;
          let fy = y;
          let shade = 0;
          if (p.mode === 'wave') {
            const w = Math.sin(x / g.h * 4 + phase);
            fy = y + w * 3 * g.u;
            fx = x + Math.cos(y / g.h * 3 + phase) * 2 * g.u;
            shade = Math.cos(x / g.h * 4 + phase) * 0.22;
          }
          const on = (Math.floor(fx / s) + Math.floor(fy / s)) % 2 === 0;
          let c = on ? ca : cb;
          if (shade > 0) c = ramp([c, mix(c, WHITE, 0.25)], shade * 4, x, y);
          else if (shade < 0) c = ramp([c, mix(c, BLACK, 0.35)], -shade * 4, x, y);
          g.set(x, y, c);
        }
      }
      g.vignette(BLACK, 0.3);
    });
  },
};
