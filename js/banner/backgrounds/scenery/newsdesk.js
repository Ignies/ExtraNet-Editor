// A colony TV news studio: a lighting rig, a lit backdrop panel behind the presenter's chair, the curved anchor desk
// at lower middle, a wall of CRT monitors on the detail side and the station's logo panel on the other.
import { PIXEL, paint, hex, mix, ramp, rng, makeNoise, fbm, num, BLACK, WHITE } from '../_kit.js';
import { GROUP, FOCUS } from './_scene.js';
import { crt, bevel, textCentre, textWidth } from './_broadcast.js';

export default {
  id: 'scene-news-desk',
  name: 'News desk',
  group: GROUP,
  tags: ['scenery', 'interior', 'news', 'tv'],
  params: [
    { key: 'wall', label: 'Walls', type: 'color', default: '#16213C' },
    { key: 'panel', label: 'Backdrop panel', type: 'color', default: '#2A5AA8' },
    { key: 'accent', label: 'Accent', type: 'color', default: '#F0A030' },
    { key: 'desk', label: 'Desk', type: 'color', default: '#C8CCD8' },
    { key: 'screens', label: 'Screens', type: 'color', default: '#3A8AE0' },
    {
      key: 'logo', label: 'Station logo', type: 'select', default: 'NEWS|4',
      options: [['NEWS|4', 'NEWS 4'], ['NEWS|9', 'NEWS 9'], ['COLONY|NEWS', 'COLONY NEWS'], ['LIVE|AT 6', 'LIVE AT 6']],
    },
    { key: 'deskW', label: 'Desk width', type: 'range', min: 0.25, max: 0.7, step: 0.01, default: 0.46 },
    FOCUS,
    PIXEL,
  ],
  draw(ctx, width, height, p, seed) {
    paint(ctx, width, height, p.pixel, g => {
      const wall = hex(p.wall);
      const panel = hex(p.panel);
      const accent = hex(p.accent);
      const desk = hex(p.desk);
      const screens = hex(p.screens);
      const r = rng(seed);
      const n = makeNoise(seed);
      const u = g.u;
      const rig = Math.round(7 * u);
      const fy = Math.round(g.h * 0.8);
      const cx = g.w / 2;
      // Back wall: dark panels with seams, darker towards the top.
      const wallTones = [mix(wall, BLACK, 0.5), mix(wall, BLACK, 0.25), wall, mix(wall, WHITE, 0.06)];
      for (let y = 0; y < fy; y++) {
        for (let x = 0; x < g.w; x++) g.set(x, y, ramp(wallTones, 0.25 + y / fy * 0.6 + (fbm(n, x * 0.05, y * 0.05, 2) - 0.5) * 0.3, x, y));
      }
      const seam = Math.round(26 * u);
      for (let x = Math.round(cx) % seam; x < g.w; x += seam) {
        g.rect(x, rig, 1, fy - rig, mix(wall, BLACK, 0.55));
        g.rect(x + 1, rig, 1, fy - rig, mix(wall, WHITE, 0.08));
      }
      // The backdrop panel behind the chair: a lit gradient with light slats and a horizon arc.
      const bw = Math.round(g.w * 0.4);
      const bx = Math.round(cx - bw / 2);
      const by = Math.round(rig + 5 * u);
      const bh = Math.round(fy - by - 8 * u);
      const panelTones = [mix(panel, BLACK, 0.55), mix(panel, BLACK, 0.3), panel, mix(panel, WHITE, 0.25)];
      g.rect(bx - 2, by - 2, bw + 4, bh + 4, mix(wall, BLACK, 0.6));
      for (let y = by; y < by + bh; y++) {
        for (let x = bx; x < bx + bw; x++) {
          const dx = (x - cx) / bw;
          const dy = (y - (by + bh * 0.45)) / bh;
          let c = ramp(panelTones, 0.95 - Math.hypot(dx * 1.1, dy * 0.9) * 1.6, x, y);
          if ((y - by) % Math.max(3, Math.round(4 * u)) === 0) c = mix(c, BLACK, 0.18);
          g.set(x, y, c);
        }
      }
      // A horizon arc across the panel, like a planet's limb, in the accent colour.
      const ar = bw * 1.1;
      const acy = by + bh + ar * 0.62;
      for (let x = bx; x < bx + bw; x++) {
        const yy = acy - Math.sqrt(Math.max(0, ar * ar - (x - cx) * (x - cx)));
        if (yy > by && yy < by + bh) {
          g.set(x, yy, mix(accent, WHITE, 0.4));
          g.set(x, yy + 1, accent);
          for (let k = 2; k < 4 * u; k++) g.dot(x, yy + k, accent, 0.5 - k / (8 * u));
        }
      }
      g.rect(bx - 2, by + bh + 2, bw + 4, 1, mix(panel, WHITE, 0.4));
      // Monitor wall and logo panel on either side.
      const monW = Math.round(g.w * 0.25);
      const monX = Math.round(g.w * 0.73);
      const logoW = Math.round(g.w * 0.2);
      const logoX = Math.round(g.w * 0.05);
      const sideY = Math.round(rig + 6 * u);
      const sideH = Math.round(fy - sideY - 12 * u);
      const monitorWall = (x0) => {
        bevel(g, x0 - 2, sideY - 2, monW + 4, sideH + 4, mix(wall, BLACK, 0.65), 0.25);
        const cols = 3;
        const rows = 3;
        const cw = monW / cols;
        const ch = sideH / rows;
        const kinds = ['face', 'map', 'bars', 'graph', 'planet', 'text', 'static', 'logo', 'face'];
        for (let i = kinds.length - 1; i > 0; i--) {
          const j = Math.floor(r() * (i + 1));
          [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
        }
        for (let j = 0; j < rows; j++) {
          for (let i = 0; i < cols; i++) {
            const k = i + j * cols;
            const tint = k % 3 === 0 ? mix(screens, accent, 0.5) : screens;
            crt(g, x0 + i * cw, sideY + j * ch, Math.floor(cw), Math.floor(ch), kinds[k], seed + i * 7 + j * 13, tint, String(p.logo).split('|')[0]);
          }
        }
      };
      const logoPanel = (x0) => {
        const [top, bottom] = String(p.logo).split('|');
        bevel(g, x0, sideY, logoW, sideH, mix(wall, BLACK, 0.35), 0.3);
        g.rect(x0 + 2, sideY + 2, logoW - 4, sideH - 4, mix(wall, BLACK, 0.55));
        g.glow(x0 + logoW / 2, sideY + sideH * 0.45, logoW * 0.7, sideH * 0.5, panel, 0.35);
        const s1 = Math.max(1, Math.floor((logoW - 6) / textWidth(top || '', 1)));
        const s1c = Math.min(s1, Math.max(1, Math.round(2 * u)));
        textCentre(g, x0 + logoW / 2 + 1, sideY + sideH * 0.18 + 1, top || '', mix(panel, BLACK, 0.6), s1c);
        textCentre(g, x0 + logoW / 2, sideY + sideH * 0.18, top || '', WHITE, s1c);
        if (bottom) {
          const s2 = Math.max(1, Math.min(Math.floor((logoW - 6) / textWidth(bottom, 1)), Math.floor(sideH * 0.4 / 5)));
          const ty = Math.round(sideY + sideH * 0.18 + 5 * s1c + 3 * u);
          textCentre(g, x0 + logoW / 2 + 1, ty + 1, bottom, mix(accent, BLACK, 0.6), s2);
          textCentre(g, x0 + logoW / 2, ty, bottom, accent, s2);
        }
        g.rect(x0 + 4, sideY + sideH - Math.round(5 * u), logoW - 8, Math.max(1, Math.round(u)), accent);
        g.rect(x0 + 4, sideY + sideH - Math.round(3 * u), logoW - 8, Math.max(1, Math.round(u)), mix(accent, BLACK, 0.3));
      };
      if (p.focus === 'left') {
        monitorWall(g.w - monX - monW);
        logoPanel(g.w - logoX - logoW);
      } else if (p.focus === 'center') {
        monitorWall(g.w - monX - monW);
        monitorWall(monX);
      } else {
        monitorWall(monX);
        logoPanel(logoX);
      }
      // Lighting rig: a dark truss with lamps, each throwing a soft pool down the wall.
      g.rect(0, 0, g.w, rig, [14, 15, 20]);
      for (let x = 0; x < g.w; x += Math.max(4, Math.round(6 * u))) g.line(x, 0, x + rig, rig - 1, [30, 32, 40]);
      g.rect(0, rig - 1, g.w, 1, [44, 46, 56]);
      for (let k = 0; k < 6; k++) {
        const lx = Math.round(g.w * (k + 0.5) / 6);
        g.rect(lx - 2, rig, 5, Math.round(3 * u), [36, 38, 44]);
        g.rect(lx - 1, rig + Math.round(3 * u), 3, 1, [255, 244, 210]);
        g.glow(lx, rig + 3 * u, 16 * u, 30 * u, [255, 236, 190], 0.14);
      }
      // Floor: dark gloss with reflections of the panel and the desk.
      for (let y = fy; y < g.h; y++) {
        const t = (y - fy) / (g.h - fy);
        for (let x = 0; x < g.w; x++) g.set(x, y, ramp([mix(wall, BLACK, 0.7), mix(wall, BLACK, 0.45), mix(wall, BLACK, 0.2)], 0.8 - t * 0.6 + (n(x * 0.2, y * 0.6) - 0.5) * 0.2, x, y));
      }
      g.rect(0, fy, g.w, 1, mix(wall, WHITE, 0.15));
      for (let x = 0; x < g.w; x++) if ((x + seed) % Math.round(30 * u) < 2) for (let y = fy + 2; y < g.h; y += 2) g.dot(x, y, mix(panel, WHITE, 0.2), 0.4);
      // The anchor desk: a curved top, a front panel with an accent band and a logo plate, darker ends.
      const dw = Math.round(g.w * num(p.deskW, 0.46));
      const dx0 = Math.round(cx - dw / 2);
      const top = Math.round(g.h * 0.64);
      const bend = 5 * u;
      const deskFront = mix(desk, BLACK, 0.12);
      for (let x = dx0; x < dx0 + dw; x++) {
        const t = (x - cx) / (dw / 2);
        const yTop = Math.round(top + t * t * bend);
        const yBot = Math.round(fy + 3 * u - t * t * bend * 0.4);
        const ends = Math.abs(t) > 0.92;
        for (let y = yTop; y < yBot; y++) {
          const v = (y - yTop) / (yBot - yTop);
          let c = ramp([mix(deskFront, WHITE, 0.15), deskFront, mix(deskFront, BLACK, 0.3)], v * 1.1 + Math.abs(t) * 0.35, x, y);
          if (ends) c = mix(c, BLACK, 0.3);
          g.set(x, y, c);
        }
        const sur = Math.max(2, Math.round(2.5 * u));
        for (let y = yTop - sur; y < yTop; y++) g.set(x, y, mix(desk, WHITE, 0.35));
        g.set(x, yTop - sur, mix(desk, WHITE, 0.7));
        g.set(x, yTop, mix(desk, BLACK, 0.45));
        // Accent band across the front.
        const band = Math.round(yTop + (yBot - yTop) * 0.42);
        g.rect(x, band, 1, Math.max(1, Math.round(2 * u)), ends ? mix(accent, BLACK, 0.3) : accent);
        g.set(x, band + Math.max(1, Math.round(2 * u)), mix(accent, BLACK, 0.5));
        // Shadow on the floor under the desk.
        for (let y = yBot; y < yBot + 3 * u; y++) g.dot(x, y, BLACK, 0.5);
      }
      // Logo plate on the desk front.
      const pw = Math.round(dw * 0.28);
      const ph = Math.round(9 * u);
      const py = Math.round(top + 4 * u);
      bevel(g, cx - pw / 2, py, pw, ph, mix(wall, BLACK, 0.2), 0.3);
      const word = String(p.logo).split('|')[0];
      const ws = Math.max(1, Math.min(Math.round(u), Math.floor((pw - 4) / textWidth(word, 1))));
      textCentre(g, cx, Math.round(py + (ph - 5 * ws) / 2), word, WHITE, ws);
      g.vignette(BLACK, 0.4);
    });
  },
};
