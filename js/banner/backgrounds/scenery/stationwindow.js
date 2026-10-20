// A space station corridor: panelled wall with a strip light, and a big bevelled window onto a planet and stars
// on the detail side.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, fbm, hash, num, clamp, WHITE, BLACK } from '../_kit.js';
import { GROUP, FOCUS, timeParam, stars } from './_scene.js';

export default {
  id: 'scene-station-window',
  name: 'Station window',
  group: GROUP,
  tags: ['scenery', 'space', 'interior'],
  params: [
    { key: 'wall', label: 'Wall', type: 'color', default: '#2A3038' },
    { key: 'trim', label: 'Trim light', type: 'color', default: '#6FC8FF' },
    { key: 'space', label: 'Space', type: 'color', default: '#04060E' },
    { key: 'planet', label: 'Planet', type: 'color', default: '#C8703C' },
    { key: 'window', label: 'Window width', type: 'range', min: 0.25, max: 0.6, step: 0.01, default: 0.42 },
    FOCUS,
    timeParam('night'),
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const wall = hex(p.wall);
      const trim = hex(p.trim);
      const space = hex(p.space);
      const planet = hex(p.planet);
      const r = rng(seed);
      const n = makeNoise(seed);
      const ww = Math.round(g.w * num(p.window, 0.42));
      const wx = p.focus === 'left' ? Math.round(g.h * 0.15) : p.focus === 'center' ? Math.round((g.w - ww) / 2) : g.w - ww - Math.round(g.h * 0.15);
      const wy = Math.round(g.h * 0.16);
      const wh = Math.round(g.h * 0.62);
      // Wall panels.
      const panelW = Math.round(30 * g.u);
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          const v = 0.55 + (fbm(n, x * 0.05, y * 0.05, 2) - 0.5) * 0.3 - y / g.h * 0.2;
          g.set(x, y, ramp([mix(wall, BLACK, 0.35), wall, mix(wall, WHITE, 0.1)], v, x, y));
        }
      }
      for (let x = (seed % panelW); x < g.w; x += panelW) {
        g.rect(x, 0, 1, g.h, mix(wall, BLACK, 0.55));
        g.rect(x + 1, 0, 1, g.h, mix(wall, WHITE, 0.12));
      }
      g.rect(0, Math.round(g.h * 0.86), g.w, 1, mix(wall, BLACK, 0.55));
      g.rect(0, Math.round(g.h * 0.86) + 1, g.w, g.h, mix(wall, BLACK, 0.25));
      // A strip light along the top.
      g.rect(0, 2, g.w, 2, mix(trim, WHITE, 0.4));
      for (let y = 4; y < 12 * g.u; y++) for (let x = 0; x < g.w; x++) g.dot(x, y, trim, 0.25 * (1 - y / (12 * g.u)));
      // The window: a thick bevelled frame with rounded corners, and the view.
      const fr = Math.max(2, Math.round(3 * g.u));
      g.rect(wx - fr, wy - fr, ww + fr * 2, wh + fr * 2, mix(wall, BLACK, 0.5));
      g.rect(wx - fr, wy - fr, ww + fr * 2, 1, mix(wall, WHITE, 0.25));
      const px = wx + ww * (0.3 + r() * 0.4);
      const pr = wh * 0.9;
      const py = wy + wh + pr * 0.45;
      for (let y = wy; y < wy + wh; y++) {
        for (let x = wx; x < wx + ww; x++) {
          const cx = Math.min(x - wx, wx + ww - 1 - x);
          const cy = Math.min(y - wy, wy + wh - 1 - y);
          if (cx + cy < 3 * g.u) continue;
          let c = space;
          const dx = x - px;
          const dy = y - py;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < pr) {
            const band = fbm(n, x * 0.03 / g.u, y * 0.12 / g.u, 3);
            const shade = clamp((dx * -0.6 + dy * -0.8) / pr * 0.9 + 0.35);
            c = ramp([mix(planet, BLACK, 0.7), mix(planet, BLACK, 0.3), planet, mix(planet, WHITE, 0.35)], shade * 0.8 + (band - 0.5) * 0.5, x, y);
          } else if (d < pr + 2 * g.u) c = mix(space, trim, 0.35);
          else if (hash(x, y, seed) < 0.02) c = mix(space, WHITE, 0.4 + hash(y, x, seed) * 0.6);
          // Glare.
          if (((x - wx) + (y - wy)) % Math.round(30 * g.u) < 2 * g.u && (x - wx) < ww * 0.5) c = mix(c, WHITE, 0.12);
          g.set(x, y, c);
        }
      }
      void stars;
      g.rect(wx, wy + wh, ww, 1, trim);
      g.glow(wx + ww / 2, wy + wh + 2, ww * 0.6, 6 * g.u, trim, 0.3);
      g.vignette(BLACK, 0.4);
    });
  },
};
