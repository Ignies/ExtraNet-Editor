// Boxing: the simulation (CMUSports.Boxing.cs) and its arena (Sports/CMUBoxingArena.cs). Red corner against blue
// under the lights, three rounds, the crowd in the dark. Every pose is worked out from the match time and its
// events, so a late joiner sees the same fight: jabs, crosses, hooks and uppercuts with a wind-up and a recoil,
// heads snapping back, cuts that bleed more each round, teeth on the canvas, the referee's count over a knocked
// down boxer lying in a spreading pool, and the corner men and the ring card between rounds.

import { Sport, Action, BoxingRounds, RoundLength, RoundRest, defineSport, f, range, ev, female, matchName, sportLength } from './core.js';
import {
  Arena, ArenaWidth, ArenaHeight, Bar, Dir, BLOOD, DARK_BLOOD, GOLD, kitCss, rect, frameRect, circle, line, poly, texture,
} from './arena.js';
import { loadRsi, loadStateSheet, stateFrames } from '../../sprites.js';
import { stateCanvas } from './dolls.js';

const T = {
  round: round => `ROUND ${round}`,
  roundClock: (round, clock) => `Round ${round}  ${clock}`,
  landed: count => `Landed: ${count}`,
  ko: 'K.O.!',
  apron: 'COLONY FIGHT NIGHT',
  red: 'RED CORNER',
  blue: 'BLUE CORNER',
  fight: 'FIGHT!',
  hook: 'HOOK!',
  uppercut: 'UPPERCUT!',
  body: 'BODY SHOT!',
  cut: level => (level === 1 ? 'CUT!' : level === 2 ? 'DEEP CUT!' : 'GUSHER!'),
  tooth: 'TOOTH!',
  down: 'DOWN!',
  up: 'BACK UP!',
  break: 'BREAK!',
  cards: 'SCORECARD',
  decision: 'UNANIMOUS DECISION',
};

// ---------------------------------------------------------------- the simulation

/** Punch kinds, in a punch event's extra. */
export const BoxingJab = 0;
export const BoxingCross = 1;
export const BoxingHook = 2;
export const BoxingUppercut = 3;
/** A punch event's value: slipped, landed, or caught on the gloves. */
export const BoxingSlipped = 0;
export const BoxingLanded = 1;
export const BoxingBlocked = 2;
/** A punch event's state when it went to the body rather than the head. */
export const BoxingBody = 1;
/** Special: side loses a tooth. extra: how many they have lost. */
export const BoxingTooth = 1;
/** Special: side ties the other up until the referee breaks them, BoxingClinchLength later. */
export const BoxingClinch = 2;
/** Special at the bell ending a round: side took it, extra and state are the red and blue points. */
export const BoxingCard = 3;
export const BoxingClinchLength = f(1.8);
/** The referee starts counting this long after a boxer goes down, then counts once every step. */
export const BoxingCountDelay = f(0.8);
export const BoxingCountStep = f(0.6);

// what interrupts the punching in a round
const FlashMoment = 0;
const DownMoment = 1;
const ClinchMoment = 2;

/** How long a knockdown stops the fight: the count the boxer beats, getting up, the gloves wiped. */
export function boxingDownLength(count) {
  return f(f(BoxingCountDelay + f(count * BoxingCountStep)) + 1);
}

/** Whether two stretches of a round, each starting a second early, come within half a second. */
function overlaps(a, aLength, b, bLength) {
  return f(a - 1) < f(f(b + bLength) + f(0.5)) && f(b - 1) < f(f(a + aLength) + f(0.5));
}

/** CMUSports.Boxing. Deterministic from the seed and the winner; the same random calls as the C#, in order. */
export function playBoxing(random, winner) {
  const play = { events: [], score: [0, 0], result: '' };
  const events = play.events;
  const loser = 1 - winner;

  // the shape of the fight, drawn up front so every round can plan around it
  const koRoll = random.nextDouble();
  const koPick = random.next(1, BoxingRounds + 1);
  const koTime = range(random, 9, RoundLength - 2);
  const lostRoll = random.nextDouble();
  const lostPick = random.next(1, BoxingRounds + 1);
  const downRoll = random.nextDouble();
  const downPick = random.next(1, BoxingRounds + 1);
  const downTime = range(random, 5, 15);
  const downCount = random.next(3, 9);
  const flashRoll = random.nextDouble();
  const flashPick = random.next(1, BoxingRounds + 1);
  const flashTime = range(random, 4, 12);
  const flashCount = random.next(3, 9);

  const koRound = koRoll < 0.45 ? koPick : 0;
  // the winner only goes down in a fight they end by knockout, so the cards never have to forgive it
  let flashRound = koRound > 0 && flashRoll < 0.3 ? Math.min(flashPick, koRound) : 0;
  if (flashRound === koRound && f(f(flashTime + boxingDownLength(flashCount)) + 2) > koTime) flashRound = 0;
  // the one round the loser takes, if any: the one where they drop the winner
  const lost = flashRound > 0 ? flashRound : lostRoll < 0.4 ? lostPick : 0;
  let downRound = downRoll < 0.4 ? downPick : 0;
  if (downRound === lost && downRound !== koRound) downRound = 0;
  if (downRound > 0 && downRound === koRound && f(f(downTime + boxingDownLength(downCount)) + 2) > koTime) downRound = 0;
  if (downRound > 0 && downRound === flashRound
    && overlaps(flashTime, boxingDownLength(flashCount), downTime, boxingDownLength(downCount))) downRound = 0;

  const cuts = [0, 0];
  const teeth = [0, 0];
  const cards = [0, 0];
  for (let round = 1; round <= BoxingRounds; round++) {
    const start = f(4 + (round - 1) * (RoundLength + RoundRest));
    events.push(ev(start, Action.Bell, 0, round));
    const boss = round === lost ? loser : winner;
    const knockout = round === koRound;
    const end = knockout ? f(koTime - 1) : f(RoundLength);
    const clinchRoll = random.nextDouble();
    const clinchTime = range(random, 3, 19);
    const first = events.length;

    const moments = [];
    if (round === flashRound) moments.push({ time: flashTime, length: boxingDownLength(flashCount), kind: FlashMoment });
    if (round === downRound) moments.push({ time: downTime, length: boxingDownLength(downCount), kind: DownMoment });
    const clinchLength = f(BoxingClinchLength + f(0.4));
    let clinch = clinchRoll < 0.5 && f(f(clinchTime + clinchLength) + 1) < end;
    for (const moment of moments) clinch = clinch && !overlaps(moment.time, moment.length, clinchTime, clinchLength);
    if (clinch) moments.push({ time: clinchTime, length: clinchLength, kind: ClinchMoment });
    moments.sort((a, b) => a.time - b.time);

    let time = f(0.8);
    for (const { time: at, length, kind } of moments) {
      exchanges(random, events, start, time, f(at - f(0.6)), boss);
      time = f(at + length);
      if (kind === ClinchMoment) {
        events.push(ev(f(start + at), Action.Special, 1 - boss, BoxingClinch));
        continue;
      }
      const hurt = kind === FlashMoment ? winner : loser;
      const heavy = random.next(BoxingHook, BoxingUppercut + 1);
      events.push(ev(f(f(start + at) - f(0.3)), Action.Punch, 1 - hurt, BoxingLanded, heavy));
      events.push(ev(f(start + at), Action.Knockdown, hurt, kind === FlashMoment ? flashCount : downCount));
    }

    exchanges(random, events, start, time, end, boss);
    if (knockout) {
      const finisher = random.next(BoxingHook, BoxingUppercut + 1);
      events.push(ev(f(f(start + koTime) - f(0.5)), Action.Punch, winner, BoxingLanded, BoxingCross));
      events.push(ev(f(start + koTime), Action.Punch, winner, BoxingLanded, finisher));
    } else {
      sway(events, first, boss);
    }

    wounds(random, events, first, cuts, teeth);
    if (knockout) {
      events.push(ev(f(f(start + koTime) + f(0.3)), Action.Knockout, loser, round));
      play.result = `KO R${round}`;
      count(play);
      return play;
    }

    // a knockdown costs the round's loser another point
    const points = [9, 9];
    points[boss] = 10;
    if (round === downRound) points[loser]--;
    if (round === flashRound) points[winner]--;
    cards[0] += points[0];
    cards[1] += points[1];
    // just after the bell, so nothing thrown in the last instant shares its time
    events.push(ev(f(f(start + RoundLength) + f(0.1)), Action.Special, boss, BoxingCard, points[0], points[1]));
  }

  play.result = `UD ${cards[winner]}-${cards[loser]}`;
  count(play);
  return play;
}

/** Trades combinations from time until until, seconds into the round. The round's boss leads more and lands more. */
function exchanges(random, events, start, time, until, boss) {
  while (time < until) {
    const side = random.nextDouble() < 0.6 ? boss : 1 - boss;
    const combo = random.next(1, 4);
    const hit = side === boss ? 0.5 : 0.36;
    for (let i = 0; i < combo && time < until; i++) {
      // a combination opens with the jab or the cross and follows with anything but the jab
      const kind = i === 0 ? random.next(BoxingJab, BoxingHook) : random.next(BoxingCross, BoxingUppercut + 1);
      const roll = random.nextDouble();
      const outcome = roll < hit ? BoxingLanded : roll < hit + 0.3 ? BoxingBlocked : BoxingSlipped;
      const body = random.nextDouble() < 0.22 ? BoxingBody : 0;
      events.push(ev(f(start + time), Action.Punch, side, outcome, kind, body));
      time = f(time + (kind === BoxingJab ? f(0.3) : f(0.42)));
    }
    time = f(time + range(random, 0.5, 1.5));
  }
}

/** Makes sure the round's boss landed more than the other, as the cards will say. Uses no randomness. */
function sway(events, first, boss) {
  const landed = [0, 0];
  for (let i = first; i < events.length; i++) {
    const e = events[i];
    if (e.action === Action.Punch && e.value === BoxingLanded) landed[e.side]++;
  }
  for (let i = events.length - 1; i >= first && landed[boss] <= landed[1 - boss]; i--) {
    const e = events[i];
    if (e.action !== Action.Punch || e.side !== boss || e.value === BoxingLanded) continue;
    e.value = BoxingLanded;
    landed[boss]++;
  }
  for (let i = events.length - 1; i >= first && landed[boss] <= landed[1 - boss]; i--) {
    const e = events[i];
    if (e.action !== Action.Punch || e.side === boss || e.value !== BoxingLanded) continue;
    e.value = BoxingSlipped;
    landed[1 - boss]--;
  }
}

/** The damage from a round's landed head shots, in the order thrown: cuts up to 3, and up to two teeth. */
function wounds(random, events, first, cuts, teeth) {
  const total = events.length;
  for (let i = first; i < total; i++) {
    const e = events[i];
    if (e.action !== Action.Punch || e.value !== BoxingLanded || e.state === BoxingBody) continue;
    const hurt = 1 - e.side;
    if (random.nextDouble() < (e.extra === BoxingJab ? 0.02 : 0.07) && cuts[hurt] < 3) {
      cuts[hurt]++;
      events.push(ev(f(e.time + f(0.05)), Action.Injury, hurt, 0, cuts[hurt]));
    }
    if (e.extra < BoxingHook) continue;
    if (random.nextDouble() < 0.06 && teeth[hurt] < 2) {
      teeth[hurt]++;
      events.push(ev(f(e.time + f(0.04)), Action.Special, hurt, BoxingTooth, teeth[hurt]));
    }
  }
}

/** The score is the punches each side landed. */
function count(play) {
  for (const e of play.events) if (e.action === Action.Punch && e.value === BoxingLanded) play.score[e.side]++;
}

// ---------------------------------------------------------------- the arena

// the ring, in arena units: a canvas seen from the front row, back edge narrower than the front
const Feet = 191;
const BoxerY = Feet - 32;
const LyingY = Feet - 9;
const CanvasBack = 124;
const CanvasFront = 206;
const BackLeft = 70;
const BackRight = 450;
const FrontLeft = 26;
const FrontRight = 494;
const BackPost = 46;
const FrontPost = 58;
const Middle = ArenaWidth / 2;

const RefScale = 1.7;
const RefFeet = 177;
const RefY = RefFeet - 16 * RefScale;
const WalkerScale = 1.9;
const WalkerFeet = 186;
const WalkerY = WalkerFeet - 16 * WalkerScale;
const CornerFeet = 200;
const CornerY = CornerFeet - 32;

const RefDoll = 0;
const WalkerDoll = 1;
const BoxerDoll = 2;
const CornerDoll = 4;

/** When the referee has counted ten over a knocked out boxer, from the knockout. */
const Counted = BoxingCountDelay + 9 * BoxingCountStep + 0.3;
const ToothFlight = 0.55;

const Ropes = [0.27, 0.52, 0.77];
const RopeColours = ['#C8102E', '#E8E8EC', '#1F4FC8'];
const Corners = [92, 428];
const Gloves = ['#C8102E', '#2152D6'];
const Plates = ['#FF6B6B', '#6BA8FF'];
const Skin = '#E2B08A';
const Sweat = 'rgba(221,241,255,0.8)';
const Water = 'rgba(159,216,255,0.8)';
const Shadow = 'rgba(0,0,0,0.35)';
const SPLATTER = '/Textures/Fluids/splatter.rsi';
const RowY = [50, 64, 79, 94, 109];
const RefArms = { None: 0, Count: 1, Wave: 2, Break: 3, Raise: 4 };

const PUNCHES = ['/Audio/Weapons/boxingpunch1.ogg', '/Audio/Weapons/boxingpunch2.ogg', '/Audio/Weapons/boxingpunch3.ogg'];
const FLESH = [
  '/Audio/_RMC14/Bullets/impact_flesh_1.ogg', '/Audio/_RMC14/Bullets/impact_flesh_2.ogg',
  '/Audio/_RMC14/Bullets/impact_flesh_3.ogg', '/Audio/_RMC14/Bullets/impact_flesh_4.ogg',
];
const CLAPS = [
  '/Audio/Effects/Emotes/clap1.ogg', '/Audio/Effects/Emotes/clap2.ogg', '/Audio/Effects/Emotes/clap3.ogg',
  '/Audio/Effects/Emotes/clap4.ogg',
];
const GASPS = [
  '/Audio/Effects/Gasp/gasp_male1.ogg', '/Audio/Effects/Gasp/gasp_male2.ogg', '/Audio/Effects/Gasp/gasp_female1.ogg',
  '/Audio/Effects/Gasp/gasp_female2.ogg', '/Audio/Effects/Gasp/gasp_female3.ogg',
];
const WHISTLES = [
  '/Audio/Voice/Human/whistle_1.ogg', '/Audio/Voice/Human/whistle_2.ogg', '/Audio/Voice/Human/whistle_3.ogg',
  '/Audio/Voice/Human/whistle_4.ogg',
];
const TINKS = [
  '/Audio/Weapons/Guns/Casings/casing_fall_1.ogg', '/Audio/Weapons/Guns/Casings/casing_fall_2.ogg',
  '/Audio/Weapons/Guns/Casings/casing_fall_3.ogg',
];
const SPLASHES = ['/Audio/_RMC14/Effects/Water/shallowwading1.ogg', '/Audio/_RMC14/Effects/Water/shallowwading2.ogg'];
const BLEEDING = ['/Audio/Effects/Fluids/blood1.ogg', '/Audio/Effects/Fluids/blood2.ogg'];
const HEAVY = ['/Audio/CMU14/PersonalComputers/Games/punch_1.ogg', '/Audio/CMU14/PersonalComputers/Games/punch_2.ogg'];
const SWOOSHES = [
  '/Audio/CMU14/PersonalComputers/Games/swoosh_1.ogg', '/Audio/CMU14/PersonalComputers/Games/swoosh_2.ogg',
  '/Audio/CMU14/PersonalComputers/Games/swoosh_3.ogg',
];
const SCUFFLES = ['/Audio/CMU14/PersonalComputers/Games/boxing_scuffle_1.ogg', '/Audio/CMU14/PersonalComputers/Games/boxing_scuffle_2.ogg'];
const CHEERS = ['/Audio/CMU14/PersonalComputers/Games/crowd_cheer_1.ogg', '/Audio/CMU14/PersonalComputers/Games/crowd_cheer_2.ogg'];
// the round's opening bell, the bell that ends it, and the one rung over a knockout or the decision
const OPENING_BELL = '/Audio/CMU14/PersonalComputers/Games/boxing_bell_1.ogg';
const CLOSING_BELL = '/Audio/CMU14/PersonalComputers/Games/boxing_bell_2.ogg';
const FINAL_BELL = '/Audio/CMU14/PersonalComputers/Games/boxing_bell_3.ogg';
const SMALL_CHEER = '/Audio/CMU14/PersonalComputers/Games/crowd_cheer_small.ogg';
const FALL = '/Audio/CMU14/PersonalComputers/Games/fall.ogg';
const CRUNCH = '/Audio/_RMC14/Weapons/synthpunch1.ogg';
const THUMP = '/Audio/Effects/soft_thump.ogg';
const THUD = '/Audio/Effects/Footsteps/largethud.ogg';
const CAMERA = '/Audio/Misc/camera_snap.ogg';
const CLAP = '/Audio/Effects/Emotes/clap-single.ogg';
const SOUNDS = [
  ...PUNCHES, ...FLESH, ...CLAPS, ...GASPS, ...WHISTLES, ...TINKS, ...SPLASHES, ...BLEEDING,
  ...HEAVY, ...SWOOSHES, ...SCUFFLES, ...CHEERS,
  OPENING_BELL, CLOSING_BELL, FINAL_BELL, SMALL_CHEER, FALL, CRUNCH, THUMP, THUD, CAMERA, CLAP,
];

const ease = x => {
  x = Math.min(1, Math.max(0, x));
  return x * x * (3 - 2 * x);
};
const mix = (a, b, t) => a + (b - a) * t;
const clampTo = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const vlerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Which way a side faces: red to the right, blue to the left. */
const dirOf = side => (side === 0 ? 1 : -1);
const roundOf = t => clampTo(Math.trunc((t - 4) / (RoundLength + RoundRest)) + 1, 1, BoxingRounds);
const roundStart = round => 4 + (round - 1) * (RoundLength + RoundRest);
const windup = kind => (kind === BoxingJab ? 0.16 : kind === BoxingCross ? 0.22 : 0.28);
const recover = kind => (kind === BoxingJab ? 0.2 : 0.28);
const power = kind => (kind === BoxingJab ? 1 : kind === BoxingCross ? 2 : kind === BoxingHook ? 2.5 : 3);

/** A number from 0 to 1 that is always the same for the same event, for where things land (as the C#'s). */
function hash(index) {
  const h = Math.imul(index, 2654435761 | 0) >>> 0;
  return ((h >>> 16) & 1023) / 1023;
}

/** A point on a boxer's sprite, from its centre, turned with the boxer (degrees, anticlockwise). */
function offset(b, dx, dy) {
  const r = b.rot * Math.PI / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [b.x + dx * c + dy * s, b.y - dx * s + dy * c];
}

function fresh(side) {
  return {
    x: Corners[side], y: BoxerY, rot: 0, facing: side === 0 ? Dir.East : Dir.West, visible: true, down: false,
    arms: true, guard: false, raised: false, handUp: false, punch: -1, lead: false, glove: [0, 0], shoulder: [0, 0], hurt: 0,
  };
}

/** Where a winner's glove is when the referee holds it up. */
const raisedGlove = (b, side) => [b.x + dirOf(side) * 7, b.y - 32];

/** Where the referee hovers while they fight: off to one side, crossing behind them now and then. */
const refSpot = (boxers, t) => clampTo((boxers[0].x + boxers[1].x) / 2 + clampTo(Math.sin(t * 0.21) * 3, -1, 1) * 58, 110, 410);

function rgb(hex, light = 1) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * light)},${Math.round(((n >> 8) & 255) * light)},${Math.round((n & 255) * light)})`;
}

function hexAlpha(hex, alpha) {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** The seats in the stands, worked out once: where each fan sits, how they bob, whether they throw their arms up. */
const SEATS = (() => {
  const seats = [];
  let seed = 12345;
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed >>> 8) / 16777216;
  };
  for (let row = 0; row < RowY.length; row++) {
    const spacing = 10.5 + row * 1.4;
    for (let x = 4 + (row % 2) * spacing / 2; x < ArenaWidth; x += spacing) {
      next();
      next();
      const fx = x + (next() - 0.5) * 2;
      seats.push({ x: fx, row, phase: next(), arms: next() < 0.3 });
    }
  }
  return seats;
})();

// The fans are the game's people: body parts, eyes, hair and clothes in layer order, as Hugger Run builds them.
const FAN_PARTS = '/Textures/Mobs/Species/Human/parts.rsi';
const FAN_EYES = '/Textures/Mobs/Customization/eyes.rsi';
const FAN_HAIR = '/Textures/Mobs/Customization/human_hair.rsi';
const FAN_CLOTHES = '/Textures/_RMC14/Objects/Clothing/';
const FAN_COLOUR_SUIT = '/Textures/Clothing/Uniforms/Jumpsuits/Color/color.rsi';
const FAN_CIVILIAN = [
  'Uniforms/Civilian/blue_jumpsuit.rsi', 'Uniforms/Civilian/brown_utility.rsi', 'Uniforms/Civilian/khaki_workwear.rsi',
  'Uniforms/Civilian/grey_jumpsuit.rsi', 'Uniforms/Civilian/green_utility.rsi', 'Uniforms/Civilian/blue_workwear.rsi',
  'Uniforms/Civilian/lightbrown_jumpsuit.rsi', 'Uniforms/Civilian/doctor.rsi', 'Uniforms/Civilian/emt.rsi',
  'Uniforms/Civilian/red_utility.rsi', 'Uniforms/Civilian/yellow_jumpsuit.rsi', 'Uniforms/Civilian/sanitation.rsi',
  'Uniforms/Civilian/weyamart.rsi', 'Uniforms/Civilian/daily_grind.rsi', 'Uniforms/Civilian/tartarus_mining.rsi',
  'Uniforms/Civilian/scientist_jumpsuit.rsi', 'Uniforms/Civilian/pizza_galaxy.rsi', 'Uniforms/Civilian/white_jumpsuit_alt.rsi',
];
const FAN_MARINE = ['Uniforms/Marine/standard.rsi', 'Uniforms/Marine/engineer.rsi', 'Uniforms/Marine/medic.rsi'];
const FAN_HATS = [
  'Head/Beanies/beanie.rsi', 'Head/Beanies/gray.rsi', 'Head/Beanies/green.rsi', 'Head/Hats/blue_trucker_cap.rsi',
  'Head/Hats/cargo_cap.rsi', 'Head/Hats/bucket.rsi', 'Head/Hats/durag.rsi', 'Head/Hats/pizza_galaxy_cap.rsi',
];
const FAN_MARINE_CAP = 'Head/Hats/cap.rsi';
const FAN_MALE_HAIR = ['crewcut', 'business', 'bedhead', 'buzzcut', 'afro', 'sidecut', 'bald'];
const FAN_FEMALE_HAIR = ['ponytail', 'bob', 'bun', 'longstraightponytail', 'long', 'pixie', 'bobcurl', 'ponytail2'];
const FAN_HAIR_COLOURS = ['#2A1A10', '#5A3A20', '#C89A50', '#1A1A1A', '#8A3A1A', '#D8C078', '#8C8C8C'];
const FAN_EYE_COLOUR = '#2B1A10';
// the corners' jumpsuits, ClothingUniformJumpsuitColorRed and Blue, for the fans who came for one fighter
const FAN_CORNERS = ['#eb0c07', '#52aecc'];
/** Fans are drawn this size per row, back to front, and darker the further back they sit. */
const FAN_SCALE = [0.8, 0.9, 1, 1.1, 1.2];
const FAN_LIGHT = [0.22, 0.29, 0.36, 0.43, 0.5];
const FAN_COLUMNS = 32;

/** The game's human skin tones (HumanTonedSkinColoration.FromUnary), 0 the lightest and 100 the darkest. */
function skinTone(tone) {
  const offset = tone - 20;
  const hue = (offset <= 0 ? 25 - offset : 25) / 360;
  const sat = (offset <= 0 ? 20 : 20 + offset) / 100;
  const val = (offset <= 0 ? 100 : 100 - offset) / 100;
  const i = Math.floor(hue * 6);
  const fr = hue * 6 - i;
  const p = val * (1 - sat);
  const q = val * (1 - fr * sat);
  const u = val * (1 - (1 - fr) * sat);
  const [r, g, b] = [[val, u, p], [q, val, p], [p, val, u], [p, q, val], [u, p, val], [val, p, q]][i % 6];
  const hex = v => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * What the fan in a seat looks like in a match: the same for every client, from the match id and the seat. Returns
 * the layers in drawing order as [rsi, state, tint, arm], and whether they came for the red (0) or blue (1) corner.
 */
function fanLook(matchId, seat) {
  let s = (Math.imul(matchId, 2654435761 | 0) ^ Math.imul(seat + 1, 40503)) >>> 0;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s >>> 8) / 16777216;
  };
  next();
  const female = next() < 0.45;
  const skin = skinTone(next() * 90);
  const outfitRoll = next();
  const outfitPick = next();
  const hairPick = next();
  const hairColourPick = next();
  const hatRoll = next();
  const hatPick = next();
  const pick = (list, x) => list[Math.trunc(x * list.length)];
  const corner = outfitRoll < 0.11 ? 0 : outfitRoll < 0.22 ? 1 : -1;
  const marine = corner < 0 && outfitRoll < 0.36;
  const sex = female ? '_f' : '_m';
  const layers = [
    [FAN_PARTS, `torso${sex}`, skin, false], [FAN_PARTS, `head${sex}`, skin, false], [FAN_EYES, 'eyes', FAN_EYE_COLOUR, false],
    [FAN_PARTS, 'r_arm', skin, true], [FAN_PARTS, 'l_arm', skin, true],
  ];
  if (corner >= 0) layers.push([FAN_COLOUR_SUIT, 'equipped-INNERCLOTHING', FAN_CORNERS[corner], false]);
  else layers.push([FAN_CLOTHES + pick(marine ? FAN_MARINE : FAN_CIVILIAN, outfitPick), 'equipped-INNERCLOTHING', null, false]);
  layers.push([FAN_PARTS, 'l_hand', skin, true], [FAN_PARTS, 'r_hand', skin, true]);
  layers.push([FAN_HAIR, pick(female ? FAN_FEMALE_HAIR : FAN_MALE_HAIR, hairPick), pick(FAN_HAIR_COLOURS, hairColourPick), false]);
  if (marine && hatRoll < 0.5) layers.push([FAN_CLOTHES + FAN_MARINE_CAP, 'equipped-HELMET', null, false]);
  else if (!marine && hatRoll < 0.15) layers.push([FAN_CLOTHES + pick(FAN_HATS, hatPick), 'equipped-HELMET', null, false]);
  return { layers, corner, skin };
}

/** The stands of one match as an atlas: two cells per seat, arms down and arms up, already darkened for its row. */
let fanAtlas = { id: null, canvas: null };
function crowdAtlas(matchId) {
  if (fanAtlas.id === matchId) return fanAtlas.canvas;
  const looks = SEATS.map((_, seat) => fanLook(matchId, seat));
  fanAtlas = { id: matchId, canvas: null, corners: looks.map(look => look.corner) };
  const wanted = new Map();
  for (const look of looks) for (const [rsi, state, tint] of look.layers) wanted.set(`${rsi}|${state}|${tint}`, [rsi, state, tint]);
  const keys = [...wanted.keys()];
  Promise.all(keys.map(key => stateCanvas(...wanted.get(key)))).then(canvases => {
    if (fanAtlas.id !== matchId) return;
    const images = new Map(keys.map((key, i) => [key, canvases[i]]));
    const atlas = document.createElement('canvas');
    atlas.width = FAN_COLUMNS * 32;
    atlas.height = Math.ceil(SEATS.length * 2 / FAN_COLUMNS) * 32;
    const c = atlas.getContext('2d');
    c.imageSmoothingEnabled = false;
    const cell = document.createElement('canvas');
    cell.width = cell.height = 32;
    const cc = cell.getContext('2d', { willReadFrequently: true });
    const dark = document.createElement('canvas');
    dark.width = dark.height = 32;
    const dc = dark.getContext('2d');
    looks.forEach((look, seat) => {
      for (let pose = 0; pose < 2; pose++) {
        cc.clearRect(0, 0, 32, 32);
        for (const [rsi, state, tint, arm] of look.layers) {
          const image = images.get(`${rsi}|${state}|${tint}`);
          if (image && !(arm && pose === 1)) cc.drawImage(image, 0, 0);
        }
        if (pose === 1) {
          // arms thrown up: the sleeves from the shoulders past the head, the hands at the top
          const [r, g, b] = cc.getImageData(16, 15, 1, 1).data;
          cc.fillStyle = `rgb(${r},${g},${b})`;
          cc.fillRect(8, 6, 2, 8);
          cc.fillRect(22, 6, 2, 8);
          cc.fillStyle = look.skin;
          cc.fillRect(8, 4, 2, 2);
          cc.fillRect(22, 4, 2, 2);
        }
        // darker the further back the seat, keeping the outline
        const light = Math.round(FAN_LIGHT[SEATS[seat].row] * 255);
        dc.globalCompositeOperation = 'source-over';
        dc.clearRect(0, 0, 32, 32);
        dc.drawImage(cell, 0, 0);
        dc.globalCompositeOperation = 'multiply';
        dc.fillStyle = `rgb(${light},${light},${light})`;
        dc.fillRect(0, 0, 32, 32);
        dc.globalCompositeOperation = 'destination-in';
        dc.drawImage(cell, 0, 0);
        const index = seat * 2 + pose;
        c.drawImage(dark, (index % FAN_COLUMNS) * 32, Math.trunc(index / FAN_COLUMNS) * 32);
      }
    });
    fanAtlas.canvas = atlas;
  });
  return null;
}

/** The impact star frames of attacks.rsi "punch", loaded once. */
let sparkFrames = null;
let sparkLoading = false;
function loadSpark() {
  if (sparkLoading) return;
  sparkLoading = true;
  (async () => {
    const rsi = await loadRsi('_RMC14/Effects/attacks.rsi');
    const state = rsi.states.get('punch');
    const image = await loadStateSheet(rsi.path, 'punch');
    sparkFrames = stateFrames(rsi, state, image, 0).map(frame => {
      const canvas = document.createElement('canvas');
      canvas.width = rsi.size.x;
      canvas.height = rsi.size.y;
      canvas.getContext('2d').drawImage(image, frame.sx, frame.sy, rsi.size.x, rsi.size.y, 0, 0, rsi.size.x, rsi.size.y);
      return canvas;
    });
  })().catch(e => console.warn(`sportsbook: ${e.message}`));
}

export class BoxingArena extends Arena {
  build(match) {
    // drawing order is depth: the referee and the ring card walker stand behind the boxers, the corner men in front
    this.addDoll('Runner', 6, RefScale);
    this.addDoll('Runner', 3, WalkerScale);
    this.addDoll('Boxer', 0, 2);
    this.addDoll('Boxer', 1, 2);
    this.addDoll('Player', 7, 2);
    this.addDoll('Player', 7, 2);
    this.preload(SOUNDS);
    loadSpark();

    this.boxers = [fresh(0), fresh(1)];
    this.then = [fresh(0), fresh(1)];
    this.next = [fresh(0), fresh(1)];
    this.landed = [0, 0];
    this.cutLevel = [0, 0];
    this.corner = [{}, {}];
    this.sponge = [null, null];
    this.ref = { x: Middle, y: RefY, facing: Dir.South, visible: true };
    this.walker = { visible: false };
    this.refArms = RefArms.None;
    this.refPhase = 0;
    this.refPointing = 1;
    this.refTarget = [0, 0];
    this.sign = 0;
    this.resting = false;
    this.spot = Middle;
    this.hype = 0;
    this.t = -1;
    this.lastT = NaN;
    this.lastReal = performance.now() / 1000;
    // until when, in real seconds, a big or a small cheer is still running, so they never stack
    this.cheering ??= 0;
    this.cheeringSmall ??= 0;
    this.flashes = Array.from({ length: 24 }, () => ({ x: 0, y: 0, born: -9, size: 1 }));
    this.nextFlash = 0;
    this.sleeves = [kitCss(match, 0), kitCss(match, 1)].map(c => rgb(c, 0.75));
    this.index();
  }

  /** Picks out the moments the drawing needs to look up every frame, and where things land. */
  index() {
    this.downs = [];
    this.clinches = [];
    this.cuts = [];
    this.teeth = [];
    this.ko = -1;
    this.cards = [null, null, null];
    if (!this.play) return;
    const events = this.play.events;
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e.action === Action.Knockdown || e.action === Action.Knockout) {
        const away = dirOf(1 - e.side);
        this.fightBase(e.time, this.then);
        const fallen = { ...this.then[e.side] };
        const face = offset(fallen, dirOf(e.side) * 8, -17);
        downPose(fallen, this.then[e.side], 1.5, away, -1);
        const head = offset(fallen, 0, -16);
        const out = e.action === Action.Knockout;
        this.downs.push({ time: e.time, side: e.side, count: out ? -1 : e.value, out, index: i, face, pool: [head[0], Feet - 3] });
        if (out) this.ko = this.downs.length - 1;
      } else if (e.action === Action.Injury) {
        this.cuts.push({ time: e.time, side: e.side, level: e.extra });
      } else if (e.action === Action.Special && e.value === BoxingClinch) {
        this.clinches.push(e.time);
      } else if (e.action === Action.Special && e.value === BoxingCard) {
        this.cards[roundOf(e.time) - 1] = { boss: e.side, red: e.extra, blue: e.state };
      } else if (e.action === Action.Special && e.value === BoxingTooth) {
        this.fightBase(e.time, this.then);
        const from = offset(this.then[e.side], dirOf(e.side) * 8, -15);
        const away = dirOf(1 - e.side);
        const to = [clampTo(from[0] + away * (26 + hash(i) * 36), 44, ArenaWidth - 44), Feet - 6 + hash(i + 7) * 12];
        this.teeth.push({ time: e.time, side: e.side, from, to, index: i });
      }
    }
  }

  // ---------------------------------------------------------------- posing

  updateMatch(match, play, t) {
    const now = performance.now() / 1000;
    const delta = clampTo(now - this.lastReal, 0, 0.1);
    this.lastReal = now;
    if (play == null || this.play == null) t = -1;
    // the first frame, or a replay starting over: nothing has just happened
    if (Number.isNaN(this.lastT) || t < this.lastT - 0.05) this.lastT = t;
    this.t = t;
    this.stage(t, now);
    this.poseDolls();
    this.scoreboard(match, t);
    this.moments(t);
    this.ambience(t, delta);
    this.lastT = t;
  }

  /** Where everyone is at t seconds from kickoff. */
  stage(t, now) {
    this.ref = { x: Middle, y: RefY, facing: Dir.South, visible: true };
    this.walker = { visible: false };
    this.corner = [{ visible: false }, { visible: false }];
    this.sponge = [null, null];
    this.refArms = RefArms.None;
    this.sign = 0;
    this.resting = false;
    if (this.play == null || t < 0) return this.waiting(now);
    if (t < 4) return this.introductions(t);
    const round = roundOf(t);
    const start = roundStart(round);
    const into = t - start;
    if (this.ko >= 0 && t >= this.downs[this.ko].time) return this.knockedOut(t, this.downs[this.ko]);
    if (into >= RoundLength) {
      if (round === BoxingRounds) this.decision(t, start);
      else this.rest(t, round, start, into - RoundLength);
      return;
    }
    this.fight(t);
  }

  /** Before the bell: the boxers shadowbox in their corners while the ring card goes round. */
  waiting(now) {
    for (let side = 0; side < 2; side++) {
      const dir = dirOf(side);
      const b = this.boxers[side] = fresh(side);
      b.x = Corners[side] + dir * 6 + Math.sin(now * 1.3 + side) * 6;
      b.y = BoxerY - Math.abs(Math.sin(now * 6 + side)) * 2;
      // a jab at the air every so often
      const phase = (now + side * 0.7) % 1.6;
      if (phase < 0.36) {
        const reach = Math.sin(phase / 0.36 * Math.PI);
        b.punch = BoxingJab;
        b.lead = true;
        b.shoulder = offset(b, dir * 3, -7);
        b.glove = offset(b, dir * (11 + reach * 13), -9 - reach * 2);
      }
    }
    const lap = now % 14;
    if (lap < 5) this.walk(lap / 5, 1);
    this.spot = Middle;
  }

  /** The first four seconds: out of the corners, touch gloves, back to fighting distance. */
  introductions(t) {
    this.fightBase(4, this.next);
    for (let side = 0; side < 2; side++) {
      const dir = dirOf(side);
      const b = this.boxers[side] = fresh(side);
      const touch = Middle - dir * 17;
      b.x = t < 1.4 ? mix(Corners[side], touch, ease((t - 0.2) / 1.2)) : mix(touch, this.next[side].x, ease((t - 2.1) / 1.3));
      b.y = BoxerY - Math.abs(Math.sin(t * 7 + side)) * 2;
      if (t > 1.3 && t < 2.2) {
        const reach = Math.sin(clampTo((t - 1.3) / 0.9, 0, 1) * Math.PI);
        b.punch = BoxingJab;
        b.lead = true;
        b.shoulder = offset(b, dir * 3, -7);
        b.glove = vlerp(offset(b, dir * 11, -9), [Middle - dir * 3, BoxerY - 9], reach);
      }
    }
    if (t > 1.1 && t < 2.4) this.refArms = RefArms.Break;
    this.spot = Middle;
  }

  /** A round in progress: the exchanges, with clinches and knockdowns laid over them. */
  fight(t) {
    const boxers = this.boxers;
    this.fightBase(t, boxers);
    const [red, blue] = boxers;
    this.ref.x = refSpot(boxers, t);
    this.ref.y = RefY - Math.abs(Math.sin(t * 3));

    for (const clinch of this.clinches) {
      const length = BoxingClinchLength + 0.4;
      const u = t - clinch;
      if (u < 0 || u > length) continue;
      const weight = ease(u / 0.3) * ease((length - u) / 0.4);
      const middle = (red.x + blue.x) / 2;
      const wobble = Math.sin(t * 9) * 3 * weight;
      red.x = mix(red.x, middle - 12, weight);
      blue.x = mix(blue.x, middle + 12, weight);
      red.rot += -6 * weight + wobble;
      blue.rot += 6 * weight + wobble;
      red.arms = blue.arms = weight < 0.5;
      red.punch = blue.punch = -1;
      // the referee steps in and pulls them apart
      const step = ease((u - 0.8) / 0.5) * ease((length - u) / 0.6);
      this.ref.x = mix(this.ref.x, middle, step);
      if (u > 1.1 && u < BoxingClinchLength + 0.2) this.refArms = RefArms.Break;
    }

    for (const down of this.downs) {
      const length = boxingDownLength(down.count);
      const a = t - down.time;
      if (down.out || a < 0 || a > length) continue;
      this.fightBase(down.time, this.then);
      const fallen = down.side;
      const puncher = 1 - fallen;
      const away = dirOf(puncher);
      const leaving = ease((length - a) / 0.8);
      const live = { ...boxers[fallen] };
      const b = boxers[fallen] = { ...this.then[fallen] };
      downPose(b, this.then[fallen], a, away, down.count);
      b.x = mix(live.x, b.x, leaving);
      b.y = mix(live.y, b.y, leaving);
      b.rot = mix(live.rot, b.rot, leaving);
      // the one who dropped them goes to a neutral corner
      const p = boxers[puncher];
      const corner = clampTo(this.then[puncher].x - away * 46, 100, 420);
      p.x = mix(p.x, corner, ease(a / 0.8) * leaving);
      p.punch = -1;
      this.ref.x = mix(this.ref.x, this.then[fallen].x - away * 26, ease(a / 0.6) * leaving);
      this.ref.facing = away > 0 ? Dir.East : Dir.West;
      this.refPointing = away;
      const counting = a - BoxingCountDelay;
      if (counting >= 0 && counting < down.count * BoxingCountStep) {
        this.refArms = RefArms.Count;
        this.refPhase = counting / BoxingCountStep;
      }
    }
    this.spot = (boxers[0].x + boxers[1].x) / 2;
  }

  /** The bell between rounds: corners, water and the sponge, the ring card going round. */
  rest(t, round, start, a) {
    this.resting = true;
    this.fightBase(start + RoundLength, this.then);
    this.fightBase(start + RoundLength + RoundRest, this.next);
    for (let side = 0; side < 2; side++) {
      const dir = dirOf(side);
      const corner = Corners[side];
      const b = this.boxers[side] = fresh(side);
      b.arms = a > 5.3;
      let walking = false;
      if (a < 1.3) {
        b.x = mix(this.then[side].x, corner, ease(a / 1.3));
        walking = a < 1.2;
        if (walking) b.facing = side === 0 ? Dir.West : Dir.East;
      } else if (a > 4.8) {
        b.x = mix(corner, this.next[side].x, ease((a - 4.8) / 1.2));
        walking = true;
      } else {
        b.x = corner;
      }
      b.y = BoxerY - (walking ? Math.abs(Math.sin(t * 9 + side)) * 2 : Math.sin(t * 2 + side) * 0.6);

      // the corner man ducks through the ropes with the sponge, then gets out before the bell
      const enter = ease((a - 0.5) / 0.9);
      const leave = ease((a - 4.2) / 0.9);
      if (a > 0.5 && a < 5.1) {
        const man = this.corner[side];
        man.visible = true;
        man.x = mix(corner - dir * 44, corner + dir * 22, enter * (1 - leave));
        man.y = CornerY - (enter < 1 || leave > 0 ? Math.abs(Math.sin(t * 9)) * 2 : 0);
        // walking in faces the ring; working, or walking back out, faces the corner
        man.facing = (enter < 1) === (side === 0) ? Dir.East : Dir.West;
        if (a > 1.6 && a < 4.0) {
          const dab = Math.sin(((a - 1.6) % 0.8) / 0.8 * Math.PI);
          this.sponge[side] = vlerp([man.x - dir * 8, man.y - 6], offset(b, dir * 6, -17), dab);
        }
      }
    }
    this.ref.x = mix(refSpot(this.then, start + RoundLength), Middle, ease(a / 1.5));
    this.walk((a - 0.6) / 4.4, round + 1);
    this.spot = Middle;
  }

  /** After the last bell: both to the middle, the cards are read, the referee lifts the winner's hand. */
  decision(t, start) {
    const a = t - start - RoundLength;
    this.fightBase(start + RoundLength, this.then);
    const winner = this.match ? this.match.winner : 0;
    const arrive = ease(a / 1.4);
    for (let side = 0; side < 2; side++) {
      const b = this.boxers[side] = fresh(side);
      b.x = mix(this.then[side].x, Middle - dirOf(side) * 30, arrive);
      b.y = BoxerY - (arrive < 1 ? Math.abs(Math.sin(t * 9 + side)) * 2 : 0);
      b.arms = a < 0.8;
      if (arrive >= 1) b.facing = Dir.South;
      if (a > 3 && side === winner) b.handUp = true;
    }
    this.ref.x = mix(refSpot(this.then, start + RoundLength), Middle, arrive);
    if (a > 3) {
      this.refArms = RefArms.Raise;
      this.refTarget = raisedGlove(this.boxers[winner], winner);
    }
    this.spot = Middle;
  }

  /** A knockout and everything after it: the fall, the full count, the winner going wild. */
  knockedOut(t, down) {
    const a = t - down.time;
    this.fightBase(down.time, this.then);
    const loser = down.side;
    const winner = 1 - loser;
    const away = dirOf(winner);
    const l = this.boxers[loser] = { ...this.then[loser] };
    downPose(l, this.then[loser], a, away, -1);

    const w = this.boxers[winner] = { ...this.then[winner] };
    w.punch = -1;
    w.hurt = 0;
    const retreat = clampTo(this.then[winner].x - away * 50, 100, 420);
    w.x = mix(this.then[winner].x, retreat, ease(a / 0.9));
    w.rot = mix(w.rot, 0, ease(a / 0.4));
    w.y = BoxerY - Math.abs(Math.sin(t * 6.5)) * 2;
    if (a > Counted) {
      w.facing = Dir.South;
      w.arms = false;
      if (a > Counted + 2.4) {
        w.handUp = true;
        w.y = BoxerY;
      } else {
        w.raised = true;
        w.y = BoxerY - Math.abs(Math.sin((a - Counted) * 7)) * 7;
      }
    }

    // the referee counts over the body, waves it off, then finds the winner
    const over = this.then[loser].x - away * 26;
    this.ref.facing = away > 0 ? Dir.East : Dir.West;
    this.refPointing = away;
    if (a < Counted + 1.4) {
      this.ref.x = mix(refSpot(this.then, down.time), over, ease(a / 0.6));
      const counting = a - BoxingCountDelay;
      if (counting >= 0 && a < Counted - 0.3) {
        this.refArms = RefArms.Count;
        this.refPhase = counting / BoxingCountStep;
      } else if (a >= Counted - 0.3) {
        this.refArms = RefArms.Wave;
        this.ref.facing = Dir.South;
      }
    } else {
      const beside = w.x + away * 22;
      this.ref.x = mix(over, beside, ease((a - Counted - 1.4) / 1.0));
      this.ref.facing = Dir.South;
      if (w.handUp) {
        this.refArms = RefArms.Raise;
        this.refTarget = raisedGlove(w, winner);
      }
    }

    // the corners rush in: one to the fallen boxer, one to celebrate
    if (a > Counted + 0.6) {
      const rush = ease((a - Counted - 0.6) / 1.2);
      for (let side = 0; side < 2; side++) {
        const man = this.corner[side];
        const target = side === loser ? down.pool[0] - dirOf(side) * 4 : w.x - dirOf(side) * 26;
        const from = Corners[side] - dirOf(side) * 44;
        man.visible = true;
        man.x = mix(from, target, rush);
        man.y = CornerY - (rush < 1 ? Math.abs(Math.sin(t * 9 + side)) * 2 : 0);
        man.facing = side === winner && rush >= 1 ? Dir.South : (rush < 1 ? target : l.x) > man.x ? Dir.East : Dir.West;
      }
    }
    this.spot = mix((this.then[0].x + this.then[1].x) / 2, this.then[loser].x, ease(a / 1.5));
  }

  /**
   * The two boxers trading at t: their footwork around the ring, pushed back by what lands, the punch each is
   * throwing and how the other takes it. Pure in the time, so any moment can be looked up.
   */
  fightBase(t, into) {
    const centre = clampTo(Middle + Math.sin(t * 0.37) * 40 + Math.sin(t * 0.83 + 1) * 14 + this.pressure(t), 128, 392);
    const gap = 54 + Math.sin(t * 1.9) * 4 + Math.sin(t * 0.53) * 5;
    for (let side = 0; side < 2; side++) {
      const b = into[side] = fresh(side);
      b.x = centre - dirOf(side) * gap / 2 + Math.sin(t * 2.7 + side * 2) * 1.5;
      b.y = BoxerY - Math.abs(Math.sin(t * 6.5 + side * 1.7)) * 2;
    }
    if (!this.play) return;
    // how each takes the other's punches first, so the gloves aim at where the head went
    const swing = [-1, -1];
    const events = this.play.events;
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e.time > t + 0.3) break;
      if (e.action !== Action.Punch || t > e.time + 0.7) continue;
      const a = t - e.time;
      if (a >= -windup(e.extra) && a <= recover(e.extra)) swing[e.side] = i;
      react(into[1 - e.side], e, a);
    }
    for (let side = 0; side < 2; side++) {
      if (swing[side] >= 0) swingPunch(into, side, events[swing[side]], t - events[swing[side]].time);
    }
  }

  /** Landed punches push the ring's centre towards the one taking them, so a beating ends on the ropes. */
  pressure(t) {
    if (!this.play) return 0;
    let shift = 0;
    for (const e of this.play.events) {
      if (e.time > t) break;
      if (e.action !== Action.Punch || e.value !== BoxingLanded || t - e.time > 10) continue;
      shift += dirOf(e.side) * (e.extra === BoxingJab ? 5 : 9) * Math.exp(-(t - e.time) / 2.5);
    }
    return clampTo(shift, -70, 70);
  }

  /** The ring card walker crossing at progress 0 to 1, holding up a round. */
  walk(progress, round) {
    if (progress <= 0 || progress >= 1 || round > BoxingRounds) return;
    this.walker = {
      visible: true, x: mix(30, ArenaWidth - 30, progress), y: WalkerY - Math.abs(Math.sin(progress * 40)) * 1.5, facing: Dir.East,
    };
    this.sign = round;
  }

  poseDolls() {
    for (let side = 0; side < 2; side++) {
      const b = this.boxers[side];
      if (b.visible) this.pose(BoxerDoll + side, b.x, b.y, b.facing, b.rot);
      else this.hide(BoxerDoll + side);
      this.poseFigure(CornerDoll + side, this.corner[side]);
    }
    this.poseFigure(RefDoll, this.ref);
    this.poseFigure(WalkerDoll, this.walker);
  }

  poseFigure(doll, figure) {
    if (figure.visible) this.pose(doll, figure.x, figure.y, figure.facing);
    else this.hide(doll);
  }

  // ---------------------------------------------------------------- calls and moments

  /** The broadcast graphics: names, punches landed, the clock, the count, the cards. */
  scoreboard(match, t) {
    this.say(matchName(match, 0), 12, Bar + 4, '#FFFFFF');
    this.say(matchName(match, 1), ArenaWidth - 12, Bar + 4, '#FFFFFF', false, true);
    this.landed = [0, 0];
    this.cutLevel = [0, 0];
    this.hype = 0;
    if (this.play == null || t < 0) {
      this.say(T.red, 12, Bar + 15, Plates[0]);
      this.say(T.blue, ArenaWidth - 12, Bar + 15, Plates[1], false, true);
      this.hype = 0.1;
      return;
    }

    for (const e of this.play.events) {
      if (e.time > t) break;
      let weight = 0;
      if (e.action === Action.Punch && e.value === BoxingLanded) {
        this.landed[e.side]++;
        weight = e.extra === BoxingJab ? 0.05 : e.extra === BoxingCross ? 0.12 : 0.3;
      } else if (e.action === Action.Injury) {
        this.cutLevel[e.side] = e.extra;
        weight = 0.3;
      } else if (e.action === Action.Knockdown) {
        weight = 1.4;
      } else if (e.action === Action.Knockout) {
        // the place stays on its feet for the rest of the night
        this.hype = Math.max(this.hype, 1.3);
        weight = 1.5;
      } else if (e.action === Action.Bell) {
        weight = 0.25;
      } else if (e.action === Action.Special) {
        weight = e.value === BoxingTooth ? 0.6 : e.value === BoxingCard ? 0.4 : 0.1;
      }
      if (weight > 0 && t - e.time < 12) this.hype += weight * Math.exp(-(t - e.time) / 2.5);
    }
    this.hype = Math.min(this.hype, 1.6);
    if (t >= sportLength(Sport.Boxing) - 6 && this.ko < 0) this.hype = Math.max(this.hype, 0.9);

    this.say(T.landed(this.landed[0]), 12, Bar + 15, Plates[0]);
    this.say(T.landed(this.landed[1]), ArenaWidth - 12, Bar + 15, Plates[1], false, true);
    if (t < 4) {
      this.say(T.round(1), Middle, 92, '#FFFFFF', true);
      return;
    }

    const round = roundOf(t);
    const into = t - roundStart(round);
    let shown = Math.min(into, RoundLength);
    if (this.ko >= 0 && t >= this.downs[this.ko].time) shown = this.downs[this.ko].time - roundStart(roundOf(this.downs[this.ko].time));
    if (t < sportLength(Sport.Boxing)) {
      const s = Math.trunc(shown);
      this.clock = T.roundClock(round, `${Math.trunc(s / 60)}:${String(s % 60).padStart(2, '0')}`);
    }

    // the referee's count, big over the one on the canvas
    for (const down of this.downs) {
      const a = t - down.time;
      const counting = a - BoxingCountDelay;
      if (counting < 0) continue;
      const count = Math.trunc(counting / BoxingCountStep) + 1;
      if (down.out) {
        if (a >= Counted) this.say(T.ko, Middle, 92, '#FF2A2A', true);
        else this.say(String(Math.min(count, 10)), down.pool[0], 92, '#FFFFFF', true);
        continue;
      }
      if (count <= down.count) this.say(String(count), down.pool[0], 92, '#FFFFFF', true);
      else if (a < boxingDownLength(down.count)) this.say(T.up, down.pool[0], 92, '#FFE14D', true);
    }

    for (const clinch of this.clinches) {
      const u = t - clinch;
      if (u > 1.1 && u < BoxingClinchLength + 0.2) this.say(T.break, this.ref.x, 98, '#FFFFFF', true);
    }

    if (into >= RoundLength && (this.ko < 0 || t < this.downs[this.ko].time)) {
      const rest = into - RoundLength;
      if (round === BoxingRounds) {
        if (rest > 1.5) this.say(T.decision, Middle, 116, GOLD, true);
      } else if (rest > 4.5) {
        this.say(T.round(round + 1), Middle, 92, '#FFFFFF', true);
      }
    }
  }

  /** Whether a moment passed between the last frame and this one, recently enough to make a noise for. */
  crossed(at) {
    return this.lastT < at && at <= this.t && this.t - at < 0.5;
  }

  /** Sounds and bursts for moments between events: the count, a tooth landing, hands raised, the sponge. */
  moments(t) {
    if (this.play == null || t < 0) return;
    if (this.crossed(1.7)) this.sound(PUNCHES[0], -10, 1.2);
    for (const down of this.downs) {
      const counts = down.out ? 10 : down.count;
      for (let count = 0; count < counts; count++) {
        if (!this.crossed(down.time + BoxingCountDelay + count * BoxingCountStep)) continue;
        // the crowd claps along with the count
        this.sound(CLAP, -2 + count * 0.4);
        if (down.out && count === 9) {
          this.sound(FINAL_BELL, 2);
          this.roar(0);
        }
      }
      if (!down.out && this.crossed(down.time + BoxingCountDelay + (down.count - 1) * BoxingCountStep + 0.85)) {
        this.soundAny(CLAPS, -4);
        this.cameraFlashes(3);
      }
      if (down.out && this.crossed(down.time + Counted + 2.4)) {
        this.roar(0);
        this.confetti();
      }
    }
    for (const tooth of this.teeth) if (this.crossed(tooth.time + ToothFlight)) this.soundAny(TINKS, -6);
    const decided = roundStart(BoxingRounds) + RoundLength + 3;
    if (this.ko < 0 && this.crossed(decided)) {
      this.sound(FINAL_BELL, 0);
      this.roar(1);
      this.confetti();
    }
    if (!this.resting) return;
    // the sponge squeezed over each face, halfway through every dab
    const bell = roundStart(roundOf(t)) + RoundLength;
    for (let dab = 0; dab < 3; dab++) {
      if (!this.crossed(bell + 2 + dab * 0.8)) continue;
      for (let side = 0; side < 2; side++) {
        const [x, y] = offset(this.boxers[side], dirOf(side) * 6, -17);
        this.burst(x, y, 7, Water, 60, { life: 0.5, size: 1.4, direction: -Math.PI / 2, spread: Math.PI, gravity: 300 });
      }
      this.soundAny(SPLASHES, -12);
    }
  }

  /** The crowd's noise and lights, and cuts dripping while the fight goes on. */
  ambience(t, delta) {
    const flashes = 0.3 + this.hype * 3.5;
    if (this.fxFloat() < flashes * delta) this.cameraFlashes(1, this.fxFloat() < 0.15);
    if (this.fxFloat() < (0.08 + this.hype * 0.5) * delta) this.soundAny(CLAPS, -16 + this.hype * 6);
    if (this.play == null || t < 4 || this.resting) return;
    for (let side = 0; side < 2; side++) {
      const b = this.boxers[side];
      const level = this.cutLevel[side];
      if (level === 0 || !b.visible || b.down || this.fxFloat() >= level * 0.4 * delta) continue;
      const [x, y] = offset(b, dirOf(side) * 5, -19);
      this.burst(x, y, 1, BLOOD, 14, {
        life: 1.4, size: 1.7, direction: Math.PI / 2, spread: 0.8, gravity: 320, floor: Feet - 3 + this.fxFloat() * 8, stains: true,
      });
    }
  }

  onEvent(match, e, index, live) {
    if (!this.play) return;
    if (e.action === Action.Bell) {
      this.sound(OPENING_BELL);
      this.soundAny(CLAPS, -8);
      this.pop(e.value === 1 ? T.fight : T.round(e.value), Middle, 96, '#FFFFFF', true, 1.2, 12);
      this.cameraFlashes(4);
    } else if (e.action === Action.Punch) {
      this.punched(e, index, live);
    } else if (e.action === Action.Knockdown || e.action === Action.Knockout) {
      this.dropped(match, e, index);
    } else if (e.action === Action.Injury) {
      this.cut(match, e);
    } else if (e.action === Action.Special && e.value === BoxingTooth) {
      this.toothOut(match, e, index);
    } else if (e.action === Action.Special && e.value === BoxingClinch) {
      this.sound(SCUFFLES[index % SCUFFLES.length], -3);
    } else if (e.action === Action.Special && e.value === BoxingCard) {
      this.sound(CLOSING_BELL);
      this.soundAny(CLAPS, -5);
      this.cameraFlashes(3);
    }
  }

  punched(e, index, live) {
    this.fightBase(e.time, this.then);
    const hurt = 1 - e.side;
    const d = this.then[hurt];
    const dir = dirOf(e.side);
    const kind = e.extra;
    const strength = kind === BoxingJab ? 1 : kind === BoxingCross ? 2 : 3;
    // jabs and glove taps are the gloved slaps, the heavier shots the meaty punches
    const punch = PUNCHES[index % PUNCHES.length];
    const heavy = HEAVY[index % HEAVY.length];
    if (e.value === BoxingLanded && e.state === BoxingBody) {
      const [x, y] = offset(d, -dir * 7, 2);
      this.sound(heavy, -1, 0.85);
      this.sound(THUMP, -3 + strength);
      this.burst(x, y, 5 + strength * 2, Sweat, 90, { life: 0.4, size: 1.3, direction: dir > 0 ? 0 : Math.PI, spread: 1.4, gravity: 350 });
      if (strength >= 3) {
        // the wind knocked out of them, and a little spit with it
        const [mx, my] = offset(d, -dir * 7, -15);
        this.burst(mx, my, 4, 'rgba(255,255,255,0.9)', 70, {
          life: 0.5, size: 1.4, direction: dir > 0 ? -0.3 : Math.PI + 0.3, spread: 0.8, gravity: 300,
        });
        const [px, py] = offset(d, 0, -34);
        this.pop(T.body, px, py, '#FFD24D');
        this.shake(1.2, 0.18);
      }
    } else if (e.value === BoxingLanded) {
      const [x, y] = offset(d, -dir * 8, -17);
      const cut = this.cutAt(hurt, e.time);
      if (strength >= 2 || cut > 0) {
        this.splat(x + dir * (4 + this.fxFloat() * 12), Feet - 5 + this.fxFloat() * 10, 3 + strength * 1.5 + cut * 2);
      }
      if (!live) return;
      if (strength === 1) this.sound(punch, -2, 1.05);
      else this.sound(heavy, strength - 3, 1.06 - strength * 0.04);
      if (strength >= 3) this.soundAny(FLESH, -7);
      if (this.flurry(index)) this.cheer();
      if (kind === BoxingUppercut) this.sound(CRUNCH, -6);
      const angle = kind === BoxingUppercut ? -Math.PI / 2 + dir * 0.5 : dir > 0 ? -0.45 : Math.PI + 0.45;
      this.burst(x, y, strength + cut, BLOOD, 90 + strength * 25, {
        life: 1.3, size: 2 + strength * 0.3, direction: angle, spread: 1.0, gravity: 420, floor: Feet - 4 + this.fxFloat() * 10, stains: true,
      });
      this.burst(x, y, 5 + strength * 4 + cut * 3, 'rgba(158,11,11,0.8)', 140, { life: 0.3, size: 1.3, direction: angle, spread: 1.4, drag: 5 });
      this.burst(x, y, 6 + strength * 2, Sweat, 110, { life: 0.45, size: 1.3, direction: angle, spread: 1.6, gravity: 350 });
      if (strength >= 3) {
        this.shake(2.4, 0.25);
        const [px, py] = offset(d, 0, -36);
        this.pop(kind === BoxingHook ? T.hook : T.uppercut, px, py, '#FFE14D');
        this.cameraFlashes(2 + Math.floor(this.fxFloat() * 3));
      } else if (strength === 2) {
        this.shake(1.1, 0.15);
      }
    } else if (e.value === BoxingBlocked) {
      this.sound(punch, -9, 1.35);
      const [x, y] = offset(d, -dir * 11, -9);
      this.burst(x, y, 4, Sweat, 60, { life: 0.3, size: 1.2, direction: dir > 0 ? 0 : Math.PI, spread: 2.4, gravity: 250 });
    } else {
      this.soundAny(SWOOSHES, -4, 0.1);
    }
  }

  dropped(match, e, index) {
    const down = this.downs.find(d => d.index === index);
    const out = e.action === Action.Knockout;
    const away = dirOf(1 - e.side);
    // where the face hits the canvas, and the spray on the way down
    this.splat(down.pool[0], down.pool[1], out ? 16 : 11);
    this.splat(down.pool[0] + away * 9, down.pool[1] + 2, 6);
    this.splat(down.face[0] + away * 4, Feet - 2, 5);
    if (!this.live) return;
    this.sound(FALL, out ? 2 : 0);
    this.sound(THUD, out ? -4 : -7, 0.9);
    this.sound(GASPS[index % GASPS.length], -3);
    this.sound(GASPS[(index + 2) % GASPS.length], -5, 0.9);
    this.soundAny(CLAPS, -4);
    this.bleed(down.face[0], down.face[1], Feet - 2, out ? 3 : 2, away > 0 ? -0.5 : Math.PI + 0.5, 1.2);
    this.burst(down.pool[0], Feet - 2, 14, 'rgba(232,228,220,0.67)', 60, {
      life: 0.6, size: 2.5, direction: -Math.PI / 2, spread: Math.PI, gravity: -20, drag: 3,
    });
    this.shake(out ? 8 : 5, out ? 0.7 : 0.5);
    this.flash(`rgba(255,255,255,${out ? 0.45 : 0.3})`, out ? 0.4 : 0.25);
    this.cameraFlashes(out ? 10 : 6, true);
    if (out) {
      this.scream(this.female(match, e.side));
      this.soundAny(WHISTLES, -6);
    } else {
      this.cheer();
      this.pop(T.down, down.pool[0], 112, '#FF4040', true, 1.2, 10);
    }
  }

  cut(match, e) {
    this.fightBase(e.time, this.then);
    const b = this.then[e.side];
    const [x, y] = offset(b, dirOf(e.side) * 5, -19);
    const away = dirOf(1 - e.side);
    this.splat(x + away * this.fxFloat() * 10, Feet - 4 + this.fxFloat() * 8, 5 + e.extra * 3);
    if (!this.live) return;
    this.burst(x, y, 3 + e.extra * 3, BLOOD, 70 + e.extra * 20, {
      life: 1.2, size: 2.2, direction: away > 0 ? -0.6 : Math.PI + 0.6, spread: 1.2, gravity: 420, floor: Feet - 4 + this.fxFloat() * 8, stains: true,
    });
    this.soundAny(BLEEDING, -4);
    const [px, py] = offset(b, 0, -44);
    this.pop(T.cut(e.extra), px, py, '#FF3B3B');
    if (e.extra >= 3) this.scream(this.female(match, e.side), -3);
  }

  toothOut(match, e, index) {
    const tooth = this.teeth.find(x => x.index === index);
    this.splat(tooth.to[0], tooth.to[1] + 1, 4);
    if (!this.live) return;
    this.sound(CRUNCH, -2, 1.2);
    this.scream(this.female(match, e.side), -2);
    this.burst(tooth.from[0], tooth.from[1], 8, BLOOD, 100, {
      life: 0.9, size: 1.8, direction: dirOf(1 - e.side) > 0 ? -0.7 : Math.PI + 0.7, spread: 0.9, gravity: 420, floor: Feet - 2, stains: true,
    });
    this.pop(T.tooth, tooth.from[0], tooth.from[1] - 26, '#FFFFFF', false, 1.1);
  }

  /** The whole place on its feet: one of the big cheers, which runs its course rather than stacking. */
  roar(cheer) {
    this.soundAny(WHISTLES, -4);
    this.cameraFlashes(6, true);
    const now = performance.now() / 1000;
    if (!this.live || now < this.cheering) return;
    this.sound(CHEERS[cheer % CHEERS.length], -1);
    this.cheering = this.cheeringSmall = now + 13;
  }

  /** A short cheer for a knockdown or a flurry, when no other cheer is running. */
  cheer() {
    const now = performance.now() / 1000;
    if (!this.live || now < this.cheeringSmall) return;
    this.sound(SMALL_CHEER, -5);
    this.cheeringSmall = now + 3.5;
  }

  /** Whether this landed punch is the third in a row from the same side inside a second and a half. */
  flurry(index) {
    const events = this.play.events;
    const e = events[index];
    let landed = 0;
    for (let i = index; i >= 0 && e.time - events[i].time < 1.5; i--) {
      const other = events[i];
      if (other.action !== Action.Punch || other.value !== BoxingLanded) continue;
      if (other.side !== e.side) return false;
      landed++;
    }
    return landed === 3;
  }

  confetti() {
    const colours = [Gloves[0], Gloves[1], GOLD, '#FFFFFF'];
    for (let i = 0; i < 4; i++) {
      this.burst(Middle - 120 + i * 80, Bar + 6, 26, colours[i], 120, { life: 2.6, size: 2.2, direction: Math.PI / 2, spread: 2.4, gravity: 50, drag: 0.8 });
    }
  }

  /** Camera flashes going off in the stands, staggered over the next moment. */
  cameraFlashes(count, snap = false) {
    if (!this.live) return;
    const now = performance.now() / 1000;
    for (let i = 0; i < count; i++) {
      const flash = this.flashes[this.nextFlash];
      this.nextFlash = (this.nextFlash + 1) % this.flashes.length;
      flash.x = 6 + this.fxFloat() * (ArenaWidth - 12);
      flash.y = RowY[Math.floor(this.fxFloat() * RowY.length)] - 2 + this.fxFloat() * 6;
      flash.born = now + (i === 0 ? 0 : this.fxFloat() * 0.5);
      flash.size = 0.6 + this.fxFloat();
    }
    if (snap) this.sound(CAMERA, -12, 0.9 + this.fxFloat() * 0.2);
  }

  female(match, side) {
    return side < match.entrants.length && female(match.sport, match.entrants[side]);
  }

  /** The worst cut a side has at a time. */
  cutAt(side, t) {
    let level = 0;
    for (const cut of this.cuts) if (cut.side === side && cut.time <= t) level = Math.max(level, cut.level);
    return level;
  }

  // ---------------------------------------------------------------- drawing

  drawField(c) {
    const now = performance.now() / 1000;
    rect(c, 0, Bar, ArenaWidth, ArenaHeight - Bar, '#0C0A11');
    for (let row = 0; row < RowY.length; row++) rect(c, 0, RowY[row] + 5, ArenaWidth, 9, `rgba(22,19,30,${0.4 + row * 0.1})`);

    // the stands: more of them on their feet and bouncing the louder it gets
    const hype = clampTo(this.hype, 0, 1.2);
    const atlas = crowdAtlas(this.match.id);
    if (atlas) {
      for (let seat = 0; seat < SEATS.length; seat++) {
        const fan = SEATS[seat];
        const bob = Math.abs(Math.sin(now * (5 + fan.phase) + fan.phase * 7)) * (0.6 + hype * 3.2);
        // the hyped throw their arms up; the ones in a corner's colours wave for their fighter
        const up = (fan.arms && hype >= 0.45) || (fanAtlas.corners[seat] >= 0 && hype >= 0.3 && Math.sin(now * 4 + fan.phase * 9) > 0);
        const cell = seat * 2 + (up ? 1 : 0);
        const scale = FAN_SCALE[fan.row];
        c.drawImage(atlas, (cell % FAN_COLUMNS) * 32, Math.trunc(cell / FAN_COLUMNS) * 32, 32, 32,
          fan.x - 16 * scale, RowY[fan.row] - bob - 7 * scale, 32 * scale, 32 * scale);
      }
    }

    for (const flash of this.flashes) {
      const age = now - flash.born;
      if (age < 0 || age > 0.2) continue;
      const alpha = 1 - age / 0.2;
      const size = 2 + flash.size * 2;
      circle(c, flash.x, flash.y, size, `rgba(255,255,255,${alpha})`);
      line(c, flash.x - size * 2.5, flash.y, flash.x + size * 2.5, flash.y, `rgba(255,255,255,${alpha * 0.7})`);
      line(c, flash.x, flash.y - size * 2, flash.x, flash.y + size * 2, `rgba(255,255,255,${alpha * 0.7})`);
    }

    // the lights over the ring, through the haze
    for (let lamp = 0; lamp < 3; lamp++) {
      const x = Middle + (lamp - 1) * 130;
      poly(c, 'rgba(255,246,220,0.035)', [x - 6, Bar], [x + 6, Bar], [x + 90, CanvasFront], [x - 90, CanvasFront]);
      rect(c, x - 7, Bar, 14, 3, 'rgba(255,246,220,0.8)');
    }

    // the back posts and ropes, behind the boxers
    this.post(c, BackLeft, CanvasBack, BackPost, 0, 6);
    this.post(c, BackRight, CanvasBack, BackPost, 1, 6);
    for (let rope = 0; rope < Ropes.length; rope++) {
      const back = CanvasBack - BackPost * Ropes[rope];
      const front = CanvasFront - FrontPost * Ropes[rope];
      const colour = hexAlpha(RopeColours[rope], 0.85);
      rect(c, BackLeft, back - 1, BackRight - BackLeft, 2, colour);
      line(c, BackLeft, back + 0.5, FrontLeft, front + 0.5, colour, 2);
      line(c, BackRight, back + 0.5, FrontRight, front + 0.5, colour, 2);
    }

    // the canvas under its spotlight, following the action
    poly(c, '#C9D1DC', [BackLeft - 4, CanvasBack], [BackRight + 4, CanvasBack], [FrontRight + 4, CanvasFront], [FrontLeft - 4, CanvasFront]);
    ellipse(c, this.spot, Feet - 18, 170, 40, 'rgba(255,255,255,0.16)');
    ellipse(c, this.spot, Feet - 14, 100, 24, 'rgba(255,255,255,0.14)');
    rect(c, FrontLeft - 4, CanvasFront - 2, FrontRight - FrontLeft + 8, 2, '#8E99A8');

    // the apron, with the night's name on it
    rect(c, FrontLeft - 4, CanvasFront, FrontRight - FrontLeft + 8, 18, '#18224A');
    rect(c, FrontLeft - 4, CanvasFront + 15, FrontRight - FrontLeft + 8, 3, '#C8102E');
    rect(c, 0, CanvasFront + 18, ArenaWidth, ArenaHeight - CanvasFront - 18, '#08070C');
    this.centred(c, T.apron, Middle, CanvasFront + 3, 'rgba(255,255,255,0.85)');
  }

  drawOverDecals(c) {
    const t = this.t;
    // the pool spreading under a fallen boxer's head, worked out from the time so it is there for late joiners too
    for (const down of this.downs) {
      let a = t - down.time - 0.5;
      if (a <= 0) continue;
      if (!down.out) a = Math.min(a, BoxingCountDelay + down.count * BoxingCountStep - 0.4);
      const grown = Math.sqrt(clampTo(a / (down.out ? 9 : 3.5), 0, 1));
      const size = (down.out ? 40 : 16) * grown + 4;
      const [x, y] = down.pool;
      this.pool(c, down.index % 6, DARK_BLOOD, x, y, size, size * 0.55, down.index * 1.3, 0.95);
      this.pool(c, (down.index + 2) % 6, BLOOD, x + size * 0.15, y + 1, size * 0.75, size * 0.42, down.index * 2.1, 0.9);
      this.pool(c, (down.index + 4) % 6, BLOOD, x - size * 0.2, y + 1, size * 0.6, size * 0.35, down.index * 0.7, 0.85);
    }
    for (const tooth of this.teeth) if (t >= tooth.time + ToothFlight) drawTooth(c, tooth.to, tooth.index * 0.9);

    // shadows under everyone standing on the canvas
    for (let side = 0; side < 2; side++) {
      const b = this.boxers[side];
      if (!b.visible) continue;
      if (b.down) ellipse(c, b.x, Feet - 2, 28, 4, Shadow);
      else ellipse(c, b.x, Feet + 1, 13 - (BoxerY - b.y) * 0.5, 3, Shadow);
      if (this.corner[side].visible) ellipse(c, this.corner[side].x, CornerFeet + 1, 13, 3, Shadow);
    }
    if (this.ref.visible) ellipse(c, this.ref.x, RefFeet + 1, 11, 2.5, Shadow);
    if (this.walker.visible) ellipse(c, this.walker.x, WalkerFeet + 1, 11, 2.5, Shadow);
  }

  pool(c, state, colour, x, y, w, h, rotation, alpha) {
    const image = this.sprite(SPLATTER, `splatter-${state}`, colour);
    if (!image) return;
    c.globalAlpha = alpha;
    texture(c, image, x, y, w, h, rotation);
    c.globalAlpha = 1;
  }

  drawOverlay(c) {
    const t = this.t;
    for (let side = 0; side < 2; side++) {
      this.drawCut(c, side);
      this.drawGloves(c, side);
    }
    this.drawReferee(c);
    for (const sponge of this.sponge) {
      if (!sponge) continue;
      rect(c, sponge[0] - 3, sponge[1] - 2, 6, 4, '#F2E6A0');
      frameRect(c, sponge[0] - 3, sponge[1] - 2, 6, 4, '#9A8C40');
    }
    this.drawSparks(c, t);
    for (const tooth of this.teeth) {
      const a = t - tooth.time;
      if (a < 0 || a >= ToothFlight) continue;
      const s = a / ToothFlight;
      const at = vlerp(tooth.from, tooth.to, s);
      at[1] -= Math.sin(s * Math.PI) * 30;
      drawTooth(c, at, s * 14 * dirOf(1 - tooth.side));
    }

    if (this.walker.visible && this.sign > 0) {
      const w = this.walker;
      const top = w.y - 36 * WalkerScale / 2 - 12;
      line(c, w.x + 3, top + 12, w.x + 3, w.y - 20, '#6B5A3A');
      rect(c, w.x - 26, top - 2, 52, 14, '#FFFFFF');
      frameRect(c, w.x - 26, top - 2, 52, 14, '#C8102E');
      this.centred(c, T.round(this.sign), w.x, top - 0.5, '#B00E24');
    }

    // the front of the ring, in front of everyone
    this.post(c, FrontLeft, CanvasFront, FrontPost, 0, 8);
    this.post(c, FrontRight, CanvasFront, FrontPost, 1, 8);
    for (let rope = 0; rope < Ropes.length; rope++) {
      const y = CanvasFront - FrontPost * Ropes[rope];
      rect(c, FrontLeft + 4, y - 1, FrontRight - FrontLeft - 8, 2, hexAlpha(RopeColours[rope], 0.85));
    }

    // ringside heads, the press row
    for (let seat = 0; seat < 21; seat++) {
      const x = 12 + seat * 25 + (seat % 3) * 3;
      const y = ArenaHeight - 6 + (seat % 2) * 2;
      rect(c, x - 11, y + 3, 22, 8, '#100E14');
      circle(c, x, y, 7, '#18151E');
    }
    this.drawPlates(c, t);
  }

  drawPlates(c, t) {
    rect(c, 4, Bar + 2, 166, 24, 'rgba(0,0,0,0.6)');
    rect(c, 4, Bar + 2, 3, 24, Plates[0]);
    rect(c, ArenaWidth - 170, Bar + 2, 166, 24, 'rgba(0,0,0,0.6)');
    rect(c, ArenaWidth - 7, Bar + 2, 3, 24, Plates[1]);
    for (let side = 0; side < 2; side++) {
      for (let drop = 0; drop < this.cutLevel[side]; drop++) {
        const x = side === 0 ? 160 - drop * 8 : ArenaWidth - 160 + drop * 8;
        circle(c, x, Bar + 18, 2.6, BLOOD);
        circle(c, x - 0.8, Bar + 17, 0.8, '#FF6060');
      }
    }
    if (this.play == null || t < 0) return;

    // the round lights, and the round's card between rounds
    const round = t < 4 ? 1 : roundOf(t);
    for (let pip = 1; pip <= BoxingRounds; pip++) {
      circle(c, Middle + (pip - 2) * 12, Bar + 8, 3.5, pip <= round ? GOLD : 'rgba(255,255,255,0.25)');
    }
    if (!this.resting && !(t >= roundStart(BoxingRounds) + RoundLength && this.ko < 0)) return;
    const rest = t - roundStart(round) - RoundLength;
    if (rest < 0.4) return;

    const shown = this.resting ? 1 : BoxingRounds;
    const y = Bar + 16;
    const height = 12 + shown * 12 + (this.resting ? 0 : 12);
    rect(c, Middle - 64, y, 128, height, 'rgba(0,0,0,0.7)');
    frameRect(c, Middle - 64, y, 128, height, 'rgba(255,215,0,0.6)');
    this.centred(c, T.cards, Middle, y + 1, GOLD, true);
    let redTotal = 0;
    let blueTotal = 0;
    for (let row = 0; row < shown; row++) {
      const index = this.resting ? round - 1 : row;
      const card = this.cards[index];
      if (!card) continue;
      redTotal += card.red;
      blueTotal += card.blue;
      const ry = y + 13 + row * 12;
      this.centred(c, T.round(index + 1), Middle, ry, 'rgba(255,255,255,0.8)', true);
      this.centred(c, String(card.red), Middle - 48, ry, Plates[0], true);
      this.centred(c, String(card.blue), Middle + 48, ry, Plates[1], true);
    }
    if (this.resting) return;
    const total = y + 13 + shown * 12;
    this.centred(c, String(redTotal), Middle - 48, total, Plates[0], true);
    this.centred(c, String(blueTotal), Middle + 48, total, Plates[1], true);
  }

  /** The gloves the sprite cannot show: the guard in front of the face and the punching arm. */
  drawGloves(c, side) {
    const b = this.boxers[side];
    if (!b.visible || b.down) return;
    const dir = dirOf(side);
    if (b.raised) {
      for (let hand = -1; hand <= 1; hand += 2) {
        const glove = [b.x + hand * 9, b.y - 30];
        drawArm(c, [b.x + hand * 5, b.y - 8], glove, this.sleeves[side]);
        drawGlove(c, glove, side, hand);
      }
      return;
    }
    if (b.handUp) {
      const glove = raisedGlove(b, side);
      drawArm(c, [glove[0], b.y - 8], glove, this.sleeves[side]);
      drawGlove(c, glove, side, -dir);
      return;
    }
    if (!b.arms) return;
    if (b.guard) {
      drawGlove(c, offset(b, dir * 7, -12), side, dir);
      drawGlove(c, offset(b, dir * 11, -16), side, dir);
      return;
    }
    if (b.punch < 0 || b.lead) drawGlove(c, offset(b, dir * 6, -6), side, dir);
    if (b.punch < 0 || !b.lead) drawGlove(c, offset(b, dir * 11, -9), side, dir);
    if (b.punch < 0) return;
    drawArm(c, b.shoulder, b.glove, this.sleeves[side]);
    drawGlove(c, b.glove, side, dir);
  }

  /** The cut over a boxer's eye, and the blood running from it; greased shut in the corner. */
  drawCut(c, side) {
    const b = this.boxers[side];
    const level = this.cutLevel[side];
    if (level === 0 || !b.visible || b.down || b.facing === Dir.South) return;
    const dir = dirOf(side);
    const [x, y] = offset(b, dir * 5, -21);
    line(c, x - 2, y - 1, x + 2, y + 1, DARK_BLOOD);
    line(c, x - 2, y, x + 2, y + 2, BLOOD);
    rect(c, x - 0.5, y, 1.6, 2 + level * 3, 'rgba(158,11,11,0.9)');
    if (level >= 2) rect(c, x + dir * 1.5, y + 1, 1.2, level * 2, 'rgba(94,6,6,0.9)');
    if (this.resting) circle(c, x, y, 1.6, 'rgba(255,255,255,0.5)');
  }

  drawReferee(c) {
    if (!this.ref.visible || this.refArms === RefArms.None) return;
    const shirt = '#E4E4E8';
    const dir = this.refPointing;
    const r = this.ref;
    if (this.refArms === RefArms.Count) {
      // each count is a chop down towards the canvas
      const phase = this.refPhase % 1;
      const chop = phase < 0.2 ? ease(phase / 0.2) : 1 - ease((phase - 0.2) / 0.8);
      const angle = mix(-1.3, 0.7, chop);
      const shoulder = [r.x + dir * 4, r.y - 8];
      refArm(c, shoulder, [shoulder[0] + dir * Math.cos(angle) * 12, shoulder[1] + Math.sin(angle) * 12], shirt);
    } else if (this.refArms === RefArms.Wave) {
      const swing = Math.sin(this.t * 12) * 0.8;
      for (let hand = -1; hand <= 1; hand += 2) {
        const shoulder = [r.x + hand * 5, r.y - 8];
        const angle = -Math.PI / 2 + hand * (0.5 + swing * hand);
        refArm(c, shoulder, [shoulder[0] + Math.cos(angle) * 12, shoulder[1] + Math.sin(angle) * 12], shirt);
      }
    } else if (this.refArms === RefArms.Break) {
      for (let hand = -1; hand <= 1; hand += 2) {
        const shoulder = [r.x + hand * 5, r.y - 7];
        refArm(c, shoulder, [shoulder[0] + hand * 12, shoulder[1] + 2], shirt);
      }
    } else if (this.refArms === RefArms.Raise) {
      refArm(c, [r.x + Math.sign(this.refTarget[0] - r.x) * 5, r.y - 8], this.refTarget, shirt);
    }
  }

  /** The impact stars on the punches landing now. */
  drawSparks(c, t) {
    if (!this.play || t < 4 || !sparkFrames || sparkFrames.length === 0) return;
    const events = this.play.events;
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e.time > t) break;
      const a = t - e.time;
      if (e.action !== Action.Punch || a >= 0.2 || e.value === BoxingSlipped) continue;
      const d = this.boxers[1 - e.side];
      const dir = dirOf(e.side);
      const blocked = e.value === BoxingBlocked;
      const [x, y] = blocked ? offset(d, -dir * 11, -10) : e.state === BoxingBody ? offset(d, -dir * 7, 2) : offset(d, -dir * 8, -17);
      const frame = sparkFrames[Math.min(sparkFrames.length - 1, Math.trunc(a / 0.05))];
      const size = blocked ? 20 : e.extra >= BoxingHook ? 36 : 28;
      c.globalAlpha = blocked ? 0.75 : 1;
      texture(c, frame, x, y, size, size, i * 1.7);
      c.globalAlpha = 1;
    }
  }

  post(c, x, floor, height, side, width) {
    rect(c, x - width / 2, floor - height, width, height + 2, '#98A2AE');
    rect(c, x - width / 2 - 1, floor - height * 0.85, width + 2, height * 0.66, Gloves[side]);
    rect(c, x - width / 2, floor - height - 2, width, 3, '#C9D0D8');
  }

  /** Small text centred on a spot. */
  centred(c, text, x, y, colour, outline = false) {
    c.font = `bold 10px ${this.font}`;
    c.textAlign = 'center';
    c.textBaseline = 'top';
    if (outline) {
      c.lineWidth = 2;
      c.strokeStyle = 'rgba(0,0,0,0.6)';
      c.strokeText(text, x, y);
    }
    c.fillStyle = colour;
    c.fillText(text, x, y);
  }
}

/** A boxer on the canvas from a knockdown a seconds ago, getting up after the count if it is not a knockout. */
function downPose(b, from, a, away, count) {
  const fall = clampTo(a / 0.45, 0, 1);
  let lying = fall * fall;
  const bounce = a > 0.45 && a < 0.8 ? Math.sin((a - 0.45) / 0.35 * Math.PI) * 5 : 0;
  let rise = 0;
  if (count >= 0) {
    const up = BoxingCountDelay + (count - 1) * BoxingCountStep + 0.15;
    rise = ease((a - up) / 0.7);
    lying *= 1 - rise;
  }
  b.x = from.x + away * 12 * ease(a / 0.4);
  b.y = mix(from.y, LyingY, lying) - bounce * lying;
  b.rot = mix(from.rot, -away * 90, lying);
  if (rise > 0) b.rot += Math.sin(a * 9) * 4 * rise * clampTo(3 - (a - BoxingCountDelay - count * BoxingCountStep), 0, 1);
  b.down = lying > 0.5;
  b.arms = lying < 0.2 && rise >= 1;
  b.guard = false;
  b.punch = -1;
}

/** How a boxer takes a punch thrown a seconds ago (negative while it is coming). */
function react(d, e, a) {
  const dir = dirOf(e.side);
  const kind = e.extra;
  if (e.value === BoxingLanded) {
    if (a < 0 || a >= 0.7) return;
    const k = a < 0.05 ? a / 0.05 : Math.exp(-(a - 0.05) * 6);
    if (e.state === BoxingBody) {
      // doubled over the glove
      d.x += dir * 2 * k;
      d.y += 3 * k;
      d.rot += dir * 10 * k;
    } else {
      const p = power(kind);
      d.x += dir * (3 + p * 2.5) * k;
      d.rot -= dir * (4 + p * 3.5) * k;
      if (kind === BoxingUppercut) d.y -= 5 * k;
    }
    d.hurt = Math.max(d.hurt, 1 - a / 0.15);
  } else if (e.value === BoxingBlocked) {
    if (a > -0.18 && a < 0.22) d.guard = true;
    if (a >= 0 && a < 0.4) d.x += dir * 2 * Math.exp(-a * 8);
  } else if (Math.abs(a) < 0.22) {
    const v = 1 - Math.abs(a) / 0.22;
    if (kind === BoxingHook) {
      d.y += 6 * v;
      d.rot += dir * 3 * v;
    } else {
      d.rot -= dir * (kind === BoxingUppercut ? 9 : 7) * v;
      d.x += dir * (kind === BoxingUppercut ? 4 : 3) * v;
    }
  }
}

/**
 * A boxer throwing a punch a seconds from its impact: the wind-up pulls back, the strike lunges in with the glove
 * on its path (straight, round the side or up from below), then the recoil.
 */
function swingPunch(boxers, side, e, a) {
  const b = boxers[side];
  const d = boxers[1 - side];
  const dir = dirOf(side);
  const kind = e.extra;
  let cock;
  let strike;
  if (a < 0) {
    const u = 1 + a / windup(kind);
    if (u < 0.45) {
      cock = Math.sin(u / 0.45 * Math.PI / 2);
      strike = 0;
    } else {
      const s = (u - 0.45) / 0.55;
      cock = 1 - s;
      strike = s * s;
    }
  } else {
    const r = Math.min(1, a / recover(kind));
    cock = 0;
    strike = 1 - ease(r);
    // a miss carries on past where the head was
    if (e.value === BoxingSlipped) strike *= 1 + 0.25 * Math.sin(r * Math.PI);
  }

  const [lunge, lean] = kind === BoxingJab ? [5, 3] : kind === BoxingCross ? [9, 8] : kind === BoxingHook ? [7, 7] : [6, -5];
  b.x += dir * (lunge * strike - 3 * cock);
  b.rot -= dir * (lean * strike - 2 * cock);
  if (kind === BoxingUppercut) b.y += 4 * cock - 3 * strike;

  const lead = kind === BoxingJab || kind === BoxingHook;
  const guard = offset(b, dir * (lead ? 11 : 6), lead ? -9 : -6);
  let target;
  if (e.value === BoxingBlocked) target = offset(d, -dir * 11, -9);
  else if (e.state === BoxingBody) target = offset(d, -dir * 7, 2);
  else target = offset(d, -dir * 8, -17);
  if (e.value === BoxingSlipped) target = [target[0] + dir * 9, target[1] + (kind === BoxingHook ? -3 : 0)];
  const cockBy = kind === BoxingHook ? [-dir * 2, -9] : kind === BoxingUppercut ? [dir, 10] : [-dir * 4, 1];
  const cocked = [guard[0] + cockBy[0], guard[1] + cockBy[1]];

  let glove;
  if (a < 0 && strike <= 0) {
    glove = vlerp(guard, cocked, cock);
  } else if (a < 0) {
    // hooks loop over the top, uppercuts come up from under the guard
    const mid = [(cocked[0] + target[0]) / 2, (cocked[1] + target[1]) / 2];
    const control = kind === BoxingHook ? [mid[0], mid[1] - 12] : kind === BoxingUppercut ? [target[0] - dir * 3, cocked[1] + 4] : mid;
    const s = strike;
    glove = [
      (1 - s) * (1 - s) * cocked[0] + 2 * (1 - s) * s * control[0] + s * s * target[0],
      (1 - s) * (1 - s) * cocked[1] + 2 * (1 - s) * s * control[1] + s * s * target[1],
    ];
  } else {
    glove = vlerp(guard, target, strike);
  }
  b.punch = kind;
  b.lead = lead;
  b.glove = glove;
  b.shoulder = offset(b, dir * 3, -7);
}

function ellipse(c, x, y, rx, ry, colour) {
  if (rx <= 0 || ry <= 0) return;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = colour;
  c.fill();
}

function drawArm(c, from, to, sleeve) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  if (dx * dx + dy * dy < 1) return;
  c.lineCap = 'butt';
  line(c, from[0], from[1], to[0], to[1], sleeve, 3.6);
  const wrist = [from[0] + dx * 0.6, from[1] + dy * 0.6];
  line(c, wrist[0], wrist[1], to[0], to[1], Skin, 2.9);
}

function drawGlove(c, at, side, facing) {
  circle(c, at[0], at[1], 4.3, 'rgba(0,0,0,0.55)');
  circle(c, at[0], at[1], 3.6, Gloves[side]);
  circle(c, at[0] + facing * 0.8 - 0.6, at[1] - 1.3, 1.2, 'rgba(255,255,255,0.45)');
  rect(c, at[0] - facing * 4 - 1, at[1] - 1.5, 2, 3, '#F4F4F4');
}

function refArm(c, shoulder, hand, shirt) {
  const dx = hand[0] - shoulder[0];
  const dy = hand[1] - shoulder[1];
  if (dx * dx + dy * dy < 1) return;
  line(c, shoulder[0], shoulder[1], hand[0], hand[1], shirt, 3);
  circle(c, hand[0], hand[1], 2, Skin);
}

function drawTooth(c, at, rotation) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const turn = (x, y) => [at[0] + x * cos - y * sin, at[1] + x * sin + y * cos];
  poly(c, '#F6F1E2', turn(-2, -1.6), turn(2, -1.6), turn(1.5, 2), turn(-1.5, 2));
  rect(c, at[0] - 0.6, at[1] + 1, 1.2, 1.2, BLOOD);
}

defineSport(Sport.Boxing, { play: (random, entrants, winner) => playBoxing(random, winner), Arena: BoxingArena });
