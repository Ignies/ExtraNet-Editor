// A colony galley: tiled walls under a strip light, a chalk menu board, a rail of hanging pans, a cooker under an
// extractor hood, shelves of tins, and a long steel counter across the bottom for the cook to stand behind.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, fbm, hash, BLACK, WHITE } from '../_kit.js';
import { GROUP, FOCUS } from './_scene.js';
import { bevel, textCentre } from './_broadcast.js';

const MENU = ['CHOW', 'SOY LOAF', 'GREENS', 'RED BEANS', 'COFFEE'];

export default {
  id: 'scene-galley',
  name: 'Galley',
  group: GROUP,
  tags: ['scenery', 'interior', 'food', 'colony'],
  params: [
    { key: 'tiles', label: 'Tiles', type: 'color', default: '#B8C4B0' },
    { key: 'lower', label: 'Lower wall', type: 'color', default: '#4E6A5A' },
    { key: 'steel', label: 'Steel', type: 'color', default: '#9AA2A8' },
    { key: 'accent', label: 'Accent', type: 'color', default: '#D86A2A' },
    { key: 'light', label: 'Light', type: 'color', default: '#FFF4D8' },
    FOCUS,
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const tiles = hex(p.tiles);
      const lower = hex(p.lower);
      const steel = hex(p.steel);
      const accent = hex(p.accent);
      const light = hex(p.light);
      const r = rng(seed);
      const n = makeNoise(seed);
      const u = g.u;
      const W = g.w;
      const H = g.h;
      const ceil = Math.round(6 * u);
      const dado = Math.round(H * 0.6);
      const cy = Math.round(H * 0.74);
      // Tiles: a grout grid, every tile a touch different, grimier towards the floor.
      const ts = Math.max(3, Math.round(6 * u));
      for (let y = ceil; y < dado; y++) {
        for (let x = 0; x < W; x++) {
          const tx = Math.floor(x / ts);
          const ty = Math.floor((y - ceil) / ts);
          let c = mix(tiles, BLACK, 0.08 + hash(tx, ty, seed) * 0.08 + (y / dado) * 0.12);
          if (x % ts === 0 || (y - ceil) % ts === 0) c = mix(tiles, BLACK, 0.35);
          else if (x % ts === 1 || (y - ceil) % ts === 1) c = mix(c, WHITE, 0.15);
          g.set(x, y, c);
        }
      }
      // Painted lower wall with a trim stripe.
      for (let y = dado; y < cy; y++) for (let x = 0; x < W; x++) g.set(x, y, ramp([mix(lower, BLACK, 0.3), lower], 0.7 + (fbm(n, x * 0.05, y * 0.05, 2) - 0.5) * 0.4, x, y));
      g.rect(0, dado, W, Math.max(2, Math.round(2 * u)), accent);
      g.rect(0, dado + Math.max(2, Math.round(2 * u)), W, 1, mix(accent, BLACK, 0.5));
      // Ceiling and strip light.
      g.rect(0, 0, W, ceil, mix(lower, BLACK, 0.6));
      g.rect(W * 0.2, ceil - 2 * u, W * 0.6, 2 * u, mix(light, WHITE, 0.5));
      g.rect(W * 0.2, ceil, W * 0.6, 1, mix(lower, BLACK, 0.4));
      g.glow(W / 2, ceil, W * 0.6, H * 0.6, light, 0.25);
      const flip = p.focus === 'left';
      const X = f => (flip ? W - f * W : f * W);
      // Menu board on the left (chalk on green) with a frame.
      const mbW = Math.round(W * 0.2);
      const mbH = Math.round(H * 0.36);
      const mbX = Math.round(flip ? W - W * 0.04 - mbW : W * 0.04);
      const mbY = Math.round(ceil + 7 * u);
      bevel(g, mbX - 2, mbY - 2, mbW + 4, mbH + 4, [92, 64, 40], 0.3);
      for (let y = mbY; y < mbY + mbH; y++) for (let x = mbX; x < mbX + mbW; x++) g.set(x, y, ramp([[30, 48, 38], [40, 60, 48]], fbm(n, x * 0.1, y * 0.1, 2), x, y));
      textCentre(g, mbX + mbW / 2, mbY + 3 * u, MENU[0], [240, 236, 200], Math.max(1, Math.round(u)));
      for (let i = 1; i < MENU.length; i++) {
        const ly = Math.round(mbY + 3 * u + 7 * Math.max(1, Math.round(u)) + (i - 1) * 7);
        if (ly + 5 > mbY + mbH - 2) break;
        g.text(mbX + 3, ly, MENU[i], [214, 220, 200]);
        g.set(mbX + mbW - 6, ly + 2, [240, 200, 120]);
        g.set(mbX + mbW - 5, ly + 2, [240, 200, 120]);
      }
      // A clock above the middle.
      const ccx = X(0.31);
      const ccy = ceil + 9 * u;
      g.disc(ccx, ccy, 5 * u, [240, 240, 232]);
      g.circle(ccx, ccy, 5 * u, [40, 40, 44]);
      g.line(ccx, ccy, ccx, ccy - 3.5 * u, [30, 30, 34]);
      g.line(ccx, ccy, ccx + 2.5 * u, ccy + 1 * u, [30, 30, 34]);
      // Pan rail with hanging pans and ladles over the middle.
      const railY = Math.round(ceil + 4 * u);
      const rx0 = X(0.38);
      const rx1 = X(0.53);
      g.rect(Math.min(rx0, rx1), railY, Math.abs(rx1 - rx0), Math.max(1, Math.round(u)), mix(steel, BLACK, 0.3));
      for (let k = 0; k < 5; k++) {
        const hx = Math.round(Math.min(rx0, rx1) + (k + 0.5) * Math.abs(rx1 - rx0) / 5);
        const hl = Math.round((3 + (k % 2) * 3) * u);
        g.rect(hx, railY, 1, hl, mix(steel, BLACK, 0.4));
        if (k % 2 === 0) {
          const pr = (2.5 + r() * 1.5) * u;
          g.disc(hx + 0.5, railY + hl + pr, pr, mix(steel, BLACK, 0.45));
          g.disc(hx + 0.5 - pr * 0.3, railY + hl + pr - pr * 0.3, pr * 0.4, mix(steel, WHITE, 0.2));
        } else {
          g.rect(hx - u, railY + hl, 2 * u + 1, 2 * u, mix(steel, WHITE, 0.1));
        }
      }
      // Cooker and extractor hood on the right.
      const hoodW = Math.round(W * 0.24);
      const hoodX = Math.round(flip ? W * 0.05 : W * 0.95 - hoodW);
      const hoodY = Math.round(ceil);
      const hoodH = Math.round(H * 0.18);
      for (let y = 0; y < hoodH; y++) {
        const t = y / hoodH;
        const inset = Math.round((1 - t) * hoodW * 0.25);
        for (let x = hoodX + inset; x < hoodX + hoodW - inset; x++) g.set(x, hoodY + y, ramp([mix(steel, WHITE, 0.25), steel, mix(steel, BLACK, 0.3)], (x - hoodX) / hoodW * 0.8 + t * 0.3, x, hoodY + y));
      }
      g.rect(hoodX - 1, hoodY + hoodH, hoodW + 2, Math.max(2, Math.round(2 * u)), mix(steel, BLACK, 0.4));
      g.glow(hoodX + hoodW / 2, hoodY + hoodH + 3 * u, hoodW * 0.5, 10 * u, [255, 220, 150], 0.3);
      // Shelves of tins beside the hood.
      const shX = Math.round(flip ? hoodX + hoodW + 4 * u : hoodX - 4 * u - W * 0.12);
      const shW = Math.round(W * 0.12);
      for (let k = 0; k < 2; k++) {
        const sy = Math.round(ceil + 14 * u + k * 13 * u);
        g.rect(shX, sy, shW, Math.max(1, Math.round(u)), mix(steel, BLACK, 0.35));
        for (let x = shX + 1; x < shX + shW - 3 * u; x += Math.round(4 * u)) {
          const th = Math.round((4 + hash(x, k, seed) * 3) * u);
          const col = [[200, 60, 50], [220, 180, 60], [80, 130, 190], [200, 200, 200]][Math.floor(hash(k, x, seed) * 4)];
          g.rect(x, sy - th, 3 * u, th, col);
          g.rect(x, sy - th, 3 * u, 1, mix(col, WHITE, 0.4));
          g.rect(x, sy - th + Math.round(th * 0.4), 3 * u, Math.max(1, Math.round(u)), mix(col, WHITE, 0.7));
        }
      }
      // Cooker top: pots steaming on the back of the counter, under the hood.
      for (let k = 0; k < 2; k++) {
        const px = Math.round(hoodX + hoodW * (0.3 + k * 0.4));
        const pw = Math.round(9 * u);
        const ph = Math.round(7 * u);
        g.rect(px - pw / 2, cy - ph, pw, ph, mix(steel, BLACK, 0.2));
        g.rect(px - pw / 2, cy - ph, pw, 1, mix(steel, WHITE, 0.4));
        g.rect(px - pw / 2 - u, cy - ph + u, u, u, mix(steel, BLACK, 0.5));
        g.rect(px + pw / 2, cy - ph + u, u, u, mix(steel, BLACK, 0.5));
        for (let s2 = 0; s2 < 3; s2++) {
          for (let y = 0; y < 10 * u; y++) {
            const x = px + Math.round(Math.sin(y * 0.35 / u + s2 * 2 + k) * 1.5 * u) + (s2 - 1) * 2 * u;
            g.dot(x, cy - ph - 2 - y, WHITE, 0.6 - y / (10 * u) * 0.5);
          }
        }
      }
      // The counter: a steel top, a front of cupboard doors, and a kick plate.
      const topH = Math.max(3, Math.round(3 * u));
      g.rect(0, cy, W, topH, mix(steel, WHITE, 0.2));
      g.rect(0, cy, W, 1, mix(steel, WHITE, 0.6));
      g.rect(0, cy + topH, W, 1, mix(steel, BLACK, 0.5));
      for (let y = cy + topH + 1; y < H; y++) {
        for (let x = 0; x < W; x++) g.set(x, y, ramp([mix(steel, WHITE, 0.08), steel, mix(steel, BLACK, 0.25)], (y - cy) / (H - cy) + (n(x * 0.3, y * 0.03) - 0.5) * 0.3, x, y));
      }
      const doorW = Math.round(30 * u);
      for (let x = Math.round((W % doorW) / 2); x < W; x += doorW) {
        g.rect(x, cy + topH + 2, 1, H - cy - topH - 6 * u, mix(steel, BLACK, 0.45));
        g.rect(x + 1, cy + topH + 2, 1, H - cy - topH - 6 * u, mix(steel, WHITE, 0.3));
        g.rect(x + doorW / 2 - 3 * u, cy + topH + 4 * u, 6 * u, Math.max(1, Math.round(u)), mix(steel, BLACK, 0.55));
      }
      g.rect(0, H - 4 * u, W, 4 * u, mix(lower, BLACK, 0.55));
      g.rect(0, H - 4 * u, W, 1, mix(steel, BLACK, 0.3));
      g.vignette(BLACK, 0.35);
    });
  },
};
