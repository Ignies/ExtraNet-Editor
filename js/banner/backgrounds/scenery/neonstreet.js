// A rainy street at night: facades with neon signs and lit windows, a wet road reflecting the signs in long
// broken streaks, and slanting rain.
import { PIXEL, paint, hex, mix, rng, hash, num, WHITE, BLACK } from '../_kit.js';
import { GROUP, FOCUS, timeParam, tod, weight, sky, titleShade } from './_scene.js';

export default {
  id: 'scene-neon-street',
  name: 'Rainy neon street',
  group: GROUP,
  tags: ['scenery', 'city', '80s'],
  params: [
    { key: 'sky', label: 'Sky', type: 'color', default: '#0C0A1C' },
    { key: 'walls', label: 'Buildings', type: 'color', default: '#1A1830' },
    { key: 'neonA', label: 'Neon one', type: 'color', default: '#FF2BD6' },
    { key: 'neonB', label: 'Neon two', type: 'color', default: '#2BE3FF' },
    { key: 'road', label: 'Road', type: 'color', default: '#101018' },
    { key: 'rain', label: 'Rain', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
    FOCUS,
    timeParam('night'),
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const time = p.time;
      const skyC = tod(hex(p.sky), time, 0.4);
      const walls = tod(hex(p.walls), time, 0.3);
      const neons = [hex(p.neonA), hex(p.neonB), mix(hex(p.neonA), [255, 210, 80], 0.6)];
      const road = hex(p.road);
      const r = rng(seed);
      const hz = Math.round(g.h * 0.66);
      sky(g, skyC, mix(skyC, neons[0], 0.25), 0, hz, 5);
      // The scene above the road is mirrored into it, so draw facades into a column record.
      const signs = [];
      let x = 0;
      while (x < g.w) {
        const bw = Math.round((14 + r() * 26) * g.u);
        const wgt = weight(p.focus, x + bw / 2, g.w);
        const bh = Math.round(hz * (0.3 + wgt * 0.55 + r() * 0.1));
        const shade = mix(walls, BLACK, r() * 0.3);
        g.rect(x, hz - bh, bw - 1, bh, shade);
        g.rect(x + bw - 1, hz - bh, 1, bh, mix(shade, BLACK, 0.5));
        for (let wy = hz - bh + 3; wy < hz - 4; wy += 4) {
          for (let wx = x + 2; wx < x + bw - 3; wx += 4) {
            if (hash(wx, wy, seed) < 0.25) g.rect(wx, wy, 2, 2, mix([255, 200, 120], shade, 0.35));
          }
        }
        if (wgt > 0.25 && r() < 0.85) {
          const c = neons[Math.floor(r() * neons.length)];
          const vertical = r() < 0.4;
          const sw = vertical ? Math.round(4 * g.u) : Math.round(bw * 0.6);
          const sh = vertical ? Math.round(bh * 0.45) : Math.round(5 * g.u);
          const sx = x + Math.round((bw - sw) / 2);
          const sy = hz - bh + Math.round(bh * (0.15 + r() * 0.3));
          signs.push([sx, sy, sw, sh, c]);
        }
        x += bw;
      }
      for (const [sx, sy, sw, sh, c] of signs) {
        g.glow(sx + sw / 2, sy + sh / 2, sw * 0.9 + 6, sh * 0.9 + 6, c, 0.45);
        g.rect(sx, sy, sw, sh, mix(c, BLACK, 0.55));
        g.rect(sx, sy, sw, 1, c);
        g.rect(sx, sy + sh - 1, sw, 1, c);
        g.rect(sx, sy, 1, sh, c);
        g.rect(sx + sw - 1, sy, 1, sh, c);
        for (let k = 2; k < (sw > sh ? sw : sh) - 2; k += 3) {
          if (sw > sh) g.rect(sx + k, sy + 2, 2, sh - 4, mix(c, WHITE, 0.3));
          else g.rect(sx + 1, sy + k, sw - 2, 2, mix(c, WHITE, 0.3));
        }
      }
      // The wet road: a dark gradient with the scene above reflected in broken streaks.
      for (let y = hz; y < g.h; y++) {
        const t = (y - hz) / (g.h - hz);
        for (let xx = 0; xx < g.w; xx++) {
          const src = g.get(xx, hz - 1 - (y - hz) * 2);
          let c = mix(road, src, 0.35 * (1 - t * 0.6));
          if (hash(xx >> 1, y, seed + 3) < 0.25) c = mix(c, road, 0.6);
          g.set(xx, y, c);
        }
      }
      g.rect(0, hz, g.w, 1, mix(road, WHITE, 0.15));
      const rk = num(p.rain, 0.5);
      for (let i = 0, c = g.w * g.h * 0.006 * rk; i < c; i++) {
        const rx = r() * g.w;
        const ry = r() * g.h;
        const len = (3 + r() * 4) * g.u;
        g.line(rx, ry, rx - len * 0.3, ry + len, mix(skyC, WHITE, 0.45), 0.5);
      }
      titleShade(g, p.focus, BLACK, 0.3);
    });
  },
};
