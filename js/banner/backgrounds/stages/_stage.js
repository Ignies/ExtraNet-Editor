// Shared helpers for the Stages backgrounds: an area on one side for dropping sprites (lit, framed), the title
// side on the other, and the divider between them, like The Annex banner. Not a background itself.
import { hex, mix, ramp, makeNoise, fbm, num, clamp, bayer, BLACK, WHITE } from '../_kit.js';

export const GROUP = 'Stages';

/** The controls every stage has, before its own: side, width, the title side's colour, the stage light. */
export function stageParams({ side = 'left', width = 0.42, bg = '#141A1C', light = '#FFF2C8' } = {}) {
  return [
    { key: 'side', label: 'Stage side', type: 'select', default: side, options: [['left', 'Left'], ['right', 'Right']] },
    { key: 'width', label: 'Stage width', type: 'range', min: 0.25, max: 0.7, step: 0.01, default: width },
    { key: 'bg', label: 'Title side', type: 'color', default: bg },
    { key: 'light', label: 'Light', type: 'color', default: light },
  ];
}

/** Paints the title side and the divider and returns the stage's box { x, w, x1, h, light, bg, n }. */
export function layout(g, p, seed) {
  const w = Math.round(g.w * clamp(num(p.width, 0.42), 0.1, 0.9));
  const x = p.side === 'right' ? g.w - w : 0;
  const bg = hex(p.bg);
  const n = makeNoise(seed + 77);
  const tones = [mix(bg, BLACK, 0.25), bg, mix(bg, WHITE, 0.05)];
  for (let y = 0; y < g.h; y++) {
    for (let xx = 0; xx < g.w; xx++) {
      if (xx >= x && xx < x + w) continue;
      g.set(xx, y, ramp(tones, 0.55 + (fbm(n, xx * 0.04, y * 0.04, 2) - 0.5) * 0.5 - y / g.h * 0.15, xx, y));
    }
  }
  return { x, w, x1: x + w, h: g.h, light: hex(p.light), bg, n };
}

/** The divider between stage and title: a dark seam and a lit edge. Call after drawing the stage. */
export function divider(g, s, colour) {
  const edge = s.x === 0 ? s.x1 : s.x - 1;
  g.rect(edge, 0, 1, g.h, mix(colour, BLACK, 0.6));
  g.rect(s.x === 0 ? edge + 1 : edge - 1, 0, 1, g.h, mix(colour, WHITE, 0.25));
  g.rect(s.x === 0 ? edge + 2 : edge - 2, 0, 1, g.h, mix(s.bg, BLACK, 0.4));
}

/** Fills the stage box row by row from fn(x, y) -> colour. */
export function fillStage(g, s, fn) {
  for (let y = 0; y < g.h; y++) for (let x = s.x; x < s.x1; x++) g.set(x, y, fn(x, y));
}

/** A dithered light falling off from (cx, cy) inside the stage box. */
export function pool(g, s, cx, cy, rx, ry, colour, k) {
  for (let y = Math.max(0, Math.floor(cy - ry)); y < Math.min(g.h, cy + ry); y++) {
    for (let x = Math.max(s.x, Math.floor(cx - rx)); x < Math.min(s.x1, cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d < 1) {
        const a = (1 - d) * k;
        const q = Math.round(a * 5 + bayer(x, y) - 0.5) / 5;
        if (q > 0) g.blend(x, y, colour, clamp(q));
      }
    }
  }
}

/** A fluorescent tube across the top of the stage, with its glow. */
export function tube(g, s, colour, y = 2) {
  const inset = Math.round(s.w * 0.12);
  g.rect(s.x + inset, y, s.w - inset * 2, Math.max(1, Math.round(g.u * 1.5)), mix(colour, WHITE, 0.6));
  pool(g, s, s.x + s.w / 2, y, s.w * 0.75, g.h * 0.55, colour, 0.35);
}

export { fbm };
