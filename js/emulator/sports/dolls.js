// The people and items in the sportsbook arenas, composited from the same RSIs the game's dolls wear: the
// AppearanceCMUHuman body parts (Mobs/Species/Human/parts.rsi, male, default skin tone), its eyes
// (Mobs/Customization/eyes.rsi), and the CMUSportsKit<Role><Colour> starting gear: ClothingUniformJumpsuitColor<Colour>,
// ClothingShoesColor<Colour>, ClothingHandsGlovesBoxingRed/Blue for boxers and ClothingHeadHelmetEVA for zero-g
// players, each in its prototype's clothingVisuals colour. Balls and the bat are the Basketball, TennisBall and
// BaseBallBat icons.

import { loadRsi, loadStateSheet, stateFrames } from '../../sprites.js';
import { Colours } from './core.js';

const PARTS = 'Mobs/Species/Human/parts.rsi';
const EYES = 'Mobs/Customization/eyes.rsi';
const JUMPSUIT = 'Clothing/Uniforms/Jumpsuits/Color/color.rsi';
const SHOES = 'Clothing/Shoes/color.rsi';
const HELMET = 'Clothing/Head/Helmets/eva.rsi';
const GLOVES = ['Clothing/Hands/Gloves/Boxing/boxingred.rsi', 'Clothing/Hands/Gloves/Boxing/boxingblue.rsi'];
// HumanTonedSkinColoration.FromUnary(20), the Human species' default tone: HSV 25, 20%, 100%.
const SKIN = '#FFE1CC';
// HumanoidCharacterAppearance's default eye colour
const EYE_COLOUR = '#000000';

// clothingVisuals colours of ClothingUniformJumpsuitColor<Colour> and ClothingShoesColor<Colour>
const JUMPSUIT_TINT = {
  Red: '#eb0c07', Blue: '#52aecc', Green: '#9ed63a', Yellow: '#ffe14d', Orange: '#ff8c19', Purple: '#9f70cc', White: null, Brown: '#a17229',
};
const SHOE_TINT = {
  Red: '#940000', Blue: '#0089EF', Green: '#5ABF2F', Yellow: '#EBE216', Orange: '#EF8100', Purple: '#9C0DE1', White: '#EAE8E8', Brown: '#592D01',
};

/** Item sprites, as { rsi, state } relative to /Textures. */
export const BALL = { rsi: 'Objects/Fun/Balls/basketball.rsi', state: 'icon' };
export const TENNIS = { rsi: 'Objects/Fun/Balls/tennisball.rsi', state: 'icon' };
export const BAT = { rsi: 'Objects/Weapons/Melee/baseball_bat.rsi', state: 'icon' };

/** One layer's first frame facing a direction, tinted like a sprite layer colour (multiply, alpha kept). */
export async function layerCanvas(rsiPath, stateName, direction, tint) {
  const rsi = await loadRsi(rsiPath);
  const state = rsi.states.get(stateName);
  if (!state) throw new Error(`state "${stateName}" is not in ${rsi.path}`);
  const image = await loadStateSheet(rsi.path, stateName);
  const frame = stateFrames(rsi, state, image, Math.min(direction, state.directions - 1))[0];
  const canvas = document.createElement('canvas');
  canvas.width = rsi.size.x;
  canvas.height = rsi.size.y;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, frame.sx, frame.sy, rsi.size.x, rsi.size.y, 0, 0, rsi.size.x, rsi.size.y);
  if (tint) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(image, frame.sx, frame.sy, rsi.size.x, rsi.size.y, 0, 0, rsi.size.x, rsi.size.y);
    ctx.globalCompositeOperation = 'source-over';
  }
  return canvas;
}

/** The layers of a dressed doll in BaseSpeciesAppearance order. Roles: Runner, Boxer, Player, Spacer. */
function kitLayers(role, colour) {
  const name = Colours[colour % Colours.length];
  const layers = [
    [PARTS, 'torso_m', SKIN], [PARTS, 'head_m', SKIN], [EYES, 'eyes', EYE_COLOUR],
    [PARTS, 'r_arm', SKIN], [PARTS, 'l_arm', SKIN], [PARTS, 'r_leg', SKIN], [PARTS, 'l_leg', SKIN],
    [JUMPSUIT, 'equipped-INNERCLOTHING', JUMPSUIT_TINT[name]], [JUMPSUIT, 'trinkets-equipped-INNERCLOTHING', null],
    [PARTS, 'l_foot', SKIN], [PARTS, 'r_foot', SKIN], [PARTS, 'l_hand', SKIN], [PARTS, 'r_hand', SKIN],
  ];
  if (role === 'Boxer' && colour < 2) layers.push([GLOVES[colour], 'equipped-HAND', null]);
  layers.push([SHOES, 'equipped-FEET', SHOE_TINT[name]]);
  layers.push([SHOES, name === 'White' ? 'contrastedsoles-equipped-FEET' : 'soles-equipped-FEET', null]);
  if (role === 'Spacer') layers.push([HELMET, 'equipped-HELMET', null]);
  return layers;
}

const dollCache = new Map();

/** A composited doll facing a direction (0 south, 1 north, 2 east, 3 west), as a 32x32 canvas. */
export function dollCanvas(role, colour, direction) {
  const key = `${role}|${colour}|${direction}`;
  if (dollCache.has(key)) return dollCache.get(key);
  const promise = (async () => {
    const layers = await Promise.all(kitLayers(role, colour).map(([rsi, state, tint]) =>
      layerCanvas(rsi, state, direction, tint).catch(e => {
        console.warn(`sportsbook: ${e.message}`);
        return null;
      })));
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    for (const layer of layers) if (layer) ctx.drawImage(layer, 0, 0);
    return canvas;
  })();
  dollCache.set(key, promise);
  return promise;
}

const stateCache = new Map();

/** A state's first frame facing south, optionally tinted, cached. Null when it cannot be read. */
export function stateCanvas(rsi, state, tint = null) {
  const key = `${rsi}|${state}|${tint}`;
  if (!stateCache.has(key)) {
    stateCache.set(key, layerCanvas(rsi, state, 0, tint).catch(e => {
      console.warn(`sportsbook: ${e.message}`);
      return null;
    }));
  }
  return stateCache.get(key);
}

/** An item's icon, as a canvas. */
export function itemCanvas(item) {
  return stateCanvas(item.rsi, item.state);
}

/** Resolved images by key, so the frame loop draws whatever has loaded. */
const ready = new Map();

/** The image under key once its promise has resolved; null until then. */
export function readyImage(key, promise) {
  if (ready.has(key)) return ready.get(key);
  ready.set(key, null);
  promise().then(canvas => ready.set(key, canvas));
  return null;
}
