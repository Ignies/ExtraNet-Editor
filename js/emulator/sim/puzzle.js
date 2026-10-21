// The access tuner's rules (CMUDeepHackPuzzle): the carrier wave the three dials match, and the circuit board whose
// tiles carry it from the tuner on the left edge to the core on the right edge. Shared by the simulated server
// (colony.js) and the tuner window (tuner.js), so the window draws exactly what the server checks.
//
// Source: Content.CMU/Shared/PersonalComputers/DeepWeb/CMUDeepHackPuzzle.cs.

export const NORTH = 1;
export const EAST = 2;
export const SOUTH = 4;
export const WEST = 8;

export const MAX_FREQUENCY = 8;
export const MAX_AMPLITUDE = 5;
export const PHASE_STEPS = 8;

/** CMUDeepHackTile */
export const TILE = { Empty: 0, Straight: 1, Corner: 2, Tee: 3, Cross: 4 };

/** Connections of a tile at rotation 0. */
export function mask(tile) {
  switch (tile) {
    case TILE.Straight: return NORTH | SOUTH;
    case TILE.Corner: return NORTH | EAST;
    case TILE.Tee: return NORTH | EAST | SOUTH;
    case TILE.Cross: return NORTH | EAST | SOUTH | WEST;
    default: return 0;
  }
}

/** Connections of a cell { tile, rotation, locked }, each quarter turn moving them clockwise. */
export function connections(cell) {
  let m = mask(cell.tile);
  for (let i = 0; i < cell.rotation % 4; i++) m = ((m << 1) | (m >> 3)) & 0xF;
  return m;
}

/** The carrier's height at x (0 to 1 across the scope), from -amplitude to amplitude. */
export function wave(frequency, amplitude, phase, x) {
  return amplitude * Math.sin(Math.PI * 2 * (frequency * x + phase / PHASE_STEPS));
}

const STEPS = [[NORTH, SOUTH, 0, -1], [EAST, WEST, 1, 0], [SOUTH, NORTH, 0, 1], [WEST, EAST, -1, 0]];

/** Which cells carry the signal from the source, walking through matching connections. */
export function powered(cells, width, height, sourceRow) {
  const lit = new Array(cells.length).fill(false);
  const start = sourceRow * width;
  if (!cells.length || (connections(cells[start]) & WEST) === 0) return lit;
  const queue = [start];
  lit[start] = true;
  while (queue.length) {
    const index = queue.shift();
    const x = index % width;
    const y = Math.floor(index / width);
    const m = connections(cells[index]);
    for (const [dir, back, dx, dy] of STEPS) {
      if ((m & dir) === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (lit[next] || (connections(cells[next]) & back) === 0) continue;
      lit[next] = true;
      queue.push(next);
    }
  }
  return lit;
}

/** Solved when the core's cell is powered and opens east. */
export function solved(cells, width, height, sourceRow, coreRow) {
  const lit = powered(cells, width, height, sourceRow);
  const core = coreRow * width + width - 1;
  return lit[core] && (connections(cells[core]) & EAST) !== 0;
}

function toward(from, to, width) {
  const dx = (to % width) - (from % width);
  const dy = Math.floor(to / width) - Math.floor(from / width);
  if (dx === 1 && dy === 0) return EAST;
  if (dx === -1 && dy === 0) return WEST;
  if (dx === 0 && dy === 1) return SOUTH;
  return NORTH;
}

/** A path of cell indices from the source to the core that never visits a cell twice. */
function route(rng, width, height, sourceRow, coreRow) {
  for (;;) {
    const path = [sourceRow * width];
    const seen = new Set(path);
    let x = 0;
    let y = sourceRow;
    for (let steps = 0; steps < width * height * 2; steps++) {
      if (x === width - 1 && y === coreRow) return path;
      let options = [];
      if (x < width - 1) options.push([x + 1, y], [x + 1, y]);
      if (y > 0) options.push([x, y - 1]);
      if (y < height - 1) options.push([x, y + 1]);
      // On the last column only move toward the core.
      if (x === width - 1) options = [[x, y + Math.sign(coreRow - y)]];
      options = options.filter(([ox, oy]) => !seen.has(oy * width + ox));
      if (!options.length) break;
      [x, y] = options[rng.next(options.length)];
      path.push(y * width + x);
      seen.add(y * width + x);
    }
  }
}

/**
 * A board with one guaranteed route from source to core, every tile turned at random and a few route tiles burnt
 * in at their right rotation as anchors. rng: { next(n), next(min, max), float() } (net.js's Rng).
 */
export function newBoard(rng, width, height, sourceRow, coreRow, anchors) {
  const path = route(rng, width, height, sourceRow, coreRow);
  const cells = [];
  for (let i = 0; i < width * height; i++) {
    const tile = rng.float() < 0.15 ? TILE.Empty : rng.next(1, 5);
    cells.push({ tile, rotation: rng.next(4), locked: false });
  }
  for (let i = 0; i < path.length; i++) {
    const from = i === 0 ? WEST : toward(path[i], path[i - 1], width);
    const to = i === path.length - 1 ? EAST : toward(path[i], path[i + 1], width);
    const need = from | to;
    let tile = need === (NORTH | SOUTH) || need === (EAST | WEST) ? TILE.Straight : TILE.Corner;
    if (rng.float() < 0.15) tile = rng.next(2) === 0 ? TILE.Tee : TILE.Cross;
    // The rotation that covers every connection the route needs.
    let right = 0;
    for (let r = 0; r < 4; r++) {
      if ((connections({ tile, rotation: r }) & need) === need) {
        right = r;
        break;
      }
    }
    cells[path[i]] = { tile, rotation: right, locked: false };
  }
  // Anchors stay right; everything else is scrambled, and the scramble must not already be solved.
  const anchored = new Set();
  for (let i = 0; i < anchors && path.length > 2; i++) anchored.add(path[rng.next(1, path.length - 1)]);
  do {
    for (let i = 0; i < cells.length; i++) {
      if (anchored.has(i)) cells[i] = { ...cells[i], locked: true };
      else if (cells[i].tile !== TILE.Empty) cells[i] = { ...cells[i], rotation: rng.next(4) };
    }
  } while (solved(cells, width, height, sourceRow, coreRow));
  return cells;
}
