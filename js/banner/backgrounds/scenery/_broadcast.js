// Shared helpers for the broadcast sets in Scenery (the news desk, the newsroom, the weather map and the satellite
// view): CRT monitors with something on them, a shaded planet, centred lettering in the tiny font. Not a background
// itself.
import { mix, ramp, makeNoise, fbm, hash, clamp, bayer, BLACK, WHITE } from '../_kit.js';

/** The width the tiny font draws str at, at a scale. */
export function textWidth(str, scale = 1) {
  return Math.max(0, String(str).length * 4 * scale - scale);
}

/** Tiny-font text centred on cx. */
export function textCentre(g, cx, y, str, c, scale = 1) {
  g.text(Math.round(cx - textWidth(str, scale) / 2), y, str, c, scale);
}

/** A rectangle with a one pixel light top/left and dark bottom/right edge. */
export function bevel(g, x, y, w, h, c, k = 0.3) {
  g.rect(x, y, w, h, c);
  g.rect(x, y, w, 1, mix(c, WHITE, k));
  g.rect(x, y, 1, h, mix(c, WHITE, k * 0.6));
  g.rect(x, y + h - 1, w, 1, mix(c, BLACK, k * 1.4));
  g.rect(x + w - 1, y, 1, h, mix(c, BLACK, k * 1.2));
}

export const SCREEN_KINDS = ['bars', 'planet', 'static', 'map', 'face', 'text', 'graph', 'logo'];

/**
 * A CRT monitor: a bezel, a slightly rounded screen showing kind ('bars', 'planet', 'static', 'map', 'face',
 * 'text', 'graph', 'logo'), scanlines and a glint. tint colours the picture; label is used by 'logo'.
 */
export function crt(g, x, y, w, h, kind, seed, tint, label = '') {
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);
  const b = Math.max(1, Math.round(Math.min(w, h) * 0.1));
  bevel(g, x, y, w, h, [44, 46, 52], 0.35);
  const sx = x + b;
  const sy = y + b;
  const sw = w - b * 2;
  const sh = h - b * 2;
  if (sw < 2 || sh < 2) return;
  const n = makeNoise(seed);
  const dim = mix(tint, BLACK, 0.75);
  for (let yy = 0; yy < sh; yy++) {
    for (let xx = 0; xx < sw; xx++) {
      const u = (xx + 0.5) / sw;
      const v = (yy + 0.5) / sh;
      let c = dim;
      if (kind === 'bars') {
        const bars = [[200, 200, 200], [200, 200, 40], [40, 200, 200], [40, 200, 40], [200, 40, 200], [200, 40, 40], [40, 40, 200]];
        c = v < 0.72 ? bars[Math.min(6, Math.floor(u * 7))] : u < 0.3 ? [10, 30, 90] : u < 0.6 ? [230, 230, 230] : [20, 20, 24];
      } else if (kind === 'static') {
        const h1 = hash(x + xx, y + yy, seed);
        c = mix([20, 20, 26], [210, 214, 222], h1 * h1);
      } else if (kind === 'planet') {
        const dx = u - 0.5;
        const dy = (v - 0.55) * sh / sw;
        const d = Math.hypot(dx, dy);
        if (d < 0.32) {
          const lit = clamp(0.75 - (dx + dy) * 1.6);
          const land = fbm(n, u * 6, v * 6, 2) > 0.52;
          c = ramp([mix(tint, BLACK, 0.7), land ? mix(tint, [120, 200, 90], 0.6) : tint, mix(tint, WHITE, 0.4)], lit, xx, yy);
        } else c = hash(xx, yy, seed) < 0.03 ? mix(tint, WHITE, 0.5) : mix(tint, BLACK, 0.85);
      } else if (kind === 'map') {
        const land = fbm(n, u * 3, v * 3, 3) > 0.5;
        c = land ? mix(tint, [110, 170, 80], 0.55) : mix(tint, BLACK, 0.45);
        if ((xx % 6 === 0 || yy % 6 === 0)) c = mix(c, WHITE, 0.2);
      } else if (kind === 'face') {
        // A head-and-shoulders silhouette against a lit backdrop: someone on a live link.
        const back = ramp([mix(tint, BLACK, 0.5), tint], 1 - v, xx, yy);
        const hx = (u - 0.5) / 0.16;
        const hy = (v - 0.42) / 0.24;
        const body = v > 0.7 && Math.abs(u - 0.5) < 0.18 + (v - 0.7) * 0.9;
        c = hx * hx + hy * hy < 1 || body ? mix(tint, BLACK, 0.82) : back;
      } else if (kind === 'text') {
        c = mix(tint, BLACK, 0.8);
        const row = Math.floor(yy / 3);
        if (yy % 3 === 1 && xx > 1 && xx < sw - 2 && hash(Math.floor(xx / 3), row, seed) > 0.25 && xx < sw * (0.5 + hash(row, 1, seed) * 0.5)) c = mix(tint, WHITE, 0.2);
      } else if (kind === 'graph') {
        c = mix(tint, BLACK, 0.82);
        if (xx % 5 === 0 || yy % 5 === 0) c = mix(tint, BLACK, 0.65);
        const gy = sh * (0.75 - fbm(n, u * 3, 0.5, 2) * 0.6 + 0.1);
        if (Math.abs(yy - gy) < 0.8) c = mix(tint, WHITE, 0.5);
      } else if (kind === 'logo') {
        c = ramp([mix(tint, BLACK, 0.6), tint], 1 - Math.hypot(u - 0.5, v - 0.5) * 1.6, xx, yy);
      }
      g.set(sx + xx, sy + yy, c);
    }
  }
  if (kind === 'logo' && label) {
    const scale = Math.max(1, Math.floor(Math.min((sw - 2) / textWidth(label, 1), sh / 7)));
    textCentre(g, sx + sw / 2, Math.round(sy + (sh - 5 * scale) / 2), label, mix(tint, WHITE, 0.85), scale);
  }
  // Rounded screen corners, scanlines and a glint.
  for (const [cx, cy] of [[sx, sy], [sx + sw - 1, sy], [sx, sy + sh - 1], [sx + sw - 1, sy + sh - 1]]) g.set(cx, cy, [24, 24, 28]);
  for (let yy = 1; yy < sh; yy += 2) for (let xx = 0; xx < sw; xx++) g.blend(sx + xx, sy + yy, BLACK, 0.18);
  if (sw > 6 && sh > 6) {
    g.set(sx + 1, sy + 1, mix(WHITE, tint, 0.3));
    g.set(sx + 2, sy + 1, mix(WHITE, tint, 0.5));
  }
}

/**
 * A planet seen from space: continents and seas from noise wrapped on a sphere, cloud bands, a lit side and a dark
 * side, and a thin atmosphere rim. opts: sea, land, high (land peaks), cloud, rim, light [x, y] (towards the sun,
 * roughly unit), clouds 0..1, spin (rotation), storm [lon, lat] for a spiral storm, graphic (flat, gridded, for a
 * studio graphic rather than a photograph).
 */
export function planet(g, cx, cy, r, seed, opts) {
  const o = { landLevel: 0.52, clouds: 0.5, spin: 0, light: [-0.6, -0.5], graphic: false, ...opts };
  const n = makeNoise(seed);
  const nc = makeNoise(seed + 9);
  const lx = o.light[0];
  const ly = o.light[1];
  const lz = Math.sqrt(Math.max(0, 1 - lx * lx - ly * ly));
  const x0 = Math.floor(cx - r - 3);
  const x1 = Math.ceil(cx + r + 3);
  const y0 = Math.max(0, Math.floor(cy - r - 3));
  const y1 = Math.min(g.h - 1, Math.ceil(cy + r + 3));
  for (let y = y0; y <= y1; y++) {
    for (let x = Math.max(0, x0); x <= Math.min(g.w - 1, x1); x++) {
      const nx = (x + 0.5 - cx) / r;
      const ny = (y + 0.5 - cy) / r;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) {
        // Atmosphere rim, brighter on the lit side.
        const d = Math.sqrt(d2);
        const out = (d - 1) * r;
        if (out < 2.5) {
          const lit = clamp((nx * lx + ny * ly) / d * 0.8 + 0.5);
          const a = (1 - out / 2.5) * (o.graphic ? 0.7 : 0.25 + lit * 0.6);
          if (a > bayer(x, y)) g.set(x, y, mix(g.get(x, y), o.rim, 0.75));
        }
        continue;
      }
      const nz = Math.sqrt(1 - d2);
      const lon = Math.atan2(nx, nz) + o.spin;
      const lat = Math.asin(ny);
      const px = Math.cos(lat) * Math.sin(lon);
      const pz = Math.cos(lat) * Math.cos(lon);
      // Sample noise on the sphere (3D by pairs) so the continents wrap without a seam at the edge of the disc.
      const e = fbm(n, px * 1.6 + 3, ny * 1.6 + pz * 0.9 + 3, 4);
      const isLand = e > o.landLevel;
      let c;
      if (o.graphic) {
        c = isLand ? (e > 0.6 ? o.high : o.land) : o.sea;
        const gl = Math.abs(((lat * 180) / Math.PI) % 20) < 1.4 || Math.abs((((lon * 180) / Math.PI) % 20 + 20) % 20) < 1.4 * (1 / Math.max(0.3, Math.cos(lat)));
        if (gl) c = mix(c, WHITE, 0.35);
      } else {
        c = isLand ? ramp([o.land, o.high], (e - o.landLevel) * 6, x, y) : ramp([mix(o.sea, BLACK, 0.25), o.sea], (e - 0.3) * 4, x, y);
        // Cloud bands: noise stretched along the latitude, plus an optional spiral storm.
        let cl = fbm(nc, lon * 2.2, lat * 7, 4) - (1 - o.clouds) * 0.45 - 0.22;
        cl += Math.max(0, 0.18 - Math.abs(Math.sin(lat * 5.5 + 0.6)) * 0.2);
        if (o.storm) {
          const sdx = lon - o.storm[0];
          const sdy = lat - o.storm[1];
          const sd = Math.hypot(sdx, sdy);
          if (sd < 0.45) {
            const ang = Math.atan2(sdy, sdx);
            const arm = Math.cos(ang * 2 - sd * 26);
            cl = Math.max(cl, (1 - sd / 0.45) * (0.35 + arm * 0.3) - (sd < 0.04 ? 0.5 : 0));
          }
        }
        if (cl > 0.08) c = mix(c, o.cloud, cl > 0.2 ? 0.95 : 0.55);
      }
      // Light and shade, in four dithered steps.
      const lit = clamp((nx * lx + ny * ly + nz * lz) * 1.15 + 0.15);
      const q = Math.floor(lit * 4 + bayer(x, y) * 0.999) / 4;
      g.set(x, y, mix(c, mix(BLACK, o.sea, 0.12), clamp(1 - q) * (o.graphic ? 0.45 : 0.88)));
    }
  }
}

/** Fills a polygon [[x, y], ...] into a mask (Uint8Array of w * h) with id, by scanline at pixel centres. */
export function fillPoly(mask, w, h, pts, id) {
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [, y] of pts) {
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(h - 1, Math.ceil(y1)); y++) {
    const cy = y + 0.5;
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) xs.push(ax + (cy - ay) / (by - ay) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.max(0, Math.round(xs[k])); x < Math.min(w, Math.round(xs[k + 1])); x++) mask[y * w + x] = id;
    }
  }
}
