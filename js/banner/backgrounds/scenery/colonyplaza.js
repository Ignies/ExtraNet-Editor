// A colony plaza outdoors: a hazy sky, an atmosphere processor towering in the distance with a steam plume, rows of
// ribbed prefab modules with lit windows and roof gear, lamp posts throwing pools of light, and an open, rutted
// plaza of ground plates in the lower half for people to stand on.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, fbm, hash, num, clamp, bayer, BLACK, WHITE } from '../_kit.js';
import { GROUP, FOCUS, timeParam, tod, weight, sky, stars } from './_scene.js';

/** A prefab module standing on baseY: ribbed walls, a window strip, maybe a door, and roof gear. */
function prefab(g, x, baseY, w, h, wall, win, lit, r, seed, near) {
  const u = g.u;
  const y0 = baseY - h;
  const rib = Math.max(2, Math.round(2 * u));
  for (let y = y0; y < baseY; y++) {
    for (let xx = x; xx < x + w; xx++) {
      let c = (xx - x) % rib === 0 ? mix(wall, BLACK, 0.22) : wall;
      if (xx === x) c = mix(wall, WHITE, 0.18);
      if (xx >= x + w - 1) c = mix(wall, BLACK, 0.4);
      g.set(xx, y, c);
    }
  }
  // Roof edge, and a band of darker plating at the foot.
  g.rect(x - 1, y0 - 1, w + 2, Math.max(1, Math.round(u)), mix(wall, WHITE, 0.25));
  g.rect(x, baseY - Math.round(3 * u), w, Math.round(3 * u), mix(wall, BLACK, 0.3));
  // Window strip.
  const wy = Math.round(y0 + h * 0.3);
  const ww = Math.max(2, Math.round(4 * u));
  const wh = Math.max(1, Math.round(2.5 * u));
  for (let xx = x + Math.round(3 * u); xx + ww < x + w - 2 * u; xx += ww + Math.round(3 * u)) {
    const on = hash(xx, wy, seed) < lit;
    g.rect(xx, wy, ww, wh, on ? win : mix(wall, BLACK, 0.55));
    if (on) {
      g.rect(xx, wy, ww, 1, mix(win, WHITE, 0.45));
      if (near) g.glow(xx + ww / 2, wy + wh / 2, ww * 1.6, wh * 2.2, win, 0.18);
    }
  }
  // A door with a hazard header on the nearer modules.
  if (near && w > 22 * u && r() < 0.8) {
    const dw = Math.round(7 * u);
    const dx = Math.round(x + w * (0.25 + r() * 0.5) - dw / 2);
    const dh = Math.round(Math.min(h * 0.55, 12 * u));
    g.rect(dx, baseY - dh, dw, dh, mix(wall, BLACK, 0.55));
    g.rect(dx + 1, baseY - dh + 1, dw - 2, 1, mix(wall, BLACK, 0.3));
    g.rect(dx + Math.round(dw / 2), baseY - dh, 1, dh, mix(wall, BLACK, 0.7));
    for (let xx = dx - 1; xx < dx + dw + 1; xx++) {
      for (let k = 0; k < Math.max(2, Math.round(1.5 * u)); k++) g.set(xx, baseY - dh - 1 - k, Math.floor((xx + k) / 2) % 2 ? [30, 28, 22] : [220, 170, 40]);
    }
    g.set(dx + dw + 1, baseY - dh + 2, [90, 255, 120]);
  }
  // Roof gear: a vent box, an antenna mast with a beacon, or a small dish.
  const pick = r();
  const gx = Math.round(x + w * (0.2 + r() * 0.6));
  if (pick < 0.4) {
    const vw = Math.round(6 * u);
    const vh = Math.round(3 * u);
    g.rect(gx - vw / 2, y0 - vh, vw, vh, mix(wall, BLACK, 0.2));
    for (let xx = 0; xx < vw; xx += 2) g.set(gx - vw / 2 + xx, y0 - vh + 1, mix(wall, BLACK, 0.5));
  } else if (pick < 0.75) {
    const ah = Math.round((6 + r() * 8) * u);
    g.rect(gx, y0 - ah, 1, ah, mix(wall, BLACK, 0.3));
    g.rect(gx - 2, y0 - ah + 2, 5, 1, mix(wall, BLACK, 0.3));
    g.set(gx, y0 - ah - 1, [255, 70, 60]);
    g.glow(gx + 0.5, y0 - ah - 0.5, 3 * u, 3 * u, [255, 70, 60], 0.35);
  } else {
    const dr = Math.round(3 * u);
    g.rect(gx, y0 - dr, 1, dr, mix(wall, BLACK, 0.3));
    for (let k = -dr; k <= dr; k++) g.set(gx + k, y0 - dr - Math.round(Math.sqrt(dr * dr - k * k) * 0.5), mix(wall, WHITE, 0.2));
  }
}

export default {
  id: 'scene-colony-plaza',
  name: 'Colony plaza',
  group: GROUP,
  tags: ['scenery', 'colony', 'outdoor', 'industrial'],
  params: [
    { key: 'skyTop', label: 'Sky top', type: 'color', default: '#2C2C44' },
    { key: 'skyLow', label: 'Sky low', type: 'color', default: '#C27848' },
    { key: 'buildings', label: 'Buildings', type: 'color', default: '#4C535C' },
    { key: 'ground', label: 'Ground', type: 'color', default: '#5E554A' },
    { key: 'lights', label: 'Lights', type: 'color', default: '#FFC060' },
    { key: 'plume', label: 'Processor plume', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6 },
    FOCUS,
    timeParam('dusk'),
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const time = p.time;
      const top = tod(hex(p.skyTop), time);
      const low = tod(hex(p.skyLow), time, 0.7);
      const wall = tod(hex(p.buildings), time, 0.5);
      const ground = tod(hex(p.ground), time, 0.5);
      const lights = hex(p.lights);
      const lit = time === 'day' ? 0.15 : time === 'dusk' ? 0.55 : 0.75;
      const r = rng(seed);
      const n = makeNoise(seed);
      const u = g.u;
      const hy = Math.round(g.h * 0.5);
      const gy = Math.round(g.h * 0.6);
      sky(g, top, low, 0, hy + 2, 7);
      if (time === 'night') stars(g, seed, 0.6, Math.round(g.h * 0.35));
      // Far ground between the horizon and the plaza.
      for (let y = hy; y < gy; y++) for (let x = 0; x < g.w; x++) g.set(x, y, ramp([mix(ground, low, 0.35), mix(ground, low, 0.15)], (y - hy) / (gy - hy), x, y));
      // Far ridge.
      for (let x = 0; x < g.w; x++) {
        const ry = Math.round(hy - (fbm(n, x * 0.012 / u, 0.3, 3) * 14 + 2) * u);
        for (let y = ry; y < hy; y++) g.set(x, y, mix(mix(top, low, 0.6), BLACK, 0.25 + (y - ry) / (hy - ry + 3) * 0.1));
      }
      // The atmosphere processor: on the detail side, or in the middle for a centred layout.
      const px = Math.round(p.focus === 'left' ? g.w * 0.3 : p.focus === 'center' ? g.w * 0.5 : g.w * 0.7);
      const far = mix(mix(wall, BLACK, 0.55), low, 0.25);
      const farLit = mix(far, low, 0.35);
      const tH = Math.round(hy * 0.6);
      const ty = hy - tH;
      const baseW = Math.round(40 * u);
      // Plume first, so the tower stands in front of it: steam rising from the stack and bending downwind.
      const plume = num(p.plume, 0.6);
      if (plume > 0) {
        // A chain of puffs, growing as they rise and drift downwind; each lit from the low sun and dithered at the rim.
        const steam = mix(low, WHITE, 0.4);
        const mid = mix(mix(low, top, 0.4), WHITE, 0.15);
        const shade = mix(top, low, 0.3);
        const count = Math.round(4 + plume * 8);
        for (let k = count - 1; k >= 0; k--) {
          const t = k / count;
          const bx = px + t * 75 * u + (hash(k, 11, seed) - 0.5) * 6 * u;
          const by = ty - 7 * u - Math.sqrt(t) * (ty - 12 * u) * 0.75;
          const rad = (4 + t * 9) * u * (0.8 + hash(k, 12, seed) * 0.4);
          for (let y = Math.floor(by - rad); y < by + rad; y++) {
            for (let x = Math.floor(bx - rad); x < bx + rad; x++) {
              const dx = (x - bx) / rad;
              const dy = (y - by) / rad;
              const d = dx * dx + dy * dy + (n(x * 0.15 / u, y * 0.15 / u) - 0.5) * 0.5;
              if (d > 1) continue;
              const a = plume * (1 - t * 0.5);
              if (d > 0.75 && bayer(x, y) > a * 0.8) continue;
              const lightK = -dx * 0.5 - dy * 0.8;
              g.set(x, y, lightK > 0.3 ? steam : lightK > -0.25 ? mid : shade);
            }
          }
        }
      }
      // Base block with two cooling stacks, the main tower in ribbed sections, and a wide cap.
      g.rect(px - baseW / 2, hy - 12 * u, baseW, 12 * u + 2, far);
      g.rect(px - baseW / 2, hy - 12 * u, baseW, 1, farLit);
      for (let k = 0; k < baseW; k += Math.round(5 * u)) g.rect(px - baseW / 2 + k, hy - 12 * u, 1, 12 * u, mix(far, BLACK, 0.2));
      for (const sx of [-1, 1]) {
        const stx = Math.round(px + sx * 14 * u);
        const sh = Math.round(tH * 0.5);
        g.rect(stx - 3 * u, hy - sh, 6 * u, sh, far);
        g.rect(stx - 3 * u, hy - sh, 1, sh, farLit);
        g.rect(stx - 4 * u, hy - sh, 8 * u, 2 * u, farLit);
        g.set(stx, hy - sh - 1, [255, 70, 60]);
      }
      for (let y = ty; y < hy - 10 * u; y++) {
        const t = (y - ty) / tH;
        const half = Math.round((5 + t * t * 7) * u);
        const ring = (y - ty) % Math.round(8 * u) < Math.max(1, Math.round(u));
        g.rect(px - half, y, half * 2, 1, ring ? farLit : far);
        g.set(px - half, y, farLit);
        g.set(px + half - 1, y, mix(far, BLACK, 0.3));
      }
      const cap = Math.round(10 * u);
      g.rect(px - cap, ty - 3 * u, cap * 2, 3 * u, far);
      g.rect(px - cap, ty - 3 * u, cap * 2, 1, farLit);
      g.rect(px - 4 * u, ty - 6 * u, 8 * u, 3 * u, far);
      for (let k = 0; k < 18; k++) {
        const ly = Math.round(hy - 10 * u - (tH - 10 * u) * hash(k, 3, seed) * 0.95);
        const t = (ly - ty) / tH;
        const lx = Math.round(px + (hash(k, 5, seed) - 0.5) * (8 + t * 10) * u);
        g.set(lx, ly, mix(lights, far, 0.2));
      }
      g.set(px, ty - 6 * u - 1, [255, 70, 60]);
      g.glow(px, ty - 6 * u - 1, 2.5 * u, 2.5 * u, [255, 70, 60], 0.35);
      // Haze along the horizon.
      for (let y = hy - 8 * u; y < gy; y++) for (let x = 0; x < g.w; x++) g.dot(x, y, low, 0.1 * (1 - Math.abs(y - hy) / (8 * u)));
      // Back row of modules on the horizon, then the near row on the plaza's edge.
      const rows = [[hy + 1, 0.45, 0.5, false], [gy, 1, 0, true]];
      for (const [base, scale, fade, near] of rows) {
        let x = -Math.floor(r() * 10 * u);
        while (x < g.w) {
          const bw = Math.round((18 + r() * 22) * u * scale);
          const wgt = weight(p.focus, x + bw / 2, g.w);
          const gapNear = near && (p.focus === 'center' ? Math.abs(x + bw / 2 - g.w / 2) < g.w * 0.2 : wgt < 0.35);
          const hidesTower = !near && Math.abs(x + bw / 2 - px) < baseW * 0.5 + bw * 0.5 + 4 * u;
          if (!gapNear && !hidesTower && (near || wgt > 0.15)) {
            const bh = Math.round((10 + r() * 14 + wgt * 8) * u * scale);
            prefab(g, x, base, bw, bh, mix(wall, low, fade), lights, lit * (near ? 1 : 0.7), r, seed + base, near);
          }
          x += bw + Math.round((near ? 2 + r() * 8 : 1 + r() * 4) * u);
        }
      }
      // The plaza: ground plates in perspective, ruts, puddles holding the sky.
      const vx = g.w / 2;
      for (let y = gy; y < g.h; y++) {
        const t = (y - gy) / (g.h - gy);
        for (let x = 0; x < g.w; x++) {
          const v = 0.35 + t * 0.4 + (fbm(n, x * 0.05 / u, y * 0.12 / u, 3) - 0.5) * 0.5;
          g.set(x, y, ramp([mix(ground, BLACK, 0.3), ground, mix(ground, WHITE, 0.1)], v, x, y));
        }
      }
      g.rect(0, gy, g.w, 1, mix(ground, BLACK, 0.45));
      for (let k = 1; k < 7; k++) {
        const y = Math.round(gy + (g.h - gy) * Math.pow(k / 7, 1.6));
        g.rect(0, y, g.w, 1, mix(ground, BLACK, 0.22));
      }
      for (let k = -9; k <= 9; k++) g.line(vx + k * 14 * u, gy, vx + k * 44 * u, g.h - 1, mix(ground, BLACK, 0.22));
      // Two ruts curving across the plaza.
      for (const off of [-8, 8]) {
        for (let y = gy + 2; y < g.h; y++) {
          const t = (y - gy) / (g.h - gy);
          const x = Math.round(vx * 0.6 + off * u * (0.4 + t) + Math.sin(t * 2.2) * 30 * u);
          g.rect(x, y, Math.max(1, Math.round((1 + t * 2) * u)), 1, mix(ground, BLACK, 0.2));
        }
      }
      for (let k = 0; k < 4; k++) {
        const cx = g.w * (0.12 + hash(k, 1, seed) * 0.76);
        const cy = gy + (g.h - gy) * (0.25 + hash(k, 2, seed) * 0.65);
        const rx = (5 + hash(k, 3, seed) * 7) * u;
        for (let y = Math.floor(cy - rx * 0.2); y < cy + rx * 0.2; y++) {
          for (let x = Math.floor(cx - rx); x < cx + rx; x++) {
            const d = ((x - cx) / rx) ** 2 + ((y - cy) / (rx * 0.2)) ** 2;
            if (d < 1) g.set(x, y, d > 0.7 ? mix(ground, BLACK, 0.2) : Math.round(y) === Math.round(cy) && d < 0.3 ? mix(low, WHITE, 0.3) : mix(top, ground, 0.35));
          }
        }
      }
      // Lamp posts with their light.
      const lampXs = p.focus === 'center' ? [0.3, 0.7] : p.focus === 'left' ? [0.12, 0.42] : [0.58, 0.88];
      for (const f of lampXs) {
        const lx = Math.round(g.w * f);
        const by = Math.round(g.h * 0.8);
        const lh = Math.round(g.h * 0.42);
        const post = mix(wall, BLACK, 0.55);
        g.rect(lx, by - lh, Math.max(1, Math.round(u)), lh, post);
        g.rect(lx - 1, by - 2 * u, Math.round(u) + 2, 2 * u, post);
        const dir = lx < g.w / 2 ? 1 : -1;
        const hx = lx + dir * 5 * u;
        g.line(lx, by - lh, hx, by - lh, post);
        g.rect(hx - 2 * u, by - lh, 4 * u, Math.max(1, Math.round(u)), post);
        g.rect(hx - 1.5 * u, by - lh + Math.round(u), 3 * u, 1, mix(lights, WHITE, 0.6));
        if (time !== 'day') {
          for (let y = by - lh + 2; y < by; y++) {
            const t = (y - (by - lh)) / lh;
            const half = (2 + t * 14) * u;
            for (let x = Math.floor(hx - half); x < hx + half; x++) {
              const a = (1 - Math.abs(x - hx) / half) * 0.22 * (1 - t * 0.5);
              if (a > bayer(x, y) * 0.5) g.blend(x, y, lights, 0.14);
            }
          }
          g.glow(hx, by + 2 * u, 22 * u, 5 * u, lights, 0.35);
          g.glow(hx, by - lh + u, 5 * u, 4 * u, lights, 0.6);
        }
      }
      // Dust in the air.
      for (let k = 0; k < g.w * g.h * 0.002; k++) {
        const x = Math.floor(hash(k, 7, seed) * g.w);
        const y = Math.floor(hash(k, 8, seed) * g.h);
        g.blend(x, y, mix(low, WHITE, 0.4), clamp(0.25 + hash(k, 9, seed) * 0.4));
      }
      g.vignette(BLACK, 0.35);
    });
  },
};
