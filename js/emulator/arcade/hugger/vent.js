// Stage 3, a port of Arcade/CMUHuggerRun.Vent.cs: a calm crawl down a dark air duct with nothing in it but the
// larva, fans and dripping water, then the larva stops, shudders inside a glowing cocoon and bursts out of its skin
// as a runner with a roar. Space skips it once it has had a moment. Nothing here can kill you.

import {
  HuggerStage, Key, SOUTH, EAST, LARVA, RUNNER, SCREEN_W, SCREEN_H, HUD_HEIGHT, SMOKE, PHOSPHOR, BRIGHT, ACID, GREEN, DIM, BLACK, WHITE,
  BIG_FONT, SMALL_FONT, hash, clamp, fill, circle, ellipse, quad, beam, sprite, centreText,
} from './stage.js';
import { METAL_WALL, PIPES, GRATE, SCRUBBER, PLATING, WALL_TINT, FLOOR_NEAR, PROP_TINT } from './corridor.js';

const DUCT_TOP = 62;
const DUCT_BOTTOM = 166;
const CRAWL_SPEED = 70;
const CRAWL_TIME = 5;
const SLOW_TIME = 1.2;
const SKIP_AFTER = 1;
// the cutscene, in seconds after the larva stops
const SHED = 1.7;
const GROWN = 2.4;
const DONE = 4.2;
const EVOLVE_BONUS = 1000;
const LARVA_SIZE = 40;
const RUNNER_SCALE = 1.4;

const EVOLVE_READY = '/Audio/_RMC14/Xeno/xeno_evolveready.ogg';
const SQUELCH = '/Audio/Effects/Footsteps/meatslap.ogg';
const CRAWL = ['/Audio/_RMC14/Xeno/alien_ventcrawl1.ogg', '/Audio/_RMC14/Xeno/alien_ventcrawl2.ogg'];
const ROARS = [
  '/Audio/_RMC14/Xeno/alien_roar1.ogg', '/Audio/_RMC14/Xeno/alien_roar2.ogg', '/Audio/_RMC14/Xeno/alien_roar3.ogg',
  '/Audio/_RMC14/Xeno/alien_roar4.ogg', '/Audio/_RMC14/Xeno/alien_roar5.ogg', '/Audio/_RMC14/Xeno/alien_roar6.ogg',
];

const DUCT_BACK = '#030E06';
const BACK_TINT = '#3A5A42';
const HUSK = '#5A6A48';

/** Strings from Games/hugger.ftl, stage 3. */
const T = {
  title: 'STAGE 3 - THE VENTS',
  hint: 'CRAWL. GROW.',
  evolved: 'EVOLVED: RUNNER',
  skip: 'SPACE TO SKIP',
};

export class Vent extends HuggerStage {
  get title() { return T.title; }
  get hint() { return T.hint; }

  get sounds() {
    return [EVOLVE_READY, SQUELCH, ...CRAWL, ...ROARS];
  }

  preload() {
    const run = this.run;
    run.frame(LARVA, 'alive', EAST);
    run.frame(LARVA, 'dead');
    run.frame(LARVA, 'dead', EAST, 0, HUSK);
    run.frame(RUNNER, 'alive', EAST);
    run.frame(RUNNER, 'alive', EAST, 0, null);
    run.frame(LARVA, 'alive', EAST, 0, ACID);
  }

  enter() {
    this.time = 0;
    this.scroll = 0;
    this.speed = CRAWL_SPEED;
    this.scene = -1;
    this.crawlSound = 0.4;
    this.shed = false;
    this.rewarded = false;
    this.larvaX = 90;
  }

  onKey(input) {
    if (!input.down || input.key !== Key.Action || this.time < SKIP_AFTER) return;
    this.finish();
  }

  /** Done or skipped: the runner gets its bonus and the run goes on. */
  finish() {
    if (!this.rewarded) {
      this.rewarded = true;
      this.run.addScore(EVOLVE_BONUS);
    }
    this.run.nextStage();
  }

  update(dt) {
    const run = this.run;
    this.time += dt;
    if (this.time > CRAWL_TIME) this.speed = Math.max(0, this.speed - CRAWL_SPEED / SLOW_TIME * dt);
    this.scroll += this.speed * dt;
    run.camera = { x: this.scroll, y: 0 };

    // drips from the duct roof
    if (Math.random() < dt * 3) {
      run.emit({ x: this.scroll + Math.random() * SCREEN_W, y: DUCT_TOP + 4 }, 1, BRIGHT, 0.5, 5, 1.2, 1.4, Math.PI / 2, 0.1, 300,
        { floor: DUCT_BOTTOM - 1 });
    }

    if (this.scene < 0) {
      // walk the larva to the middle as the crawl slows
      this.larvaX = Math.min(160, this.larvaX + (this.time > CRAWL_TIME ? 60 : 0) * dt);
      this.crawlSound -= dt;
      if (this.crawlSound <= 0 && this.speed > 5) {
        this.crawlSound = 1.1 + Math.random() * 0.6;
        run.playAny(CRAWL, -8);
      }
      if (this.time >= CRAWL_TIME + SLOW_TIME && this.larvaX >= 160) {
        this.scene = 0;
        run.play(EVOLVE_READY);
      }
      return;
    }

    this.scene += dt;
    const at = { x: this.scroll + this.larvaX, y: DUCT_BOTTOM - 14 };
    if (this.scene < SHED && Math.random() < dt * 10) run.emit(at, 1, ACID, 0.4, 20, 0.9, 3, -Math.PI / 2, 1.4, -25, { kind: SMOKE });
    if (!this.shed && this.scene >= SHED) {
      this.shed = true;
      run.emit(at, 40, ACID, 1, 220, 1.1, 2.4, -Math.PI / 2, 2.6, 600, { floor: DUCT_BOTTOM - 1, depth: 4, stains: true, acid: true });
      run.emit(at, 12, ACID, 0.4, 40, 1.2, 4, -Math.PI / 2, 2, -20, { kind: SMOKE });
      run.flash(WHITE, 0.6, 0.4);
      run.shake(4.5, 0.5);
      run.play(SQUELCH, -2, 0.8);
      run.playAny(ROARS);
    }
    if (!this.rewarded && this.scene >= GROWN) {
      this.rewarded = true;
      run.bonus(EVOLVE_BONUS, { x: at.x, y: at.y - 60 }, ACID);
    }
    if (this.scene >= DONE) this.finish();
  }

  drawBack(ctx) {
    const run = this.run;
    const clock = run.clock;
    fill(ctx, 0, HUD_HEIGHT, SCREEN_W, SCREEN_H - HUD_HEIGHT, BLACK);
    fill(ctx, 0, DUCT_TOP, SCREEN_W, DUCT_BOTTOM - DUCT_TOP, DUCT_BACK);

    // the far side of the duct: dark wall blocks, now and then a fan or a vent scrubber breathing
    const back = this.scroll * 0.6;
    const wall = run.frame(METAL_WALL, 'full', SOUTH, 0, BACK_TINT);
    const scrubber = run.frame(SCRUBBER, 'on', SOUTH, Math.floor(clock / 0.12), PROP_TINT);
    for (let c = Math.floor(back / 52); c * 52 - back < SCREEN_W; c++) {
      const x = c * 52 - back;
      sprite(ctx, wall, x + 26, DUCT_TOP + 26, 52, 52);
      sprite(ctx, wall, x + 26, DUCT_TOP + 78, 52, 52);
      const kind = hash(c) % 5;
      const cy = (DUCT_TOP + DUCT_BOTTOM) / 2;
      if (kind === 2) {
        sprite(ctx, scrubber, x + 26, cy, 48, 48);
        continue;
      }
      if (kind !== 0) continue;
      const cx = x + 26;
      circle(ctx, cx, cy, 26, BLACK);
      circle(ctx, cx, cy, 26, DIM, 0.7, false);
      const spin = clock * 5 + c;
      for (let blade = 0; blade < 4; blade++) {
        const angle = spin + blade * Math.PI / 2;
        beam(ctx, cx, cy, cx + Math.cos(angle) * 23, cy + Math.sin(angle) * 23, 6, DIM, 0.5);
      }
      circle(ctx, cx, cy, 4, DIM);
    }

    // a pipe run along the top of the duct
    const pipe = run.frame(PIPES, 'intact', EAST, 0, WALL_TINT);
    for (let c = Math.floor(this.scroll / 48); c * 48 - this.scroll < SCREEN_W; c++) sprite(ctx, pipe, c * 48 - this.scroll + 24, DUCT_TOP + 4, 48, 48);

    // roof and floor of deck plating, with grates in the roof where the light falls through
    const roof = run.image(PLATING, WALL_TINT);
    const deck = run.image(PLATING, FLOOR_NEAR);
    const grate = run.frame(GRATE, 'grate', SOUTH, 0, WALL_TINT);
    for (let c = Math.floor(this.scroll / 40) - 1; c * 40 - this.scroll < SCREEN_W + 40; c++) {
      const x = c * 40 - this.scroll;
      const open = hash(c + 7) % 4 === 0;
      sprite(ctx, open ? grate : roof, x + 20, DUCT_TOP - 7, 40, 14);
      sprite(ctx, deck, x + 20, DUCT_BOTTOM + 9, 40, 18);
      if (open) quad(ctx, x + 8, DUCT_TOP, x + 32, DUCT_TOP, x + 52, DUCT_BOTTOM, x - 12, DUCT_BOTTOM, GREEN, 0.05);
    }
    fill(ctx, 0, DUCT_TOP - 1, SCREEN_W, 1, GREEN, 0.6);
    fill(ctx, 0, DUCT_BOTTOM, SCREEN_W, 1.5, GREEN, 0.7);
  }

  drawFront(ctx) {
    const run = this.run;
    const feet = DUCT_BOTTOM;
    const x = this.larvaX;
    if (this.scene < 0) {
      const wriggle = Math.sin(this.time * 14);
      const w = LARVA_SIZE * (1 + 0.08 * wriggle);
      const h = LARVA_SIZE * (1 - 0.08 * wriggle);
      ellipse(ctx, x, feet + 1, 13, 3, BLACK, 0.5);
      sprite(ctx, run.frame(LARVA, 'alive', EAST), x, feet + 3.75 - h / 2, w, h, wriggle * 0.05);
      return;
    }

    const t = this.scene;
    const glow = 0.5 + 0.5 * Math.sin(t * (6 + t * 6));
    if (t < SHED) {
      // shuddering in a glowing cocoon, swelling
      const grow = 1 + 0.35 * t / SHED;
      const jx = (Math.random() - 0.5) * 4 * t;
      const jy = (Math.random() - 0.5) * 2 * t;
      ellipse(ctx, x, feet - 14, 30 * grow, 22 * grow, ACID, 0.08 + 0.18 * glow * t / SHED);
      const size = LARVA_SIZE * grow;
      sprite(ctx, run.frame(LARVA, 'alive', EAST), x + jx, feet - size / 2 + 3.75 + jy, size, size);
      sprite(ctx, run.frame(LARVA, 'alive', EAST, 0, ACID), x + jx, feet - size / 2 + 3.75 + jy, size, size, 0, glow * t / SHED);
      return;
    }

    // the shed skin lies where the larva was, and the runner rises out of it
    sprite(ctx, run.frame(LARVA, 'dead', EAST, 0, HUSK), x - 26, feet - 18, LARVA_SIZE * 1.3, LARVA_SIZE * 1.3);
    const rise = clamp((t - SHED) / (GROWN - SHED), 0, 1);
    const scale = RUNNER_SCALE * (0.55 + 0.45 * rise);
    const box = 64 * scale;
    ellipse(ctx, x + 6, feet + 1, 34 * scale / RUNNER_SCALE, 4, BLACK, 0.5);
    // the runner sprite's feet sit 18 px above the bottom of its 64 px frame; it comes out white-hot and cools
    const y = feet + 18 * scale - box / 2;
    sprite(ctx, run.frame(RUNNER, 'alive', EAST, 0, null), x + 6, y, box, box, 0, 1 - rise);
    sprite(ctx, run.frame(RUNNER, 'alive', EAST), x + 6, y, box, box, 0, rise);
  }

  drawOverlay(ctx) {
    if (this.scene >= GROWN && this.scene < DONE) {
      centreText(ctx, BIG_FONT, T.evolved, SCREEN_W / 2, 28, ACID, clamp((this.scene - GROWN) / 0.3, 0, 1));
    }
    if (this.time >= SKIP_AFTER && this.run.clock % 1.1 < 0.75) centreText(ctx, SMALL_FONT, T.skip, SCREEN_W / 2, 202, BRIGHT);
  }
}

