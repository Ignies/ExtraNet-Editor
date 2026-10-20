// Site settings form: everything site.yml holds.

import { el } from './util.js';
import { field, textInput, select, colourInput, button } from './ui-dialog.js';
import { NETWORKS, FONTS, BACKGROUND_MODES } from './markup.js';
import { siteYaml, folderFromTitle } from './package.js';
import { bundled } from './repo.js';

const NETWORK_LABELS = {
  CMUNetPublic: 'Public (every colony desktop)',
  CMUNetSeegson: 'Seegson',
  CMUNetWeylandYutani: 'Weyland-Yutani (corporate terminals)',
  CMUNetUSCM: 'USCM',
  CMUNetCMB: 'CMB (the Marshals)',
  CMUNetDeep: 'Deep web (hacked terminals)',
};

export function renderSiteForm(host, app) {
  const site = () => app.pkg.site;
  const changed = () => {
    app.changed('site');
    yamlView.textContent = siteYaml(app.pkg);
  };
  host.replaceChildren();

  const section = (title, ...children) => el('section.form-section', {}, el('h3.section-title', { text: title }), ...children);

  // Identity
  const folder = textInput(app.pkg.folder, { placeholder: 'LostAndFound' });
  folder.addEventListener('input', () => {
    app.pkg.folder = folder.value.replace(/[^A-Za-z0-9_-]/g, '');
    changed();
  });
  const id = textInput(site().id);
  id.addEventListener('input', () => {
    site().id = id.value.trim();
    changed();
  });
  const address = textInput(site().address, { placeholder: 'lostfound.colony' });
  const addressHint = el('span.field-hint');
  const checkAddress = () => {
    const v = address.value;
    let problem = '';
    if (v !== v.toLowerCase()) problem = 'Must be lowercase.';
    else if (/[/\s]/.test(v)) problem = 'No slashes or spaces: just the host, e.g. lostfound.colony.';
    else if (v.includes('://')) problem = 'Leave out the scheme.';
    addressHint.textContent = problem || 'What players type in the address bar.';
    addressHint.classList.toggle('hint-bad', !!problem);
  };
  address.addEventListener('input', () => {
    site().address = address.value;
    checkAddress();
    changed();
  });
  checkAddress();
  const title = textInput(site().title);
  title.addEventListener('input', () => {
    site().title = title.value;
    changed();
  });
  const autoId = button('Name from title', () => {
    const name = folderFromTitle(title.value);
    folder.value = name;
    app.pkg.folder = name;
    id.value = `CMUNetSitePackage${name}`;
    site().id = id.value;
    changed();
  }, '.btn-small');

  host.append(section('Site',
    field('Title', title, 'Plain text. Shown in the window title and the directory.'),
    el('label.field', {}, el('span.field-label', { text: 'Address' }), address, addressHint),
    field('Package folder', folder, 'The folder name in Packages/ (and the zip\'s top folder).'),
    field('Id', id, 'CMUNetSitePackage<Name>. Must be unique in the game.'),
    autoId));

  // Networks
  const networks = el('div.checks');
  const deepOnly = el('div.deep-only');
  const updateDeep = () => {
    deepOnly.style.display = site().networks.includes('CMUNetDeep') ? '' : 'none';
  };
  for (const network of NETWORKS) {
    const box = el('input', { type: 'checkbox', checked: site().networks.includes(network) });
    box.addEventListener('change', () => {
      const set = new Set(site().networks);
      if (box.checked) set.add(network);
      else set.delete(network);
      site().networks = NETWORKS.filter(n => set.has(n)).concat([...set].filter(n => !NETWORKS.includes(n)));
      updateDeep();
      changed();
    });
    networks.append(el('label.check', {}, box, el('span', {}, el('code', { text: network }), ' ', el('span.muted', { text: NETWORK_LABELS[network] }))));
  }
  const flag = (key, label, hint) => {
    const box = el('input', { type: 'checkbox', checked: !!site()[key] });
    box.addEventListener('change', () => {
      site()[key] = box.checked;
      changed();
    });
    return el('label.check', { title: hint }, box, el('span', {}, label, hint ? el('span.muted', { text: ` ${hint}` }) : null));
  };
  const alias = textInput(site().aliasSuffix, { placeholder: '.deep' });
  alias.addEventListener('input', () => {
    site().aliasSuffix = alias.value.trim();
    changed();
  });
  deepOnly.append(field('Alias suffix', alias, 'Ending of the random address the site gets each round: .deep (default), .file, .cam...'));
  host.append(section('Networks', networks,
    flag('unlisted', 'Unlisted', 'Left out of the directory.'),
    flag('hidden', 'Hidden', 'Deep only: reachable only through the ad maze.'),
    deepOnly));
  updateDeep();

  // Style
  const style = site().style;
  const colourField = (key, label) => {
    const input = colourInput(style[key] || '', { allowEmpty: true });
    input.addEventListener('change', () => {
      if (input.value()) style[key] = input.value();
      else delete style[key];
      changed();
    });
    return field(label, input);
  };
  const font = select([['', '(theme default: Sans)'], ...FONTS.map(f => [f, f])], style.font || '');
  font.addEventListener('change', () => {
    if (font.value) style.font = font.value;
    else delete style.font;
    changed();
  });
  const bgImage = textInput(style.backgroundImage || '', { placeholder: './background.png or /Textures/...png' });
  bgImage.addEventListener('input', () => {
    if (bgImage.value.trim()) style.backgroundImage = bgImage.value.trim();
    else delete style.backgroundImage;
    changed();
  });
  const bgMode = select([['', '(Stretch)'], ...BACKGROUND_MODES.map(m => [m, m])], style.backgroundMode || '');
  bgMode.addEventListener('change', () => {
    if (bgMode.value) style.backgroundMode = bgMode.value;
    else delete style.backgroundMode;
    changed();
  });
  host.append(section('Style',
    el('p.note', { text: 'The look of every page. A page\'s own <CMUNetStyle .../> line overrides it. Empty fields use the computer\'s theme colours.' }),
    el('div.grid-2', {}, colourField('background', 'Background'), colourField('text', 'Text'), colourField('heading', 'Heading'), colourField('link', 'Link')),
    field('Font', font),
    el('div.grid-2', {}, field('Background image', bgImage), field('Image mode', bgMode))));

  // Tabs
  const tabsHost = el('div.tabs-editor');
  const renderTabs = () => {
    tabsHost.replaceChildren();
    site().tabs.forEach((tab, index) => {
      const t = textInput(tab.title, { placeholder: 'Tab title' });
      t.addEventListener('input', () => {
        tab.title = t.value;
        changed();
      });
      const pages = site().pages.map(p => [p.path, p.path === '' ? '(index)' : p.path]);
      if (!pages.some(([p]) => p === tab.path)) pages.push([tab.path, `${tab.path} (missing)`]);
      const p = select(pages, tab.path);
      p.addEventListener('change', () => {
        tab.path = p.value;
        changed();
      });
      const move = delta => {
        const list = site().tabs;
        const to = index + delta;
        if (to < 0 || to >= list.length) return;
        [list[index], list[to]] = [list[to], list[index]];
        renderTabs();
        changed();
      };
      tabsHost.append(el('div.row-edit', {}, t, p,
        button('↑', () => move(-1), '.btn-icon'), button('↓', () => move(1), '.btn-icon'),
        button('X', () => {
          site().tabs.splice(index, 1);
          renderTabs();
          changed();
        }, '.btn-icon.btn-danger')));
    });
    tabsHost.append(button('+ Add tab', () => {
      const used = new Set(site().tabs.map(t => t.path));
      const next = site().pages.find(p => !used.has(p.path)) || site().pages[0] || { path: '' };
      site().tabs.push({ title: next.path === '' ? 'Home' : next.path.replace(/(^|[-_/])(\w)/g, (m, a, b) => (a ? ' ' : '') + b.toUpperCase()), path: next.path });
      renderTabs();
      changed();
    }, '.btn-small'));
  };
  app.on('pages', renderTabs, 'site-form');
  renderTabs();
  host.append(section('Tabs', el('p.note', { text: 'A tab strip drawn above every page in the site\'s colours; the open page\'s tab is filled.' }), tabsHost));

  // Board
  const boardHost = el('div');
  const renderBoard = () => {
    boardHost.replaceChildren();
    const b = site().board;
    const enable = el('input', { type: 'checkbox', checked: !!b });
    enable.addEventListener('change', () => {
      site().board = enable.checked
        ? { postLabel: 'Post a notice', empty: 'Nothing posted this shift.', posters: [], posterWhitelist: null, anyonePosts: true, showTerminals: false, bounties: false, leaks: false, hijackable: false, extra: null }
        : null;
      renderBoard();
      changed();
    });
    boardHost.append(el('label.check', {}, enable, el('span', { text: 'This site is a board (round postings under its index page)' })));
    if (!b) return;
    const text = (key, label, hint) => {
      const input = textInput(b[key]);
      input.addEventListener('input', () => {
        b[key] = input.value;
        changed();
      });
      return field(label, input, hint);
    };
    const flagBox = (key, label, hint) => {
      const box = el('input', { type: 'checkbox', checked: !!b[key] });
      box.addEventListener('change', () => {
        b[key] = box.checked;
        changed();
      });
      return el('label.check', {}, box, el('span', {}, label, el('span.muted', { text: ` ${hint}` })));
    };
    const posters = el('textarea.input', { rows: 3, placeholder: 'AU14JobCivilianJournalist\n(one job id per line)', value: b.posters.join('\n'), spellcheck: false });
    posters.addEventListener('input', () => {
      b.posters = posters.value.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
      changed();
    });
    const jobPicker = textInput('', { placeholder: 'Search a job id to add' });
    jobPicker.setAttribute('list', 'job-ids');
    jobPicker.addEventListener('change', () => {
      const v = jobPicker.value.trim();
      if (v && !b.posters.includes(v)) {
        b.posters.push(v);
        posters.value = b.posters.join('\n');
        changed();
      }
      jobPicker.value = '';
    });
    boardHost.append(
      text('postLabel', 'Post button', 'The composer button, e.g. "Report something found".'),
      text('empty', 'Empty board text', 'Shown when nobody has posted.'),
      field('Posters (job ids)', posters, 'Exact job ids that may publish. List every variant.'),
      jobPicker,
      b.posterWhitelist ? el('p.note', { text: `posterWhitelist: ${JSON.stringify(b.posterWhitelist)} (kept from the loaded file; edit it in site.yml by hand).` }) : null,
      flagBox('anyonePosts', 'Anyone posts', 'Everyone at a computer that reaches the site may post (forums, classifieds).'),
      flagBox('showTerminals', 'Show terminals', 'Postings show "Terminal #N".'),
      flagBox('bounties', 'Bounties', 'Postings may carry cash rewards.'),
      flagBox('hijackable', 'Hijackable', 'Insurgents can seize the front page.'),
      flagBox('leaks', 'Leaks', 'Deep only: random hacker leaks land here.'));
  };
  renderBoard();
  host.append(section('Board', boardHost));

  bundled('jobs.json').then(jobs => {
    if (document.getElementById('job-ids')) return;
    document.body.append(el('datalist#job-ids', {}, jobs.map(j => el('option', { value: j }))));
  }).catch(() => {});

  const yamlView = el('pre.yaml-view', { text: siteYaml(app.pkg) });
  host.append(section('Generated site.yml', yamlView));
  app.on('site-yaml', () => {
    yamlView.textContent = siteYaml(app.pkg);
  }, 'site-form');
}
