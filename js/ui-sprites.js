// The game sprite picker (RSIs from the repository) and the ad and wallpaper pickers.

import { el } from './util.js';
import { modal, field, textInput, select, button, buttonRow, toast } from './ui-dialog.js';
import { loadRsi, spriteCanvas, frameCount, rootedRsi } from './sprites.js';
import { listResourceFolder, deepAds, wallpapers, locale, getRepoBase, bundled } from './repo.js';

const RECENT_KEY = 'extranet-editor-recent-rsi';

function recent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function remember(path) {
  try {
    const list = [path, ...recent().filter(p => p !== path)].slice(0, 12);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // storage blocked: nothing to remember
  }
}

const SUGGESTED = [
  '/Textures/_RMC14/Objects/Fun/plushies.rsi',
  '/Textures/_RMC14/Structures/Machines/computer.rsi',
  '/Textures/_RMC14/Objects/Misc/Bouqets/rose.rsi',
  '/Textures/CMU14/PersonalComputers/Sites/Ads/badges.rsi',
];

/** Opens the picker. Resolves to { rsi, state, scale, align } or null. */
export function pickSprite(initial = {}) {
  return modal('Game sprite', (body, close) => {
    let rsi = null;
    let chosen = initial.state || null;
    const path = textInput(initial.rsi || recent()[0] || SUGGESTED[0], { placeholder: '/Textures/....rsi' });
    const load = button('Load', () => open(path.value), '.btn-primary');
    const browseToggle = button('Browse the repo', () => {
      browser.style.display = browser.style.display === 'none' ? '' : 'none';
      if (browser.style.display === '' && !browser.dataset.loaded) browse(folderOf(path.value) || '/Textures');
    });
    const info = el('div.picker-info');
    const states = el('div.state-grid');
    const filter = textInput('', { placeholder: 'Filter states' });
    filter.addEventListener('input', () => {
      const q = filter.value.toLowerCase();
      for (const cell of states.children) cell.style.display = cell.dataset.name.toLowerCase().includes(q) ? '' : 'none';
    });
    const scale = textInput(initial.scale || '2', { inputmode: 'decimal', className: 'input input-narrow' });
    const align = select(['Center', 'Left', 'Right'], initial.align || 'Center');
    const insert = button('Insert sprite', () => {
      if (!rsi || !chosen) {
        toast('Pick a state first.', 'error');
        return;
      }
      remember(rsi.path);
      close({ rsi: rsi.path, state: chosen, scale: scale.value.trim() || '2', align: align.value });
    }, '.btn-primary');
    const browser = el('div.rsi-browser', { style: { display: 'none' } });
    const recents = el('div.chips', {}, [...new Set([...recent(), ...SUGGESTED])].slice(0, 10).map(p => el('button.chip', { type: 'button', text: p.replace('/Textures/', ''), title: p, onclick: () => {
      path.value = p;
      open(p);
    } })));

    path.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        open(path.value);
      }
    });

    body.append(
      el('p.note', {}, 'Sprites load from ', el('code', { text: getRepoBase() }), '. Paths starting /Textures/ are looked up in Content.CMU/Resources/Textures first, then Resources/Textures.'),
      el('div.row-edit', {}, path, load, browseToggle),
      recents,
      browser,
      info,
      filter,
      states,
      el('div.row-edit', {}, field('Scale', scale), field('Align', align), insert, button('Cancel', () => close(null))));

    async function browse(folder) {
      browser.dataset.loaded = '1';
      browser.replaceChildren(el('div.muted', { text: `Listing ${folder}...` }));
      try {
        const items = await listResourceFolder(folder);
        const crumbs = el('div.crumbs');
        const parts = folder.split('/').filter(Boolean);
        parts.forEach((part, i) => {
          const target = '/' + parts.slice(0, i + 1).join('/');
          crumbs.append(el('button.crumb', { type: 'button', text: part, onclick: () => browse(target) }), i < parts.length - 1 ? ' / ' : '');
        });
        const list = el('div.browse-list');
        for (const item of items) {
          if (!item.dir) continue;
          const target = `${folder}/${item.name}`;
          const isRsi = item.name.endsWith('.rsi');
          list.append(el(`button.browse-item${isRsi ? '.is-rsi' : ''}`, { type: 'button', text: isRsi ? item.name : `${item.name}/`, onclick: () => {
            if (isRsi) {
              path.value = target;
              open(target);
            } else {
              browse(target);
            }
          } }));
        }
        if (!list.children.length) list.append(el('div.muted', { text: 'No folders here.' }));
        browser.replaceChildren(crumbs, list);
      } catch (e) {
        browser.replaceChildren(el('div.attr-missing', { text: `Could not list ${folder}: ${e.message}` }));
      }
    }

    async function open(value) {
      const p = rootedRsi(value);
      path.value = p;
      info.replaceChildren(el('span.muted', { text: 'Loading meta.json...' }));
      states.replaceChildren();
      try {
        rsi = await loadRsi(p);
      } catch (e) {
        rsi = null;
        info.replaceChildren(el('span.attr-missing', { text: `No RSI at ${p}: ${e.message}` }));
        return;
      }
      info.replaceChildren(
        el('div', {}, el('strong', { text: p }), ` ${rsi.size.x}x${rsi.size.y}, ${rsi.states.size} states`),
        rsi.license ? el('div.muted', { text: `${rsi.license}: ${rsi.copyright || ''}` }) : null);
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const cell = entry.target;
          observer.unobserve(cell);
          const s = Math.max(1, Math.min(2, Math.floor(64 / Math.max(rsi.size.x, rsi.size.y)) || 1));
          spriteCanvas(p, cell.dataset.name, s).then(canvas => cell.querySelector('.state-art').replaceChildren(canvas)).catch(() => {
            cell.querySelector('.state-art').textContent = 'missing png';
          });
        }
      }, { root: states });
      for (const state of rsi.states.values()) {
        const frames = frameCount(rsi, state.name);
        const cell = el(`button.state-cell${state.name === chosen ? '.chosen' : ''}`, { type: 'button', dataset: { name: state.name }, onclick: () => {
          chosen = state.name;
          for (const c of states.children) c.classList.toggle('chosen', c === cell);
        } },
          el('div.state-art', { text: '...' }),
          el('div.state-name', { text: state.name }),
          el('div.state-meta', { text: `${frames > 1 ? `${frames} frames` : 'still'}${state.directions > 1 ? `, ${state.directions} dirs` : ''}` }));
        states.append(cell);
        observer.observe(cell);
      }
      if (chosen && !rsi.states.has(chosen)) chosen = null;
    }

    open(path.value);
  }, { wide: true });
}

function folderOf(path) {
  const p = rootedRsi(path || '');
  const i = p.lastIndexOf('/');
  return i > 0 ? p.slice(0, i) : null;
}

/** Picks a cmuDeepAd id from the repository's deep_ads.yml. */
export function pickAd() {
  return modal('Product ad', (body, close) => {
    const list = el('div.ad-list', {}, el('div.muted', { text: 'Loading deep_ads.yml...' }));
    const flip = el('input', { type: 'checkbox' });
    body.append(el('p.note', { text: 'Ads draw the item from its own sprite, in the ad\'s colours (deep_ads.yml). Pick one:' }), list,
      el('label.check', {}, flip, 'Flip: product on the right'),
      buttonRow(button('Cancel', () => close(null))));
    Promise.all([deepAds(), locale().catch(() => ({})), bundled('ad_sprites.json').catch(() => ({}))]).then(([ads, strings, sprites]) => {
      list.replaceChildren();
      for (const ad of ads.values()) {
        const art = el('span.ad-art');
        const layers = ad.entity && sprites[ad.entity];
        if (layers) spriteCanvas(layers[0].rsi, layers[0].state, 1).then(c => art.append(c)).catch(() => {});
        list.append(el('button.ad-item', { type: 'button', onclick: () => close({ id: ad.id, flip: flip.checked }) },
          art, el('span', {}, el('strong', { text: strings[ad.product] || ad.product || ad.id }), el('br'), el('span.muted', { text: ad.id }))));
      }
    }).catch(e => {
      list.replaceChildren(el('div.attr-missing', { text: `Could not load the ads (${e.message}). Type the id by hand: <CMUNetAd Id="CMUDeepAdMre"/>` }));
    });
  }, { wide: true });
}

/** Picks a cmuWallpaper id. */
export function pickWallpaper() {
  return modal('Wallpaper', (body, close) => {
    const list = el('div.ad-list', {}, el('div.muted', { text: 'Loading wallpapers.yml...' }));
    body.append(el('p.note', { text: 'A wallpaper players can put on their desktop. New ones are added to wallpapers.yml (960x600 PNG), which is outside a site package.' }), list, buttonRow(button('Cancel', () => close(null))));
    Promise.all([wallpapers(), locale().catch(() => ({}))]).then(([all, strings]) => {
      list.replaceChildren();
      for (const w of all.values()) {
        list.append(el('button.ad-item', { type: 'button', onclick: () => close(w.id) },
          el('span', {}, el('strong', { text: strings[w.name] || w.name }), el('br'), el('span.muted', { text: w.id }))));
      }
    }).catch(e => {
      list.replaceChildren(el('div.attr-missing', { text: `Could not load wallpapers (${e.message}).` }));
    });
  });
}
