// Browser ports of the ExtraNet page widgets that the game draws itself: the SpaceGPT chat, the colony cookbook,
// the deep market and the Marshals' panels. In game these talk to the server; here they run on their own with
// data read from the repository (answers, recipes, handles) or clearly marked sample data.
//
// Sources: Content.CMU/Client/PersonalComputers/CMUSpaceGptUi.cs, CMUNetRecipes.cs, CMUNetCmbPanel.cs and
// DeepWeb/CMUNetMarket.cs.

import { fetchRepoFile, locale, scanPrototypes } from '../repo.js';
import { spriteCanvas } from '../sprites.js';
import { parseYaml } from '../yaml.js';

// ---------------------------------------------------------------- data files

const PC_PROTOTYPES = 'Content.CMU/Resources/Prototypes/CMU14/PersonalComputers/';
const NETWORKS_FILE = PC_PROTOTYPES + 'networks.yml';
const DEEP_WEB_FILE = PC_PROTOTYPES + 'deep_web.yml';

/**
 * The files holding the game's microwave food recipes (type microwaveMealRecipe). The third such file,
 * Resources/Prototypes/Recipes/Cooking/medical_recipes.yml, is medicine and is deliberately never read.
 */
const RECIPE_FILES = [
  'Resources/Prototypes/Recipes/Cooking/meal_recipes.yml',
  'Resources/Prototypes/_RMC14/Recipes/Cooking/meal_recipes.yml',
];

/** Groups that are never shown: medicine, and recipes the game itself hides. */
const HIDDEN_GROUPS = new Set(['Medicinal', 'Secret']);

/**
 * The entity prototype files defining every recipe result, every solid ingredient, the microwave, and all their
 * parents (names and sprites are inherited), found by scanning the repository.
 */
const ENTITY_FILES = [
  'Resources/Prototypes/Body/Animals/animal.yml',
  'Resources/Prototypes/Body/Animals/mothroach.yml',
  'Resources/Prototypes/Body/Species/human.yml',
  'Resources/Prototypes/Body/base_organs.yml',
  'Resources/Prototypes/Entities/Clothing/Head/base_clothinghead.yml',
  'Resources/Prototypes/Entities/Clothing/Head/hats.yml',
  'Resources/Prototypes/Entities/Clothing/Head/misc.yml',
  'Resources/Prototypes/Entities/Clothing/Masks/base_clothingmask.yml',
  'Resources/Prototypes/Entities/Clothing/Masks/masks.yml',
  'Resources/Prototypes/Entities/Clothing/Shoes/base_clothingshoes.yml',
  'Resources/Prototypes/Entities/Clothing/Shoes/specific.yml',
  'Resources/Prototypes/Entities/Clothing/base_clothing.yml',
  'Resources/Prototypes/Entities/Mobs/NPCs/animals.yml',
  'Resources/Prototypes/Entities/Mobs/NPCs/moproach.yml',
  'Resources/Prototypes/Entities/Mobs/NPCs/simplemob.yml',
  'Resources/Prototypes/Entities/Mobs/NPCs/space.yml',
  'Resources/Prototypes/Entities/Mobs/base.yml',
  'Resources/Prototypes/Entities/Objects/Consumable/Food/Baked/bagel.yml',
  'Resources/Prototypes/Entities/Objects/Consumable/Food/Baked/bread.yml',
  'Resources/Prototypes/Entities/Objects/Consumable/Food/Baked/cake.yml',
  'Resources/Prototypes/Entities/Objects/Consumable/Food/Baked/donkpocket.yml',
  'Resources/Prototypes/Entities/Objects/Consumable/Food/Baked/misc.yml',
  'Resources/Prototypes/Entities/Objects/Consumable/Food/Baked/pie.yml',
  'Resources/Prototypes/Entities/Objects/Consumable/Food/Baked/pizza.yml',
  'Resources/Prototypes/Entities/Objects/Consumable/Food/Containers/bowl.yml',
  'Resources/Prototypes/Entities/Objects/Consumable/Food/Containers/plate.yml',
  'Resources/Prototypes/Entities/Objects/Consumable/Food/breakfast.yml',
  'Resources/Prototypes/Entities/Objects/Consumable/Food/burger.yml',
  'Resources/Prototypes/Entities/Objects/Consumable/Food/cottonburger.yml',
  'Resources/Prototypes/Entities/Objects/Consumable/Food/food_base.yml',
  'Resources/Prototypes/Entities/Objects/Consumable/Food/ingredients.yml',
  'Resources/Prototypes/Entities/Objects/Consumable/Food/meals.yml',
  'Resources/Prototypes/Entities/Objects/Consumable/Food/meat.yml',
  'Resources/Prototypes/Entities/Objects/Consumable/Food/noodles.yml',
  'Resources/Prototypes/Entities/Objects/Consumable/Food/produce.yml',
  'Resources/Prototypes/Entities/Objects/Consumable/Food/skewer.yml',
  'Resources/Prototypes/Entities/Objects/Consumable/Food/snacks.yml',
  'Resources/Prototypes/Entities/Objects/Consumable/Food/soup.yml',
  'Resources/Prototypes/Entities/Objects/Consumable/Food/taco.yml',
  'Resources/Prototypes/Entities/Objects/Fun/crayons.yml',
  'Resources/Prototypes/Entities/Objects/Fun/sound_maker.yml',
  'Resources/Prototypes/Entities/Objects/Fun/sports.yml',
  'Resources/Prototypes/Entities/Objects/Materials/Sheets/other.yml',
  'Resources/Prototypes/Entities/Objects/Materials/base.yml',
  'Resources/Prototypes/Entities/Objects/Materials/materials.yml',
  'Resources/Prototypes/Entities/Objects/Materials/parts.yml',
  'Resources/Prototypes/Entities/Objects/Materials/shards.yml',
  'Resources/Prototypes/Entities/Objects/Misc/intermediate_parts.yml',
  'Resources/Prototypes/Entities/Objects/Misc/machine_parts.yml',
  'Resources/Prototypes/Entities/Objects/Misc/spaceshroom.yml',
  'Resources/Prototypes/Entities/Objects/Specific/Hydroponics/leaves.yml',
  'Resources/Prototypes/Entities/Objects/Specific/Hydroponics/seeds.yml',
  'Resources/Prototypes/Entities/Objects/Specific/Medical/morgue.yml',
  'Resources/Prototypes/Entities/Objects/Specific/rehydrateable.yml',
  'Resources/Prototypes/Entities/Objects/Tools/flare.yml',
  'Resources/Prototypes/Entities/Objects/Weapons/Melee/baguette.yml',
  'Resources/Prototypes/Entities/Objects/Weapons/Melee/baseball_bat.yml',
  'Resources/Prototypes/Entities/Objects/Weapons/Melee/knife.yml',
  'Resources/Prototypes/Entities/Objects/Weapons/Melee/sword.yml',
  'Resources/Prototypes/Entities/Objects/Weapons/Throwable/croissant.yml',
  'Resources/Prototypes/Entities/Objects/base_contraband.yml',
  'Resources/Prototypes/Entities/Objects/base_foldable.yml',
  'Resources/Prototypes/Entities/Objects/base_item.yml',
  'Resources/Prototypes/Entities/Objects/base_solution.yml',
  'Resources/Prototypes/Entities/Structures/Bases/structure_health.yml',
  'Resources/Prototypes/Entities/Structures/Machines/base_structuremachines.yml',
  'Resources/Prototypes/Entities/Structures/Machines/microwave.yml',
  'Resources/Prototypes/Entities/Structures/Specific/Anomaly/cores.yml',
  'Resources/Prototypes/Entities/Structures/base_structure.yml',
  'Resources/Prototypes/_RMC14/Entities/Objects/Consumables/Food/donuts.yml',
  'Resources/Prototypes/_RMC14/Entities/Objects/Consumables/Food/food.yml',
  'Resources/Prototypes/_RMC14/Entities/Objects/Consumables/Food/golden_apple.yml',
  'Resources/Prototypes/_RMC14/Entities/Objects/Consumables/Food/meat.yml',
  'Resources/Prototypes/_RMC14/Entities/Objects/Consumables/Food/pizza.yml',
  'Resources/Prototypes/_RMC14/Entities/Structures/Base/base_structure.yml',
  'Resources/Prototypes/_RMC14/Entities/Structures/Machines/microwave.yml',
  'Resources/Prototypes/_RMC14/Kitchen/Plants/produce.yml',
];

const MICROWAVE_ID = 'CMMicrowave';
const MICROWAVE_FALLBACK = { rsi: '_RMC14/Structures/Machines/microwave.rsi', state: 'mw0' };
const RECIPE_PAGE = 12;

// ---------------------------------------------------------------- locale

const FALLBACK = {
  'cmu-spacegpt-placeholder': 'Ask SpaceGPT anything...',
  'cmu-spacegpt-ask': 'ASK',
  'cmu-spacegpt-greeting': 'SpaceGPT: Hello, colonist. How can I help you today?',
  'cmu-spacegpt-you': 'You: {$question}',
  'cmu-spacegpt-thinking': 'SpaceGPT is thinking...',
  'cmu-spacegpt-answer': 'SpaceGPT: {$answer}',
  'cmu-spacegpt-votes': '({$votes} {$votes -> [one] voice *[other] voices } agreed)',
  'cmu-spacegpt-no-votes': '(the line was quiet; SpaceGPT answered alone)',
  'cmu-net-recipes-search': 'Search recipes or ingredients...',
  'cmu-net-recipes-more': 'Show more',
  'cmu-net-recipes-count': '{$shown} of {$total}',
  'cmu-net-recipes-seconds': '{$seconds} sec',
  'cmu-market-offline': 'Connecting to the market...',
  'cmu-market-empty': 'Nothing for sale. Check back later.',
  'cmu-market-listing': '{$title} (from {$seller})',
  'cmu-market-buy': 'Buy ${$price}',
  'cmu-market-bought': 'Your pickups',
  'cmu-market-drop': '{$title}: {$drop}',
  'cmu-market-sell': 'List something',
  'cmu-market-title': 'What is it',
  'cmu-market-description': 'A few words about it',
  'cmu-market-price': 'Price',
  'cmu-market-drop-placeholder': 'Where to pick it up',
  'cmu-market-list': 'List it',
  'cmu-market-mail-subject': 'Your order: {$title}',
  'cmu-cmb-loading': 'Querying the bureau...',
  'cmu-cmb-alerts-empty': 'No lookups reported this shift.',
  'cmu-cmb-alert': '{$time} TERMINAL #{$id} at {$location} looked up {$address}',
  'cmu-cmb-faxes-empty': 'No faxes received this shift.',
  'cmu-cmb-fax': '{$time} {$from} to {$to}: {$title}',
  'cmu-cmb-records-empty': 'No records on file.',
  'cmu-cmb-record': '{$name} | {$status}',
  'cmu-cmb-record-reason': 'Reason: {$reason}',
  'cmu-cmb-record-history': 'History: {$history}',
  'cmu-cmb-map-none': 'This terminal is not on a colony grid.',
  'cmu-cmb-map-terminal': 'Terminal #{$id}',
  'cmu-cmb-trace-found': 'TRACE COMPLETE: logged in as {$name}',
  'cmu-cmb-trace-lost': 'TRACE LOST: the session ended first',
  'cmu-cmb-trace-alert': '{$time} TERMINAL #{$id} ({$location}) {$result}',
  'cmu-cmb-map-hint': 'Click a terminal to trace whoever is logged in to it.',
};

let localePromise = null;

/** The PC locale strings, or an empty table when the repository cannot be reached. */
function strings() {
  if (!localePromise) localePromise = locale().catch(() => ({}));
  return localePromise;
}

/** Picks a Fluent select variant: exact number, then plural category, then the starred default. */
function selectVariant(body, value) {
  const variants = [];
  const re = /(\*?)\[([^\]]+)\]\s*([^[*]*)/g;
  let m;
  while ((m = re.exec(body))) variants.push({ star: !!m[1], key: m[2].trim(), text: m[3].trim() });
  const n = Number(value);
  const category = n === 1 ? 'one' : 'other';
  const pick = variants.find(v => v.key === String(value))
    || variants.find(v => v.key === category)
    || variants.find(v => v.star)
    || variants[0];
  return pick ? pick.text : '';
}

/** A locale string with {$name} arguments and simple selects filled in. */
function fmt(table, key, args = {}) {
  let text = table[key] ?? FALLBACK[key] ?? key;
  // The editor's light Fluent reader drops a select's closing line; use the built in copy then.
  if (/->[^}]*$/.test(text) && FALLBACK[key]) text = FALLBACK[key];
  text = text.replace(/\{\s*\$(\w+)\s*->([^}]*)\}/g, (_, name, body) => selectVariant(body, args[name]));
  return text.replace(/\{\s*\$(\w+)\s*\}/g, (_, name) => (args[name] ?? '') + '');
}

// ---------------------------------------------------------------- shared helpers

function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'style') node.style.cssText = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

const CSS = `
.emu-w-root{--emu-w-alpha:rgba(0,0,0,.35);box-sizing:border-box;width:100%;max-width:560px;margin:6px 0;
  color:var(--emu-w-text);font:inherit;line-height:1.35;position:relative;text-align:left}
.emu-w-root *{box-sizing:border-box}
.emu-w-col{display:flex;flex-direction:column;gap:6px}
.emu-w-row{display:flex;flex-direction:row;gap:6px;align-items:center;min-width:0}
.emu-w-grow{flex:1 1 auto;min-width:0}
.emu-w-clip{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.emu-w-plain{white-space:pre-wrap;overflow-wrap:anywhere}
.emu-w-dim{opacity:.6}
.emu-w-key{color:var(--emu-w-head);font-weight:bold}
.emu-w-sample{font-size:.8em;letter-spacing:.08em;color:var(--emu-w-link);border:1px dashed var(--emu-w-link);
  padding:2px 6px;align-self:flex-start;opacity:.85}
.emu-w-input{flex:1 1 auto;min-width:0;background:rgba(0,0,0,.45);color:var(--emu-w-text);
  border:1px solid rgba(255,255,255,.3);padding:4px 6px;font:inherit}
.emu-w-input:focus{outline:1px solid var(--emu-w-ph)}
.emu-w-input.emu-w-bad{border-color:#e0303a}
.emu-w-btn{background:rgba(255,255,255,.08);color:var(--emu-w-text);border:1px solid rgba(255,255,255,.35);
  padding:3px 10px;font:inherit;cursor:pointer;white-space:nowrap}
.emu-w-btn:hover:not(:disabled){background:rgba(255,255,255,.16);border-color:var(--emu-w-ph)}
.emu-w-btn:disabled{opacity:.45;cursor:default}
.emu-w-btn.emu-w-on{background:rgba(255,255,255,.2);border-color:var(--emu-w-ph)}
.emu-w-panel{background:var(--emu-w-alpha);border:1px solid rgba(255,255,255,.3)}
.emu-w-log{min-height:160px;max-height:320px;overflow-y:auto;padding:6px 8px;display:flex;flex-direction:column;gap:4px}
.emu-w-notice{border:1px solid var(--emu-w-link);color:var(--emu-w-link);padding:4px 8px;background:rgba(0,0,0,.3)}
.emu-w-card{background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.15)}
.emu-w-card-head{background:rgba(255,255,255,.07);padding:4px 6px;display:flex;gap:6px;align-items:center}
.emu-w-card-body{display:flex;flex-direction:row}
.emu-w-ings{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px;padding:4px 8px}
.emu-w-method{min-width:90px;margin-right:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  text-align:center}
.emu-w-icon{display:inline-flex;align-items:center;justify-content:center;flex:none}
.emu-w-icon canvas{image-rendering:pixelated;display:block}
.emu-w-vial{display:inline-block;flex:none;border:1px solid rgba(255,255,255,.6);background:#808080}
.emu-w-link{border-bottom:1px dashed currentColor;cursor:pointer}
.emu-w-link:hover{color:var(--emu-w-link)}
.emu-w-tip{position:absolute;z-index:20;max-width:340px;background:#202226;border:1px solid rgba(255,255,255,.3);
  pointer-events:none;display:none}
.emu-w-select{background:rgba(0,0,0,.45);color:var(--emu-w-text);border:1px solid rgba(255,255,255,.3);font:inherit;padding:3px}
.emu-w-rule{border:0;border-top:1px solid rgba(255,255,255,.15);margin:4px 0;width:100%}
.emu-w-map{width:100%;height:420px;display:block;background:#071018;border:1px solid rgba(255,255,255,.2)}
.emu-w-pin{cursor:pointer}
.emu-w-pin:hover circle{stroke:#fff;stroke-width:2}
@keyframes emu-w-blink{50%{opacity:.25}}
.emu-w-blink{animation:emu-w-blink 1s step-start infinite}
.emu-w-red{color:#e0303a}
`;

/** A widget root carrying its own stylesheet and the page colours as variables. */
function makeRoot(kind, options = {}) {
  const text = options.text || '#d6e4f5';
  const root = h('div', { class: `emu-w-root emu-w-${kind}` });
  root.style.setProperty('--emu-w-text', text);
  root.style.setProperty('--emu-w-bg', options.background || '#0b0f14');
  root.style.setProperty('--emu-w-link', options.link || '#f2c94c');
  root.style.setProperty('--emu-w-head', options.heading || '#8fc4ff');
  root.style.setProperty('--emu-w-ph', options.phosphor || text);
  root.append(h('style', { text: CSS }));
  return root;
}

/** Timers that stop themselves once the widget has been on the page and is taken off it. */
function lifetime(root) {
  const timers = new Set();
  let seen = false;
  let dead = false;
  const stop = () => {
    dead = true;
    for (const id of timers) {
      clearTimeout(id);
      clearInterval(id);
    }
    timers.clear();
  };
  const alive = () => {
    if (dead) return false;
    if (root.isConnected) {
      seen = true;
      return true;
    }
    if (seen) {
      stop();
      return false;
    }
    return true;
  };
  // A slow watchdog so a widget with no pending timers still notices it was removed.
  const watch = setInterval(() => alive(), 2000);
  timers.add(watch);
  return {
    alive,
    stop,
    timeout(fn, ms) {
      const id = setTimeout(() => {
        timers.delete(id);
        if (alive()) fn();
      }, ms);
      timers.add(id);
      return id;
    },
    interval(fn, ms) {
      const id = setInterval(() => {
        if (alive()) fn();
      }, ms);
      timers.add(id);
      return id;
    },
  };
}

function storageGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private windows and blocked storage: the widget keeps working for this visit.
  }
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function normalize(text) {
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

function unquote(value) {
  const v = value.replace(/\s+#.*$/, '').trim();
  if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v[v.length - 1] === v[0]) {
    if (v[0] === '"') {
      try {
        return JSON.parse(v);
      } catch {
        return v.slice(1, -1);
      }
    }
    return v.slice(1, -1).replace(/''/g, "'");
  }
  return v;
}

/** Top level prototype blocks of a YAML file. */
function blocks(text) {
  return normalize(text).split(/\n(?=- )/);
}

// ---------------------------------------------------------------- 1. SpaceGPT

const FALLBACK_ANSWERS = [
  'It is certain.',
  'Reply hazy. Check your antenna.',
  'My sources say no.',
  'The Company already knows.',
  'Have you tried turning it off and on again?',
  'Error: the dead are not available right now.',
];

/** The roster the ghosts choose from: the CMUSpaceGptAnswers localized dataset. */
async function spaceGptRoster() {
  const table = await strings();
  let prefix = 'cmu-spacegpt-answer-';
  let count = 0;
  try {
    const { data } = await fetchRepoFile(NETWORKS_FILE, 'text');
    for (const block of blocks(data)) {
      if (!/^\s*id:\s*CMUSpaceGptAnswers\s*$/m.test(block)) continue;
      prefix = unquote((/^\s+prefix:\s*(.+)$/m.exec(block) || [])[1] || prefix);
      count = Number((/^\s+count:\s*(\d+)/m.exec(block) || [])[1] || 0);
    }
  } catch {
    // Offline: count whatever answers the locale has.
  }
  const answers = [];
  if (count > 0) {
    for (let i = 1; i <= count; i++) if (table[prefix + i]) answers.push(table[prefix + i]);
  } else {
    for (let i = 1; table[prefix + i]; i++) answers.push(table[prefix + i]);
  }
  return answers.length ? answers : FALLBACK_ANSWERS;
}

/**
 * The SpaceGPT chat, <CMUNetSpaceGpt/>. In game the question goes to the server and the dead vote on an answer
 * from the roster; here a short thinking pause plays and an answer is drawn from the same roster.
 */
export function createSpaceGpt(options = {}) {
  const root = makeRoot('gpt', options);
  const life = lifetime(root);
  const log = h('div', { class: 'emu-w-log' });
  const input = h('input', { class: 'emu-w-input', type: 'text', maxlength: '140' });
  const ask = h('button', { class: 'emu-w-btn', type: 'button' });
  const box = h('div', { class: 'emu-w-col' },
    h('div', { class: 'emu-w-panel' }, log),
    h('div', { class: 'emu-w-row' }, input, ask),
    h('div', { class: 'emu-w-dim', style: 'font-size:.8em', text: 'Emulator: answers are drawn at random from the game\'s roster. In game, ghosts vote on them.' }));
  root.append(box);

  let table = {};
  let roster = FALLBACK_ANSWERS;
  let waiting = false;
  const line = (text, cls) => {
    log.append(h('div', { class: 'emu-w-plain' + (cls ? ' ' + cls : ''), text }));
    log.scrollTop = log.scrollHeight;
  };

  const submit = () => {
    const text = input.value.trim();
    if (!text || waiting || text.length > 140) return;
    waiting = true;
    ask.disabled = true;
    input.value = '';
    line(fmt(table, 'cmu-spacegpt-you', { question: text }));
    const thinking = h('div', { text: fmt(table, 'cmu-spacegpt-thinking') });
    log.append(thinking);
    log.scrollTop = log.scrollHeight;
    life.timeout(() => {
      waiting = false;
      ask.disabled = false;
      thinking.remove();
      line(fmt(table, 'cmu-spacegpt-answer', { answer: pick(roster) }));
      const votes = Math.random() < 0.4 ? 0 : 1 + Math.floor(Math.random() * 4);
      line(votes > 0 ? fmt(table, 'cmu-spacegpt-votes', { votes }) : fmt(table, 'cmu-spacegpt-no-votes'), 'emu-w-dim');
    }, 1800 + Math.random() * 2700);
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') submit();
  });
  input.addEventListener('input', () => input.classList.toggle('emu-w-bad', input.value.length > 140));
  ask.addEventListener('click', submit);

  const label = () => {
    input.placeholder = fmt(table, 'cmu-spacegpt-placeholder');
    ask.textContent = fmt(table, 'cmu-spacegpt-ask');
  };
  label();
  const greeting = h('div', { text: fmt(table, 'cmu-spacegpt-greeting') });
  log.append(greeting);
  strings().then(t => {
    table = t;
    label();
    greeting.textContent = fmt(table, 'cmu-spacegpt-greeting');
  });
  spaceGptRoster().then(r => (roster = r)).catch(() => {});
  return root;
}

// ---------------------------------------------------------------- 2. Recipes

/** "FoodBreadBun" -> "bread bun", for things whose prototype could not be read. */
function prettyId(id) {
  const core = id.replace(/^(RMC|CMU|CM)(?=[A-Z])/, '').replace(/^(Food|Organ)(?=[A-Z])/, '') || id;
  return core
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .toLowerCase();
}

/** Reads the fields the cookbook needs from one recipe entry, whatever reader produced it. */
function recipeFrom(entry) {
  const map = value => {
    const out = [];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [key, amount] of Object.entries(value)) out.push([key, Number(amount) || 0]);
    }
    return out;
  };
  return {
    id: String(entry.id || ''),
    name: String(entry.name || ''),
    result: String(entry.result || ''),
    time: entry.time != null ? Number(entry.time) : 5,
    group: String(entry.group || 'Other'),
    secret: String(entry.secretRecipe) === 'true',
    solids: map(entry.solids),
    reagents: map(entry.reagents),
  };
}

/** Line based fallback for recipe files the small YAML reader refuses. */
function scanRecipes(text) {
  const out = [];
  for (const block of blocks(text)) {
    if (!/^- type:\s*microwaveMealRecipe\b/.test(block)) continue;
    const entry = {};
    let section = null;
    for (const raw of block.split('\n')) {
      const line = raw.replace(/^- /, '  ');
      let m = /^ {2}(\w+):\s*(.*)$/.exec(line);
      if (m) {
        const value = unquote(m[2]);
        if (value === '' && (m[1] === 'solids' || m[1] === 'reagents')) {
          section = m[1];
          entry[section] = {};
        } else {
          section = null;
          entry[m[1]] = value;
        }
        continue;
      }
      m = /^ {4}(\w+):\s*([\d.]+)/.exec(line);
      if (m && section) entry[section][m[1]] = m[2];
    }
    out.push(entry);
  }
  return out;
}

function parseRecipeFile(text) {
  let entries;
  try {
    const { value } = parseYaml(normalize(text));
    if (!Array.isArray(value)) throw new Error('not a list');
    entries = value.filter(e => e && e.type === 'microwaveMealRecipe');
  } catch {
    entries = scanRecipes(text);
  }
  return entries.map(recipeFrom);
}

/**
 * Entity prototypes, read line by line (entity files use !type: tags the small reader does not take):
 * id, parents, name, and the Sprite and Icon components' rsi and first state.
 */
function scanEntities(text, into) {
  for (const block of blocks(text)) {
    if (!/^- type:\s*entity\b/.test(block) && !/^ {2}type:\s*entity\s*$/m.test(block)) continue;
    const lines = block.split('\n').map(l => l.replace(/^- /, '  '));
    const entity = { parents: [], name: null, sprite: null, state: null, layers: null, icon: null, iconState: null };
    let listKey = null;
    let comp = null;
    let compIndent = -1;
    let inLayers = false;
    let layerIndent = -1;
    let layer = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const indent = line.length - line.trimStart().length;
      const top = /^ {2}(\w+):\s*(.*)$/.exec(line);
      if (top) {
        listKey = null;
        comp = null;
        const [, key, rawValue] = top;
        const value = unquote(rawValue);
        if (key === 'id') entity.id = value;
        else if (key === 'name') entity.name = value;
        else if (key === 'parent') {
          if (value.startsWith('[')) entity.parents = value.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
          else if (value) entity.parents = [value];
          else listKey = 'parent';
        } else if (key === 'components') listKey = 'components';
        continue;
      }
      if (listKey === 'parent') {
        const m = /^\s+- (\S+)/.exec(line);
        if (m) entity.parents.push(unquote(m[1]));
        continue;
      }
      if (listKey !== 'components') continue;
      const item = /^(\s*)- type:\s*(\S+)/.exec(line);
      if (item && (compIndent < 0 || item[1].length === compIndent)) {
        compIndent = item[1].length;
        comp = item[2];
        inLayers = false;
        layer = null;
        continue;
      }
      if (comp !== 'Sprite' && comp !== 'Icon') continue;
      const propIndent = compIndent + 2;
      const prop = /^(\s*)(\w+):\s*(.*)$/.exec(line);
      if (prop && prop[1].length === propIndent) {
        inLayers = prop[2] === 'layers';
        layer = null;
        layerIndent = -1;
        const value = unquote(prop[3]);
        if (prop[2] === 'sprite') {
          if (comp === 'Icon') entity.icon = value;
          else entity.sprite = value;
        } else if (prop[2] === 'state') {
          if (comp === 'Icon') entity.iconState = value;
          else if (!entity.state) entity.state = value;
        }
        continue;
      }
      if (comp !== 'Sprite' || !inLayers || indent < propIndent) continue;
      const start = /^(\s*)- (.*)$/.exec(line);
      let body = null;
      if (start && (layerIndent < 0 || start[1].length === layerIndent)) {
        layerIndent = start[1].length;
        layer = {};
        (entity.layers ??= []).push(layer);
        body = start[2];
      } else if (layer) {
        body = line.trim();
      }
      if (!layer || body == null) continue;
      const kv = /^(\w+):\s*(.*)$/.exec(body);
      if (!kv) continue;
      if (kv[1] === 'state' || kv[1] === 'sprite' || kv[1] === 'visible') layer[kv[1]] = unquote(kv[2]);
    }
    // Layers that draw something: a plain state, not hidden. Frame0 of the prototype shows them stacked.
    if (entity.layers) {
      entity.layers = entity.layers.filter(l => l.state && l.visible !== 'false' && !/^[[{]/.test(l.state));
      if (!entity.layers.length) entity.layers = null;
    }
    if (entity.id && !into.has(entity.id)) into.set(entity.id, entity);
  }
}

/** Name and sprite of an entity, following its parents the way prototype inheritance fills unset fields. */
function resolveEntity(entities, id, cache = new Map()) {
  if (cache.has(id)) return cache.get(id);
  cache.set(id, null);
  const own = entities.get(id);
  if (!own) return null;
  const out = {
    name: own.name,
    sprite: own.sprite,
    state: own.state,
    layers: own.layers,
    icon: own.icon,
    iconState: own.iconState,
  };
  for (const parent of own.parents) {
    const p = resolveEntity(entities, parent, cache);
    if (!p) continue;
    out.name ??= p.name;
    out.sprite ??= p.sprite;
    out.state ??= p.state;
    out.layers ??= p.layers;
    out.icon ??= p.icon;
    out.iconState ??= p.iconState;
  }
  cache.set(id, out);
  return out;
}

let cookbookPromise = null;

/** All shown food recipes, plus the entity table once the entity files are in. */
function cookbook() {
  if (cookbookPromise) return cookbookPromise;
  const recipes = Promise.all(RECIPE_FILES.map(path => fetchRepoFile(path, 'text')
    .then(({ data }) => parseRecipeFile(data))
    .catch(() => null)))
    .then(files => {
      if (files.every(f => f == null)) throw new Error('The recipe files could not be read from the repository.');
      const byId = new Map();
      for (const file of files) for (const recipe of file || []) byId.set(recipe.id, recipe);
      return [...byId.values()].filter(r => !r.secret && r.result && !HIDDEN_GROUPS.has(r.group));
    });
  const entities = Promise.all(ENTITY_FILES.map(path => fetchRepoFile(path, 'text')
    .then(({ data }) => data)
    .catch(() => null)))
    .then(texts => {
      const map = new Map();
      for (const text of texts) if (text) scanEntities(text, map);
      return map;
    });
  cookbookPromise = { recipes, entities };
  recipes.catch(() => (cookbookPromise = null));
  return cookbookPromise;
}

/**
 * The colony cookbook, <CMUNetRecipes Kind="Food" Group="..."/>, built from the game's microwave recipes:
 * result sprite and name, solids and reagents, cook time; a search box, a group filter and paging.
 * Only the cookbook is ported: any other Kind shows a note and loads nothing.
 */
export function createRecipes(args = {}, options = {}) {
  const root = makeRoot('recipes', options);
  const kind = args.Kind ?? args.kind;
  if (kind !== 'Food') {
    root.append(h('div', { class: 'emu-w-notice', text: 'Only the cookbook (Kind="Food") is available in the emulator.' }));
    return root;
  }

  let table = {};
  const search = h('input', { class: 'emu-w-input', type: 'search' });
  const groupSelect = h('select', { class: 'emu-w-select', title: 'Group' });
  const count = h('span', { class: 'emu-w-dim' });
  const cards = h('div', { class: 'emu-w-col', style: 'gap:8px' });
  const more = h('button', { class: 'emu-w-btn', type: 'button', style: 'align-self:center' });
  const status = h('div', { class: 'emu-w-dim', text: 'Loading the cookbook from the game files...' });
  const tip = h('div', { class: 'emu-w-tip' });
  root.append(h('div', { class: 'emu-w-col', style: 'gap:8px' },
    h('div', { class: 'emu-w-row', style: 'gap:8px' }, search, groupSelect, count), status, cards, more), tip);
  more.style.display = 'none';

  let all = [];
  let shown = [];
  let page = 1;
  let entities = new Map();
  let resolved = new Map();
  let makes = new Map();

  const info = id => resolveEntity(entities, id, resolved);
  const entityName = id => info(id)?.name || prettyId(id);
  const recipeName = r => r.name || entityName(r.result);

  /** An entity's sprite as the game's Frame0 draws it: the Icon component, or the Sprite layers stacked. */
  function icon(entityId, scale) {
    const size = Math.round(32 * scale);
    const box = h('span', { class: 'emu-w-icon', style: `width:${size}px;height:${size}px;position:relative` });
    const fallback = entityId === MICROWAVE_ID ? MICROWAVE_FALLBACK : null;
    const e = info(entityId);
    let parts = [];
    if (e?.icon && e?.iconState) parts = [{ rsi: e.icon, state: e.iconState }];
    else if (e?.layers && (e.sprite || e.layers.every(l => l.sprite))) parts = e.layers.map(l => ({ rsi: l.sprite || e.sprite, state: l.state }));
    else if (e?.sprite && e?.state) parts = [{ rsi: e.sprite, state: e.state }];
    else if (fallback) parts = [fallback];
    parts = parts.slice(0, 4);
    if (parts.length) {
      Promise.all(parts.map(p => spriteCanvas(p.rsi, p.state, scale).catch(() => null))).then(canvases => {
        const drawn = canvases.filter(Boolean);
        drawn.forEach((canvas, i) => {
          canvas.style.maxWidth = size + 'px';
          canvas.style.maxHeight = size + 'px';
          if (i > 0) canvas.style.cssText += ';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)';
        });
        box.replaceChildren(...drawn);
      });
    }
    return box;
  }

  const vial = scale => h('span', {
    class: 'emu-w-vial',
    style: `width:${10 * scale + 2}px;height:${14 * scale + 2}px;margin:0 ${11 * scale}px`,
  });

  function ingredientRow(ing, links) {
    const amount = ing.reagent ? `${ing.amount}u` : `${ing.amount}`;
    const label = h('span', { text: `${amount} ${ing.name}` });
    const made = ing.entity ? makes.get(ing.entity) : null;
    if (made && links) {
      label.className = 'emu-w-link';
      label.addEventListener('mouseenter', () => {
        tip.replaceChildren(card(made, false));
        tip.style.display = 'block';
        const a = label.getBoundingClientRect();
        const r = root.getBoundingClientRect();
        tip.style.left = Math.max(0, Math.min(a.left - r.left, r.width - 340)) + 'px';
        tip.style.top = (a.bottom - r.top + 4) + 'px';
      });
      label.addEventListener('mouseleave', () => (tip.style.display = 'none'));
      label.addEventListener('click', () => {
        tip.style.display = 'none';
        search.value = recipeName(made);
        filter();
      });
    }
    return h('div', { class: 'emu-w-row' }, ing.entity ? icon(ing.entity, 1) : vial(1), label);
  }

  function card(recipe, links) {
    const ingredients = [
      ...recipe.solids.map(([id, amount]) => ({ name: entityName(id), amount, entity: id })),
      ...recipe.reagents.map(([id, amount]) => ({ name: prettyId(id), amount, reagent: id })),
    ];
    return h('div', { class: 'emu-w-card' },
      h('div', { class: 'emu-w-card-head' },
        icon(recipe.result, 2),
        h('span', { class: 'emu-w-key emu-w-clip emu-w-grow', text: recipeName(recipe) })),
      h('div', { class: 'emu-w-card-body' },
        h('div', { class: 'emu-w-ings' }, ingredients.map(i => ingredientRow(i, links))),
        h('div', { class: 'emu-w-method' },
          icon(MICROWAVE_ID, 1.5),
          h('span', { text: fmt(table, 'cmu-net-recipes-seconds', { seconds: recipe.time }) }))));
  }

  function show() {
    tip.style.display = 'none';
    const n = Math.min(shown.length, page * RECIPE_PAGE);
    cards.replaceChildren(...shown.slice(0, n).map(r => card(r, true)));
    count.textContent = fmt(table, 'cmu-net-recipes-count', { shown: n, total: shown.length });
    more.style.display = n < shown.length ? '' : 'none';
  }

  function filter() {
    const text = search.value.trim().toLowerCase();
    const group = groupSelect.value;
    shown = all.filter(r => (!group || r.group === group)
      && (!text || recipeName(r).toLowerCase().includes(text)
        || r.solids.some(([id]) => entityName(id).toLowerCase().includes(text))
        || r.reagents.some(([id]) => prettyId(id).toLowerCase().includes(text))));
    page = 1;
    show();
  }

  function rebuild() {
    resolved = new Map();
    makes = new Map();
    all.sort((a, b) => recipeName(a).localeCompare(recipeName(b), undefined, { sensitivity: 'base' }));
    for (const r of all) if (!makes.has(r.result)) makes.set(r.result, r);
    const keep = page;
    filter();
    page = keep;
    show();
  }

  search.addEventListener('input', filter);
  groupSelect.addEventListener('change', filter);
  more.addEventListener('click', () => {
    page++;
    show();
  });

  const label = () => {
    search.placeholder = fmt(table, 'cmu-net-recipes-search');
    more.textContent = fmt(table, 'cmu-net-recipes-more');
  };
  label();

  const book = cookbook();
  Promise.all([strings(), book.recipes]).then(([t, recipes]) => {
    table = t;
    label();
    all = recipes.slice();
    const groups = [...new Set(all.map(r => r.group))].sort();
    const wanted = args.Group ?? args.group ?? '';
    groupSelect.replaceChildren(h('option', { value: '', text: 'All groups' }),
      ...groups.map(g => h('option', { value: g, text: g })));
    if (wanted && !groups.includes(wanted)) groupSelect.append(h('option', { value: wanted, text: wanted }));
    groupSelect.value = wanted;
    status.textContent = 'Reading names and sprites...';
    rebuild();
    return book.entities.then(map => {
      entities = map;
      status.remove();
      rebuild();
    });
  }).catch(e => {
    status.textContent = `The cookbook is offline: ${e.message}`;
  });
  return root;
}

// ---------------------------------------------------------------- 3. Deep market

const FALLBACK_HANDLES = ['relay_echo', 'static_line', 'lowtide', 'greywire', 'deadair', 'coldboot', 'nightshift', 'tinfoil'];

/** Sample listings (the game's are written by insurgent players during the round). */
const SAMPLE_LISTINGS = [
  ['Unregistered pistol', 'Serial filed off. Six rounds in the box. Do not ask where it came from.', 1800],
  ['Weyland-Yutani keycard (blank)', 'Cut from a dead admin\'s spare. Opens what it opened.', 950],
  ['Crate of real cigarettes', 'Not the colony ration kind. Twenty packs, sealed.', 240],
  ['Forged work permit', 'Your name, any job, stamped. Holds up to a glance.', 600],
  ['Radio scrambler', 'Clips onto a headset. The Marshals hear static.', 1200],
  ['Bottle of off-world whiskey', 'Came down on the last supply run, before the manifest was written.', 180],
  ['Map of the old mining tunnels', 'Hand drawn. Shows the vents nobody sealed.', 75],
];

let handlesPromise = null;

function marketHandles() {
  if (!handlesPromise) {
    handlesPromise = fetchRepoFile(DEEP_WEB_FILE, 'text').then(({ data }) => {
      for (const block of blocks(data)) {
        if (!/^\s*id:\s*CMUDeepHackerHandles\s*$/m.test(block)) continue;
        const values = [...block.matchAll(/^\s*- ([\w-]+)\s*$/gm)].map(m => m[1]);
        if (values.length) return values;
      }
      return FALLBACK_HANDLES;
    }).catch(() => FALLBACK_HANDLES);
  }
  return handlesPromise;
}

const MARKET_KEY = 'emu-w-market';
const MARKET_START = 2500;

/**
 * The contraband market, <CMUNetMarket/>: listings by seller handle and price, the buyer's pickups, and the
 * listing form. Buying moves money only in this browser and the drop is not revealed: in game it would be.
 */
export function createMarket(options = {}) {
  const root = makeRoot('market', options);
  const body = h('div', { class: 'emu-w-col' });
  root.append(body);
  let table = {};
  body.append(h('div', { text: fmt(table, 'cmu-market-offline') }));

  const load = () => {
    const state = storageGet(MARKET_KEY, null) || {};
    return {
      balance: Number.isFinite(state.balance) ? state.balance : MARKET_START,
      sold: Array.isArray(state.sold) ? state.sold : [],
      purchases: Array.isArray(state.purchases) ? state.purchases : [],
      own: Array.isArray(state.own) ? state.own : [],
    };
  };
  let state = load();
  const save = () => storageSet(MARKET_KEY, state);
  let listings = [];
  let notice = null;

  function render() {
    const nodes = [
      h('div', { class: 'emu-w-sample', text: 'SAMPLE LISTINGS - EMULATOR' }),
      h('div', { class: 'emu-w-row' },
        h('span', { class: 'emu-w-grow', text: `Account balance: $${state.balance} (emulator money, kept in this browser)` }),
        h('button', {
          class: 'emu-w-btn', type: 'button', text: 'Reset',
          onclick: () => {
            state = { balance: MARKET_START, sold: [], purchases: [], own: [] };
            save();
            notice = null;
            render();
          },
        })),
    ];
    if (notice) nodes.push(h('div', { class: 'emu-w-notice emu-w-plain', text: notice }));
    const open = [...listings, ...state.own].filter(l => !state.sold.includes(l.id));
    if (!open.length) nodes.push(h('div', { text: fmt(table, 'cmu-market-empty') }));
    for (const listing of open) {
      const buy = h('button', { class: 'emu-w-btn', type: 'button', text: fmt(table, 'cmu-market-buy', { price: listing.price }) });
      buy.addEventListener('click', () => {
        if (listing.mine) {
          notice = 'You cannot buy your own listing.';
        } else if (state.balance < listing.price) {
          notice = 'Not enough money on this account. In game the purchase would simply not go through.';
        } else {
          state.balance -= listing.price;
          state.sold.push(listing.id);
          state.purchases.push({ title: listing.title, drop: '(revealed in game)' });
          notice = `Paid $${listing.price}. In game the drop point would be delivered to you now, on screen and by mail `
            + `("${fmt(table, 'cmu-market-mail-subject', { title: listing.title })}"). Nothing is delivered in the emulator.`;
        }
        save();
        render();
      });
      nodes.push(h('div', { class: 'emu-w-row', style: 'gap:8px' },
        h('span', { class: 'emu-w-grow emu-w-clip', text: fmt(table, 'cmu-market-listing', { title: listing.title, seller: listing.seller }) }),
        buy));
      if (listing.description) nodes.push(h('div', { class: 'emu-w-plain emu-w-dim', text: listing.description }));
    }
    if (state.purchases.length) {
      nodes.push(h('div', { class: 'emu-w-key', style: 'margin-top:6px', text: fmt(table, 'cmu-market-bought') }));
      for (const p of state.purchases) nodes.push(h('div', { class: 'emu-w-plain', text: fmt(table, 'cmu-market-drop', p) }));
    }
    nodes.push(seller());
    body.replaceChildren(...nodes);
  }

  function seller() {
    const field = (placeholder, max, extra = {}) => {
      const input = h('input', { class: 'emu-w-input', type: 'text', placeholder, ...extra });
      input.addEventListener('input', () => input.classList.toggle('emu-w-bad', !valid(input, max)));
      return input;
    };
    const valid = (input, max) => input.value.length <= max && (input !== price || /^\d*$/.test(input.value));
    const title = field(fmt(table, 'cmu-market-title'), 60);
    const description = field(fmt(table, 'cmu-market-description'), 300);
    const price = field(fmt(table, 'cmu-market-price'), 5, { inputmode: 'numeric', style: 'flex:0 0 100px' });
    const drop = field(fmt(table, 'cmu-market-drop-placeholder'), 80);
    const list = h('button', { class: 'emu-w-btn', type: 'button', style: 'align-self:flex-start', text: fmt(table, 'cmu-market-list') });
    list.addEventListener('click', () => {
      const amount = Number(price.value);
      if (!/^\d{1,5}$/.test(price.value) || !title.value.trim() || !drop.value.trim()
        || !valid(title, 60) || !valid(description, 300) || !valid(drop, 80)) return;
      if (amount > 50000 || listings.length + state.own.length >= 30) return;
      state.own.push({
        id: 'own-' + Date.now(), seller: 'you', title: title.value.trim(), description: description.value.trim(),
        price: amount, mine: true,
      });
      notice = 'Listed in this browser only. In game only insurgents can list, under a random market handle.';
      save();
      render();
    });
    return h('div', { class: 'emu-w-col', style: 'gap:4px;margin-top:10px' },
      h('div', { class: 'emu-w-key', text: fmt(table, 'cmu-market-sell') }),
      title, description, h('div', { class: 'emu-w-row' }, price, drop), list);
  }

  Promise.all([strings(), marketHandles()]).then(([t, handles]) => {
    table = t;
    listings = SAMPLE_LISTINGS.map(([title, description, price], i) => ({
      id: 'sample-' + i, seller: handles[(i * 5 + 3) % handles.length], title, description, price,
    }));
    render();
  });
  return root;
}

// ---------------------------------------------------------------- 4. CMB panels

const CMB_KINDS = ['Alerts', 'Map', 'Faxes', 'Records'];
const SAMPLE_AREAS = ['Colony Bar', 'Hydroponics', 'Engineering', 'Medbay Lobby', 'Cargo Bay', 'Dormitory B', 'Mining Office', 'Marshal Office'];
const SAMPLE_NAMES = ['Dana Kowalski', 'Ray Okafor', 'Ellen Marsh', 'Tomas Reyes', 'Hal Brandt'];
const FALLBACK_ADDRESSES = ['cell.deep', 'wyleaks.deep', 'bloodmarket.deep', 'thebox.deep'];

/** Shared sample state, so a trace started on the map shows on the alerts panel too. */
const cmbSample = {
  alerts: null,
  terminals: [
    { id: 1042, area: 0, x: 0.18, y: 0.28, alerted: true },
    { id: 1107, area: 1, x: 0.52, y: 0.2, alerted: false },
    { id: 1213, area: 2, x: 0.8, y: 0.3, alerted: false },
    { id: 1338, area: 3, x: 0.3, y: 0.62, alerted: true },
    { id: 1404, area: 4, x: 0.62, y: 0.7, alerted: false },
    { id: 1521, area: 5, x: 0.86, y: 0.75, alerted: false },
    { id: 1690, area: 6, x: 0.12, y: 0.82, alerted: false },
  ],
  faxes: [
    { ago: 140, from: 'Colony Administration', to: 'Marshal Office', title: 'Curfew order',
      content: 'By order of the administrator, all non-essential personnel are to remain in their dormitories after 22:00. Report violations to the duty Marshal.' },
    { ago: 95, from: 'Weyland-Yutani Liaison', to: 'Marshal Office', title: 'Missing equipment',
      content: 'Two survey drones were signed out of the mining office and not returned. Please treat this as theft of Company property.' },
    { ago: 12, from: 'unknown sender', to: 'Marshal Office', title: 'tip',
      content: 'check the vents under the bar. someone is selling there every night.' },
  ],
  records: [
    { name: 'Tomas Reyes', status: 'WANTED', reason: 'Seen leaving the cargo bay with an unlogged crate.', history: ['Theft', 'Trespassing'] },
    { name: 'Ellen Marsh', status: 'SUSPECTED', reason: 'Terminal #1338 traced to her login.', history: [] },
    { name: 'Hal Brandt', status: 'PAROLED', reason: '', history: ['Assault', 'Public intoxication'] },
    { name: 'Dana Kowalski', status: 'DETAINED', reason: 'Holding for questioning.', history: ['Smuggling'] },
  ],
};

let addressPromise = null;

function deepAddresses() {
  if (!addressPromise) {
    addressPromise = fetchRepoFile(DEEP_WEB_FILE, 'text').then(({ data }) => {
      const list = scanPrototypes(normalize(data), 'cmuNetSite').map(s => s.address).filter(a => a && a.endsWith('.deep'));
      return list.length ? list : FALLBACK_ADDRESSES;
    }).catch(() => FALLBACK_ADDRESSES);
  }
  return addressPromise;
}

/** Shift clock: the round starts at 06:00. */
function shiftClock(minutes) {
  const total = 6 * 60 + Math.floor(minutes);
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function sampleMinutes() {
  return Math.floor((Date.now() / 60000) % 600);
}

function ensureAlerts(addresses) {
  if (cmbSample.alerts) return;
  const now = sampleMinutes();
  cmbSample.alerts = [
    { minutes: now - 3, id: 1338, location: SAMPLE_AREAS[3], address: addresses[0 % addresses.length] },
    { minutes: now - 17, id: 1042, location: SAMPLE_AREAS[0], trace: { found: SAMPLE_NAMES[0] } },
    { minutes: now - 22, id: 1042, location: SAMPLE_AREAS[0], address: addresses[2 % addresses.length] },
    { minutes: now - 51, id: 1213, location: SAMPLE_AREAS[2], address: addresses[1 % addresses.length] },
  ];
}

/**
 * One Marshals' panel, <CMUNetCmbPanel Kind="Alerts|Map|Faxes|Records"/>, with made up sample data. It shows the
 * loading line first and refreshes every 10 seconds while on the page, like the game's panel.
 */
export function createCmbPanel(kind, options = {}) {
  const root = makeRoot('cmb', options);
  const life = lifetime(root);
  const body = h('div', { class: 'emu-w-col', style: 'gap:4px' });
  root.append(body);
  let table = {};
  if (!CMB_KINDS.includes(kind)) {
    body.append(h('div', { class: 'emu-w-notice', text: `Unknown CMB panel "${kind}". Use Alerts, Map, Faxes or Records.` }));
    return root;
  }
  body.append(h('div', { text: fmt(table, 'cmu-cmb-loading') }));
  let addresses = FALLBACK_ADDRESSES;
  const openFaxes = new Set();
  let tracing = null;

  const plain = (text, cls = '') => h('div', { class: 'emu-w-plain ' + cls, text });
  const sample = () => h('div', { class: 'emu-w-sample', text: 'SAMPLE DATA - EMULATOR' });

  function alertLine(alert) {
    const time = shiftClock(alert.minutes);
    if (alert.trace) {
      const result = alert.trace.found
        ? fmt(table, 'cmu-cmb-trace-found', { name: alert.trace.found })
        : fmt(table, 'cmu-cmb-trace-lost');
      return fmt(table, 'cmu-cmb-trace-alert', { time, id: alert.id, location: alert.location, result });
    }
    return fmt(table, 'cmu-cmb-alert', { time, id: alert.id, location: alert.location, address: alert.address });
  }

  function alerts() {
    const nodes = [sample()];
    if (!cmbSample.alerts.length) nodes.push(h('div', { text: fmt(table, 'cmu-cmb-alerts-empty') }));
    for (const alert of cmbSample.alerts) nodes.push(plain(alertLine(alert)));
    return nodes;
  }

  function map() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 560 420');
    svg.setAttribute('class', 'emu-w-map');
    const add = (tag, attrs, parent = svg) => {
      const node = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
      parent.append(node);
      return node;
    };
    // A stand-in colony layout: rooms joined by corridors, where the game draws the grid's nav map.
    add('path', { d: 'M60 150 H500 M280 60 V380 M60 300 H500', stroke: '#1d3a52', 'stroke-width': 14, fill: 'none' });
    const rooms = [[30, 60, 150, 110], [220, 40, 140, 90], [400, 60, 140, 110], [100, 210, 150, 110],
      [300, 230, 150, 100], [420, 260, 120, 120], [20, 300, 120, 100]];
    rooms.forEach(([x, y, w, hgt], i) => {
      add('rect', { x, y, width: w, height: hgt, fill: '#0e2233', stroke: '#2f5878', 'stroke-width': 2 });
      const label = add('text', { x: x + 6, y: y + 16, fill: '#5f86a6', 'font-size': 11, 'font-family': 'monospace' });
      label.textContent = SAMPLE_AREAS[i];
    });
    for (const t of cmbSample.terminals) {
      const g = add('g', { class: 'emu-w-pin' + (t.alerted ? ' emu-w-blink' : ''), transform: `translate(${t.x * 560} ${t.y * 420})` });
      add('circle', { r: 7, fill: t.alerted ? '#E0303A' : '#8FC4FF', stroke: '#000', 'stroke-width': 1 }, g);
      add('title', {}, g).textContent = fmt(table, 'cmu-cmb-map-terminal', { id: t.id });
      g.addEventListener('click', () => trace(t));
    }
    const nodes = [sample(), h('div', { text: fmt(table, 'cmu-cmb-map-hint') }), svg];
    if (tracing) nodes.push(h('div', { class: 'emu-w-dim', text: `Tracing terminal #${tracing.id}...` }));
    for (const t of cmbSample.terminals) {
      if (t.alerted) nodes.push(h('div', { class: 'emu-w-red', text: fmt(table, 'cmu-cmb-map-terminal', { id: t.id }) }));
    }
    const last = cmbSample.alerts.find(a => a.trace);
    if (last) nodes.push(plain(alertLine(last), 'emu-w-dim'));
    return nodes;
  }

  function trace(terminal) {
    if (tracing) return;
    tracing = terminal;
    render();
    life.timeout(() => {
      const found = Math.random() < 0.7 ? pick(SAMPLE_NAMES) : null;
      cmbSample.alerts.unshift({ minutes: sampleMinutes(), id: terminal.id, location: SAMPLE_AREAS[terminal.area], trace: { found } });
      cmbSample.alerts.length = Math.min(cmbSample.alerts.length, 30);
      tracing = null;
      render();
    }, 4000);
  }

  function faxes() {
    const nodes = [sample()];
    if (!cmbSample.faxes.length) nodes.push(h('div', { text: fmt(table, 'cmu-cmb-faxes-empty') }));
    // Newest first, as the bureau receives them.
    [...cmbSample.faxes].sort((x, y) => x.ago - y.ago).forEach((fax, i) => {
      const text = plain(fax.content);
      text.style.padding = '2px 8px 6px';
      text.style.display = openFaxes.has(i) ? '' : 'none';
      const button = h('button', {
        class: 'emu-w-btn emu-w-clip' + (openFaxes.has(i) ? ' emu-w-on' : ''), type: 'button', style: 'width:100%;text-align:left',
        text: fmt(table, 'cmu-cmb-fax', { time: shiftClock(sampleMinutes() - fax.ago), from: fax.from, to: fax.to, title: fax.title }),
      });
      button.addEventListener('click', () => {
        if (openFaxes.has(i)) openFaxes.delete(i);
        else openFaxes.add(i);
        const on = openFaxes.has(i);
        button.classList.toggle('emu-w-on', on);
        text.style.display = on ? '' : 'none';
      });
      nodes.push(button, text);
    });
    return nodes;
  }

  function records() {
    const nodes = [sample()];
    if (!cmbSample.records.length) nodes.push(h('div', { text: fmt(table, 'cmu-cmb-records-empty') }));
    for (const r of cmbSample.records) {
      nodes.push(h('div', { class: 'emu-w-key', text: fmt(table, 'cmu-cmb-record', { name: r.name, status: r.status }) }));
      if (r.reason) nodes.push(plain(fmt(table, 'cmu-cmb-record-reason', { reason: r.reason })));
      if (r.history.length) nodes.push(plain(fmt(table, 'cmu-cmb-record-history', { history: r.history.join('; ') })));
      nodes.push(h('hr', { class: 'emu-w-rule' }));
    }
    return nodes;
  }

  function render() {
    ensureAlerts(addresses);
    const nodes = kind === 'Alerts' ? alerts() : kind === 'Map' ? map() : kind === 'Faxes' ? faxes() : records();
    body.replaceChildren(...nodes);
  }

  Promise.all([strings(), deepAddresses()]).then(([t, a]) => {
    table = t;
    addresses = a;
    body.firstChild.textContent = fmt(table, 'cmu-cmb-loading');
    life.timeout(() => {
      render();
      life.interval(() => {
        // Now and then a new sample lookup comes in, as a live shift would bring.
        if (Math.random() < 0.3) {
          const t2 = pick(cmbSample.terminals);
          cmbSample.alerts.unshift({ minutes: sampleMinutes(), id: t2.id, location: SAMPLE_AREAS[t2.area], address: pick(addresses) });
          cmbSample.alerts.length = Math.min(cmbSample.alerts.length, 30);
        }
        if (kind !== 'Faxes') render();
      }, 10000);
    }, 600);
  });
  return root;
}
