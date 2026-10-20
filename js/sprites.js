// RSI sprites: reads meta.json and state sheets, and draws states animated at their own delays, facing south
// like the game's AnimatedTextureRect.

import { fetchResource, isLocal } from './repo.js';

const rsiCache = new Map();

/** The game's RSI paths are rooted (/Textures/...) or relative to /Textures. */
export function rootedRsi(path) {
  const p = path.trim();
  if (p.startsWith('/') || isLocal(p)) return p.replace(/\/+$/, '');
  return '/Textures/' + p.replace(/\/+$/, '');
}

/** meta.json of an RSI: { size: {x, y}, states: Map(name -> { name, directions, delays }) }. */
export function loadRsi(path) {
  const rooted = rootedRsi(path);
  if (!isLocal(rooted) && rsiCache.has(rooted)) return rsiCache.get(rooted);
  const promise = fetchResource(`${rooted}/meta.json`, 'json').then(({ data }) => {
    const states = new Map();
    for (const state of data.states || []) {
      states.set(state.name, {
        name: state.name,
        directions: state.directions || 1,
        delays: state.delays || null,
        flags: state.flags || null,
      });
    }
    return { path: rooted, size: data.size || { x: 32, y: 32 }, states, license: data.license, copyright: data.copyright };
  });
  if (!isLocal(rooted)) rsiCache.set(rooted, promise);
  promise.catch(() => rsiCache.delete(rooted));
  return promise;
}

const sheetCache = new Map();

function loadImageBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('not a readable image'));
    image.src = url;
  });
}

/** The sheet image of one state. */
export function loadStateSheet(rsiPath, state) {
  const key = `${rsiPath}/${state}.png`;
  if (!isLocal(key) && sheetCache.has(key)) return sheetCache.get(key);
  const promise = fetchResource(key, 'blob').then(({ data }) => loadImageBlob(data));
  if (!isLocal(key)) sheetCache.set(key, promise);
  promise.catch(() => sheetCache.delete(key));
  return promise;
}

/** Frames of a state facing one direction: [{ sx, sy, delay }], in sheet order. */
export function stateFrames(rsi, state, image, direction = 0) {
  const { x: w, y: h } = rsi.size;
  const columns = Math.max(1, Math.floor(image.width / w));
  const dirs = state.directions;
  const perDirection = state.delays ? state.delays.map(d => d.length) : new Array(dirs).fill(1);
  let index = 0;
  for (let d = 0; d < direction && d < perDirection.length; d++) index += perDirection[d];
  const delays = state.delays ? state.delays[Math.min(direction, state.delays.length - 1)] : [1];
  return delays.map((delay, i) => {
    const k = index + i;
    return { sx: (k % columns) * w, sy: Math.floor(k / columns) * h, delay: Math.max(0.01, Number(delay) || 0.1) };
  });
}

// ---------------------------------------------------------------- animation

const animated = new Set();
let running = false;

function tick(now) {
  for (const sprite of animated) {
    if (!sprite.canvas.isConnected) {
      if (sprite.detachedSince === undefined) sprite.detachedSince = now;
      else if (now - sprite.detachedSince > 2000) animated.delete(sprite);
      continue;
    }
    sprite.detachedSince = undefined;
    const elapsed = (now - sprite.started) / 1000;
    let t = elapsed % sprite.total;
    let frame = 0;
    while (frame < sprite.frames.length - 1 && t >= sprite.frames[frame].delay) {
      t -= sprite.frames[frame].delay;
      frame++;
    }
    if (frame !== sprite.current) {
      sprite.current = frame;
      draw(sprite);
    }
  }
  if (animated.size) requestAnimationFrame(tick);
  else running = false;
}

function draw(sprite) {
  const { ctx, image, frames, w, h, canvas } = sprite;
  const f = frames[sprite.current];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, f.sx, f.sy, w, h, 0, 0, canvas.width, canvas.height);
}

/**
 * Draws an RSI state into a new canvas at the given scale, animated if it has frames.
 * Resolves to the canvas, or rejects if the RSI or state cannot be found.
 */
export async function spriteCanvas(rsiPath, stateName, scale = 2, direction = 0) {
  const rsi = await loadRsi(rsiPath);
  const state = rsi.states.get(stateName);
  if (!state) throw new Error(`state "${stateName}" is not in ${rsi.path}`);
  const image = await loadStateSheet(rsi.path, stateName);
  const frames = stateFrames(rsi, state, image, Math.min(direction, state.directions - 1));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(rsi.size.x * scale));
  canvas.height = Math.max(1, Math.round(rsi.size.y * scale));
  canvas.className = 'rsi-sprite';
  const sprite = {
    canvas,
    ctx: canvas.getContext('2d'),
    image,
    frames,
    w: rsi.size.x,
    h: rsi.size.y,
    current: 0,
    started: performance.now(),
    total: frames.reduce((sum, f) => sum + f.delay, 0),
  };
  draw(sprite);
  if (frames.length > 1) {
    animated.add(sprite);
    if (!running) {
      running = true;
      requestAnimationFrame(tick);
    }
  }
  return canvas;
}

/** Number of frames a state shows facing south. */
export function frameCount(rsi, stateName) {
  const state = rsi.states.get(stateName);
  if (!state) return 0;
  return state.delays ? state.delays[0].length : 1;
}
