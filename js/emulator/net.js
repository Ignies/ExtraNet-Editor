// The ExtraNet as one computer sees it: every site of the library by address, the networks this OS reaches,
// deep sites under this session's random aliases, and the ad maze that hides the hidden ones
// (CMUExtraNetSystem, CMUDeepAliasSystem, CMUDeepMazeSystem).

import { loadIndex, pageText, text } from '../library.js';
import { splitAddress } from '../markup.js';
import { listTree, fetchResource } from '../repo.js';
import { hash } from '../util.js';
import { L } from './data.js';

export const DEEP = 'CMUNetDeep';
const ALIAS_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';
const AD_SUFFIX = '.ad';
const DOOR_MARK = ' ::';
const CHAIN_FALLBACK = 0.3;
const PALETTES = [
  ['#FFF200', '#1A1A1A', '#E4002B', '#0033CC', 'Display'],
  ['#0B0B2E', '#E0E0FF', '#FF2FD0', '#3FF2FF', 'Pixel'],
  ['#1E0000', '#FFD0D0', '#FF3030', '#FFE600', 'Sans'],
  ['#00140A', '#B8FFB8', '#7CFF00', '#FF9AE6', 'Terminal'],
  ['#F2F2F2', '#202020', '#FF5A00', '#6A00FF', 'Sans'],
  ['#2B0033', '#F6D6FF', '#FFB000', '#00FFC8', 'Display'],
];
const ART_FOLDERS = ['Content.CMU/Resources/Textures/CMU14/PersonalComputers/Sites/Ads/', 'Content.CMU/Resources/Textures/CMU14/PersonalComputers/Retro/'];

/** A seeded generator with System.Random's helpers. */
export class Rng {
  constructor(seed) {
    this.s = seed >>> 0 || 1;
  }

  float() {
    // mulberry32
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** An integer in [min, max), or [0, min) with one argument. */
  next(min, max) {
    if (max === undefined) {
      max = min;
      min = 0;
    }
    return min + Math.floor(this.float() * (max - min));
  }

  pick(list) {
    return list[this.next(list.length)];
  }
}

/** CMUDeepAddress.NewAlias */
export function newAlias(rng, suffix) {
  const groups = [];
  for (let g = 0; g < 8; g++) {
    let part = '';
    const length = rng.next(4, 6);
    for (let i = 0; i < length; i++) part += ALIAS_CHARS[rng.next(ALIAS_CHARS.length)];
    groups.push(part);
  }
  return groups.join('-') + suffix;
}

export function isAd(host) {
  return host.length > AD_SUFFIX.length && host.length <= 64 && host.endsWith(AD_SUFFIX) && /^[a-z0-9.-]+$/.test(host);
}

function sessionValue(key, make) {
  try {
    const kept = sessionStorage.getItem(key);
    if (kept) return JSON.parse(kept);
  } catch {
    // made fresh below
  }
  const value = make();
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // this page only
  }
  return value;
}

export class Network {
  /**
   * entries: the library index. theme: the OS theme. colony: { id, name }. strings: locale.
   * extraSites(): the user's own sites as library entries (see userEntry); asked again on every lookup, so edits
   * show the next time a page loads. They take over a game site at the same address.
   */
  constructor(entries, theme, colony, strings, { deep = true, extraSites = () => [] } = {}) {
    this.entries = entries;
    this.extraSites = extraSites;
    this.theme = theme;
    this.colony = colony;
    this.strings = strings;
    this.deepAccess = deep;
    this.seed = sessionValue('extranet-emulator-seed', () => (Math.random() * 2 ** 31) | 0);
    this.aliasCache = new Map();
    this.state = sessionValue('extranet-emulator-deep', () => ({ discovered: [], unlocked: [] }));
    this.mazeBuilt = null;
  }

  save() {
    try {
      sessionStorage.setItem('extranet-emulator-deep', JSON.stringify(this.state));
    } catch {
      // this page only
    }
  }

  /** Every site: the user's first, then the game's whose address they do not take. */
  sites() {
    let extra = [];
    try {
      extra = this.extraSites() || [];
    } catch {
      extra = [];
    }
    const taken = new Set(extra.map(e => e.address));
    return [...extra, ...this.entries.filter(e => !taken.has(e.address))];
  }

  byAddress(host) {
    return this.sites().find(e => e.address === host) || null;
  }

  /** This session's random address of a deep site (CMUDeepAliasSystem), steady for the site's id. */
  alias(entry) {
    if (!this.aliasCache.has(entry.id)) this.aliasCache.set(entry.id, newAlias(new Rng((this.seed ^ hash(entry.id)) >>> 0), entry.site.aliasSuffix || '.deep'));
    return this.aliasCache.get(entry.id);
  }

  /** The deep site at an alias, or null. */
  aliased(host) {
    return this.sites().find(e => e.networks.includes(DEEP) && this.alias(e) === host) || null;
  }

  aliasOfKey(key) {
    const entry = this.sites().find(e => e.key === key);
    return entry ? this.alias(entry) : null;
  }

  /** CMUExtraNetSystem.CanReach for the browser asking: the ExtraNet browser leaves the deep network out. */
  reaches(entry, deeps) {
    if (entry.networks.includes(DEEP) && deeps && this.deepAccess) return true;
    return entry.networks.some(n => n !== DEEP && this.theme.networks.includes(n));
  }

  /** Listed sites this computer reaches, for the directory and net://random. */
  directory() {
    return this.sites().filter(e => !e.unlisted && !e.networks.includes(DEEP) && this.reaches(e, false))
      .sort((a, b) => this.title(a).localeCompare(this.title(b)));
  }

  title(entry) {
    return text(this.strings, entry.site.title);
  }

  /**
   * What an address shows, as CMUNetBrowser.Navigate, Show and Resolve decide it. deeps: in The deeps.exi.
   * fromPage: the address came from a link on a page, where deep sites' fixed names still work.
   * Returns one of { kind: 'page', entry, path, file, address } | { kind: 'ad', host, address } |
   * { kind: 'directory' } | { kind: 'deephome' } | { kind: 'denied', entry, address } |
   * { kind: 'unknown', address } | { kind: 'missing', entry, address }
   */
  resolve(raw, deeps = false, fromPage = false) {
    const address = (raw || '').trim();
    const lower = address.toLowerCase();
    const deep = deeps && this.deepAccess;
    if (lower === 'net://random') {
      const list = this.directory();
      if (!list.length) return { kind: 'unknown', address };
      return this.resolve(list[Math.floor(Math.random() * list.length)].address, deeps, fromPage);
    }
    if (deep && lower === 'deeps://home') return { kind: 'deephome' };
    const { host, path } = splitAddress(address);
    if (deep && isAd(host)) return { kind: 'ad', host, address: host };
    if (lower === 'sys://directory') return { kind: 'directory' };

    const normalized = path ? `${host}/${path}` : host;
    let entry = null;
    let shownHost = host;
    // A deep site's alias, in The deeps.exi.
    if (deep) {
      entry = this.aliased(host);
      if (entry) shownHost = host;
    }
    if (!entry) {
      entry = this.byAddress(host);
      if (!entry) return { kind: 'unknown', address: normalized };
      if (entry.networks.includes(DEEP)) {
        // Fixed names of deep sites work in links on pages in The deeps.exi, never typed or elsewhere.
        if (!fromPage || !deep) return { kind: 'unknown', address: normalized };
        shownHost = this.alias(entry);
      } else if (!this.reaches(entry, deeps)) {
        return { kind: 'denied', entry, address: normalized };
      }
    }
    const shown = path ? `${shownHost}/${path}` : shownHost;
    // A hidden site does not exist until this computer has followed the ads to it.
    if (entry.hidden && !this.state.unlocked.includes(entry.key)) return { kind: 'unknown', address: shown };
    const page = entry.site.pages.find(p => p.path.trim().replace(/^\/+|\/+$/g, '').toLowerCase() === path);
    if (!page) return { kind: 'missing', entry, address: shown };
    return { kind: 'page', entry, path, file: page.file.replace(/^\.\//, ''), address: shown };
  }

  /** A page's text as stored, or null. */
  async rawText(entry, file) {
    if (entry.kind === 'user') return file in entry.pkg.texts ? entry.pkg.texts[file] : null;
    return pageText(entry, file);
  }

  /**
   * A page's text as the game loads it: the colony's own version first (ColonyFile), {colony} filled, and "./"
   * paths turned into paths under the site's root (CMUExtraNetSystem.LocalPaths). The user's own site keeps "./",
   * which the editor serves from the package.
   */
  async pageText(entry, file) {
    const variant = `${this.colony.id}/${file}`;
    const own = entry.files.includes(variant) ? await this.rawText(entry, variant) : null;
    let textValue = own ?? await this.rawText(entry, file);
    if (textValue === null) return null;
    textValue = textValue.split('{colony}').join(this.colony.name);
    if (entry.kind !== 'user' && entry.repoDir) {
      const root = '/' + entry.repoDir.replace(/^Content\.CMU\/Resources\//, '').replace(/\/$/, '');
      textValue = textValue.split('"./').join(`"${root}/`);
    }
    return textValue;
  }

  /** A document (Files): a rooted /ServerInfo path. */
  async document(path) {
    try {
      const { data } = await fetchResource(path, 'text');
      return data.replace(/\r\n?/g, '\n');
    } catch {
      return null;
    }
  }

  // ------------------------------------------------------------ the deeps.exi

  /** A scan: a lore site or a chain's first ad page not found yet, sometimes junk. */
  async scan() {
    await this.buildMaze();
    const found = [];
    for (const entry of this.sites()) {
      if (!entry.networks.includes(DEEP) || entry.hidden) continue;
      const alias = this.alias(entry);
      if (!this.state.discovered.includes(alias)) found.push(alias);
    }
    for (const entry of this.maze.entries) if (!this.state.discovered.includes(entry)) found.push(entry);
    const pick = found.length && Math.random() >= 0.25 ? found[Math.floor(Math.random() * found.length)] : newAlias(new Rng((Math.random() * 2 ** 31) | 0), AD_SUFFIX);
    this.state.discovered.push(pick);
    this.save();
    return pick;
  }

  /** Title of something found: the site's, or "sponsored page". */
  foundTitle(address) {
    const entry = this.aliased(address);
    return entry ? this.title(entry) : L(this.strings, 'cmu-deep-home-ad');
  }

  buildMaze() {
    if (!this.mazeBuilt) {
      this.mazeBuilt = (async () => {
        const art = { banners: [], icons: [], animations: [] };
        for (const folder of ART_FOLDERS) {
          try {
            const files = await listTree(folder);
            const rooted = f => '/' + (folder + f).replace(/^Content\.CMU\/Resources\//, '');
            for (const f of files) {
              const name = f.split('/').pop();
              if (f.endsWith('/meta.json')) {
                const rsi = rooted(f.slice(0, -'/meta.json'.length));
                try {
                  const { data } = await fetchResource(`${rsi}/meta.json`, 'json');
                  const width = data.size && data.size.x;
                  const scale = width >= 64 && width < 96 ? 1 : 2;
                  for (const state of data.states || []) art.animations.push({ rsi, state: state.name, scale });
                } catch {
                  // an unreadable RSI is skipped, as the game logs and skips it
                }
                continue;
              }
              if (!name.endsWith('.png') || f.includes('.rsi/')) continue;
              if (name.startsWith('banner_')) art.banners.push(rooted(f));
              else if (name.startsWith('icon_')) art.icons.push(rooted(f));
            }
          } catch {
            // no art from this folder
          }
        }
        art.banners.sort();
        art.icons.sort();
        art.animations.sort((a, b) => `${a.rsi}/${a.state}`.localeCompare(`${b.rsi}/${b.state}`));
        let ads = [];
        try {
          const { deepAds } = await import('../repo.js');
          ads = [...(await deepAds()).keys()].sort();
        } catch {
          ads = [];
        }
        const rng = new Rng(this.seed ^ 0x5bd1e995);
        const doors = new Map();
        const ends = new Map();
        const entries = [];
        const chainPages = [];
        for (const entry of this.entries) {
          if (!entry.hidden || !entry.networks.includes(DEEP)) continue;
          const chain = [];
          const length = rng.next(2, 4);
          for (let i = 0; i < length; i++) chain.push(newAlias(rng, AD_SUFFIX));
          chain.forEach((host, i) => doors.set(host, i + 1 < chain.length ? chain[i + 1] : this.alias(entry)));
          ends.set(chain[chain.length - 1], entry.key);
          entries.push(chain[0]);
          chainPages.push(...chain);
        }
        this.maze = { art, ads, doors, ends, entries, chainPages };
      })();
    }
    return this.mazeBuilt;
  }

  /** The ad page at a host, the same all session. Reaching a chain's last page unlocks its site. */
  async adPage(host) {
    await this.buildMaze();
    const { art, ads, doors, ends, chainPages } = this.maze;
    const unlock = ends.get(host);
    if (unlock && !this.state.unlocked.includes(unlock)) {
      this.state.unlocked.push(unlock);
      this.save();
    }
    const rng = new Rng((this.seed ^ hash(host)) >>> 0);
    const strings = this.strings;
    const dataset = (prefix, count) => L(strings, `${prefix}${rng.next(count) + 1}`);
    const slogan = () => dataset('cmu-deep-ad-slogan-', 30);
    const [background, textColour, heading, link, font] = PALETTES[rng.next(PALETTES.length)];
    const links = [];
    const count = rng.next(5, 9);
    for (let i = 0; i < count; i++) links.push([slogan(), newAlias(rng, AD_SUFFIX)]);
    if (chainPages.length && rng.float() < CHAIN_FALLBACK) links[rng.next(links.length)] = [slogan(), chainPages[rng.next(chainPages.length)]];
    if (doors.has(host)) links.splice(rng.next(links.length + 1), 0, [slogan() + DOOR_MARK, doors.get(host)]);
    const marquee = `${slogan()}  ///  ${slogan()}  ///  ${slogan()}`;
    const headline = dataset('cmu-deep-ad-headline-', 12);
    const q = s => String(s).replace(/"/g, '\'');
    const ad = height => {
      if (ads.length && (!art.banners.length || rng.float() < 0.7)) return `  <CMUNetAd Id="${ads[rng.next(ads.length)]}" Flip="${rng.next(2) === 0 ? 'true' : 'false'}"/>`;
      return art.banners.length ? `  <CMUGuideImage Path="${art.banners[rng.next(art.banners.length)]}" MaxHeight="${height}"/>` : '';
    };
    const out = ['<Document>'];
    out.push(`  <CMUNetStyle Background="${background}" Text="${textColour}" Heading="${heading}" Link="${link}" Font="${font}"/>`);
    out.push(`  <CMUNetBlink Rate="${(0.35 + rng.float() * 0.5).toFixed(2)}">`);
    out.push(`    [color=${heading}][bold]${headline}[/bold][/color]`);
    out.push('  </CMUNetBlink>', '');
    out.push(`  ${L(strings, 'cmu-deep-ad-sponsored', { host })}`);
    out.push(ad(96));
    for (const [label, address] of links) {
      out.push('');
      if (art.animations.length && rng.float() < 0.3) {
        const a = art.animations[rng.next(art.animations.length)];
        const align = ['Left', 'Center', 'Right'][rng.next(3)];
        out.push(`  <CMUNetSprite Rsi="${a.rsi}" State="${a.state}" Scale="${a.scale}" Align="${align}"/>`);
      }
      out.push(`  [netlink="${q(label)}" link="${address}"]`);
      if (rng.float() < 0.3) out.push(ad(72));
    }
    const popups = rng.next(1, 3);
    for (let i = 0; i < popups; i++) {
      const icon = art.icons.length ? ` Icon="${art.icons[rng.next(art.icons.length)]}"` : '';
      out.push(`  <CMUNetPopup Title="${q(dataset('cmu-deep-ad-popup-title-', 10))}" Text="${q(dataset('cmu-deep-ad-popup-text-', 14))}"`
        + ` Link="${newAlias(rng, AD_SUFFIX)}" LinkText="${q(dataset('cmu-deep-ad-popup-action-', 8))}"${icon}`
        + ` X="${rng.float().toFixed(2)}" Y="${(rng.float() * 0.8).toFixed(2)}" Delay="${(0.5 + rng.float() * 3).toFixed(1)}"`
        + ` Background="${background}" Accent="${link}"/>`);
    }
    out.push('', `  <CMUNetMarquee Text="${q(marquee)}" Speed="${rng.next(50, 110)}" Color="${link}"/>`, '</Document>');
    return out.join('\n') + '\n';
  }
}

/** The library index, for the emulator. */
export function allSites() {
  return loadIndex();
}
