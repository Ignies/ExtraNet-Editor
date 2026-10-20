// 80s Memphis confetti: outlined triangles, circles, squiggles, zigzags and dot patches scattered over a pale
// ground, each with a hard offset shadow.
import { PIXEL, paint, hex, mix, rng, num, BLACK } from './_kit.js';

export default {
  id: 'memphis',
  name: 'Memphis confetti',
  tags: ['80s', 'tabloid', 'leisure'],
  params: [
    { key: 'bg', label: 'Background', type: 'color', default: '#F3EAD9' },
    { key: 'a', label: 'Colour one', type: 'color', default: '#FF5FA2' },
    { key: 'b', label: 'Colour two', type: 'color', default: '#2EC4B6' },
    { key: 'c', label: 'Colour three', type: 'color', default: '#FFC42E' },
    { key: 'ink', label: 'Ink', type: 'color', default: '#1B1A22' },
    { key: 'density', label: 'Density', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const bg = hex(p.bg);
      const cols = [hex(p.a), hex(p.b), hex(p.c)];
      const ink = hex(p.ink);
      const r = rng(seed);
      g.fill(bg);
      // A faint dot grid.
      const dg = Math.max(4, Math.round(6 * g.u));
      for (let y = 2; y < g.h; y += dg) for (let x = 2 + ((y / dg) % 2) * (dg / 2); x < g.w; x += dg) g.set(x, y, mix(bg, ink, 0.12));
      const count = Math.round((6 + num(p.density, 0.5) * 30) * (g.w / g.h) / 4);
      const u = g.u;
      const shadow = mix(bg, ink, 0.25);
      for (let i = 0; i < count; i++) {
        const x = r() * g.w;
        const y = r() * g.h;
        const col = cols[Math.floor(r() * 3)];
        const kind = Math.floor(r() * 6);
        const s = (4 + r() * 6) * u;
        const ang = r() * Math.PI * 2;
        const drawShape = (ox, oy, fill, line) => {
          if (kind === 0) {
            // Triangle.
            const a = ang;
            const pts = [0, 1, 2].map(k => [ox + x + Math.cos(a + k * 2.094) * s, oy + y + Math.sin(a + k * 2.094) * s]);
            for (let k = 0; k < 3; k++) g.line(pts[k][0], pts[k][1], pts[(k + 1) % 3][0], pts[(k + 1) % 3][1], line);
          } else if (kind === 1) {
            g.disc(ox + x, oy + y, s * 0.7, fill);
            g.circle(ox + x, oy + y, s * 0.7, line);
          } else if (kind === 2) {
            // Squiggle.
            for (let t = 0; t < s * 3; t += 0.5) g.set(ox + x + t, oy + y + Math.sin(t / (1.6 * u)) * 2 * u, line === ink ? fill : line);
            for (let t = 0; t < s * 3; t += 0.5) g.set(ox + x + t, oy + y + 1 + Math.sin(t / (1.6 * u)) * 2 * u, line === ink ? fill : line);
          } else if (kind === 3) {
            // Zigzag.
            let px = ox + x;
            let py = oy + y;
            for (let k = 0; k < 5; k++) {
              const nx = px + s * 0.5;
              const ny = py + (k % 2 ? -s * 0.5 : s * 0.5);
              g.line(px, py, nx, ny, line);
              g.line(px, py + 1, nx, ny + 1, line);
              px = nx;
              py = ny;
            }
          } else if (kind === 4) {
            // Dot patch.
            for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 5; xx++) g.rect(ox + x + xx * 3 * u, oy + y + yy * 3 * u, Math.max(1, u), Math.max(1, u), line);
          } else {
            // Bar.
            g.rect(ox + x, oy + y, s * 2, Math.max(2, 2 * u), fill);
          }
        };
        drawShape(Math.round(u * 1.5), Math.round(u * 1.5), shadow, shadow);
        drawShape(0, 0, col, kind === 1 || kind === 5 ? ink : col);
      }
      g.vignette(BLACK, 0.12);
    });
  },
};
