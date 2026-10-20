// Hugger Run's stage contract for the JS port, the counterpart of the CMUHuggerStage base class and the shared
// constants, palette and drawing helpers of Arcade/CMUHuggerRun.cs. Every stage module (facehugger.js, larva.js,
// vent.js, stealth.js, ravager.js) imports from here, never from ../hugger.js (that would be a circular import).
// The framework (../hugger.js) runs the stages; the contract is written up in hugger-stage-contract.md.

export const SCREEN_W = 320;
export const SCREEN_H = 224;
export const HUD_HEIGHT = 16;
/** Stages update in fixed steps of this many seconds. */
export const STEP = 1 / 120;
/** Distance in world units that makes one point in the runner stages. */
export const UNITS_PER_POINT = 12;
export const TAU = Math.PI * 2;

// particle kinds
export const DROP = 0;
export const SPARK = 1;
export const SMOKE = 2;

// RSI directions in sheet order, as RsiDirection
export const SOUTH = 0;
export const NORTH = 1;
export const EAST = 2;
export const WEST = 3;

/** CMUArcadeKey, as screen.js maps it. */
export { Key } from '../screen.js';

/** CMUHuggerOutfit: what a dressed person wears. */
export const Outfit = { Colonist: 0, Rifleman: 1, Knifeman: 2 };

export const SPLATTER = '/Textures/Fluids/splatter.rsi';
export const PARASITE = '/Textures/_RMC14/Mobs/Xenonids/Parasite/parasite.rsi';
export const LARVA = '/Textures/_RMC14/Mobs/Xenonids/Larva/larva.rsi';
export const RUNNER = '/Textures/_RMC14/Mobs/Xenonids/Runner/runner.rsi';
export const RAVAGER = '/Textures/_RMC14/Mobs/Xenonids/Ravager/ravager.rsi';

// UAV-OSD-Sans-Mono at the game's sizes 8, 7, 6 and 16 (points at 96 dpi); it is a wide face
export const TEXT_FONT = '10.67px GameTerminal, Consolas, "Courier New", monospace';
export const SMALL_FONT = '9.33px GameTerminal, Consolas, "Courier New", monospace';
export const SIGN_FONT = '8px GameTerminal, Consolas, "Courier New", monospace';
export const BIG_FONT = '21.33px GameTerminal, Consolas, "Courier New", monospace';
/** The stage card's title size for titles too wide for BIG_FONT. */
export const CARD_FONT = '16px GameTerminal, Consolas, "Courier New", monospace';

/** Sprites are drawn with this multiplied in, so they sit in the green phosphor without losing colour. */
export const PHOSPHOR = '#E2FFE2';
export const BRIGHT = '#A8FFB8';
export const AMBER = '#D8A428';
export const ALARM = '#FF3B30';
export const ACID = '#C6F02A';
export const DARK_ACID = '#6E9410';
export const BLOOD = '#A80E0E';
export const DARK_BLOOD = '#5E0606';
export const TRACER_CORE = '#FFF6CC';
export const TRACER_GLOW = '#FFB43C';
export const DUST = '#7A9C7C';
export const LASER = '#FF2A2A';
export const GREEN = '#3FE05A';
export const DIM = '#1F8A33';
export const WHITE = '#FFFFFF';
export const BLACK = '#000000';

/** The stains a particle or decal can be: each colour gets a tinted set of splatter states. */
export const STAIN_COLOURS = [ACID, DARK_ACID, BLOOD, DARK_BLOOD, WHITE];

/**
 * One stage of the campaign. The framework makes each stage once with new Stage(run), calls enter() every time the
 * stage begins, then update(dt) in fixed steps and the three draw calls every frame until the stage calls
 * run.nextStage(), run.lose(text, colour) or run.win(text). After a loss or win the stage keeps updating (with
 * run.over set) so its ending plays out.
 */
export class HuggerStage {
  constructor(run) {
    this.run = run;
  }

  /** The stage card's title, like 'STAGE 2 - LARVA'. */
  get title() {
    return '';
  }

  /** The line under the title on the card: what to do here. */
  get hint() {
    return '';
  }

  /** Every sound path the stage plays, as full string literals, for the framework to preload. */
  get sounds() {
    return [];
  }

  /** Starts loading sprites with run.frame(...) so they are ready when the stage starts. Called once. */
  preload() {}

  /** Starts the stage from scratch. Effects are already cleared and the camera is at zero. */
  enter() {}

  /** Advances the stage by dt seconds (at most STEP). */
  update(dt) {}

  /** A key went down or up while the stage plays: { key, pad, down, repeat }. Held keys: run.held(key). */
  onKey(input) {}

  /** The keys went elsewhere: let go of anything held. */
  onRelease() {}

  /** The stage is over and the next one is about to enter. */
  exit() {}

  /** The scenery, under the decals. */
  drawBack(ctx) {}

  /** Actors and anything over the decals, under the particles and popups. */
  drawFront(ctx) {}

  /** Over everything but the HUD, unshaken: cutscene text, prompts. */
  drawOverlay(ctx) {}
}

// Helpers ----------------------------------------------------------------------------------------------------------

/** The same integer hash as the C# file, so scenery matches between the game and the emulator. */
export function hash(n) {
  let h = Math.imul(n | 0, 0x9E3779B1) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x85EBCA77) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xC2B2AE3D) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** A steady 0..1 for a spot in the world and a salt. */
export function hash01(n, salt) {
  return (hash((Math.imul(n | 0, 31) + salt) | 0) & 0xFFFF) / 65535;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function moveTowards(value, target, step) {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}

export function normalize(x, y) {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Drawing, in screen units (world point minus run.camera). The framework applies the shake to the world for you.

export function fill(ctx, x, y, w, h, colour, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
}

export function outline(ctx, x, y, w, h, colour, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.globalAlpha = 1;
}

export function line(ctx, x1, y1, x2, y2, colour, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function circle(ctx, x, y, radius, colour, alpha = 1, filled = true) {
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, radius), 0, TAU);
  if (filled) {
    ctx.fillStyle = colour;
    ctx.fill();
  } else {
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function ellipse(ctx, x, y, rx, ry, colour, alpha = 1) {
  if (rx <= 0 || ry <= 0) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** A filled four-sided shape, corners in order round its edge. */
export function quad(ctx, ax, ay, bx, by, cx, cy, dx, dy, colour, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.lineTo(dx, dy);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** A straight bar of some width from one point to another, for tracers and beams. */
export function beam(ctx, x1, y1, x2, y2, width, colour, alpha = 1) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (length < 0.01) return;
  const sx = -(y2 - y1) / length * (width / 2);
  const sy = (x2 - x1) / length * (width / 2);
  quad(ctx, x1 + sx, y1 + sy, x2 + sx, y2 + sy, x2 - sx, y2 - sy, x1 - sx, y1 - sy, colour, alpha);
}

/** Draws an image centred on a point at a size, turned by radians. Does nothing while the image is loading. */
export function sprite(ctx, image, x, y, w, h, radians = 0, alpha = 1) {
  if (!image) return;
  ctx.globalAlpha = alpha;
  if (radians === 0) {
    ctx.drawImage(image, x - w / 2, y - h / 2, w, h);
  } else {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(radians);
    ctx.drawImage(image, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/** Phosphor text from its top left: a dark drop, a soft glow either side, then the letters. */
export function text(ctx, font, str, x, y, colour, alpha = 1) {
  ctx.font = font;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = BLACK;
  ctx.globalAlpha = alpha * 0.8;
  ctx.fillText(str, x + 1, y + 1);
  ctx.fillStyle = colour;
  ctx.globalAlpha = alpha * 0.25;
  ctx.fillText(str, x - 1, y);
  ctx.fillText(str, x + 1, y);
  ctx.globalAlpha = alpha;
  ctx.fillText(str, x, y);
  ctx.globalAlpha = 1;
}

export function centreText(ctx, font, str, x, y, colour, alpha = 1) {
  ctx.font = font;
  text(ctx, font, str, x - ctx.measureText(str).width / 2, y, colour, alpha);
}

export function textWidth(ctx, font, str) {
  ctx.font = font;
  return ctx.measureText(str).width;
}
