// The people and props on YouTape's tapes, as CMUTapePlayer and CMUTapeLook draw them in game.
//
// People: CMUTapeLook gives each character a look drawn from the tape's seed and their place in the cast (sex, skin
// tone, eyes, hair and its colour, sometimes a beard), puts it on the Human species doll (AppearanceCMUHuman) the
// way the lobby preview applies a profile, then dresses it as a player in that job spawns: the job's default role
// loadout (RoleLoadout.SetDefault), then the tape's StartingGear, which only fills the slots the loadout left empty
// and the hands. Here the doll is composited from the same RSIs in BaseSpeciesLayers order, the way
// sports/dolls.js builds its kits: body parts in the skin colour, the eyes, the Human markings group's required
// boxers (the undershirt is hidden by every jumpsuit), the jumpsuit (bent by the female displacement map for
// women), the worn items, the beard and hair, the mask and head, and what is in the hands, right hand first.
//
// The OUTFITS table was worked out from the game's prototypes: for each AU14GearCivilian* gear, the job that
// starts with it (the first by id with a role loadout), that job's loadout groups' default picks, and each item's
// clothingVisuals or equipped-<SLOT> state (ClientClothingSystem). Items with no sprite for their slot (headsets,
// pouches, the pen in the second ear) draw nothing, as in game. Props are their entity's Sprite layers. RSI paths
// are under /Textures.

import { stateCanvas, layerCanvas } from '../sports/dolls.js';
import { loadRsi, loadStateSheet, stateFrames } from '../../sprites.js';
import { NetRandom } from '../sports/core.js';

const PARTS = 'Mobs/Species/Human/parts.rsi';
const EYES = 'Mobs/Customization/eyes.rsi';
const HAIR = 'Mobs/Customization/human_hair.rsi';
const FACIAL_HAIR = 'Mobs/Customization/human_facial_hair.rsi';
// the Human markings group's required defaults, CMUUnderwearBoxersOlive and CMUUndershirtOlive, drawn uncoloured
const BOXERS = ['CMU14/Mobs/Human_Customization/pve_underwear.rsi', 'marine_boxers'];
const UNDERSHIRT = ['CMU14/Mobs/Human_Customization/pve_undershirt.rsi', 'undershirt_uscm_short'];
// AppearanceCMUHuman's femaleDisplacements for the jumpsuit slot
const FEMALE_JUMPSUIT = ['Mobs/Species/Human/displacement.rsi', 'jumpsuit-female'];

// ---------------------------------------------------------------- looks (CMUTapeLook)

const f = Math.fround;

/** The CMUTapeLook lists, as [marking id, state]. The order matters: picks index into them. */
const MALE_HAIR = [
  ['HumanHairCrewcut', 'crewcut'], ['HumanHairBusiness', 'business'], ['HumanHairBusiness2', 'business2'], ['HumanHairBuzzcut', 'buzzcut'],
  ['HumanHairBedhead', 'bedhead'], ['HumanHairAfro', 'afro'], ['HumanHairSidecut', 'sidecut'], ['HumanHairCombover', 'combover'],
  ['HumanHairQuiff', 'quiff'], ['HumanHairPompadour', 'pompadour'], ['HumanHairUndercut', 'undercut'], ['HumanHairMulder', 'mulder'],
  ['HumanHairGelled', 'gelled'], ['HumanHairSpiky', 'spiky'], ['HumanHairCornrows', 'cornrows'], ['HumanHairLowfade', 'lowfade'],
  ['HumanHairHighfade', 'highfade'], ['HumanHairFather', 'father'], ['HumanHairThinning', 'thinning'],
];
const FEMALE_HAIR = [
  ['HumanHairPonytail', 'ponytail'], ['HumanHairPonytail2', 'ponytail2'], ['HumanHairBob', 'bob'], ['HumanHairBob2', 'bob2'],
  ['HumanHairBobcurl', 'bobcurl'], ['HumanHairBun', 'bun'], ['HumanHairLongstraightponytail', 'longstraightponytail'], ['HumanHairPixie', 'pixie'],
  ['HumanHairBraid', 'braid'], ['HumanHairPigtails', 'pigtails'], ['HumanHairSidetail', 'sidetail'], ['HumanHairHimecut', 'himecut'],
  ['HumanHairCurls', 'curls'], ['HumanHairUpdo', 'updo'], ['HumanHairLargebun', 'largebun'], ['HumanHairEmo', 'emo'],
  ['HumanHairAfro', 'afro'], ['HumanHairCornrows', 'cornrows'],
];
const BEARDS = [
  ['HumanFacialHairFullbeard', 'fullbeard'], ['HumanFacialHairMoustache', 'moustache'], ['HumanFacialHairFiveoclock', 'fiveoclock'],
  ['HumanFacialHairVandyke', 'vandyke'], ['HumanFacialHairChin', 'chin'], ['HumanFacialHairGt', 'gt'], ['HumanFacialHairMutton', 'mutton'],
  ['HumanFacialHairSmallstache', 'smallstache'], ['HumanFacialHairSideburn', 'sideburn'], ['HumanFacialHairCroppedfullbeard', 'croppedfullbeard'],
  ['HumanFacialHair5oclockmoustache', '5oclockmoustache'],
];
// HumanoidCharacterAppearance's realistic eyes: Brown, Gray, Azure, SteelBlue, Black
const EYE_COLOURS = [[165, 42, 42], [128, 128, 128], [240, 255, 255], [70, 130, 180], [0, 0, 0]];
// natural hair: black, dark brown, brown, auburn, ginger, blonde, platinum, grey, white
const NATURAL_HAIR = [[0x1A, 0x14, 0x10], [0x3B, 0x24, 0x16], [0x6B, 0x44, 0x23], [0x8D, 0x4A, 0x2B], [0xB5, 0x53, 0x2A], [0xD8, 0xB6, 0x6A], [0xE8, 0xDD, 0xB5], [0x9A, 0x9A, 0x9A], [0xDD, 0xDD, 0xDD]];
const DYED_HAIR = [[0xC2, 0x18, 0x5B], [0x1E, 0x88, 0xE5], [0x43, 0xA0, 0x47], [0x8E, 0x24, 0xAA], [0xE5, 0x39, 0x35], [0xFF, 0x70, 0x43], [0x26, 0xC6, 0xDA], [0xF5, 0xF5, 0xF5]];
const DYED_CHANCE = 0.1;
const BEARD_CHANCE = 0.35;

/** CMUTapeLook.LookSeed: unchecked(tapeSeed * 31 + character + 1). */
export function lookSeed(tapeSeed, character) {
  return (Math.imul(tapeSeed, 31) + character + 1) | 0;
}

/** Robust's Color.FromHsv, in floats, to bytes as ClampColor keeps them. */
function fromHsv(h, s, v) {
  const hue = f(f(h - Math.trunc(h)) * 360);
  const c = f(v * s);
  const hh = f(hue / 60);
  const x = f(c * f(1 - Math.abs(f(f(hh % 2) - 1))));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh >= 0 && hh < 1) [r, g, b] = [c, x, 0];
  else if (hh < 2) [r, g, b] = [x, c, 0];
  else if (hh < 3) [r, g, b] = [0, c, x];
  else if (hh < 4) [r, g, b] = [0, x, c];
  else if (hh < 5) [r, g, b] = [x, 0, c];
  else if (hh < 6) [r, g, b] = [c, 0, x];
  const m = f(v - c);
  return [f(r + m), f(g + m), f(b + m)].map(byte);
}

/** Color.RByte: the float channel times 255, truncated. */
function byte(channel) {
  return Math.trunc(f(channel * 255));
}

/** HumanTonedSkinColoration.FromUnary: 0 to 20 turn the hue, 20 to 100 deepen the tone. */
export function skinTone(tone) {
  const value = Math.min(100, Math.max(0, tone));
  const offset = f(value - 20);
  let hue = 25;
  let sat = 20;
  let val = 100;
  if (offset <= 0) hue = f(hue + Math.abs(offset));
  else {
    sat = f(sat + offset);
    val = f(val - offset);
  }
  return fromHsv(f(hue / 360), f(sat / 100), f(val / 100));
}

/** CMUTapeLook.Nudge: a channel moved a little either way. */
function nudge(channel, random) {
  return Math.min(1, Math.max(0, f(channel + f(random.nextDouble() * 0.12 - 0.06))));
}

/** CMUTapeLook.Profile: a character's look from their look seed, drawn in the same order as the C#. */
export function lookOf(look) {
  const random = new NetRandom(look);
  const female = random.next(2) === 1;
  const tone = random.next(101);
  const eyes = EYE_COLOURS[random.next(EYE_COLOURS.length)];
  const styles = female ? FEMALE_HAIR : MALE_HAIR;
  const hair = styles[random.next(styles.length)];
  let hairColour;
  if (random.nextDouble() < DYED_CHANCE) {
    hairColour = DYED_HAIR[random.next(DYED_HAIR.length)];
  } else {
    const natural = NATURAL_HAIR[random.next(NATURAL_HAIR.length)].map(v => f(v / 255));
    hairColour = natural.map(channel => byte(nudge(channel, random)));
  }
  const beard = !female && random.nextDouble() < BEARD_CHANCE ? BEARDS[random.next(BEARDS.length)] : null;
  return { female, tone, skin: skinTone(tone), eyes, hair, hairColour, beard };
}

const hex = rgb => `#${rgb.map(v => v.toString(16).padStart(2, '0')).join('')}`;

// ---------------------------------------------------------------- dress

/**
 * Each outfit as a player in its job spawns: the job, the slots its items cover in BaseSpeciesLayers order as
 * [slot, rsi, state, tint], the layers the items hide (HideLayerClothing), and what is in the hands, right first.
 */
export const OUTFITS = {
  AU14GearCivilianColonist: {
    job: 'AU14JobCivilianColonist',
    hides: ['UndergarmentTop'],
    worn: [
      ['jumpsuit', '_RMC14/Objects/Clothing/Uniforms/Survivor/colonist.rsi', 'equipped-INNERCLOTHING'],
      ['shoes', '_RMC14/Objects/Clothing/Shoes/Sneakers/black.rsi', 'equipped-FEET'],
      ['id', '_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD'],
      ['back', '_RMC14/Objects/Clothing/Back/Satchels/Civilians/classic.rsi', 'equipped-BACKPACK'],
    ],
    hands: [],
  },
  AU14GearCivilianColonyAdminAssistant: {
    job: 'AU14JobCivilianColonyAdminAssistant',
    hides: ['UndergarmentTop'],
    worn: [
      ['jumpsuit', '_RMC14/Objects/Clothing/Uniforms/Survivor/colonist.rsi', 'equipped-INNERCLOTHING'],
      ['shoes', '_RMC14/Objects/Clothing/Shoes/Sneakers/black.rsi', 'equipped-FEET'],
      ['id', '_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD'],
      ['outerClothing', 'CMU14/Clothing/Civilian/Jacket/graypuffervest.rsi', 'equipped-OUTERCLOTHING'],
      ['back', '_RMC14/Objects/Clothing/Back/Satchels/Civilians/classic.rsi', 'equipped-BACKPACK'],
    ],
    hands: [['_RMC14/Objects/Storage/Briefcases/brown.rsi', 'inhand-right'], ['CMU14/Items/IEDs/signaller.rsi', 'advanced-inhand-left']],
  },
  AU14GearCivilianColonyAdministrator: {
    job: 'AU14JobCivilianColonyAdministrator',
    hides: ['UndergarmentTop'],
    worn: [
      ['jumpsuit', '_RMC14/Objects/Clothing/Uniforms/Survivor/colonist.rsi', 'equipped-INNERCLOTHING'],
      ['shoes', '_RMC14/Objects/Clothing/Shoes/Sneakers/black.rsi', 'equipped-FEET'],
      ['id', '_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD'],
      ['outerClothing', '_RMC14/Objects/Clothing/OuterClothing/Coats/Corporate/corporate_blue_jacket.rsi', 'equipped-OUTERCLOTHING'],
      ['belt', '_RMC14/Objects/Clothing/Belt/holster_pistol/classic-jungle.rsi', 'equipped-BELT'],
      ['back', '_RMC14/Objects/Clothing/Back/Satchels/Civilians/classic.rsi', 'equipped-BACKPACK'],
    ],
    hands: [['CMU14/Items/IEDs/signaller.rsi', 'advanced-inhand-left']],
  },
  AU14GearCivilianEngineer: {
    job: 'AU14JobCivilianEngineer',
    hides: ['UndergarmentTop'],
    worn: [
      ['jumpsuit', 'CMU14/Clothing/Civilian/Uniforms/WeYuEngineer.rsi', 'equipped-INNERCLOTHING'],
      ['gloves', '_RMC14/Objects/Clothing/Hands/Gloves/insulated.rsi', 'equipped-HAND'],
      ['shoes', '_RMC14/Objects/Clothing/Shoes/Boots/black.rsi', 'equipped-FEET'],
      ['id', '_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD'],
      ['outerClothing', 'CMU14/Clothing/Civilian/ServiceOuterJumpsuits/wyengineer.rsi', 'equipped-OUTERCLOTHING'],
      ['belt', '_RMC14/Objects/Clothing/Belt/utility.rsi', 'equipped-BELT'],
      ['back', '_RMC14/Objects/Clothing/Back/Satchels/Civilians/classic.rsi', 'equipped-BACKPACK'],
      ['head', '_RMC14/Objects/Clothing/Head/Helmets/Hardhats/white.rsi', 'off-equipped-HELMET'],
    ],
    hands: [],
  },
  AU14GearCivilianEthicsAndWellnessAdvisor: {
    job: 'AU14JobCivilianEthicsAndWellnessAdvisor',
    hides: ['UndergarmentTop'],
    worn: [
      ['jumpsuit', '_RMC14/Objects/Clothing/Uniforms/Survivor/colonist.rsi', 'equipped-INNERCLOTHING'],
      ['shoes', '_RMC14/Objects/Clothing/Shoes/Sneakers/black.rsi', 'equipped-FEET'],
      ['id', '_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD'],
      ['outerClothing', 'CMU14/Clothing/Civilian/Jacket/graypufferjacket.rsi', 'equipped-OUTERCLOTHING'],
      ['back', '_RMC14/Objects/Clothing/Back/Satchels/Civilians/classic.rsi', 'equipped-BACKPACK'],
    ],
    hands: [['CMU14/Items/IEDs/signaller.rsi', 'advanced-inhand-right']],
  },
  AU14GearCivilianFoodServiceWorker: {
    job: 'AU14JobCivilianFoodServiceWorker',
    hides: ['UndergarmentTop'],
    worn: [
      ['jumpsuit', '_RMC14/Objects/Clothing/Uniforms/Survivor/colonist.rsi', 'equipped-INNERCLOTHING'],
      ['shoes', '_RMC14/Objects/Clothing/Shoes/Sneakers/black.rsi', 'equipped-FEET'],
      ['id', '_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD'],
      ['outerClothing', '_RMC14/Objects/Clothing/OuterClothing/Labcoats/medicalapron.rsi', 'equipped-OUTERCLOTHING'],
      ['back', '_RMC14/Objects/Clothing/Back/Satchels/Civilians/classic.rsi', 'equipped-BACKPACK'],
    ],
    hands: [],
  },
  AU14GearCivilianForeman: {
    job: 'AU14JobCivilianForeman',
    hides: ['UndergarmentTop'],
    worn: [
      ['jumpsuit', 'CMU14/Clothing/Civilian/Uniforms/foremanuniform.rsi', 'equipped-INNERCLOTHING'],
      ['gloves', '_RMC14/Objects/Clothing/Hands/Gloves/insulated.rsi', 'equipped-HAND'],
      ['shoes', '_RMC14/Objects/Clothing/Shoes/Boots/black.rsi', 'equipped-FEET'],
      ['id', '_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD'],
      ['belt', '_RMC14/Objects/Clothing/Belt/utility.rsi', 'equipped-BELT'],
      ['back', '_RMC14/Objects/Clothing/Back/Satchels/Civilians/classic.rsi', 'equipped-BACKPACK'],
      ['head', '_RMC14/Objects/Clothing/Head/Helmets/Hardhats/blue.rsi', 'off-equipped-HELMET'],
    ],
    hands: [['CMU14/Items/IEDs/signaller.rsi', 'advanced-inhand-right']],
  },
  AU14GearCivilianFreightSystemsSpecialist: {
    job: 'AU14JobCivilianFreightSystemsSpecialist',
    hides: ['UndergarmentTop'],
    worn: [
      ['jumpsuit', 'CMU14/Clothing/Civilian/Uniforms/cyanboilersuit.rsi', 'equipped-INNERCLOTHING'],
      ['gloves', '_RMC14/Objects/Clothing/Hands/Gloves/insulated.rsi', 'equipped-HAND'],
      ['shoes', '_RMC14/Objects/Clothing/Shoes/Boots/black.rsi', 'equipped-FEET'],
      ['id', '_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD'],
      ['outerClothing', '_RMC14/Objects/Clothing/OuterClothing/HazardVests/orange.rsi', 'equipped-OUTERCLOTHING'],
      ['belt', '_RMC14/Objects/Clothing/Belt/utility.rsi', 'equipped-BELT'],
      ['back', '_RMC14/Objects/Clothing/Back/Satchels/Civilians/classic.rsi', 'equipped-BACKPACK'],
      ['head', '_RMC14/Objects/Clothing/Head/Helmets/Hardhats/orange.rsi', 'off-equipped-HELMET'],
    ],
    hands: [['Objects/Misc/stamps.rsi', 'stamp-inhand-right'], ['Objects/Misc/stamps.rsi', 'handle-inhand-right', '#f8f8f8']],
  },
  AU14GearCivilianHeadOfService: {
    job: 'AU14JobCivilianHeadOfService',
    hides: ['UndergarmentTop'],
    worn: [
      ['jumpsuit', 'CMU14/Clothing/Civilian/Uniforms/yellowworkwear.rsi', 'equipped-INNERCLOTHING'],
      ['shoes', '_RMC14/Objects/Clothing/Shoes/Sneakers/black.rsi', 'equipped-FEET'],
      ['id', '_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD'],
      ['outerClothing', '_RMC14/Objects/Clothing/OuterClothing/Labcoats/medicalapron.rsi', 'equipped-OUTERCLOTHING'],
      ['back', '_RMC14/Objects/Clothing/Back/Satchels/Civilians/classic.rsi', 'equipped-BACKPACK'],
    ],
    hands: [['CMU14/Items/IEDs/signaller.rsi', 'advanced-inhand-right']],
  },
  AU14GearCivilianJournalist: {
    job: 'AU14JobCivilianJournalist',
    hides: ['UndergarmentTop'],
    worn: [
      ['jumpsuit', '_RMC14/Objects/Clothing/Uniforms/Survivor/colonist.rsi', 'equipped-INNERCLOTHING'],
      ['shoes', '_RMC14/Objects/Clothing/Shoes/Sneakers/black.rsi', 'equipped-FEET'],
      ['id', '_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD'],
      ['outerClothing', 'CMU14/Clothing/Civilian/Jacket/tanpuffervest.rsi', 'equipped-OUTERCLOTHING'],
      ['back', '_RMC14/Objects/Clothing/Back/Satchels/Civilians/classic.rsi', 'equipped-BACKPACK'],
    ],
    hands: [['_RMC14/Objects/Devices/broadcasting_camera.rsi', 'inhand-right'], ['CMU14/Items/IEDs/signaller.rsi', 'advanced-inhand-left']],
  },
  AU14GearCivilianMiner: {
    job: 'AU14JobCivilianMiner',
    hides: ['UndergarmentTop'],
    worn: [
      ['jumpsuit', 'CMU14/Clothing/Civilian/Uniforms/kellandmininguniform.rsi', 'equipped-INNERCLOTHING'],
      ['shoes', '_RMC14/Objects/Clothing/Shoes/Boots/black.rsi', 'equipped-FEET'],
      ['id', '_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD'],
      ['outerClothing', 'CMU14/Clothing/Civilian/Jacket/HazardVests/kellandmininghazardvest.rsi', 'equipped-OUTERCLOTHING'],
      ['back', '_RMC14/Objects/Clothing/Back/Satchels/Civilians/engineer.rsi', 'equipped-BACKPACK'],
      ['head', '_RMC14/Objects/Clothing/Head/Helmets/Hardhats/orange.rsi', 'off-equipped-HELMET'],
    ],
    hands: [],
  },
  AU14GearCivilianNurse: {
    job: 'AU14JobCivilianNurse',
    hides: ['UndergarmentTop'],
    worn: [
      ['jumpsuit', 'CMU14/Clothing/Civilian/Uniforms/yellowworkwear.rsi', 'equipped-INNERCLOTHING'],
      ['gloves', 'Clothing/Hands/Gloves/nitrile.rsi', 'equipped-HAND'],
      ['shoes', '_RMC14/Objects/Clothing/Shoes/Sneakers/black.rsi', 'equipped-FEET'],
      ['id', '_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD'],
      ['eyes', '_RMC14/Objects/Clothing/Eyes/Glasses/medicalhud.rsi', 'equipped-EYES'],
      ['belt', '_RMC14/Objects/Clothing/Belt/medical.rsi', 'equipped-BELT'],
      ['back', '_RMC14/Objects/Clothing/Back/Satchels/Civilians/medical.rsi', 'equipped-BACKPACK'],
      ['mask', '_RMC14/Objects/Clothing/Mask/sterile.rsi', 'equipped-MASK'],
      ['head', '_RMC14/Objects/Clothing/Head/Hats/SurgicalCap/blue.rsi', 'equipped-HELMET'],
    ],
    hands: [],
  },
  AU14GearCivilianPhysician: {
    job: 'AU14JobCivilianPhysician',
    hides: ['UndergarmentTop'],
    worn: [
      ['jumpsuit', 'CMU14/Clothing/Civilian/Uniforms/yellowworkwear.rsi', 'equipped-INNERCLOTHING'],
      ['gloves', 'Clothing/Hands/Gloves/nitrile.rsi', 'equipped-HAND'],
      ['shoes', '_RMC14/Objects/Clothing/Shoes/Sneakers/black.rsi', 'equipped-FEET'],
      ['id', '_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD'],
      ['eyes', '_RMC14/Objects/Clothing/Eyes/Glasses/medicalhud.rsi', 'equipped-EYES'],
      ['belt', '_RMC14/Objects/Clothing/Belt/medical.rsi', 'equipped-BELT'],
      ['back', '_RMC14/Objects/Clothing/Back/Satchels/Civilians/medical.rsi', 'equipped-BACKPACK'],
      ['mask', '_RMC14/Objects/Clothing/Mask/sterile.rsi', 'equipped-MASK'],
      ['head', '_RMC14/Objects/Clothing/Head/Hats/SurgicalCap/blue.rsi', 'equipped-HELMET'],
    ],
    hands: [],
  },
  AU14GearCivilianShopkeep: {
    job: 'AU14JobCivilianShopkeep',
    hides: ['UndergarmentTop'],
    worn: [
      ['jumpsuit', '_RMC14/Objects/Clothing/Uniforms/Survivor/colonist.rsi', 'equipped-INNERCLOTHING'],
      ['shoes', '_RMC14/Objects/Clothing/Shoes/Sneakers/black.rsi', 'equipped-FEET'],
      ['id', '_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD'],
      ['back', '_RMC14/Objects/Clothing/Back/Satchels/Civilians/classic.rsi', 'equipped-BACKPACK'],
    ],
    hands: [],
  },
  AU14GearCivilianWasteManagementSpecialist: {
    job: 'AU14JobCivilianWasteManagementSpecialist',
    hides: ['UndergarmentTop'],
    worn: [
      ['jumpsuit', 'CMU14/Clothing/Civilian/Uniforms/Sanitation.rsi', 'equipped-INNERCLOTHING'],
      ['shoes', '_RMC14/Objects/Clothing/Shoes/Boots/black.rsi', 'equipped-FEET'],
      ['id', '_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD'],
      ['outerClothing', 'CMU14/Clothing/Civilian/ServiceOuterJumpsuits/sanitation.rsi', 'equipped-OUTERCLOTHING'],
      ['belt', '_RMC14/Objects/Clothing/Belt/utility.rsi', 'equipped-BELT'],
      ['back', '_RMC14/Objects/Clothing/Back/Satchels/Civilians/classic.rsi', 'equipped-BACKPACK'],
    ],
    hands: [],
  },
};

/** The slots drawn under the hair and beard; mask, head and the pockets go over them (BaseSpeciesLayers). */
const UNDER_HAIR = new Set(['jumpsuit', 'gloves', 'shoes', 'id', 'ears', 'eyes', 'outerClothing', 'belt', 'back', 'neck', 'suitstorage']);

const mapPixels = new WeakMap();

/** A canvas's pixels, read through a copy made for reading. */
function pixels(canvas) {
  const copy = document.createElement('canvas');
  copy.width = canvas.width;
  copy.height = canvas.height;
  const ctx = copy.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0);
  return ctx.getImageData(0, 0, copy.width, copy.height).data;
}

/**
 * A layer bent by a displacement map, as the DisplacedDraw shader does: each pixel is read from where the map's
 * red and green point (128 is no move), and kept as much as the map's alpha.
 */
function displaced(layer, map) {
  const out = document.createElement('canvas');
  out.width = layer.width;
  out.height = layer.height;
  const source = pixels(layer);
  const offsets = mapPixels.get(map) || pixels(map);
  mapPixels.set(map, offsets);
  const ctx = out.getContext('2d');
  const image = ctx.createImageData(layer.width, layer.height);
  for (let y = 0; y < layer.height; y++) {
    for (let x = 0; x < layer.width; x++) {
      const m = (y * map.width + x) * 4;
      const alpha = offsets[m + 3];
      if (!alpha) continue;
      const sx = x + offsets[m] - 128;
      const sy = y - (offsets[m + 1] - 128);
      if (sx < 0 || sy < 0 || sx >= layer.width || sy >= layer.height) continue;
      const s = (sy * layer.width + sx) * 4;
      const o = (y * layer.width + x) * 4;
      image.data[o] = source[s];
      image.data[o + 1] = source[s + 1];
      image.data[o + 2] = source[s + 2];
      image.data[o + 3] = Math.round((source[s + 3] * alpha) / 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  return out;
}

/** A character's layers in drawing order, as [rsi, state, tint, displace]. */
function dollLayers(outfit, look) {
  const dress = OUTFITS[outfit] || { worn: [], hands: [] };
  const sex = look.female ? '_f' : '_m';
  const skin = hex(look.skin);
  const worn = dress.worn.map(([slot, rsi, state, tint]) => ({ slot, layer: [rsi, state, tint || null, slot === 'jumpsuit' && look.female] }));
  const hidden = new Set(dress.hides || []);
  const layers = [
    [PARTS, `torso${sex}`, skin], [PARTS, `head${sex}`, skin], [EYES, 'eyes', hex(look.eyes)],
    [PARTS, 'r_arm', skin], [PARTS, 'l_arm', skin], [PARTS, 'r_leg', skin], [PARTS, 'l_leg', skin],
    [...BOXERS, null],
  ];
  if (!hidden.has('UndergarmentTop')) layers.push([...UNDERSHIRT, null]);
  layers.push(...worn.filter(w => w.slot === 'jumpsuit').map(w => w.layer));
  layers.push([PARTS, 'l_foot', skin], [PARTS, 'r_foot', skin], [PARTS, 'l_hand', skin], [PARTS, 'r_hand', skin]);
  layers.push(...worn.filter(w => w.slot !== 'jumpsuit' && UNDER_HAIR.has(w.slot)).map(w => w.layer));
  const hairColour = hex(look.hairColour);
  if (look.beard && !hidden.has('FacialHair')) layers.push([FACIAL_HAIR, look.beard[1], hairColour]);
  if (!hidden.has('Hair')) layers.push([HAIR, look.hair[1], hairColour]);
  layers.push(...worn.filter(w => !UNDER_HAIR.has(w.slot)).map(w => w.layer));
  layers.push(...dress.hands.map(([rsi, state, tint]) => [rsi, state, tint || null]));
  return layers;
}

let femaleMap = null;

/** A character dressed and facing south, as a 32 by 32 canvas; resolves once its layers are read. */
export async function dollCanvas(outfit, look) {
  const appearance = lookOf(look);
  const layers = dollLayers(outfit, appearance);
  if (appearance.female && !femaleMap) femaleMap = layerCanvas(...FEMALE_JUMPSUIT, 0, null).catch(() => null);
  const map = appearance.female ? await femaleMap : null;
  const canvases = await Promise.all(layers.map(([rsi, state, tint]) => stateCanvas(rsi, state, tint)));
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  canvases.forEach((layer, i) => {
    if (!layer) return;
    ctx.drawImage(layers[i][3] && map ? displaced(layer, map) : layer, 0, 0);
  });
  return canvas;
}

// ---------------------------------------------------------------- props

/** Each prop entity's visible Sprite layers, as [rsi, state]. */
export const PROPS = {
  CMMRE: [['_RMC14/Objects/Consumable/Food/mre.rsi', 'closed']],
  CrateGenericSteel: [['Structures/Storage/Crates/generic.rsi', 'base'], ['Structures/Storage/Crates/generic.rsi', 'closed'], ['Structures/Storage/Crates/labels.rsi', 'paper']],
  DrinkMugBlack: [['Objects/Consumable/Drinks/mug_black.rsi', 'icon']],
  FoodBreadBaguette: [['Objects/Consumable/Food/Baked/bread.rsi', 'baguette']],
  FoodBurgerCheese: [['Objects/Consumable/Food/burger.rsi', 'cheese']],
  FoodCakePlain: [['Objects/Consumable/Food/Baked/cake.rsi', 'plain']],
  FoodDonutPlain: [['Objects/Consumable/Food/Baked/donut.rsi', 'plain']],
  FoodPieApple: [['Objects/Consumable/Food/Baked/pie.rsi', 'tin'], ['Objects/Consumable/Food/Baked/pie.rsi', 'apple']],
  FoodPizzaMargherita: [['Objects/Consumable/Food/Baked/pizza.rsi', 'margherita']],
  FoodSnackChips: [['Objects/Consumable/Food/snacks.rsi', 'chips']],
  FoodSnackRaisins: [['Objects/Consumable/Food/snacks.rsi', 'raisins']],
  FoodTinBeans: [['Objects/Consumable/Food/Tins/beans.rsi', 'icon']],
  LampGold: [['Objects/Misc/Lights/lampgreen.rsi', 'lampgreen']],
  Lantern: [['Objects/Tools/lantern.rsi', 'lantern']],
  MobCorgi: [['Mobs/Pets/corgi.rsi', 'corgi']],
  MobMonkey: [['Mobs/Animals/monkey.rsi', 'monkey']],
  MonkeyCube: [['Objects/Misc/monkeycube.rsi', 'cube']],
  PlushieCarp: [['Objects/Fun/Plushies/carp.rsi', 'carpplush']],
  PottedPlant1: [['Structures/Furniture/potted_plants.rsi', 'plant-01']],
  // a random spawner: its sprite is a marker, which the client hides, so the view shows nothing
  PottedPlantRandom: [],
  RMCCameraBroadcasting: [['_RMC14/Objects/Devices/broadcasting_camera.rsi', 'icon']],
  RMCFlashlight: [['_RMC14/Objects/Tools/Light/flashlight.rsi', 'flashlight']],
  RMCMobCat: [['Mobs/Pets/cat.rsi', 'cat']],
  RMCTelevision: [['_RMC14/Structures/Machines/computer.rsi', 'security_det']],
  ToyRubberDuck: [['Objects/Fun/ducky.rsi', 'icon']],
  WelderIndustrial: [['Objects/Tools/welder_industrial.rsi', 'icon']],
};


const props = new Map();

/**
 * A prop's layers, animated at their RSI delays as an EntityPrototypeView shows them: resolves to
 * [{ image, frames, total, w, h }] facing south. An entity with no sprite resolves to [].
 */
export function propLayers(prop) {
  if (props.has(prop)) return props.get(prop);
  const promise = Promise.all((PROPS[prop] || []).map(async ([rsiPath, state]) => {
    try {
      const rsi = await loadRsi(rsiPath);
      const info = rsi.states.get(state);
      if (!info) return null;
      const image = await loadStateSheet(rsi.path, state);
      const frames = stateFrames(rsi, info, image, 0);
      return { image, frames, total: frames.reduce((sum, frame) => sum + frame.delay, 0), w: rsi.size.x, h: rsi.size.y };
    } catch (e) {
      console.warn(`youtape: ${e.message}`);
      return null;
    }
  })).then(layers => layers.filter(Boolean));
  props.set(prop, promise);
  return promise;
}

/** The frame of a layer at this time, looping. */
export function frameAt(layer, time) {
  let t = layer.total > 0 ? time % layer.total : 0;
  let i = 0;
  while (i < layer.frames.length - 1 && t >= layer.frames[i].delay) {
    t -= layer.frames[i].delay;
    i++;
  }
  return layer.frames[i];
}
