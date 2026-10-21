// YouTape's player (<CMUNetTape/>), ported from CMUNetTape in
// Content.CMU/Client/PersonalComputers/YouTape/CMUNetTape.cs. It plays a random tape straight away, with buttons to
// play, rewind and put on another, a shelf of more random tapes by title, and the broadcasting cameras on air now.
// Shelf="0" leaves the shelf out (at most 12), Live="false" the live list.
//
// Tapes are built from their seed by youtape/generator.js and drawn by youtape/player.js. The live list comes from
// the server in game (CMUYouTapeLiveSystem lists the cameras on the TV network); the emulator has no round and no
// cameras, so it answers the request the way a server with nobody broadcasting does.

import { el } from '../util.js';
import { L } from './data.js';
import { loadGrammar, generate } from './youtape/generator.js';
import { TapePlayer, SCREEN_WIDTH, SCREEN_HEIGHT } from './youtape/player.js';

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
};

/** How long the emulated relay takes to answer a request for the live list, in milliseconds. */
const RELAY_DELAY = 450;

const STYLE_ID = 'emu-tape-style';
const STYLE = `
.emu-tape { display: flex; flex-direction: column; gap: 4px; margin: 6px 0; min-width: 0; align-items: flex-start; }
.emu-tape-screen { display: block; width: ${SCREEN_WIDTH}px; max-width: 100%; aspect-ratio: ${SCREEN_WIDTH} / ${SCREEN_HEIGHT};
  image-rendering: pixelated; }
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

  let grammar = null;
  const randomSeed = () => Math.floor(Math.random() * 2147483647);
  const make = seed => (grammar ? generate(seed, grammar, colony) : null);

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
  const root = el('div.emu-tape', {}, player.canvas, el('div.emu-tape-row', {}, rewind, play, next), title, byline);
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

  // EnteredTree: a tape straight away, the shelf, and the live list asked for
  if (showLive) setLive(null);
  loadGrammar().then(loaded => {
    grammar = loaded;
    player.weatherIcons = (grammar && grammar.weather) || {};
    if (!player.tape) playSeed(randomSeed());
    fillShelf();
  }).catch(e => console.warn(`youtape: ${e.message}`)).finally(() => {
    if (showLive) requestLive();
  });
  return root;
}
