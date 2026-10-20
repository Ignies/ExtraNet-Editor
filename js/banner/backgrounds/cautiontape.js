// Caution tape stretched across a concrete wall: one to three slightly tilted bands with lettering and black
// chevron blocks, creased, with a shadow on the wall.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, fbm, num, textStrip, BLACK, WHITE } from './_kit.js';

export default {
  id: 'caution-tape',
  name: 'Caution tape',
  tags: ['industrial', 'deep'],
  params: [
    { key: 'wall', label: 'Wall', type: 'color', default: '#25262A' },
    { key: 'tape', label: 'Tape', type: 'color', default: '#F0C030' },
    { key: 'ink', label: 'Print', type: 'color', default: '#141414' },
    { key: 'text', label: 'Text', type: 'select', default: 'CAUTION', options: ['CAUTION', 'DANGER', 'QUARANTINE', 'KEEP OUT', 'DO NOT CROSS', 'BIOHAZARD', 'CRIME SCENE'] },
    { key: 'count', label: 'Tapes', type: 'range', min: 1, max: 3, step: 1, default: 2 },
    { key: 'tilt', label: 'Tilt', type: 'range', min: 0, max: 1, step: 0.05, default: 0.35 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const wall = hex(p.wall);
      const tape = hex(p.tape);
      const ink = hex(p.ink);
      const r = rng(seed);
      const n = makeNoise(seed);
      const sc = 6 / g.h;
      const wallTones = [mix(wall, BLACK, 0.35), mix(wall, BLACK, 0.15), wall, mix(wall, WHITE, 0.08)];
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) g.set(x, y, ramp(wallTones, fbm(n, x * sc, y * sc, 4) * 1.4 - 0.2, x, y));
      g.speckle(mix(wall, BLACK, 0.5), 0.03, seed);
      const scale = Math.max(1, Math.round(2 * g.u));
      const strip = textStrip(`${p.text || 'CAUTION'}`, 1);
      const block = 8 * scale; // a chevron block between words
      const period = strip.w * scale + block + 6 * scale;
      const th = 9 * scale;
      const count = Math.max(1, Math.min(3, Math.round(num(p.count, 2))));
      const tilt = num(p.tilt, 0.35) * 0.25;
      const tapes = [];
      for (let i = 0; i < count; i++) {
        const cy = g.h * (count === 1 ? 0.5 : 0.3 + (0.4 * i) / (count - 1)) + (r() - 0.5) * g.h * 0.1;
        const ang = (i % 2 ? -1 : 1) * tilt * (0.6 + r() * 0.4);
        tapes.push({ cy, ang, off: r() * period });
      }
      const crease = makeNoise(seed + 3);
      for (const t of tapes) {
        const cos = Math.cos(t.ang);
        const sin = Math.sin(t.ang);
        // Shadow first, then the tape.
        for (let pass = 0; pass < 2; pass++) {
          const sh = pass === 0 ? 2 * scale : 0;
          for (let y = 0; y < g.h; y++) {
            for (let x = 0; x < g.w; x++) {
              const dx = x - g.w / 2;
              const dy = y - sh - t.cy;
              const u = dx * cos + dy * sin + g.w;
              const v = -dx * sin + dy * cos + th / 2;
              if (v < 0 || v >= th) continue;
              if (pass === 0) {
                g.blend(x, y, BLACK, 0.35);
                continue;
              }
              const cr = crease(u * 0.08, 0.5);
              let c = mix(tape, BLACK, cr * 0.3);
              if (v < scale || v >= th - scale) c = mix(tape, BLACK, 0.35);
              const pu = ((u + t.off) % period + period) % period;
              const tx = Math.floor((pu - 3 * scale) / scale);
              const ty = Math.floor((v - 2 * scale) / scale);
              if (tx >= 0 && tx < strip.w && ty >= 0 && ty < 5 && strip.bits[ty * strip.w + tx]) c = ink;
              const bu = pu - (strip.w * scale + 4 * scale);
              if (bu >= 0 && bu < block && v >= scale && v < th - scale && Math.floor((bu + v) / (2 * scale)) % 2 === 0) c = ink;
              if (cr > 0.62) c = mix(c, WHITE, 0.15);
              g.set(x, y, c);
            }
          }
        }
      }
      g.vignette(BLACK, 0.45);
    });
  },
};
