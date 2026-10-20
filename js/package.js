// The site package being edited: site settings, page texts, images and attributions, plus autosave.

import { readSiteYaml, writeSiteYaml, readAttributions, writeAttributions } from './yaml.js';

/**
 * pkg = {
 *   folder,                      // the zip's top folder, e.g. LostAndFound
 *   site,                        // see yaml.js readSiteYaml
 *   texts: { 'index.xml': '...' }, // every text file by path in the package (pages, colony versions)
 *   images: { 'banner.png': Uint8Array },
 *   attributions: [{ files, license, copyright, source }],
 *   other: { 'path': Uint8Array }, // anything else found in a loaded package, written back unchanged
 * }
 */

export function emptySite() {
  return {
    id: 'CMUNetSitePackageMySite',
    address: 'mysite.colony',
    title: 'My Site',
    networks: ['CMUNetPublic'],
    unlisted: false,
    hidden: false,
    aliasSuffix: '',
    root: '',
    style: { background: '#0B1630', text: '#D8E6FF', heading: '#FFD24A', link: '#7FD3FF', font: 'Sans' },
    pages: [{ path: '', file: 'index.xml' }],
    tabs: [],
    board: null,
    extra: null,
    header: null,
  };
}

export function newPage(title = 'NEW PAGE', style) {
  const styleLine = style ? `  ${style}\n` : '';
  return `<Document>\n${styleLine}  # ${title}\n  Write the page here. A blank line starts a new paragraph.\n</Document>\n`;
}

export function emptyPackage() {
  return {
    folder: 'MySite',
    site: emptySite(),
    texts: { 'index.xml': newPage('MY SITE') },
    images: {},
    attributions: [],
    other: {},
  };
}

/** A PascalCase folder name from a title, for new packages. */
export function folderFromTitle(title) {
  const words = title.replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  const name = words.map(w => w[0].toUpperCase() + w.slice(1)).join('');
  return name || 'MySite';
}

export function siteYaml(pkg) {
  return writeSiteYaml(pkg.site);
}

export function attributionsYaml(pkg) {
  return writeAttributions(pkg.attributions);
}

export function attributionFor(pkg, file) {
  return pkg.attributions.find(entry => entry.files.includes(file)) || null;
}

/** Sets one image's licence, grouping images that share the same licence, author and source into one entry. */
export function setAttribution(pkg, file, { license, copyright, source }) {
  for (const entry of pkg.attributions) entry.files = entry.files.filter(f => f !== file);
  let entry = pkg.attributions.find(e => e.license === license && e.copyright === copyright && e.source === source);
  if (!entry) {
    entry = { files: [], license, copyright, source };
    pkg.attributions.push(entry);
  }
  entry.files.push(file);
  pkg.attributions = pkg.attributions.filter(e => e.files.length);
}

export function renameInAttributions(pkg, from, to) {
  for (const entry of pkg.attributions) entry.files = entry.files.map(f => (f === from ? to : f));
}

export function removeFromAttributions(pkg, file) {
  for (const entry of pkg.attributions) entry.files = entry.files.filter(f => f !== file);
  pkg.attributions = pkg.attributions.filter(e => e.files.length);
}

const TEXT_EXTENSIONS = /\.(xml|yml|yaml|txt|md|json|ftl)$/i;
const IMAGE_EXTENSIONS = /\.png$/i;

/**
 * Builds a package from files { relativePath: Uint8Array } (paths relative to the package folder).
 * Returns { pkg, warnings }. Throws when there is no usable site.yml.
 */
export function packageFromFiles(folder, files) {
  const decoder = new TextDecoder('utf-8');
  const warnings = [];
  if (!files['site.yml']) throw new Error('No site.yml in this folder. A site package has a site.yml next to its pages.');
  let siteText = decoder.decode(files['site.yml']);
  if (siteText.charCodeAt(0) === 0xfeff) {
    siteText = siteText.slice(1);
    warnings.push('site.yml started with a byte order mark; it is written without one.');
  }
  const { site, warnings: siteWarnings } = readSiteYaml(siteText);
  warnings.push(...siteWarnings);

  const pkg = { folder, site, texts: {}, images: {}, attributions: [], other: {} };
  for (const [path, bytes] of Object.entries(files)) {
    if (path === 'site.yml') continue;
    if (path === 'attributions.yml') {
      try {
        pkg.attributions = readAttributions(decoder.decode(bytes));
      } catch (e) {
        warnings.push(`attributions.yml could not be read (${e.message}); it is kept as is.`);
        pkg.other[path] = bytes;
      }
      continue;
    }
    if (IMAGE_EXTENSIONS.test(path) && !path.includes('/')) {
      pkg.images[path] = bytes;
      continue;
    }
    if (TEXT_EXTENSIONS.test(path) && /\.xml$/i.test(path)) {
      let text = decoder.decode(bytes);
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      if (text.includes('\r')) {
        warnings.push(`${path} had Windows line endings; it is saved with LF.`);
        text = text.replace(/\r\n?/g, '\n');
      }
      pkg.texts[path] = text;
      continue;
    }
    pkg.other[path] = bytes;
  }
  for (const page of site.pages) {
    if (!(page.file in pkg.texts)) warnings.push(`Page "${page.path}" points to ${page.file}, which is not in the package.`);
  }
  return { pkg, warnings };
}

/** Every file of the package as { path: string | Uint8Array }, ready to zip. */
export function packageFiles(pkg) {
  const out = { 'site.yml': siteYaml(pkg) };
  for (const [path, text] of Object.entries(pkg.texts)) out[path] = text.replace(/\r\n?/g, '\n');
  for (const [path, bytes] of Object.entries(pkg.images)) out[path] = bytes;
  const attributions = attributionsYaml(pkg);
  if (attributions) out['attributions.yml'] = attributions;
  for (const [path, bytes] of Object.entries(pkg.other)) if (!(path in out)) out[path] = bytes;
  return out;
}

/** The page entry for an address path, as CMUExtraNetSystem.TryGetPageFile matches it. */
export function pageForPath(site, path) {
  const want = path.trim().replace(/^\/+|\/+$/g, '').toLowerCase();
  return site.pages.find(p => p.path.trim().replace(/^\/+|\/+$/g, '').toLowerCase() === want) || null;
}

// ---------------------------------------------------------------- autosave

const DB_NAME = 'extranet-editor';
const STORE = 'packages';

function openDb() {
  return new Promise((resolve, reject) => {
    let request;
    try {
      request = indexedDB.open(DB_NAME, 1);
    } catch (e) {
      reject(e);
      return;
    }
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function serialise(pkg) {
  return JSON.parse(JSON.stringify({ ...pkg, images: {}, other: {} }));
}

export async function saveWorking(pkg) {
  const record = { savedAt: Date.now(), pkg: { ...serialise(pkg), images: pkg.images, other: pkg.other } };
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record, 'working');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return 'indexeddb';
  } catch {
    // Without IndexedDB, keep at least the text in localStorage; images are lost on reload.
    try {
      localStorage.setItem('extranet-editor-working', JSON.stringify({ savedAt: record.savedAt, pkg: serialise(pkg) }));
      return 'localstorage';
    } catch {
      return null;
    }
  }
}

export async function loadWorking() {
  try {
    const db = await openDb();
    const record = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get('working');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (record && record.pkg) return record;
  } catch {
    // fall through to localStorage
  }
  try {
    const raw = localStorage.getItem('extranet-editor-working');
    if (raw) return JSON.parse(raw);
  } catch {
    // nothing saved
  }
  return null;
}

/** Fills in fields an older autosave may lack. */
export function normalisePackage(pkg) {
  const base = emptyPackage();
  const out = { ...base, ...pkg };
  out.site = { ...emptySite(), ...pkg.site };
  out.site.style = { ...(pkg.site && pkg.site.style) };
  out.texts = pkg.texts || {};
  out.images = pkg.images || {};
  out.other = pkg.other || {};
  out.attributions = pkg.attributions || [];
  return out;
}
