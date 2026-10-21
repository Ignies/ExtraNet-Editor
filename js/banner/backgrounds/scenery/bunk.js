// A crew bunk room: ribbed metal walls with rivets, a caged lamp, a porthole onto the stars, a two-tier bunk with
// blankets and pillows on the detail side, a pin-up poster, a footlocker and a row of lockers, over deck plating.
// The middle and the other side of the floor stay open.
import { PIXEL, paint, hex, mix, ramp, makeNoise, fbm, hash, BLACK, WHITE } from '../_kit.js';
import { GROUP, FOCUS } from './_scene.js';
import { bevel, textCentre } from './_broadcast.js';

export default {
  id: 'scene-bunk',
  name: 'Bunk room',
  group: GROUP,
  tags: ['scenery', 'interior', 'military', 'colony'],
  params: [
    { key: 'wall', label: 'Walls', type: 'color', default: '#58625A' },
    { key: 'floor', label: 'Deck', type: 'color', default: '#3C403E' },
    { key: 'blanket', label: 'Blankets', type: 'color', default: '#5A6438' },
    { key: 'poster', label: 'Poster', type: 'color', default: '#E07A5A' },
    { key: 'light', label: 'Lamp', type: 'color', default: '#FFD898' },
    FOCUS,
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const wall = hex(p.wall);
      const floor = hex(p.floor);
      const blanket = hex(p.blanket);
      const poster = hex(p.poster);
      const light = hex(p.light);
      const n = makeNoise(seed);
      const u = g.u;
      const W = g.w;
      const H = g.h;
      const flip = p.focus === 'left';
      const X = f => (flip ? W - f * W : f * W);
      const fy = Math.round(H * 0.78);
      // Walls: ribbed plates with seams and rivets, a darker skirting and a ceiling beam.
      for (let y = 0; y < fy; y++) {
        for (let x = 0; x < W; x++) g.set(x, y, ramp([mix(wall, BLACK, 0.45), mix(wall, BLACK, 0.2), wall, mix(wall, WHITE, 0.08)], 0.5 + (fbm(n, x * 0.04, y * 0.04, 3) - 0.5) * 0.5 - (y / fy) * 0.25, x, y));
      }
      const plate = Math.round(28 * u);
      for (let x = Math.round(plate / 3); x < W; x += plate) {
        g.rect(x, 0, Math.max(2, Math.round(2 * u)), fy, mix(wall, BLACK, 0.35));
        g.rect(x, 0, 1, fy, mix(wall, WHITE, 0.15));
        for (let y = Math.round(10 * u); y < fy; y += Math.round(9 * u)) {
          g.set(x - 2, y, mix(wall, WHITE, 0.3));
          g.set(x + 3 * u, y, mix(wall, WHITE, 0.3));
        }
      }
      g.rect(0, Math.round(H * 0.32), W, 1, mix(wall, BLACK, 0.4));
      g.rect(0, Math.round(H * 0.32) + 1, W, 1, mix(wall, WHITE, 0.12));
      g.rect(0, 0, W, Math.round(5 * u), mix(wall, BLACK, 0.55));
      g.rect(0, Math.round(5 * u), W, 1, mix(wall, WHITE, 0.1));
      g.rect(0, fy - Math.round(4 * u), W, Math.round(4 * u), mix(wall, BLACK, 0.4));
      // Pipes along the top.
      for (const [py, k] of [[Math.round(7 * u), 0.2], [Math.round(10 * u), 0.35]]) {
        g.rect(0, py, W, Math.max(2, Math.round(2 * u)), mix([150, 120, 80], BLACK, k));
        g.rect(0, py, W, 1, mix([200, 170, 120], BLACK, k));
        for (let x = Math.round(20 * u); x < W; x += Math.round(50 * u)) g.rect(x, py - 1, Math.round(2 * u), Math.round(2 * u) + 2, mix(wall, BLACK, 0.5));
      }
      // Porthole on the open side.
      const ph = X(0.3);
      const pcy = Math.round(H * 0.3);
      const pr = Math.round(9 * u);
      g.disc(ph, pcy, pr + 2 * u, mix(wall, BLACK, 0.35));
      g.circle(ph, pcy, pr + 2 * u, mix(wall, WHITE, 0.2));
      for (let y = pcy - pr; y <= pcy + pr; y++) {
        for (let x = ph - pr; x <= ph + pr; x++) {
          if ((x - ph) ** 2 + (y - pcy) ** 2 > pr * pr) continue;
          let c = ramp([[6, 8, 20], [14, 18, 40]], (y - pcy + pr) / (2 * pr), x, y);
          if (hash(x, y, seed) < 0.04) c = mix(c, WHITE, 0.5 + hash(y, x, seed) * 0.5);
          if (x - ph + (y - pcy) === -Math.round(pr * 0.6) || x - ph + (y - pcy) === -Math.round(pr * 0.6) - 1) c = mix(c, WHITE, 0.2);
          g.set(x, y, c);
        }
      }
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        g.set(ph + Math.cos(a) * (pr + u), pcy + Math.sin(a) * (pr + u), mix(wall, WHITE, 0.4));
      }
      // Caged lamp over the middle, and its light.
      const lx = X(0.5);
      const ly = Math.round(5 * u);
      g.rect(lx - 3 * u, ly, 6 * u, Math.round(2 * u), mix(wall, BLACK, 0.5));
      g.disc(lx, ly + 4 * u, 3 * u, mix(light, WHITE, 0.5));
      for (let k = -2; k <= 2; k++) g.rect(lx + k * 1.5 * u, ly + 2 * u, 1, 5 * u, [40, 40, 36]);
      g.glow(lx, ly + 6 * u, W * 0.45, H * 0.8, light, 0.3);
      // Lockers at the far edge of the open side.
      const lkW = Math.round(13 * u);
      const lkX = Math.round(flip ? W - 2 - lkW * 2 : 2);
      for (let k = 0; k < 2; k++) {
        const x = lkX + k * lkW;
        const top = Math.round(H * 0.24);
        bevel(g, x, top, lkW - 1, fy - top - 4 * u, mix(wall, [60, 80, 110], 0.4), 0.25);
        for (let y = top + 4 * u; y < top + 10 * u; y += 2) g.rect(x + 3 * u, y, lkW - 7 * u, 1, mix(wall, BLACK, 0.5));
        g.rect(x + lkW - 4 * u, top + (fy - top) * 0.45, Math.max(1, Math.round(u)), 4 * u, mix(wall, WHITE, 0.3));
        textCentre(g, x + lkW / 2, top + 13 * u, String(k + 3), mix(wall, WHITE, 0.5));
      }
      // The bunk: posts, two decks, mattresses, blankets and pillows, on the detail side.
      const bw = Math.round(W * 0.36);
      const bx = Math.round(flip ? W * 0.04 : W * 0.96 - bw);
      const frame = mix(wall, BLACK, 0.55);
      const frameLit = mix(wall, WHITE, 0.1);
      const decks = [Math.round(H * 0.42), Math.round(fy - 7 * u)];
      const topY = Math.round(H * 0.2);
      for (const dy of decks) {
        const mh = Math.round(5 * u);
        // Mattress and the blanket over it, with a fold line and a hanging edge.
        g.rect(bx, dy - mh, bw, mh, [196, 192, 176]);
        const blX = flip ? bx : bx + Math.round(bw * 0.28);
        const blW = Math.round(bw * 0.72);
        for (let y = dy - mh - u; y < dy + 2 * u; y++) {
          for (let x = blX; x < blX + blW; x++) {
            const wave = Math.sin((x - blX) * 0.25 / u) * 0.5;
            g.set(x, y + wave, ramp([mix(blanket, WHITE, 0.15), blanket, mix(blanket, BLACK, 0.3)], (y - (dy - mh - u)) / (mh + 3 * u) + (n(x * 0.2, y * 0.2) - 0.5) * 0.3, x, y));
          }
        }
        g.rect(blX + Math.round(blW * 0.15), dy - mh - u, 1, mh + 3 * u, mix(blanket, BLACK, 0.4));
        // Pillow at the head end.
        const pX = flip ? bx + bw - Math.round(bw * 0.24) : bx + 2 * u;
        const pw = Math.round(bw * 0.22);
        g.rect(pX, dy - mh - 3 * u, pw, 3 * u + 1, [232, 228, 214]);
        g.rect(pX, dy - mh - 3 * u, pw, 1, WHITE);
        g.rect(pX + 1, dy - mh, pw - 2, 1, [180, 176, 160]);
        // Deck rail.
        g.rect(bx - 2 * u, dy + 2 * u, bw + 4 * u, Math.max(2, Math.round(2 * u)), frame);
        g.rect(bx - 2 * u, dy + 2 * u, bw + 4 * u, 1, frameLit);
      }
      for (const px of [bx - 3 * u, bx + bw + u]) {
        g.rect(px, topY, Math.max(2, Math.round(2 * u)), fy - topY, frame);
        g.rect(px, topY, 1, fy - topY, frameLit);
      }
      // A ladder at the foot end.
      const ldX = flip ? bx + bw - 6 * u : bx + bw - 10 * u;
      for (let y = decks[0] + 6 * u; y < decks[1] - 6 * u; y += Math.round(5 * u)) g.rect(ldX, y, 6 * u, Math.max(1, Math.round(u)), frameLit);
      g.rect(ldX, decks[0] + 2 * u, 1, decks[1] - decks[0], frame);
      g.rect(ldX + 6 * u, decks[0] + 2 * u, 1, decks[1] - decks[0], frame);
      // Pin-up poster on the wall above the top deck: a sunset and a palm, held on with tape.
      const pw2 = Math.round(14 * u);
      const ph2 = Math.round(12 * u);
      const ppx = Math.round(flip ? bx + bw * 0.12 : bx + bw * 0.5);
      const ppy = Math.round(topY - 2 * u);
      for (let y = 0; y < ph2; y++) {
        for (let x = 0; x < pw2; x++) {
          const t = y / ph2;
          let c = ramp([mix(poster, [60, 30, 90], 0.5), poster, mix(poster, [255, 220, 120], 0.6)], t * 1.3, ppx + x, ppy + y);
          const sd = Math.hypot(x - pw2 * 0.5, y - ph2 * 0.62);
          if (sd < pw2 * 0.22) c = [255, 226, 140];
          if (t > 0.72) c = mix([40, 50, 90], poster, 0.2);
          g.set(ppx + x, ppy + y, c);
        }
      }
      g.line(ppx + pw2 * 0.75, ppy + ph2 * 0.75, ppx + pw2 * 0.7, ppy + ph2 * 0.25, [30, 24, 30]);
      for (let k = -3; k <= 3; k++) g.line(ppx + pw2 * 0.7, ppy + ph2 * 0.25, ppx + pw2 * 0.7 + k * 1.3 * u, ppy + ph2 * 0.25 + Math.abs(k) * u, [30, 24, 30]);
      g.text(ppx + 2, ppy + ph2 - 6, 'VISIT', WHITE);
      for (const [tx, ty] of [[ppx - 1, ppy - 1], [ppx + pw2 - 3, ppy - 1]]) g.rect(tx, ty, 4, 2, [230, 220, 170]);
      // Deck plating, and a footlocker in front of the bunk.
      for (let y = fy; y < H; y++) {
        const t = (y - fy) / (H - fy);
        for (let x = 0; x < W; x++) {
          let c = ramp([mix(floor, BLACK, 0.3), floor, mix(floor, WHITE, 0.08)], 0.3 + t * 0.6 + (fbm(n, x * 0.08, y * 0.2, 2) - 0.5) * 0.4, x, y);
          if ((x + y * 2) % Math.round(6 * u) === 0 && (x - y * 2) % Math.round(6 * u) !== 0) c = mix(c, WHITE, 0.07);
          g.set(x, y, c);
        }
      }
      g.rect(0, fy, W, 1, mix(floor, WHITE, 0.2));
      g.glow(lx, fy + 6 * u, W * 0.3, 8 * u, light, 0.25);
      const fw = Math.round(bw * 0.42);
      const fx = Math.round(bx + (bw - fw) / 2);
      const fh = Math.round(9 * u);
      const fby = Math.round(H - 4 * u);
      bevel(g, fx, fby - fh, fw, fh, [70, 76, 54], 0.3);
      g.rect(fx, fby - fh + Math.round(3 * u), fw, 1, [40, 44, 30]);
      g.rect(fx + fw / 2 - u, fby - fh + Math.round(2 * u), 2 * u, 2 * u, [190, 170, 90]);
      textCentre(g, fx + fw / 2, fby - fh + Math.round(5 * u), 'USCM', [200, 196, 170]);
      g.vignette(BLACK, 0.45);
    });
  },
};
