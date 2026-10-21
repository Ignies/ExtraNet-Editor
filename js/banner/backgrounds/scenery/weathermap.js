// A weather presenter's map: a stylised stretch of planet surface in flat elevation bands with contour lines, dark
// coastlines and a pale shelf in the sea, a dotted grid with reference letters, settlement dots with names and a
// north arrow. The land gathers on the detail side; the other side is open sea, where the presenter stands.
import { PIXEL, paint, hex, mix, rng, makeNoise, fbm, num, bayer, clamp, BLACK, WHITE } from '../_kit.js';
import { GROUP, FOCUS, weight, titleShade } from './_scene.js';
import { textWidth } from './_broadcast.js';

const PLACES = ['HADLEY', 'OUTPOST 9', 'PORT REY', 'DEPOT 2', 'NEW ACRE', 'BRIGGS', 'MESA 4', 'KELLER'];

export default {
  id: 'scene-weather-map',
  name: 'Weather map',
  group: GROUP,
  tags: ['scenery', 'map', 'news', 'tv', 'weather'],
  params: [
    { key: 'sea', label: 'Sea', type: 'color', default: '#173E62' },
    { key: 'land', label: 'Lowland', type: 'color', default: '#5E8A46' },
    { key: 'high', label: 'Highland', type: 'color', default: '#B49A5E' },
    { key: 'peak', label: 'Peaks', type: 'color', default: '#D8D2C2' },
    { key: 'gridC', label: 'Grid and labels', type: 'color', default: '#E8F0FF' },
    { key: 'landAmount', label: 'Land', type: 'range', min: 0, max: 1, step: 0.05, default: 0.55 },
    { key: 'places', label: 'Settlements', type: 'range', min: 0, max: 8, step: 1, default: 5 },
    { key: 'zoom', label: 'Zoom', type: 'range', min: 0.5, max: 2, step: 0.05, default: 1 },
    FOCUS,
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const sea = hex(p.sea);
      const land = hex(p.land);
      const high = hex(p.high);
      const peak = hex(p.peak);
      const gc = hex(p.gridC);
      const r = rng(seed);
      const n = makeNoise(seed);
      const u = g.u;
      const sc = 0.026 / (u * num(p.zoom, 1));
      const amount = num(p.landAmount, 0.55);
      // Elevation: noise, raised on the detail side and lowered on the presenter's side.
      const W = g.w;
      const H = g.h;
      const elev = new Float32Array(W * H);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const wgt = weight(p.focus, x, W);
          const edge = Math.min(y, H - 1 - y) / H;
          elev[y * W + x] = fbm(n, x * sc + 5, y * sc * 1.1 + 2, 4) + (wgt - 0.5) * 0.3 - (edge < 0.04 ? 0.05 : 0);
        }
      }
      // Sea level and the contour heights from the spread of heights, so Land sets how much of the map is land.
      const sorted = Float32Array.from(elev).sort();
      const q = f => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(f * sorted.length)))];
      const landFrac = 0.15 + amount * 0.55;
      const SEA = q(1 - landFrac);
      const bands = [SEA, q(1 - landFrac * 0.5), q(1 - landFrac * 0.16)];
      const band = e => (e < SEA ? -1 : e < bands[1] ? 0 : e < bands[2] ? 1 : 2);
      const at = (x, y) => elev[clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1)];
      const seaTones = [mix(sea, BLACK, 0.3), sea, mix(sea, WHITE, 0.12)];
      const landTones = [land, high, peak];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const e = at(x, y);
          const b = band(e);
          let c;
          if (b < 0) {
            // Sea: deeper further out, in two dithered steps, and a pale shelf along the coast.
            const depth = (SEA - e) / 0.16;
            c = depth < 0.18 ? seaTones[2] : depth > 0.7 + (bayer(x, y) - 0.5) * 0.3 ? seaTones[0] : seaTones[1];
            const near = band(at(x + 1, y)) >= 0 || band(at(x - 1, y)) >= 0 || band(at(x, y + 1)) >= 0 || band(at(x, y - 1)) >= 0;
            if (near) c = mix(sea, WHITE, 0.45);
          } else {
            c = landTones[b];
            // Shading from the north-west within a band, kept to two flat tones.
            const slope = at(x - 1, y - 1) - at(x + 1, y + 1);
            if (slope < -0.02) c = mix(c, BLACK, 0.14);
            else if (slope > 0.024) c = mix(c, WHITE, 0.1);
            // Coastline and contour lines where the band changes.
            const lower = Math.min(band(at(x + 1, y)), band(at(x - 1, y)), band(at(x, y + 1)), band(at(x, y - 1)));
            if (lower < 0) c = mix(land, BLACK, 0.65);
            else if (lower < b) c = mix(landTones[b], BLACK, 0.35);
          }
          g.set(x, y, c);
        }
      }
      // The grid: dotted lines with letters along the top and numbers down the detail side's edge.
      const step = Math.round(24 * u);
      const ox = Math.round((W % step) / 2);
      const oy = Math.round((H % step) / 2);
      for (let x = ox; x < W; x += step) for (let y = 0; y < H; y += 2) g.blend(x, y, gc, 0.35);
      for (let y = oy; y < H; y += step) for (let x = 0; x < W; x += 2) g.blend(x, y, gc, 0.35);
      const s = 1;
      for (let i = 0, x = ox; x + step <= W; i++, x += step) g.text(x + step / 2 - 1, 2, String.fromCharCode(65 + i), gc, s, 0.85);
      const numX = p.focus === 'left' ? 2 : W - 6;
      for (let i = 1, y = oy; y + step <= H; i++, y += step) g.text(numX, y + step / 2 - 2, String(i), gc, s, 0.85);
      // Settlements: dots on land away from the edges and each other, with names.
      const want = Math.round(num(p.places, 5));
      const placed = [];
      const names = PLACES.slice();
      for (let i = names.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [names[i], names[j]] = [names[j], names[i]];
      }
      for (let tries = 0; tries < 400 && placed.length < want; tries++) {
        const x = Math.round(W * (0.08 + r() * 0.84));
        const y = Math.round(H * (0.14 + r() * 0.72));
        if (band(at(x, y)) < 0 || band(at(x, y)) > 1 || weight(p.focus, x, W) < 0.5) continue;
        const name = names[placed.length % names.length];
        const tw = textWidth(name, 1);
        const ds = Math.max(2, Math.round(1.5 * u));
        // The name goes right of the dot, or left of it near the right edge.
        const lx = x + ds + 3 + tw > W - 8 ? x - 3 - tw : x + ds + 3;
        if (lx < 4 || y - 2 < 8 || y + 6 > H - 3) continue;
        // Keep clear of the north arrow in the bottom corner.
        if (y > H - 22 * u && (p.focus === 'left' ? Math.min(x, lx) < 24 * u : Math.max(x + ds, lx + tw) > W - 22 * u)) continue;
        const box = [Math.min(x, lx) - 4 * u, Math.max(x + ds, lx + tw) + 4 * u, y - 6 * u, y + 8 * u];
        if (placed.some(b => b[0] < box[1] && box[0] < b[1] && b[2] < box[3] && box[2] < b[3])) continue;
        placed.push(box);
        g.rect(x - 1, y - 1, ds + 2, ds + 2, [16, 18, 24]);
        g.rect(x, y, ds, ds, WHITE);
        g.rect(lx - 1, y - 2, tw + 2, 7, mix(BLACK, sea, 0.3), 0.55);
        g.text(lx, y - 1, name, WHITE);
      }
      // North arrow in the corner on the detail side.
      const nx = p.focus === 'left' ? Math.round(10 * u) : Math.round(W - 14 * u);
      const ny = Math.round(H - 16 * u);
      const ah = Math.round(7 * u);
      for (let k = 0; k <= ah; k++) {
        const half = Math.round(k * 0.45);
        g.rect(nx - half, ny + k, half, 1, gc);
        g.rect(nx, ny + k, half + 1, 1, mix(gc, BLACK, 0.45));
      }
      g.text(nx - 1, ny - 7, 'N', gc);
      titleShade(g, p.focus, mix(sea, BLACK, 0.5), 0.3);
      // A thin bezel, like a studio graphic.
      g.rect(0, 0, W, 1, mix(gc, BLACK, 0.5));
      g.rect(0, H - 1, W, 1, mix(gc, BLACK, 0.5));
      g.rect(0, 0, 1, H, mix(gc, BLACK, 0.5));
      g.rect(W - 1, 0, 1, H, mix(gc, BLACK, 0.5));
    });
  },
};
