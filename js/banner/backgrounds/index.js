// Banner backgrounds. Each module default-exports
//   { id, name, tags?, params: [{ key, label, type: 'color'|'range'|'select', default, min?, max?, step?, options? }],
//     draw(ctx, width, height, params, seed), group?, preload?, ready?, credit? }
// and is listed here. draw() paints the whole canvas; params holds every key with its value (defaults filled in);
// seed is a whole number for repeatable randomness (use rng(seed) below). group puts it under its own heading in the
// picker; preload() (returning a promise) and ready() let a background draw loaded files, since draw() is synchronous;
// credit is added to the banner's attributions entry. See README.md, "Banner Studio: adding art".

import solid from './solid.js';
import gradient from './gradient.js';
import scanlines from './scanlines.js';
import crt from './crt.js';
import starfield from './starfield.js';
import nebula from './nebula.js';
import synthwave from './synthwave.js';
import neonGrid from './neongrid.js';
import memphis from './memphis.js';
import plasma from './plasma.js';
import sunset from './sunset.js';
import checker from './checker.js';
import corporate from './corporate.js';
import blueprint from './blueprint.js';
import carbon from './carbon.js';
import chevrons from './chevrons.js';
import hazard from './hazard.js';
import cautionTape from './cautiontape.js';
import hull from './hull.js';
import rust from './rust.js';
import brick from './brick.js';
import camo from './camo.js';
import tracker from './tracker.js';
import circuit from './circuit.js';
import rain from './rain.js';
import staticNoise from './static.js';
import glitch from './glitch.js';
import halftone from './halftone.js';
import paper from './paper.js';
import frost from './frost.js';
import resin from './resin.js';

import sceneSkyline from './scenery/skyline.js';
import sceneDunes from './scenery/dunes.js';
import sceneJungle from './scenery/jungle.js';
import sceneAurora from './scenery/aurora.js';
import sceneShore from './scenery/shore.js';
import sceneRidge from './scenery/ridge.js';
import sceneNeonStreet from './scenery/neonstreet.js';
import sceneStationWindow from './scenery/stationwindow.js';
import sceneHangar from './scenery/hangar.js';
import sceneSwamp from './scenery/swamp.js';
import sceneNewsDesk from './scenery/newsdesk.js';
import sceneNewsroom from './scenery/newsroom.js';
import sceneWeatherMap from './scenery/weathermap.js';
import sceneOrbit from './scenery/orbit.js';
import sceneColonyPlaza from './scenery/colonyplaza.js';
import sceneLandingPad from './scenery/landingpad.js';
import sceneGalley from './scenery/galley.js';
import sceneBunk from './scenery/bunk.js';
import stageShelf from './stages/shelf.js';
import stagePedestal from './stages/pedestal.js';
import stageWindow from './stages/window.js';
import stageWorkbench from './stages/workbench.js';
import stageLocker from './stages/locker.js';
import stageCorkboard from './stages/corkboard.js';
import stageMuseumCase from './stages/museumcase.js';
import stageTvStudio from './stages/tvstudio.js';
import stageCurtain from './stages/curtain.js';
import stageDesk from './stages/desk.js';
import stageCommercial from './stages/commercial.js';
import stageTestCard from './stages/testcard.js';
import stageStandBy from './stages/standby.js';
import splitBands from './split/bands.js';
import splitDiagonal from './split/diagonal.js';
import splitStripes from './split/stripes.js';
import splitSidebar from './split/sidebar.js';
import splitChevron from './split/chevron.js';
import splitMagazine from './split/magazine.js';
import splitTicket from './split/ticket.js';
import splitCornerFlash from './split/cornerflash.js';
import splitTorn from './split/torn.js';
import splitDuotone from './split/duotone.js';
import matWood from './materials/wood.js';
import matSteel from './materials/steel.js';
import matDiamondPlate from './materials/diamondplate.js';
import matConcrete from './materials/concrete.js';
import matLeather from './materials/leather.js';
import matFelt from './materials/felt.js';
import matMarble from './materials/marble.js';
import matCork from './materials/cork.js';
import matBurlap from './materials/burlap.js';
import matTiles from './materials/tiles.js';

/** The same background under a picker heading (the module itself is left as it is). */
function inGroup(group, list) {
  return list.map(b => ({ ...b, group }));
}

export const BACKGROUNDS = [
  // No heading: the plain fills, shown first next to "Your image".
  solid,
  gradient,
  // Scenery: modules in scenery/ that set group themselves.
  sceneSkyline,
  sceneDunes,
  sceneJungle,
  sceneAurora,
  sceneShore,
  sceneRidge,
  sceneNeonStreet,
  sceneStationWindow,
  sceneHangar,
  sceneSwamp,
  sceneNewsDesk,
  sceneNewsroom,
  sceneWeatherMap,
  sceneOrbit,
  sceneColonyPlaza,
  sceneLandingPad,
  sceneGalley,
  sceneBunk,
  // Stages: modules in stages/ that set group themselves.
  stageShelf,
  stagePedestal,
  stageWindow,
  stageWorkbench,
  stageLocker,
  stageCorkboard,
  stageMuseumCase,
  stageTvStudio,
  stageCurtain,
  stageDesk,
  stageCommercial,
  stageTestCard,
  stageStandBy,
  // Split colours: modules in split/ that set group themselves.
  splitBands,
  splitDiagonal,
  splitStripes,
  splitSidebar,
  splitChevron,
  splitMagazine,
  splitTicket,
  splitCornerFlash,
  splitTorn,
  splitDuotone,
  // Materials: modules in materials/ that set group themselves.
  matWood,
  matSteel,
  matDiamondPlate,
  matConcrete,
  matLeather,
  matFelt,
  matMarble,
  matCork,
  matBurlap,
  matTiles,
  ...inGroup('Screens and signals', [scanlines, crt, rain, staticNoise, glitch, tracker, circuit, blueprint]),
  ...inGroup('Space and retro', [starfield, nebula, synthwave, neonGrid, memphis, plasma, sunset, checker]),
  ...inGroup('Industrial and textures', [corporate, carbon, chevrons, hazard, cautionTape, hull, rust, brick, camo, halftone, paper, frost, resin]),
];

export function getBackground(id) {
  return BACKGROUNDS.find(b => b.id === id) || BACKGROUNDS[0];
}

/** Every param of a background with its default, overridden by the given values. */
export function backgroundParams(background, values = {}) {
  const out = {};
  for (const p of background.params) out[p.key] = values[p.key] !== undefined ? values[p.key] : p.default;
  return out;
}

/** A small seeded random number generator (mulberry32): rng(seed)() gives 0..1, the same every time. */
export function rng(seed) {
  let a = (Number(seed) || 1) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
