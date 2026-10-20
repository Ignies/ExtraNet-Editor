// The colony PC's own sounds, as CMUPersonalComputerBui plays them: the boot sound (with a glitch over it on a
// hacked machine), the running hum that takes over after the OS's bootSoundLength and loops seamlessly until
// the machine goes off, the shutdown, a random keystroke per key typed, the OS's click, new mail and the ad pop
// up error. Volumes are the game's, in dB. The hum is a looping AudioBufferSourceNode: an <audio loop> leaves a
// gap at the seam.
//
// The context is made and resumed on the power key press, the user gesture browsers wait for. A mute toggle and a
// volume slider in the emulator's bar are kept in this browser.

import { fetchResource, fetchRepoFile } from '../repo.js';
import { parseYaml } from '../yaml.js';
import { PROTOTYPES } from '../library.js';

const KEYS = Array.from({ length: 22 }, (_, i) => `/Audio/CMU14/PersonalComputers/key_${String(i + 1).padStart(2, '0')}.ogg`);

/** What an OS prototype gives when it names no sound. The paths are the shipped files. */
const DEFAULTS = {
  bootSound: '/Audio/CMU14/PersonalComputers/boot_start.ogg',
  runningSound: '/Audio/CMU14/PersonalComputers/running.ogg',
  shutdownSound: '/Audio/CMU14/PersonalComputers/shutdown.ogg',
  clickSound: '/Audio/CMU14/PersonalComputers/click.ogg',
  glitchSound: '/Audio/CMU14/PersonalComputers/glitch.ogg',
  mailSound: '/Audio/CMU14/PersonalComputers/mail.ogg',
  errorSound: '/Audio/CMU14/PersonalComputers/error.ogg',
  oldClick: '/Audio/CMU14/PersonalComputers/click_old.ogg',
};

/** The game's volumes (CMUPersonalComputerBui.Play), in dB. */
export const VOLUME = { boot: -4, shutdown: -4, running: -10, key: -8, click: -6, glitch: -6, error: -6, mail: -4 };

const VOLUME_KEY = 'extranet-emulator-pc-volume';
const MUTE_KEY = 'extranet-emulator-pc-muted';

let context = null;
let master = null;
const buffers = new Map();
const playing = new Set();
let hum = null;
let collections = null;

function stored(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function store(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // this visit only
  }
}

let volume = Math.min(1, Math.max(0, Number(stored(VOLUME_KEY, 0.8)) || 0));
let muted = Boolean(stored(MUTE_KEY, false));

function applyGain() {
  if (master) master.gain.value = muted ? 0 : volume;
}

export function getVolume() {
  return volume;
}

export function setVolume(value) {
  volume = Math.min(1, Math.max(0, value));
  store(VOLUME_KEY, volume);
  applyGain();
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = Boolean(value);
  store(MUTE_KEY, muted);
  applyGain();
}

/** Makes and resumes the audio context. Call it from a user gesture (the power key). */
export function unlock() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  if (!context) {
    context = new Context();
    master = context.createGain();
    master.connect(context.destination);
    applyGain();
  }
  if (context.state !== 'running') context.resume().catch(() => {});
}

function buffer(path) {
  if (!path || !context) return Promise.resolve(null);
  if (!buffers.has(path)) {
    buffers.set(path, fetchResource(path, 'blob')
      .then(({ data }) => data.arrayBuffer())
      .then(data => context.decodeAudioData(data))
      .catch(e => {
        console.warn(`emulator sound ${path}: ${e.message}`);
        return null;
      }));
  }
  return buffers.get(path);
}

/** Plays a sound at a volume in dB. Resolves to its source node (or null). */
export async function play(path, db = 0, { pitch = 1, loop = false } = {}) {
  if (!context || !path) return null;
  const data = await buffer(path);
  if (!data || context.state === 'closed') return null;
  const source = context.createBufferSource();
  source.buffer = data;
  source.loop = loop;
  source.playbackRate.value = pitch;
  const gain = context.createGain();
  gain.gain.value = Math.pow(10, db / 20);
  source.connect(gain).connect(master);
  source.addEventListener('ended', () => playing.delete(source));
  playing.add(source);
  source.start();
  return source;
}

/** The sound files of an OS prototype, with the keystroke collection read from sounds.yml. */
export async function soundsOf(os) {
  if (!collections) {
    collections = fetchRepoFile(PROTOTYPES + 'sounds.yml', 'text').then(({ data }) => {
      const out = new Map();
      for (const entry of parseYaml(data).value || []) {
        if (entry && entry.type === 'soundCollection' && Array.isArray(entry.files)) out.set(entry.id, entry.files.map(String));
      }
      return out;
    }).catch(() => new Map());
  }
  const all = await collections;
  const pick = (key, fallback) => {
    const spec = os && os[key];
    if (spec && typeof spec === 'object' && spec.path) return [String(spec.path)];
    if (spec && typeof spec === 'object' && spec.collection && all.has(spec.collection)) return all.get(spec.collection);
    if (typeof spec === 'string') return [spec];
    return fallback ? [fallback] : [];
  };
  return {
    boot: pick('bootSound', DEFAULTS.bootSound)[0],
    running: pick('runningSound', DEFAULTS.runningSound)[0],
    shutdown: pick('shutdownSound', DEFAULTS.shutdownSound)[0],
    click: pick('clickSound', os && os.id === 'CMUOsSeegson' ? DEFAULTS.oldClick : DEFAULTS.clickSound)[0],
    glitch: pick('glitchSound', DEFAULTS.glitchSound)[0],
    mail: pick('mailSound', DEFAULTS.mailSound)[0],
    error: pick('errorSound', DEFAULTS.errorSound)[0],
    keys: (() => {
      const list = pick('keySound', null);
      return list.length ? list : KEYS;
    })(),
    bootLength: Number(os && os.bootSoundLength) || 9.6,
  };
}

/** Fetches and decodes an OS's sounds ahead of time, so the first key press is not late. */
export function preload(sounds) {
  if (!context) return;
  for (const path of [sounds.boot, sounds.running, sounds.shutdown, sounds.click, sounds.glitch, sounds.mail, sounds.error, ...sounds.keys]) buffer(path);
}

/** A random keystroke, its pitch varied as the game varies it (0.9 to 1.1). */
export function keystroke(sounds) {
  if (!sounds || !sounds.keys.length) return;
  play(sounds.keys[Math.floor(Math.random() * sounds.keys.length)], VOLUME.key, { pitch: 0.9 + Math.random() * 0.2 });
}

/** Starts the running hum, looping without a gap. */
export async function startHum(path) {
  stopHum();
  const token = {};
  hum = token;
  const source = await play(path, VOLUME.running, { loop: true });
  if (hum !== token) {
    if (source) source.stop();
    return;
  }
  hum = source;
}

export function stopHum() {
  if (hum && hum.stop) {
    playing.delete(hum);
    try {
      hum.stop();
    } catch {
      // already stopped
    }
  }
  hum = null;
}

/** Whether the hum is running (for tests). */
export function humming() {
  return Boolean(hum && hum.buffer && hum.loop);
}

/** Stops every sound now: leaving the emulator. */
export function stopAll() {
  stopHum();
  for (const source of playing) {
    try {
      source.stop();
    } catch {
      // already stopped
    }
  }
  playing.clear();
}

/** The audio context's state, for tests. */
export function state() {
  return context ? context.state : 'none';
}

