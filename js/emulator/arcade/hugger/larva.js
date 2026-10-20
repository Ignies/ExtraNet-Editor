// Stage 2, a port of Arcade/CMUHuggerRun.Larva.cs: the larva wriggles on down the corridor. Marines with bayonets
// close in and stab low in front of them (jump the stab, or get past them before it lands; their legs are no
// obstacle to something this small), closed airlocks leave only a gap at the bottom to duck through, and the
// tracers keep coming, a little less often. After a while a floor vent shows up instead of the next threat: Down
// over it dives in and hands on to the vent crawl, and a vent missed comes round again later.

import {
  CorridorStage, CEILING_Y, FLOOR_Y, PLAYER_X, FLESH, REINFORCED_WALL, WALL_TINT, PROP_TINT, overlap,
} from './corridor.js';
import {
  Outfit, Key, SOUTH, EAST, LARVA, SCREEN_W, ACID, AMBER, ALARM, GREEN, DIM, BLACK, WHITE, SMOKE, TEXT_FONT, SMALL_FONT,
  clamp, fill, outline, circle, ellipse, quad, sprite, centreText,
} from './stage.js';

// the larva's 32 px sprite at 1.25, low to the floor
const SIZE = 40;
const FOOT_PAD = 3.75;
const FIRST_THREAT = 2.5;
const FIRST_VENT = 28;
const VENT_AGAIN = 11;
const FIRE_RATE = 0.7;
// an airlock: a door slab across the corridor with this gap under it, too low for anything not ducking
const AIRLOCK_WIDTH = 40;
const AIRLOCK_GAP = 14;
const VENT_WIDTH = 44;
const DIVE_REACH = 24;
const DIVE_TIME = 0.75;
const VENT_BONUS = 500;

const CRY = '/Audio/_RMC14/Xeno/alien_roar_larva1.ogg';
const SQUEAL = '/Audio/_RMC14/Xeno/alien_roar_larva2.ogg';
const STEAM = '/Audio/Effects/extinguish.ogg';
const CLANG = '/Audio/Effects/clang.ogg';
const VENT_IN = '/Audio/_RMC14/Xeno/alien_ventpass1.ogg';
const SHUTTER = '/Textures/_RMC14/Structures/Doors/Shutters/Almayer/shutter.rsi';
const PUMP = '/Textures/_RMC14/Structures/Piping/Atmospherics/vent_pump.rsi';
/** The shutter is a 32 px sprite at 1.44, its closed slats ending 28 px down. */
const SHUTTER_SIZE = 46;
const SHUTTER_SLATS = 28;

/** Strings from Games/hugger.ftl, stage 2. */
const T = {
  title: 'STAGE 2 - LARVA',
  hint: 'DUCK THE AIRLOCKS, JUMP THE KNIVES',
  stabbed: 'SKEWERED',
  splat: 'SPLAT',
  shot: 'SHOT DOWN',
  dive: 'S',
  duck: 'DUCK',
};

export class Larva extends CorridorStage {
  get halfWidth() { return 13; }
  get height() { return 20; }
  get duckHeight() { return 10; }
  get jumpVelocity() { return 360; }
  get startSpeed() { return 170; }
  get laneLow() { return FLOOR_Y - 6; }
  get laneMid() { return FLOOR_Y - 16; }
  get laneHigh() { return FLOOR_Y - 44; }
  get title() { return T.title; }
  get hint() { return T.hint; }

  get sounds() {
    return [...super.sounds, CRY, SQUEAL, STEAM, CLANG, VENT_IN];
  }

  constructor(run) {
    super(run);
    this.obstacles = [];
  }

  preload() {
    this.run.frame(LARVA, 'alive', EAST);
    this.run.frame(LARVA, 'alive', SOUTH);
    this.run.frame(LARVA, 'dead');
    this.run.frame(SHUTTER, 'closing', SOUTH, 0, PROP_TINT);
    this.run.frame(SHUTTER, 'open', SOUTH, 0, PROP_TINT);
    this.run.frame(SHUTTER, 'closed', SOUTH, 0, PROP_TINT);
    this.run.frame(PUMP, 'on');
  }

  enter() {
    super.enter();
    this.nextThreat = FIRST_THREAT;
    this.nextShot = 2;
    this.nextVent = FIRST_VENT;
    this.dive = -1;
    this.diveX = 0;
    this.obstacles.length = 0;
    this.run.play(SQUEAL, -4, 1.2);
  }

  obstacleAhead() {
    return this.obstacles.some(o => o.x + AIRLOCK_WIDTH - this.scroll >= PLAYER_X - 30);
  }

  addObstacle(vent) {
    if (this.obstacles.length < 3) this.obstacles.push({ vent, x: this.scroll + SCREEN_W + 40, heard: false, slam: -1 });
  }

  /** One threat at a time: a knifeman, an airlock or a fleeing colonist, with tracers between; the vent clears the way. */
  spawnThreats(dt) {
    this.nextThreat -= dt;
    this.nextShot -= dt;
    this.nextVent -= dt;
    const busy = this.humanAhead() || this.obstacleAhead();
    if (this.nextVent <= 0 && !busy && !this.shotsQueued && !this.bulletsAhead()) {
      this.addObstacle(true);
      this.nextVent = VENT_AGAIN;
      this.nextThreat = Math.max(this.nextThreat, 2.5);
      this.nextShot = Math.max(this.nextShot, 2.5);
      return;
    }
    if (busy || this.nextVent <= 0) {
      this.nextShot = Math.max(this.nextShot, 0.7);
      return;
    }
    if (this.nextThreat <= 0 && !this.shotsQueued && !this.bulletsAhead()) {
      const roll = Math.random();
      if (this.time > 6 && roll < 0.35) this.addObstacle(false);
      else if (this.time > 18 && roll < 0.5) this.spawnHuman(Outfit.Rifleman, true);
      else if (roll < 0.62) this.spawnHuman(Outfit.Colonist, false);
      else this.spawnHuman(Outfit.Knifeman, false);
      this.nextThreat = 3.5 + Math.random() * 2.5;
      this.nextShot = Math.max(this.nextShot, 1.4);
      return;
    }
    if (this.nextShot > 0) return;
    this.firePattern();
    this.nextShot = this.fireGap(FIRE_RATE);
  }

  /** Something this small goes between the legs. */
  onTouch(human, head) {}

  onStabbed(human) {
    this.run.playAny(FLESH);
    this.killPlayer({ x: PLAYER_X, y: FLOOR_Y - this.y - 8 }, { x: -0.6, y: 0.8 }, { x: -60, y: 160 }, -8, CRY, T.stabbed, 30);
  }

  onShot(hit, dir) {
    this.shotDown(hit, dir, CRY, T.shot);
  }

  collideStage(left, right, top, bottom) {
    for (const obstacle of this.obstacles) {
      const x = obstacle.x - this.scroll;
      if (obstacle.vent) {
        // Down over the grate dives in
        if (this.grounded && this.run.held(Key.Down) && Math.abs(x - PLAYER_X) < DIVE_REACH) this.startDive(x);
        continue;
      }
      if (!overlap(left, right, top, bottom, x, x + AIRLOCK_WIDTH, CEILING_Y, FLOOR_Y - AIRLOCK_GAP)) continue;
      // smacked into the door face
      this.run.play(CLANG, -2, 1.2);
      this.run.playAny(FLESH);
      this.run.splat({ x: obstacle.x - 2, y: FLOOR_Y - 16 }, 26, ACID, 0.85, 1, true);
      this.killPlayer({ x, y: (top + bottom) / 2 }, { x: -1, y: 0 }, { x: -110, y: 180 }, 10, CRY, T.splat, 30);
      return;
    }
  }

  startDive(x) {
    this.halt();
    this.dive = 0;
    this.diveX = x;
    this.run.bonus(VENT_BONUS, this.world(x, FLOOR_Y - 40), ACID);
    this.run.play(VENT_IN, -2);
    this.run.play(CLANG, -8, 1.4);
  }

  updateStage(dt) {
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obstacle = this.obstacles[i];
      const x = obstacle.x - this.scroll;
      if (x < -AIRLOCK_WIDTH - 40) {
        this.obstacles.splice(i, 1);
        continue;
      }
      if (!obstacle.vent && !obstacle.heard && x < SCREEN_W - 40) {
        obstacle.heard = true;
        this.run.play(STEAM, -10, 0.8);
      }
      // through: the shutter slams down behind the larva
      if (!obstacle.vent && obstacle.slam < 0 && x + AIRLOCK_WIDTH < PLAYER_X - 8) {
        obstacle.slam = 0;
        this.run.play(CLANG, -6, 0.9);
        this.run.shake(1.5, 0.15);
      } else if (obstacle.slam >= 0) {
        obstacle.slam += dt;
      }
      // steam hisses out from under a closed airlock
      if (!obstacle.vent && Math.random() < dt * 14) {
        this.run.emit({ x: obstacle.x + Math.random() * AIRLOCK_WIDTH, y: FLOOR_Y - 4 }, 1, WHITE, 0.25, 40, 0.8, 3,
          Math.random() < 0.5 ? Math.PI : 0, 0.6, -30, { kind: SMOKE });
      }
    }
    if (this.dive < 0 || this.run.over) return;
    this.dive += dt;
    if (this.dive >= DIVE_TIME) this.run.nextStage();
  }

  drawBack(ctx) {
    super.drawBack(ctx);
    for (const obstacle of this.obstacles) if (obstacle.vent) this.drawVent(ctx, obstacle.x - this.scroll);
  }

  drawFront(ctx) {
    super.drawFront(ctx);
    for (const obstacle of this.obstacles) if (!obstacle.vent) this.drawAirlock(ctx, obstacle, obstacle.x - this.scroll);
    if (this.dive < 0) return;
    // down the grate it goes
    const t = clamp(this.dive / DIVE_TIME, 0, 1);
    const size = SIZE * (1 - 0.6 * t);
    sprite(ctx, this.run.frame(LARVA, 'alive', SOUTH), this.diveX, FLOOR_Y - 12 + 22 * t, size, size, 0, 1 - t);
  }

  /** The game's vent pump, laid flat in the deck, with a pulsing arrow and the key to press over it. */
  drawVent(ctx, x) {
    const run = this.run;
    const clock = run.clock;
    const left = x - VENT_WIDTH / 2;
    fill(ctx, left - 2, FLOOR_Y + 1, VENT_WIDTH + 4, 12, BLACK, 0.6);
    sprite(ctx, run.frame(PUMP, 'on', SOUTH, Math.floor(clock / 0.1)), x, FLOOR_Y + 8, VENT_WIDTH + 8, 22);
    const pulse = 0.5 + 0.5 * Math.sin(clock * 8);
    ellipse(ctx, x, FLOOR_Y + 8, VENT_WIDTH * 0.7, 7, ACID, 0.1 + 0.12 * pulse);
    const bob = Math.sin(clock * 6) * 3;
    quad(ctx, x - 7, FLOOR_Y - 40 + bob, x + 7, FLOOR_Y - 40 + bob, x, FLOOR_Y - 30 + bob, x, FLOOR_Y - 30 + bob, ACID, 0.6 + 0.4 * pulse);
    centreText(ctx, TEXT_FONT, T.dive, x, FLOOR_Y - 58 + bob, ACID);
  }

  /**
   * A bulkhead of reinforced wall with the Almayer shutter in it. Coming into view the shutter rolls down through its
   * closing frames and jams just short of the deck; once the larva is through it slams the rest of the way.
   */
  drawAirlock(ctx, obstacle, x) {
    const run = this.run;
    const closing = clamp((230 - x) / 50, 0, 1);
    const slam = obstacle.slam >= 0 ? Math.min(1, obstacle.slam / 0.1) * AIRLOCK_GAP : 0;
    const bottom = FLOOR_Y - AIRLOCK_GAP + slam;
    const top = bottom - SHUTTER_SLATS * SHUTTER_SIZE / 32;
    const centre = x + AIRLOCK_WIDTH / 2;
    const wall = run.frame(REINFORCED_WALL, 'full', SOUTH, 0, WALL_TINT);
    for (let y = top - AIRLOCK_WIDTH; y > CEILING_Y - AIRLOCK_WIDTH * 2; y -= AIRLOCK_WIDTH) {
      sprite(ctx, wall, centre, y + AIRLOCK_WIDTH / 2, AIRLOCK_WIDTH, AIRLOCK_WIDTH);
    }
    const state = closing <= 0 ? 'open' : closing < 1 ? 'closing' : 'closed';
    sprite(ctx, run.frame(SHUTTER, state, SOUTH, Math.floor(closing * 5.99), PROP_TINT), centre, top + SHUTTER_SIZE / 2, AIRLOCK_WIDTH, SHUTTER_SIZE);
    fill(ctx, x - 3, CEILING_Y, 3, FLOOR_Y - CEILING_Y, BLACK, 0.6);
    fill(ctx, x + AIRLOCK_WIDTH, CEILING_Y, 3, FLOOR_Y - CEILING_Y, BLACK, 0.6);
    const blink = run.clock % 0.8 < 0.45;
    circle(ctx, centre, top - 8, 2.5, ALARM, blink ? 1 : 0.25);
    // a hint for the gap while it is coming
    if (x > PLAYER_X + 10 && x < SCREEN_W - 20 && blink && obstacle.slam < 0) centreText(ctx, SMALL_FONT, T.duck, centre, top - 30, AMBER);
  }

  drawPlayer(ctx) {
    if (this.halted) return;
    // a single coiled sprite, made to wriggle: it stretches and squeezes as it goes
    let { w, h } = this.playerSize(SIZE, 0.6);
    const wriggle = Math.sin(this.anim * 16);
    if (this.grounded) {
      w *= 1 + 0.08 * wriggle;
      h *= 1 - 0.08 * wriggle;
    }
    const feet = FLOOR_Y - this.y;
    sprite(ctx, this.run.frame(LARVA, 'alive', EAST), PLAYER_X, feet + FOOT_PAD * h / SIZE - h / 2, w, h,
      this.jumpTilt() + (this.grounded ? wriggle * 0.05 : 0));
  }

  corpseImage(landed) {
    return this.run.frame(LARVA, landed ? 'dead' : 'alive', EAST);
  }

  get corpseSize() {
    return SIZE;
  }
}
