// Shared helpers for the Materials backgrounds: full textures like the wooden planks behind Rosie Ketch, with a
// light direction and a vignette. Not a background itself.
import { mix, bayer, clamp, BLACK, WHITE } from '../_kit.js';

export const GROUP = 'Materials';

export const LIGHT = {
  key: 'light', label: 'Light from', type: 'select', default: 'topleft',
  options: [['topleft', 'Top left'], ['top', 'Top'], ['center', 'A pool in the middle'], ['none', 'Flat']],
};
export const VIGNETTE = { key: 'vignette', label: 'Vignette', type: 'range', min: 0, max: 1, step: 0.05, default: 0.45 };

/** Lights the texture: brighter towards the light, darker away, plus a vignette, all dithered. */
export function light(g, p) {
  const mode = p.light || 'topleft';
  const vig = Number(p.vignette ?? 0.45);
  for (let y = 0; y < g.h; y++) {
    const ny = y / g.h;
    for (let x = 0; x < g.w; x++) {
      const nx = x / g.w;
      let v = 0;
      if (mode === 'topleft') v = 0.5 - (nx * 0.6 + ny * 0.8) / 1.4;
      else if (mode === 'top') v = 0.4 - ny * 0.8;
      else if (mode === 'center') v = 0.45 - Math.hypot(nx - 0.5, (ny - 0.5) * 0.5) * 1.6;
      const ex = (nx - 0.5) * 2;
      const ey = (ny - 0.5) * 2;
      v -= vig * Math.pow((ex * ex + ey * ey) / 2, 1.3) * 0.9;
      const a = clamp(Math.abs(v) * 0.5);
      const q = Math.round(a * 6 + bayer(x, y) - 0.5) / 6;
      if (q > 0) g.blend(x, y, v > 0 ? WHITE : BLACK, q);
    }
  }
}

export function tones(c, n = 4, spread = 0.35) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) * 2 - 1;
    out.push(t < 0 ? mix(c, BLACK, -t * spread) : mix(c, WHITE, t * spread * 0.6));
  }
  return out;
}
