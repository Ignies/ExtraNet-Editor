// Game data the emulator needs: the operating systems, colonies, wallpapers and locale strings, read from the
// repository like the rest of the editor, with the shipped values as a fallback when a file cannot be read.

import { parseYaml } from '../yaml.js';
import { fetchRepoFile, locale } from '../repo.js';
import { PROTOTYPES, fill } from '../library.js';
import { rgba, mix } from '../util.js';

const FALLBACK_OS = [
  { id: 'CMUOsSeegson', name: 'cmu-os-seegson-name', allowGuests: true, shell: 'Seegson', startLabel: 'cmu-os-seegson-start', namedAfterColony: true, logos: ['/Textures/CMU14/PersonalComputers/Logos/seegson.png', 'name'], documents: [{ name: 'README.TXT', path: '/ServerInfo/CMU14/ExtraNet/Documents/seegson_readme.xml' }], homePage: 'colony.seegson.net', networks: ['CMUNetPublic'], phosphor: '#3FE05A', background: '#0A0E12', bootLines: [1, 2, 3, 4, 5, 6].map(i => `cmu-os-seegson-boot-${i}`) },
  { id: 'CMUOsWeyland', name: 'cmu-os-weyland-name', shell: 'Weyland', startLabel: 'cmu-os-weyland-start', logos: ['/Textures/CMU14/PersonalComputers/Logos/weyland.png'], documents: [{ name: 'SECURITY.DOC', path: '/ServerInfo/CMU14/ExtraNet/Documents/weyland_security.xml' }], homePage: 'intranet.wy', casing: 'Weyland', networks: ['CMUNetPublic', 'CMUNetWeylandYutani'], phosphor: '#FFB547', background: '#120A02', bootLines: [1, 2, 3, 4, 5, 6].map(i => `cmu-os-weyland-boot-${i}`) },
  { id: 'CMUOsCMB', name: 'cmu-os-cmb-name', startLabel: 'cmu-os-cmb-start', homePage: 'cmb.bureau', casing: 'Cmb', networks: ['CMUNetPublic', 'CMUNetCMB'], phosphor: '#8FC4FF', background: '#050A14', bootLines: [1, 2, 3].map(i => `cmu-os-cmb-boot-${i}`) },
];

const FALLBACK_COLONIES = ['StableGarrison', 'BarkersLament', 'BosenmoriBasho', 'ChancesClaim', 'CorsatStation', 'Daybreak', 'Fiorina',
  'Flight', 'FortMcNeil', 'GixensCaverns', 'GreenHell', 'HopesRetreat', 'Hybrisa', 'Kutjevo', 'OxleysButte', 'PortNereid', 'ShepherdsPride',
  'ShivasSnowball', 'SolarisGulch', 'SolarisRidge', 'SorokyneStrata'];

export async function prototypes(file, type) {
  const { data } = await fetchRepoFile(PROTOTYPES + file, 'text');
  const { value } = parseYaml(data);
  return (Array.isArray(value) ? value : []).filter(v => v && v.type === type);
}

let loaded = null;

/** { strings, systems: [os], colonies: [{ id, name }], wallpapers: Map, deepOs } */
export function gameData() {
  if (!loaded) {
    loaded = (async () => {
      const [strings, systems, colonies, wallpapers, deep] = await Promise.all([
        locale().catch(() => ({})),
        prototypes('operating_systems.yml', 'cmuComputerOs').catch(() => FALLBACK_OS),
        prototypes('colonies.yml', 'cmuNetColony').then(list => list.map(c => c.id)).catch(() => FALLBACK_COLONIES),
        prototypes('wallpapers.yml', 'cmuWallpaper').catch(() => []),
        prototypes('deep_web.yml', 'cmuComputerOs').catch(() => []),
      ]);
      const ids = [...new Set(['StableGarrison', ...colonies])].sort((a, b) => a.localeCompare(b));
      return {
        strings,
        systems: systems.length ? systems : FALLBACK_OS,
        colonies: ids.map(id => ({ id, name: colonyName(id) })),
        wallpapers: new Map(wallpapers.map(w => [w.id, w])),
        deepOs: deep[0] || { id: 'CMUOsDeeps', name: 'cmu-os-deeps-name', phosphor: '#E0303A', background: '#0A0405' },
      };
    })();
    loaded.catch(() => {
      loaded = null;
    });
  }
  return loaded;
}

/** "StableGarrison" -> "Stable Garrison", "OxleysButte" -> "Oxleys Butte". */
export function colonyName(id) {
  return id.replace(/([a-z])([A-Z])/g, '$1 $2');
}

const GENERIC = new Set(['the', 'stable', 'fort', 'port', 'new', 'old', 'upper', 'lower', 'camp', 'station', 'outpost', 'colony']);

/** CMUComputerOsPrototype.ColonyLink: the colony's most telling word plus LINK. */
export function colonyLink(name) {
  const words = name.replace(/'s/gi, '').split(/[\s\-_]+/).map(w => w.replace(/[^A-Za-z0-9]/g, '')).filter(Boolean);
  const word = words.find(w => !GENERIC.has(w.toLowerCase())) || words[0] || 'COLONY';
  return word.toUpperCase() + 'LINK';
}

/** A string from the game's locale, with {$vars} filled. */
export function L(strings, id, vars) {
  return fill(strings[id] ?? id, vars);
}

function hex(c) {
  const v = c.map(x => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0'));
  return `#${v.slice(0, 3).join('')}`;
}

/** CMUComputerShell: how the desktop is laid out. */
const SHELLS = ['Classic', 'Seegson', 'Weyland'];

/** CMUComputerTheme for an OS: colours, names, casing and the desktop shell. */
export function theme(os, strings, colony) {
  const phosphor = rgba(os.phosphor) || [0.25, 0.88, 0.35, 1];
  const background = rgba(os.background) || [0.04, 0.05, 0.07, 1];
  const accent = rgba(os.accent || os.phosphor) || phosphor;
  let name = L(strings, os.name);
  if (os.namedAfterColony && colony) name = colonyLink(colony.name);
  return {
    os,
    id: os.id,
    name,
    startLabel: L(strings, os.startLabel || os.name),
    phosphor: hex(phosphor),
    background: hex(background),
    accent: hex(accent),
    dim: hex(mix(background, phosphor, 0.45)),
    text: hex(mix(phosphor, [1, 1, 1, 1], 0.15)),
    heading: hex(mix(phosphor, [1, 1, 1, 1], 0.35)),
    // between the phosphor and white, for what the shell lifts out: headers and highlights
    bright: hex(mix(phosphor, [1, 1, 1, 1], 0.55)),
    shell: SHELLS.includes(os.shell) ? os.shell : 'Classic',
    bar: hex(mix(background, accent, 0.12)),
    casing: (os.casing || 'Seegson').toLowerCase(),
    home: os.homePage || '',
    networks: os.networks || ['CMUNetPublic'],
    logos: os.logos || ['name'],
    documents: os.documents || [],
    bootLines: (os.bootLines || []).map(id => L(strings, id)),
    // CMUComputerOsPrototype.AllowGuests: its login screen offers BROWSE AS GUEST (the colony's own OS does)
    allowGuests: os.allowGuests === true || String(os.allowGuests).toLowerCase() === 'true',
  };
}
