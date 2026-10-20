// Felt or baize: a soft fibre texture under a pool of lamplight, like a card or pool table, with an optional
// padded rail around the edge.
import { PIXEL, paint, hex, mix, ramp, makeNoise, hash, num, WHITE, BLACK } from '../_kit.js';
import { GROUP, LIGHT, VIGNETTE, light, tones } from './_mat.js';

export default {
  id: 'mat-felt',
  name: 'Felt baize',
  group: GROUP,
  tags: ['material', 'leisure', 'sports'],
  params: [
    { key: 'felt', label: 'Felt', type: 'color', default: '#1E6A3A' },
    { key: 'rail', label: 'Rail', type: 'color', default: '#4A2614' },
    { key: 'fibre', label: 'Fibre', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
    { key: 'border', label: 'Rail', type: 'select', default: 'yes', options: [['yes', 'Padded rail'], ['no', 'None']] },
    { ...LIGHT, default: 'center' },
    VIGNETTE,
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const felt = hex(p.felt);
      const rail = hex(p.rail);
      const fk = num(p.fibre, 0.5);
      const n = makeNoise(seed);
      const t = tones(felt, 4, 0.3);
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          const v = 0.5 + (hash(x, y, seed) - 0.5) * 0.7 * fk + (n(x * 0.12, y * 0.12) - 0.5) * 0.3;
          g.set(x, y, ramp(t, v, x, y));
        }
      }
      light(g, p);
      if (p.border !== 'no') {
        const rw = Math.round(6 * g.u);
        const rt = tones(rail, 4, 0.4);
        for (let y = 0; y < g.h; y++) {
          for (let x = 0; x < g.w; x++) {
            const d = Math.min(x, y, g.w - 1 - x, g.h - 1 - y);
            if (d >= rw) continue;
            const grain = n(x * 0.3, y * 0.3) - 0.5;
            g.set(x, y, d === rw - 1 ? mix(felt, BLACK, 0.5) : ramp(rt, 0.7 - d / rw * 0.5 + grain * 0.4 + (y < rw ? 0.15 : 0), x, y));
          }
        }
        // Diamond sights along the rail.
        for (let x = Math.round(g.w / 8); x < g.w; x += Math.round(g.w / 8)) {
          g.set(x, Math.round(rw / 2), mix(WHITE, rail, 0.2));
          g.set(x, g.h - Math.round(rw / 2) - 1, mix(WHITE, rail, 0.2));
        }
      }
    });
  },
};
