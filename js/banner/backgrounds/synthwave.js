// An 80s synthwave sunset: banded sky, a striped sun on the horizon, distant mountains and a glowing perspective
// grid floor.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, fbm, num, clamp, BLACK, WHITE } from './_kit.js';

export default {
  id: 'synthwave',
  name: 'Synthwave sun',
  tags: ['80s', 'retro'],
  params: [
    { key: 'skyTop', label: 'Sky top', type: 'color', default: '#12042E' },
    { key: 'skyLow', label: 'Sky low', type: 'color', default: '#C23A8C' },
    { key: 'sunTop', label: 'Sun top', type: 'color', default: '#FFE45C' },
    { key: 'sunLow', label: 'Sun low', type: 'color', default: '#FF4F7A' },
    { key: 'grid', label: 'Grid', type: 'color', default: '#FF3FD0' },
    { key: 'horizon', label: 'Horizon', type: 'range', min: 0.35, max: 0.8, step: 0.01, default: 0.62 },
    { key: 'sunX', label: 'Sun position', type: 'range', min: 0, max: 1, step: 0.01, default: 0.74 },
    { key: 'mountains', label: 'Mountains', type: 'select', default: 'yes', options: [['yes', 'Mountains'], ['no', 'Flat']] },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const top = hex(p.skyTop);
      const low = hex(p.skyLow);
      const sunT = hex(p.sunTop);
      const sunL = hex(p.sunLow);
      const grid = hex(p.grid);
      const r = rng(seed);
      const n = makeNoise(seed);
      const hz = Math.round(g.h * num(p.horizon, 0.62));
      const sky = [top, mix(top, low, 0.25), mix(top, low, 0.5), mix(top, low, 0.75), low];
      const floor = mix(top, BLACK, 0.45);
      // Sky.
      for (let y = 0; y < hz; y++) {
        const v = Math.pow(y / hz, 1.4);
        for (let x = 0; x < g.w; x++) g.set(x, y, ramp(sky, v, x, y));
      }
      // Stars in the upper sky.
      for (let i = 0, c = g.w * g.h * 0.004; i < c; i++) {
        const y = r() * hz * 0.6;
        g.blend(r() * g.w, y, WHITE, (1 - y / (hz * 0.6)) * (0.4 + r() * 0.6));
      }
      // The sun.
      const sx = g.w * num(p.sunX, 0.74);
      const sr = g.h * 0.36;
      const sy = hz - sr * 0.15;
      g.glow(sx, sy, sr * 2.4, sr * 1.6, sunL, 0.35);
      for (let y = Math.floor(sy - sr); y < hz; y++) {
        const t = (y - (sy - sr)) / (sr * 2);
        // Slices widen towards the bottom of the sun.
        const below = (y - sy + sr * 0.15) / (sr * 0.9);
        if (below > 0) {
          const period = Math.max(3, Math.round(6 * g.u));
          const gap = Math.round(below * period * 0.7);
          if ((y - Math.floor(sy)) % period < gap) continue;
        }
        for (let x = Math.floor(sx - sr); x <= sx + sr; x++) {
          const dx = x + 0.5 - sx;
          const dy = y + 0.5 - sy;
          if (dx * dx + dy * dy <= sr * sr) g.set(x, y, ramp([sunT, mix(sunT, sunL, 0.5), sunL], t, x, y));
        }
      }
      // Mountains.
      if (p.mountains !== 'no') {
        const back = mix(top, low, 0.35);
        const front = mix(top, BLACK, 0.2);
        for (let x = 0; x < g.w; x++) {
          const h1 = Math.pow(fbm(n, x * 0.035 / g.u, 3.1, 3), 1.6) * g.h * 0.32;
          const h2 = Math.pow(fbm(n, x * 0.06 / g.u + 20, 7.7, 3), 2) * g.h * 0.22;
          for (let y = Math.floor(hz - h1); y < hz; y++) g.set(x, y, y === Math.floor(hz - h1) ? mix(back, low, 0.6) : back);
          for (let y = Math.floor(hz - h2); y < hz; y++) g.set(x, y, y === Math.floor(hz - h2) ? mix(front, grid, 0.5) : front);
        }
      }
      // Floor and grid.
      const cx = g.w / 2;
      const depth = g.h - hz;
      const floorTones = [mix(low, floor, 0.55), mix(low, floor, 0.8), floor];
      // The floor: dark, lit from the horizon, with horizontal lines closing up geometrically towards the horizon
      // and vertical lines running to the vanishing point.
      for (let y = hz; y < g.h; y++) {
        const fade = clamp((y - hz) / depth);
        for (let x = 0; x < g.w; x++) g.set(x, y, ramp(floorTones, fade * 3.5, x, y));
      }
      const lineCol = mix(grid, WHITE, 0.12);
      const shift = ((seed * 0.37) % 1) * 0.35;
      for (let k = 0, dy = depth * (1 - shift * 0.3); dy >= 2.5; k++, dy *= 0.66) g.rect(0, Math.round(hz + dy), g.w, 1, lineCol);
      const spread = Math.max(6, 22 * g.u);
      for (let k = -40; k <= 40; k++) {
        const bx = cx + k * spread;
        // Clip to the canvas edges so the lines meet the vanishing point at the horizon.
        // Outer lines stop before they run flat into a solid band (see neongrid.js).
        const end = Math.max(2, 1.5 * Math.abs(k));
        if (end >= depth) continue;
        g.line(bx, g.h - 1, cx + (bx - cx) * (end / depth), hz + end, lineCol);
      }
      g.glow(g.w / 2, hz, g.w * 0.7, g.h * 0.18, low, 0.3);
      g.rect(0, hz, g.w, 1, mix(grid, WHITE, 0.6));
    });
  },
};
