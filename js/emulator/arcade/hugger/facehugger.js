// Stage 1, a port of Arcade/CMUHuggerRun.Facehugger.cs: the facehugger runs the corridor, jumping tracers and
// ducking high shots, until a human walks in. A held jump that comes down on the face latches on: the host screams,
// goes over backwards and convulses, a preburst scream, and the chest bursts in a fountain of blood as the larva
// tumbles out, which hands the run to stage 2. Running into a human's legs gets the hugger kicked flat; a tracer
// bursts it.

import { CorridorStage, HumanState, FLOOR_Y, PLAYER_X, HISSES, BODY_FALL } from './corridor.js';
import {
  Outfit, EAST, WEST, PARASITE, LARVA, ACID, BLOOD, DARK_BLOOD, ALARM, WHITE, SMOKE, clamp, lerp, sprite,
} from './stage.js';

// the parasite's 32 px sprite at 1.4: knee-high to a human, with 3 px of air under its feet in the sprite
const SIZE = 44.8;
const FOOT_PAD = 4.2;
/** Feet at least this high when the hugger meets a head: it lands on the face, not the chest. */
const LATCH_HEIGHT = 56;
const FIRST_HUMAN = 12;
const HUMAN_EVERY_MIN = 9;
const HUMAN_EVERY_MAX = 15;
const MARINES_FROM = 30;
const COLONIST_BONUS = 1000;
const MARINE_BONUS = 1500;
// the infection, in seconds from the latch
const PREBURST = 1.7;
const BURST = 2.5;
const HAND_OVER = 3.7;

const POUNCE = '/Audio/_RMC14/Xeno/alien_pounce.ogg';
const DIES = '/Audio/_RMC14/Xeno/alien_parasite_dies.ogg';
const INFECTED_MALE = '/Audio/_RMC14/Voice/Human/infected_male.ogg';
const INFECTED_FEMALE = '/Audio/_RMC14/Voice/Human/infected_female.ogg';
const PUNCHES = ['/Audio/CMU14/PersonalComputers/Games/punch_1.ogg', '/Audio/CMU14/PersonalComputers/Games/punch_2.ogg'];
const CHEST_BURSTS = ['/Audio/_RMC14/Xeno/alien_chestburst.ogg', '/Audio/_RMC14/Xeno/alien_chestburst2.ogg'];
const MALE_PREBURST = [
  '/Audio/_RMC14/Voice/Human/male_preburst1.ogg', '/Audio/_RMC14/Voice/Human/male_preburst2.ogg',
  '/Audio/_RMC14/Voice/Human/male_preburst3.ogg', '/Audio/_RMC14/Voice/Human/male_preburst4.ogg',
  '/Audio/_RMC14/Voice/Human/male_preburst5.ogg', '/Audio/_RMC14/Voice/Human/male_preburst6.ogg',
  '/Audio/_RMC14/Voice/Human/male_preburst7.ogg', '/Audio/_RMC14/Voice/Human/male_preburst8.ogg',
  '/Audio/_RMC14/Voice/Human/male_preburst9.ogg',
];
const FEMALE_PREBURST = [
  '/Audio/_RMC14/Voice/Human/female_preburst1.ogg', '/Audio/_RMC14/Voice/Human/female_preburst2.ogg',
  '/Audio/_RMC14/Voice/Human/female_preburst3.ogg', '/Audio/_RMC14/Voice/Human/female_preburst4.ogg',
  '/Audio/_RMC14/Voice/Human/female_preburst5.ogg', '/Audio/_RMC14/Voice/Human/female_preburst6.ogg',
  '/Audio/_RMC14/Voice/Human/female_preburst7.ogg',
];

/** Strings from Games/hugger.ftl, stage 1. */
const T = {
  title: 'STAGE 1 - FACEHUGGER',
  hint: 'DODGE THE FIRE, LEAP ONTO A FACE',
  kicked: 'KICKED FLAT',
  shot: 'SHOT DOWN',
  burst: 'CHESTBURST!',
};

export class Facehugger extends CorridorStage {
  get title() { return T.title; }
  get hint() { return T.hint; }

  get sounds() {
    return [...super.sounds, POUNCE, DIES, INFECTED_MALE, INFECTED_FEMALE, ...PUNCHES, ...CHEST_BURSTS, ...MALE_PREBURST, ...FEMALE_PREBURST];
  }

  preload() {
    const run = this.run;
    run.frame(PARASITE, 'running', EAST);
    run.frame(PARASITE, 'dead');
    run.frame(PARASITE, 'equipped-MASK', WEST);
    run.frame(PARASITE, 'equipped-MASK', EAST);
    run.frame(LARVA, 'alive', WEST);
  }

  enter() {
    super.enter();
    this.nextShot = 1.4;
    this.nextHuman = FIRST_HUMAN;
    this.host = null;
    this.scene = 0;
    this.preburst = false;
    this.burst = false;
    this.larvaFrom = { x: 0, y: 0 };
  }

  /** Bullets in patterns; a human every so often, and while one is ahead the marines hold their fire. */
  spawnThreats(dt) {
    this.nextShot -= dt;
    this.nextHuman -= dt;
    const blocked = this.humanAhead();
    if (this.nextHuman <= 0 && !blocked && !this.shotsQueued && !this.bulletsAhead()) {
      const marine = this.time >= MARINES_FROM && Math.random() < 0.4;
      if (this.spawnHuman(marine ? Outfit.Rifleman : Outfit.Colonist, Math.random() < 0.3)) this.run.playAny(HISSES, -12, 1.45);
      this.nextHuman = HUMAN_EVERY_MIN + Math.random() * (HUMAN_EVERY_MAX - HUMAN_EVERY_MIN);
      this.nextShot = Math.max(this.nextShot, 1.2);
      return;
    }
    if (blocked) {
      this.nextShot = Math.max(this.nextShot, 0.8);
      return;
    }
    // let the lane clear for the human that is due
    if (this.nextShot > 0 || this.nextHuman <= 0) return;
    this.firePattern();
    this.nextShot = this.fireGap();
  }

  onTouch(human, head) {
    if (head && this.y >= LATCH_HEIGHT) {
      this.infect(human);
      return;
    }
    // ran into the legs: punted down the corridor
    human.state = HumanState.Kick;
    human.timer = 0;
    this.run.playAny(PUNCHES);
    this.run.flash(WHITE, 0.2, 0.12);
    this.killPlayer({ x: PLAYER_X + 8, y: FLOOR_Y - this.y - 12 }, { x: -1, y: -0.4 }, { x: -40, y: 420 }, -14, DIES, T.kicked, 16);
  }

  onShot(hit, dir) {
    this.shotDown(hit, dir, DIES, T.shot);
  }

  /** Came down on a face: the hugger latches on with the game's own infection cry, and the run stops for the scene. */
  infect(human) {
    const run = this.run;
    this.host = human;
    this.scene = 0;
    human.state = HumanState.Latched;
    human.timer = 0;
    human.infected = true;
    human.fall = human.east ? -1 : 1;
    this.halt();
    const face = this.face(human);
    run.bonus(human.outfit === Outfit.Colonist ? COLONIST_BONUS : MARINE_BONUS, this.world(face.x, face.y - 26), ACID);
    run.emit(this.world(face.x, face.y), 14, BLOOD, 1, 130, 0.9, 2, -Math.PI / 2, 2.2, 520, { floor: FLOOR_Y + 1, depth: 14, stains: true });
    run.play(POUNCE);
    run.pend(0.1, human.person.female ? INFECTED_FEMALE : INFECTED_MALE);
    run.flash(WHITE, 0.3, 0.15);
    run.shake(3, 0.3);
    run.slowMotion(0.3);
  }

  updateStage(dt) {
    if (!this.host || this.run.over) return;
    this.scene += dt;
    if (!this.preburst && this.scene >= PREBURST) {
      this.preburst = true;
      this.run.playAny(this.host.person.female ? FEMALE_PREBURST : MALE_PREBURST, -3);
    }
    if (!this.burst && this.scene >= BURST) this.chestBurst();
    if (this.scene >= HAND_OVER) this.run.nextStage();
  }

  /** Where the host's chest is once it lies on its back. */
  chest(host) {
    return { x: host.x - this.scroll + host.fall * 52, y: FLOOR_Y + 2 };
  }

  /** The larva tears its way out of the chest in a fountain of blood. */
  chestBurst() {
    const run = this.run;
    this.burst = true;
    this.larvaFrom = this.chest(this.host);
    const at = this.world(this.larvaFrom.x, this.larvaFrom.y - 6);
    const opts = { floor: FLOOR_Y + 1, depth: 16, stains: true };
    run.emit(at, 60, BLOOD, 1, 300, 1.4, 2.6, -Math.PI / 2, 0.9, 620, opts);
    run.emit(at, 20, DARK_BLOOD, 1, 180, 1.2, 3.4, -Math.PI / 2, 1.4, 620, opts);
    run.emit(at, 8, BLOOD, 0.5, 30, 1, 4, -Math.PI / 2, 1.2, -20, { kind: SMOKE });
    run.splat({ x: at.x, y: FLOOR_Y + 8 }, 60, BLOOD, 0.95);
    run.playAny(CHEST_BURSTS);
    run.play(BODY_FALL, -4, 0.8);
    run.flash(BLOOD, 0.4, 0.35);
    run.shake(5, 0.45);
    run.pop(T.burst, { x: at.x, y: at.y - 40 }, ALARM, 1.2);
  }

  /** The host convulses harder and harder until the burst. */
  twitch(human) {
    if (human !== this.host || this.burst) return super.twitch(human);
    const build = clamp((this.scene - 1.0) / (BURST - 1.0), 0, 1);
    return Math.sin(human.timer * 47) * 0.05 * build + super.twitch(human);
  }

  faceMask(human, direction) {
    // the hugger stays clamped on until the larva is out
    if (!human.infected || (human === this.host && this.burst)) return null;
    const squeeze = human.state === HumanState.Down ? human.timer / 0.25 : human.timer / 0.08;
    return this.run.frame(PARASITE, 'equipped-MASK', direction, Math.floor(squeeze));
  }

  drawPlayer(ctx) {
    if (this.halted) return;
    // the leap keeps the running pose and facing, only tilted: nose up on the way up, down on the way down
    const frame = this.grounded ? Math.floor(this.anim / 0.1) : 2;
    const image = this.run.frame(PARASITE, 'running', EAST, frame);
    const { w, h } = this.playerSize(SIZE);
    const feet = FLOOR_Y - this.y;
    sprite(ctx, image, PLAYER_X, feet + FOOT_PAD * h / SIZE - h / 2, w, h, this.jumpTilt());
  }

  drawFront(ctx) {
    super.drawFront(ctx);
    if (!this.burst || !this.host) return;
    // the larva arcs out of the chest and lands in front of the body
    const t = clamp((this.scene - BURST) / 0.55, 0, 1);
    const toX = this.larvaFrom.x - 34;
    const x = lerp(this.larvaFrom.x, toX, t);
    const y = lerp(this.larvaFrom.y, FLOOR_Y, t) - (Math.sin(t * Math.PI) * 34 + 10);
    sprite(ctx, this.run.frame(LARVA, 'alive', WEST), x, y, 40, 40, (1 - t) * -1.2);
  }

  corpseImage(landed) {
    return landed ? this.run.frame(PARASITE, 'dead') : this.run.frame(PARASITE, 'running', EAST, 2);
  }

  get corpseSize() {
    return SIZE;
  }
}
