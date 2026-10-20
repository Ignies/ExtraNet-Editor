// Shared helpers for the Split colours backgrounds: bold flat colour regions like The Colony Tattler banner, with
// an optional texture on one region, an accent stripe and a starburst. Not a background itself.
import { mix, hash, bayer, BLACK, WHITE } from '../_kit.js';

export const GROUP = 'Split colours';

export const TEXTURES = [['none', 'None'], ['dots', 'Dots'], ['halftone', 'Halftone fade'], ['lines', 'Pinstripes'], ['grain', 'Grain']];

export function textureParams(def = 'dots', on = 'a') {
  return [
    { key: 'texture', label: 'Texture', type: 'select', default: def, options: TEXTURES },
    { key: 'textureOn', label: 'Texture on', type: 'select', default: on, options: [['a', 'Colour one'], ['b', 'Colour two'], ['both', 'Both']] },
  ];
}

/** The colour of a textured pixel: the base colour with dots, lines or grain in a shade of itself. */
export function textured(c, kind, x, y, g, seed) {
  if (kind === 'none') return c;
  const shade = mix(c, (c[0] + c[1] + c[2]) / 3 > 140 ? BLACK : WHITE, 0.14);
  const s = Math.max(3, Math.round(4 * g.u));
  if (kind === 'dots') {
    const ox = Math.floor(y / s) % 2 ? Math.floor(s / 2) : 0;
    return (x + ox) % s === 0 && y % s === 0 ? shade : c;
  }
  if (kind === 'halftone') {
    const t = x / g.w;
    const cx = ((x % s) + 0.5) / s - 0.5;
    const cy = ((y % s) + 0.5) / s - 0.5;
    return Math.sqrt(cx * cx + cy * cy) < t * 0.55 ? shade : c;
  }
  if (kind === 'lines') return (x + y) % (s * 2) === 0 ? shade : c;
  if (kind === 'grain') return hash(x, y, seed) < 0.1 ? shade : c;
  return c;
}

/**
 * Paints the regions: region(x, y) returns 0 (colour one), 1 (colour two), 2 (accent) or 3 (fourth colour).
 * The texture goes on the regions picked by textureOn.
 */
export function paintRegions(g, p, cols, region, seed) {
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const k = region(x, y);
      let c = cols[k];
      if ((k === 0 && p.textureOn !== 'b') || (k === 1 && p.textureOn !== 'a')) c = textured(c, p.texture, x, y, g, seed);
      g.set(x, y, c);
    }
  }
}

/** A starburst badge: n points between radii r and r * inner, with an outline and a hard offset shadow. */
export function starburst(g, cx, cy, r, colour, outline, points = 14, inner = 0.72) {
  const sh = Math.max(1, Math.round(2 * g.u));
  for (let pass = 0; pass < 2; pass++) {
    const ox = pass === 0 ? sh : 0;
    for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++) {
      for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
        const dx = x + 0.5 - cx - ox;
        const dy = y + 0.5 - cy - ox;
        const a = Math.atan2(dy, dx);
        const t = Math.abs(((((a / (Math.PI * 2)) * points * 2) % 2) + 2) % 2 - 1);
        const edge = r * (inner + (1 - inner) * t);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (pass === 0) {
          if (d < edge) g.blend(x, y, BLACK, 0.35);
        } else if (d < edge - 1) g.set(x, y, colour);
        else if (d < edge) g.set(x, y, outline);
      }
    }
  }
}

/** A dithered shadow strip of width w along a boundary, given the signed distance from it. */
export function edgeShadow(g, x, y, dist, w, k = 0.35) {
  if (dist > 0 && dist < w) {
    const a = (1 - dist / w) * k;
    if (a > bayer(x, y) * 0.6) g.blend(x, y, BLACK, a);
  }
}

export const ACCENT = { key: 'accentOn', label: 'Accent stripe', type: 'select', default: 'yes', options: [['yes', 'Show'], ['no', 'Hide']] };
