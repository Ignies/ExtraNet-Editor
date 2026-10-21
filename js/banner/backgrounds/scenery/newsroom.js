// A network newsroom: a ceiling of light panels, a long video wall, a big gridded planet graphic in the middle with
// orbit rings, rows of staffed-looking workstations on both sides behind a rail, and an open floor in front for the
// presenter.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, fbm, BLACK, WHITE } from '../_kit.js';
import { GROUP } from './_scene.js';
import { crt, bevel, planet, textCentre } from './_broadcast.js';

export default {
  id: 'scene-newsroom',
  name: 'Network newsroom',
  group: GROUP,
  tags: ['scenery', 'interior', 'news', 'tv'],
  params: [
    { key: 'wall', label: 'Walls', type: 'color', default: '#121A2C' },
    { key: 'glow', label: 'Globe and screens', type: 'color', default: '#2AB8F0' },
    { key: 'accent', label: 'Accent', type: 'color', default: '#F04A3A' },
    { key: 'floor', label: 'Floor', type: 'color', default: '#262C3A' },
    {
      key: 'banner', label: 'Wall lettering', type: 'select', default: 'NETWORK NEWS',
      options: [['NETWORK NEWS', 'NETWORK NEWS'], ['WORLD DESK', 'WORLD DESK'], ['NEWSROOM', 'NEWSROOM'], ['', 'None']],
    },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const wall = hex(p.wall);
      const glow = hex(p.glow);
      const accent = hex(p.accent);
      const floor = hex(p.floor);
      const r = rng(seed);
      const n = makeNoise(seed);
      const u = g.u;
      const cx = g.w / 2;
      const ceil = Math.round(9 * u);
      const fy = Math.round(g.h * 0.72);
      // Back wall.
      const tones = [mix(wall, BLACK, 0.45), mix(wall, BLACK, 0.2), wall, mix(wall, WHITE, 0.07)];
      for (let y = 0; y < fy; y++) for (let x = 0; x < g.w; x++) g.set(x, y, ramp(tones, 0.3 + y / fy * 0.55 + (fbm(n, x * 0.05, y * 0.05, 2) - 0.5) * 0.3, x, y));
      // Ceiling: rows of light panels, narrower and closer together towards the back.
      g.rect(0, 0, g.w, ceil, mix(wall, BLACK, 0.55));
      const rowsY = [[0, Math.round(3 * u), 22, 1.0], [Math.round(4 * u), Math.round(2.5 * u), 18, 0.85], [Math.round(7.5 * u), Math.round(1.5 * u), 15, 0.7]];
      for (const [y0, hh, pitch, k2] of rowsY) {
        const step = Math.round(pitch * u);
        const pw = Math.round(step * 0.62);
        for (let x = Math.round(cx - pw / 2) % step - step; x < g.w; x += step) {
          g.rect(x, y0, pw, hh, mix([236, 240, 255], wall, 1 - k2 * 0.75));
          g.rect(x, y0 + hh - 1, pw, 1, mix([236, 240, 255], wall, 1 - k2 * 0.55));
        }
      }
      g.rect(0, ceil, g.w, 1, mix(wall, BLACK, 0.6));
      g.glow(cx, ceil, g.w * 0.7, 30 * u, [220, 230, 255], 0.12);
      // The video wall: a long run of monitors with a gap in the middle for the globe.
      const vy = Math.round(ceil + 4 * u);
      const vh = Math.round(10 * u);
      const vw = Math.round(vh * 1.3);
      const gap = Math.round(g.h * 0.2 + 9 * u);
      const kinds = ['face', 'map', 'graph', 'text', 'planet', 'bars', 'face', 'map', 'graph', 'text'];
      let k = Math.floor(r() * kinds.length);
      for (const dir of [-1, 1]) {
        for (let x = cx + dir * gap; dir < 0 ? x - vw > -vw : x < g.w; x += dir * (vw + 1)) {
          const x0 = dir < 0 ? x - vw : x;
          const tint = k % 4 === 0 ? mix(glow, accent, 0.6) : glow;
          crt(g, x0, vy, vw, vh, kinds[k % kinds.length], seed + k * 5, mix(tint, BLACK, 0.1), 'NEWS');
          k++;
        }
      }
      g.rect(0, vy + vh, g.w, 1, mix(wall, BLACK, 0.6));
      // Wall lettering under the video wall, either side.
      if (p.banner) {
        const ly = Math.round(vy + vh + 4 * u);
        const s = 1;
        textCentre(g, g.w * 0.17, ly, p.banner, mix(glow, WHITE, 0.4), s);
        textCentre(g, g.w * 0.83, ly, p.banner, mix(glow, WHITE, 0.4), s);
        g.rect(g.w * 0.05, ly + 7 * s, g.w * 0.24, Math.max(1, Math.round(u * 0.6)), accent);
        g.rect(g.w * 0.71, ly + 7 * s, g.w * 0.24, Math.max(1, Math.round(u * 0.6)), accent);
      }
      // The globe: a backing ring, the gridded planet, two orbit rings in front and behind.
      const gr = Math.round(g.h * 0.2);
      const gcy = Math.round(ceil + gr + 6 * u);
      g.glow(cx, gcy, gr * 2.2, gr * 1.6, glow, 0.35);
      g.disc(cx, gcy, gr + 5 * u, mix(wall, BLACK, 0.5));
      g.circle(cx, gcy, gr + 5 * u, mix(glow, BLACK, 0.2));
      g.circle(cx, gcy, gr + 3 * u, mix(glow, BLACK, 0.55));
      for (let a = 0; a < 24; a++) {
        const t = (a / 24) * Math.PI * 2;
        const rr = gr + 5 * u;
        g.set(cx + Math.cos(t) * rr, gcy + Math.sin(t) * rr, mix(glow, WHITE, 0.6));
      }
      const ring = (front) => {
        for (let i = 0; i < 720; i++) {
          const t = (i / 720) * Math.PI * 2;
          const x = cx + Math.cos(t) * gr * 1.55;
          const y = gcy + Math.sin(t) * gr * 0.32 - Math.cos(t) * gr * 0.18;
          if ((Math.sin(t) > 0) === front) g.set(x, y, front ? mix(accent, WHITE, 0.3) : mix(accent, BLACK, 0.35));
        }
      };
      ring(false);
      planet(g, cx, gcy, gr, seed, {
        sea: mix(glow, BLACK, 0.55), land: mix(glow, WHITE, 0.1), high: mix(glow, WHITE, 0.45), rim: mix(glow, WHITE, 0.3),
        light: [-0.45, -0.55], spin: 0.8, graphic: true,
      });
      ring(true);
      // A satellite dot on the front ring.
      const st = Math.PI * 0.3;
      g.disc(cx + Math.cos(st) * gr * 1.55, gcy + Math.sin(st) * gr * 0.32 - Math.cos(st) * gr * 0.18, 1.6 * u, WHITE);
      // Workstations either side: desks with small monitors and chair backs, behind a glass rail.
      const wy = Math.round(fy - 10 * u);
      const deskC = mix(wall, WHITE, 0.12);
      for (const side of [0, 1]) {
        const x0 = side === 0 ? 0 : Math.round(g.w * 0.66);
        const x1 = side === 0 ? Math.round(g.w * 0.34) : g.w;
        g.rect(x0, wy, x1 - x0, fy - wy, mix(wall, BLACK, 0.35));
        for (let x = x0 + Math.round(6 * u); x < x1 - 8 * u; x += Math.round(19 * u)) {
          const mw = Math.round(10 * u);
          const mh = Math.round(8 * u);
          crt(g, x, wy - mh + 2 * u, mw, mh, r() < 0.5 ? 'text' : 'graph', seed + x, r() < 0.3 ? mix(glow, accent, 0.5) : glow);
          g.rect(x + mw / 2 - u, wy + 2 * u, 2 * u, 2 * u, [40, 42, 50]);
          // A chair back in front of the desk.
          g.rect(x + mw + 1 * u, wy + 1 * u, 5 * u, 6 * u, [24, 26, 34]);
          g.rect(x + mw + 1 * u, wy + 1 * u, 5 * u, 1, [60, 64, 78]);
        }
        bevel(g, x0, wy + 4 * u, x1 - x0, 3 * u, deskC, 0.3);
        g.rect(x0, wy + 7 * u, x1 - x0, fy - wy - 7 * u, mix(wall, BLACK, 0.5));
        // Glass rail: a top bar and faint posts.
        const ry = Math.round(fy - 9 * u);
        g.rect(x0, ry, x1 - x0, 1, mix(glow, WHITE, 0.5));
        for (let x = x0; x < x1; x += Math.round(16 * u)) g.rect(x, ry, 1, fy - ry, mix(glow, BLACK, 0.3));
        for (let y = ry + 1; y < fy; y++) for (let x = x0; x < x1; x++) if ((x + y) % 7 === 0) g.blend(x, y, glow, 0.2);
      }
      // Floor: polished, with lines running to the middle and the globe's reflection.
      for (let y = fy; y < g.h; y++) {
        const t = (y - fy) / (g.h - fy);
        for (let x = 0; x < g.w; x++) g.set(x, y, ramp([mix(floor, BLACK, 0.45), floor, mix(floor, WHITE, 0.08)], 0.3 + t * 0.8 + (n(x * 0.12, y * 0.4) - 0.5) * 0.25, x, y));
      }
      g.rect(0, fy, g.w, 1, mix(floor, WHITE, 0.25));
      for (let k2 = -7; k2 <= 7; k2++) g.line(cx + k2 * 10 * u, fy + 1, cx + k2 * 34 * u, g.h - 1, mix(floor, BLACK, 0.35));
      g.glow(cx, fy + 6 * u, gr * 1.6, 8 * u, glow, 0.25);
      g.vignette(BLACK, 0.4);
    });
  },
};
