// Shared helpers for the Scenery backgrounds: the "detail side" and "time of day" controls, a banded sky, stars and
// a shade that keeps the title side readable. Not a background itself.
import { mix, ramp, smooth, clamp, hash, bayer, BLACK, WHITE } from '../_kit.js';

export const GROUP = 'Scenery';

export const FOCUS = {
  key: 'focus', label: 'Detail side', type: 'select', default: 'right',
  options: [['right', 'Right (title on the left)'], ['left', 'Left (title on the right)'], ['center', 'Centre (title on top)']],
};

export function timeParam(def = 'night') {
  return { key: 'time', label: 'Time of day', type: 'select', default: def, options: [['night', 'Night'], ['dusk', 'Dusk'], ['day', 'Day']] };
}

const NIGHT = [12, 16, 44];
const DAY = [214, 232, 250];

/** Shifts a colour for the time of day: the colours as picked are dusk; night darkens to blue, day lightens. */
export function tod(c, time, k = 1) {
  if (time === 'night') return mix(c, NIGHT, 0.5 * k);
  if (time === 'day') return mix(c, DAY, 0.4 * k);
  return c;
}

/** How much detail belongs at column x, 0..1: high on the detail side, low where the title goes. */
export function weight(focus, x, w) {
  const t = x / w;
  if (focus === 'left') return smooth(0.72, 0.22, t);
  if (focus === 'center') return 1 - smooth(0.12, 0.45, Math.abs(t - 0.5));
  return smooth(0.28, 0.78, t);
}

/** The title side's x range as fractions [from, to] of the width. */
export function titleSide(focus) {
  if (focus === 'left') return [0.45, 1];
  if (focus === 'center') return [0, 1];
  return [0, 0.55];
}

/** A dithered vertical sky from top to bottom colour between rows y0 and y1, in a few hard bands. */
export function sky(g, top, bottom, y0 = 0, y1 = g.h, bands = 6) {
  const tones = [];
  for (let i = 0; i < bands; i++) tones.push(mix(top, bottom, i / (bands - 1)));
  for (let y = y0; y < y1; y++) {
    const v = (y - y0) / Math.max(1, y1 - y0 - 1);
    for (let x = 0; x < g.w; x++) g.set(x, y, ramp(tones, v, x, y));
  }
}

/** Stars above row maxY, fading towards it. */
export function stars(g, seed, density, maxY, colour = WHITE) {
  for (let y = 0; y < maxY; y++) {
    const fade = 1 - y / maxY;
    for (let x = 0; x < g.w; x++) {
      const h = hash(x, y, seed + 31);
      if (h < density * 0.012 * fade) g.set(x, y, h < density * 0.002 ? colour : mix(g.get(x, y), colour, 0.55));
    }
  }
}

/** A soft dithered shade over the title side so the title reads; centre focus shades the top. */
export function titleShade(g, focus, colour = BLACK, k = 0.35) {
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const a = focus === 'center' ? k * smooth(0.55, 0, y / g.h) : k * (1 - weight(focus, x, g.w)) * 0.9;
      if (a > 0.02) {
        const q = Math.round(a * 4 + bayer(x, y) - 0.5) / 4;
        if (q > 0) g.blend(x, y, colour, clamp(q));
      }
    }
  }
}
