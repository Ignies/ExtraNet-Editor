// Terminal rain: columns of tiny glyphs falling down a dark screen, each stream with a bright head and a fading
// tail, over a dim field of stale characters.
import { PIXEL, paint, hex, mix, rng, hash, num, GLYPHS, BLACK } from './_kit.js';

const CHARS = Object.keys(GLYPHS).filter(c => c !== ' ' && c !== "'");

export default {
  id: 'terminal-rain',
  name: 'Terminal rain',
  tags: ['terminal', 'deep'],
  params: [
    { key: 'bg', label: 'Screen', type: 'color', default: '#020804' },
    { key: 'glyph', label: 'Glyphs', type: 'color', default: '#33D158' },
    { key: 'head', label: 'Heads', type: 'color', default: '#D6FFE0' },
    { key: 'density', label: 'Density', type: 'range', min: 0, max: 1, step: 0.05, default: 0.55 },
    { key: 'trail', label: 'Trail length', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.5 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const bg = hex(p.bg);
      const gl = hex(p.glyph);
      const head = hex(p.head);
      const density = num(p.density, 0.55);
      const trail = num(p.trail, 0.5);
      const r = rng(seed);
      g.fill(bg);
      const cw = 4;
      const ch = 6;
      const cols = Math.ceil(g.w / cw);
      const rows = Math.ceil(g.h / ch);
      const drawGlyph = (cx, cy, c, a) => {
        const k = CHARS[Math.floor(hash(cx, cy, seed) * CHARS.length)];
        const bits = GLYPHS[k];
        for (let yy = 0; yy < 5; yy++) {
          for (let xx = 0; xx < 3; xx++) {
            if (bits[yy * 3 + xx] !== '1') continue;
            // Flip some glyphs so they read as alien script rather than words.
            const fx = hash(cx, cy, seed + 1) < 0.5 ? xx : 2 - xx;
            g.blend(cx * cw + fx, cy * ch + yy, c, a);
          }
        }
      };
      // Stale characters.
      for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) if (hash(cx, cy, seed + 9) < 0.25) drawGlyph(cx, cy, gl, 0.1);
      // Streams.
      for (let cx = 0; cx < cols; cx++) {
        const streams = r() < density ? 1 + (r() < density * 0.5 ? 1 : 0) : 0;
        for (let s = 0; s < streams; s++) {
          const headRow = Math.floor(r() * (rows + 4));
          const len = Math.max(2, Math.round((2 + r() * rows) * trail * 1.4));
          for (let k = 0; k < len; k++) {
            const cy = headRow - k;
            if (cy < 0 || cy >= rows) continue;
            if (k === 0) drawGlyph(cx, cy, head, 1);
            else drawGlyph(cx, cy, mix(gl, bg, (k / len) * 0.6), 1 - (k / len) * 0.75);
          }
          // A soft glow behind the head.
          if (headRow >= 0 && headRow < rows) g.glow(cx * cw + 1.5, headRow * ch + 2.5, 5, 6, gl, 0.25);
        }
      }
      g.scanlines(0.25, 2);
      g.vignette(BLACK, 0.55);
    });
  },
};
