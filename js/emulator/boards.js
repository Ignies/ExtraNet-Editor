// A board site's postings under its index page (CMUNetBoardView). In game the server keeps the postings for the
// round; here they are kept in this browser, with two sample postings so an empty board still shows its layout.

import { el, css, rgba } from '../util.js';
import { text } from '../library.js';
import { L } from './data.js';

const SAMPLES = [
  { title: 'Water pressure low on the east side', body: 'Maintenance says it is the pumps again. Fill your bottles before the evening shift.', author: 'Dana Okoye', role: 'Colonist', time: '06:42', sample: true, comments: [{ author: 'Rui Matsuda', role: 'Visitor', time: '06:51', body: 'Same in the bunks by the bar.' }] },
  { title: 'Lost: grey thermos with a dent', body: 'Left it in the canteen at lunch. Bring it to terminal 3 if you see it.', author: 'Lev Brandt', role: 'Miner', time: '07:05', sample: true, comments: [] },
];

function key(entry) {
  return `extranet-emulator-board-${entry.id}`;
}

function load(entry) {
  try {
    const kept = JSON.parse(localStorage.getItem(key(entry)) || 'null');
    if (Array.isArray(kept)) return kept;
  } catch {
    // starts with the samples
  }
  return SAMPLES.map(p => ({ ...p, comments: p.comments.map(c => ({ ...c })) }));
}

function save(entry, posts) {
  try {
    localStorage.setItem(key(entry), JSON.stringify(posts));
  } catch {
    // this visit only
  }
}

function clock() {
  // The shift clock: the round starts at 06:00.
  const minutes = 6 * 60 + Math.floor(performance.now() / 60000);
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** The board under the index page, in the page's colours. user = { name, job }. */
export function boardView(entry, style, strings, user) {
  const b = entry.site.board;
  const t = (id, vars) => L(strings, id, vars);
  const textColour = rgba(style.text) || [1, 1, 1, 1];
  const heading = rgba(style.heading || style.text) || textColour;
  const link = rgba(style.link) || [1, 1, 1, 1];
  const background = rgba(style.background) || [0, 0, 0, 1];
  const box = el('div.board.emu-board');
  box.style.setProperty('--b-link', css(link));
  box.style.setProperty('--b-bg', css(background));
  const name = user.name || 'Colonist';
  const role = user.job || t('cmu-net-board-no-role');
  let posts = load(entry);

  const button = (label, onclick) => el('button.board-btn', { type: 'button', text: label, onclick });
  const field = (placeholder, max, area = false) => el(area ? 'textarea.board-field' : 'input.board-field', { placeholder, maxLength: max });
  const form = el('div.emu-board-form');
  form.hidden = true;
  const title = field(t('cmu-net-board-title-placeholder'), 80);
  const body = field(t('cmu-net-board-body-placeholder'), 1000, true);
  form.append(title, body, el('div.board-comment-line', {},
    button(text(strings, b.postLabel) || 'Post', () => {
      if (!title.value.trim() || !body.value.trim()) return;
      posts.unshift({ title: title.value.trim(), body: body.value.trim(), author: name, role, time: clock(), mine: true, comments: [] });
      save(entry, posts);
      title.value = '';
      body.value = '';
      form.hidden = true;
      draw();
    }),
    button(t('cmu-net-board-cancel'), () => {
      form.hidden = true;
    })));
  const list = el('div.board-posts');
  box.append(el('div.board-rule', { style: { background: css(link, 0.5) } }),
    el('div', {}, button(`+ ${text(strings, b.postLabel) || 'Post'}`, () => {
      form.hidden = !form.hidden;
    })),
    form, list,
    el('div.emu-board-note', { text: 'Emulator: postings are kept in this browser. In game they last the round.', style: { color: css(textColour, 0.5) } }));

  function draw() {
    list.replaceChildren();
    if (!posts.length) list.append(el('div.board-label', { text: text(strings, b.empty), style: { color: css(textColour) } }));
    posts.forEach((post, index) => {
      const terminal = b.showTerminals ? ' | Terminal #3' : '';
      const node = el('div.board-post');
      const header = el('div.board-post-header', {}, el('div.page-heading.h-heading.board-title', { text: post.title }));
      if (post.mine) header.append(button(t('cmu-net-board-delete'), () => {
        posts.splice(index, 1);
        save(entry, posts);
        draw();
      }));
      node.append(header,
        el('div.board-label', { text: t('cmu-net-board-byline', { author: post.author, role: post.role, time: post.time }) + terminal + (post.sample ? '  (sample)' : ''), style: { color: css(textColour, 0.65) } }),
        el('div.board-body', { text: post.body, style: { color: css(textColour) } }));
      const comments = el('div.board-comments');
      for (const c of post.comments) {
        comments.append(el('div.board-label', { text: t('cmu-net-board-comment-byline', { author: c.author, role: c.role, time: c.time }), style: { color: css(heading, 0.8) } }),
          el('div.board-body', { text: c.body, style: { color: css(textColour) } }));
      }
      const input = el('input.board-field', { type: 'text', placeholder: t('cmu-net-board-comment-placeholder'), maxLength: 300 });
      const send = () => {
        if (!input.value.trim()) return;
        post.comments.push({ author: name, role, time: clock(), body: input.value.trim() });
        save(entry, posts);
        draw();
      };
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') send();
      });
      comments.append(el('div.board-comment-line', {}, input, button(t('cmu-net-board-comment-send'), send)));
      node.append(comments, el('div.board-rule', { style: { background: css(link, 0.25), marginTop: '6px' } }));
      list.append(node);
    });
  }
  draw();
  return box;
}
