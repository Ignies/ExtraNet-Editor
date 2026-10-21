// A loud TV-commercial backdrop: a sunburst, a tilted checkerboard, a spotlight or a starburst behind a round
// podium for the product, with sparkles and zigzag trim. Unlike the other stages it fills the whole frame: the
// podium in the lower middle is the stage.
import { PIXEL, paint, hex, mix, ramp, num, hash, bayer, clamp, BLACK, WHITE } from '../_kit.js';
import { GROUP } from './_stage.js';

/** A four-pointed sparkle. */
function sparkle(g, x, y, s, c) {
  x = Math.round(x);
  y = Math.round(y);
  g.rect(x - s, y, s * 2 + 1, 1, c);
  g.rect(x, y - s, 1, s * 2 + 1, c);
  if (s > 2) {
    g.set(x - 1, y - 1, c);
    g.set(x + 1, y - 1, c);
    g.set(x - 1, y + 1, c);
    g.set(x + 1, y + 1, c);
  }
  g.set(x, y, WHITE);
}

export default {
  id: 'stage-commercial',
  name: 'TV commercial',
  group: GROUP,
  tags: ['stage', '80s', 'retro', 'advert', 'tv'],
  params: [
    {
      key: 'style', label: 'Backdrop', type: 'select', default: 'sunburst',
      options: [['sunburst', 'Sunburst'], ['checker', 'Checkerboard'], ['spotlight', 'Spotlight'], ['starburst', 'Starburst']],
    },
    { key: 'a', label: 'Colour A', type: 'color', default: '#FFD02A' },
    { key: 'b', label: 'Colour B', type: 'color', default: '#FF5A1E' },
    { key: 'floor', label: 'Floor and podium', type: 'color', default: '#3A1060' },
    { key: 'rays', label: 'Rays', type: 'range', min: 8, max: 32, step: 2, default: 18 },
    { key: 'podium', label: 'Podium', type: 'select', default: 'yes', options: [['yes', 'Podium'], ['no', 'None']] },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const A = hex(p.a);
      const B = hex(p.b);
      const F = hex(p.floor);
      const u = g.u;
      const W = g.w;
      const H = g.h;
      const cx = W / 2;
      const fy = Math.round(H * 0.8);
      const rays = Math.round(num(p.rays, 18));
      const ocy = H * 0.6;
      // The backdrop.
      for (let y = 0; y < fy; y++) {
        for (let x = 0; x < W; x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - ocy;
          const ang = Math.atan2(dy, dx);
          const dist = Math.hypot(dx / W, dy / H);
          let c;
          if (p.style === 'checker') {
            // A tilted checkerboard, larger towards the edges, like a lens pushing in.
            const k = 1 + dist * 0.8;
            const rx = (dx * 0.96 - dy * 0.28) / (14 * u * k);
            const ry = (dx * 0.28 + dy * 0.96) / (14 * u * k);
            c = (Math.floor(rx) + Math.floor(ry)) & 1 ? A : B;
            c = mix(c, BLACK, clamp(dist * 0.5 - 0.05));
          } else if (p.style === 'spotlight') {
            // A dark backdrop in A with a cone of light in B falling on the podium.
            const cone = Math.abs(dx) < (y / fy) * W * 0.22 + 6 * u;
            const v = 0.25 + (1 - y / fy) * 0.15 + (cone ? 0.35 + (1 - Math.abs(dx) / ((y / fy) * W * 0.22 + 6 * u)) * 0.35 : 0);
            c = ramp([mix(A, BLACK, 0.75), mix(A, BLACK, 0.45), A, mix(A, B, 0.5), mix(B, WHITE, 0.3)], v, x, y);
            // Vertical drape folds.
            if (!cone && (x % Math.round(10 * u)) < 2 * u) c = mix(c, BLACK, 0.25);
          } else if (p.style === 'starburst') {
            // Concentric jagged rings out from the centre.
            const jag = Math.abs(((ang / (Math.PI * 2)) * rays * 2) % 2 - 1);
            const ring = Math.floor(dist * 9 - jag * 0.8);
            c = [B, A, mix(A, B, 0.5), mix(A, BLACK, 0.35)][((ring % 4) + 4) % 4];
            if (dist < 0.06 + jag * 0.03) c = mix(B, WHITE, 0.5);
          } else {
            // Sunburst: alternating rays, a hot centre.
            const ray = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * rays) & 1;
            c = ray ? A : B;
            c = ramp([mix(c, WHITE, 0.45), c, c, mix(c, BLACK, 0.3)], dist * 1.6, x, y);
          }
          g.set(x, y, c);
        }
      }
      if (p.style === 'sunburst') g.glow(cx, ocy, W * 0.28, H * 0.42, WHITE, 0.55);
      // Sparkles scattered round the frame, kept off the middle.
      const sparkC = p.style === 'starburst' ? WHITE : mix(p.style === 'checker' ? WHITE : B, WHITE, 0.5);
      for (let k = 0; k < 14; k++) {
        const x = hash(k, 1, seed) * W;
        const y = hash(k, 2, seed) * fy * 0.9;
        if (Math.abs(x - cx) < W * 0.2 && y > H * 0.25) continue;
        sparkle(g, x, y, Math.round((1 + hash(k, 3, seed) * 2.5) * u), sparkC);
      }
      // Zigzag trim along the top.
      const zz = Math.round(5 * u);
      for (let x = 0; x < W; x++) {
        const t = Math.abs((x % (zz * 2)) - zz);
        for (let y = 0; y < Math.round(3 * u) + t * 0.6; y++) g.set(x, y, y < 2 * u ? F : mix(F, WHITE, 0.25));
      }
      // The floor: a glossy band with a reflection of the backdrop.
      for (let y = fy; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const t = (y - fy) / (H - fy);
          const refl = g.get(x, fy - 1 - (y - fy) * 2);
          g.set(x, y, t < 0.5 && bayer(x, y) > 0.55 + t ? mix(refl, F, 0.6) : ramp([mix(F, WHITE, 0.15), F, mix(F, BLACK, 0.35)], t * 1.4, x, y));
        }
      }
      g.rect(0, fy, W, 1, mix(F, WHITE, 0.5));
      // The podium: a short drum with a lit top and a band.
      if (p.podium !== 'no') {
        const rx = Math.round(W * 0.15);
        const ry = Math.max(2, Math.round(4.5 * u));
        const top = Math.round(fy - 7 * u);
        const bottom = Math.round(fy + 9 * u);
        const body = mix(F, WHITE, 0.2);
        for (let y = top; y < bottom; y++) {
          for (let x = Math.floor(cx - rx); x < cx + rx; x++) {
            const nx = (x + 0.5 - cx) / rx;
            const edgeY = ry * Math.sqrt(Math.max(0, 1 - nx * nx));
            if (y > bottom - ry + edgeY) continue;
            g.set(x, y, ramp([mix(body, WHITE, 0.25), body, mix(body, BLACK, 0.35), mix(body, BLACK, 0.6)], (nx + 1) * 0.5 + 0.1, x, y));
          }
        }
        const band = Math.round(top + (bottom - top) * 0.45);
        for (let x = Math.floor(cx - rx); x < cx + rx; x++) {
          const nx = (x + 0.5 - cx) / rx;
          const e = ry * Math.sqrt(Math.max(0, 1 - nx * nx));
          g.rect(x, band + e, 1, Math.max(1, Math.round(2 * u)), B);
        }
        for (let y = top - ry; y <= top + ry; y++) {
          for (let x = Math.floor(cx - rx); x < cx + rx; x++) {
            const nx = (x + 0.5 - cx) / rx;
            const ny = (y + 0.5 - top) / ry;
            const d = nx * nx + ny * ny;
            if (d <= 1) g.set(x, y, d > 0.75 ? mix(body, WHITE, 0.55) : ramp([mix(body, WHITE, 0.4), mix(body, WHITE, 0.15)], (ny + 1) / 2, x, y));
          }
        }
        g.glow(cx, top, rx * 1.2, ry * 3, WHITE, 0.25);
      }
      g.vignette(BLACK, 0.3);
    });
  },
};
