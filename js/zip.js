// Zip export and import (JSZip from cdnjs), and loading a package folder picked from disk.

import { packageFiles, packageFromFiles } from './package.js';

function jszip() {
  if (!window.JSZip) throw new Error('JSZip did not load (it comes from cdnjs.cloudflare.com); check the connection and reload.');
  return window.JSZip;
}

const encoder = new TextEncoder();

/** The package as a zip with one top folder named after the package. */
export async function exportZip(pkg) {
  const JSZip = jszip();
  const zip = new JSZip();
  const folder = zip.folder(pkg.folder);
  const files = packageFiles(pkg);
  // Fixed dates keep repeated exports of the same package byte for byte identical.
  const date = new Date(Date.UTC(2026, 0, 1));
  for (const path of Object.keys(files).sort()) {
    const data = files[path];
    folder.file(path, typeof data === 'string' ? encoder.encode(data) : data, { binary: true, date });
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 }, mimeType: 'application/zip' });
}

/**
 * Finds the package inside a set of { path: bytes } files: the shallowest folder with a site.yml.
 * Returns { folder, files } with paths relative to that folder.
 */
export function locatePackage(all, fallbackName) {
  const manifests = Object.keys(all).filter(p => p === 'site.yml' || p.endsWith('/site.yml'));
  if (!manifests.length) throw new Error('No site.yml found. Pick the package folder itself (the one holding site.yml), or a zip of it.');
  manifests.sort((a, b) => a.split('/').length - b.split('/').length);
  const manifest = manifests[0];
  const prefix = manifest.slice(0, -'site.yml'.length);
  const files = {};
  for (const [path, bytes] of Object.entries(all)) {
    if (path.startsWith(prefix) && !path.endsWith('/')) files[path.slice(prefix.length)] = bytes;
  }
  const parts = prefix.split('/').filter(Boolean);
  const folder = parts.length ? parts[parts.length - 1] : fallbackName;
  return { folder, files, extraManifests: manifests.length - 1 };
}

const IGNORED = /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini|__MACOSX\/.*)$/i;

export async function importZip(file) {
  const JSZip = jszip();
  const zip = await JSZip.loadAsync(file);
  const all = {};
  const entries = [];
  zip.forEach((path, entry) => {
    if (!entry.dir && !IGNORED.test(path) && !path.startsWith('__MACOSX/')) entries.push([path, entry]);
  });
  for (const [path, entry] of entries) all[path.replace(/\\/g, '/')] = await entry.async('uint8array');
  const located = locatePackage(all, file.name.replace(/\.zip$/i, '') || 'Package');
  const result = packageFromFiles(located.folder, located.files);
  if (located.extraManifests) result.warnings.push('The zip holds more than one site.yml; the outermost package was opened.');
  return result;
}

/** Files from an <input webkitdirectory> pick. */
export async function importFolderFiles(fileList) {
  const all = {};
  let root = 'Package';
  for (const file of fileList) {
    const path = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
    if (IGNORED.test(path)) continue;
    all[path] = new Uint8Array(await file.arrayBuffer());
    root = path.split('/')[0] || root;
  }
  const located = locatePackage(all, root);
  return packageFromFiles(located.folder, located.files);
}

/** Files from the File System Access API directory picker. */
export async function importDirectoryHandle(handle) {
  const all = {};
  async function walk(dir, prefix) {
    for await (const [name, entry] of dir.entries()) {
      const path = prefix + name;
      if (IGNORED.test(path)) continue;
      if (entry.kind === 'directory') await walk(entry, path + '/');
      else all[path] = new Uint8Array(await (await entry.getFile()).arrayBuffer());
    }
  }
  await walk(handle, `${handle.name}/`);
  const located = locatePackage(all, handle.name);
  return packageFromFiles(located.folder, located.files);
}
