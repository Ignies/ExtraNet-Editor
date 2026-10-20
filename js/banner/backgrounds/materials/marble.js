// Marble: cloudy stone with long branching veins in a second colour and fine hairline veins, polished with a soft
// reflection.
import { PIXEL, paint, hex, mix, ramp, makeNoise, fbm, num, WHITE } from '../_kit.js';
import { GROUP, LIGHT, VIGNETTE, light, tones } from './_mat.js';

export default {
  id: 'mat-marble',
  name: 'Marble',
  group: GROUP,
  tags: ['material', 'luxury', 'corporate'],
  params: [
    { key: 'stone', label: 'Stone', type: 'color', default: '#E8E4DC' },
    { key: 'vein', label: 'Veins', type: 'color', default: '#5A5A66' },
    { key: 'veins', label: 'Veins', type: 'range', min: 0, max: 1, step: 0.05, default: 0.55 },
    { key: 'scale', label: 'Scale', type: 'range', min: 0.4, max: 2, step: 0.05, default: 1 },
    LIGHT,
    { ...VIGNETTE, default: 0.25 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const stone = hex(p.stone);
      const vein = hex(p.vein);
      const vk = num(p.veins, 0.55);
      const n = makeNoise(seed);
      const t = tones(stone, 4, 0.18);
      const sc = 1.6 / (g.h * num(p.scale, 1));
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          const cloud = fbm(n, x * sc * 2, y * sc * 2, 3);
          let c = ramp(t, 0.35 + cloud * 0.5, x, y);
          // Veins: thin lines where a warped stripe field crosses zero.
          const w = fbm(n, x * sc + 7, y * sc - 3, 4) * 7;
          const main = Math.abs(Math.sin((x * 0.6 + y) * sc * 2.2 + w));
          const fine = Math.abs(Math.sin((x - y * 0.7) * sc * 5 + w * 1.6));
          if (main < 0.06 * vk) c = vein;
          else if (main < 0.16 * vk) c = mix(c, vein, 0.45);
          else if (fine < 0.035 * vk) c = mix(c, vein, 0.3);
          g.set(x, y, c);
        }
      }
      void WHITE;
      light(g, p);
    });
  },
};
