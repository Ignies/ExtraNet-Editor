// Rusted plate steel: brushed panels with seams and rivets, rust blooms, rust streaks running down from the rivets,
// and pitting.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, fbm, hash, num, BLACK, WHITE } from './_kit.js';

export default {
  id: 'rusted-plate',
  name: 'Rusted metal plate',
  tags: ['industrial', 'colony'],
  params: [
    { key: 'metal', label: 'Metal', type: 'color', default: '#5B6168' },
    { key: 'rust', label: 'Rust', type: 'color', default: '#8A3E1A' },
    { key: 'rivet', label: 'Rivets', type: 'color', default: '#9CA4AC' },
    { key: 'amount', label: 'Rust amount', type: 'range', min: 0, max: 1, step: 0.05, default: 0.45 },
    { key: 'plates', label: 'Plate width', type: 'range', min: 0.3, max: 2, step: 0.05, default: 1 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const metal = hex(p.metal);
      const rust = hex(p.rust);
      const rivet = hex(p.rivet);
      const amount = num(p.amount, 0.45);
      const r = rng(seed);
      const n = makeNoise(seed);
      const metalTones = [mix(metal, BLACK, 0.35), mix(metal, BLACK, 0.18), metal, mix(metal, WHITE, 0.12)];
      const rustTones = [mix(rust, BLACK, 0.45), rust, mix(rust, [214, 120, 52], 0.45)];
      const pw = Math.max(16, Math.round(g.h * 1.1 * num(p.plates, 1)));
      const ph = Math.round(g.h / 2);
      const sc = 4 / g.h;
      const streak = new Float32Array(g.w * g.h);
      // Rivet positions and their rust streaks.
      const rivets = [];
      const step = Math.max(6, Math.round(9 * g.u));
      for (let py = 0; py < g.h + ph; py += ph) {
        for (let x = Math.round(step / 2); x < g.w; x += step) rivets.push([x, py + Math.round(3 * g.u)]);
      }
      for (let px = 0; px < g.w + pw; px += pw) {
        for (let y = Math.round(step / 2); y < g.h; y += step) rivets.push([px + Math.round(3 * g.u), y]);
      }
      for (const [x, y] of rivets) {
        if (r() > amount * 1.2) continue;
        const len = (4 + r() * 18) * g.u * (0.4 + amount);
        for (let k = 0; k < len; k++) {
          const t = 1 - k / len;
          const sx = x + Math.round(Math.sin(k * 0.4) * 0.6);
          for (let dx = -1; dx <= 1; dx++) {
            const xi = sx + dx;
            const yi = y + 1 + k;
            if (xi >= 0 && xi < g.w && yi >= 0 && yi < g.h) streak[yi * g.w + xi] = Math.max(streak[yi * g.w + xi], t * (dx === 0 ? 0.9 : 0.5));
          }
        }
      }
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          const plateX = Math.floor(x / pw);
          const plateY = Math.floor(y / ph);
          const tone = hash(plateX, plateY, seed) * 0.25;
          const brushed = n(x * 0.05, y * 1.3) * 0.3;
          let c = ramp(metalTones, 0.35 + tone + brushed - (y % ph) / ph * 0.15, x, y);
          const rr = fbm(n, x * sc, y * sc, 4) + streak[y * g.w + x] * 0.45;
          const th = 0.78 - amount * 0.4;
          if (rr > th) c = ramp(rustTones, (rr - th) * 4 + (hash(x, y, seed) - 0.5) * 0.3, x, y);
          if (hash(x, y, seed + 3) < 0.012 * amount) c = mix(rust, BLACK, 0.6);
          g.set(x, y, c);
        }
      }
      // Seams: a dark line and a light line below or right of it.
      for (let px = 0; px < g.w; px += pw) {
        g.rect(px, 0, 1, g.h, mix(metal, BLACK, 0.7));
        g.rect(px + 1, 0, 1, g.h, WHITE, 0.15);
      }
      for (let py = 0; py < g.h; py += ph) {
        g.rect(0, py, g.w, 1, mix(metal, BLACK, 0.7));
        g.rect(0, py + 1, g.w, 1, WHITE, 0.15);
      }
      for (const [x, y] of rivets) {
        g.set(x, y, mix(rivet, WHITE, 0.4));
        g.set(x + 1, y, rivet);
        g.set(x, y + 1, rivet);
        g.set(x + 1, y + 1, mix(rivet, BLACK, 0.4));
        g.blend(x + 2, y + 1, BLACK, 0.4);
        g.blend(x + 1, y + 2, BLACK, 0.4);
      }
      g.vignette(BLACK, 0.4);
    });
  },
};
