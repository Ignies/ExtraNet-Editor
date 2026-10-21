// The people and props on YouTape's tapes. In game CMUTapePlayer spawns the Human species doll
// (AppearanceCMUHuman) and equips it with the scene's StartingGear, and shows each prop as an EntityPrototypeView.
// Here the doll is composited from the same RSIs, the way sports/dolls.js builds its kits, and each prop is its
// entity's Sprite layers. The tables below were worked out from the game's prototypes: each AU14GearCivilian*
// gear's equipment, slot by slot in BaseSpeciesLayers order, each item's clothingVisuals or its equipped-<SLOT>
// state (ClientClothingSystem), and its in-hand state for what the gear puts in the hands (right hand first).
// Items with no sprite for their slot (headsets, pockets) draw nothing, as in game. RSI paths are under /Textures.

import { stateCanvas } from '../sports/dolls.js';
import { loadRsi, loadStateSheet, stateFrames } from '../../sprites.js';

// AppearanceCMUHuman with HumanoidCharacterAppearance's defaults: male, the Human default skin tone, black eyes,
// bald. The same body sports/dolls.js dresses.
const PARTS = 'Mobs/Species/Human/parts.rsi';
const EYES = 'Mobs/Customization/eyes.rsi';
const SKIN = '#FFE1CC';
const EYE_COLOUR = '#000000';

/** Each outfit's layers: `under` is the jumpsuit, drawn below the hands and feet; `over` is everything after them. */
export const OUTFITS = {
  AU14GearCivilianColonist: {
    under: [],
    over: [['_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD']],
  },
  AU14GearCivilianColonyAdminAssistant: {
    under: [],
    over: [['_RMC14/Objects/Clothing/Shoes/laceup_brown.rsi', 'equipped-FEET'], ['_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD'],
      ['CMU14/Clothing/Civilian/Jacket/graypuffervest.rsi', 'equipped-OUTERCLOTHING'], ['_RMC14/Objects/Clothing/Back/Satchels/Civilians/classic.rsi', 'equipped-BACKPACK'],
      ['_RMC14/Objects/Storage/Briefcases/brown.rsi', 'inhand-right'], ['CMU14/Items/IEDs/signaller.rsi', 'advanced-inhand-left']],
  },
  AU14GearCivilianColonyAdministrator: {
    under: [],
    over: [['_RMC14/Objects/Clothing/Shoes/laceup_brown.rsi', 'equipped-FEET'], ['_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD'],
      ['_RMC14/Objects/Clothing/OuterClothing/Coats/Corporate/corporate_blue_jacket.rsi', 'equipped-OUTERCLOTHING'], ['CMU14/Items/IEDs/signaller.rsi', 'advanced-inhand-left']],
  },
  AU14GearCivilianEngineer: {
    under: [['CMU14/Clothing/Civilian/Uniforms/WeYuEngineer.rsi', 'equipped-INNERCLOTHING']],
    over: [['_RMC14/Objects/Clothing/Shoes/Boots/black.rsi', 'equipped-FEET'], ['_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD'],
      ['CMU14/Clothing/Civilian/ServiceOuterJumpsuits/wyengineer.rsi', 'equipped-OUTERCLOTHING'], ['_RMC14/Objects/Clothing/Head/Helmets/Hardhats/white.rsi', 'off-equipped-HELMET']],
  },
  AU14GearCivilianEthicsAndWellnessAdvisor: {
    under: [['CMU14/Clothing/Civilian/Uniforms/pinkworkwear.rsi', 'equipped-INNERCLOTHING']],
    over: [['_RMC14/Objects/Clothing/Shoes/Sneakers/black.rsi', 'equipped-FEET'], ['CMU14/Clothing/Civilian/Jacket/graypufferjacket.rsi', 'equipped-OUTERCLOTHING'],
      ['_RMC14/Objects/Clothing/Back/Satchels/Civilians/classic.rsi', 'equipped-BACKPACK'], ['CMU14/Items/IEDs/signaller.rsi', 'advanced-inhand-right']],
  },
  AU14GearCivilianFoodServiceWorker: {
    under: [],
    over: [['_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD'], ['_RMC14/Objects/Clothing/OuterClothing/Labcoats/medicalapron.rsi', 'equipped-OUTERCLOTHING']],
  },
  AU14GearCivilianForeman: {
    under: [['CMU14/Clothing/Civilian/Uniforms/foremanuniform.rsi', 'equipped-INNERCLOTHING']],
    over: [['_RMC14/Objects/Clothing/Shoes/Boots/black.rsi', 'equipped-FEET'], ['_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD'],
      ['_RMC14/Objects/Clothing/Head/Helmets/Hardhats/blue.rsi', 'off-equipped-HELMET'], ['CMU14/Items/IEDs/signaller.rsi', 'advanced-inhand-right']],
  },
  AU14GearCivilianFreightSystemsSpecialist: {
    under: [['CMU14/Clothing/Civilian/Uniforms/cyanboilersuit.rsi', 'equipped-INNERCLOTHING']],
    over: [['_RMC14/Objects/Clothing/Shoes/Boots/black.rsi', 'equipped-FEET'], ['_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD'],
      ['_RMC14/Objects/Clothing/OuterClothing/HazardVests/orange.rsi', 'equipped-OUTERCLOTHING'], ['_RMC14/Objects/Clothing/Head/Helmets/Hardhats/orange.rsi', 'off-equipped-HELMET'],
      ['Objects/Misc/stamps.rsi', 'stamp-inhand-right'], ['Objects/Misc/stamps.rsi', 'handle-inhand-right', '#f8f8f8']],
  },
  AU14GearCivilianHeadOfService: {
    under: [['CMU14/Clothing/Civilian/Uniforms/yellowworkwear.rsi', 'equipped-INNERCLOTHING']],
    over: [['_RMC14/Objects/Clothing/Shoes/Sneakers/black.rsi', 'equipped-FEET'], ['_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD'],
      ['_RMC14/Objects/Clothing/OuterClothing/Labcoats/medicalapron.rsi', 'equipped-OUTERCLOTHING'], ['CMU14/Items/IEDs/signaller.rsi', 'advanced-inhand-right']],
  },
  AU14GearCivilianJournalist: {
    under: [],
    over: [['CMU14/Clothing/Civilian/Jacket/tanpuffervest.rsi', 'equipped-OUTERCLOTHING'], ['CMU14/Items/IEDs/signaller.rsi', 'advanced-inhand-right']],
  },
  AU14GearCivilianMiner: {
    under: [['CMU14/Clothing/Civilian/Uniforms/kellandmininguniform.rsi', 'equipped-INNERCLOTHING']],
    over: [['_RMC14/Objects/Clothing/Shoes/Boots/black.rsi', 'equipped-FEET'], ['_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD'],
      ['CMU14/Clothing/Civilian/Jacket/HazardVests/kellandmininghazardvest.rsi', 'equipped-OUTERCLOTHING'], ['_RMC14/Objects/Clothing/Head/Helmets/Hardhats/orange.rsi', 'off-equipped-HELMET']],
  },
  AU14GearCivilianNurse: {
    under: [],
    over: [['_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD']],
  },
  // a medical headset only, which has no sprite on the ears
  AU14GearCivilianPhysician: {
    under: [],
    over: [],
  },
  AU14GearCivilianShopkeep: {
    under: [['CMU14/Clothing/Civilian/Uniforms/yellowworkwear.rsi', 'equipped-INNERCLOTHING']],
    over: [['_RMC14/Objects/Clothing/Shoes/Sneakers/black.rsi', 'equipped-FEET'], ['_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD'],
      ['_RMC14/Objects/Clothing/Back/Satchels/Civilians/classic.rsi', 'equipped-BACKPACK']],
  },
  AU14GearCivilianWasteManagementSpecialist: {
    under: [['CMU14/Clothing/Civilian/Uniforms/Sanitation.rsi', 'equipped-INNERCLOTHING']],
    over: [['_RMC14/Objects/Clothing/Shoes/Boots/black.rsi', 'equipped-FEET'], ['_RMC14/Objects/CMIDs/id.rsi', 'equipped-IDCARD'],
      ['CMU14/Clothing/Civilian/ServiceOuterJumpsuits/sanitation.rsi', 'equipped-OUTERCLOTHING']],
  },
};

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

/** The doll's layers in drawing order, as [rsi, state, tint]. */
function dollLayers(outfit) {
  const look = OUTFITS[outfit] || { under: [], over: [] };
  return [
    [PARTS, 'torso_m', SKIN], [PARTS, 'head_m', SKIN], [EYES, 'eyes', EYE_COLOUR],
    [PARTS, 'r_arm', SKIN], [PARTS, 'l_arm', SKIN], [PARTS, 'r_leg', SKIN], [PARTS, 'l_leg', SKIN],
    ...look.under.map(([rsi, state, tint]) => [rsi, state, tint || null]),
    [PARTS, 'l_foot', SKIN], [PARTS, 'r_foot', SKIN], [PARTS, 'l_hand', SKIN], [PARTS, 'r_hand', SKIN],
    ...look.over.map(([rsi, state, tint]) => [rsi, state, tint || null]),
  ];
}

const dolls = new Map();

/** A dressed doll facing south, as a 32 by 32 canvas; resolves once its layers are read. */
export function dollCanvas(outfit) {
  if (dolls.has(outfit)) return dolls.get(outfit);
  const promise = Promise.all(dollLayers(outfit).map(([rsi, state, tint]) => stateCanvas(rsi, state, tint))).then(layers => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    for (const layer of layers) if (layer) ctx.drawImage(layer, 0, 0);
    return canvas;
  });
  dolls.set(outfit, promise);
  return promise;
}

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
