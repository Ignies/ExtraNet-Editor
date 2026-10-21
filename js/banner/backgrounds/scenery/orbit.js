// A weather satellite's view: a big planet on the detail side with seas, continents, cloud bands and a spiral storm,
// lit from the open side, stars behind, and a thin camera overlay (corner brackets, a channel tag and a time stamp).
import { PIXEL, paint, hex, mix, num, hash, BLACK, WHITE } from '../_kit.js';
import { GROUP, FOCUS, sky } from './_scene.js';
import { planet } from './_broadcast.js';

export default {
  id: 'scene-orbit',
  name: 'Satellite view',
  group: GROUP,
  tags: ['scenery', 'space', 'weather', 'tv'],
  params: [
    { key: 'space', label: 'Space', type: 'color', default: '#04060E' },
    { key: 'sea', label: 'Sea', type: 'color', default: '#1E4E86' },
    { key: 'land', label: 'Land', type: 'color', default: '#7A7A48' },
    { key: 'high', label: 'Highland', type: 'color', default: '#B49870' },
    { key: 'cloud', label: 'Cloud', type: 'color', default: '#F0F2F6' },
    { key: 'rim', label: 'Atmosphere', type: 'color', default: '#7AC8FF' },
    { key: 'hud', label: 'Overlay', type: 'color', default: '#9CFFB0' },
    { key: 'clouds', label: 'Cloud cover', type: 'range', min: 0, max: 1, step: 0.05, default: 0.45 },
    { key: 'size', label: 'Planet size', type: 'range', min: 0.3, max: 1, step: 0.01, default: 0.66 },
    { key: 'storm', label: 'Storm', type: 'select', default: 'yes', options: [['yes', 'Spiral storm'], ['no', 'None']] },
    FOCUS,
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const space = hex(p.space);
      const hud = hex(p.hud);
      const u = g.u;
      sky(g, space, mix(space, hex(p.rim), 0.12), 0, g.h, 4);
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          const h = hash(x, y, seed + 3);
          if (h < 0.006) g.set(x, y, mix(space, WHITE, 0.35 + hash(y, x, seed) * 0.65));
        }
      }
      const R = Math.round(g.h * num(p.size, 0.66));
      const side = p.focus === 'left' ? -1 : 1;
      const cx = p.focus === 'center' ? g.w / 2 : g.w / 2 + side * g.w * 0.3;
      const cy = p.focus === 'center' ? g.h + R * 0.35 : g.h * 0.62;
      planet(g, cx, cy, R, seed, {
        sea: hex(p.sea), land: hex(p.land), high: hex(p.high), cloud: hex(p.cloud), rim: hex(p.rim),
        landLevel: 0.56, clouds: num(p.clouds, 0.45), spin: 1.3, light: [-0.55 * side, -0.45],
        storm: p.storm === 'yes' ? [1.3 - side * 0.25, -0.3] : null,
      });
      // Camera overlay: corner brackets, a channel tag, a time stamp and a scale bar.
      const m = Math.round(4 * u);
      const L = Math.round(8 * u);
      for (const [x, y, dx, dy] of [[m, m, 1, 1], [g.w - 1 - m, m, -1, 1], [m, g.h - 1 - m, 1, -1], [g.w - 1 - m, g.h - 1 - m, -1, -1]]) {
        g.rect(dx > 0 ? x : x - L + 1, y, L, 1, hud, 0.8);
        g.rect(x, dy > 0 ? y : y - L + 1, 1, L, hud, 0.8);
      }
      const tx = m + 3;
      g.text(tx, m + 3, 'SAT-2  IR', hud, 1, 0.9);
      g.text(tx, m + 10, 'CH 4', hud, 1, 0.7);
      const stamp = `${String(Math.floor(hash(seed, 1) * 24)).padStart(2, '0')}00Z`;
      g.text(g.w - m - 3 - stamp.length * 4, g.h - m - 8, stamp, hud, 1, 0.9);
      const bx = m + 3;
      const by = g.h - m - 4;
      g.rect(bx, by, Math.round(20 * u), 1, hud, 0.8);
      g.rect(bx, by - 2, 1, 3, hud, 0.8);
      g.rect(bx + Math.round(20 * u) - 1, by - 2, 1, 3, hud, 0.8);
      g.text(bx, by - 8, '500 KM', hud, 1, 0.7);
      // A crosshair on the storm side of the planet.
      const chx = Math.round(cx - side * R * 0.25);
      const chy = Math.round(cy - R * 0.3);
      if (chx > 0 && chx < g.w && chy > 0) {
        g.rect(chx - 4 * u, chy, 3 * u, 1, hud, 0.7);
        g.rect(chx + u + 1, chy, 3 * u, 1, hud, 0.7);
        g.rect(chx, chy - 4 * u, 1, 3 * u, hud, 0.7);
        g.rect(chx, chy + u + 1, 1, 3 * u, hud, 0.7);
      }
      g.vignette(BLACK, 0.3);
    });
  },
};
