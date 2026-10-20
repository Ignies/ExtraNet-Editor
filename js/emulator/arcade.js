// The ExtraNet arcade cabinet (<CMUNetArcade Game="HuggerRun"/> or Game="TrackerReflex"), ported from
// Content.CMU/Client/PersonalComputers/CMUComputerFunUi.cs: CMUNetArcade, CMUArcadeScreen, CMUHuggerRun and
// CMUTrackerReflex. The games draw only rects, circles, a line and text, no sprites.
// The server's per round high score board is emulated in localStorage.

const GAMES = {
  HuggerRun: {
    title: 'Hugger Run',
    help: 'Click the screen, then steer with the arrow keys or the buttons. Eat eggs, do not bite your tail.',
  },
  TrackerReflex: {
    title: 'Tracker Reflex',
    help: 'Click the blips before they fade. Thirty seconds on the clock.',
  },
};

const TEXT = {
  start: 'START',
  scores: 'HIGH SCORES',
  noScores: 'No scores yet. Be the first.',
  score: (score) => `SCORE ${score}`,
  time: (seconds) => `TIME ${seconds}`,
  over: (score) => `GAME OVER - SCORE ${score}`,
  line: (rank, name, score) => `${rank}. ${name} ${score}`,
};

// CMUArcadeLimits.MaxScore; the emulator keeps a top 5 (the server keeps CMUArcadeLimits.Board = 10).
const MAX_SCORE = 9999;
const BOARD = 5;
const SCREEN_W = 320;
const SCREEN_H = 224;
const SCREEN_BG = '#020602';
const DEFAULT_GREEN = '#3FE05A';
const DEFAULT_DIM = '#1F8A33';
const FONT = '12px GameSans, "Noto Sans", "Segoe UI", Arial, sans-serif';
const TAU = Math.PI * 2;

const STYLE_ID = 'emu-arcade-style';
const STYLE = `
.emu-arcade { display: flex; flex-direction: column; gap: 6px; margin: 6px 0; padding: 8px; outline: none;
  font: 13px GameSans, "Noto Sans", "Segoe UI", Arial, sans-serif; box-sizing: border-box; max-width: 100%; }
.emu-arcade:focus-visible { box-shadow: 0 0 0 1px var(--emu-arcade-green); }
.emu-arcade-heading { font-weight: bold; font-size: 15px; }
.emu-arcade-key { font-weight: bold; }
.emu-arcade-screen { display: block; width: 320px; height: 224px; max-width: 100%; touch-action: manipulation;
  cursor: pointer; image-rendering: pixelated; align-self: flex-start; }
.emu-arcade-row { display: flex; gap: 4px; align-self: flex-start; }
.emu-arcade-button { min-width: 32px; padding: 3px 8px; font: inherit; color: var(--emu-arcade-green);
  background: transparent; border: 1px solid var(--emu-arcade-green); cursor: pointer; }
.emu-arcade-button:hover { background: var(--emu-arcade-hover); }
.emu-arcade-scores { display: flex; flex-direction: column; gap: 2px; }
`;

function injectStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE;
  document.head.appendChild(style);
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(rgb, alpha) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// High scores ---------------------------------------------------------------------------------------------------

function storageKey(game) {
  return `extranet-emulator-arcade-${game}`;
}

function loadScores(game) {
  try {
    const raw = window.localStorage.getItem(storageKey(game));
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list
      .filter((s) => s && typeof s.name === 'string' && Number.isFinite(s.score))
      .slice(0, BOARD);
  } catch {
    return [];
  }
}

function submitScore(game, score) {
  // CMUComputerFunSystem.OnArcadeSubmit: zero and unbelievable scores are dropped.
  if (score <= 0 || score > MAX_SCORE) return loadScores(game);
  const scores = loadScores(game);
  scores.push({ name: 'You', score });
  scores.sort((a, b) => b.score - a.score);
  scores.length = Math.min(scores.length, BOARD);
  try {
    window.localStorage.setItem(storageKey(game), JSON.stringify(scores));
  } catch {
    // Storage blocked: the board just does not keep it.
  }
  return scores;
}

// Screens -------------------------------------------------------------------------------------------------------

/** CMUArcadeScreen: phosphor on black, a score line, and a game over when it ends. */
class ArcadeScreen {
  constructor(colors) {
    this.colors = colors;
    this.running = false;
    this.score = 0;
    this.status = '';
    this.onGameOver = null;
  }

  start() {
    this.score = 0;
    this.running = true;
  }

  gameOver() {
    this.running = false;
    this.status = TEXT.over(this.score);
    if (this.onGameOver) this.onGameOver(this.score);
  }

  draw(ctx) {
    ctx.fillStyle = SCREEN_BG;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    this.drawGame(ctx);
    ctx.strokeStyle = this.colors.green;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, SCREEN_W - 1, SCREEN_H - 1);
    ctx.fillStyle = this.colors.green;
    ctx.font = FONT;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(this.status.length > 0 ? this.status : TEXT.score(this.score), 6, 4);
  }

  update() {}
  key() { return false; }
  click() { return false; }
  drawGame() {}
}

/** CMUHuggerRun, a snake: steer the hugger to the eggs; every egg makes it longer; a wall or its tail ends it. */
class HuggerRun extends ArcadeScreen {
  static WIDTH = 20;
  static HEIGHT = 14;
  static STEP = 0.14;

  constructor(colors) {
    super(colors);
    this.body = [];
    this.direction = { x: 1, y: 0 };
    this.next = { x: 1, y: 0 };
    this.egg = { x: 0, y: 0 };
    this.timer = 0;
  }

  start() {
    super.start();
    this.body = [{ x: 5, y: 7 }, { x: 4, y: 7 }, { x: 3, y: 7 }];
    this.direction = { x: 1, y: 0 };
    this.next = { x: 1, y: 0 };
    this.status = '';
    this.placeEgg();
  }

  turn(x, y) {
    // No turning straight back into the tail.
    if (x + this.direction.x !== 0 || y + this.direction.y !== 0) this.next = { x, y };
  }

  key(event) {
    switch (event.key) {
      case 'ArrowUp': this.turn(0, -1); return true;
      case 'ArrowDown': this.turn(0, 1); return true;
      case 'ArrowLeft': this.turn(-1, 0); return true;
      case 'ArrowRight': this.turn(1, 0); return true;
      default: return false;
    }
  }

  contains(at) {
    return this.body.some((b) => b.x === at.x && b.y === at.y);
  }

  placeEgg() {
    do {
      this.egg = {
        x: Math.floor(Math.random() * HuggerRun.WIDTH),
        y: 1 + Math.floor(Math.random() * (HuggerRun.HEIGHT - 1)),
      };
    } while (this.contains(this.egg));
  }

  update(dt) {
    if (!this.running) return;
    this.timer += dt;
    if (this.timer < HuggerRun.STEP) return;

    this.timer = 0;
    this.direction = this.next;
    const head = { x: this.body[0].x + this.direction.x, y: this.body[0].y + this.direction.y };
    if (head.x < 0 || head.y < 1 || head.x >= HuggerRun.WIDTH || head.y >= HuggerRun.HEIGHT || this.contains(head)) {
      this.gameOver();
      return;
    }

    this.body.unshift(head);
    if (head.x === this.egg.x && head.y === this.egg.y) {
      this.score += 10;
      this.placeEgg();
      return;
    }

    this.body.pop();
  }

  drawGame(ctx) {
    const cell = SCREEN_W / HuggerRun.WIDTH;
    const box = (at, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(at.x * cell + 1, at.y * cell + 1, cell - 2, cell - 2);
    };

    box(this.egg, '#C8C060');
    for (let i = 0; i < this.body.length; i++) box(this.body[i], i === 0 ? '#E8D8B0' : '#B8A070');
  }
}

/** CMUTrackerReflex: blips pop up on a tracker sweep; click them before they fade. Thirty seconds. */
class TrackerReflex extends ArcadeScreen {
  static LENGTH = 30;
  static LIFE = 1.4;

  constructor(colors) {
    super(colors);
    this.blips = [];
    this.left = 0;
    this.spawn = 0;
    this.sweep = 0;
  }

  start() {
    super.start();
    this.blips = [];
    this.left = TrackerReflex.LENGTH;
    this.spawn = 0;
  }

  update(dt) {
    this.sweep = (this.sweep + dt * 2) % TAU;
    if (!this.running) return;

    this.left -= dt;
    this.status = `${TEXT.time(Math.ceil(this.left))}  ${TEXT.score(this.score)}`;
    if (this.left <= 0) {
      this.gameOver();
      return;
    }

    for (let i = this.blips.length - 1; i >= 0; i--) {
      const blip = this.blips[i];
      if (blip.age + dt > TrackerReflex.LIFE) this.blips.splice(i, 1);
      else blip.age += dt;
    }

    this.spawn -= dt;
    if (this.spawn > 0) return;

    this.spawn = 0.35 + Math.random() * 0.5;
    const angle = Math.random() * TAU;
    const distance = 0.2 + Math.random() * 0.75;
    this.blips.push({ x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, age: 0 });
  }

  click(x, y) {
    if (!this.running) return false;
    const cx = SCREEN_W / 2;
    const cy = SCREEN_H / 2;
    const radius = Math.min(SCREEN_W, SCREEN_H) * 0.45;
    for (let i = this.blips.length - 1; i >= 0; i--) {
      const sx = cx + this.blips[i].x * radius;
      const sy = cy + this.blips[i].y * radius;
      if (Math.hypot(sx - x, sy - y) > 12) continue;
      this.blips.splice(i, 1);
      this.score += 5;
      return true;
    }
    return false;
  }

  drawGame(ctx) {
    const cx = SCREEN_W / 2;
    const cy = SCREEN_H / 2;
    const radius = Math.min(SCREEN_W, SCREEN_H) * 0.45;
    ctx.strokeStyle = this.colors.dim;
    ctx.lineWidth = 1;
    for (const r of [radius, radius * 0.66, radius * 0.33]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.stroke();
    }

    ctx.strokeStyle = this.colors.green;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(this.sweep) * radius, cy + Math.sin(this.sweep) * radius);
    ctx.stroke();

    for (const blip of this.blips) {
      ctx.fillStyle = rgba(this.colors.greenRgb, Math.max(0, 1 - blip.age / TrackerReflex.LIFE));
      ctx.beginPath();
      ctx.arc(cx + blip.x * radius, cy + blip.y * radius, 7, 0, TAU);
      ctx.fill();
    }
  }
}

// The cabinet ---------------------------------------------------------------------------------------------------

/**
 * An arcade cabinet like CMUNetArcade: title, help, the screen, (Hugger Run) the arrow pad, START, and the high scores.
 * @param {'HuggerRun'|'TrackerReflex'} game
 * @param {{phosphor?: string, background?: string}} options
 * @returns {HTMLElement}
 */
export function createArcade(game, options = {}) {
  injectStyle();
  const phosphor = hexToRgb(options.phosphor) ? options.phosphor : DEFAULT_GREEN;
  const background = options.background || '#0A0E12';
  const greenRgb = hexToRgb(phosphor);
  const dim = phosphor.toUpperCase() === DEFAULT_GREEN
    ? DEFAULT_DIM
    : rgba(greenRgb.map((c) => Math.round(c * 0.55)), 1);
  const colors = { green: phosphor, greenRgb, dim };

  const root = el('div', 'emu-arcade');
  root.tabIndex = 0;
  root.style.background = background;
  root.style.color = phosphor;
  root.style.setProperty('--emu-arcade-green', phosphor);
  root.style.setProperty('--emu-arcade-hover', rgba(greenRgb, 0.15));

  const info = GAMES[game];
  if (!info) {
    root.textContent = `Unknown arcade game: ${String(game)}`;
    return root;
  }

  const screen = game === 'HuggerRun' ? new HuggerRun(colors) : new TrackerReflex(colors);
  root.dataset.game = game;

  root.appendChild(el('div', 'emu-arcade-heading', info.title));
  root.appendChild(el('div', 'emu-arcade-help', info.help));

  const canvas = el('canvas', 'emu-arcade-screen');
  const dpr = Math.max(1, Math.min(3, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
  canvas.width = Math.round(SCREEN_W * dpr);
  canvas.height = Math.round(SCREEN_H * dpr);
  const ctx = canvas.getContext('2d');
  root.appendChild(canvas);

  if (screen instanceof HuggerRun) {
    const pad = el('div', 'emu-arcade-row');
    for (const [text, x, y] of [['<', -1, 0], ['^', 0, -1], ['v', 0, 1], ['>', 1, 0]]) {
      const button = el('button', 'emu-arcade-button', text);
      button.type = 'button';
      button.addEventListener('click', () => screen.turn(x, y));
      pad.appendChild(button);
    }
    root.appendChild(pad);
  }

  const startButton = el('button', 'emu-arcade-button', TEXT.start);
  startButton.type = 'button';
  startButton.style.alignSelf = 'flex-start';
  root.appendChild(startButton);
  root.appendChild(el('div', 'emu-arcade-key', TEXT.scores));
  const scoresBox = el('div', 'emu-arcade-scores');
  root.appendChild(scoresBox);

  const showScores = (scores) => {
    scoresBox.replaceChildren();
    if (scores.length === 0) scoresBox.appendChild(el('div', null, TEXT.noScores));
    scores.forEach((s, i) => scoresBox.appendChild(el('div', null, TEXT.line(i + 1, s.name, s.score))));
  };
  showScores(loadScores(game));
  screen.onGameOver = (score) => showScores(submitScore(game, score));

  // Frame loop: runs while the cabinet is on the page, stops when it is removed.
  let frame = 0;
  let last = 0;
  let wasConnected = false;
  let idleFrames = 0;
  const tick = (now) => {
    frame = 0;
    if (root.isConnected) {
      wasConnected = true;
      idleFrames = 0;
    } else if (wasConnected || ++idleFrames > 600) {
      wasConnected = false;
      return;
    }
    // Clamped so a hidden tab does not come back to one giant step.
    const dt = last ? Math.min((now - last) / 1000, 0.25) : 0;
    last = now;
    screen.update(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    screen.draw(ctx);
    frame = requestAnimationFrame(tick);
  };
  const ensureLoop = () => {
    if (frame) return;
    last = 0;
    idleFrames = 0;
    frame = requestAnimationFrame(tick);
  };
  ensureLoop();

  startButton.addEventListener('click', () => {
    screen.start();
    root.focus();
    ensureLoop();
  });

  root.addEventListener('keydown', (event) => {
    if (screen.key(event)) event.preventDefault();
  });

  canvas.addEventListener('pointerdown', (event) => {
    root.focus();
    ensureLoop();
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = (event.clientX - rect.left) * (SCREEN_W / rect.width);
    const y = (event.clientY - rect.top) * (SCREEN_H / rect.height);
    if (screen.click(x, y)) event.preventDefault();
  });

  return root;
}
