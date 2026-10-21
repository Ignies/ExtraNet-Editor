// YouTape's page tags, ported from Content.CMU/Client/PersonalComputers/YouTape/:
// - <CMUNetTape/> (CMUNetTape.cs): plays a random tape straight away (not with Autoplay="false"), with buttons to
//   play, rewind and put on another, a shelf of more random tapes by title, and the broadcasting cameras on air now.
//   Shelf="0" leaves the shelf out (at most 12), Live="false" the live list. Sports tapes replay the round's finished
//   sportsbook matches when there are any, as the page hears of them from the bet state.
// - <CMUNetTapeLink Title Channel Genre Number/> (CMUNetTapeLink.cs): a tape's title as a link that plays that tape,
//   made from the title, in the page's <CMUNetTape>.
// - <CMUNetReels/> (CMUNetReels.cs): short tall tapes one after another, flicked with UP and DOWN.
//
// Tapes are built from their seed by youtape/generator.js and drawn by youtape/player.js. The live list comes from
// the server in game (CMUYouTapeLiveSystem lists the cameras on the TV network); the emulator has no round and no
// cameras, so it answers the request the way a server with nobody broadcasting does.

import { el } from '../util.js';
import { L } from './data.js';
import { fontStack, px } from '../fonts.js';
import { loadGrammar, generate, reel, titleSeed } from './youtape/generator.js';
import { TapePlayer, PORTRAIT } from './youtape/player.js';

/** The English strings, for a repository whose locale does not have them yet. */
const FALLBACK = {
  'cmu-tape-play-button': 'PLAY',
  'cmu-tape-pause-button': 'PAUSE',
  'cmu-tape-rewind': 'REWIND',
  'cmu-tape-next': 'NEXT TAPE',
  'cmu-tape-default-colony': 'the colony',
  'cmu-tape-byline': '{ $channel }  -  { $rewinds } rewinds',
  'cmu-tape-shelf': 'MORE TAPES',
  'cmu-tape-shelf-entry': '{ $title }  ({ $channel })',
  'cmu-tape-live': 'LIVE NOW',
  'cmu-tape-live-asking': 'Checking the relay for live broadcasts...',
  'cmu-tape-live-none': 'Nobody is broadcasting right now. Pick up a broadcasting camera and you could be.',
  'cmu-tape-live-refresh': 'REFRESH',
  'cmu-tape-link-tooltip': 'Play this tape',
  'cmu-tape-reel-up': 'UP',
  'cmu-tape-reel-down': 'DOWN',
  'cmu-tape-reel-likes': '{ $likes } likes',
};

/** How long the emulated relay takes to answer a request for the live list, in milliseconds. */
const RELAY_DELAY = 450;

const STYLE_ID = 'emu-tape-style';
const STYLE = `
.emu-tape { display: flex; flex-direction: column; gap: 4px; margin: 6px 0; min-width: 0; align-items: flex-start; }
.emu-tape-screen { display: block; position: relative; overflow: hidden; flex: none; background: #000; }
.emu-tape-layer, .emu-tape-embeds { position: absolute; left: 0; top: 0; width: 100%; height: 100%; image-rendering: pixelated; }
.emu-tape-embeds canvas { image-rendering: pixelated; }
.emu-reels { display: flex; flex-direction: row; gap: 10px; margin: 6px 0; align-items: flex-end; }
.emu-reels-side { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.emu-reels-side .emu-tape-button { min-width: 70px; align-self: flex-start; }
.emu-tape-link { display: block; margin: 8px 0 2px; cursor: pointer; text-decoration: none; border-bottom: 1px solid transparent;
  align-self: flex-start; width: fit-content; }
.emu-tape-link:hover { border-bottom-color: currentColor; }
.emu-tape-row { display: flex; flex-direction: row; gap: 4px; align-items: center; min-width: 0; }
.emu-tape-list { display: flex; flex-direction: column; gap: 2px; align-self: stretch; min-width: 0; }
.emu-tape-label { white-space: pre; overflow: hidden; min-width: 0; max-width: 100%; }
.emu-tape-heading { margin-top: 6px; }
.emu-tape-button { border: 0; padding: 2px 8px; font: inherit; cursor: pointer; white-space: pre; text-align: center; }
.emu-tape-button:hover { filter: brightness(0.85); }
.emu-tape-list > .emu-tape-button { align-self: flex-start; }
.emu-tape-list > .emu-tape-pick { align-self: stretch; text-align: left; overflow: hidden; }
`;

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  document.head.append(el('style', { id: STYLE_ID, text: STYLE }));
}

/** The round's finished sportsbook matches, as the bet state tells a page of them (CMUNetTape.OnBets). */
async function requestBets() {
  const { finishedMatches } = await import('./sports.js');
  return finishedMatches();
}

/**
 * The tag. args: its attributes. style: the page style. ctx: { strings, colony }: the locale and the round's map
 * name (CMUNetBrowser.ColonyName).
 */
export function createTape(args = {}, style = {}, ctx = {}) {
  injectStyle();
  const strings = ctx.strings || {};
  const t = (id, vars) => L(strings[id] === undefined ? FALLBACK : strings, id, vars);
  const colony = ctx.colony || t('cmu-tape-default-colony');

  let shelfSize = 6;
  if (args.Shelf !== undefined && /^\s*[-+]?\d+\s*$/.test(args.Shelf)) shelfSize = Math.min(12, Math.max(0, parseInt(args.Shelf, 10)));
  const showLive = args.Live === undefined || args.Live.toLowerCase() !== 'false';
  const autoplay = args.Autoplay === undefined || args.Autoplay.toLowerCase() !== 'false';

  let grammar = null;
  // the round's finished matches; none until the bet state arrives
  let results = [];
  const randomSeed = () => Math.floor(Math.random() * 2147483647);
  const make = seed => (grammar ? generate(seed, grammar, colony, { results, strings }) : null);

  const label = (value, colour, extra = '') => {
    const node = el(`div.emu-tape-label${extra}`, { text: value });
    if (colour) node.style.color = colour;
    return node;
  };
  /** A button with a flat face, since page buttons have no face of their own. */
  const styled = (value, face, ink) => {
    const button = el('button.emu-tape-button', { type: 'button', text: value });
    button.style.background = face;
    button.style.color = ink;
    return button;
  };
  const deckButton = value => styled(value, '#FF2A2A', '#FFFFFF');
  const heading = value => label(value, '#FF2A2A', '.emu-tape-heading');

  const title = label('', '#FF2A2A');
  const byline = label('', '#AAAAAA');
  const play = deckButton(t('cmu-tape-pause-button'));
  const updatePlay = () => {
    play.textContent = t(player.playing ? 'cmu-tape-pause-button' : 'cmu-tape-play-button');
  };
  const player = new TapePlayer(strings, { onEnded: () => updatePlay() });
  const rewind = deckButton(t('cmu-tape-rewind'));
  // the game's REWIND winds back and stops the tape without relabelling the play button
  rewind.addEventListener('click', () => player.rewind());
  play.addEventListener('click', () => {
    player.togglePlay();
    updatePlay();
  });
  const next = deckButton(t('cmu-tape-next'));
  next.addEventListener('click', () => playSeed(randomSeed()));

  const shelf = el('div.emu-tape-list');
  const live = el('div.emu-tape-list');
  const root = el('div.emu-tape', {}, player.element, el('div.emu-tape-row', {}, rewind, play, next), title, byline);
  if (shelfSize > 0) root.append(heading(t('cmu-tape-shelf')), shelf);
  if (showLive) root.append(heading(t('cmu-tape-live')), live);

  function playSeed(seed) {
    const tape = make(seed);
    if (!tape) return;
    player.load(tape);
    title.textContent = tape.title;
    byline.textContent = t('cmu-tape-byline', { channel: tape.channel, rewinds: tape.rewinds });
    updatePlay();
  }

  /** More tapes, each a random seed shown by its title; picking one plays it. */
  function fillShelf() {
    shelf.replaceChildren();
    for (let i = 0; i < shelfSize; i++) {
      const seed = randomSeed();
      const tape = make(seed);
      if (!tape) return;
      const pick = styled(t('cmu-tape-shelf-entry', { title: tape.title, channel: tape.channel }), '#242424', '#EEEEEE');
      pick.classList.add('emu-tape-pick');
      pick.addEventListener('click', () => {
        playSeed(seed);
        fillShelf();
      });
      shelf.append(pick);
    }
  }

  let asking = 0;

  /** Lists what is on air; null while the terminal is still asking. */
  function setLive(feeds) {
    live.replaceChildren();
    const refresh = styled(t('cmu-tape-live-refresh'), '#242424', '#EEEEEE');
    refresh.addEventListener('click', () => {
      setLive(null);
      requestLive();
    });
    if (feeds === null) {
      live.append(label(t('cmu-tape-live-asking'), '#AAAAAA'));
      return;
    }
    // the game lists each feed here with its holder, place and a WATCH button; the emulator's relay has none
    if (feeds.length === 0) live.append(label(t('cmu-tape-live-none'), '#AAAAAA'));
    live.append(refresh);
  }

  /**
   * RequestTapeLive: the server answers with the broadcasting cameras on the TV network. There are none in the
   * emulator, so the answer is always an empty list, after the moment a round trip takes.
   */
  function requestLive() {
    const run = ++asking;
    setTimeout(() => {
      if (run === asking) setLive([]);
    }, RELAY_DELAY);
  }

  /** CMUNetTape.PlayFixed: plays a tape as a link names it, made from its title so it is always the same. */
  root.playFixed = (fixedTitle, channel, genre) => {
    if (!grammar) return;
    const tape = generate(titleSeed(fixedTitle), grammar, colony, { results, genre: genre ?? null, strings });
    tape.title = fixedTitle;
    if (channel.length > 0) tape.channel = channel;
    player.load(tape);
    title.textContent = tape.title;
    byline.textContent = t('cmu-tape-byline', { channel: tape.channel, rewinds: tape.rewinds });
    updatePlay();
  };

  /** CMUNetTape.Preview: the first tape of a genre from the seeds after this one, wound to a scene kind. */
  root.preview = (genre, kind, from) => {
    for (let seed = from; seed < from + 500; seed++) {
      const tape = make(seed);
      if (!tape || tape.genre !== genre) continue;
      playSeed(seed);
      let at = 0;
      for (const scene of tape.scenes) {
        if (scene.kind === kind) {
          player.seek(at + scene.duration * 0.6);
          return seed;
        }
        at += scene.duration;
      }
      return seed;
    }
    return null;
  };

  // EnteredTree: a tape straight away (unless told to wait), the shelf, then the bet state and the live list asked for
  if (showLive) setLive(null);
  root.ready = loadGrammar().then(loaded => {
    grammar = loaded;
    player.weatherIcons = (grammar && grammar.weather) || {};
    if (!player.tape && autoplay) playSeed(randomSeed());
    fillShelf();
  }).catch(e => console.warn(`youtape: ${e.message}`)).finally(() => {
    requestBets().then(found => (results = found)).catch(() => {});
    if (showLive) requestLive();
  });
  return root;
}

/**
 * <CMUNetTapeLink/>: the title as a link, in YouTape's red and the bold sans at 15. Clicking it plays the tape in the
 * page's <CMUNetTape> and scrolls up to it. Without a Title the tag fails, as TryParseTag does.
 */
export function createTapeLink(args = {}, style = {}, ctx = {}) {
  injectStyle();
  if (args.Title === undefined) return null;
  const strings = ctx.strings || {};
  const number = args.Number !== undefined ? `${args.Number} ` : '';
  const tip = L(strings['cmu-tape-link-tooltip'] === undefined ? FALLBACK : strings, 'cmu-tape-link-tooltip');
  const link = el('a.emu-tape-link', { text: `${number}${args.Title}`, title: tip });
  Object.assign(link.style, { color: '#FF2A2A', font: `700 ${px(15)} ${fontStack('Sans')}` });
  link.addEventListener('click', event => {
    event.preventDefault();
    const page = link.closest('.page-scroll') || link.closest('.page-content') || document;
    const player = page.querySelector('.emu-tape');
    if (!player || !player.playFixed) return;
    player.playFixed(args.Title, args.Channel ?? '', args.Genre ?? null);
    player.scrollIntoView({ block: 'start' });
  });
  return link;
}

/**
 * <CMUNetReels/>: one reel plays, then the next comes on by itself, or flick with UP and DOWN. Beside the screen,
 * the reel's channel, its likes and its hook.
 */
export function createReels(args = {}, style = {}, ctx = {}) {
  injectStyle();
  const strings = ctx.strings || {};
  const t = (id, vars) => L(strings[id] === undefined ? FALLBACK : strings, id, vars);
  const colony = ctx.colony || t('cmu-tape-default-colony');
  const seen = [];
  let at = -1;
  let grammar = null;
  const player = new TapePlayer(strings, { size: PORTRAIT, onEnded: () => show(at + 1) });
  const label = colour => {
    const node = el('div.emu-tape-label');
    node.style.color = colour;
    return node;
  };
  const button = text => {
    const node = el('button.emu-tape-button', { type: 'button', text });
    Object.assign(node.style, { background: '#FF2A2A', color: '#FFFFFF' });
    return node;
  };
  const channel = label('#FFFFFF');
  const likes = label('#FF2A2A');
  const hook = label('#AAAAAA');
  const up = button(t('cmu-tape-reel-up'));
  const down = button(t('cmu-tape-reel-down'));
  up.addEventListener('click', () => show(at - 1));
  down.addEventListener('click', () => show(at + 1));
  const root = el('div.emu-reels', {}, player.element,
    el('div.emu-reels-side', {}, up, down, el('div', { style: { minHeight: '10px' } }), channel, likes, hook));

  /** Shows the reel at this place in the feed, making new ones as the feed goes on. */
  function show(index) {
    if (index < 0 || !grammar) return;
    while (seen.length <= index) seen.push(Math.floor(Math.random() * 2147483647));
    at = index;
    const tape = reel(seen[index], grammar, colony, { strings });
    player.load(tape);
    channel.textContent = `@${tape.channel}`;
    likes.textContent = t('cmu-tape-reel-likes', { likes: tape.rewinds });
    hook.textContent = tape.title;
  }

  /** Flicks to the next reel, as DOWN does. */
  root.next = () => show(at + 1);
  root.ready = loadGrammar().then(loaded => {
    grammar = loaded;
    player.weatherIcons = (grammar && grammar.weather) || {};
    if (at < 0) show(0);
  }).catch(e => console.warn(`youtape: ${e.message}`));
  return root;
}

