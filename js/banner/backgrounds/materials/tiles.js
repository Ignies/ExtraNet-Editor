// Tiles: glazed tiles in a grid, checkerboard or brick bond, with grout lines, a glossy highlight on each tile,
// slight colour variation and the odd chip.
import { PIXEL, paint, hex, mix, ramp, hash, num, BLACK, WHITE } from '../_kit.js';
import { GROUP, LIGHT, VIGNETTE, light } from './_mat.js';

export default {
  id: 'mat-tiles',
  name: 'Glazed tiles',
  group: GROUP,
  tags: ['material', 'colony', 'clinic'],
  params: [
    { key: 'tileA', label: 'Tile', type: 'color', default: '#E8F0EC' },
    { key: 'tileB', label: 'Second tile', type: 'color', default: '#3A8A7A' },
    { key: 'grout', label: 'Grout', type: 'color', default: '#8A8F8C' },
    { key: 'pattern', label: 'Pattern', type: 'select', default: 'grid', options: [['grid', 'Grid'], ['checker', 'Checkerboard'], ['brick', 'Brick bond'], ['band', 'Grid with a band']] },
    { key: 'size', label: 'Tile size', type: 'range', min: 0.5, max: 2.5, step: 0.05, default: 1 },
    { key: 'wear', label: 'Wear', type: 'range', min: 0, max: 1, step: 0.05, default: 0.25 },
    LIGHT,
    VIGNETTE,
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const a = hex(p.tileA);
      const b = hex(p.tileB);
      const grout = hex(p.grout);
      const wear = num(p.wear, 0.25);
      const ts = Math.max(4, Math.round(12 * g.u * num(p.size, 1)));
      const bandRow = Math.floor(g.h / ts / 2);
      for (let y = 0; y < g.h; y++) {
        const j = Math.floor(y / ts);
        const shift = p.pattern === 'brick' && j % 2 ? Math.floor(ts / 2) : 0;
        for (let x = 0; x < g.w; x++) {
          const i = Math.floor((x + shift) / ts);
          const u = (x + shift) % ts;
          const v = y % ts;
          if (u === 0 || v === 0) {
            g.set(x, y, grout);
            continue;
          }
          let base = a;
          if (p.pattern === 'checker' && (i + j) % 2) base = b;
          if (p.pattern === 'band' && j === bandRow) base = b;
          const tone = (hash(i, j, seed) - 0.5) * 0.12;
          base = tone > 0 ? mix(base, WHITE, tone) : mix(base, BLACK, -tone);
          // Glaze: lit top-left edge, shaded bottom-right edge, a small gloss highlight.
          let c = base;
          if (u === 1 || v === 1) c = mix(base, WHITE, 0.3);
          else if (u === ts - 1 || v === ts - 1) c = mix(base, BLACK, 0.18);
          else if (u > 2 && u < 2 + ts * 0.25 && v === 3) c = mix(base, WHITE, 0.55);
          if (hash(i, j, seed + 9) < wear * 0.15 && u > ts * 0.6 && v > ts * 0.6 && u + v > ts * 1.5) c = grout;
          if (hash(x, y, seed) < wear * 0.03) c = mix(c, BLACK, 0.2);
          g.set(x, y, c);
        }
      }
      void ramp;
      light(g, p);
    });
  },
};
