// Hive resin: dark organic ridges and ribs, wet highlights on the upper edges, deep cavities and strands hanging
// from the top. The hive's walls, for cult and horror sites.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, fbm, num, clamp, BLACK } from './_kit.js';

export default {
  id: 'hive-resin',
  name: 'Hive resin',
  tags: ['horror', 'cult', 'deep'],
  params: [
    { key: 'dark', label: 'Shadow', type: 'color', default: '#060509' },
    { key: 'resin', label: 'Resin', type: 'color', default: '#2B2338' },
    { key: 'shine', label: 'Wet shine', type: 'color', default: '#7A6E9E' },
    { key: 'glow', label: 'Glow', type: 'color', default: '#3F6E3A' },
    { key: 'ribs', label: 'Ribs', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6 },
    { key: 'wet', label: 'Wetness', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
    { key: 'glowAmount', label: 'Glow amount', type: 'range', min: 0, max: 1, step: 0.05, default: 0.2 },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const dk = hex(p.dark);
      const resin = hex(p.resin);
      const shine = hex(p.shine);
      const glow = hex(p.glow);
      const ribs = num(p.ribs, 0.6);
      const wet = num(p.wet, 0.5);
      const r = rng(seed);
      const n = makeNoise(seed);
      const m = makeNoise(seed + 5);
      const tones = [dk, mix(dk, resin, 0.4), mix(dk, resin, 0.75), resin, mix(resin, shine, 0.35)];
      const sc = 3.2 / g.h;
      const W = g.w;
      const H = g.h;
      const field = new Float32Array(W * H);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const wx = x * sc + fbm(m, x * sc, y * sc, 2) * 1.5;
          const wy = y * sc;
          // Ridged noise for sinew, plus near-vertical ribs.
          const ridge = 1 - Math.abs(fbm(n, wx, wy * 1.4, 4) * 2 - 1);
          const rib = Math.pow(Math.abs(Math.sin(wx * 3.2 + n(wx * 0.5, wy * 0.5) * 3)), 6) * ribs;
          field[y * W + x] = clamp(Math.pow(ridge, 2.2) * 0.85 + rib * 0.45);
        }
      }
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const v = field[y * W + x];
          // Light from above-left: surfaces facing it are lit, the far side falls into shadow.
          const back = y < H - 1 && x < W - 1 ? field[(y + 1) * W + x + 1] : v;
          const lit = (v - back) * 6;
          let c = ramp(tones, clamp(v * 0.75 + lit * 0.35), x, y);
          if (lit > 0.5 * (1.3 - wet) && v > 0.4) c = lit > 0.9 * (1.3 - wet) ? shine : mix(c, shine, 0.5);
          if (v < 0.2) c = dk;
          g.set(x, y, c);
        }
      }
      // Strands hanging from the top.
      // Drips hanging from the top: thick at the root, thinning, with a bead at the end.
      for (let i = 0, c = Math.round(W / H * 1.5); i < c; i++) {
        const x = r() * W;
        const len = (0.15 + r() * 0.35) * H;
        for (let y = 0; y < len; y++) {
          const w = Math.max(1, (1 - y / len) * 3 * g.u);
          g.rect(x - w / 2, y, w, 1, mix(dk, resin, 0.6));
          g.set(x - w / 2, y, mix(resin, shine, 0.55));
        }
        g.disc(x, len, 1.2 * g.u, mix(dk, resin, 0.6));
        g.set(x - 1, len - 1, shine);
      }
      // Faint bioluminescent pockets.
      const ga = num(p.glowAmount, 0.2);
      for (let i = 0, c = Math.round(ga * 6); i < c; i++) g.glow(r() * W, r() * H, (10 + r() * 20) * g.u, (6 + r() * 10) * g.u, glow, 0.45);
      g.vignette(BLACK, 0.7);
    });
  },
};
