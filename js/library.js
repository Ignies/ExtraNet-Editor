// The library: every ExtraNet site in the game, read from the repository. YAML sites come from the prototype
// files in Prototypes/CMU14/PersonalComputers/, packages from any folder under ServerInfo/CMU14/ExtraNet/ with
// a site.yml. Opening one loads it into the editor; curation marks and notes stay in this browser.

import { parseYaml, siteFromRaw, writeSiteYaml } from './yaml.js';
import { packageFromFiles } from './package.js';
import { fetchRepoFile, listTree, listDirectory, locale, isGithub, isBundled, getRepoBase, imageUrl } from './repo.js';

export const EXTRANET = 'Content.CMU/Resources/ServerInfo/CMU14/ExtraNet/';
export const PROTOTYPES = 'Content.CMU/Resources/Prototypes/CMU14/PersonalComputers/';
const KNOWN_YAML = ['sites.yml', 'boards.yml', 'deep_web.yml'];

export const GROUPS = ['Public', 'Boards', 'Retro', 'Deep', 'Corporate / W-Y', 'Seegson', 'CMB', 'Packages'];

/** "key = text {$x}" with the variables filled in. */
export function fill(text, vars = {}) {
  return String(text).replace(/\{\s*\$(\w+)\s*\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}

/** A locale id's text, or the value itself when it is plain text (packages may use plain titles). */
export function text(strings, id, vars) {
  if (!id) return '';
  return fill(strings[id] ?? id, vars);
}

function repoDirOfRoot(root) {
  const clean = root.replace(/^\/+/, '').replace(/\/?$/, '/');
  return `Content.CMU/Resources/${clean}`;
}

function groupOf(site, repoDir, kind) {
  if (kind === 'package') return 'Packages';
  if (site.networks.includes('CMUNetDeep')) return 'Deep';
  const folder = repoDir.slice(EXTRANET.length).split('/')[0];
  switch (folder) {
    case 'Boards': return 'Boards';
    case 'Retro': return 'Retro';
    case 'Deep': return 'Deep';
    case 'WeylandYutani': return 'Corporate / W-Y';
    case 'Seegson': return 'Seegson';
    case 'CMB': return 'CMB';
    default: return 'Public';
  }
}

async function prototypeFiles() {
  try {
    if (isGithub() || isBundled()) {
      const files = await listTree(PROTOTYPES);
      const ymls = files.filter(f => !f.includes('/') && f.endsWith('.yml'));
      if (ymls.length) return ymls;
    } else {
      const items = await listDirectory(PROTOTYPES);
      const ymls = items.filter(i => !i.dir && i.name.endsWith('.yml')).map(i => i.name);
      if (ymls.length) return ymls;
    }
  } catch {
    // the known files are tried below
  }
  return KNOWN_YAML;
}

let indexPromise = null;
let indexBase = null;

/** Every site, as entries (see below). Cached until refresh or a repository change. */
export function loadIndex({ refresh = false } = {}) {
  if (refresh || !indexPromise || indexBase !== getRepoBase()) {
    indexBase = getRepoBase();
    indexPromise = buildIndex(refresh);
    indexPromise.catch(() => {
      indexPromise = null;
    });
  }
  return indexPromise;
}

/**
 * entry = { key, kind: 'yaml'|'package', id, site, title, address, networks, group, repoDir, files, pageCount,
 *           source, unlisted, hidden }
 * site keeps locale ids for YAML sites; title is the resolved text. files are paths relative to repoDir.
 */
async function buildIndex(refresh) {
  const [strings, tree, ymls] = await Promise.all([
    locale().catch(() => ({})),
    listTree(EXTRANET, { refresh }),
    prototypeFiles(),
  ]);
  const entries = [];
  const filesUnder = dir => {
    const rel = dir.slice(EXTRANET.length);
    return tree.filter(f => f.startsWith(rel)).map(f => f.slice(rel.length));
  };

  const yamlResults = await Promise.allSettled(ymls.map(async name => {
    const { data } = await fetchRepoFile(PROTOTYPES + name, 'text');
    if (!data.includes('cmuNetSite')) return [];
    const { value } = parseYaml(data);
    return (Array.isArray(value) ? value : []).filter(v => v && v.type === 'cmuNetSite').map(raw => ({ raw, name }));
  }));
  for (const result of yamlResults) {
    if (result.status !== 'fulfilled') continue;
    for (const { raw, name } of result.value) {
      const site = siteFromRaw(raw);
      if (!site.root) continue;
      const repoDir = repoDirOfRoot(site.root);
      entries.push(makeEntry('yaml', site, repoDir, filesUnder(repoDir), name, strings));
    }
  }

  // Packages: any site.yml under the ExtraNet folder.
  const packages = tree.filter(f => f === 'site.yml' || f.endsWith('/site.yml'));
  const packageResults = await Promise.allSettled(packages.map(async path => {
    const { data } = await fetchRepoFile(EXTRANET + path, 'text');
    const { value } = parseYaml(data);
    const raw = (Array.isArray(value) ? value : []).find(v => v && v.type === 'cmuNetSite');
    if (!raw) return null;
    const site = siteFromRaw(raw);
    const folder = EXTRANET + path.slice(0, -'site.yml'.length);
    const repoDir = site.root ? repoDirOfRoot(site.root) : folder;
    return makeEntry('package', site, repoDir, filesUnder(folder), path, strings, folder);
  }));
  for (const result of packageResults) if (result.status === 'fulfilled' && result.value) entries.push(result.value);

  if (!entries.length) throw new Error('no sites found in the repository');
  entries.sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || a.title.localeCompare(b.title));
  return entries;
}

function makeEntry(kind, site, repoDir, files, source, strings, packageDir = null) {
  return {
    key: kind === 'yaml' ? `yaml:${site.id}` : `pkg:${packageDir || repoDir}`,
    kind,
    id: site.id,
    site,
    title: text(strings, site.title) || site.id,
    address: site.address.trim().toLowerCase(),
    networks: site.networks,
    group: groupOf(site, repoDir, kind),
    repoDir,
    packageDir,
    files,
    pageCount: site.pages.length,
    source,
    unlisted: site.unlisted,
    hidden: site.hidden,
  };
}

/** The repository path of a page file of an entry ("./x" and "x" are both next to the root). */
export function pagePath(entry, file) {
  return entry.repoDir + file.replace(/^\.\//, '');
}

/** A page's text, or null when it is missing. Cached by the repository layer. */
export async function pageText(entry, file) {
  try {
    const { data } = await fetchRepoFile(pagePath(entry, file), 'text');
    return data.replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- thumbnails

const thumbs = new Map();

/** An image URL for the entry's banner: a banner*.png next to it, or the first picture on its index page. */
export function thumbnail(entry) {
  if (!thumbs.has(entry.key)) {
    thumbs.set(entry.key, (async () => {
      const own = entry.files.find(f => /(^|\/)banner[^/]*\.png$/i.test(f) && !f.includes('/'));
      if (own) {
        const { data } = await fetchRepoFile(entry.repoDir + own, 'blob');
        return URL.createObjectURL(data);
      }
      const index = entry.site.pages.find(p => p.path === '') || entry.site.pages[0];
      if (!index) return null;
      const page = await pageText(entry, index.file);
      if (!page) return null;
      const m = /(?:Path|BackgroundImage|Icon)="(\/Textures\/[^"]+\.png)"/.exec(page) || /(?:Path|BackgroundImage)="\.\/([^"]+\.png)"/.exec(page);
      if (!m) return null;
      if (m[1].startsWith('/')) return imageUrl(m[1]);
      const { data } = await fetchRepoFile(entry.repoDir + m[1], 'blob');
      return URL.createObjectURL(data);
    })().catch(() => null));
  }
  return thumbs.get(entry.key);
}

// ---------------------------------------------------------------- opening a site in the editor

async function fetchBytes(path) {
  const { data } = await fetchRepoFile(path, 'blob');
  return new Uint8Array(await data.arrayBuffer());
}

/** Loads an entry as an editor package. Returns { pkg, warnings }. pkg.origin remembers where it came from. */
export async function openEntry(entry) {
  const strings = await locale().catch(() => ({}));
  if (entry.kind === 'package') {
    const files = {};
    await Promise.all(entry.files.map(async f => {
      files[f] = await fetchBytes(entry.packageDir + f);
    }));
    const folder = entry.packageDir.replace(/\/$/, '').split('/').pop();
    const { pkg, warnings } = packageFromFiles(folder, files);
    pkg.origin = {
      kind: 'package', key: entry.key, id: pkg.site.id, repoDir: entry.packageDir, source: entry.source,
      texts: { ...pkg.texts }, siteYaml: writeSiteYaml(pkg.site),
    };
    return { pkg, warnings };
  }

  // A YAML site: its pages and colony versions from its root, titles turned from locale ids into text.
  const site = JSON.parse(JSON.stringify(entry.site));
  const ids = { title: site.title, tabs: site.tabs.map(t => t.title), board: site.board ? { postLabel: site.board.postLabel, empty: site.board.empty } : null };
  site.title = text(strings, site.title);
  for (const tab of site.tabs) tab.title = text(strings, tab.title);
  if (site.board) {
    site.board.postLabel = text(strings, site.board.postLabel);
    site.board.empty = text(strings, site.board.empty);
  }
  const root = site.root;
  site.root = '';
  const texts = {};
  const warnings = [];
  await Promise.all(entry.files.filter(f => /\.xml$/i.test(f)).map(async f => {
    const page = await pageText(entry, f);
    if (page !== null) texts[f] = page;
  }));
  for (const page of site.pages) {
    const file = page.file.replace(/^\.\//, '');
    if (!(file in texts)) {
      const missing = await pageText(entry, file);
      if (missing !== null) texts[file] = missing;
      else warnings.push(`Page "${page.path}" points to ${page.file}, which is not in the repository.`);
    }
  }
  const variants = Object.keys(texts).filter(f => f.includes('/'));
  if (variants.length) warnings.push(`${variants.length} colony versions loaded (pick the map folder in the preview to see them).`);
  const folder = root.replace(/\/$/, '').split('/').pop() || site.id;
  const pkg = { folder, site, texts, images: {}, attributions: [], other: {} };
  pkg.origin = {
    kind: 'yaml', key: entry.key, id: site.id, repoDir: entry.repoDir, root, source: entry.source, ids,
    texts: { ...texts }, settings: settingsSnapshot(site),
  };
  return { pkg, warnings };
}

function settingsSnapshot(site) {
  const { header, ...rest } = site;
  return JSON.stringify(rest);
}

// ---------------------------------------------------------------- exporting changes

const NL = String.fromCharCode(10);

/** Files changed since the site was opened: { changed: [file], added: [file], removed: [file], settings: bool }. */
export function changesOf(pkg) {
  const origin = pkg.origin;
  if (!origin) return null;
  const changed = [];
  const added = [];
  const removed = [];
  for (const [file, value] of Object.entries(pkg.texts)) {
    if (!(file in origin.texts)) added.push(file);
    else if (origin.texts[file] !== value) changed.push(file);
  }
  for (const file of Object.keys(origin.texts)) if (!(file in pkg.texts)) removed.push(file);
  const settings = origin.kind === 'yaml' ? settingsSnapshot(pkg.site) !== origin.settings : writeSiteYaml(pkg.site) !== origin.siteYaml;
  return { changed, added, removed, settings, images: Object.keys(pkg.images) };
}

/** A zip of the changed files at their repository paths, with a CHANGES.md. */
export async function exportChanges(pkg) {
  const origin = pkg.origin;
  const diff = changesOf(pkg);
  if (!diff) throw new Error('This site was not opened from the library.');
  const zip = new window.JSZip();
  const lines = [`# Changes to ${pkg.site.title} (${pkg.site.address})`, ''];
  lines.push(`Opened from ${origin.kind === 'yaml' ? `${PROTOTYPES}${origin.source}` : origin.repoDir + 'site.yml'} on ${new Date().toISOString().slice(0, 10)}.`);
  lines.push('Unzip at the repository root: every file sits at its own path.', '');
  const list = (title, files) => {
    if (!files.length) return;
    lines.push(`## ${title}`, '');
    for (const f of files) lines.push(`- \`${origin.repoDir}${f}\``);
    lines.push('');
  };
  for (const f of [...diff.changed, ...diff.added]) zip.file(origin.repoDir + f, pkg.texts[f].replace(/\r\n?/g, '\n'));
  list('Changed pages', diff.changed);
  list('New pages', diff.added);
  list('Removed pages (delete these by hand)', diff.removed);
  if (origin.kind === 'package') {
    for (const [name, bytes] of Object.entries(pkg.images)) zip.file(origin.repoDir + name, bytes);
    if (diff.settings) zip.file(origin.repoDir + 'site.yml', writeSiteYaml(pkg.site));
    if (diff.settings) lines.push('## Site settings', '', `- \`${origin.repoDir}site.yml\` rewritten.`, '');
  } else if (diff.settings || diff.added.length || diff.removed.length) {
    // The prototype file holds many sites, so its edit is described rather than rewritten.
    lines.push(`## Site settings (edit \`${PROTOTYPES}${origin.source}\`, entry \`${origin.id}\`)`, '');
    const before = JSON.parse(origin.settings);
    const after = JSON.parse(settingsSnapshot(pkg.site));
    for (const key of Object.keys({ ...before, ...after })) {
      if (JSON.stringify(before[key]) === JSON.stringify(after[key])) continue;
      lines.push(`- **${key}**: \`${JSON.stringify(before[key])}\` → \`${JSON.stringify(after[key])}\``);
    }
    lines.push('', 'Titles, tab names and board labels are locale ids in the YAML: change their text in',
      '`Content.CMU/Resources/Locale/en-US/CMU14/personal-computers.ftl`.', '');
    lines.push('The new site entry, for reference (titles shown as text):', '', '```yaml', writeSiteYaml({ ...pkg.site, root: origin.root }).split(NL).filter(l => !l.startsWith('#')).join(NL).trimEnd(), '```', '');
  }
  if (!diff.changed.length && !diff.added.length && !diff.removed.length && !diff.settings) lines.push('No changes.', '');
  zip.file('CHANGES.md', lines.join('\n'));
  return { blob: await zip.generateAsync({ type: 'blob' }), diff };
}

// ---------------------------------------------------------------- curation

const CURATION_KEY = 'extranet-editor-curation';
export const STATUSES = [
  { id: '', label: 'Not reviewed' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'work', label: 'Needs work' },
  { id: 'hidden', label: 'Hidden' },
];

export function curation() {
  try {
    return JSON.parse(localStorage.getItem(CURATION_KEY) || '{}');
  } catch {
    return {};
  }
}

export function setCuration(key, value) {
  const all = curation();
  if (!value.status && !value.note) delete all[key];
  else all[key] = { ...value, at: new Date().toISOString() };
  try {
    localStorage.setItem(CURATION_KEY, JSON.stringify(all));
  } catch {
    // kept for this visit only
  }
}
