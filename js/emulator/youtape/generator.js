// YouTape's random tapes, ported from CMUTapeGenerator in
// Content.CMU/Client/PersonalComputers/YouTape/CMUTapeGenerator.cs: a genre, then a run of scenes told from the
// grammar (youtape.yml, the cmuTapeGrammar prototype CMUTapeGrammar), with ad breaks between the segments. It draws
// from the emulator's port of System.Random in the same order as the C#, so a seed makes the same tape here as in game.

import { NetRandom } from '../sports/core.js';
import { fetchRepoFile } from '../../repo.js';
import { parseYaml } from '../../yaml.js';
import { PROTOTYPES } from '../../library.js';

export const GENRES = ['news', 'news', 'weather', 'food', 'bunk', 'doc'];
const MAX_DEPTH = 12;
const f = Math.fround;

let grammarPromise = null;

/** The CMUTapeGrammar prototype from youtape.yml, or null when the repository has none. */
export function loadGrammar() {
  if (!grammarPromise) {
    grammarPromise = fetchRepoFile(PROTOTYPES + 'youtape.yml', 'text').then(({ data }) => {
      const { value } = parseYaml(data);
      const proto = (Array.isArray(value) ? value : []).find(v => v && v.type === 'cmuTapeGrammar' && v.id === 'CMUTapeGrammar');
      if (!proto) return null;
      return {
        rules: proto.rules || {},
        backgrounds: proto.backgrounds || {},
        outfits: proto.outfits || {},
        props: proto.props || {},
        ads: proto.ads || [],
        weather: proto.weather || {},
      };
    });
    grammarPromise.catch(() => {
      grammarPromise = null;
    });
  }
  return grammarPromise;
}

/** CMUTapeScene */
function scene(kind, duration) {
  return { kind, background: null, duration: f(duration), lines: [], strap: null, ticker: null, actors: [], weather: [], ad: null };
}

/** Tells the grammar with the tape's own random numbers (CMUTapeGenerator.Teller). */
class Teller {
  constructor(grammar, random, colony) {
    this.grammar = grammar;
    this.random = random;
    this.colony = colony;
    this.castCount = 0;
  }

  chance(p) {
    return this.random.nextDouble() < p;
  }

  range(min, max) {
    return this.random.next(min, max + 1);
  }

  pick(list) {
    return list[this.random.next(list.length)];
  }

  outfit(role) {
    const outfits = this.grammar.outfits[role];
    return outfits && outfits.length > 0 ? this.pick(outfits) : '';
  }

  /** Casts someone for a role: an outfit, and the next place in the cast (CMUTapeGenerator.Teller.Cast). */
  cast(role) {
    return { outfit: this.outfit(role), character: this.castCount++ };
  }

  ad() {
    return this.grammar.ads.length > 0 ? this.pick(this.grammar.ads) : null;
  }

  /** The weather conditions, sorted ordinally as the C# does. */
  conditions() {
    const conditions = Object.keys(this.grammar.weather).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return conditions.length > 0 ? conditions : ['sun'];
  }

  scene(kind, duration) {
    const made = scene(kind, duration);
    const backgrounds = this.grammar.backgrounds[kind];
    if (backgrounds && backgrounds.length > 0) made.background = this.pick(backgrounds);
    return made;
  }

  props(into, kind, count) {
    const props = this.grammar.props[kind];
    if (!props || props.length === 0) return;
    for (let i = 0; i < count; i++) {
      const x = f(f(0.45) + f(f(this.random.nextDouble()) * f(0.45)));
      into.actors.push({ outfit: null, character: 0, prop: this.pick(props), at: [x, f(0.88)], scale: 3, talking: false });
    }
  }

  /** Expands every #rule# in the text, rules within rules, then puts in the colony. */
  say(text) {
    return this.expand(text, 0).split('{colony}').join(this.colony);
  }

  expand(text, depth) {
    if (depth > MAX_DEPTH || !text.includes('#')) return text;
    let output = '';
    let at = 0;
    while (at < text.length) {
      const start = text.indexOf('#', at);
      const end = start < 0 ? -1 : text.indexOf('#', start + 1);
      if (start < 0 || end < 0) {
        output += text.slice(at);
        break;
      }
      output += text.slice(at, start);
      const rule = text.slice(start + 1, end);
      const lines = this.grammar.rules[rule];
      output += lines && lines.length > 0 ? this.expand(String(this.pick(lines)), depth + 1) : rule;
      at = end + 1;
    }
    return output;
  }
}

/** Someone cast in the tape, standing in a scene. */
function person(cast, x, y, talking = true) {
  return { outfit: cast.outfit, character: cast.character, prop: null, at: [f(x), f(y)], scale: 4, talking };
}

function news(tape, teller) {
  const anchor = teller.cast('anchor');
  const headline = teller.say('#news.headline#');
  const crawl = [];
  for (let i = 0; i < 4; i++) crawl.push(teller.say('#news.crawl#'));
  const ticker = crawl.join('   ///   ');

  const open = teller.scene('studio', 9);
  open.strap = headline;
  open.ticker = ticker;
  open.lines.push(teller.say('#news.open#'));
  open.lines.push(teller.say('#news.story#'));
  open.actors.push(person(anchor, 0.5, 0.86));
  tape.scenes.push(open);

  const reporter = teller.cast('reporter');
  const field = teller.scene('field', 10);
  field.strap = teller.say('#news.reporter#');
  field.lines.push(teller.say('#news.field#'));
  field.lines.push(teller.say('#news.field#'));
  field.lines.push(teller.say('#news.witness#'));
  field.actors.push(person(reporter, 0.3, 0.9));
  if (teller.chance(0.7)) field.actors.push(person(teller.cast('guest'), 0.62, 0.9, false));
  teller.props(field, 'field', 1);
  tape.scenes.push(field);

  const back = teller.scene('studio', 8);
  back.strap = teller.say('#news.headline#');
  back.ticker = ticker;
  back.lines.push(teller.say('#news.followup#'));
  back.lines.push(teller.say('#news.toss#'));
  back.actors.push(person(anchor, 0.5, 0.86));
  tape.scenes.push(back);

  tape.scenes.push(ad(teller));
  forecast(tape, teller, false);

  const close = teller.scene('studio', 7);
  close.ticker = ticker;
  close.lines.push(teller.say('#news.close#'));
  close.actors.push(person(anchor, 0.5, 0.86));
  tape.scenes.push(close);
}

/** A weather report: the presenter, the map with its symbols, and on a full show an outlook after an ad. */
function forecast(tape, teller, full) {
  const presenter = teller.cast('presenter');
  const map = teller.scene('weather', 10);
  map.strap = teller.say('#weather.strap#');
  map.lines.push(teller.say('#weather.open#'));
  const conditions = teller.conditions();
  const spots = [[0.5, 0.3], [0.78, 0.36], [0.56, 0.62], [0.84, 0.7]];
  for (const [x, y] of spots) {
    const condition = teller.pick(conditions);
    const temperature = teller.range(-30, 42);
    const place = teller.say('#weather.place#');
    map.weather.push({ icon: condition, label: `${place} ${temperature}`, at: [f(x), f(y)] });
    if (map.lines.length < 3) {
      map.lines.push(teller.say(`#weather.${condition}#`).split('{place}').join(place).split('{temp}').join(String(temperature)));
    }
  }
  map.actors.push(person(presenter, 0.18, 0.9));
  tape.scenes.push(map);

  if (!full) return;

  tape.scenes.push(ad(teller));
  const outlook = teller.scene('weather', 9);
  outlook.strap = teller.say('#weather.outlook#');
  const days = teller.say('#weather.days#').split(',');
  for (let i = 0; i < 4 && i < days.length; i++) {
    const condition = teller.pick(conditions);
    outlook.weather.push({ icon: condition, label: `${days[i].trim()} ${teller.range(-30, 42)}`, at: [f(f(0.4) + f(i * f(0.16))), f(0.45)] });
  }
  outlook.lines.push(teller.say('#weather.close#'));
  outlook.actors.push(person(presenter, 0.18, 0.9));
  tape.scenes.push(outlook);
  if (teller.chance(0.5)) tape.scenes.push(ad(teller));
}

/** A home tape: a host in their own place telling it, with props, and an ad dubbed in halfway. */
function show(tape, teller, genre) {
  const host = teller.cast('host');
  const place = genre === 'food' ? 'food' : genre === 'bunk' ? 'bunk' : 'wild';
  const segments = teller.range(3, 5);
  for (let i = 0; i < segments; i++) {
    const key = i === 0 ? 'open' : i === segments - 1 ? 'close' : 'story';
    const made = teller.scene(place, teller.range(7, 10));
    made.lines.push(teller.say(`#${genre}.${key}#`));
    if (key === 'story') made.lines.push(teller.say(`#${genre}.story#`));
    if (i === 0) made.strap = tape.channel;
    // The documentary has a narrator, not a host in shot.
    if (genre !== 'doc') made.actors.push(person(host, teller.chance(0.5) ? 0.32 : 0.66, 0.9));
    teller.props(made, genre, genre === 'doc' ? 2 : 1);
    tape.scenes.push(made);
    if (i === Math.trunc(segments / 2) && segments > 2) tape.scenes.push(ad(teller));
  }
}

function ad(teller) {
  const made = teller.scene('ad', 6);
  made.ad = teller.ad();
  made.strap = teller.say('#ad.product#');
  made.lines.push(teller.say('#ad.slogan#'));
  teller.props(made, 'ad', 1);
  return made;
}

function card(teller, kind, duration) {
  const made = teller.scene(kind, duration);
  made.lines.push(teller.say(`#${kind}.line#`));
  return made;
}

/** The tape's length in seconds (CMUTape.Length, a float sum). */
export function tapeLength(tape) {
  return tape.scenes.reduce((sum, s) => f(sum + s.duration), 0);
}

/** CMUTapeGenerator.Generate: the same seed and grammar always make the same tape. */
export function generate(seed, grammar, colony) {
  const random = new NetRandom(seed);
  const teller = new Teller(grammar, random, colony);
  const tape = { seed, genre: GENRES[random.next(GENRES.length)], title: '', channel: '', rewinds: 0, scenes: [] };
  tape.title = teller.say(`#title.${tape.genre}#`);
  tape.channel = teller.say(`#channel.${tape.genre}#`);
  tape.rewinds = Math.trunc(Math.pow(10, 1 + random.nextDouble() * 5));

  // Some tapes start on a card, the way a dub off the relay does.
  if (random.nextDouble() < 0.35) tape.scenes.push(card(teller, random.nextDouble() < 0.5 ? 'card' : 'standby', 3));

  if (tape.genre === 'news') news(tape, teller);
  else if (tape.genre === 'weather') forecast(tape, teller, true);
  else show(tape, teller, tape.genre);
  tape.length = tapeLength(tape);
  return tape;
}
