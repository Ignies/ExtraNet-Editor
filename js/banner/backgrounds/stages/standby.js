// A "PLEASE STAND BY" card: a blue slide with a double rule round it, the words in big blocky letters, and a
// cartoon technician in a cap and overalls scratching his head beside a broken TV set (static, a crack, a spark)
// with his toolbox. Fills the whole frame.
import { PIXEL, paint, hex, mix, ramp, hash, BLACK, WHITE } from '../_kit.js';
import { GROUP } from './_stage.js';
import { textWidth } from '../scenery/_broadcast.js';

/**
 * Draws a cartoon from shapes with a dark outline: every shape is first drawn one pixel bigger in the outline
 * colour, then all of them are filled, so touching shapes share one outline.
 */
function cartoon(g, shapes, ink) {
  for (const sh of shapes) draw(g, sh, 1, ink);
  for (const sh of shapes) draw(g, sh, 0, sh.c);
}

function draw(g, sh, grow, c) {
  if (sh.disc) g.disc(sh.x, sh.y, sh.r + grow, c);
  else if (sh.line) {
    for (let ox = -grow; ox <= grow; ox++) {
      for (let oy = -grow; oy <= grow; oy++) {
        for (let k = 0; k < sh.w; k++) g.line(sh.x0 + ox + k, sh.y0 + oy, sh.x1 + ox + k, sh.y1 + oy, c);
      }
    }
  } else g.rect(sh.x - grow, sh.y - grow, sh.w + grow * 2, sh.h + grow * 2, c);
}

export default {
  id: 'stage-stand-by',
  name: 'Please stand by',
  group: GROUP,
  tags: ['tv', 'retro', 'signal', 'cartoon'],
  params: [
    { key: 'bg', label: 'Card', type: 'color', default: '#1E3C8A' },
    { key: 'text', label: 'Lettering', type: 'color', default: '#FFE04A' },
    { key: 'rule', label: 'Rule', type: 'color', default: '#F2F2F2' },
    { key: 'line2', label: 'Small print', type: 'select', default: 'TECHNICAL DIFFICULTIES', options: [['TECHNICAL DIFFICULTIES', 'Technical difficulties'], ['WE WILL RETURN SHORTLY', 'We will return shortly'], ['', 'None']] },
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const bg = hex(p.bg);
      const txt = hex(p.text);
      const rule = hex(p.rule);
      const W = g.w;
      const H = g.h;
      const u = g.u;
      const s = Math.max(1, Math.round(u));
      // The card: a radial gradient with soft diagonal bands.
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const d = Math.hypot((x - W * 0.62) / W, (y - H * 0.45) / H);
          const band = Math.floor((x + y) / (10 * s)) % 2 ? 0.06 : 0;
          g.set(x, y, ramp([mix(bg, WHITE, 0.18), bg, mix(bg, BLACK, 0.35), mix(bg, BLACK, 0.6)], d * 1.6 + band, x, y));
        }
      }
      // Double rule with cut corners.
      const m = 4 * s;
      for (const [inset, c] of [[m, rule], [m + 2 * s, mix(rule, bg, 0.5)]]) {
        const cut = 4 * s;
        g.rect(inset + cut, inset, W - 2 * (inset + cut), 1, c);
        g.rect(inset + cut, H - 1 - inset, W - 2 * (inset + cut), 1, c);
        g.rect(inset, inset + cut, 1, H - 2 * (inset + cut), c);
        g.rect(W - 1 - inset, inset + cut, 1, H - 2 * (inset + cut), c);
        g.line(inset, inset + cut, inset + cut, inset, c);
        g.line(W - 1 - inset - cut, inset, W - 1 - inset, inset + cut, c);
        g.line(inset, H - 1 - inset - cut, inset + cut, H - 1 - inset, c);
        g.line(W - 1 - inset - cut, H - 1 - inset, W - 1 - inset, H - 1 - inset - cut, c);
      }
      // The lettering across the top, with a drop shadow and a light top edge.
      const word = 'PLEASE STAND BY';
      const big = Math.max(1, Math.min(Math.floor((W - 2 * m - 8 * s) / textWidth(word, 1)), Math.floor((H * 0.16) / 5)));
      const tx = Math.round((W - textWidth(word, big)) / 2);
      let ty = Math.round(m + 5 * s);
      const drop = Math.max(1, Math.round(big / 3));
      g.text(tx + drop, ty + drop, word, mix(bg, BLACK, 0.6), big);
      g.text(tx, ty, word, txt, big);
      for (let x = tx; x < tx + textWidth(word, big); x++) {
        const c = g.get(x, ty);
        if (c[0] === txt[0] && c[1] === txt[1] && c[2] === txt[2]) g.set(x, ty, mix(txt, WHITE, 0.55));
      }
      ty += big * 5 + 3 * s;
      let printBottom = ty;
      if (p.line2) {
        const small = Math.max(1, Math.min(Math.round(s / 2), Math.floor((W - 2 * m) / textWidth(p.line2, 1))));
        g.text(Math.round((W - textWidth(p.line2, small)) / 2), ty, p.line2, rule, small);
        printBottom = ty + 5 * small;
      }
      // The scene below, centred: the floor line, the broken set, the technician and his toolbox.
      const fb = Math.round(H - m - 6 * s);
      const sx0 = Math.round((W - 65 * s) / 2);
      g.rect(sx0 - 6 * s, fb, 72 * s, 1, mix(bg, WHITE, 0.35));
      const ink = [16, 14, 24];
      // TV set.
      const tvW = 26 * s;
      const tvH = 20 * s;
      const tvX = Math.round(sx0 + 20 * s);
      const tvY = fb - tvH - 3 * s;
      const shapes = [
        { line: true, x0: tvX + 9 * s, y0: tvY, x1: tvX + 3 * s, y1: tvY - 10 * s, w: 1, c: [180, 180, 190] },
        { line: true, x0: tvX + 15 * s, y0: tvY, x1: tvX + 22 * s, y1: tvY - 8 * s, w: 1, c: [180, 180, 190] },
        { x: tvX, y: tvY, w: tvW, h: tvH, c: [150, 92, 50] },
        { x: tvX + 4 * s, y: fb - 3 * s, w: 3 * s, h: 3 * s, c: [70, 44, 26] },
        { x: tvX + tvW - 7 * s, y: fb - 3 * s, w: 3 * s, h: 3 * s, c: [70, 44, 26] },
      ];
      // Technician.
      const mx = Math.round(sx0 + 6 * s);
      const blue = [60, 110, 200];
      const blueD = [36, 70, 140];
      const skin = [240, 190, 140];
      shapes.push(
        { x: mx - 6 * s, y: fb - 2 * s, w: 5 * s, h: 2 * s, c: [70, 44, 30] },
        { x: mx + 1 * s, y: fb - 2 * s, w: 5 * s, h: 2 * s, c: [70, 44, 30] },
        { x: mx - 4 * s, y: fb - 11 * s, w: 3 * s, h: 9 * s, c: blueD },
        { x: mx + 1 * s, y: fb - 11 * s, w: 3 * s, h: 9 * s, c: blueD },
        { x: mx - 5 * s, y: fb - 21 * s, w: 10 * s, h: 11 * s, c: blue },
        { line: true, x0: mx - 5 * s, y0: fb - 19 * s, x1: mx - 7 * s, y1: fb - 24 * s, w: 2 * s, c: [220, 220, 210] },
        { disc: true, x: mx - 6 * s, y: fb - 25 * s, r: 1.6 * s, c: skin },
        { line: true, x0: mx + 4 * s, y0: fb - 19 * s, x1: mx + 9 * s, y1: fb - 15 * s, w: 2 * s, c: [220, 220, 210] },
        { disc: true, x: mx + 10 * s, y: fb - 14.5 * s, r: 1.6 * s, c: skin },
        { line: true, x0: mx + 10 * s, y0: fb - 15 * s, x1: mx + 14 * s, y1: fb - 21 * s, w: s, c: [170, 174, 184] },
        { disc: true, x: mx + 14.5 * s, y: fb - 22 * s, r: 1.6 * s, c: [170, 174, 184] },
        { disc: true, x: mx, y: fb - 26 * s, r: 4.5 * s, c: skin },
        { x: mx - 4.5 * s, y: fb - 31.5 * s, w: 9 * s, h: 4 * s, c: [220, 50, 50] },
        { x: mx + 2 * s, y: fb - 28.5 * s, w: 6 * s, h: 1.5 * s, c: [190, 36, 36] },
      );
      // Toolbox.
      const tbX = tvX + tvW + 3 * s;
      shapes.push(
        { x: tbX, y: fb - 6 * s, w: 10 * s, h: 6 * s, c: [210, 60, 40] },
        { x: tbX + 3 * s, y: fb - 8 * s, w: 4 * s, h: s, c: [80, 80, 90] },
      );
      cartoon(g, shapes, ink);
      // Details on top: the screen with static and a crack, overall straps and pocket, the face, a spark.
      const scX = tvX + 3 * s;
      const scY = tvY + 3 * s;
      const scW = tvW - 9 * s;
      const scH = tvH - 6 * s;
      for (let y = scY; y < scY + scH; y++) {
        for (let x = scX; x < scX + scW; x++) {
          const h = hash(x, y, seed);
          g.set(x, y, mix([30, 30, 40], [220, 224, 236], h * h));
        }
      }
      g.rect(scX - 1, scY - 1, scW + 2, 1, ink);
      g.rect(scX - 1, scY + scH, scW + 2, 1, ink);
      g.rect(scX - 1, scY, 1, scH, ink);
      g.rect(scX + scW, scY, 1, scH, ink);
      const crack = [[0.3, 0], [0.45, 0.3], [0.35, 0.5], [0.6, 0.75], [0.5, 1]];
      for (let k = 0; k + 1 < crack.length; k++) g.line(scX + crack[k][0] * scW, scY + crack[k][1] * (scH - 1), scX + crack[k + 1][0] * scW, scY + crack[k + 1][1] * (scH - 1), ink);
      for (let k = 0; k < 2; k++) g.disc(tvX + tvW - 3 * s, tvY + (5 + k * 5) * s, s, [230, 200, 120]);
      for (let k = 0; k < tvW; k += 3 * s) g.rect(tvX + k, tvY + tvH - 2 * s, 1, s, [110, 66, 34]);
      // Spark and smoke off the set's corner.
      const spx = tvX + tvW - 2 * s;
      const spy = tvY - 2 * s;
      for (const [dx, dy] of [[0, -4], [3, -3], [4, 0], [3, 3], [-3, -3], [-4, 0]]) g.line(spx, spy, spx + dx * s, spy + dy * s, [255, 230, 80]);
      g.disc(spx, spy, s, WHITE);
      for (let k = 0; k < 2; k++) g.disc(spx + (5 + k * 5) * s, spy - (4 + k * 2) * s, (1.5 + k * 0.8) * s, mix(bg, WHITE, 0.5 - k * 0.12));
      // Overalls straps, pocket and buttons.
      g.rect(mx - 4 * s, fb - 21 * s, s, 4 * s, blueD);
      g.rect(mx + 3 * s, fb - 21 * s, s, 4 * s, blueD);
      g.rect(mx - 2 * s, fb - 17 * s, 4 * s, 3 * s, blueD);
      g.set(mx - 4 * s, fb - 17 * s, [240, 220, 120]);
      g.set(mx + 3 * s, fb - 17 * s, [240, 220, 120]);
      // Face: worried eyes looking at the set, a little round mouth, a sweat drop.
      g.rect(mx + 1 * s, fb - 27 * s, s, s * 2, ink);
      g.rect(mx + 3 * s, fb - 27 * s, s, s * 2, ink);
      g.rect(mx + 1 * s, fb - 23.5 * s, 2 * s, s, ink);
      g.rect(mx - 4 * s, fb - 26 * s, s, 2 * s, mix(skin, BLACK, 0.25));
      g.disc(mx - 3 * s, fb - 31 * s, 0.9 * s, [140, 200, 255]);
      // A question mark by his head, when there is room under the small print.
      if (fb - 34 * s > printBottom + 2) g.text(mx - 13 * s, fb - 34 * s, '?', WHITE, s);
      // Scanlines over the whole card.
      g.scanlines(0.1);
      g.vignette(BLACK, 0.35);
    });
  },
};
