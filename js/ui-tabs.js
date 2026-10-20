// The editable tab strip above the canvas: one chip per page, in the site's colours like the game's strip.
// Click to open, double click to rename, drag to reorder, star to make the home page, x to delete.

import { el } from './util.js';
import { normalizePath } from './markup.js';

export function renderTabStrip(host, app) {
  host.replaceChildren();
  const site = app.pkg.site;
  const colours = app.markupColours();
  const link = colours.link;
  const background = colours.background;
  host.style.setProperty('--tab-link', link);
  host.style.setProperty('--tab-bg', background);

  // Tab order first, then pages that are not in the strip.
  const ordered = [];
  for (const tab of site.tabs) {
    const page = site.pages.find(p => normalizePath(p.path) === normalizePath(tab.path || ''));
    if (page && !ordered.some(o => o.page === page)) ordered.push({ page, tab });
  }
  for (const page of site.pages) if (!ordered.some(o => o.page === page)) ordered.push({ page, tab: null });

  let dragFrom = null;
  for (const { page, tab } of ordered) {
    const active = app.currentFile === page.file;
    const label = tab ? tab.title || '(no title)' : page.path || '(index)';
    const name = el('span.tab-name', { text: label, title: tab ? `${label}: ${page.path ? `/${page.path}` : 'home page'}` : 'Not in the tab strip; players reach it by its address or links' });
    const chip = el(`div.tab-chip${active ? '.active' : ''}${tab ? '' : '.untabbed'}`, { draggable: true, dataset: { path: page.path } },
      page.path === '' ? el('span.tab-home', { text: '⌂', title: 'Home page' }) : el('button.tab-star', { type: 'button', text: '⌂', title: 'Make this the home page', onclick: e => {
        e.stopPropagation();
        app.pageOp({ op: 'makeHome', path: page.path });
      } }),
      name,
      page.path === '' ? null : el('button.tab-x', { type: 'button', text: '✕', title: 'Delete this page', onclick: e => {
        e.stopPropagation();
        app.pageOp({ op: 'delete', path: page.path });
      } }));
    if (active) {
      chip.style.background = link;
      chip.style.color = background;
    } else {
      chip.style.background = background;
      chip.style.color = link;
    }
    chip.addEventListener('click', () => app.openFile(page.file));
    name.addEventListener('dblclick', e => {
      e.stopPropagation();
      name.contentEditable = 'true';
      name.focus();
      document.getSelection().selectAllChildren(name);
    });
    name.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        name.blur();
      }
      if (e.key === 'Escape') {
        name.textContent = label;
        name.blur();
      }
    });
    name.addEventListener('blur', () => {
      if (name.contentEditable !== 'true') return;
      name.contentEditable = 'false';
      const text = name.textContent.trim();
      if (text && text !== label) app.pageOp({ op: 'retitle', path: page.path, title: text });
    });
    chip.addEventListener('dragstart', e => {
      dragFrom = page.path;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', `tab:${page.path}`);
      chip.classList.add('dragging');
    });
    chip.addEventListener('dragend', () => {
      chip.classList.remove('dragging');
      host.querySelectorAll('.tab-drop').forEach(n => n.classList.remove('tab-drop', 'tab-drop-after'));
    });
    chip.addEventListener('dragover', e => {
      if (dragFrom === null) return;
      e.preventDefault();
      const r = chip.getBoundingClientRect();
      host.querySelectorAll('.tab-drop').forEach(n => n.classList.remove('tab-drop', 'tab-drop-after'));
      chip.classList.add('tab-drop');
      chip.classList.toggle('tab-drop-after', e.clientX > r.left + r.width / 2);
    });
    chip.addEventListener('drop', e => {
      if (dragFrom === null) return;
      e.preventDefault();
      const r = chip.getBoundingClientRect();
      const after = e.clientX > r.left + r.width / 2;
      const from = dragFrom;
      dragFrom = null;
      if (from !== page.path) app.pageOp({ op: 'reorder', path: from, before: page.path, after });
    });
    host.append(chip);
  }
  host.append(el('button.tab-add', { type: 'button', text: '+ Page', title: 'Add a page (a tab with its own blocks)', onclick: () => app.pageOp({ op: 'add' }) }));
}
