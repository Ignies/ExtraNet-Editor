// The settings panel on the right: the selected block's options, or the page's when nothing is selected.

import { el } from './util.js';
import { field, textInput, select, colourInput, button, buttonRow } from './ui-dialog.js';
import { BLOCK_TYPES, ARCADE_GAMES, RECIPE_GROUPS, columnAttrs, block as newBlock } from './blocks.js';
import { FONTS, H_ALIGN, V_ALIGN } from './markup.js';
import { pickSprite, pickAd, pickWallpaper } from './ui-sprites.js';

/** A select of the site's pages (by tab title) plus net://random and a typed address. */
export function linkPicker(app, value, onChange) {
  const options = app.linkTargets();
  const known = options.some(o => o.value === value);
  const sel = select([...options.map(o => [o.value, o.label]), ['net://random', 'A random site (net://random)'], ['@other', 'Another address...']], known || value === 'net://random' ? value : '@other');
  const other = textInput(known || value === 'net://random' ? '' : value, { placeholder: 'host or host/path, e.g. herald.colony.news' });
  other.style.display = sel.value === '@other' ? '' : 'none';
  const emit = () => onChange(sel.value === '@other' ? other.value.trim() : sel.value);
  sel.addEventListener('change', () => {
    other.style.display = sel.value === '@other' ? '' : 'none';
    emit();
  });
  other.addEventListener('input', emit);
  return el('div.link-picker', {}, sel, other);
}

function attrText(b, key, label, app, hint, props = {}) {
  const input = textInput(b.attrs[key] ?? '', props);
  input.addEventListener('input', () => app.editBlock(b.id, x => {
    x.attrs[key] = input.value;
  }, 'typing'));
  return field(label, input, hint);
}

function attrNumber(b, key, label, app, hint) {
  return attrText(b, key, label, app, hint, { inputmode: 'decimal', className: 'input input-narrow' });
}

function attrSelect(b, key, label, options, app, hint, target = 'attrs') {
  const s = select(options, (b[target] || {})[key] ?? '');
  s.addEventListener('change', () => app.editBlock(b.id, x => {
    if (s.value === '') delete x[target][key];
    else x[target][key] = s.value;
  }));
  return field(label, s, hint);
}

function attrColour(b, key, label, app, hint, target = 'attrs') {
  const raw = (b[target] || {})[key] || '';
  const shown = raw.startsWith('@') ? app.markupColours()[raw.slice(1)] || '' : raw;
  const input = colourInput(shown, { allowEmpty: true });
  input.addEventListener('change', () => app.editBlock(b.id, x => {
    if (input.value()) x[target][key] = input.value();
    else delete x[target][key];
  }, 'typing'));
  return field(label, input, raw.startsWith('@') ? `Follows the site's ${raw.slice(1)} colour until changed.` : hint);
}

const ALIGN_OPTIONS = [['', '(default)'], ...H_ALIGN.map(a => [a, a])];

export function renderProps(host, app) {
  host.replaceChildren();
  const id = app.selected;
  if (id === '@board') return boardProps(host, app);
  const found = id ? app.findSelected() : null;
  if (!found) return pageProps(host, app);
  const b = found.block;
  const meta = BLOCK_TYPES[b.type] || { label: b.type, tag: '' };
  host.append(el('div.props-head', {},
    el('span.props-title', { text: meta.label }),
    el('code.props-tag', { text: meta.tag })),
    buttonRow(
      button('↑', () => app.op({ op: 'nudge', id, delta: -1 }), '.btn-small'),
      button('↓', () => app.op({ op: 'nudge', id, delta: 1 }), '.btn-small'),
      button('Duplicate', () => app.op({ op: 'duplicate', id }), '.btn-small'),
      button('Delete', () => app.op({ op: 'delete', id }), '.btn-small.btn-danger'),
      button('Page settings', () => app.select(null), '.btn-small')));

  const issues = (app.blockIssues && app.blockIssues.get(id)) || [];
  for (const issue of issues) host.append(el(`div.props-issue.issue-${issue.level}`, { text: issue.message }));

  const body = el('div.props-body');
  host.append(body);
  const a = b.attrs || {};
  switch (b.type) {
    case 'heading': {
      const level = select([['1', 'H1: page title'], ['2', 'H2: section'], ['3', 'H3: small heading']], String(b.level));
      level.addEventListener('change', () => app.editBlock(id, x => {
        x.level = Number(level.value);
      }));
      const text = textInput(b.text);
      text.addEventListener('input', () => app.editBlock(id, x => {
        x.text = text.value;
      }, 'typing'));
      body.append(field('Size', level), field('Text', text, 'Headings are plain text: no bold or links. {colony} works.'));
      break;
    }
    case 'paragraph':
      body.append(markupArea(app, b, 'text', 'Text (markup)', 'Type on the page, or edit the markup: [bold] [italic] [color=#hex] [netlink="Text" link="host/path"].'));
      break;
    case 'list': {
      const area = el('textarea.input.mono', { rows: Math.max(4, b.items.length + 1), value: b.items.join('\n'), spellcheck: false });
      area.addEventListener('input', () => app.editBlock(id, x => {
        x.items = area.value.split('\n').map(s => s.trim()).filter(Boolean);
        if (!x.items.length) x.items = ['...'];
      }, 'typing'));
      body.append(field('Items, one per line', area, 'Each line is a bullet. Markup works.'));
      break;
    }
    case 'linklist':
      body.append(linkListEditor(app, b));
      break;
    case 'raw':
      body.append(markupArea(app, b, 'markup', 'Markup', 'Anything the game parses. It is written exactly as typed.', 10));
      break;
    case 'image': {
      const images = Object.keys(app.pkg.images);
      const path = textInput(a.Path || '', { placeholder: './banner.png or /Textures/....png' });
      path.addEventListener('input', () => app.editBlock(id, x => {
        x.attrs.Path = path.value.trim();
      }, 'typing'));
      const pick = select([['', images.length ? 'Choose an uploaded image...' : 'No uploaded images yet'], ...images.map(n => [`./${n}`, n])], images.includes((a.Path || '').slice(2)) ? a.Path : '');
      pick.addEventListener('change', () => {
        if (!pick.value) return;
        path.value = pick.value;
        app.editBlock(id, x => {
          x.attrs.Path = pick.value;
        });
      });
      body.append(field('Uploaded image', pick), field('Or a game texture path', path, 'Uploaded images are ./name.png; game textures start with /Textures/.'),
        buttonRow(button('Design a banner...', () => app.openBannerStudio({ name: (a.Path || '').startsWith('./') ? a.Path.slice(2) : 'banner', blockId: id }), '.btn-primary'),
          button('Upload a PNG...', () => app.uploadImages(names => {
          if (names[0]) app.editBlock(id, x => {
            x.attrs.Path = `./${names[0]}`;
          });
        }), '.btn-small')),
        attrNumber(b, 'MaxHeight', 'Height (pixels)', app, 'Shown at this height, shrunk to fit the page width. 150 suits a banner.'));
      break;
    }
    case 'sprite':
      body.append(buttonRow(button('Pick a game sprite...', async () => {
        const r = await pickSprite({ rsi: a.Rsi, state: a.State, scale: a.Scale, align: a.Align });
        if (r) app.editBlock(id, x => {
          Object.assign(x.attrs, { Rsi: r.rsi, State: r.state, Scale: r.scale, Align: r.align });
        });
      }, '.btn-primary')),
      attrText(b, 'Rsi', 'RSI', app), attrText(b, 'State', 'State', app),
      attrNumber(b, 'Scale', 'Scale', app, '2 doubles the 32x32 sprite.'),
      attrSelect(b, 'Align', 'Align', [['', '(Center)'], ['Left', 'Left'], ['Center', 'Center'], ['Right', 'Right']], app));
      break;
    case 'wallpaper':
      body.append(buttonRow(button('Pick a wallpaper...', async () => {
        const w = await pickWallpaper();
        if (w) app.editBlock(id, x => {
          x.attrs.Id = w;
        });
      }, '.btn-primary')), attrText(b, 'Id', 'Wallpaper id', app, 'New wallpapers go in wallpapers.yml, outside a site package.'));
      break;
    case 'blink':
      body.append(attrNumber(b, 'Rate', 'Seconds on and off', app, 'Drop blocks into the frame on the page; everything in it blinks.'));
      break;
    case 'marquee':
      body.append(attrText(b, 'Text', 'Ticker text', app), attrNumber(b, 'Speed', 'Speed (pixels per second)', app), attrColour(b, 'Color', 'Colour', app, 'Empty: the page text colour.'));
      break;
    case 'popup':
      body.append(attrText(b, 'Title', 'Title', app), attrText(b, 'Text', 'Text', app, 'Plain text.'),
        field('Link (optional)', linkPicker(app, a.Link || '', v => app.editBlock(id, x => {
          if (v) x.attrs.Link = v;
          else delete x.attrs.Link;
        }, 'typing'))),
        attrText(b, 'LinkText', 'Link text', app),
        el('div.grid-3', {}, attrNumber(b, 'X', 'X (0-1)', app), attrNumber(b, 'Y', 'Y (0-1)', app), attrNumber(b, 'Delay', 'Delay (s)', app)),
        attrColour(b, 'Background', 'Background', app, 'Default #1A1A1A.'), attrColour(b, 'Accent', 'Accent', app, 'Default #FFD200.'),
        attrText(b, 'Icon', 'Icon image (optional)', app, './icon.png or /Textures/....png, drawn at 2x.'),
        el('p.note', { text: 'Pop ups float over the page in game, placed by X and Y once Delay has passed. On the canvas they sit in line.' }));
      break;
    case 'ad': {
      body.append(buttonRow(button('Pick an ad...', async () => {
        const r = await pickAd();
        if (r) app.editBlock(id, x => {
          x.attrs.Id = r.id;
          if (r.flip) x.attrs.Flip = 'true';
          else delete x.attrs.Flip;
        });
      }, '.btn-primary')), attrText(b, 'Id', 'Ad id', app, 'A cmuDeepAd from deep_ads.yml.'));
      const flip = el('input', { type: 'checkbox', checked: (a.Flip || '').toLowerCase() === 'true' });
      flip.addEventListener('change', () => app.editBlock(id, x => {
        if (flip.checked) x.attrs.Flip = 'true';
        else delete x.attrs.Flip;
      }));
      body.append(el('label.check', {}, flip, 'Product on the right'));
      break;
    }
    case 'columns': {
      const count = select([['2', 'Two columns'], ['3', 'Three columns']], String(b.columns.length));
      count.addEventListener('change', () => app.editBlock(id, x => {
        const want = Number(count.value);
        while (x.columns.length < want) x.columns.push({ attrs: columnAttrs(), children: [newBlock('paragraph', { text: 'New column.' })] });
        while (x.columns.length > want) {
          const gone = x.columns.pop();
          x.columns[x.columns.length - 1].children.push(...gone.children);
        }
      }));
      const gap = textInput(b.columns[0] ? b.columns[0].attrs.Margin || '' : '', { className: 'input input-narrow' });
      gap.addEventListener('input', () => app.editBlock(id, x => {
        for (const c of x.columns) {
          if (gap.value.trim()) c.attrs.Margin = gap.value.trim();
          else delete c.attrs.Margin;
        }
      }, 'typing'));
      body.append(field('Columns', count, 'Removing a column moves its blocks into the one before.'), field('Space round each column (pixels)', gap),
        el('p.note', { text: 'Written as a stretched horizontal <Box> holding one vertical <Box> per column; the game shares the width between them.' }));
      break;
    }
    case 'box':
      body.append(attrSelect(b, 'Orientation', 'Direction', [['', 'Row (side by side)'], ['Vertical', 'Stack (one under another)']], app),
        attrSelect(b, 'HorizontalAlignment', 'Position', [['', '(Centre)'], ...H_ALIGN.map(x => [x, x])], app, 'Centre shrinks the box to its content; Stretch fills the width.'),
        attrSelect(b, 'VerticalAlignment', 'Vertical position', [['', '(default)'], ...V_ALIGN.map(x => [x, x])], app),
        attrNumber(b, 'Margin', 'Margin (pixels)', app),
        el('p.note', { text: 'A <Box>: good for a centred row of sprites or images.' }));
      break;
    case 'panel':
      body.append(attrColour(b, 'Color', 'Fill', app), attrColour(b, 'OutlineColor', 'Outline', app),
        attrNumber(b, 'OutlineThickness', 'Outline thickness', app), attrNumber(b, 'Margin', 'Space outside', app),
        field('Space inside', (() => {
          const input = textInput(b.inner && b.inner.Margin || '', { className: 'input input-narrow' });
          input.addEventListener('input', () => app.editBlock(id, x => {
            if (input.value.trim()) x.inner.Margin = input.value.trim();
            else delete x.inner.Margin;
          }, 'typing'));
          return input;
        })()),
        el('p.note', { text: 'A <ColorBox> holding a vertical <Box>: a filled, outlined panel for notes, quotes and side boxes.' }));
      break;
    case 'divider':
      body.append(attrColour(b, 'Color', 'Colour', app), attrColour(b, 'OutlineColor', 'Edge colour', app), attrNumber(b, 'OutlineThickness', 'Thickness', app), attrNumber(b, 'Margin', 'Margin', app),
        el('p.note', { text: 'An empty <ColorBox>: a thin line across the page.' }));
      break;
    case 'arcade':
      body.append(attrSelect(b, 'Game', 'Game', [['', 'All games (tabs)'], ...ARCADE_GAMES.map(g => [g, g])], app,
        'All games puts every cabinet in its own tab with a sound button, like the game\'s own arcade page.'));
      break;
    case 'recipes':
      body.append(attrSelect(b, 'Group', 'Recipes', RECIPE_GROUPS.map(g => [g, g || 'All food']), app),
        el('p.note', { text: 'The cookbook, built live from the game\'s microwave recipes.' }));
      break;
    case 'search':
      body.append(attrColour(b, 'Text', 'Text', app, 'Snippets. Default #1A1030.'), attrColour(b, 'Link', 'Link', app, 'Result links. Default #0033CC.'),
        attrColour(b, 'Background', 'Link background', app, 'Behind a link on hover. Default #F4F0FF.'), attrColour(b, 'Muted', 'Muted', app, 'The count and the addresses. Default #7A6A90.'),
        el('p.note', { text: 'A search box over the words of every listed page the reader\'s terminal reaches. Deep, hidden and unlisted sites are never found.' }));
      break;
    case 'tape':
      body.append(attrSelect(b, 'Shelf', 'Shelf', [['', '6 tapes (default)'], ...Array.from({ length: 13 }, (_, n) => [String(n), n === 0 ? 'No shelf' : `${n} tapes`])], app),
        attrSelect(b, 'Live', 'Live broadcasts', [['', 'Shown (default)'], ['false', 'Hidden']], app),
        el('p.note', { text: 'YouTape\'s player: random tapes told from youtape.yml, a shelf of more, and the broadcasting cameras on air in the round.' }));
      break;
    case 'sportsbook':
    case 'spacegpt':
      body.append(el('p.note', { text: 'Drawn and run by the game. It has no settings.' }));
      break;
    default:
      break;
  }
}

function markupArea(app, b, key, label, hint, rows = 4) {
  const area = el('textarea.input.mono', { rows, value: b[key], spellcheck: false });
  area.addEventListener('input', () => app.editBlock(b.id, x => {
    x[key] = area.value;
  }, 'typing'));
  return field(label, area, hint);
}

function linkListEditor(app, b) {
  const box = el('div.linklist-edit');
  b.items.forEach((item, i) => {
    const text = textInput(item.text, { placeholder: 'Link text' });
    text.addEventListener('input', () => app.editBlock(b.id, x => {
      x.items[i].text = text.value;
      x.items[i].bare = false;
    }, 'typing'));
    const extra = textInput(item.extra || '', { placeholder: 'After the link (optional markup)' });
    extra.addEventListener('input', () => app.editBlock(b.id, x => {
      x.items[i].extra = extra.value ? (extra.value.startsWith(' ') ? extra.value : ` ${extra.value}`) : '';
    }, 'typing'));
    box.append(el('div.linklist-row', {},
      el('div.row-edit', {}, text, button('X', () => app.editBlock(b.id, x => {
        x.items.splice(i, 1);
        if (!x.items.length) x.items.push({ text: 'Link', link: app.pkg.site.address, extra: '' });
      }, null, true), '.btn-icon.btn-danger')),
      linkPicker(app, item.link === '@home' ? app.pkg.site.address : item.link, v => app.editBlock(b.id, x => {
        x.items[i].link = v;
        x.items[i].bare = false;
      }, 'typing')),
      extra));
  });
  box.append(button('+ Add link', () => app.editBlock(b.id, x => {
    x.items.push({ text: 'New link', link: app.pkg.site.address, extra: '' });
  }, null, true), '.btn-small'));
  return box;
}

function pageProps(host, app) {
  const page = app.currentPageEntry();
  host.append(el('div.props-head', {}, el('span.props-title', { text: 'Page settings' }), el('code.props-tag', { text: app.currentFile || '' })));
  if (!page) {
    host.append(el('p.note', { text: 'This file is not one of the site\'s pages (a colony version or an unlisted file).' }));
    return;
  }
  const site = app.pkg.site;
  const tab = site.tabs.find(t => (t.path || '') === page.path);
  const body = el('div.props-body');
  host.append(body);

  const title = textInput(tab ? tab.title : '', { placeholder: 'Tab title' });
  title.addEventListener('change', () => app.pageOp({ op: 'retitle', path: page.path, title: title.value }));
  const path = textInput(page.path, { placeholder: '(index)', disabled: page.path === '' });
  path.addEventListener('change', () => app.pageOp({ op: 'repath', path: page.path, to: path.value }));
  const inStrip = el('input', { type: 'checkbox', checked: !!tab });
  inStrip.addEventListener('change', () => app.pageOp({ op: 'toggleTab', path: page.path, on: inStrip.checked }));
  body.append(field('Tab title', title), el('label.check', {}, inStrip, 'Show in the tab strip'),
    field('Address path', path, page.path === '' ? `The home page: ${site.address}` : `Reached as ${site.address}/${page.path}`),
    el('div.muted', { text: `File: ${page.file}` }));

  // Page style: a CMUNetStyle line overriding the site style.
  const style = app.pageStyleBlock();
  const s = style ? style.attrs : {};
  body.append(el('h3.section-title', { text: 'This page\'s colours' }),
    el('p.note', { text: style ? 'This page overrides the site style (a <CMUNetStyle> line).' : 'This page uses the site style from the Site tab. Set a colour here to override it for this page only.' }));
  const colour = (key, label) => {
    const input = colourInput(s[key] || '', { allowEmpty: true });
    input.addEventListener('change', () => app.setPageStyle(key, input.value()));
    return field(label, input);
  };
  body.append(el('div.grid-2', {}, colour('Background', 'Background'), colour('Text', 'Text'), colour('Heading', 'Heading'), colour('Link', 'Link')));
  const font = select([['', '(site font)'], ...FONTS.map(f => [f, f])], s.Font || '');
  font.addEventListener('change', () => app.setPageStyle('Font', font.value));
  body.append(field('Font', font));
  if (style) body.append(buttonRow(button('Use the site style', () => app.setPageStyle(null), '.btn-small')));
  body.append(el('p.note', { text: 'Click a block on the page to edit it. Drag blocks by their ⠿ handle.' }));
}

function boardProps(host, app) {
  const b = app.pkg.site.board;
  host.append(el('div.props-head', {}, el('span.props-title', { text: 'Board postings' }), el('code.props-tag', { text: 'site.yml board:' })));
  if (!b) return;
  const text = (key, label, hint) => {
    const input = textInput(b[key]);
    input.addEventListener('input', () => app.editSite(() => {
      b[key] = input.value;
    }, 'typing'));
    return field(label, input, hint);
  };
  const flag = (key, label, hint) => {
    const box = el('input', { type: 'checkbox', checked: !!b[key] });
    box.addEventListener('change', () => app.editSite(() => {
      b[key] = box.checked;
    }));
    return el('label.check', {}, box, el('span', {}, label, el('span.muted', { text: ` ${hint}` })));
  };
  const posters = el('textarea.input.mono', { rows: 3, value: b.posters.join('\n'), placeholder: 'AU14JobCivilianJournalist', spellcheck: false });
  posters.addEventListener('input', () => app.editSite(() => {
    b.posters = posters.value.split(/[\s,]+/).filter(Boolean);
  }, 'typing'));
  host.append(el('div.props-body', {},
    el('p.note', { text: 'Players post here during the round. Postings always run under the front page, after your blocks.' }),
    text('postLabel', 'Post button', 'e.g. "Report something found"'),
    text('empty', 'Empty board text'),
    flag('anyonePosts', 'Anyone posts', 'Everyone at a terminal that reaches the site.'),
    field('Or only these jobs', posters, 'Exact job ids, one per line.'),
    flag('showTerminals', 'Show terminals', '"Terminal #N" on postings.'),
    flag('bounties', 'Bounties', 'Cash rewards on postings.'),
    flag('hijackable', 'Hijackable', 'Insurgents can seize the front page.'),
    buttonRow(button('Remove the board', () => app.op({ op: 'removeBoard' }), '.btn-small.btn-danger'))));
}
