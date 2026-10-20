// A city skyline: two rows of tower blocks with lit windows, roof lights and antennas, tallest on the detail side.
import { PIXEL, paint, hex, mix, rng, hash, num, WHITE } from '../_kit.js';
import { GROUP, FOCUS, timeParam, tod, weight, sky, stars, titleShade } from './_scene.js';

export default {
  id: 'scene-skyline',
  name: 'City skyline',
  group: GROUP,
  tags: ['scenery', 'city'],
  params: [
    { key: 'skyTop', label: 'Sky top', type: 'color', default: '#1A1240' },
    { key: 'skyLow', label: 'Sky low', type: 'color', default: '#B4467A' },
    { key: 'blocks', label: 'Buildings', type: 'color', default: '#141428' },
    { key: 'windows', label: 'Windows', type: 'color', default: '#FFD27A' },
    { key: 'lights', label: 'Lit windows', type: 'range', min: 0, max: 1, step: 0.05, default: 0.45 },
    FOCUS,
    timeParam('night'),
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const time = p.time;
      const top = tod(hex(p.skyTop), time);
      const low = tod(hex(p.skyLow), time, 0.7);
      const blocks = tod(hex(p.blocks), time, 0.3);
      const win = hex(p.windows);
      const lit = num(p.lights, 0.45) * (time === 'day' ? 0.25 : 1);
      const r = rng(seed);
      sky(g, top, low, 0, g.h, 7);
      if (time === 'night') stars(g, seed, 1, Math.round(g.h * 0.5));
      // Back row: paler, shorter; front row: dark, taller.
      for (const [row, shade, scale] of [[0, mix(blocks, low, 0.45), 0.7], [1, blocks, 1]]) {
        let x = -Math.floor(r() * 6);
        while (x < g.w) {
          const bw = Math.round((8 + r() * 16) * g.u);
          const wgt = weight(p.focus, x + bw / 2, g.w);
          const bh = Math.round(g.h * scale * (0.12 + wgt * (0.35 + r() * 0.35)));
          const y0 = g.h - bh;
          g.rect(x, y0, bw - (row ? 1 : 0), bh, shade);
          g.rect(x, y0, bw - 1, 1, mix(shade, low, 0.5));
          // Windows on a grid, some lit.
          for (let wy = y0 + 3; wy < g.h - 2; wy += 3) {
            for (let wx = x + 2; wx < x + bw - 3; wx += 3) {
              const h = hash(wx, wy, seed + row);
              if (h < lit * (row ? 0.55 : 0.3)) g.set(wx, wy, row ? win : mix(win, shade, 0.5));
              else if (row && h > 0.97) g.set(wx, wy, mix(win, WHITE, 0.4));
            }
          }
          if (row && bh > g.h * 0.4 && r() < 0.6) {
            const ax = x + Math.floor(bw / 2);
            const ah = Math.round((3 + r() * 6) * g.u);
            g.rect(ax, y0 - ah, 1, ah, shade);
            g.set(ax, y0 - ah - 1, [255, 70, 70]);
            g.glow(ax + 0.5, y0 - ah - 0.5, 3, 3, [255, 70, 70], 0.4);
          }
          x += bw;
        }
      }
      titleShade(g, p.focus, mix(top, [0, 0, 0], 0.5), 0.3);
    });
  },
};
