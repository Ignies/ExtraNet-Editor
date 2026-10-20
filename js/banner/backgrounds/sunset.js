// A tropical pixel sunset: a sky in hard dithered bands, thin cloud streaks, a low sun and a sea with a broken
// reflection.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, num, clamp, BLACK, WHITE } from './_kit.js';

export default {
  id: 'sunset',
  name: 'Tropical sunset',
  tags: ['colony', 'leisure', 'retro'],
  params: [
    { key: 'top', label: 'Sky top', type: 'color', default: '#2A0F52' },
    { key: 'mid', label: 'Sky middle', type: 'color', default: '#E2466A' },
    { key: 'low', label: 'Horizon', type: 'color', default: '#FFB45C' },
    { key: 'sun', label: 'Sun', type: 'color', default: '#FFF1B0' },
    { key: 'sea', label: 'Sea', type: 'color', default: '#1E2058' },
    { key: 'horizon', label: 'Horizon', type: 'range', min: 0.4, max: 1, step: 0.01, default: 0.7 },
    { key: 'sunX', label: 'Sun position', type: 'range', min: 0, max: 1, step: 0.01, default: 0.7 },
    { key: 'clouds', label: 'Clouds', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const top = hex(p.top);
      const mid = hex(p.mid);
      const low = hex(p.low);
      const sun = hex(p.sun);
      const sea = hex(p.sea);
      const r = rng(seed);
      const n = makeNoise(seed);
      const hz = Math.round(g.h * num(p.horizon, 0.7));
      const sky = [top, mix(top, mid, 0.33), mix(top, mid, 0.66), mid, mix(mid, low, 0.5), low];
      const sx = g.w * num(p.sunX, 0.7);
      const sr = g.h * 0.2;
      const sy = hz - sr * 0.35;
      for (let y = 0; y < hz; y++) {
        // Bands: quantise the gradient into hard steps with a 2 row dithered seam.
        const v = Math.pow(y / Math.max(1, hz), 1.2);
        for (let x = 0; x < g.w; x++) {
          const glow = Math.exp(-(Math.pow((x - sx) / (g.w * 0.35), 2) + Math.pow((y - sy) / (g.h * 0.6), 2))) * 0.25;
          g.set(x, y, ramp(sky, clamp(v + glow), x, y));
        }
      }
      // Cloud streaks.
      const ck = num(p.clouds, 0.5);
      const cloudDark = mix(top, mid, 0.45);
      const cloudLit = mix(mid, low, 0.7);
      for (let i = 0, c = Math.round(ck * 10); i < c; i++) {
        const y = Math.floor(r() * hz * 0.8);
        const x0 = r() * g.w;
        const len = (20 + r() * 80) * g.u;
        const th = Math.max(1, Math.round(r() * 2 * g.u));
        for (let x = Math.floor(x0); x < x0 + len; x++) {
          const t = (x - x0) / len;
          const thick = Math.round(th * Math.sin(t * Math.PI) + n(x * 0.2, y) * 0.8);
          for (let k = 0; k < thick; k++) g.set(x, y + k, k === 0 ? cloudLit : cloudDark);
        }
      }
      g.glow(sx, sy, sr * 3, sr * 2, low, 0.4);
      g.disc(sx, sy, sr, sun);
      g.disc(sx, sy, sr * 0.7, mix(sun, WHITE, 0.5));
      // Sea with reflection.
      const seaTones = [mix(sea, low, 0.35), mix(sea, low, 0.15), sea, mix(sea, BLACK, 0.35)];
      for (let y = hz; y < g.h; y++) {
        const t = (y - hz) / Math.max(1, g.h - hz);
        for (let x = 0; x < g.w; x++) g.set(x, y, ramp(seaTones, t * 1.3, x, y));
        const width = sr * (1.2 - t * 0.4);
        for (let x = Math.floor(sx - width); x < sx + width; x++) {
          const wave = n(x * 0.25, y * 1.7);
          if (wave > 0.55) g.set(x, y, wave > 0.7 ? sun : mix(sun, low, 0.5));
        }
        // Glints across the sea.
        if (y > hz + 1) for (let x = 0; x < g.w; x++) if (n(x * 0.3 + 40, y * 2.1) > 0.82) g.set(x, y, mix(sea, low, 0.5));
      }
      g.rect(0, hz, g.w, 1, mix(low, WHITE, 0.3));
    });
  },
};
