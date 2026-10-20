// A snowfield under an aurora: rippling curtains of light, a distant ridge and snowdrifts with blue shadows.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, fbm, num, clamp, bayer, WHITE, BLACK } from '../_kit.js';
import { GROUP, FOCUS, timeParam, tod, weight, sky, stars, titleShade } from './_scene.js';

export default {
  id: 'scene-aurora',
  name: 'Snowfield aurora',
  group: GROUP,
  tags: ['scenery', 'cold'],
  params: [
    { key: 'skyTop', label: 'Sky top', type: 'color', default: '#071430' },
    { key: 'skyLow', label: 'Sky low', type: 'color', default: '#1D3C66' },
    { key: 'auroraA', label: 'Aurora', type: 'color', default: '#3DF2A0' },
    { key: 'auroraB', label: 'Aurora edge', type: 'color', default: '#B05CFF' },
    { key: 'snow', label: 'Snow', type: 'color', default: '#DCE8F5' },
    { key: 'strength', label: 'Aurora strength', type: 'range', min: 0, max: 1, step: 0.05, default: 0.7 },
    FOCUS,
    timeParam('night'),
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const time = p.time;
      const top = tod(hex(p.skyTop), time, 0.4);
      const low = tod(hex(p.skyLow), time, 0.4);
      const aA = hex(p.auroraA);
      const aB = hex(p.auroraB);
      const snow = hex(p.snow);
      const k = num(p.strength, 0.7) * (time === 'day' ? 0.25 : 1);
      const r = rng(seed);
      const n = makeNoise(seed);
      sky(g, top, low, 0, g.h, 6);
      stars(g, seed, time === 'day' ? 0 : 1, Math.round(g.h * 0.7));
      // Aurora: a wavy ribbon; brightness falls off below it in long vertical rays.
      const ph = r() * 10;
      for (let x = 0; x < g.w; x++) {
        const wgt = 0.3 + 0.7 * weight(p.focus, x, g.w);
        const cy = g.h * (0.22 + 0.12 * Math.sin(x * 0.025 / g.u + ph) + 0.06 * Math.sin(x * 0.07 / g.u + ph * 2));
        const rays = 0.6 + 0.4 * n(x * 0.35 / g.u, 0.5);
        const flick = k * wgt * (0.5 + fbm(n, x * 0.02 / g.u, ph, 2));
        for (let y = 0; y < g.h * 0.75; y++) {
          const d = (y - cy) / g.h;
          let a = d < 0 ? Math.exp(-d * d * 300) : Math.exp(-d * 5) * rays;
          a *= flick;
          if (a > 0.05) g.blend(x, y, ramp([aB, aA, mix(aA, WHITE, 0.4)], clamp(a * 1.4 - (d < 0 ? 0.6 : 0)), x, y), Math.round(clamp(a) * 4 + bayer(x, y) - 0.5) / 4);
        }
      }
      // Ridge and snowfield.
      const ridge = mix(low, BLACK, 0.35);
      const drift = [mix(snow, low, 0.55), mix(snow, low, 0.3), snow];
      for (let x = 0; x < g.w; x++) {
        const wgt = 0.4 + 0.6 * weight(p.focus, x, g.w);
        const rh = g.h * (0.18 + Math.abs(fbm(n, x * 0.02 / g.u, 4, 3) - 0.5) * 0.6 * wgt);
        for (let y = Math.floor(g.h * 0.78 - rh); y < g.h; y++) g.set(x, y, ridge);
        const sh = g.h * (0.2 + fbm(n, x * 0.012 / g.u, 9, 3) * 0.12);
        const y0 = Math.floor(g.h - sh);
        for (let y = y0; y < g.h; y++) g.set(x, y, ramp(drift, 1 - (y - y0) / sh * 0.4 + (n(x * 0.06, y * 0.3) - 0.5) * 0.8 - (time === 'night' ? 0.35 : 0), x, y));
      }
      titleShade(g, p.focus, mix(top, BLACK, 0.5), 0.25);
    });
  },
};
