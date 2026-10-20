// A drafting blueprint: mottled cyanotype paper, minor and major grid, and annotations (dimension lines with
// arrows and numbers, construction circles, hatched parts) plus a title block in one corner.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, fbm, num, BLACK } from './_kit.js';

export default {
  id: 'blueprint',
  name: 'Blueprint',
  tags: ['technical', 'corporate'],
  params: [
    { key: 'paper', label: 'Paper', type: 'color', default: '#123C78' },
    { key: 'ink', label: 'Lines', type: 'color', default: '#CFE3FF' },
    { key: 'cell', label: 'Grid size', type: 'range', min: 0.4, max: 2, step: 0.05, default: 1 },
    { key: 'notes', label: 'Annotations', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6 },
    { key: 'block', label: 'Title block', type: 'select', default: 'right', options: [['right', 'Bottom right'], ['left', 'Bottom left'], ['none', 'None']] },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const paper = hex(p.paper);
      const ink = hex(p.ink);
      const r = rng(seed);
      const n = makeNoise(seed);
      const tones = [mix(paper, BLACK, 0.18), paper, mix(paper, ink, 0.08)];
      const sc = 4 / g.h;
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) g.set(x, y, ramp(tones, fbm(n, x * sc, y * sc, 3) * 1.2 - 0.1, x, y));
      const cell = Math.max(3, Math.round(6 * g.u * num(p.cell, 1)));
      for (let x = 0; x < g.w; x += cell) {
        const major = (x / cell) % 4 === 0;
        for (let y = 0; y < g.h; y++) if (major || y % 2 === 0) g.blend(x, y, ink, major ? 0.28 : 0.12);
      }
      for (let y = 0; y < g.h; y += cell) {
        const major = (y / cell) % 4 === 0;
        for (let x = 0; x < g.w; x++) if (major || x % 2 === 0) g.blend(x, y, ink, major ? 0.28 : 0.12);
      }
      const notes = num(p.notes, 0.6);
      const count = Math.round(notes * 10 * (g.w / g.h) / 4);
      const snap = v => Math.round(v / cell) * cell;
      for (let i = 0; i < count; i++) {
        const kind = r();
        const x = snap(r() * g.w);
        const y = snap(r() * g.h);
        if (kind < 0.3) {
          // A dimension line with arrows and a number.
          const len = snap((3 + r() * 6) * cell);
          const horiz = r() < 0.7;
          const x2 = horiz ? x + len : x;
          const y2 = horiz ? y : y + len;
          g.line(x, y, x2, y2, ink, 0.75);
          if (horiz) {
            g.line(x, y - 2, x, y + 2, ink, 0.75);
            g.line(x2, y - 2, x2, y + 2, ink, 0.75);
            g.line(x + 1, y, x + 3, y - 1, ink, 0.75);
            g.line(x + 1, y, x + 3, y + 1, ink, 0.75);
            g.line(x2 - 1, y, x2 - 3, y - 1, ink, 0.75);
            g.line(x2 - 1, y, x2 - 3, y + 1, ink, 0.75);
            const label = (len / cell * 0.5).toFixed(1) + 'M';
            g.text((x + x2) / 2 - label.length * 2, y - 7, label, ink, 1, 0.8);
          } else {
            g.line(x - 2, y, x + 2, y, ink, 0.75);
            g.line(x - 2, y2, x + 2, y2, ink, 0.75);
          }
        } else if (kind < 0.55) {
          // A construction circle with a centre cross.
          const rad = (1 + r() * 2.5) * cell;
          g.circle(x, y, rad, ink, 0.55);
          g.line(x - rad - 2, y, x + rad + 2, y, ink, 0.3);
          g.line(x, y - rad - 2, x, y + rad + 2, ink, 0.3);
        } else if (kind < 0.8) {
          // A hatched part outline.
          const w = snap((2 + r() * 4) * cell);
          const h = snap((1 + r() * 2) * cell);
          g.line(x, y, x + w, y, ink, 0.8);
          g.line(x, y + h, x + w, y + h, ink, 0.8);
          g.line(x, y, x, y + h, ink, 0.8);
          g.line(x + w, y, x + w, y + h, ink, 0.8);
          for (let k = 3; k < w + h; k += 3) {
            const ax = x + Math.min(k, w);
            const ay = y + Math.max(0, k - w);
            const bx = x + Math.max(0, k - h);
            const by = y + Math.min(k, h);
            g.line(ax, ay, bx, by, ink, 0.25);
          }
        } else {
          // A leader with a callout number.
          const x2 = x + (r() < 0.5 ? -1 : 1) * 3 * cell;
          const y2 = y - 2 * cell;
          g.line(x, y, x2, y2, ink, 0.6);
          g.circle(x2, y2 - 3, 4, ink, 0.7);
          g.text(x2 - 1, y2 - 5, String(1 + Math.floor(r() * 9)), ink, 1, 0.9);
        }
      }
      if (p.block !== 'none') {
        const bw = Math.round(g.w * 0.22);
        const bh = Math.round(g.h * 0.24);
        const bx = p.block === 'left' ? 3 : g.w - bw - 3;
        const by = g.h - bh - 3;
        g.rect(bx, by, bw, bh, paper, 0.85);
        g.line(bx, by, bx + bw, by, ink);
        g.line(bx, by, bx, by + bh, ink);
        g.line(bx + bw, by, bx + bw, by + bh, ink);
        g.line(bx, by + bh, bx + bw, by + bh, ink);
        g.line(bx, by + Math.round(bh / 2), bx + bw, by + Math.round(bh / 2), ink, 0.7);
        g.line(bx + Math.round(bw * 0.6), by + Math.round(bh / 2), bx + Math.round(bw * 0.6), by + bh, ink, 0.7);
        g.text(bx + 3, by + 3, 'DWG ' + String(100 + Math.floor(r() * 900)), ink, 1, 0.9);
        g.text(bx + 3, by + Math.round(bh / 2) + 3, 'REV ' + 'ABCD'[Math.floor(r() * 4)], ink, 1, 0.8);
        g.text(bx + Math.round(bw * 0.6) + 3, by + Math.round(bh / 2) + 3, '1:' + (10 + Math.floor(r() * 4) * 10), ink, 1, 0.8);
      }
      g.vignette(BLACK, 0.35);
    });
  },
};
