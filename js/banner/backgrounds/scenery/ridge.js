// A mountain ridge under two moons: jagged ranges with snow caps and lit faces, haze between the ranges.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, fbm, num, WHITE, BLACK } from '../_kit.js';
import { GROUP, FOCUS, timeParam, tod, weight, sky, stars, titleShade } from './_scene.js';

export default {
  id: 'scene-ridge',
  name: 'Mountains and moons',
  group: GROUP,
  tags: ['scenery', 'space'],
  params: [
    { key: 'skyTop', label: 'Sky top', type: 'color', default: '#0E1430' },
    { key: 'skyLow', label: 'Sky low', type: 'color', default: '#5A4A8A' },
    { key: 'rock', label: 'Rock', type: 'color', default: '#2C2A40' },
    { key: 'moon', label: 'Moons', type: 'color', default: '#F2E6C8' },
    { key: 'moons', label: 'Moons', type: 'range', min: 0, max: 2, step: 1, default: 2 },
    { key: 'snow', label: 'Snow caps', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
    FOCUS,
    timeParam('night'),
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const time = p.time;
      const top = tod(hex(p.skyTop), time, 0.4);
      const low = tod(hex(p.skyLow), time, 0.6);
      const rock = tod(hex(p.rock), time, 0.3);
      const moon = hex(p.moon);
      const snowK = num(p.snow, 0.5);
      const r = rng(seed);
      const n = makeNoise(seed);
      sky(g, top, low, 0, g.h, 7);
      if (time !== 'day') stars(g, seed, 1, Math.round(g.h * 0.7));
      const mx = p.focus === 'left' ? g.w * 0.2 : p.focus === 'center' ? g.w * 0.5 : g.w * 0.8;
      const count = Math.round(num(p.moons, 2));
      if (count > 0) {
        const mr = g.h * 0.17;
        g.glow(mx, g.h * 0.3, mr * 3, mr * 3, moon, 0.25);
        g.disc(mx, g.h * 0.3, mr, moon);
        g.disc(mx + mr * 0.35, g.h * 0.3 - mr * 0.2, mr * 0.85, mix(moon, top, time === 'day' ? 0.15 : 0.25));
        for (let i = 0; i < 6; i++) g.disc(mx - mr * 0.5 + r() * mr * 0.6, g.h * 0.3 - mr * 0.5 + r() * mr, 1 + r() * 1.5 * g.u, mix(moon, BLACK, 0.12));
      }
      if (count > 1) {
        const ox = mx + (p.focus === 'left' ? 1 : -1) * g.h * 0.55;
        g.disc(ox, g.h * 0.16, g.h * 0.06, mix(moon, low, 0.3));
      }
      // Three ranges, back to front; ridged noise for the jagged peaks.
      for (let layer = 0; layer < 3; layer++) {
        const t = layer / 2;
        const col = mix(mix(rock, low, 0.55 * (1 - t)), BLACK, t * 0.25);
        const litC = mix(col, moon, 0.18);
        const off = r() * 50;
        let prev = 0;
        for (let x = 0; x < g.w; x++) {
          const wgt = 0.3 + 0.7 * weight(p.focus, x, g.w);
          const ridgeV = Math.pow(1 - Math.abs(fbm(n, x * (0.016 + layer * 0.008) / g.u + off, layer * 3, 4) * 2 - 1), 1.5);
          const h = g.h * (0.1 + 0.1 * (2 - layer) + ridgeV * 0.6 * wgt) * (0.75 + t * 0.25);
          const y0 = Math.floor(g.h - h);
          const lit = h > prev;
          prev = h;
          for (let y = Math.max(0, y0); y < g.h; y++) {
            const fromTop = (y - y0) / g.h;
            let c = ramp([lit ? litC : col, col, mix(col, BLACK, 0.2)], fromTop * 2.5, x, y);
            if (y < g.h * (0.42 + snowK * 0.2) && fromTop < 0.03 + snowK * 0.1 && n(x * 0.4, y * 0.4) < 0.8) c = lit ? mix(mix(WHITE, moon, 0.3), col, t * 0.3) : mix(mix(WHITE, low, 0.5), col, 0.2 + t * 0.3);
            g.set(x, y, c);
          }
        }
        if (layer < 2) for (let y = Math.floor(g.h * 0.55); y < g.h; y++) for (let x = 0; x < g.w; x++) g.dot(x, y, low, 0.12 * (y / g.h));
      }
      titleShade(g, p.focus, mix(top, BLACK, 0.4), 0.25);
    });
  },
};
