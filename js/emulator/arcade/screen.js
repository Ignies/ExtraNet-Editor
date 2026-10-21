// The arcade's game screen, a port of CMUArcadeScreen in CMUComputerFunUi.cs: phosphor on black, a score line,
// and a game over when it ends. It plays from the keyboard only: click the screen to take the keys, Space or
// Enter to start, Esc to let go. While it holds the keys they do nothing else on the page (no scrolling).
// Each game (hugger.js, tracker.js) is a subclass that updates, draws and answers keys.

import { playSound } from '../audio.js';

export const SCREEN_W = 320;
export const SCREEN_H = 224;
export const SCREEN_BG = '#020602';
export const FONT = '12px GameSans, "Noto Sans", "Segoe UI", Arial, sans-serif';
export const TAU = Math.PI * 2;

/** The strings every cabinet shares (personal-computers.ftl, Games/common.ftl). */
export const TEXT = {
  scores: 'HIGH SCORES',
  noScores: 'No scores yet. Be the first.',
  score: score => `SCORE ${score}`,
  time: seconds => `TIME ${seconds}`,
  over: score => `GAME OVER - SCORE ${score}`,
  line: (rank, name, score) => `${rank}. ${name} ${score}`,
  focus: 'Click here, then Space to play',
  resume: 'Paused: click here to carry on',
};

/** CMUArcadeKey: what a key means. Arrows, WASD and the numpad's 8, 4, 6 and 2 steer; Space, Enter and numpad 5 act. */
export const Key = { None: 0, Up: 1, Down: 2, Left: 3, Right: 4, Action: 5 };

const KEYS = {
  ArrowUp: [Key.Up, 0], KeyW: [Key.Up, 0],
  ArrowDown: [Key.Down, 0], KeyS: [Key.Down, 0],
  ArrowLeft: [Key.Left, 0], KeyA: [Key.Left, 0],
  ArrowRight: [Key.Right, 0], KeyD: [Key.Right, 0],
  Space: [Key.Action, 0], Enter: [Key.Action, 0], NumpadEnter: [Key.Action, 0],
  Numpad8: [Key.Up, 8], Numpad2: [Key.Down, 2], Numpad4: [Key.Left, 4], Numpad6: [Key.Right, 6], Numpad5: [Key.Action, 5],
  Numpad1: [Key.None, 1], Numpad3: [Key.None, 3], Numpad7: [Key.None, 7], Numpad9: [Key.None, 9],
};

/**
 * What a key code means, as [key, pad]. pad is the digit for the numpad and number row keys (0 otherwise), so a
 * game can use the keypad as a 3 by 3 grid (7 8 9 on top) as well as for steering.
 */
export function mapKey(code) {
  if (KEYS[code]) return KEYS[code];
  const digit = /^Digit([1-9])$/.exec(code);
  return digit ? [Key.None, Number(digit[1])] : [Key.None, 0];
}

/** The physical key code for a key value, for keyboards (some virtual ones) that send no code. */
function codeOf(key) {
  if (key === ' ') return 'Space';
  if (/^[1-9]$/.test(key)) return `Digit${key}`;
  if (/^[wasd]$/i.test(key)) return `Key${key.toUpperCase()}`;
  return key;
}

/** How long a demo waits on its game over screen before it plays again. */
const DEMO_RESTART_MS = 3000;

export class ArcadeScreen {
  /** colors: { green, dim, greenRgb } in the page's phosphor. */
  constructor(colors) {
    this.colors = colors;
    this.running = false;
    this.score = 0;
    this.status = '';
    /** Called with the score when a game ends. */
    this.onGameOver = null;
    this.demoValue = false;
    this.overAt = 0;

    const canvas = document.createElement('canvas');
    canvas.className = 'emu-arcade-screen';
    canvas.tabIndex = 0;
    this.canvas = canvas;
    this.dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width = Math.round(SCREEN_W * this.dpr);
    canvas.height = Math.round(SCREEN_H * this.dpr);
    this.ctx = canvas.getContext('2d');

    canvas.addEventListener('pointerdown', () => { if (!this.demoValue) canvas.focus(); });
    canvas.addEventListener('blur', () => this.onFocusLost());
    canvas.addEventListener('keydown', event => this.#key(event, true));
    canvas.addEventListener('keyup', event => this.#key(event, false));
    this.#loop();
  }

  /** Whether the screen has the keys. */
  get focused() {
    return document.activeElement === this.canvas;
  }

  /**
   * Plays the game by itself, for a "Let's Play" tape or an attract screen: each game's bot presses its keys through
   * demoKey(), the game starts again a moment after it ends, it never takes the keys and never sends a score.
   */
  get demo() {
    return this.demoValue;
  }

  set demo(value) {
    this.demoValue = value;
    this.canvas.tabIndex = value ? -1 : 0;
    this.canvas.style.pointerEvents = value ? 'none' : '';
    if (value) this.release();
  }

  /** Whether the game should run rather than pause: it has the keys, or it plays itself. */
  get playing() {
    return this.demoValue || this.focused;
  }

  /** Called every frame while a demo plays, before the game's own update: the bot looks and presses keys here. */
  demoThink(dt) {}

  /** The demo's bot presses or lets go of a key, exactly as a player would. */
  demoKey(key, down, pad = 0) {
    if (this.demoValue && this.running) this.onKey({ key, pad, down, repeat: false });
  }

  /** How to play, shown above the screen. */
  get help() {
    return '';
  }

  start() {
    this.score = 0;
    this.running = true;
    this.status = '';
    if (!this.demoValue) this.canvas.focus();
  }

  gameOver() {
    this.running = false;
    this.status = TEXT.over(this.score);
    this.overAt = performance.now();
    if (!this.demoValue && this.onGameOver) this.onGameOver(this.score);
  }

  setStatus(status) {
    this.status = status;
  }

  /** Plays a game sound while the screen is on show and the games are not muted. volume is in dB. */
  sound(path, volume = 0, pitch = 1) {
    playSound(path, { volume, pitch, source: this.canvas });
  }

  /** Lets go of the keys. */
  release() {
    this.canvas.blur();
  }

  /** A key went down or up while the screen has the keys: { key, pad, down, repeat }. */
  onKey(input) {}

  /** The keys went elsewhere: let go of anything held. */
  onFocusLost() {}

  /** Advances the game by dt seconds. Runs every frame the screen is on show. */
  update(dt) {}

  /** Draws the game in screen units (320 x 224), over the black and under the score line. */
  drawGame(ctx) {}

  #key(event, down) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'Escape' || event.key === 'Escape') {
      if (down) this.release();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const [key, pad] = mapKey(event.code || codeOf(event.key));
    if (key === Key.None && pad === 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (!this.running && down && !event.repeat && key === Key.Action) {
      this.start();
      return;
    }
    this.onKey({ key, pad, down, repeat: down && event.repeat });
  }

  /** Runs while the screen is on the page, and only plays while it is on show, like a control in a hidden tab. */
  #loop() {
    let last = 0;
    let wasConnected = false;
    let idleFrames = 0;
    const tick = now => {
      if (this.canvas.isConnected) {
        wasConnected = true;
        idleFrames = 0;
      } else if (wasConnected || ++idleFrames > 600) {
        return;
      }
      if (this.canvas.getClientRects().length === 0) {
        last = 0;
      } else {
        // clamped so a screen coming back on show does not take one giant step
        const dt = last ? Math.min((now - last) / 1000, 0.25) : 0;
        last = now;
        if (this.demoValue) {
          // a demo waits on its game over screen for a moment, then plays again
          if (!this.running && now - this.overAt > DEMO_RESTART_MS) this.start();
          else if (this.running) this.demoThink(dt);
        }
        this.update(dt);
        this.draw();
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = SCREEN_BG;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.save();
    this.drawGame(ctx);
    ctx.restore();
    ctx.strokeStyle = this.colors.green;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, SCREEN_W - 1, SCREEN_H - 1);
    ctx.fillStyle = this.colors.green;
    ctx.font = FONT;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(this.status.length > 0 ? this.status : TEXT.score(this.score), 6, 4);
    if (this.demoValue || this.focused) return;

    // without the keys the game cannot hear you, so say how to give them back
    const prompt = this.running ? TEXT.resume : TEXT.focus;
    const width = ctx.measureText(prompt).width;
    const height = 14;
    const x = (SCREEN_W - width) / 2;
    const y = SCREEN_H / 2 - height / 2 + SCREEN_H * 0.32;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(x - 6, y - 3, width + 12, height + 6);
    if ((performance.now() / 1000) % 1.2 < 0.8) {
      ctx.fillStyle = this.colors.green;
      ctx.fillText(prompt, x, y);
    }
  }
}
