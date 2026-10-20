// An ocean shore: sky and sun over the sea, rows of waves, a foam line and a beach, with rocks on the detail side.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, fbm, num, WHITE, BLACK } from '../_kit.js';
import { GROUP, FOCUS, timeParam, tod, weight, sky, stars, titleShade } from './_scene.js';

export default {
  id: 'scene-shore',
  name: 'Ocean shore',
  group: GROUP,
  tags: ['scenery', 'sea', 'leisure'],
  params: [
    { key: 'skyTop', label: 'Sky top', type: 'color', default: '#3B6FB0' },
    { key: 'skyLow', label: 'Sky low', type: 'color', default: '#F2C48A' },
    { key: 'sea', label: 'Sea', type: 'color', default: '#1F5C8A' },
    { key: 'sand', label: 'Beach', type: 'color', default: '#E2C48C' },
    { key: 'rocks', label: 'Rocks', type: 'color', default: '#4A4038' },
    { key: 'horizon', label: 'Horizon', type: 'range', min: 0.3, max: 0.7, step: 0.01, default: 0.5 },
    FOCUS,
    timeParam('dusk'),
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const time = p.time;
      const top = tod(hex(p.skyTop), time);
      const low = tod(hex(p.skyLow), time, 0.8);
      const sea = tod(hex(p.sea), time, 0.6);
      const sand = tod(hex(p.sand), time, 0.5);
      const rock = tod(hex(p.rocks), time, 0.4);
      const r = rng(seed);
      const n = makeNoise(seed);
      const hz = Math.round(g.h * num(p.horizon, 0.5));
      sky(g, top, low, 0, hz, 6);
      if (time === 'night') stars(g, seed, 1, hz);
      const sx = p.focus === 'left' ? g.w * 0.25 : p.focus === 'center' ? g.w * 0.5 : g.w * 0.72;
      g.glow(sx, hz, g.h * 0.6, g.h * 0.35, mix(low, WHITE, 0.3), 0.45);
      g.disc(sx, hz - g.h * 0.05, g.h * 0.12, mix(low, WHITE, 0.6));
      // Sea: darker far away; wave crests as short light dashes.
      const seaTones = [mix(sea, low, 0.35), sea, mix(sea, BLACK, 0.3)];
      for (let y = hz; y < g.h; y++) {
        const t = (y - hz) / (g.h - hz);
        for (let x = 0; x < g.w; x++) {
          let c = ramp(seaTones, 1 - t * 1.2, x, y);
          const wave = n(x * 0.12 / (0.3 + t), y * 0.9);
          if (wave > 0.72 - t * 0.08) c = mix(c, WHITE, 0.35);
          if (Math.abs(x - sx) < g.h * 0.15 * (1 - t * 0.5) && wave > 0.55) c = mix(low, WHITE, 0.3);
          g.set(x, y, c);
        }
      }
      // Beach curve and foam.
      const sandTones = [mix(sand, WHITE, 0.15), sand, mix(sand, BLACK, 0.2)];
      for (let x = 0; x < g.w; x++) {
        const wgt = weight(p.focus, x, g.w);
        const bh = g.h * (0.12 + 0.18 * wgt + (fbm(n, x * 0.02 / g.u, 3, 2) - 0.5) * 0.08);
        const y0 = Math.floor(g.h - bh);
        for (let y = y0; y < g.h; y++) g.set(x, y, ramp(sandTones, (y - y0) / bh + (n(x * 0.5, y * 0.5) - 0.5) * 0.6, x, y));
        g.set(x, y0 - 1, WHITE);
        if (n(x * 0.2, 7) > 0.5) g.set(x, y0 - 2, mix(sea, WHITE, 0.7));
      }
      // Rocks on the detail side.
      for (let i = 0; i < 5; i++) {
        const rx = p.focus === 'left' ? r() * g.w * 0.3 : p.focus === 'center' ? g.w * (0.35 + r() * 0.3) : g.w * (0.7 + r() * 0.3);
        const rw = (6 + r() * 12) * g.u;
        const rh = (4 + r() * 10) * g.u;
        const by = g.h - (4 + r() * 6) * g.u;
        for (let x = Math.floor(rx - rw); x < rx + rw; x++) {
          const t = (x - rx) / rw;
          const h = rh * Math.sqrt(Math.max(0, 1 - t * t)) * (0.8 + n(x * 0.3, i) * 0.4);
          for (let y = Math.floor(by - h); y < by; y++) g.set(x, y, ramp([mix(rock, low, 0.3), rock, mix(rock, BLACK, 0.4)], (t + 1) / 2 + (y - by + h) / (h + 1) * 0.3, x, y));
        }
      }
      titleShade(g, p.focus, mix(top, BLACK, 0.4), 0.2);
    });
  },
};
