// A swamp: dead trees with crooked branches, still water that mirrors them, reeds and banks of low fog.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, fbm, num, BLACK } from '../_kit.js';
import { GROUP, FOCUS, timeParam, tod, weight, sky, stars, titleShade } from './_scene.js';

function branch(g, x, y, ang, len, w, col, r, depth) {
  const steps = Math.max(1, Math.round(len));
  let cx = x;
  let cy = y;
  for (let i = 0; i < steps; i++) {
    ang += (r() - 0.5) * 0.35;
    cx += Math.cos(ang);
    cy += Math.sin(ang);
    const ww = Math.max(1, Math.round(w * (1 - i / steps * 0.6)));
    g.rect(cx - ww / 2, cy, ww, 1, col);
  }
  if (depth > 0) {
    const k = 1 + Math.floor(r() * 2);
    for (let i = 0; i < k; i++) branch(g, cx, cy, ang + (r() - 0.5) * 1.6, len * (0.45 + r() * 0.25), w * 0.6, col, r, depth - 1);
  }
}

export default {
  id: 'scene-swamp',
  name: 'Foggy swamp',
  group: GROUP,
  tags: ['scenery', 'horror', 'jungle'],
  params: [
    { key: 'skyTop', label: 'Sky top', type: 'color', default: '#1E2A28' },
    { key: 'skyLow', label: 'Sky low', type: 'color', default: '#6F8A6A' },
    { key: 'trees', label: 'Trees', type: 'color', default: '#141A16' },
    { key: 'water', label: 'Water', type: 'color', default: '#22322C' },
    { key: 'fog', label: 'Fog', type: 'color', default: '#A8BCA4' },
    { key: 'fogAmount', label: 'Fog', type: 'range', min: 0, max: 1, step: 0.05, default: 0.4 },
    FOCUS,
    timeParam('dusk'),
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const time = p.time;
      const top = tod(hex(p.skyTop), time, 0.6);
      const low = tod(hex(p.skyLow), time, 0.6);
      const trees = tod(hex(p.trees), time, 0.2);
      const water = tod(hex(p.water), time, 0.4);
      const fog = tod(hex(p.fog), time, 0.5);
      const fk = num(p.fogAmount, 0.55);
      const r = rng(seed);
      const n = makeNoise(seed);
      const hz = Math.round(g.h * 0.68);
      sky(g, top, low, 0, hz, 6);
      if (time === 'night') stars(g, seed, 0.6, Math.round(hz * 0.6));
      // Far bank.
      for (let x = 0; x < g.w; x++) {
        const h = (2 + fbm(n, x * 0.03, 2, 3) * 8) * g.u;
        g.rect(x, hz - h, 1, h, mix(trees, low, 0.5));
      }
      // Trees, more and taller on the detail side; far ones paler.
      for (let i = 0; i < 40; i++) {
        let tx = r() * g.w;
        if (weight(p.focus, tx, g.w) < r() * 0.9) continue;
        const far = r() < 0.5;
        const col = far ? mix(trees, low, 0.45) : trees;
        const th = g.h * (far ? 0.35 : 0.55) * (0.6 + r() * 0.5);
        const base = hz + (far ? 0 : 2);
        branch(g, tx, base, -Math.PI / 2 + (r() - 0.5) * 0.3, th * 0.6, (far ? 2 : 4) * g.u, col, r, 3);
        tx += 0;
      }
      // Water mirrors the scene above, darker and rippled.
      for (let y = hz; y < g.h; y++) {
        const t = (y - hz) / (g.h - hz);
        for (let x = 0; x < g.w; x++) {
          const ripple = Math.round((n(x * 0.05, y * 0.6) - 0.5) * 3);
          const src = g.get(x + ripple, hz - 1 - (y - hz));
          g.set(x, y, ramp([mix(water, src, 0.45), mix(water, BLACK, 0.25)], t + (n(x * 0.3, y) - 0.5) * 0.3, x, y));
        }
      }
      // Reeds along the near edge.
      for (let x = 0; x < g.w; x++) {
        if (n(x * 0.15, 3) > 0.62 - weight(p.focus, x, g.w) * 0.15) {
          const h = (3 + n(x * 0.7, 5) * 7) * g.u;
          g.rect(x, g.h - h, 1, h, mix(trees, low, 0.15));
        }
      }
      // Fog banks.
      for (let y = 0; y < g.h; y++) {
        const band = Math.exp(-Math.pow((y - hz) / (g.h * 0.12), 2));
        for (let x = 0; x < g.w; x++) {
          const a = fk * (band * 0.75 + 0.12) * fbm(n, x * 0.02 / g.u, y * 0.08 / g.u, 3);
          if (a > 0.05) g.dot(x, y, fog, a * 1.2);
        }
      }
      titleShade(g, p.focus, mix(top, BLACK, 0.4), 0.2);
    });
  },
};
