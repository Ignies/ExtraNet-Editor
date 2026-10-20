// Reads game resources: textures, RSIs, prototypes and locale strings. By default from the bundled snapshot in
// game/ (the ExtraNet pages, prototypes and CMU art, see tools/snapshot.py), falling back to the public master
// branch on GitHub for everything else; or straight from a repository (a GitHub branch or a local checkout).
// A rooted resource path like /Textures/x.png is looked up the way the game's merged resource folders resolve it:
// first Content.CMU/Resources/, then Resources/.

/** The bundled snapshot, with GitHub master behind it. */
export const BUNDLED = 'bundled';
export const GITHUB_REPO = 'https://raw.githubusercontent.com/Ignies/ColonialMarinesUniverse/Personal-Computers/';
export const MASTER_REPO = 'https://raw.githubusercontent.com/Ignies/ColonialMarinesUniverse/master/';
export const DEFAULT_REPO = BUNDLED;
const GAME = new URL('../game/', import.meta.url).href;

let repoBase = DEFAULT_REPO;
let snapshot = null;
let localProvider = () => null;
const cache = new Map();
const listeners = new Set();

export function getRepoBase() {
  return repoBase;
}

export function setRepoBase(url) {
  let base = (url || '').trim() || DEFAULT_REPO;
  if (base !== BUNDLED && !base.endsWith('/')) base += '/';
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

/** A short name for the source, for the status bar and toasts. */
export function repoLabel(base = repoBase) {
  if (base === BUNDLED) return 'bundled snapshot';
  const gh = githubParts(base);
  if (gh) return `github.com/${gh.owner}/${gh.repo} ${gh.branch}`;
  return base;
}

export function isBundled() {
  return repoBase === BUNDLED;
}

/** The snapshot's file list (game/index.json): { files: Set, generated, commit }. */
export function snapshotInfo() {
  if (!snapshot) {
    snapshot = fetch(GAME + 'index.json').then(r => (r.ok ? r.json() : { files: [] })).then(j => ({ ...j, files: new Set(j.files || []) }))
      .catch(() => ({ files: new Set() }));
  }
  return snapshot;
}

/** Repository paths a rooted resource path may live at, likely one first. */
function resourcePaths(path) {
  let p = path.trim();
  if (!p.startsWith('/')) p = '/' + p;
  const paths = [`Content.CMU/Resources${p}`, `Resources${p}`];
  // Both folders are tried, but the likely one first saves a 404 per file. Content.CMU/Resources/Textures only
  // holds CMU14, _RuMC14 and Shaders, so everything else (the fonts, the upstream _RMC14 art) is in Resources.
  return /^\/(Textures\/(CMU14|_RuMC14|Shaders)\/|ServerInfo\/|Fonts\/ComicNeue\/)/.test(p) ? paths : paths.reverse();
}

/** Candidate URLs for a resource path, in lookup order. */
async function resourceUrls(path) {
  const paths = resourcePaths(path);
  if (!isBundled()) return paths.map(p => repoBase + p);
  const { files } = await snapshotInfo();
  const own = paths.find(p => files.has(p));
  if (own) return [GAME + own];
  // The snapshot holds these folders whole: what it lacks does not exist, and is not worth a request to GitHub.
  if (files.size && paths.some(p => SNAPSHOT_FOLDERS.some(folder => p.startsWith(folder)))) return [];
  return paths.map(p => MASTER_REPO + p);
}

const SNAPSHOT_FOLDERS = [
  'Content.CMU/Resources/Textures/CMU14/PersonalComputers/',
  'Content.CMU/Resources/ServerInfo/CMU14/ExtraNet/',
  'Content.CMU/Resources/Prototypes/CMU14/PersonalComputers/',
];

/** The URL of a file by its path from the repository root. */
async function repoFileUrl(path) {
  const clean = path.replace(/^\/+/, '');
  if (!isBundled()) return repoBase + clean;
  const { files } = await snapshotInfo();
  return (files.has(clean) ? GAME : MASTER_REPO) + clean;
}

async function fetchFirst(urls, kind) {
  let last = null;
  for (const url of urls) {
    try {
      // GitHub raw files rarely change within a visit; the editor's own snapshot follows the server's caching.
      const response = await fetch(url, { cache: url.startsWith(GAME) ? 'default' : 'force-cache' });
      if (response.ok) {
        const data = kind === 'text' ? await response.text() : kind === 'json' ? await response.json() : await response.blob();
        return { url, data };
      }
      last = `${response.status} ${url}`;
    } catch (e) {
      last = `${e.message} ${url}`;
    }
  }
  throw new Error(`not found: ${last || '404 (not in the bundled snapshot)'}`);
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
  return cached(`${kind}:${path}`, async () => fetchFirst(await resourceUrls(path), kind));
}

/** A repository file by its path from the repository root, e.g. Content.CMU/Resources/Prototypes/... */
export function fetchRepoFile(path, kind = 'text') {
  return cached(`repo:${kind}:${path}`, async () => fetchFirst([await repoFileUrl(path)], kind));
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
    } else if (key && (/^\s+\S/.test(line) || /^\}/.test(line)) && !line.trim().startsWith('.')) {
      // Indented lines continue the value; so does the closing brace of a select, which sits in column 0.
      out[key] += (out[key] ? ' ' : '') + line.trim();
    } else if (!line.trim() || line.startsWith('#')) {
      key = null;
    }
  }
  return out;
}

export function locale() {
  return cached('locale', async () => {
    const { data } = await fetchRepoFile('Content.CMU/Resources/Locale/en-US/CMU14/personal-computers.ftl', 'text');
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
    const { data } = await fetchRepoFile(PC_PROTOTYPES + 'deep_ads.yml', 'text');
    const ads = new Map();
    for (const ad of scanPrototypes(data, 'cmuDeepAd')) ads.set(ad.id, ad);
    return ads;
  });
}

export function wallpapers() {
  return cached('wallpapers', async () => {
    const { data } = await fetchRepoFile(PC_PROTOTYPES + 'wallpapers.yml', 'text');
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
        const { data } = await fetchRepoFile(PC_PROTOTYPES + file, 'text');
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

export function githubParts(base = repoBase) {
  const m = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/(.+?)\/?$/.exec(base);
  return m ? { owner: m[1], repo: m[2], branch: m[3] } : null;
}

/** A folder's entries in the snapshot: [{ name, dir }]. */
async function snapshotDirectory(repoPath) {
  const { files } = await snapshotInfo();
  const prefix = repoPath.replace(/^\/+|\/+$/g, '') + '/';
  const out = new Map();
  for (const file of files) {
    if (!file.startsWith(prefix)) continue;
    const rest = file.slice(prefix.length);
    const slash = rest.indexOf('/');
    const name = slash < 0 ? rest : rest.slice(0, slash);
    if (!out.has(name)) out.set(name, { name, dir: slash >= 0 });
  }
  return [...out.values()];
}

export async function listDirectory(repoPath) {
  if (isBundled()) {
    // The snapshot's own files, plus master's for the folders it does not cover (most game sprites).
    const own = await snapshotDirectory(repoPath);
    let upstream = [];
    try {
      upstream = await githubDirectory(githubParts(MASTER_REPO), repoPath);
    } catch (e) {
      if (!own.length) throw e;
    }
    const merged = new Map(upstream.map(i => [i.name, i]));
    for (const item of own) merged.set(item.name, item);
    return [...merged.values()];
  }
  const gh = githubParts();
  if (gh) return githubDirectory(gh, repoPath);
  // A local server's directory index, such as python -m http.server.
  const response = await fetch(repoBase + (repoPath.endsWith('/') ? repoPath : repoPath + '/'));
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

/** A folder of a GitHub branch, through the contents API. */
async function githubDirectory(gh, repoPath) {
  const url = `https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/${repoPath}?ref=${encodeURIComponent(gh.branch)}`;
  const response = await fetch(url);
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`GitHub API ${response.status}${response.status === 403 ? ' (rate limited, try again later)' : ''}`);
  const items = await response.json();
  return items.map(item => ({ name: item.name, dir: item.type === 'dir' }));
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

// ---------------------------------------------------------------- whole folders, for the library and the emulator

const TREE_TTL = 30 * 60 * 1000;

function treeKey(prefix) {
  return `extranet-tree:${repoBase}:${prefix}`;
}

/** Every file under a repository folder, as paths relative to it. GitHub: one tree call, kept for half an hour. */
export function listTree(prefix, { refresh = false } = {}) {
  const clean = prefix.replace(/^\/+|\/+$/g, '');
  if (refresh) {
    cache.delete(`tree:${clean}`);
    try {
      localStorage.removeItem(treeKey(clean));
    } catch {
      // nothing kept
    }
  }
  return cached(`tree:${clean}`, async () => {
    if (isBundled()) {
      const { files } = await snapshotInfo();
      const prefix = clean + '/';
      return [...files].filter(f => f.startsWith(prefix)).map(f => f.slice(prefix.length));
    }
    const gh = githubParts();
    if (!gh) return crawl(clean);
    let stale = null;
    try {
      stale = JSON.parse(localStorage.getItem(treeKey(clean)) || 'null');
    } catch {
      stale = null;
    }
    if (stale && Date.now() - stale.at < TREE_TTL) return stale.files;
    try {
      const url = `https://api.github.com/repos/${gh.owner}/${gh.repo}/git/trees/${encodeURIComponent(`${gh.branch}:${clean}`)}?recursive=1`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`GitHub API ${response.status}${response.status === 403 ? ' (rate limited, try again later)' : ''}`);
      const json = await response.json();
      const files = json.tree.filter(item => item.type === 'blob').map(item => item.path);
      try {
        localStorage.setItem(treeKey(clean), JSON.stringify({ at: Date.now(), files }));
      } catch {
        // too big for storage: kept for this visit
      }
      return files;
    } catch (e) {
      if (stale) return stale.files;
      throw e;
    }
  });
}

/** A local server's directory listings, folder by folder. */
async function crawl(root) {
  const files = [];
  let queue = [''];
  while (queue.length) {
    const batch = queue;
    queue = [];
    const results = await Promise.all(batch.map(dir => listDirectory(`${root}/${dir}`).then(items => ({ dir, items })).catch(() => ({ dir, items: [] }))));
    for (const { dir, items } of results) {
      for (const item of items) {
        if (item.dir) queue.push(`${dir}${item.name}/`);
        else files.push(`${dir}${item.name}`);
      }
    }
  }
  if (!files.length) throw new Error(`no files listed under ${root}: serve the checkout with python -m http.server, which lists folders`);
  return files;
}

/** Whether game files come from GitHub (true) or a checkout on a local server (false). */
export function isGithub() {
  return githubParts() !== null;
}
