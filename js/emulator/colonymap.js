// CMUColonyMapView: the colony's own map, the one the tactical map tables and the overwatch consoles draw
// (TacticalMapControl), with terminals pinned on it as map blips; clicking a pin passes its terminal on. The game
// builds the map from the colony grid's areas (AreaGridComponent.Colors: a tile's MinimapColor, else the turf's,
// else its area's at half alpha, else #6c6767d8), one pixel per tile, fitted to the control with its aspect kept.
// Blips are map_blips.rsi: the background state tinted in the pin's colour, then gm_circle, or gm_exclamation when
// the terminal is flagged.
//
// The emulator has no map files, so each colony gets a made up grid in the same colours, laid out the same way
// every time from the colony's name: buildings of rooms in the areas' minimap colours, white walls, grey corridors
// and the dirt outside. The drawing and the blips follow the game.

import { el, hash } from '../util.js';
import { loadRsi, loadStateSheet } from '../sprites.js';

const BLIPS = '/Textures/_RMC14/Interface/map_blips.rsi';
/** TacticalMapControl's constants. */
const MAP_SCALE = 3;
const BASE_BLIP = 14;
const CLICK_TOLERANCE = 8;
const LABEL_FONT = 'bold 13.33px "GameSans", "Noto Sans", sans-serif';

const WIDTH = 96;
const HEIGHT = 68;
// The RMC areas' minimap colours, at the half alpha an area's floor gets.
const AREA_COLOURS = ['#C19504', '#812DA2', '#91BDCF', '#A22D2D', '#2B5B2B', '#2D3FA2', '#3DBF75', '#5A4501', '#00B3FF', '#390192'];
const WALL = [0xeb, 0xe5, 0xe5, 0xee];
const CORRIDOR = [0x6c, 0x67, 0x67, 0xd8];
const DIRT = [0x9c, 0x90, 0x6d, 0xc2];
const ROCK = [0xaa, 0x5f, 0x44, 0xcc];

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function rgbOf(hex, alpha) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255, Math.round(alpha * 255)];
}

const grids = new Map();

/**
 * The colony's grid: { width, height, colours: Uint8ClampedArray (RGBA per tile), rooms: [{ name, x, y, w, h }] }.
 * names: the areas to call the rooms after.
 */
export function colonyGrid(colony, names = []) {
  const key = `${colony}|${names.join(',')}`;
  if (grids.has(key)) return grids.get(key);
  const random = rng(hash(colony || 'colony'));
  const colours = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
    colours.set(c, (y * WIDTH + x) * 4);
  };
  // the ground: dirt with outcrops of rock along the edges, nothing past the map's ragged border
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const edge = Math.min(x, y, WIDTH - 1 - x, HEIGHT - 1 - y);
      if (edge < 2 + Math.floor(random() * 2)) continue;
      set(x, y, edge < 6 && random() < 0.55 ? ROCK : DIRT);
    }
  }
  // two main streets, then buildings of rooms either side of them
  const streetY = 20 + Math.floor(random() * 28);
  const streetX = 30 + Math.floor(random() * 36);
  for (let x = 4; x < WIDTH - 4; x++) for (let d = 0; d < 3; d++) set(x, streetY + d, CORRIDOR);
  for (let y = 4; y < HEIGHT - 4; y++) for (let d = 0; d < 3; d++) set(streetX + d, y, CORRIDOR);
  const rooms = [];
  const free = (x, y, w, h) => {
    if (x < 5 || y < 5 || x + w > WIDTH - 5 || y + h > HEIGHT - 5) return false;
    for (let j = y - 1; j <= y + h; j++) {
      for (let i = x - 1; i <= x + w; i++) {
        const tile = colours.subarray((j * WIDTH + i) * 4, (j * WIDTH + i) * 4 + 4);
        if (tile[3] && !(tile[0] === DIRT[0] && tile[1] === DIRT[1]) && !(tile[0] === ROCK[0] && tile[1] === ROCK[1])) return false;
      }
    }
    return true;
  };
  for (let tries = 0; tries < 400 && rooms.length < 11; tries++) {
    const w = 9 + Math.floor(random() * 12);
    const h = 7 + Math.floor(random() * 9);
    // hug a street, with a door onto it
    const vertical = random() < 0.5;
    const x = vertical ? (random() < 0.5 ? streetX - w - 1 : streetX + 4) : 5 + Math.floor(random() * (WIDTH - w - 10));
    const y = vertical ? 5 + Math.floor(random() * (HEIGHT - h - 10)) : (random() < 0.5 ? streetY - h - 1 : streetY + 4);
    if (!free(x, y, w, h)) continue;
    const colour = rgbOf(AREA_COLOURS[rooms.length % AREA_COLOURS.length], 0.5);
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) set(i, j, i === x || j === y || i === x + w - 1 || j === y + h - 1 ? WALL : colour);
    }
    // the door, toward the street
    if (vertical) set(x < streetX ? x + w - 1 : x, y + Math.floor(h / 2), colour);
    else set(x + Math.floor(w / 2), y < streetY ? y + h - 1 : y, colour);
    rooms.push({ name: names[rooms.length] || `Area ${rooms.length + 1}`, x, y, w, h });
  }
  const grid = { width: WIDTH, height: HEIGHT, colours, rooms };
  grids.set(key, grid);
  return grid;
}

/** A floor tile of the room, or of the nearest room to (fx, fy) as fractions of the map. */
export function tileFor(grid, { room, fx, fy, seed = 0 }) {
  let target = typeof room === 'number' ? grid.rooms[room % Math.max(1, grid.rooms.length)] : null;
  if (!target && grid.rooms.length) {
    const px = (fx ?? 0.5) * grid.width;
    const py = (fy ?? 0.5) * grid.height;
    target = grid.rooms.reduce((best, r) => {
      const d = Math.hypot(r.x + r.w / 2 - px, r.y + r.h / 2 - py);
      return !best || d < best.d ? { r, d } : best;
    }, null).r;
  }
  if (!target) return { x: Math.floor(grid.width / 2), y: Math.floor(grid.height / 2) };
  const r = rng(seed * 7919 + 13);
  return { x: target.x + 2 + Math.floor(r() * Math.max(1, target.w - 4)), y: target.y + 2 + Math.floor(r() * Math.max(1, target.h - 4)) };
}

let blipArt = null;

function loadBlips(states) {
  if (!blipArt) blipArt = new Map();
  return Promise.all(states.map(async state => {
    if (blipArt.has(state)) return;
    const rsi = await loadRsi(BLIPS);
    if (!rsi.states.has(state)) return;
    blipArt.set(state, { image: await loadStateSheet(rsi.path, state), w: rsi.size.x, h: rsi.size.y });
  })).catch(() => {});
}

function tinted(art, colour) {
  const canvas = document.createElement('canvas');
  canvas.width = art.w;
  canvas.height = art.h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(art.image, 0, 0, art.w, art.h, 0, 0, art.w, art.h);
  // DrawTextureRect with a colour modulates: multiply, keeping the sprite's alpha
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, art.w, art.h);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(art.image, 0, 0, art.w, art.h, 0, 0, art.w, art.h);
  return canvas;
}

/**
 * CMUColonyMapView.TryCreate. pins: [{ x, y (tiles), colour, flagged, title }]; background: the blips' background
 * state (background_cmb for the Marshals, background_mp for colony security); onPick(pin). Returns the control.
 */
export function colonyMapView({ grid, pins = [], background = 'background_cmb', onPick = null, height = 420, labels = true }) {
  const canvas = el('canvas.emu-colony-map-canvas');
  const root = el('div.emu-colony-map', {}, canvas);
  root.style.height = `${height}px`;
  const image = new ImageData(grid.colours, grid.width, grid.height);
  const tiles = document.createElement('canvas');
  tiles.width = grid.width;
  tiles.height = grid.height;
  tiles.getContext('2d').putImageData(image, 0, 0);
  let layout = null;
  const tint = new Map();

  const draw = () => {
    const box = root.getBoundingClientRect();
    if (!box.width) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(box.width * dpr);
    canvas.height = Math.round(box.height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, box.width, box.height);
    // KeepAspectCentered
    const scale = Math.min(box.width / grid.width, box.height / grid.height);
    const left = (box.width - grid.width * scale) / 2;
    const top = (box.height - grid.height * scale) / 2;
    ctx.drawImage(tiles, left, top, grid.width * scale, grid.height * scale);
    const overlay = scale / MAP_SCALE;
    const size = BASE_BLIP * (1 + (overlay - 1) * 0.6);
    layout = { left, top, scale, overlay, size };
    if (labels) {
      ctx.font = LABEL_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const room of grid.rooms) {
        const cx = left + (room.x + room.w / 2) * scale;
        const cy = top + (room.y + room.h / 2) * scale;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillText(room.name, cx + 1, cy + 1);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(room.name, cx, cy);
      }
    }
    for (const pin of pins) {
      const cx = left + (pin.x + 0.5) * scale;
      const cy = top + (pin.y + 0.5) * scale;
      const x = cx - size / 2;
      const y = cy - size / 2;
      const back = blipArt && blipArt.get(background);
      const mark = blipArt && blipArt.get(pin.flagged ? 'gm_exclamation' : 'gm_circle');
      if (back) {
        const key = `${background}|${pin.colour}`;
        if (!tint.has(key)) tint.set(key, tinted(back, pin.colour));
        ctx.drawImage(tint.get(key), x, y, size, size);
      } else {
        ctx.fillStyle = pin.colour;
        ctx.beginPath();
        ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (mark) ctx.drawImage(mark.image, 0, 0, mark.w, mark.h, x, y, size, size);
    }
  };

  const pinAt = (px, py) => {
    if (!layout) return null;
    const tolerance = CLICK_TOLERANCE * layout.overlay + layout.size / 2;
    let best = null;
    for (const pin of pins) {
      const d = Math.hypot(layout.left + (pin.x + 0.5) * layout.scale - px, layout.top + (pin.y + 0.5) * layout.scale - py);
      if (d <= tolerance && (!best || d < best.d)) best = { pin, d };
    }
    return best && best.pin;
  };
  canvas.addEventListener('click', e => {
    const box = canvas.getBoundingClientRect();
    const pin = pinAt(e.clientX - box.left, e.clientY - box.top);
    if (pin && onPick) onPick(pin);
  });
  canvas.addEventListener('pointermove', e => {
    const box = canvas.getBoundingClientRect();
    const pin = pinAt(e.clientX - box.left, e.clientY - box.top);
    canvas.style.cursor = pin && onPick ? 'pointer' : '';
    canvas.title = pin ? pin.title || '' : '';
  });
  const observer = new ResizeObserver(() => draw());
  observer.observe(root);
  loadBlips([background, 'gm_circle', 'gm_exclamation']).then(draw);
  requestAnimationFrame(draw);
  root.redraw = draw;
  return root;
}
