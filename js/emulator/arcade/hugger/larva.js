// Stage 2, a port of Arcade/CMUHuggerRun.Larva.cs: the larva wriggles on down the corridor. Marines with bayonets
// close in and stab low in front of them (jump the stab, or get past them before it lands; their legs are no
// obstacle to something this small), closed airlocks leave only a gap at the bottom to duck through, and the
// tracers keep coming, a little less often. After a while a floor vent shows up instead of the next threat: Down
// over it dives in and hands on to the vent crawl, and a vent missed comes round again later.

import {
  CorridorStage, CEILING_Y, FLOOR_Y, PLAYER_X, FLESH, PROP_TINT, OUTLINE, DARK, MID, HIGH, overlap,
} from './corridor.js';
import {
  Outfit, Key, SOUTH, EAST, LARVA, SCREEN_W, ACID, AMBER, ALARM, BLACK, WHITE, DUST, SMOKE, SPARK, TEXT_FONT, SMALL_FONT,
  clamp, fill, circle, ellipse, quad, sprite, centreText,
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
// the airlock's beacon starts this many seconds before the larva would reach it, and the slab drops at this
const AIRLOCK_WARN = 1.3;
const AIRLOCK_DROP = 0.8;
const AIRLOCK_FALL = 2600;
const AirlockPhase = { Raised: 0, Warning: 1, Falling: 2, Jammed: 3, Shut: 4 };
// locker traps in the larva's corridor: more marines, fewer people to run from
const LOCKER_MIX = { marine: 0.5, colonist: 0.2 };
const VENT_WIDTH = 44;
const DIVE_REACH = 24;
const DIVE_TIME = 0.75;
const VENT_BONUS = 500;

const CRY = '/Audio/_RMC14/Xeno/alien_roar_larva1.ogg';
const SQUEAL = '/Audio/_RMC14/Xeno/alien_roar_larva2.ogg';
const STEAM = '/Audio/Effects/extinguish.ogg';
const CLANG = '/Audio/Effects/clang.ogg';
const ALERT = '/Audio/Effects/alert.ogg';
const DROP = '/Audio/Effects/thudswoosh.ogg';
const VENT_IN = '/Audio/_RMC14/Xeno/alien_ventpass1.ogg';
const THUDS = ['/Audio/Effects/metal_thud1.ogg', '/Audio/Effects/metal_thud2.ogg', '/Audio/Effects/metal_thud3.ogg'];
const SPARKS = ['/Audio/Effects/sparks1.ogg', '/Audio/Effects/sparks2.ogg', '/Audio/Effects/sparks3.ogg', '/Audio/Effects/sparks4.ogg'];
const BLAST_DOOR = '/Textures/_RMC14/Structures/Doors/Shutters/Almayer/poddoor.rsi';
const PUMP = '/Textures/_RMC14/Structures/Piping/Atmospherics/vent_pump.rsi';
const DARK_ALARM = '#4A1210';

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
    return [...super.sounds, CRY, SQUEAL, STEAM, CLANG, ALERT, DROP, VENT_IN, ...THUDS, ...SPARKS];
  }

  constructor(run) {
    super(run);
    this.obstacles = [];
  }

  preload() {
    this.run.frame(LARVA, 'alive', EAST);
    this.run.frame(LARVA, 'alive', SOUTH);
    this.run.frame(LARVA, 'dead');
    this.run.frame(BLAST_DOOR, 'closed', SOUTH, 0, PROP_TINT);
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
    this.airlocks = 0;
    this.run.play(SQUEAL, -4, 1.2);
  }

  obstacleAhead() {
    return this.obstacles.some(o => o.x + AIRLOCK_WIDTH - this.scroll >= PLAYER_X - 30);
  }

  /** An airlock or the vent, on the next bare stretch of wall so it never lands on a door or a locker. */
  addObstacle(vent) {
    if (this.obstacles.length >= 3) return;
    const x = this.bareSlot(this.scroll + SCREEN_W + 40) - (vent ? 0 : AIRLOCK_WIDTH / 2);
    this.obstacles.push({
      vent, x, heard: false, phase: AirlockPhase.Raised, bottom: CEILING_Y + 6, speed: 0, timer: 0, first: !vent && this.airlocks++ === 0,
    });
  }

  /** One threat at a time: a knifeman, an airlock or a fleeing colonist, with tracers between; the vent clears the way. */
  spawnThreats(dt) {
    this.nextThreat -= dt;
    this.nextShot -= dt;
    this.nextVent -= dt;
    const busy = this.humanAhead() || this.obstacleAhead() || this.lockerAhead();
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
      else if (this.time > 4 && roll < 0.55) this.spawnLocker(LOCKER_MIX);
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
      if (!overlap(left, right, top, bottom, x, x + AIRLOCK_WIDTH, CEILING_Y, obstacle.bottom)) continue;
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
      if (!obstacle.vent) this.moveAirlock(obstacle, x, dt);
      // steam hisses out from under a closed airlock
      if (!obstacle.vent && obstacle.phase >= AirlockPhase.Jammed && Math.random() < dt * 14) {
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
   * A full airlock: a frame of posts and a lintel with a warning beacon, and the Almayer blast door as its slab. As
   * the larva closes in the beacon flashes, then the slab falls from the lintel and jams just short of the deck,
   * leaving the gap to duck through; once the larva is through it slams the rest of the way in sparks.
   */
  moveAirlock(obstacle, x, dt) {
    const run = this.run;
    obstacle.timer += dt;
    // timed by when the larva will get there, so the drop always lands first
    const eta = (x - PLAYER_X) / Math.max(1, this.speed);
    switch (obstacle.phase) {
      case AirlockPhase.Raised:
        if (eta > AIRLOCK_WARN || x > SCREEN_W + 10) return;
        obstacle.phase = AirlockPhase.Warning;
        obstacle.timer = 0;
        run.play(ALERT, -6, 1.1);
        return;
      case AirlockPhase.Warning:
        if (eta > AIRLOCK_DROP) return;
        obstacle.phase = AirlockPhase.Falling;
        obstacle.speed = 0;
        run.play(DROP, -4, 0.8);
        return;
      case AirlockPhase.Falling:
        obstacle.speed += AIRLOCK_FALL * dt;
        obstacle.bottom = Math.min(FLOOR_Y - AIRLOCK_GAP, obstacle.bottom + obstacle.speed * dt);
        if (obstacle.bottom < FLOOR_Y - AIRLOCK_GAP) return;
        obstacle.phase = AirlockPhase.Jammed;
        this.impact(obstacle, x, 1.2);
        return;
      case AirlockPhase.Jammed:
        // stuck, grinding against something in the track
        if (Math.random() < dt * 6) this.sparks(obstacle, x, 3);
        // only once the larva's whole body is through
        if (x + AIRLOCK_WIDTH >= PLAYER_X - this.halfWidth - 6) return;
        obstacle.phase = AirlockPhase.Shut;
        obstacle.speed = 600;
        return;
      case AirlockPhase.Shut:
        if (obstacle.bottom >= FLOOR_Y) return;
        obstacle.speed += AIRLOCK_FALL * dt;
        obstacle.bottom = Math.min(FLOOR_Y, obstacle.bottom + obstacle.speed * dt);
        if (obstacle.bottom >= FLOOR_Y) this.impact(obstacle, x, 1.6);
        return;
    }
  }

  impact(obstacle, x, strength) {
    const run = this.run;
    run.playAny(THUDS, -1 + strength * 2, 0.9);
    run.play(CLANG, -6, 0.8);
    run.shake(1.5 * strength, 0.2);
    this.sparks(obstacle, x, 10);
    run.emit(this.world(x + AIRLOCK_WIDTH / 2, FLOOR_Y - 2), 6, DUST, 0.5, 60, 0.6, 3, -Math.PI / 2, Math.PI, -10, { kind: SMOKE });
  }

  sparks(obstacle, x, count) {
    const run = this.run;
    for (const side of [x + 1, x + AIRLOCK_WIDTH - 1]) {
      run.emit(this.world(side, obstacle.bottom - 2), count, AMBER, 1, 170, 0.35, 1, -Math.PI / 2, 2.4, 600, { floor: FLOOR_Y + 2, kind: SPARK });
    }
    if (count > 4) run.playAny(SPARKS, -8);
  }

  drawAirlock(ctx, obstacle, x) {
    const run = this.run;
    const clock = run.clock;
    const jitter = obstacle.phase === AirlockPhase.Jammed ? Math.sin(clock * 70) * 0.6 : 0;
    const bottom = obstacle.bottom + jitter;
    const lintel = CEILING_Y + 6;

    // the slab: the blast door sprite stacked up from its bottom edge, the top one cut off at the lintel
    const slab = run.frame(BLAST_DOOR, 'closed', SOUTH, 0, PROP_TINT);
    if (slab && bottom > lintel) {
      for (let y = bottom; y > lintel; y -= AIRLOCK_WIDTH) {
        const visible = Math.min(AIRLOCK_WIDTH, y - lintel);
        const cut = 32 * visible / AIRLOCK_WIDTH;
        ctx.drawImage(slab, 0, 32 - cut, 32, cut, x, y - visible, AIRLOCK_WIDTH, visible);
      }
      fill(ctx, x, bottom - 2, AIRLOCK_WIDTH, 2, OUTLINE);
      fill(ctx, x, lintel, 1, bottom - lintel, HIGH);
    }

    // the frame: two posts striped at the foot and a lintel carrying the beacon
    for (const px of [x - 8, x + AIRLOCK_WIDTH]) {
      fill(ctx, px, CEILING_Y - 6, 8, FLOOR_Y - CEILING_Y + 6, MID);
      fill(ctx, px, CEILING_Y - 6, 1, FLOOR_Y - CEILING_Y + 6, HIGH);
      fill(ctx, px + 7, CEILING_Y - 6, 1, FLOOR_Y - CEILING_Y + 6, OUTLINE);
      for (let k = 0; k < 6; k++) {
        const sy = FLOOR_Y - 8 - k * 8;
        quad(ctx, px + 1, sy, px + 7, sy - 4, px + 7, sy, px + 1, sy + 4, AMBER, 0.55);
      }
    }
    fill(ctx, x - 12, CEILING_Y - 10, AIRLOCK_WIDTH + 24, 16, DARK);
    fill(ctx, x - 12, CEILING_Y - 10, AIRLOCK_WIDTH + 24, 1, HIGH);
    fill(ctx, x - 12, CEILING_Y + 5, AIRLOCK_WIDTH + 24, 1, OUTLINE);
    const alarm = obstacle.phase === AirlockPhase.Warning || obstacle.phase === AirlockPhase.Falling || obstacle.phase === AirlockPhase.Jammed;
    const on = alarm && Math.sin(clock * 22) > 0;
    circle(ctx, x + AIRLOCK_WIDTH / 2, CEILING_Y - 2, 3.5, on ? ALARM : DARK_ALARM);
    if (on) {
      ellipse(ctx, x + AIRLOCK_WIDTH / 2, CEILING_Y + 2, 40, 14, ALARM, 0.12);
      quad(ctx, x - 6, CEILING_Y + 6, x + AIRLOCK_WIDTH + 6, CEILING_Y + 6, x + AIRLOCK_WIDTH + 30, FLOOR_Y, x - 30, FLOOR_Y, ALARM, 0.04);
    }

    // say what to do, big the first time
    if (obstacle.phase === AirlockPhase.Jammed && x > PLAYER_X + 10 && clock % 0.8 < 0.55) {
      const font = obstacle.first ? TEXT_FONT : SMALL_FONT;
      centreText(ctx, font, T.duck, x + AIRLOCK_WIDTH / 2, bottom - (obstacle.first ? 34 : 24), AMBER);
      if (obstacle.first) {
        quad(ctx, x + AIRLOCK_WIDTH / 2 - 6, bottom - 18, x + AIRLOCK_WIDTH / 2 + 6, bottom - 18, x + AIRLOCK_WIDTH / 2, bottom - 9,
          x + AIRLOCK_WIDTH / 2, bottom - 9, AMBER);
      }
    }
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
