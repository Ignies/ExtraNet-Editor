// A jungle treeline: three layers of ragged canopy with leaf clumps, hanging vines and mist between the layers.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, fbm, hash, num, BLACK } from '../_kit.js';
import { GROUP, FOCUS, timeParam, tod, weight, sky, stars, titleShade } from './_scene.js';

export default {
  id: 'scene-jungle',
  name: 'Jungle treeline',
  group: GROUP,
  tags: ['scenery', 'jungle'],
  params: [
    { key: 'skyTop', label: 'Sky top', type: 'color', default: '#20364A' },
    { key: 'skyLow', label: 'Sky low', type: 'color', default: '#8FB89A' },
    { key: 'leaves', label: 'Leaves', type: 'color', default: '#2F5A2A' },
    { key: 'mist', label: 'Mist', type: 'color', default: '#B8D4C0' },
    { key: 'mistAmount', label: 'Mist', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
    FOCUS,
    timeParam('dusk'),
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const time = p.time;
      const top = tod(hex(p.skyTop), time);
      const low = tod(hex(p.skyLow), time, 0.8);
      const leaves = tod(hex(p.leaves), time, 0.5);
      const mist = tod(hex(p.mist), time, 0.5);
      const mk = num(p.mistAmount, 0.5);
      const r = rng(seed);
      const n = makeNoise(seed);
      sky(g, top, low, 0, g.h, 6);
      if (time === 'night') stars(g, seed, 0.8, Math.round(g.h * 0.4));
      for (let layer = 0; layer < 3; layer++) {
        const t = layer / 2;
        const col = mix(mix(leaves, low, 0.6 * (1 - t)), BLACK, t * 0.45);
        const lit = mix(col, low, 0.25);
        const deep = mix(col, BLACK, 0.35);
        const base = g.h * (0.62 - layer * 0.12);
        const sc = (0.05 + layer * 0.03) / g.u;
        for (let x = 0; x < g.w; x++) {
          const wgt = 0.35 + 0.65 * weight(p.focus, x, g.w);
          const bump = fbm(n, x * sc, layer * 9.3, 3);
          // Round crowns: a chain of half-circles of varying width.
          const cw = (10 + layer * 6) * g.u;
          const ci = Math.floor(x / cw + layer * 0.37);
          const cr = cw * (0.5 + hash(ci, layer, seed) * 0.5);
          const cx = (ci + 0.5 - layer * 0.37) * cw;
          const dx = (x - cx) / cr;
          const crowns = dx * dx < 1 ? Math.sqrt(1 - dx * dx) * (0.15 + hash(layer, ci, seed) * 0.25) : 0;
          const h = (base * 0.4 + (bump * 0.6 + crowns) * g.h * 0.55 * wgt) * (0.7 + layer * 0.2);
          const y0 = Math.floor(g.h - h);
          for (let y = Math.max(0, y0); y < g.h; y++) {
            const leaf = hash(Math.floor(x / (2 * g.u)), Math.floor(y / (2 * g.u)), seed + layer);
            g.set(x, y, ramp([lit, col, deep], (y - y0) / (g.h * 0.5) + (leaf - 0.5) * 0.9, x, y));
          }
          if (hash(x, layer, seed) < 0.04 * wgt) {
            const len = (4 + hash(layer, x, seed) * 14) * g.u;
            for (let k = 0; k < len; k++) g.set(x + Math.round(Math.sin(k * 0.3) * 0.6), y0 + k, deep);
          }
        }
        if (layer < 2 && mk > 0) {
          for (let y = 0; y < g.h; y++) {
            const a = mk * 0.5 * Math.exp(-Math.pow((y - (g.h - base * 0.55)) / (g.h * 0.12), 2)) * (0.6 + fbm(n, y * 0.1, layer * 5 + r(), 2) * 0.8);
            if (a > 0.04) for (let x = 0; x < g.w; x++) g.dot(x, y, mist, a * (0.6 + n(x * 0.04, y * 0.2 + layer) * 0.8));
          }
        }
      }
      titleShade(g, p.focus, mix(top, BLACK, 0.5), 0.3);
    });
  },
};
