// Ship hull plating: rows of bevelled panels of mixed widths, bolts, vent slots, small hazard patches, grime and a
// strip of glowing running lights.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, fbm, num, BLACK, WHITE } from './_kit.js';

export default {
  id: 'hull-plating',
  name: 'Hull plating',
  tags: ['space', 'industrial', 'military'],
  params: [
    { key: 'plate', label: 'Plates', type: 'color', default: '#3C434C' },
    { key: 'seam', label: 'Seams', type: 'color', default: '#14171B' },
    { key: 'light', label: 'Lights', type: 'color', default: '#FFB23A' },
    { key: 'stripe', label: 'Hazard paint', type: 'color', default: '#D9A521' },
    { key: 'detail', label: 'Detail', type: 'range', min: 0, max: 1, step: 0.05, default: 0.55 },
    { key: 'lights', label: 'Light strip', type: 'select', default: 'bottom', options: [['bottom', 'Bottom'], ['top', 'Top'], ['none', 'None']] },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const plate = hex(p.plate);
      const seam = hex(p.seam);
      const lightC = hex(p.light);
      const stripe = hex(p.stripe);
      const detail = num(p.detail, 0.55);
      const r = rng(seed);
      const n = makeNoise(seed);
      const sc = 4 / g.h;
      const W = g.w;
      const H = g.h;
      // Background tone with grime.
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const v = fbm(n, x * sc, y * sc, 3);
          g.set(x, y, ramp([mix(plate, BLACK, 0.3), mix(plate, BLACK, 0.12), plate], 1.3 - v * 0.9, x, y));
        }
      }
      const stripH = p.lights === 'none' ? 0 : Math.round(8 * g.u);
      const top = p.lights === 'top' ? stripH : 0;
      const bottom = p.lights === 'bottom' ? H - stripH : H;
      // Rows of panels.
      let y = top;
      while (y < bottom) {
        const rh = Math.min(bottom - y, Math.round((14 + r() * 16) * g.u));
        let x = -Math.floor(r() * 20 * g.u);
        while (x < W) {
          const pw = Math.round((24 + r() * 60) * g.u);
          const tone = (r() - 0.5) * 0.18;
          const base = tone > 0 ? mix(plate, WHITE, tone) : mix(plate, BLACK, -tone);
          g.rect(x + 1, y + 1, pw - 2, rh - 2, base, 0.55);
          g.rect(x, y, pw, 1, seam);
          g.rect(x, y, 1, rh, seam);
          g.rect(x + 1, y + 1, pw - 2, 1, WHITE, 0.18);
          g.rect(x + 1, y + 1, 1, rh - 2, WHITE, 0.1);
          g.rect(x + 1, y + rh - 2, pw - 2, 1, BLACK, 0.3);
          g.rect(x + pw - 2, y + 1, 1, rh - 2, BLACK, 0.25);
          // Bolts in the corners.
          if (rh > 6 && pw > 8) {
            for (const [bx, by] of [[x + 3, y + 3], [x + pw - 4, y + 3], [x + 3, y + rh - 4], [x + pw - 4, y + rh - 4]]) {
              g.set(bx, by, mix(plate, WHITE, 0.35));
              g.set(bx + 1, by + 1, mix(plate, BLACK, 0.5));
            }
          }
          const roll = r();
          if (roll < detail * 0.35 && pw > 20 && rh > 10) {
            // Vent slots.
            const vx = x + Math.round(pw * 0.25);
            const vw = Math.round(pw * 0.5);
            for (let vy = y + 4; vy < y + rh - 4; vy += 3) {
              g.rect(vx, vy, vw, 1, seam);
              g.rect(vx, vy + 1, vw, 1, WHITE, 0.1);
            }
          } else if (roll < detail * 0.5 && pw > 16 && rh > 8) {
            // A hazard patch.
            const hw = Math.round(Math.min(pw * 0.4, 24 * g.u));
            const hh = Math.round(4 * g.u);
            const hx = x + pw - hw - 5;
            const hy = y + rh - hh - 4;
            for (let yy = 0; yy < hh; yy++) for (let xx = 0; xx < hw; xx++) g.set(hx + xx, hy + yy, Math.floor((xx + yy) / 3) % 2 ? seam : stripe);
          } else if (roll < detail * 0.7 && pw > 14 && rh > 8) {
            // A recessed hatch outline.
            const hx = x + 5;
            const hy = y + 4;
            const hw = Math.round(pw * 0.35);
            const hh = rh - 8;
            g.rect(hx, hy, hw, 1, seam);
            g.rect(hx, hy, 1, hh, seam);
            g.rect(hx, hy + hh, hw + 1, 1, WHITE, 0.15);
            g.rect(hx + hw, hy, 1, hh, WHITE, 0.15);
          }
          x += pw;
        }
        y += rh;
      }
      if (stripH) {
        const sy = p.lights === 'top' ? 0 : H - stripH;
        g.rect(0, sy, W, stripH, seam);
        g.rect(0, sy, W, 1, mix(plate, WHITE, 0.2));
        const step = Math.round(16 * g.u);
        const ly = sy + Math.floor(stripH / 2) - 1;
        for (let lx = Math.round(step / 2); lx < W; lx += step) {
          g.glow(lx + 1, ly + 1, 8 * g.u, 5 * g.u, lightC, 0.5);
          g.rect(lx, ly, 3, 2, mix(lightC, WHITE, 0.5));
        }
      }
      g.vignette(BLACK, 0.4);
    });
  },
};
