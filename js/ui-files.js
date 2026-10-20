// Pages and images of the package: add, rename and delete pages; upload, license and insert images.

import { el } from './util.js';
import { formDialog, button, modal, field, textInput, select, buttonRow, toast, confirmDialog } from './ui-dialog.js';
import { newPage, attributionFor, setAttribution, renameInAttributions, removeFromAttributions } from './package.js';
import { normalizePath } from './markup.js';

export const LICENSES = ['CC-BY-SA-3.0', 'CC-BY-SA-4.0', 'CC-BY-3.0', 'CC-BY-4.0', 'CC0-1.0', 'MIT'];

function styleLine(site) {
  const s = site.style || {};
  const parts = [];
  if (s.background) parts.push(`Background="${s.background}"`);
  if (s.text) parts.push(`Text="${s.text}"`);
  if (s.heading) parts.push(`Heading="${s.heading}"`);
  if (s.link) parts.push(`Link="${s.link}"`);
  if (s.font) parts.push(`Font="${s.font}"`);
  return parts.length ? `<CMUNetStyle ${parts.join(' ')}/>` : '';
}

export function pageStyleLine(site) {
  return styleLine(site) || '<CMUNetStyle Background="#0B1630" Text="#D8E6FF" Heading="#FFD24A" Link="#7FD3FF" Font="Sans"/>';
}

function fileNameFor(path, texts) {
  const base = (path || 'index').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'page';
  let name = `${base}.xml`;
  for (let i = 2; name in texts; i++) name = `${base}_${i}.xml`;
  return name;
}

export function renderPages(host, app) {
  host.replaceChildren();
  const site = app.pkg.site;
  const list = el('div.file-list');
  for (const page of site.pages) {
    const active = app.currentFile === page.file;
    const missing = !(page.file in app.pkg.texts);
    const row = el(`div.file-row${active ? '.active' : ''}`, { onclick: () => app.openFile(page.file) },
      el('span.file-path', { text: page.path === '' ? '(index)' : page.path, title: 'Address path' }),
      el('span.file-name', { text: page.file + (missing ? ' (missing)' : ''), title: 'File in the package' }),
      el('span.file-actions', {},
        button('Rename', e => {
          e.stopPropagation();
          renamePage(app, page);
        }, '.btn-small'),
        page.path === '' ? null : button('X', async e => {
          e.stopPropagation();
          if (!(await confirmDialog('Delete page', `Delete the page "${page.path}" and its file ${page.file}?`, 'Delete'))) return;
          site.pages = site.pages.filter(p => p !== page);
          if (!site.pages.some(p => p.file === page.file)) delete app.pkg.texts[page.file];
          site.tabs = site.tabs.filter(t => normalizePath(t.path || '') !== normalizePath(page.path));
          if (app.currentFile === page.file) app.openFile(site.pages[0] ? site.pages[0].file : null);
          app.changed('pages');
        }, '.btn-small.btn-danger')));
    if (missing) row.classList.add('missing');
    list.append(row);
  }
  host.append(list, buttonRow(button('+ Add page', () => addPage(app), '.btn-primary')));

  const variants = Object.keys(app.pkg.texts).filter(f => !site.pages.some(p => p.file === f));
  if (variants.length) {
    const vlist = el('div.file-list');
    for (const file of variants) {
      vlist.append(el(`div.file-row${app.currentFile === file ? '.active' : ''}`, { onclick: () => app.openFile(file) },
        el('span.file-path', { text: file.includes('/') ? file.split('/')[0] : 'not listed' }),
        el('span.file-name', { text: file }),
        el('span.file-actions', {}, button('X', async e => {
          e.stopPropagation();
          if (!(await confirmDialog('Delete file', `Delete ${file}?`, 'Delete'))) return;
          delete app.pkg.texts[file];
          if (app.currentFile === file) app.openFile(site.pages[0] ? site.pages[0].file : null);
          app.changed('pages');
        }, '.btn-small.btn-danger'))));
    }
    host.append(el('h3.section-title', { text: 'Other files' }),
      el('p.note', { text: 'Files in a folder named after a map id or colony are that colony\'s own version of a page (e.g. StableGarrison/index.xml). The preview uses them when the map folder below the preview matches.' }),
      vlist);
  }
  host.append(buttonRow(button('+ Colony version of this page', () => addVariant(app), '.btn-small')));
}

async function addPage(app) {
  const site = app.pkg.site;
  const result = await formDialog('Add page', [
    { key: 'path', label: 'Address path', value: '', hint: `Reached as ${site.address}/<path>. Lowercase, may hold / (e.g. jobs/miner).` },
    { key: 'title', label: 'Heading', value: 'NEW PAGE' },
    { key: 'tab', label: 'Add a tab for it', type: 'checkbox', value: site.tabs.length > 0 },
  ], 'Add');
  if (!result) return;
  const path = normalizePath(result.path);
  if (site.pages.some(p => normalizePath(p.path) === path)) {
    toast(`There is already a page "${path || '(index)'}".`, 'error');
    return;
  }
  if (/\s/.test(path)) {
    toast('Page paths cannot hold spaces.', 'error');
    return;
  }
  const file = fileNameFor(path, app.pkg.texts);
  site.pages.push({ path, file });
  app.pkg.texts[file] = newPage(result.title || 'NEW PAGE', styleLine(site) || null);
  if (result.tab) site.tabs.push({ title: result.title ? titleCase(result.title) : path, path });
  app.changed('pages');
  app.openFile(file);
}

function titleCase(text) {
  return text.toLowerCase().replace(/(^|\s)\S/g, m => m.toUpperCase());
}

async function renamePage(app, page) {
  const site = app.pkg.site;
  const result = await formDialog('Rename page', [
    { key: 'path', label: 'Address path', value: page.path, hint: page.path === '' ? 'The index page keeps the empty path.' : 'Links and tabs to the old path are updated.' },
    { key: 'file', label: 'File name', value: page.file },
  ], 'Rename');
  if (!result) return;
  const path = page.path === '' ? '' : normalizePath(result.path);
  let file = result.file.trim();
  if (!/\.xml$/i.test(file)) file += '.xml';
  if (path !== page.path && site.pages.some(p => p !== page && normalizePath(p.path) === path)) {
    toast(`There is already a page "${path}".`, 'error');
    return;
  }
  if (file !== page.file && file in app.pkg.texts) {
    toast(`There is already a file ${file}.`, 'error');
    return;
  }
  if (file !== page.file) {
    for (const key of Object.keys(app.pkg.texts)) {
      // Colony versions follow their page.
      if (key === page.file || key.endsWith(`/${page.file}`)) {
        const renamed = key === page.file ? file : key.slice(0, -page.file.length) + file;
        app.pkg.texts[renamed] = app.pkg.texts[key];
        delete app.pkg.texts[key];
      }
    }
    if (app.currentFile === page.file) app.currentFile = file;
    page.file = file;
  }
  if (path !== page.path) {
    const old = page.path;
    page.path = path;
    for (const tab of site.tabs) if (normalizePath(tab.path || '') === normalizePath(old)) tab.path = path;
    const host = site.address.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(link="|Link=")(${host})/${old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'gi');
    let count = 0;
    for (const key of Object.keys(app.pkg.texts)) {
      app.pkg.texts[key] = app.pkg.texts[key].replace(pattern, (m, a, h) => {
        count++;
        return `${a}${h}/${path}"`;
      });
    }
    if (count) toast(`Updated ${count} link${count === 1 ? '' : 's'} to the renamed page.`);
  }
  app.changed('pages');
  app.openFile(app.currentFile);
}

async function addVariant(app) {
  const site = app.pkg.site;
  const result = await formDialog('Colony version', [
    { key: 'folder', label: 'Map id or colony folder', value: 'StableGarrison', hint: 'A game map id, or a cmuNetColony folder from colonies.yml.' },
    { key: 'page', label: 'Page', type: 'select', options: site.pages.map(p => [p.file, p.path === '' ? `(index) ${p.file}` : `${p.path} ${p.file}`]), value: app.currentFile },
  ], 'Create');
  if (!result || !result.folder.trim()) return;
  const file = `${result.folder.trim().replace(/[^A-Za-z0-9_-]/g, '')}/${result.page}`;
  if (file in app.pkg.texts) {
    app.openFile(file);
    return;
  }
  app.pkg.texts[file] = app.pkg.texts[result.page] ?? newPage('COLONY PAGE');
  app.changed('pages');
  app.openFile(file);
}

// ---------------------------------------------------------------- images

const thumbUrls = new Map();

function thumb(app, name) {
  const bytes = app.pkg.images[name];
  const key = name;
  const cached = thumbUrls.get(key);
  if (cached && cached.bytes === bytes) return cached.url;
  if (cached) URL.revokeObjectURL(cached.url);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  thumbUrls.set(key, { bytes, url });
  return url;
}

function cleanImageName(name) {
  const base = name.replace(/\.png$/i, '').toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'image';
  return `${base}.png`;
}

export function renderImages(host, app) {
  host.replaceChildren();
  host.append(el('div.callout', {},
    el('strong', { text: 'Use the game\'s own sprites first. ' }),
    'Anything that exists in game (machines, items, xenos, people) goes on the page with ',
    el('code', { text: '<CMUNetSprite>' }), ' or ', el('code', { text: '<CMUNetAd>' }),
    ': pick one with Game sprite. Only upload art for things with no sprite: banners, backgrounds, logos. ',
    'Every uploaded image needs an attributions.yml entry (licence, author, source); the editor writes it from the form below.'));

  const input = el('input', { type: 'file', accept: 'image/png', multiple: true, style: { display: 'none' } });
  input.addEventListener('change', async () => {
    for (const file of input.files) await addImage(app, file);
    input.value = '';
  });
  host.append(input, buttonRow(
    button('Make banner', () => app.openBannerStudio(), '.btn-primary'),
    button('Upload PNG', () => input.click()),
    button('Game sprite', () => app.openSpritePicker())));

  const names = Object.keys(app.pkg.images).sort();
  if (!names.length) host.append(el('p.note', { text: 'No images uploaded.' }));
  const list = el('div.image-list');
  for (const name of names) {
    const entry = attributionFor(app.pkg, name);
    const ok = entry && entry.license && entry.copyright && entry.source;
    const img = el('img.image-thumb', { src: thumb(app, name), alt: '' });
    const size = el('span.muted');
    img.onload = () => {
      size.textContent = `${img.naturalWidth}x${img.naturalHeight}`;
    };
    list.append(el('div.image-row', {},
      img,
      el('div.image-info', {},
        el('div.image-name', { text: `./${name}` }), size,
        el('div', { className: ok ? 'attr-ok' : 'attr-missing', text: ok ? `${entry.license}, ${entry.copyright}` : 'No licence yet: needs an attributions entry' })),
      el('div.image-actions', {},
        button('Insert', () => app.insertImage(name), '.btn-small'),
        `${name.replace(/\.png$/i, '')}.design.json` in app.pkg.other ? button('Edit design', () => app.openBannerStudio({ name }), '.btn-small') : null,
        button('Licence', () => editAttribution(app, name), ok ? '.btn-small' : '.btn-small.btn-warn'),
        button('Rename', () => renameImage(app, name), '.btn-small'),
        button('X', async () => {
          if (!(await confirmDialog('Delete image', `Delete ${name}? Pages that use ./${name} will show an error.`, 'Delete'))) return;
          delete app.pkg.images[name];
          removeFromAttributions(app.pkg, name);
          app.changed('images');
        }, '.btn-small.btn-danger'))));
  }
  host.append(list);

  const unlicensed = names.filter(n => !attributionFor(app.pkg, n));
  if (unlicensed.length > 1) host.append(buttonRow(button(`Licence all ${unlicensed.length} unlicensed images at once`, () => editAttribution(app, unlicensed), '.btn-small')));

  if (app.pkg.attributions.length) {
    host.append(el('h3.section-title', { text: 'attributions.yml' }), el('pre.yaml-view', { text: app.attributionsYaml() }));
  }
}

export async function addImage(app, file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!png.every((b, i) => bytes[i] === b)) {
    toast(`${file.name} is not a PNG; only PNG images work in game.`, 'error');
    return;
  }
  let name = cleanImageName(file.name);
  if (name in app.pkg.images) {
    const base = name.slice(0, -4);
    for (let i = 2; name in app.pkg.images; i++) name = `${base}_${i}.png`;
  }
  app.pkg.images[name] = bytes;
  app.changed('images');
  toast(`Added ./${name}. Give it a licence.`);
  await editAttribution(app, name);
  return name;
}

async function renameImage(app, name) {
  const result = await formDialog('Rename image', [{ key: 'name', label: 'File name', value: name, hint: 'Pages using the old ./ path are updated.' }], 'Rename');
  if (!result) return;
  const to = cleanImageName(result.name);
  if (to === name) return;
  if (to in app.pkg.images) {
    toast(`There is already an image ${to}.`, 'error');
    return;
  }
  app.pkg.images[to] = app.pkg.images[name];
  delete app.pkg.images[name];
  renameInAttributions(app.pkg, name, to);
  for (const key of Object.keys(app.pkg.texts)) app.pkg.texts[key] = app.pkg.texts[key].split(`"./${name}"`).join(`"./${to}"`);
  if (app.pkg.site.style.backgroundImage === `./${name}`) app.pkg.site.style.backgroundImage = `./${to}`;
  app.changed('images');
  app.openFile(app.currentFile);
}

/** The licence form; writes the image's attributions.yml entry. */
export function editAttribution(app, names) {
  const files = Array.isArray(names) ? names : [names];
  const current = attributionFor(app.pkg, files[0]) || app.lastAttribution || { license: 'CC-BY-SA-3.0', copyright: '', source: '' };
  return modal(`Licence: ${files.join(', ')}`, (body, close) => {
    const license = select([...LICENSES.map(l => [l, l]), ['custom', 'Other...']], LICENSES.includes(current.license) ? current.license : 'custom');
    const custom = textInput(LICENSES.includes(current.license) ? '' : current.license, { placeholder: 'SPDX licence id' });
    custom.style.display = license.value === 'custom' ? '' : 'none';
    license.addEventListener('change', () => {
      custom.style.display = license.value === 'custom' ? '' : 'none';
    });
    const copyright = el('textarea.input', { rows: 2, value: current.copyright, placeholder: 'Who made it, e.g. "Banner drawn by YourName for CMU"' });
    const source = textInput(current.source, { placeholder: 'https://github.com/Ignies/ColonialMarinesUniverse or where it came from' });
    body.append(
      el('p.note', { text: 'This is written to attributions.yml next to the image. The game\'s art is CC-BY-SA-3.0 unless it says otherwise. Only upload art you made or that its licence lets you share.' }),
      field('Licence', license), custom,
      field('Copyright', copyright, 'The author and what the image is.'),
      field('Source', source, 'A link to where it came from (your fork or the original).'),
      buttonRow(button('Save', () => {
        const value = {
          license: license.value === 'custom' ? custom.value.trim() : license.value,
          copyright: copyright.value.trim(),
          source: source.value.trim(),
        };
        if (!value.license || !value.copyright || !value.source) {
          toast('Fill in licence, copyright and source.', 'error');
          return;
        }
        for (const file of files) setAttribution(app.pkg, file, value);
        app.lastAttribution = value;
        app.changed('images');
        close(value);
      }, '.btn-primary'), button('Later', () => close(null))));
  });
}
