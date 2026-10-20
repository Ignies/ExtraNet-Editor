// A starship hangar: roof trusses and lamps, back wall with an open bay door onto space on the detail side, and a
// floor with perspective guide lines and edge lights. Empty, ready for a ship sprite.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, fbm, hash, num, WHITE, BLACK } from '../_kit.js';
import { GROUP, FOCUS, timeParam } from './_scene.js';

export default {
  id: 'scene-hangar',
  name: 'Starship hangar',
  group: GROUP,
  tags: ['scenery', 'space', 'interior', 'military'],
  params: [
    { key: 'wall', label: 'Walls', type: 'color', default: '#2C3138' },
    { key: 'floor', label: 'Floor', type: 'color', default: '#3A3F46' },
    { key: 'lights', label: 'Lights', type: 'color', default: '#FFB43A' },
    { key: 'space', label: 'Space', type: 'color', default: '#060A18' },
    { key: 'door', label: 'Bay door width', type: 'range', min: 0.2, max: 0.6, step: 0.01, default: 0.38 },
    FOCUS,
    timeParam('night'),
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const wall = hex(p.wall);
      const floor = hex(p.floor);
      const lights = hex(p.lights);
      const space = hex(p.space);
      const n = makeNoise(seed);
      const r = rng(seed);
      const fy = Math.round(g.h * 0.68);
      const dw = Math.round(g.w * num(p.door, 0.38));
      const dx = p.focus === 'left' ? Math.round(g.w * 0.06) : p.focus === 'center' ? Math.round((g.w - dw) / 2) : g.w - dw - Math.round(g.w * 0.06);
      const dy = Math.round(g.h * 0.2);
      // Back wall.
      for (let y = 0; y < fy; y++) for (let x = 0; x < g.w; x++) g.set(x, y, ramp([mix(wall, BLACK, 0.45), mix(wall, BLACK, 0.2), wall], y / fy + (fbm(n, x * 0.04, y * 0.04, 2) - 0.5) * 0.4, x, y));
      for (let x = 0; x < g.w; x += Math.round(22 * g.u)) g.rect(x, dy - 4, 1, fy - dy + 4, mix(wall, BLACK, 0.5));
      // Bay door: space with stars, framed by hazard stripes.
      for (let y = dy; y < fy; y++) {
        for (let x = dx; x < dx + dw; x++) {
          let c = space;
          if (hash(x, y, seed) < 0.02) c = mix(space, WHITE, 0.3 + hash(y, x, seed) * 0.7);
          g.set(x, y, c);
        }
      }
      g.glow(dx + dw * 0.5, fy, dw * 0.7, g.h * 0.25, mix(space, [80, 120, 255], 0.6), 0.3);
      const st = Math.max(2, Math.round(3 * g.u));
      for (let y = dy - st; y < fy; y++) {
        for (const x0 of [dx - st, dx + dw]) for (let x = x0; x < x0 + st; x++) g.set(x, y, Math.floor((x + y) / 3) % 2 ? [24, 22, 18] : [220, 170, 40]);
      }
      for (let x = dx - st; x < dx + dw + st; x++) for (let y = dy - st; y < dy; y++) g.set(x, y, Math.floor((x + y) / 3) % 2 ? [24, 22, 18] : [220, 170, 40]);
      // Roof trusses and lamps.
      const truss = mix(wall, BLACK, 0.6);
      g.rect(0, 0, g.w, Math.round(4 * g.u), truss);
      for (let x = 0; x < g.w; x += Math.round(8 * g.u)) {
        g.line(x, 0, x + 4 * g.u, 4 * g.u, mix(wall, BLACK, 0.3));
      }
      for (let x = Math.round(20 * g.u); x < g.w; x += Math.round(48 * g.u)) {
        g.rect(x - 3, Math.round(4 * g.u), 7, 2, mix(lights, WHITE, 0.5));
        g.glow(x, 4 * g.u + 2, 14 * g.u, 10 * g.u, lights, 0.3);
        g.glow(x, fy + 4 * g.u, 24 * g.u, 5 * g.u, lights, 0.2);
      }
      // Floor with perspective lines towards the door centre.
      const vx = dx + dw / 2;
      for (let y = fy; y < g.h; y++) {
        const t = (y - fy) / (g.h - fy);
        for (let x = 0; x < g.w; x++) g.set(x, y, ramp([mix(floor, BLACK, 0.35), floor, mix(floor, WHITE, 0.08)], t * 1.4 + (n(x * 0.1, y * 0.3) - 0.5) * 0.3, x, y));
      }
      for (let k = -8; k <= 8; k++) {
        const bx = vx + k * 40 * g.u;
        g.line(vx + k * 3 * g.u, fy, bx, g.h - 1, k % 4 === 0 ? [220, 170, 40] : mix(floor, WHITE, 0.15));
      }
      g.rect(0, fy, g.w, 1, mix(floor, WHITE, 0.25));
      for (let x = 4; x < g.w; x += Math.round(14 * g.u)) {
        g.set(x, fy + 1, lights);
        g.glow(x, fy + 1, 4, 2, lights, 0.4);
      }
      void r;
      g.vignette(BLACK, 0.45);
    });
  },
};
