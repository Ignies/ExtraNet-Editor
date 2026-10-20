// A corporate panel: a dithered diagonal gradient, a fine hexagon lattice that fades in from one side, a soft gloss
// sweep and thin rules top and bottom. Weyland-Yutani navy by default.
import { PIXEL, paint, hex, mix, ramp, num, clamp, smooth, WHITE } from './_kit.js';

export default {
  id: 'corporate-hex',
  name: 'Corporate hex',
  tags: ['corporate'],
  params: [
    { key: 'from', label: 'Dark', type: 'color', default: '#0A1626' },
    { key: 'to', label: 'Light', type: 'color', default: '#1D4A72' },
    { key: 'line', label: 'Hex lines', type: 'color', default: '#8DB8E0' },
    { key: 'strength', label: 'Hex strength', type: 'range', min: 0, max: 1, step: 0.05, default: 0.35 },
    { key: 'size', label: 'Hex size', type: 'range', min: 0.5, max: 2, step: 0.05, default: 1 },
    { key: 'side', label: 'Hexes from', type: 'select', default: 'right', options: [['right', 'Right'], ['left', 'Left'], ['all', 'Everywhere']] },
    { key: 'rules', label: 'Rules', type: 'select', default: 'yes', options: [['yes', 'Top and bottom'], ['no', 'None']] },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const a = hex(p.from);
      const b = hex(p.to);
      const line = hex(p.line);
      const tones = [a, mix(a, b, 0.25), mix(a, b, 0.5), mix(a, b, 0.75), b];
      const strength = num(p.strength, 0.35);
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          const v = (x / g.w) * 0.75 + (1 - y / g.h) * 0.35;
          const gloss = Math.exp(-Math.pow((x / g.w - 0.55 + (y / g.h) * 0.25) * 6, 2)) * 0.18;
          g.set(x, y, ramp(tones, v * 0.85 + gloss, x, y));
        }
      }
      // Pointy-top hexagon lattice drawn as edges, fading by side.
      const R = Math.max(3, 7 * g.u * num(p.size, 1));
      const hw = Math.sqrt(3) * R;
      const fade = x => {
        const t = x / g.w;
        if (p.side === 'left') return smooth(0.75, 0.15, t);
        if (p.side === 'all') return 1;
        return smooth(0.25, 0.85, t);
      };
      const corners = [];
      for (let k = 0; k < 6; k++) {
        const ang = (Math.PI / 3) * k + Math.PI / 6;
        corners.push([Math.cos(ang) * R, Math.sin(ang) * R]);
      }
      for (let row = -1; row * R * 1.5 < g.h + R; row++) {
        const cy = row * R * 1.5;
        const shift = row % 2 ? hw / 2 : 0;
        for (let cx = -hw + shift; cx < g.w + hw; cx += hw) {
          const al = strength * fade(cx) * 0.9;
          if (al < 0.02) continue;
          // Three edges per cell are enough to draw the whole lattice once.
          for (let k = 0; k < 3; k++) {
            const [x0, y0] = corners[k];
            const [x1, y1] = corners[k + 1];
            g.line(cx + x0, cy + y0, cx + x1, cy + y1, line, al);
          }
        }
      }
      if (p.rules !== 'no') {
        const t = Math.max(1, Math.round(g.u));
        g.rect(0, t * 2, g.w, t, line, 0.45);
        g.rect(0, g.h - t * 3, g.w, t, line, 0.45);
        g.rect(0, 0, g.w, t, WHITE, 0.08);
      }
      // Darken slightly where text usually sits so titles read.
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w * 0.5; x++) g.blend(x, y, a, clamp(0.25 - x / g.w * 0.5));
    });
  },
};
