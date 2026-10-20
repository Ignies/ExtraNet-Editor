// Chevrons: V-shaped bands pointing one way, like a runway or a loading bay arrow wall, with an outline edge on
// every band and a shine down the middle.
import { PIXEL, paint, hex, mix, num, BLACK, WHITE } from './_kit.js';

export default {
  id: 'chevrons',
  name: 'Chevrons',
  tags: ['sports', 'military', 'industrial'],
  params: [
    { key: 'a', label: 'Colour one', type: 'color', default: '#E8B21E' },
    { key: 'b', label: 'Colour two', type: 'color', default: '#141414' },
    { key: 'edge', label: 'Edge', type: 'color', default: '#FFF2B8' },
    { key: 'size', label: 'Band width', type: 'range', min: 0.3, max: 2.5, step: 0.05, default: 1 },
    { key: 'angle', label: 'Sharpness', type: 'range', min: 0.3, max: 2, step: 0.05, default: 1 },
    { key: 'dir', label: 'Points', type: 'select', default: 'right', options: [['right', 'Right'], ['left', 'Left'], ['up', 'Up'], ['down', 'Down']] },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const ca = hex(p.a);
      const cb = hex(p.b);
      const edge = hex(p.edge);
      const w = Math.max(3, Math.round(10 * g.u * num(p.size, 1)));
      const k = num(p.angle, 1);
      const vertical = p.dir === 'up' || p.dir === 'down';
      const flip = p.dir === 'left' || p.dir === 'up' ? -1 : 1;
      const off = seed % (w * 2);
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          const along = vertical ? y : x;
          const across = vertical ? x - g.w / 2 : y - g.h / 2;
          const v = flip * along + Math.abs(across) * k + off + 100000;
          const band = Math.floor(v / w);
          const f = v / w - band;
          let c = band % 2 === 0 ? ca : cb;
          if (band % 2 === 0) {
            if (f < 1 / w) c = edge;
            else if (f > 1 - 1 / w) c = mix(ca, BLACK, 0.35);
          }
          const shine = 1 - Math.abs(across) / (vertical ? g.w / 2 : g.h / 2);
          if (shine > 0.8) c = mix(c, WHITE, 0.08);
          g.set(x, y, c);
        }
      }
      g.vignette(BLACK, 0.35);
    });
  },
};
