// Wooden planks, like the wall behind Rosie Ketch: boards of slightly different tone with flowing grain, the odd
// knot, dark seams and nail heads.
import { PIXEL, paint, hex, mix, ramp, makeNoise, hash, num, BLACK, WHITE } from '../_kit.js';
import { GROUP, LIGHT, VIGNETTE, light } from './_mat.js';

export default {
  id: 'mat-wood',
  name: 'Wood planks',
  group: GROUP,
  tags: ['material', 'western', 'colony'],
  params: [
    { key: 'wood', label: 'Wood', type: 'color', default: '#6A3E22' },
    { key: 'grain', label: 'Grain', type: 'color', default: '#3A1E10' },
    { key: 'dir', label: 'Planks', type: 'select', default: 'horizontal', options: [['horizontal', 'Horizontal'], ['vertical', 'Vertical']] },
    { key: 'size', label: 'Plank width', type: 'range', min: 0.4, max: 2.5, step: 0.05, default: 1 },
    { key: 'grainK', label: 'Grain', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6 },
    { key: 'wear', label: 'Wear', type: 'range', min: 0, max: 1, step: 0.05, default: 0.3 },
    LIGHT,
    VIGNETTE,
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const wood = hex(p.wood);
      const grain = hex(p.grain);
      const gk = num(p.grainK, 0.6);
      const wear = num(p.wear, 0.3);
      const n = makeNoise(seed);
      const vertical = p.dir === 'vertical';
      const pw = Math.max(4, Math.round(11 * g.u * num(p.size, 1)));
      const cache = new Map();
      const span = vertical ? g.h : g.w;
      const warps = new Float32Array(span * (Math.ceil((vertical ? g.w : g.h) / pw) + 1)).fill(NaN);
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          // Along / across the plank.
          const a = vertical ? y : x;
          const c = vertical ? x : y;
          const plank = Math.floor(c / pw);
          const within = c - plank * pw;
          // Boards are cut into lengths with staggered butt joints.
          const len = Math.round(90 * g.u);
          const stagger = hash(plank, 1, seed) * len;
          const piece = Math.floor((a + stagger) / len);
          const key = plank * 4096 + piece;
          let t = cache.get(key);
          if (!t) {
            const tone = (hash(plank, piece, seed) - 0.5) * 0.5;
            const base = tone > 0 ? mix(wood, WHITE, tone * 0.25) : mix(wood, BLACK, -tone * 0.4);
            t = [mix(base, grain, 0.55), mix(base, grain, 0.25), base, mix(base, WHITE, 0.12)];
            cache.set(key, t);
          }
          // Grain: stretched noise rings warped along the board.
          // The warp only changes along the board, so it is worked out once per board and position.
          const wi = plank * span + a;
          let warp = warps[wi];
          if (Number.isNaN(warp)) {
            warp = n(a * 0.02 / g.u + plank * 7, piece * 3) * 6 + n(a * 0.05, plank) * 3;
            warps[wi] = warp;
          }
          const ring = Math.sin((within + warp) * 1.6 / g.u);
          let v = 0.62 + ring * 0.22 * gk + (n(a * 0.3 / g.u, c * 1.5 / g.u + plank) - 0.5) * 0.35 * gk;
          // A knot now and then.
          const kx = (piece + 0.5) * len - stagger;
          const kd = Math.hypot((a - kx) / 3, within - pw / 2);
          if (hash(piece, plank, seed + 5) < 0.18 && kd < pw * 0.45) v = 0.15 + Math.abs(Math.sin(kd * 1.8)) * 0.4;
          if (hash(x, y, seed) < wear * 0.05) v -= 0.4;
          let col = ramp(t, v, x, y);
          if (within === 0) col = mix(grain, BLACK, 0.5);
          else if (within === 1) col = mix(col, WHITE, 0.15);
          else if (within === pw - 1) col = mix(col, BLACK, 0.25);
          const joint = (a + stagger) % len;
          if (joint < 1) col = mix(grain, BLACK, 0.4);
          if ((joint === 3 || joint === len - 4) && (within === 3 || within === pw - 3)) col = [150, 150, 150];
          g.set(x, y, col);
        }
      }
      light(g, p);
    });
  },
};
