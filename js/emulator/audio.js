// Sounds for the emulator's games and arenas, a port of CMUGameAudio.cs. The game's .ogg files are read like its
// textures (the bundled snapshot, GitHub master, or the chosen checkout) and played with WebAudio. A sound plays
// only while the element that makes it is on show and the tab is visible, never while the games are muted, and
// the same sound is not stacked within a few frames, so a burst of hits does not get louder than one.
//
// Browsers keep audio silent until the page gets a click or a key, so the context starts on the first one.

import { fetchResource, onRepoChanged } from '../repo.js';

/** Base volume of every game sound, in dB, so a computer screen sits under the round's own audio. */
export const BASE_VOLUME = -5;

/** The same sound is not played again within this many milliseconds. */
const SPACING = 45;

/** A sound that takes longer than this to load is dropped rather than played late. */
const LATE = 250;

const MUTE_KEY = 'extranet-emulator-sound-muted';

/** The scream takes in /Audio/Voice/Human/. */
export const MALE_SCREAMS = [
  '/Audio/Voice/Human/malescream_1.ogg', '/Audio/Voice/Human/malescream_2.ogg',
  '/Audio/Voice/Human/malescream_3.ogg', '/Audio/Voice/Human/malescream_4.ogg',
  '/Audio/Voice/Human/malescream_5.ogg', '/Audio/Voice/Human/malescream_6.ogg',
];

export const FEMALE_SCREAMS = [
  '/Audio/Voice/Human/femalescream_1.ogg', '/Audio/Voice/Human/femalescream_2.ogg',
  '/Audio/Voice/Human/femalescream_3.ogg', '/Audio/Voice/Human/femalescream_4.ogg',
  '/Audio/Voice/Human/femalescream_5.ogg',
];

let context = null;
const bytes = new Map();
const buffers = new Map();
const last = new Map();
const warned = new Set();
const changes = new EventTarget();

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

let muted = readMuted();

/** Whether every game and arena is muted. */
export function isMuted() {
  return muted;
}

/** Mutes or unmutes every game and arena; remembered in this browser. */
export function setMuted(value) {
  value = Boolean(value);
  if (value === muted) return;
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // this visit only
  }
  changes.dispatchEvent(new Event('change'));
}

/** Calls listener whenever the mute changes. Returns a function that stops it. */
export function onMutedChanged(listener) {
  changes.addEventListener('change', listener);
  return () => changes.removeEventListener('change', listener);
}

// The context is made on the first gesture on the page: one made earlier would only warn and stay suspended.
if (typeof document !== 'undefined') {
  const unlock = () => {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    context ??= new Context();
    context.resume().then(() => {
      if (context.state !== 'running') return;
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
    }, () => {});
  };
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);
}

// sounds come from the chosen game source, like the textures
onRepoChanged(() => {
  bytes.clear();
  buffers.clear();
  warned.clear();
});

function warn(path, e) {
  if (warned.has(path)) return;
  warned.add(path);
  console.warn(`game audio: ${path}: ${e.message}`);
}

/** The file's bytes, or null when it cannot be read. Fetched once per path. */
function loadBytes(path) {
  if (!bytes.has(path)) {
    bytes.set(path, fetchResource(path, 'blob').then(({ data }) => data.arrayBuffer()).catch(e => {
      warn(path, e);
      return null;
    }));
  }
  return bytes.get(path);
}

/** The decoded sound, or null. Decoded once per path, after the context exists. */
function loadBuffer(path) {
  if (!buffers.has(path)) {
    buffers.set(path, loadBytes(path).then(data => (data ? context.decodeAudioData(data) : null)).catch(e => {
      warn(path, e);
      return null;
    }));
  }
  return buffers.get(path);
}

/** Starts fetching sounds now, so their first play is on time. */
export function preloadSounds(paths) {
  for (const path of paths) {
    if (context) loadBuffer(path);
    else loadBytes(path);
  }
}

/** Whether an element is on show: in the page, not hidden by any ancestor, and in a visible browser tab. */
function onShow(source) {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
  if (!source) return true;
  return source.isConnected && !source.closest?.('[hidden]') && source.getClientRects().length > 0;
}

/**
 * Plays a sound from /Audio/... when source (the element making it) is on show. volume is in dB over the game
 * base; pitch scales the playback rate.
 */
export function playSound(path, { volume = 0, pitch = 1, source = null } = {}) {
  if (muted || !context || context.state !== 'running' || !onShow(source)) return;
  const ctx = context;
  const now = performance.now();
  if (now - (last.get(path) ?? -Infinity) < SPACING) return;
  last.set(path, now);
  loadBuffer(path).then(buffer => {
    if (!buffer || muted || performance.now() - now > LATE || !onShow(source)) return;
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.playbackRate.value = pitch;
    const gain = ctx.createGain();
    gain.gain.value = Math.pow(10, (BASE_VOLUME + volume) / 20);
    node.connect(gain).connect(ctx.destination);
    node.start();
  });
}

/** Plays one of several takes of a sound, picked at random, with a little pitch variation. */
export function playAny(paths, { volume = 0, spread = 0.08, source = null } = {}) {
  if (!paths.length) return;
  const path = paths[Math.floor(Math.random() * paths.length)];
  playSound(path, { volume, pitch: 1 + (Math.random() * 2 - 1) * spread, source });
}

export function scream(female, { volume = 0, source = null } = {}) {
  playAny(female ? FEMALE_SCREAMS : MALE_SCREAMS, { volume, source });
}
