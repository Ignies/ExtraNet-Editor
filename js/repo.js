// Reads game resources straight from the repository: textures, RSIs, prototypes and locale strings.
// A rooted resource path like /Textures/x.png is looked up the way the game's merged resource folders resolve it:
// first Content.CMU/Resources/, then Resources/.

export const DEFAULT_REPO = 'https://raw.githubusercontent.com/Ignies/ColonialMarinesUniverse/Personal-Computers/';

let repoBase = DEFAULT_REPO;
let localProvider = () => null;
const cache = new Map();
const listeners = new Set();

export function getRepoBase() {
  return repoBase;
}

export function setRepoBase(url) {
  let base = (url || '').trim() || DEFAULT_REPO;
  if (!base.endsWith('/')) base += '/';
  if (base === repoBase) return;
  repoBase = base;
  cache.clear();
  for (const listener of listeners) listener();
}

export function onRepoChanged(listener) {
  listeners.add(listener);
}

/** The checkout this page is served from, when it is served from inside the repository. */
export function localCheckoutBase() {
  const marker = '/Content.CMU/Tools/ExtraNetEditor/';
  const path = location.pathname;
  const index = path.indexOf(marker);
  if (location.protocol.startsWith('http') && index >= 0) return location.origin + path.slice(0, index + 1);
  return null;
}

/**
 * Files inside the package being edited, for "./" paths. The provider gets the path after "./" and returns a
 * Blob or null.
 */
export function setLocalProvider(provider) {
  localProvider = provider;
}

export function isLocal(path) {
  return path.startsWith('./');
}

/** Candidate URLs for a resource path, in lookup order. */
export function resourceUrls(path) {
  let p = path.trim();
  if (!p.startsWith('/')) p = '/' + p;
  const urls = [`${repoBase}Content.CMU/Resources${p}`, `${repoBase}Resources${p}`];
  // The game's fonts all live in Resources/Fonts; asking there first saves a 404 per face.
  return p.startsWith('/Fonts/') ? urls.reverse() : urls;
}

/** A file in the repository by its path from the repository root. */
export function repoUrl(path) {
  return repoBase + path.replace(/^\/+/, '');
}

async function fetchFirst(urls, kind) {
  let last = null;
  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: 'force-cache' });
      if (response.ok) {
        const data = kind === 'text' ? await response.text() : kind === 'json' ? await response.json() : await response.blob();
        return { url, data };
      }
      last = `${response.status} ${url}`;
    } catch (e) {
      last = `${e.message} ${url}`;
    }
  }
  throw new Error(`not found: ${last}`);
}

function cached(key, make) {
  if (!cache.has(key)) {
    const promise = make();
    promise.catch(() => {});
    cache.set(key, promise);
  }
  return cache.get(key);
}

/** A resource as { url, data }. "./x" paths come from the package, rooted ones from the repository. */
export function fetchResource(path, kind = 'blob') {
  if (isLocal(path)) {
    const blob = localProvider(path.slice(2));
    if (!blob) return Promise.reject(new Error(`${path} is not in the package`));
    if (kind === 'blob') return Promise.resolve({ url: path, data: blob });
    return blob.text().then(text => ({ url: path, data: kind === 'json' ? JSON.parse(text) : text }));
  }
  return cached(`${kind}:${path}`, () => fetchFirst(resourceUrls(path), kind));
}

/** A repository file by its path from the repository root, e.g. Content.CMU/Resources/Prototypes/... */
export function fetchRepoFile(path, kind = 'text') {
  return cached(`repo:${kind}:${path}`, () => fetchFirst([repoUrl(path)], kind));
}

const objectUrls = new Map();

/** A URL an <img> can show for a resource path. */
export async function imageUrl(path) {
  if (isLocal(path)) {
    const blob = localProvider(path.slice(2));
    if (!blob) throw new Error(`${path} is not in the package`);
    return URL.createObjectURL(blob);
  }
  if (objectUrls.has(path)) return objectUrls.get(path);
  const { data } = await fetchResource(path, 'blob');
  const url = URL.createObjectURL(data);
  objectUrls.set(path, url);
  return url;
}

/** Whether a resource exists. Returns true, false, or null when the repository could not be reached. */
export async function resourceExists(path) {
  try {
    await fetchResource(path, 'blob');
    return true;
  } catch (e) {
    return /not found: (404|4\d\d)/.test(e.message) ? false : isLocal(path) ? false : null;
  }
}

// ---------------------------------------------------------------- game data

const PC_PROTOTYPES = 'Content.CMU/Resources/Prototypes/CMU14/PersonalComputers/';

/** Minimal Fluent reader: "key = value" with indented continuation lines. */
export function parseFtl(text) {
  const out = {};
  let key = null;
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const m = /^([a-zA-Z][\w-]*)\s*=\s?(.*)$/.exec(line);
    if (m) {
      key = m[1];
      out[key] = m[2];
    } else if (key && /^\s+\S/.test(line) && !line.trim().startsWith('.')) {
      out[key] += (out[key] ? ' ' : '') + line.trim();
    } else if (!line.trim() || line.startsWith('#')) {
      key = null;
    }
  }
  return out;
}

export function locale() {
  return cached('locale', async () => {
    const { data } = await fetchFirst([repoUrl('Content.CMU/Resources/Locale/en-US/CMU14/personal-computers.ftl')], 'text');
    return parseFtl(data);
  });
}

/** Prototype entries of a YAML file as plain objects, found with a light scan (one level of fields). */
export function scanPrototypes(text, type) {
  const out = [];
  const blocks = text.replace(/\r\n?/g, '\n').split(/\n(?=- type: )/);
  for (const block of blocks) {
    const head = /^- type: (\S+)/m.exec(block);
    if (!head || head[1] !== type) continue;
    const entry = {};
    for (const line of block.split('\n')) {
      const m = /^ {2}([A-Za-z]\w*):\s*(.*)$/.exec(line);
      if (!m) continue;
      let value = m[2].replace(/\s+#.*$/, '').trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        try {
          value = JSON.parse(value);
        } catch {
          value = value.slice(1, -1);
        }
      }
      entry[m[1]] = value;
    }
    out.push(entry);
  }
  return out;
}

export function deepAds() {
  return cached('ads', async () => {
    const { data } = await fetchFirst([repoUrl(PC_PROTOTYPES + 'deep_ads.yml')], 'text');
    const ads = new Map();
    for (const ad of scanPrototypes(data, 'cmuDeepAd')) ads.set(ad.id, ad);
    return ads;
  });
}

export function wallpapers() {
  return cached('wallpapers', async () => {
    const { data } = await fetchFirst([repoUrl(PC_PROTOTYPES + 'wallpapers.yml')], 'text');
    const map = new Map();
    for (const wallpaper of scanPrototypes(data, 'cmuWallpaper')) map.set(wallpaper.id, wallpaper);
    return map;
  });
}

/** Addresses of the game's own sites, to catch a package reusing one. */
export function knownAddresses() {
  return cached('addresses', async () => {
    const map = new Map();
    for (const file of ['sites.yml', 'boards.yml', 'deep_web.yml']) {
      try {
        const { data } = await fetchFirst([repoUrl(PC_PROTOTYPES + file)], 'text');
        for (const site of scanPrototypes(data, 'cmuNetSite')) if (site.address) map.set(site.address.toLowerCase(), site.id);
      } catch {
        // A file that moved does not stop the others from being checked.
      }
    }
    if (map.size === 0) throw new Error('could not read the game\'s site list');
    return map;
  });
}

/** Snapshot data shipped with the editor (data/*.json). */
export function bundled(name) {
  return cached(`bundled:${name}`, async () => {
    const response = await fetch(new URL(`../data/${name}`, import.meta.url));
    if (!response.ok) throw new Error(`data/${name} missing`);
    return response.json();
  });
}

// ---------------------------------------------------------------- directory listings for the sprite browser

function githubParts() {
  const m = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/(.+?)\/?$/.exec(repoBase);
  return m ? { owner: m[1], repo: m[2], branch: m[3] } : null;
}

async function listDirectory(repoPath) {
  const gh = githubParts();
  if (gh) {
    const url = `https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/${repoPath}?ref=${encodeURIComponent(gh.branch)}`;
    const response = await fetch(url);
    if (response.status === 404) return [];
    if (!response.ok) throw new Error(`GitHub API ${response.status}${response.status === 403 ? ' (rate limited, try again later)' : ''}`);
    const items = await response.json();
    return items.map(item => ({ name: item.name, dir: item.type === 'dir' }));
  }
  // A local server's directory index, such as python -m http.server.
  const response = await fetch(repoUrl(repoPath.endsWith('/') ? repoPath : repoPath + '/'));
  if (!response.ok) return [];
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = [];
  for (const a of doc.querySelectorAll('a[href]')) {
    const href = decodeURIComponent(a.getAttribute('href'));
    if (href.startsWith('?') || href.startsWith('/') || href.startsWith('..') || href.includes('://')) continue;
    const dir = href.endsWith('/');
    out.push({ name: dir ? href.slice(0, -1) : href, dir });
  }
  return out;
}

/** Lists a rooted resource folder (e.g. /Textures/_RMC14/Objects) across both resource roots. */
export function listResourceFolder(path) {
  const clean = path.replace(/^\/+|\/+$/g, '');
  return cached(`list:${clean}`, async () => {
    const results = await Promise.allSettled([
      listDirectory(`Content.CMU/Resources/${clean}`),
      listDirectory(`Resources/${clean}`),
    ]);
    const merged = new Map();
    let failure = null;
    for (const result of results) {
      if (result.status === 'rejected') {
        failure = result.reason;
        continue;
      }
      for (const item of result.value) if (!merged.has(item.name)) merged.set(item.name, item);
    }
    if (merged.size === 0 && failure) throw failure;
    return [...merged.values()].sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name));
  });
}
