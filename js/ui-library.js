// The Library panel: every site in the game, grouped and searchable, with curation marks and exports.

import { el, debounce } from './util.js';
import { icon } from './icons.js';
import { loadIndex, GROUPS, thumbnail, curation, setCuration, STATUSES, changesOf } from './library.js';
import { getRepoBase, GITHUB_REPO, BUNDLED, localCheckoutBase, repoLabel, snapshotInfo } from './repo.js';

const NETWORK_NAMES = {
  CMUNetPublic: 'Public', CMUNetSeegson: 'Seegson', CMUNetWeylandYutani: 'W-Y', CMUNetUSCM: 'USCM', CMUNetCMB: 'CMB', CMUNetDeep: 'Deep',
};

const state = { query: '', filter: 'all', folded: new Set() };

/**
 * ctx = { app, open(entry), exportPackage(), exportChanges(), setRepo(url) }
 */
export function renderLibrary(host, ctx) {
  host.replaceChildren();
  host.append(sourceCard(ctx));
  const current = currentCard(ctx);
  if (current) host.append(current);

  const search = el('input.input.lib-search', { type: 'search', placeholder: 'Search sites', title: 'Search by title, address or id', value: state.query });
  const filter = el('select.input.lib-filter', {},
    el('option', { value: 'all', text: 'All marks' }),
    ...STATUSES.map(s => el('option', { value: s.id || 'none', text: s.label })));
  filter.value = state.filter;
  const list = el('div.lib-list', {}, el('p.note', { text: 'Reading the site list…' }));
  host.append(el('div.lib-tools', {}, el('span.lib-search-wrap', {}, icon('search'), search), filter), list);

  let entries = null;
  const draw = () => drawList(list, entries, ctx);
  search.addEventListener('input', debounce(() => {
    state.query = search.value;
    draw();
  }, 120));
  filter.addEventListener('change', () => {
    state.filter = filter.value;
    draw();
  });

  loadIndex().then(all => {
    entries = all;
    draw();
  }).catch(e => {
    list.replaceChildren(el('div.issue.error', {}, el('b', { text: 'Could not read the site list. ' }), e.message));
  });
}

function sourceCard(ctx) {
  const base = getRepoBase();
  const local = localCheckoutBase();
  const label = el('span.lib-source-label', { text: `Source: ${repoLabel()}`, title: base });
  if (base === BUNDLED) {
    snapshotInfo().then(info => {
      if (info.generated) label.textContent = `Snapshot of ${info.generated.slice(0, 10)}${info.commit ? ` (${info.commit})` : ''}`;
    });
  }
  const buttons = el('div.segmented.lib-source');
  const add = (text, url, on, tip) => buttons.append(el('button', { type: 'button', text, className: on ? 'on' : '', dataset: { tip }, onclick: () => ctx.setRepo(url) }));
  add('Snapshot', BUNDLED, base === BUNDLED, 'The game\'s pages bundled with the editor (game/, made by tools/snapshot.py)');
  add('GitHub', GITHUB_REPO, base === GITHUB_REPO, 'The Personal-Computers branch on GitHub');
  if (local) add('This checkout', local, base === local, 'The repository this editor is served from');
  const refresh = el('button.btn.btn-small.btn-icon', { type: 'button', dataset: { tip: 'Read the site list again' }, onclick: () => {
    loadIndex({ refresh: true }).finally(() => ctx.rerender());
  } }, icon('refresh'));
  return el('div.card.lib-card', {},
    el('div.lib-row', {}, label, refresh),
    buttons);
}

function currentCard(ctx) {
  const pkg = ctx.app.pkg;
  if (!pkg.origin) return null;
  const marks = curation();
  const mark = marks[pkg.origin.key] || { status: '', note: '' };
  const status = el('div.segmented.lib-status');
  for (const s of STATUSES) {
    status.append(el('button', { type: 'button', text: s.label, className: (mark.status || '') === s.id ? 'on' : '', onclick: () => {
      setCuration(pkg.origin.key, { ...mark, status: s.id });
      ctx.rerender();
    } }));
  }
  const note = el('textarea.input.lib-note', { rows: 3, placeholder: 'Notes for this site (kept in this browser)', value: mark.note || '' });
  note.addEventListener('input', debounce(() => setCuration(pkg.origin.key, { ...curation()[pkg.origin.key], status: mark.status, note: note.value }), 300));
  const diff = changesOf(pkg);
  const count = diff.changed.length + diff.added.length + diff.removed.length + (diff.settings ? 1 : 0);
  const summary = count ? `${diff.changed.length} changed, ${diff.added.length} new, ${diff.removed.length} removed page${diff.removed.length === 1 ? '' : 's'}${diff.settings ? ', site settings changed' : ''}` : 'No changes yet';
  return el('div.card.lib-card.lib-current', {},
    el('div.section-title', {}, el('span', { text: 'Curating' })),
    el('div.lib-current-title', { text: pkg.site.title }),
    el('div.lib-current-sub', { text: `${pkg.site.address}  ·  ${pkg.origin.kind === 'yaml' ? pkg.origin.source : 'package'}` }),
    status,
    note,
    el('div.lib-changes', { text: summary }),
    el('div.lib-row', {},
      el('button.btn.btn-small', { type: 'button', dataset: { tip: 'Every file of the site as a site package zip' }, onclick: () => ctx.exportPackage() }, icon('download'), ' Package zip'),
      el('button.btn.btn-small.btn-primary', { type: 'button', disabled: !count, dataset: { tip: 'Only the changed files, at their repository paths, with CHANGES.md' }, onclick: () => ctx.exportChanges() }, icon('download'), ' Export changes')));
}

function matches(entry, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return entry.title.toLowerCase().includes(q) || entry.address.includes(q) || entry.id.toLowerCase().includes(q);
}

function drawList(list, entries, ctx) {
  if (!entries) return;
  const marks = curation();
  list.replaceChildren();
  const openKey = ctx.app.pkg.origin && ctx.app.pkg.origin.key;
  let shown = 0;
  for (const group of GROUPS) {
    const items = entries.filter(e => e.group === group && matches(e, state.query)).filter(e => {
      const status = (marks[e.key] && marks[e.key].status) || '';
      if (state.filter === 'all') return status !== 'hidden';
      return status === (state.filter === 'none' ? '' : state.filter);
    });
    if (!items.length) continue;
    shown += items.length;
    const folded = state.folded.has(group) && !state.query;
    const head = el('button.lib-group-head', { type: 'button', onclick: () => {
      if (state.folded.has(group)) state.folded.delete(group);
      else state.folded.add(group);
      drawList(list, entries, ctx);
    } }, el('span', { text: `${folded ? '▸' : '▾'} ${group}` }), el('span.lib-count', { text: String(items.length) }));
    list.append(head);
    if (folded) continue;
    for (const entry of items) list.append(row(entry, marks[entry.key], entry.key === openKey, ctx));
  }
  if (!shown) list.append(el('p.note', { text: 'No site matches.' }));
}

function row(entry, mark, open, ctx) {
  const thumb = el('div.lib-thumb');
  thumbnail(entry).then(url => {
    if (url) thumb.append(el('img', { src: url, alt: '' }));
    else thumb.classList.add('empty');
  });
  const status = (mark && mark.status) || '';
  const chips = el('div.lib-chips', {}, ...entry.networks.map(n => el('span.lib-chip', { text: NETWORK_NAMES[n] || n })),
    el('span.lib-chip.pages', { text: `${entry.pageCount} page${entry.pageCount === 1 ? '' : 's'}` }),
    entry.unlisted ? el('span.lib-chip.dim', { text: 'unlisted' }) : null,
    entry.hidden ? el('span.lib-chip.dim', { text: 'hidden' }) : null);
  const item = el('button.lib-item', { type: 'button', dataset: { tip: `${entry.id}${mark && mark.note ? `\n${mark.note}` : ''}` }, onclick: () => ctx.open(entry) },
    thumb,
    el('div.lib-body', {},
      el('div.lib-title', {}, status ? el('span.lib-mark', { dataset: { status }, title: STATUSES.find(s => s.id === status).label }) : null, el('span', { text: entry.title })),
      el('div.lib-address', { text: entry.address }),
      chips));
  item.classList.toggle('on', open);
  return item;
}
