// A motion tracker screen: a fan of range rings from the bottom edge, a sweep with a fading trail, blips and range
// numbers, on a scanlined phosphor display.
import { PIXEL, paint, hex, mix, rng, num, clamp, BLACK, WHITE } from './_kit.js';

export default {
  id: 'motion-tracker',
  name: 'Motion tracker',
  tags: ['military', 'terminal'],
  params: [
    { key: 'bg', label: 'Screen', type: 'color', default: '#031109' },
    { key: 'line', label: 'Rings', type: 'color', default: '#36E07E' },
    { key: 'blip', label: 'Blips', type: 'color', default: '#E6FFF0' },
    { key: 'sweep', label: 'Sweep angle', type: 'range', min: 0, max: 1, step: 0.01, default: 0.62 },
    { key: 'blips', label: 'Blips', type: 'range', min: 0, max: 12, step: 1, default: 4 },
    { key: 'pos', label: 'Centre', type: 'select', default: 'right', options: [['left', 'Left'], ['center', 'Middle'], ['right', 'Right']] },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const bg = hex(p.bg);
      const line = hex(p.line);
      const blip = hex(p.blip);
      const r = rng(seed);
      const ox = p.pos === 'left' ? g.w * 0.2 : p.pos === 'center' ? g.w * 0.5 : g.w * 0.8;
      const oy = g.h + 2 * g.u;
      const ring = 13 * g.u;
      const fan = Math.PI / 3; // half angle from straight up
      const sweepA = (num(p.sweep, 0.62) * 2 - 1) * fan;
      const dimBg = mix(bg, BLACK, 0.4);
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          const dx = x + 0.5 - ox;
          const dy = oy - (y + 0.5);
          const d = Math.hypot(dx, dy);
          const a = Math.atan2(dx, dy);
          const inFan = Math.abs(a) <= fan;
          let c = inFan ? bg : dimBg;
          if (inFan) {
            // Trail behind the sweep (sweeping left to right).
            const behind = sweepA - a;
            if (behind >= 0 && behind < 1.2) {
              const t = 1 - behind / 1.2;
              c = mix(c, line, t * t * 0.28);
            }
            const m = d % ring;
            if (m < 1 || m > ring - 0.5) c = mix(c, line, 0.55);
            const spoke = Math.abs(((a / (Math.PI / 12)) % 1 + 1) % 1 - 0.5);
            if (spoke > 0.5 - 0.35 / Math.max(1, d / ring) * 0.4 && y % 2 === 0) c = mix(c, line, 0.18);
            if (Math.abs(Math.abs(a) - fan) * d < 0.8) c = mix(c, line, 0.7);
          }
          g.set(x, y, c);
        }
      }
      // The sweep line.
      for (let d = 0; d < Math.hypot(g.w, g.h); d += 0.5) g.set(ox + Math.sin(sweepA) * d, oy - Math.cos(sweepA) * d, mix(line, WHITE, 0.3));
      // Range numbers along the left edge of the fan.
      for (let k = 1; k * ring < g.h * 1.3; k++) {
        const d = k * ring;
        const lx = ox - Math.sin(fan) * d - 9;
        const ly = oy - Math.cos(fan) * d - 3;
        g.text(lx, ly, String(k * 10), line, 1, 0.75);
      }
      // Blips: a hot core and a ring, brighter just behind the sweep.
      const count = Math.round(num(p.blips, 4));
      for (let i = 0; i < count; i++) {
        const a = (r() * 2 - 1) * fan * 0.9;
        const d = ring * (0.8 + r() * (g.h / ring) * 1.1);
        const bx = ox + Math.sin(a) * d;
        const by = oy - Math.cos(a) * d;
        if (by < 2 || bx < 2 || bx > g.w - 2) continue;
        const fresh = clamp(1 - (sweepA - a) / 1.6);
        const k = sweepA >= a ? 0.4 + 0.6 * fresh : 0.35;
        g.glow(bx, by, 6 * g.u, 4 * g.u, line, 0.6 * k);
        g.rect(bx - 1, by - 1, 3, 2, mix(line, blip, k), 1);
        g.set(bx, by, blip);
      }
      g.scanlines(0.3, 2);
      g.vignette(BLACK, 0.55);
    });
  },
};
