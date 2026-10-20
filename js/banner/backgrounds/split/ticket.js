// A ticket: the main body and a tear-off stub, divided by a perforated line with round notches cut from the top and
// bottom edges, and a fine inset border.
import { PIXEL, paint, hex, mix, num, BLACK } from '../_kit.js';
import { GROUP, textureParams, paintRegions, ACCENT } from './_split.js';

export default {
  id: 'split-ticket',
  name: 'Ticket stub',
  group: GROUP,
  tags: ['split', 'leisure', 'retro'],
  params: [
    { key: 'a', label: 'Ticket', type: 'color', default: '#F2E6C8' },
    { key: 'b', label: 'Stub', type: 'color', default: '#D9502A' },
    { key: 'accent', label: 'Border', type: 'color', default: '#5A2A1A' },
    { key: 'd', label: 'Behind', type: 'color', default: '#1A1A24' },
    { key: 'pos', label: 'Stub width', type: 'range', min: 0.12, max: 0.45, step: 0.01, default: 0.24 },
    { key: 'side', label: 'Stub side', type: 'select', default: 'right', options: [['right', 'Right'], ['left', 'Left']] },
    ACCENT,
    ...textureParams('grain', 'both'),
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const cols = [hex(p.a), hex(p.b), hex(p.accent), hex(p.d)];
      const m = Math.round(3 * g.u);
      const sw = Math.round(g.w * num(p.pos, 0.24));
      const px = p.side === 'left' ? sw : g.w - sw;
      const nr = Math.round(6 * g.u);
      const inset = Math.round(4 * g.u);
      const border = p.accentOn !== 'no';
      paintRegions(g, p, cols, (x, y) => {
        if (x < m || x >= g.w - m || y < m || y >= g.h - m) return 3;
        const dx = x + 0.5 - px;
        if (dx * dx + (y - m) * (y - m) < nr * nr || dx * dx + (y - g.h + m) * (y - g.h + m) < nr * nr) return 3;
        // Perforation: a dotted gap along the divide.
        if (Math.abs(dx) < 1 && y % Math.max(3, Math.round(4 * g.u)) < 2) return 3;
        const onStub = p.side === 'left' ? x < px : x >= px;
        if (border) {
          const bx0 = onStub ? (p.side === 'left' ? m : px) : (p.side === 'left' ? px : m);
          const bx1 = onStub ? (p.side === 'left' ? px : g.w - m) : (p.side === 'left' ? g.w - m : px);
          if ((y === m + inset || y === g.h - m - inset - 1) && x > bx0 + inset && x < bx1 - inset) return 2;
          if ((x === bx0 + inset || x === bx1 - inset) && y > m + inset && y < g.h - m - inset) return 2;
        }
        return onStub ? 1 : 0;
      }, seed);
      g.rect(m + 1, g.h - m, g.w - m * 2, 1, mix(cols[3], BLACK, 0.5));
    });
  },
};
