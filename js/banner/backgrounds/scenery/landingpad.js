// A colony landing pad at night: low hills and far lights on the horizon, a concrete apron with painted pad
// markings, a parked dropship on the detail side with its rear ramp down and lit inside, and floodlight towers
// throwing beams across the pad. The near corner on the other side stays open.
import { PIXEL, paint, hex, mix, ramp, makeNoise, fbm, hash, bayer, BLACK, WHITE } from '../_kit.js';
import { GROUP, FOCUS, timeParam, tod, sky, stars } from './_scene.js';
import { fillPoly } from './_broadcast.js';

// The dropship in side view facing left, in units of its length (x) and height (y, 0 at the fin tips, 1 at the
// feet, which stand at 0.83). Parts are drawn in this order, later ones over earlier ones.
const HULL = [[0, 0.53], [0.04, 0.45], [0.12, 0.37], [0.2, 0.31], [0.32, 0.28], [0.74, 0.28], [0.88, 0.33], [1, 0.37], [1, 0.57], [0.86, 0.63], [0.3, 0.67], [0.12, 0.65], [0.04, 0.6]];
const FIN_BACK = [[0.8, 0.29], [0.86, 0.04], [0.91, 0.04], [0.93, 0.31]];
const FIN = [[0.84, 0.3], [0.9, 0.0], [0.96, 0.0], [0.98, 0.34]];
const NACELLE = [[0.48, 0.24], [0.52, 0.19], [0.84, 0.19], [0.86, 0.22], [0.86, 0.3], [0.84, 0.32], [0.52, 0.32], [0.48, 0.28]];
const WING = [[0.44, 0.44], [0.68, 0.42], [0.74, 0.48], [0.48, 0.53]];
const POD = [[0.5, 0.53], [0.66, 0.53], [0.68, 0.57], [0.5, 0.58]];
const GLASS = [[0.055, 0.45], [0.12, 0.38], [0.2, 0.33], [0.23, 0.39], [0.1, 0.47]];
const GEAR = [[[0.17, 0.64], [0.2, 0.64], [0.2, 0.8], [0.17, 0.8]], [[0.6, 0.64], [0.63, 0.64], [0.63, 0.8], [0.6, 0.8]], [[0.76, 0.62], [0.79, 0.62], [0.79, 0.8], [0.76, 0.8]]];
const FEET = [[[0.14, 0.79], [0.23, 0.79], [0.23, 0.83], [0.14, 0.83]], [[0.57, 0.79], [0.66, 0.79], [0.66, 0.83], [0.57, 0.83]], [[0.73, 0.79], [0.82, 0.79], [0.82, 0.83], [0.73, 0.83]]];
const DOOR = [[0.9, 0.4], [1, 0.38], [1, 0.58], [0.9, 0.6]];
const RAMP = [[0.9, 0.6], [1, 0.58], [1.12, 0.82], [1.02, 0.83]];

export default {
  id: 'scene-landing-pad',
  name: 'Landing pad',
  group: GROUP,
  tags: ['scenery', 'colony', 'military', 'outdoor', 'ship'],
  params: [
    { key: 'skyTop', label: 'Sky top', type: 'color', default: '#1C2238' },
    { key: 'skyLow', label: 'Sky low', type: 'color', default: '#6A5A6A' },
    { key: 'hull', label: 'Dropship', type: 'color', default: '#4A5442' },
    { key: 'pad', label: 'Pad', type: 'color', default: '#5A5C5E' },
    { key: 'paint', label: 'Pad markings', type: 'color', default: '#E8B830' },
    { key: 'flood', label: 'Floodlights', type: 'color', default: '#F2F4FF' },
    FOCUS,
    timeParam('night'),
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const time = p.time;
      const top = tod(hex(p.skyTop), time);
      const low = tod(hex(p.skyLow), time, 0.7);
      const hull = tod(hex(p.hull), time, 0.4);
      const pad = tod(hex(p.pad), time, 0.4);
      const mark = hex(p.paint);
      const flood = hex(p.flood);
      const n = makeNoise(seed);
      const u = g.u;
      const W = g.w;
      const H = g.h;
      const hy = Math.round(H * 0.46);
      const side = p.focus === 'left' ? -1 : 1;
      sky(g, top, low, 0, hy + 1, 7);
      if (time !== 'day') stars(g, seed, time === 'night' ? 1 : 0.4, Math.round(H * 0.4));
      // Hills and far colony lights.
      for (let x = 0; x < W; x++) {
        const ry = Math.round(hy - (fbm(n, x * 0.01 / u, 1.7, 3) * 16 + 1) * u);
        for (let y = ry; y <= hy; y++) g.set(x, y, mix(mix(top, low, 0.5), BLACK, 0.45));
      }
      for (let x = 0; x < W; x++) if (hash(x, 4, seed) < 0.12) g.set(x, hy - 1 - Math.floor(hash(x, 5, seed) * 2 * u), mix([255, 200, 120], low, 0.3));
      // The apron: concrete slabs in perspective, oil stains, a painted pad circle with a centre cross.
      const vx = W / 2;
      for (let y = hy + 1; y < H; y++) {
        const t = (y - hy) / (H - hy);
        for (let x = 0; x < W; x++) {
          const v = 0.25 + t * 0.45 + (fbm(n, x * 0.04 / u, y * 0.1 / u + 4, 3) - 0.5) * 0.5;
          g.set(x, y, ramp([mix(pad, BLACK, 0.45), mix(pad, BLACK, 0.2), pad], v, x, y));
        }
      }
      for (let k = 1; k < 8; k++) g.rect(0, Math.round(hy + (H - hy) * Math.pow(k / 8, 1.7)), W, 1, mix(pad, BLACK, 0.35));
      for (let k = -10; k <= 10; k++) g.line(vx + k * 12 * u, hy + 1, vx + k * 40 * u, H - 1, mix(pad, BLACK, 0.3));
      const pcx = W / 2 + side * W * 0.2;
      const pcy = hy + (H - hy) * 0.55;
      const prx = W * 0.3;
      const pry = (H - hy) * 0.3;
      for (let y = Math.floor(pcy - pry - 2); y < pcy + pry + 2; y++) {
        for (let x = Math.floor(pcx - prx - 2); x < pcx + prx + 2; x++) {
          const d = Math.hypot((x + 0.5 - pcx) / prx, (y + 0.5 - pcy) / pry);
          const ring = Math.abs(d - 1) < 1.6 / pry;
          const inner = Math.abs(d - 0.82) < 0.8 / pry && Math.floor(Math.atan2(y - pcy, x - pcx) * 6) % 2 === 0;
          if (ring || inner) g.set(x, y, mix(mark, pad, 0.25 + hash(x, y, seed) * 0.2));
        }
      }
      // Floodlight towers: drawn behind the ship, beams over the pad afterwards.
      const towers = side > 0 ? [W * 0.06, W * 0.97] : [W * 0.03, W * 0.94];
      const heads = [];
      for (const tx0 of towers) {
        const tx = Math.round(tx0);
        const base = Math.round(hy + 6 * u);
        const th = Math.round(H * 0.44);
        const steel = mix(top, BLACK, 0.35);
        g.rect(tx - u, base - th, Math.max(2, Math.round(2 * u)), th, steel);
        for (let y = base - th; y < base; y += Math.round(4 * u)) g.line(tx - u, y, tx + u, y + 4 * u, steel);
        g.rect(tx - 4 * u, base - th - 3 * u, 8 * u, 3 * u, steel);
        for (let k = 0; k < 3; k++) g.rect(tx - 3.5 * u + k * 2.5 * u, base - th - 2.5 * u, 2 * u, 2 * u, mix(flood, WHITE, 0.4));
        heads.push([tx, base - th - u]);
      }
      // The dropship.
      const sl = Math.round(W * 0.58);
      const sh = Math.round(sl * 0.5);
      const sx = side > 0 ? Math.round(W * 0.97 - sl) : Math.round(W * 0.03);
      const sy = Math.round(pcy + pry * 0.35 - sh * 0.83);
      const mask = new Uint8Array(W * H);
      const place = pts => pts.map(([x, y]) => [sx + (side > 0 ? x : 1 - x) * sl, sy + y * sh]);
      fillPoly(mask, W, H, place(FIN_BACK), 1);
      for (const leg of GEAR) fillPoly(mask, W, H, place(leg), 2);
      for (const foot of FEET) fillPoly(mask, W, H, place(foot), 2);
      fillPoly(mask, W, H, place(RAMP), 3);
      fillPoly(mask, W, H, place(HULL), 4);
      fillPoly(mask, W, H, place(DOOR), 5);
      fillPoly(mask, W, H, place(NACELLE), 6);
      fillPoly(mask, W, H, place(WING), 7);
      fillPoly(mask, W, H, place(POD), 8);
      fillPoly(mask, W, H, place(FIN), 9);
      fillPoly(mask, W, H, place(GLASS), 10);
      // Shadow under the ship first.
      for (let y = Math.round(sy + sh * 0.76); y < sy + sh * 0.9; y++) {
        for (let x = sx - 4 * u; x < sx + sl + 4 * u; x++) {
          const dx = (x - (sx + sl / 2)) / (sl * 0.55);
          const dy = (y - (sy + sh * 0.83)) / (sh * 0.07);
          if (dx * dx + dy * dy < 1) g.dot(x, y, BLACK, 0.55);
        }
      }
      const warm = [255, 210, 140];
      const base = {
        1: mix(hull, BLACK, 0.35), 2: mix(hull, BLACK, 0.5), 3: mix(hull, BLACK, 0.15), 4: hull, 5: warm,
        6: mix(hull, WHITE, 0.06), 7: mix(hull, BLACK, 0.15), 8: mix(hull, BLACK, 0.3), 9: mix(hull, WHITE, 0.04), 10: [120, 200, 170],
      };
      const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : mask[y * W + x]);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const id = mask[y * W + x];
          if (!id) continue;
          let c = base[id];
          if (id === 5) {
            c = ramp([mix(warm, WHITE, 0.3), warm, mix(warm, hull, 0.5)], (y - sy) / sh * 1.5 - 0.3, x, y);
          } else if (id === 10) {
            c = (x + y) % 5 === 0 ? mix(c, WHITE, 0.5) : mix(c, BLACK, 0.25);
          } else if (id === 3) {
            // The ramp, lit from inside, with tread lines.
            c = mix(warm, hull, 0.55);
            if (y % Math.max(2, Math.round(2 * u)) === 0) c = mix(c, BLACK, 0.25);
          } else {
            const above = at(x, y - 1);
            const below = at(x, y + 1);
            if (above !== id && above !== 10) c = mix(c, WHITE, 0.32);
            else if (at(x, y - 2) !== id && above !== 10) c = mix(c, WHITE, 0.12);
            else if (below !== id) c = mix(c, BLACK, 0.4);
            // Lower hull in shadow, in two dithered steps.
            const t = (y - sy) / sh;
            if (id === 4 && t > 0.52 + bayer(x, y) * 0.06) c = mix(c, BLACK, 0.22);
          }
          g.set(x, y, c);
        }
      }
      // Panel lines, a hull number and nav lights.
      const loc = (fx, fy) => [Math.round(sx + (side > 0 ? fx : 1 - fx) * sl), Math.round(sy + fy * sh)];
      for (const fx of [0.3, 0.42, 0.72]) {
        const [x0, y0] = loc(fx, 0.3);
        const [, y1] = loc(fx, 0.62);
        for (let y = y0; y < y1; y++) if (mask[y * W + x0] === 4) g.set(x0, y, mix(hull, BLACK, 0.35));
      }
      const [hx, hy2] = loc(0.27, 0.42);
      g.text(hx - (side > 0 ? 0 : 8), hy2, '07', mix(hull, WHITE, 0.4));
      const [rx, ry] = loc(0.02, 0.55);
      g.set(rx, ry, side > 0 ? [255, 60, 50] : [60, 255, 120]);
      g.glow(rx, ry, 3 * u, 3 * u, side > 0 ? [255, 60, 50] : [60, 255, 120], 0.4);
      const [fx2, fy2] = loc(0.93, 0.02);
      g.set(fx2, fy2, [255, 60, 50]);
      // Interior light spilling out of the door and down the ramp.
      const [dx, dy] = loc(1.06, 0.8);
      g.glow(dx, dy, 20 * u, 6 * u, warm, 0.35);
      // Beams from the towers across the pad, dithered so they stay in a few colours.
      for (const [tx, ty] of heads) {
        const aimX = pcx + (tx < W / 2 ? -1 : 1) * prx * 0.2;
        const aimY = pcy;
        const len = Math.hypot(aimX - tx, aimY - ty);
        const ux = (aimX - tx) / len;
        const uy = (aimY - ty) / len;
        for (let y = Math.max(0, Math.floor(ty)); y < H; y++) {
          for (let x = 0; x < W; x++) {
            const vx2 = x - tx;
            const vy2 = y - ty;
            const along = vx2 * ux + vy2 * uy;
            if (along < 0 || along > len * 1.2) continue;
            const across = Math.abs(vx2 * uy - vy2 * ux);
            const half = 2 * u + along * 0.22;
            if (across > half) continue;
            const a = (1 - across / half) * (1 - along / (len * 1.2)) * 0.5;
            if (a > bayer(x, y) * 0.7) g.blend(x, y, flood, 0.18);
          }
        }
        g.glow(tx, ty, 6 * u, 5 * u, flood, 0.6);
      }
      g.glow(pcx, pcy, prx * 0.9, pry * 0.9, flood, 0.18);
      g.vignette(BLACK, 0.45);
    });
  },
};
