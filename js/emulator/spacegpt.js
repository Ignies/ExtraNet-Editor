// SpaceGPT with its moderation, as a simulator. The game runs SpaceGPT across the server: a question goes to the
// admins first, in admin chat, with a few seconds to follow the terminal, hold it, rewrite its answers or deny it;
// then to the ghosts, who get a button at the top of the screen and a list to answer, ignore or follow from; the
// vote's winner goes back to the asker's page, which fills a hold with SpaceGPT pretending to work.
//
// The emulator has one player, so it plays all three: the page tag is the asker's side (you, at this terminal),
// and the simulator dock switches the overlays over the emulator between colonist, admin and ghost. A few other
// colonists' questions can be queued at other terminals, and a crowd of other ghosts votes too.
//
// Sources: Content.CMU/Client/PersonalComputers/CMUSpaceGptUi.cs (CMUNetSpaceGpt, CMUSpaceGptGhostSystem),
// CMUSpaceGptOptionsEui.cs, Content.CMU/Server/PersonalComputers/CMUSpaceGptSystem.cs, CMUSpaceGptCommand.cs and
// Content.CMU/Shared/PersonalComputers/CMUSpaceGpt.cs.

import { fetchRepoFile, locale } from '../repo.js';

// ---------------------------------------------------------------- limits (CMUSpaceGptLimits)

const ADMIN_DELAY = 5000;
const VOTING = 25000;
const COOLDOWN = 30000;
const QUESTION_LENGTH = 140;
const ANSWER_LENGTH = 120;
const CHOICES = 6;
/** CMUNetSpaceGpt.FrameUpdate: a stalling line every three seconds while held. */
const STALL_EVERY = 3000;
/** The simulator's Slow timers: the admin delay and the vote last this many times longer. */
const SLOW = 4;

const STORE = 'extranet-emulator-spacegpt';
const NETWORKS_FILE = 'Content.CMU/Resources/Prototypes/CMU14/PersonalComputers/networks.yml';
/** The admin the emulator's player is when they moderate: shell.Player.Name in CMUSpaceGptCommand. */
const ADMIN_NAME = 'Admin';

const STALLING = [1, 2, 3, 4, 5, 6, 7, 8].map(n => `cmu-spacegpt-stall-${n}`);

/** Other colonists at other terminals, for the sample questions. */
const SAMPLES = [
  { name: 'Dana Whitfield', terminal: 12, question: 'Is the bar open after the shift?' },
  { name: 'Marcus Hale', terminal: 31, question: 'what is the code to the armory', held: true },
  { name: 'Priya Nand', terminal: 4, question: 'Will the marines come back for us?', voting: true },
  { name: 'Tomas Ruiz', terminal: 22, question: 'Who keeps taking my lunch from the galley fridge?' },
  { name: 'Hana Okafor', terminal: 9, question: 'Is it safe to go outside tonight?', voting: true },
  { name: 'Leon Brandt', terminal: 17, question: 'how do i get into the deep web', held: true },
];

// ---------------------------------------------------------------- locale

const FALLBACK = {
  'cmu-spacegpt-placeholder': 'Ask SpaceGPT anything...',
  'cmu-spacegpt-ask': 'ASK',
  'cmu-spacegpt-greeting': 'SpaceGPT: Hello, colonist. How can I help you today?',
  'cmu-spacegpt-you': 'You: {$question}',
  'cmu-spacegpt-thinking': 'SpaceGPT is thinking...',
  'cmu-spacegpt-answer': 'SpaceGPT: {$answer}',
  'cmu-spacegpt-votes': '({$votes} {$votes -> [one] voice *[other] voices } agreed)',
  'cmu-spacegpt-no-votes': '(the line was quiet; SpaceGPT answered alone)',
  'cmu-spacegpt-safeties': 'Answered by SpaceGPT safety systems.',
  'cmu-spacegpt-denied': "I'm sorry, but I can't help with that. This request was flagged by SpaceGPT safety systems. Please rephrase your question or contact your colony administrator.",
  'cmu-spacegpt-stall-1': 'Gathering intelligence...',
  'cmu-spacegpt-stall-2': 'Browsing the ExtraNet...',
  'cmu-spacegpt-stall-3': 'Turning off safeties...',
  'cmu-spacegpt-stall-4': 'Consulting the colony archives...',
  'cmu-spacegpt-stall-5': 'Asking a Working Joe...',
  'cmu-spacegpt-stall-6': 'Cross-referencing Company records...',
  'cmu-spacegpt-stall-7': 'Rerouting through Gateway...',
  'cmu-spacegpt-stall-8': 'Thinking very hard...',
  'cmu-spacegpt-ghost-title': 'SpaceGPT needs an answer',
  'cmu-spacegpt-ghost-intro': 'A colonist asked SpaceGPT. Speak through the machine: pick the answer.',
  'cmu-spacegpt-ghost-alert': 'SpaceGPT has a question for you',
  'cmu-spacegpt-ghost-alert-many': 'SpaceGPT has { $count } questions for you',
  'cmu-spacegpt-ghost-answer': 'ANSWER',
  'cmu-spacegpt-ghost-ignore': 'IGNORE',
  'cmu-spacegpt-ghost-follow': 'FOLLOW',
  'cmu-spacegpt-admin-asked': '[bold]SpaceGPT:[/bold] { $name } asked on terminal #{ $terminal }: "{ $question }" { $links }',
  'cmu-spacegpt-admin-held': '[bold]SpaceGPT:[/bold] question { $id } held by { $admin }. { $links }',
  'cmu-spacegpt-admin-released': '[bold]SpaceGPT:[/bold] question { $id } released to the ghosts by { $admin }.',
  'cmu-spacegpt-admin-denied': '[bold]SpaceGPT:[/bold] question { $id } denied by { $admin }; the safeties answered.',
  'cmu-spacegpt-admin-options': 'Custom options',
  'cmu-spacegpt-admin-follow': 'Follow',
  'cmu-spacegpt-admin-hold': 'Hold',
  'cmu-spacegpt-admin-release': 'Release',
  'cmu-spacegpt-admin-deny': 'Deny question',
  'cmu-spacegpt-admin-options-title': 'SpaceGPT question { $id }: answers',
  'cmu-spacegpt-admin-options-asked': '{ $name } asked:',
  'cmu-spacegpt-admin-options-blank': '(empty: left out)',
  'cmu-spacegpt-admin-options-save': 'Save and send to the ghosts',
  'cmu-cmd-spacegpt-gone': 'There is no SpaceGPT question { $id } waiting, or it is already in that state.',
  // Resources/Locale/en-US/chat/managers/chat-manager.ftl, which the snapshot does not carry
  'chat-manager-send-admin-announcement-wrap-message': '[bold]{$adminChannelName}: {$message}[/bold]',
  'chat-manager-admin-channel-name': 'ADMIN',
};

let table = {};
let localePromise = null;

function loadStrings() {
  if (!localePromise) localePromise = locale().then(strings => (table = strings || {})).catch(() => table);
  return localePromise;
}

function selectVariant(body, value) {
  const variants = [];
  const re = /(\*?)\[([^\]]+)\]\s*([^[*]*)/g;
  let m;
  while ((m = re.exec(body))) variants.push({ star: !!m[1], key: m[2].trim(), text: m[3].trim() });
  const category = Number(value) === 1 ? 'one' : 'other';
  const pick = variants.find(v => v.key === String(value)) || variants.find(v => v.key === category)
    || variants.find(v => v.star) || variants[0];
  return pick ? pick.text : '';
}

/** Loc.GetString: {$name} arguments and simple selects. */
function t(key, args = {}) {
  let text = table[key] ?? FALLBACK[key] ?? key;
  // the editor's light Fluent reader drops a select's closing line; the built in copy then
  if (/->[^}]*$/.test(text) && FALLBACK[key]) text = FALLBACK[key];
  text = text.replace(/\{\s*\$(\w+)\s*->([^}]*)\}/g, (_, name, body) => selectVariant(body, args[name]));
  return text.replace(/\{\s*\$(\w+)\s*\}/g, (_, name) => (args[name] ?? '') + '');
}

// ---------------------------------------------------------------- the roster (CMUSpaceGptAnswers)

const FALLBACK_ANSWERS = [
  'It is certain.',
  'Reply hazy. Check your antenna.',
  'My sources say no.',
  'The Company already knows.',
  'Have you tried turning it off and on again?',
  'Try the vents.',
];

let rosterPromise = null;

/** The answers the ghosts choose from: the CMUSpaceGptAnswers localized dataset in networks.yml. */
export function spaceGptRoster() {
  if (rosterPromise) return rosterPromise;
  rosterPromise = (async () => {
    await loadStrings();
    let prefix = 'cmu-spacegpt-answer-';
    let count = 0;
    try {
      const { data } = await fetchRepoFile(NETWORKS_FILE, 'text');
      for (const block of data.replace(/\r\n?/g, '\n').split(/\n(?=- )/)) {
        if (!/^\s*id:\s*CMUSpaceGptAnswers\s*$/m.test(block)) continue;
        prefix = ((/^\s+prefix:\s*(.+)$/m.exec(block) || [])[1] || prefix).trim().replace(/^["']|["']$/g, '');
        count = Number((/^\s+count:\s*(\d+)/m.exec(block) || [])[1] || 0);
      }
    } catch {
      // offline: whatever answers the locale has
    }
    const answers = [];
    if (count > 0) {
      for (let i = 1; i <= count; i++) if (table[prefix + i]) answers.push(table[prefix + i]);
    } else {
      for (let i = 1; table[prefix + i]; i++) answers.push(table[prefix + i]);
    }
    return answers.length ? answers : FALLBACK_ANSWERS;
  })();
  return rosterPromise;
}

function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------- DOM helpers

function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'style') node.style.cssText = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Robust markup with [bold] and the admin message's command links, as DOM; links come in as nodes. */
function markup(text, links = []) {
  const out = document.createDocumentFragment();
  let bold = 0;
  const parts = text.split(/(\[\/?bold\]|\u0000)/);
  for (const part of parts) {
    if (part === '[bold]') bold++;
    else if (part === '[/bold]') bold = Math.max(0, bold - 1);
    else if (part === '\u0000') out.append(...links);
    else if (part) out.append(bold ? h('b', { text: part }) : document.createTextNode(part));
  }
  return out;
}

// ---------------------------------------------------------------- the simulated server

/** Who the emulator's player is now: the colonist at the terminal, an admin, or a ghost. */
const ROLES = [
  { id: 'colonist', label: 'Colonist', tip: 'You at this terminal: ask SpaceGPT and wait for the answer' },
  { id: 'admin', label: 'Admin', tip: 'Admin chat: every question first, with custom options, follow, hold and deny' },
  { id: 'ghost', label: 'Ghost', tip: 'Dead: the questions sent to the ghosts, to answer, ignore or follow' },
];

const blank = () => ({
  role: 'colonist',
  // the admin observing as an admin ghost: they get the ghosts' questions too (HasComp<GhostComponent>)
  aghost: false,
  collapsed: false,
  slow: false,
  nextPoll: 1,
  nextAsk: 0,
  sample: 0,
  polls: [],
  chat: [],
  // CMUSpaceGptGhostSystem._waiting: the poll events this ghost has, oldest first
  waiting: [],
});

let state = blank();
let stored = false;

function load() {
  try {
    const raw = localStorage.getItem(STORE);
    state = raw ? { ...blank(), ...JSON.parse(raw) } : blank();
    stored = !!raw;
  } catch {
    state = blank();
  }
}

function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify(state));
    stored = true;
  } catch {
    // this visit only
  }
}

/** The emulator's Reset wipes every extranet-emulator- key: forget the simulator with it. */
function noticeReset() {
  if (!stored) return;
  let gone = false;
  try {
    gone = localStorage.getItem(STORE) === null;
  } catch {
    gone = false;
  }
  if (gone) {
    state = blank();
    stored = false;
    for (const widget of widgets) widget.reset();
    render();
  }
}

load();

const scale = () => (state.slow ? SLOW : 1);
/** HasComp<GhostComponent>(_player.LocalEntity): a ghost, or an admin ghost. */
const isGhost = (role = state.role, aghost = state.aghost) => role === 'ghost' || (role === 'admin' && aghost);
const pollById = id => state.polls.find(p => p.id === id) || null;

/** The emulator's card holder and terminal number, as the asker. */
function me() {
  let name = 'Alex Reyes';
  let terminal = 7;
  try {
    name = JSON.parse(localStorage.getItem('extranet-emulator-settings') || '{}').name || name;
  } catch {
    // default card
  }
  try {
    terminal = Number(sessionStorage.getItem('extranet-emulator-terminal')) || terminal;
  } catch {
    // default terminal
  }
  return { name, terminal };
}

/** The asker's pages listening on this computer (ICMUComputerHost.SpaceGptAnswered, SpaceGptHeld). */
const widgets = new Set();

/** _ui.ServerSendUiMessage(poll.Computer, ..., poll.Asker): only the emulator's own questions reach its pages. */
function toAsker(poll, message) {
  if (!poll.own) return;
  for (const widget of [...widgets]) {
    if (!widget.root.isConnected && widget.seen) {
      widgets.delete(widget);
      continue;
    }
    widget.receive(message);
  }
}

/** ChatMessageToMany(ChatChannel.Admin, ...): every admin gets it; the player sees it as admin. */
function toAdmins(key, args, links = []) {
  state.chat.push({ key, args, links, at: Date.now() });
  if (state.chat.length > 60) state.chat.splice(0, state.chat.length - 60);
}

function consoleError(text) {
  state.chat.push({ error: text, at: Date.now() });
}

const link = (label, command) => ({ label, command });

/** CMUSpaceGptSystem.OnAsk. Inside the cooldown the server drops the question without a word, as in game. */
function ask(question, asker, own) {
  const now = Date.now();
  if (own && now < state.nextAsk) return null;
  let text = question.trim().replace(/\n/g, ' ');
  if (!text) return null;
  if (text.length > QUESTION_LENGTH) text = text.slice(0, QUESTION_LENGTH);
  if (own) state.nextAsk = now + COOLDOWN;
  const id = state.nextPoll++;
  const poll = {
    id, own, asker: asker.name, terminal: asker.terminal, question: text,
    choices: [], ends: now + ADMIN_DELAY * scale(), state: 'waiting', left: 0, votes: {}, crowd: [],
  };
  state.polls.push(poll);
  spaceGptRoster().then(roster => {
    poll.choices = shuffle(roster).slice(0, CHOICES);
    save();
  });
  toAdmins('cmu-spacegpt-admin-asked', { name: asker.name, terminal: asker.terminal, question: text }, [
    link('cmu-spacegpt-admin-options', `spacegpt options ${id}`),
    link('cmu-spacegpt-admin-follow', `tpto ${asker.terminal}`),
    link('cmu-spacegpt-admin-hold', `spacegpt hold ${id}`),
    link('cmu-spacegpt-admin-deny', `spacegpt deny ${id}`),
  ]);
  save();
  render();
  return poll;
}

/**
 * Other ghosts, a few of them: each votes once, somewhere in the vote. In game every ghost on the server can; here a
 * crowd of nought to three makes the tally.
 */
function planCrowd(poll) {
  const left = poll.ends - Date.now();
  const n = Math.floor(Math.random() * 4);
  poll.crowd = [];
  for (let i = 0; i < n; i++) poll.crowd.push({ who: `ghost-${i}`, at: Date.now() + Math.random() * left * 0.9, choice: -1 });
}

/** StartVoting: to the ghosts, for the time left on it. */
function startVoting(poll, left = 0) {
  poll.state = 'voting';
  poll.ends = Date.now() + (left > 0 ? left : VOTING * scale());
  planCrowd(poll);
  onPollEvent({ poll: poll.id, question: poll.question, answers: [...poll.choices], ends: poll.ends, terminal: poll.terminal, asker: poll.asker, own: poll.own });
}

/** Hold: back from the ghosts, or its vote frozen; the asker sees SpaceGPT stall. */
function hold(id, admin) {
  const poll = pollById(id);
  if (!poll || poll.state === 'held') return false;
  if (poll.state === 'voting') {
    poll.left = poll.ends - Date.now();
    onCancelEvent(id);
  } else {
    poll.left = 0;
  }
  poll.state = 'held';
  toAsker(poll, { held: true });
  toAdmins('cmu-spacegpt-admin-held', { admin, id }, [
    link('cmu-spacegpt-admin-release', `spacegpt release ${id}`),
    link('cmu-spacegpt-admin-deny', `spacegpt deny ${id}`),
  ]);
  return true;
}

/** Release: to the ghosts, with what was left of its vote. */
function release(id, admin) {
  const poll = pollById(id);
  if (!poll || poll.state !== 'held') return false;
  toAsker(poll, { held: false });
  startVoting(poll, poll.left > 0 ? poll.left : 0);
  toAdmins('cmu-spacegpt-admin-released', { admin, id });
  return true;
}

/** SetOptions: new answers for the ghosts, then let it go. */
function setOptions(id, options, admin) {
  const poll = pollById(id);
  if (!poll) return false;
  const cleaned = options.map(o => o.trim().replace(/\n/g, ' ')).filter(o => o.length > 0)
    .map(o => (o.length > ANSWER_LENGTH ? o.slice(0, ANSWER_LENGTH) : o)).slice(0, CHOICES);
  if (!cleaned.length) return false;
  poll.choices = cleaned;
  poll.votes = {};
  if (poll.state === 'held') release(id, admin);
  else if (poll.state === 'voting') startVoting(poll, poll.ends - Date.now());
  return true;
}

/** Deny: SpaceGPT's safeties answer instead of the ghosts. */
function deny(id, admin) {
  const poll = pollById(id);
  if (!poll) return false;
  state.polls = state.polls.filter(p => p !== poll);
  onCancelEvent(id);
  toAsker(poll, { held: false });
  toAsker(poll, { question: poll.question, answer: t('cmu-spacegpt-denied'), votes: -1 });
  toAdmins('cmu-spacegpt-admin-denied', { admin, id });
  return true;
}

/** Answer: the most voted, a tie drawn at random; nobody voting leaves it to chance with no votes. */
function answer(poll) {
  const tally = poll.choices.map(() => 0);
  for (const vote of Object.values(poll.votes)) if (vote >= 0 && vote < tally.length) tally[vote]++;
  const best = tally.length ? Math.max(...tally) : 0;
  const winners = tally.map((n, i) => (n === best ? i : -1)).filter(i => i >= 0);
  const choice = poll.choices[winners[Math.floor(Math.random() * winners.length)]] ?? FALLBACK_ANSWERS[0];
  toAsker(poll, { question: poll.question, answer: choice, votes: best });
}

/** OnVote: ghosts only, while it is being voted on. */
function vote(id, choice, who) {
  const poll = pollById(id);
  if (!poll || poll.state !== 'voting' || choice < 0 || choice >= poll.choices.length) return;
  if (who === 'you' && !isGhost()) return;
  poll.votes[who] = choice;
}

/** CMUSpaceGptCommand.Execute, run from the links in admin chat. tpto is the engine's; here it says where. */
function run(command) {
  const args = command.trim().split(/\s+/);
  if (args[0] === 'tpto') {
    const terminal = Number(args[1]);
    const poll = state.polls.find(p => p.terminal === terminal);
    toast(terminal === me().terminal
      ? `Teleported to terminal #${terminal}: the one this emulator is.`
      : `Teleported to terminal #${terminal}${poll ? `, ${poll.asker} at it` : ''}.`);
    return;
  }
  const id = Number(args[2]);
  let done = false;
  switch (args[1]) {
    case 'hold': done = hold(id, ADMIN_NAME); break;
    case 'release': done = release(id, ADMIN_NAME); break;
    case 'deny': done = deny(id, ADMIN_NAME); break;
    case 'options':
      // OpenOptions: held while the admin rewrites, so the ghosts never see the old answers
      if (pollById(id)) {
        hold(id, ADMIN_NAME);
        editing = id;
        done = true;
      }
      break;
    default: break;
  }
  if (!done) consoleError(t('cmu-cmd-spacegpt-gone', { id }));
  save();
  render();
}

/** Update: held ones wait, waiting ones go to the ghosts, voted ones are answered. */
function tick() {
  noticeReset();
  const now = Date.now();
  let changed = false;
  for (const poll of [...state.polls]) {
    if (poll.state === 'voting') {
      for (const ghost of poll.crowd) {
        if (ghost.choice < 0 && now >= ghost.at && poll.choices.length) {
          ghost.choice = Math.floor(Math.random() * poll.choices.length);
          vote(poll.id, ghost.choice, ghost.who);
          changed = true;
        }
      }
    }
    if (poll.state === 'held' || now < poll.ends || !poll.choices.length) continue;
    changed = true;
    if (poll.state === 'waiting') {
      startVoting(poll);
      continue;
    }
    state.polls = state.polls.filter(p => p !== poll);
    onCancelEvent(poll.id);
    answer(poll);
  }
  // the ghost's own list: questions whose vote ended go
  const before = state.waiting.length;
  state.waiting = state.waiting.filter(p => now < p.ends);
  if (state.waiting.length !== before) changed = true;
  if (changed) save();
  render();
}

let ticking = null;
function startTicking() {
  if (!ticking) ticking = setInterval(tick, 250);
}

// ---------------------------------------------------------------- the ghost's side (CMUSpaceGptGhostSystem)

/** OnPoll: only a ghost hears it (HasComp<GhostComponent>), and only while one. */
function onPollEvent(ev) {
  if (!isGhost()) return;
  state.waiting = state.waiting.filter(p => p.poll !== ev.poll);
  state.waiting.push(ev);
  ghostOpenAnswers.delete(ev.poll);
}

/** CMUSpaceGptCancelEvent, and Forget: answered, ignored, held, denied or over. */
function onCancelEvent(id) {
  state.waiting = state.waiting.filter(p => p.poll !== id);
  ghostOpenAnswers.delete(id);
}

function forget(id) {
  onCancelEvent(id);
  save();
  render();
}

function setRole(role, aghost = state.aghost) {
  if (state.role === role && state.aghost === aghost) return;
  // moving from ghost back into a body takes the questions away
  if (isGhost() && !isGhost(role, aghost)) state.waiting = [];
  state.role = role;
  state.aghost = aghost;
  if (!isGhost()) ghostWindow = false;
  if (role !== 'admin') editing = null;
  save();
  render();
}

/** Queues a few other colonists' questions: one fresh, one already held by another admin, one with the ghosts. */
function queueSamples() {
  for (let i = 0; i < 3; i++) {
    const sample = SAMPLES[state.sample++ % SAMPLES.length];
    const poll = ask(sample.question, sample, false);
    if (!poll) continue;
    spaceGptRoster().then(() => {
      if (!pollById(poll.id)) return;
      if (sample.held) hold(poll.id, 'Game Master');
      else if (sample.voting) startVoting(poll);
      save();
      render();
    });
  }
}

function resetSim() {
  for (const poll of state.polls) toAsker(poll, { held: false });
  const { role, aghost, collapsed } = state;
  state = blank();
  Object.assign(state, { role, aghost, collapsed });
  editing = null;
  ghostWindow = false;
  save();
  for (const widget of widgets) widget.reset();
  render();
}

// ---------------------------------------------------------------- the overlays over the emulator

const CSS = `
.sgpt-layer{position:absolute;inset:48px 0 0 0;pointer-events:none;z-index:50;font:13px/1.35 "Noto Sans",system-ui,sans-serif;color:#e8e8ea}
.sgpt-layer > *{pointer-events:auto}
.sgpt-dock{position:absolute;right:12px;bottom:12px;width:300px;background:var(--surface,#111215);border-radius:10px;
  box-shadow:0 8px 30px rgba(0,0,0,.5),inset 0 0 0 1px var(--hair-2,rgba(255,255,255,.1));padding:10px;display:flex;flex-direction:column;gap:8px;
  font:12px var(--font,system-ui);color:var(--text,#e8e9eb)}
.sgpt-dock-head{display:flex;align-items:center;gap:6px;font-weight:600}
.sgpt-dock-head span{flex:1}
.sgpt-dock-note{color:var(--text-3,#686d75);font-size:11px;line-height:1.35}
.sgpt-seg{display:flex;gap:4px}
.sgpt-seg .btn{flex:1}
.sgpt-seg .btn.on{background:var(--accent,#b8e26a);color:var(--accent-ink,#11140b);font-weight:600}
.sgpt-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.sgpt-check{display:flex;align-items:center;gap:5px;color:var(--text-2,#a3a7ae);cursor:pointer}
.sgpt-polls{display:flex;flex-direction:column;gap:3px;max-height:120px;overflow:auto}
.sgpt-poll{display:flex;gap:6px;font-size:11px;color:var(--text-2,#a3a7ae)}
.sgpt-poll b{color:var(--text,#e8e9eb);font-weight:600;white-space:nowrap}
.sgpt-poll i{font-style:normal;white-space:nowrap;margin-left:auto}
.sgpt-poll span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.sgpt-chat{position:absolute;left:12px;bottom:12px;width:min(560px,calc(100% - 340px));max-height:42%;display:flex;flex-direction:column;
  background:rgba(25,25,30,.92);border:1px solid #3a3a44;box-shadow:0 6px 24px rgba(0,0,0,.5)}
.sgpt-chat-tabs{display:flex;gap:2px;background:#1b1b1e;border-bottom:1px solid #3a3a44;padding:3px 4px}
.sgpt-chat-tab{background:#464966;color:#fff;font-size:12px;padding:1px 8px}
.sgpt-chat-log{overflow-y:auto;padding:4px 6px;display:flex;flex-direction:column;gap:2px;min-height:60px}
.sgpt-chat-line{color:#ff0000;white-space:pre-wrap;overflow-wrap:anywhere}
.sgpt-chat-line .sgpt-cmd{color:#ff0000;text-decoration:underline;cursor:pointer;font-weight:bold}
.sgpt-chat-line .sgpt-cmd:hover{color:#ff8080}
.sgpt-chat-err{color:#ff6b6b;font-family:monospace;font-size:12px}
.sgpt-chat-empty{color:#8a8a96;font-style:italic}
.sgpt-win{position:absolute;background:#25252a;border:1px solid #3a3a44;box-shadow:0 10px 30px rgba(0,0,0,.6);display:flex;flex-direction:column}
.sgpt-win-bar{display:flex;align-items:center;background:#1b1b1e;padding:4px 4px 4px 8px;border-bottom:2px solid #3e6c45;font-weight:bold;color:#c9c9d3}
.sgpt-win-bar span{flex:1}
.sgpt-win-x{background:transparent;border:0;color:#c9c9d3;font:bold 14px sans-serif;cursor:pointer;padding:0 6px}
.sgpt-win-x:hover{color:#fff}
.sgpt-win-body{padding:8px;display:flex;flex-direction:column;overflow:auto}
.sgpt-btn{background:#464966;color:#fff;border:0;padding:4px 8px;font:inherit;cursor:pointer;text-align:center;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;min-width:0}
.sgpt-btn:hover{background:#575b7f}
.sgpt-btn:active{background:#3e6c45}
.sgpt-edit{background:#1b1b1e;border:1px solid #3a3a44;color:#e8e8ea;padding:4px 6px;font:inherit;width:100%}
.sgpt-edit:focus{outline:1px solid #575b7f}
.sgpt-alert{position:absolute;top:8px;left:50%;transform:translateX(-50%);min-width:260px}
.sgpt-toast{position:absolute;top:44px;left:50%;transform:translateX(-50%);background:var(--surface,#111215);color:var(--text,#e8e9eb);
  font:12px var(--font,system-ui);padding:6px 12px;border-radius:8px;box-shadow:inset 0 0 0 1px var(--hair-2,rgba(255,255,255,.1)),0 6px 20px rgba(0,0,0,.5)}
`;

let layer = null;
let dockSeen = false;
let ghostWindow = false;
const ghostOpenAnswers = new Set();
/** The poll an admin has the options window open for (CMUSpaceGptOptionsEui). */
let editing = null;
let optionsDraft = null;
let toastTimer = null;
let toastText = '';
let chatStick = true;

function toast(text) {
  toastText = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastText = '';
    render();
  }, 3200);
  render();
}

/** The layer over the emulator, put back in whichever emulator is open now. */
function ensureLayer() {
  const host = document.querySelector('.emu');
  if (!host) return null;
  if (!layer) {
    layer = h('div', { class: 'sgpt-layer' });
    layer.append(h('style', { text: CSS }));
  }
  if (layer.parentNode !== host) host.append(layer);
  return layer;
}

/** Remembers the pieces of the layer so ticks only redraw what changed. */
const parts = {};

function piece(key, build) {
  if (!parts[key]) parts[key] = build();
  if (!parts[key].isConnected) layer.append(parts[key]);
  return parts[key];
}

function drop(key) {
  if (parts[key]) parts[key].remove();
}

function seconds(ms) {
  return Math.max(0, Math.ceil(ms / 1000));
}

function render() {
  if (!ensureLayer()) return;
  const visible = dockSeen || state.polls.length || state.role !== 'colonist';
  if (!visible) {
    for (const key of Object.keys(parts)) drop(key);
    return;
  }
  renderDock();
  if (state.role === 'admin') renderChat();
  else drop('chat');
  if (state.role === 'admin' && editing !== null) renderOptions();
  else drop('options');
  if (isGhost()) renderGhost();
  else {
    drop('alert');
    drop('ghost');
  }
  if (toastText) piece('toast', () => h('div', { class: 'sgpt-toast' })).textContent = toastText;
  else drop('toast');
}

function renderDock() {
  const dock = piece('dock', () => {
    const node = h('div', { class: 'sgpt-dock' });
    node.seg = h('div', { class: 'sgpt-seg' }, ROLES.map(role => h('button', {
      class: 'btn btn-small', type: 'button', 'data-role': role.id, 'data-tip': role.tip, title: role.tip, text: role.label,
      onclick: () => setRole(role.id),
    })));
    node.slow = h('input', { type: 'checkbox', onchange: () => {
      state.slow = node.slow.checked;
      save();
    } });
    node.polls = h('div', { class: 'sgpt-polls' });
    node.note = h('div', { class: 'sgpt-dock-note' });
    node.aghost = h('input', { type: 'checkbox', onchange: () => setRole(state.role, node.aghost.checked) });
    node.aghostRow = h('label', { class: 'sgpt-check', title: 'An admin observing as an admin ghost is a ghost too: they also get the ghosts\' questions' },
      node.aghost, h('span', { text: 'Admin ghost (aghost)' }));
    node.fold = h('button', { class: 'btn btn-small', type: 'button', title: 'Fold the simulator away, or open it', onclick: () => {
      state.collapsed = !state.collapsed;
      save();
      render();
    } });
    node.body = h('div', { style: 'display:flex;flex-direction:column;gap:8px' });
    node.append(
      h('div', { class: 'sgpt-dock-head' }, h('span', { text: 'SpaceGPT simulator' }),
        h('button', { class: 'btn btn-small', type: 'button', title: 'Clear the questions, admin chat and the ghost\'s list', text: 'Reset', onclick: resetSim }),
        node.fold),
      node.body);
    node.body.append(
      h('div', { class: 'sgpt-row' }, h('span', { style: 'color:var(--text-2,#a3a7ae)', text: 'Play as' })),
      node.seg,
      node.aghostRow,
      h('div', { class: 'sgpt-row' },
        h('button', { class: 'btn btn-small', type: 'button', title: 'Three other colonists ask at other terminals: one fresh, one held by another admin, one already with the ghosts', text: 'Queue sample questions', onclick: queueSamples }),
        h('label', { class: 'sgpt-check', title: `The admin delay and the vote last ${SLOW} times longer (the game: 5 s and 25 s)` }, node.slow, h('span', { text: 'Slow timers' }))),
      node.polls,
      node.note);
    return node;
  });
  dock.body.style.display = state.collapsed ? 'none' : 'flex';
  dock.style.width = state.collapsed ? 'auto' : '';
  dock.fold.textContent = state.collapsed ? 'Open' : 'Fold';
  dock.aghostRow.style.display = state.role === 'admin' ? 'flex' : 'none';
  dock.aghost.checked = state.aghost;
  for (const button of dock.seg.children) button.classList.toggle('on', button.dataset.role === state.role);
  dock.slow.checked = state.slow;
  const now = Date.now();
  const mine = me().terminal;
  dock.polls.replaceChildren(...(state.polls.length ? [...state.polls].reverse().map(p => h('div', { class: 'sgpt-poll' },
    h('b', { text: `#${p.id} ${p.own ? 'you' : p.asker}` }),
    h('span', { title: p.question, text: `"${p.question}"` }),
    h('i', { text: p.state === 'held' ? 'held' : p.state === 'waiting' ? `admins ${seconds(p.ends - now)}s` : `ghosts ${seconds(p.ends - now)}s` }),
  )) : [h('div', { class: 'sgpt-dock-note', text: 'No questions waiting.' })]));
  dock.note.textContent = {
    colonist: `You are at terminal #${mine}. Ask on spacegpt.ai, then switch to Admin within ${5 * scale()} s to hold it, or to Ghost to answer it.`,
    admin: state.aghost
      ? 'Admin chat shows each question first, and as an admin ghost you get the ghosts\' list too: hold or rewrite one, release it, then answer it.'
      : 'Admin chat shows each question first. Its links run the spacegpt command: Custom options holds it while you rewrite the answers.',
    ghost: 'Ghosts only get the questions sent to the ghosts while they are ghosts: switch first, or release one as admin.',
  }[state.role];
}

function renderChat() {
  const chat = piece('chat', () => {
    const node = h('div', { class: 'sgpt-chat' });
    node.log = h('div', { class: 'sgpt-chat-log' });
    node.log.addEventListener('scroll', () => {
      chatStick = node.log.scrollTop + node.log.clientHeight >= node.log.scrollHeight - 4;
    });
    node.append(h('div', { class: 'sgpt-chat-tabs' }, h('span', { class: 'sgpt-chat-tab', text: 'Admin' })), node.log);
    node.count = -1;
    return node;
  });
  if (chat.count === state.chat.length && chat.last === (state.chat[state.chat.length - 1] || {}).at) return;
  chat.count = state.chat.length;
  chat.last = (state.chat[state.chat.length - 1] || {}).at;
  const lines = state.chat.map(line => {
    if (line.error) return h('div', { class: 'sgpt-chat-err', text: line.error });
    const links = [];
    line.links.forEach((l, i) => {
      if (i) links.push(document.createTextNode(' '));
      links.push(h('span', { class: 'sgpt-cmd', title: l.command, text: t(l.label), onclick: () => run(l.command) }));
    });
    const message = t(line.key, { ...line.args, links: '\u0000' });
    const wrapped = t('chat-manager-send-admin-announcement-wrap-message', { adminChannelName: t('chat-manager-admin-channel-name'), message });
    return h('div', { class: 'sgpt-chat-line' }, markup(wrapped, links));
  });
  chat.log.replaceChildren(...(lines.length ? lines : [h('div', { class: 'sgpt-chat-empty', text: 'Nobody has asked SpaceGPT anything yet.' })]));
  if (chatStick) chat.log.scrollTop = chat.log.scrollHeight;
}

function windowFrame(title, onClose, style) {
  const body = h('div', { class: 'sgpt-win-body' });
  const titleNode = h('span', { text: title });
  const node = h('div', { class: 'sgpt-win', style },
    h('div', { class: 'sgpt-win-bar' }, titleNode, h('button', { class: 'sgpt-win-x', type: 'button', title: 'Close', text: '✕', onclick: onClose })),
    body);
  node.body = body;
  node.titleNode = titleNode;
  return node;
}

/** CMUSpaceGptOptionsEui: one line per answer, blank ones dropped; closing without saving leaves it held. */
function renderOptions() {
  const poll = pollById(editing);
  if (!poll) {
    // the question went (denied elsewhere): the server closes the EUI
    editing = null;
    drop('options');
    return;
  }
  if (parts.options && parts.options.poll === poll.id) return;
  drop('options');
  const close = () => {
    editing = null;
    optionsDraft = null;
    render();
  };
  const win = windowFrame(t('cmu-spacegpt-admin-options-title', { id: poll.id }), close,
    'left:50%;top:50%;transform:translate(-50%,-50%);min-width:420px;min-height:200px');
  win.poll = poll.id;
  const box = h('div', { style: 'display:flex;flex-direction:column;gap:4px' });
  box.append(h('div', { text: t('cmu-spacegpt-admin-options-asked', { name: poll.asker }) }));
  box.append(h('div', { style: 'color:#d3d3d3', text: `"${poll.question}"` }));
  optionsDraft = [];
  for (let i = 0; i < CHOICES; i++) {
    const line = h('input', { class: 'sgpt-edit', type: 'text', maxlength: String(ANSWER_LENGTH), placeholder: t('cmu-spacegpt-admin-options-blank') });
    line.value = poll.choices[i] || '';
    optionsDraft.push(line);
    box.append(line);
  }
  box.append(h('button', { class: 'sgpt-btn', type: 'button', text: t('cmu-spacegpt-admin-options-save'), onclick: () => {
    const id = poll.id;
    setOptions(id, optionsDraft.map(o => o.value), ADMIN_NAME);
    // the EUI closes on save, whether or not the answers took
    editing = null;
    optionsDraft = null;
    save();
    render();
  } }));
  win.body.append(box);
  parts.options = win;
  layer.append(win);
}

function renderGhost() {
  if (!state.waiting.length) {
    drop('alert');
    drop('ghost');
    ghostWindow = false;
    return;
  }
  const alert = piece('alert', () => h('button', { class: 'sgpt-btn sgpt-alert', type: 'button', onclick: () => {
    ghostWindow = true;
    render();
  } }));
  alert.textContent = state.waiting.length === 1 ? t('cmu-spacegpt-ghost-alert') : t('cmu-spacegpt-ghost-alert-many', { count: state.waiting.length });
  if (!ghostWindow) {
    drop('ghost');
    return;
  }
  const win = piece('ghost', () => {
    const node = windowFrame(t('cmu-spacegpt-ghost-title'), () => {
      ghostWindow = false;
      render();
    }, 'left:50%;top:50%;transform:translate(-50%,-50%);width:460px;height:420px;min-width:440px;min-height:200px');
    node.list = h('div', { style: 'display:flex;flex-direction:column;gap:10px' });
    node.body.append(node.list);
    node.key = '';
    return node;
  });
  win.titleNode.textContent = t('cmu-spacegpt-ghost-title');
  const key = state.waiting.map(p => `${p.poll}:${p.answers.join('|')}:${ghostOpenAnswers.has(p.poll)}`).join(',');
  if (win.key === key) return;
  win.key = key;
  // FillList: the intro, then every question waiting, newest at the top
  const entries = [h('div', { text: t('cmu-spacegpt-ghost-intro') })];
  for (let i = state.waiting.length - 1; i >= 0; i--) entries.push(ghostEntry(state.waiting[i]));
  win.list.replaceChildren(...entries);
}

/** Entry: what was asked, then ANSWER, IGNORE and FOLLOW; ANSWER opens its answers in place. */
function ghostEntry(poll) {
  const answers = h('div', { style: `display:${ghostOpenAnswers.has(poll.poll) ? 'flex' : 'none'};flex-direction:column;gap:4px` },
    poll.answers.map((text, choice) => h('button', { class: 'sgpt-btn', type: 'button', title: text, text, onclick: () => {
      vote(poll.poll, choice, 'you');
      forget(poll.poll);
    } })));
  const answer = h('button', { class: 'sgpt-btn', type: 'button', style: 'flex:1', text: t('cmu-spacegpt-ghost-answer'), onclick: () => {
    if (ghostOpenAnswers.has(poll.poll)) ghostOpenAnswers.delete(poll.poll);
    else ghostOpenAnswers.add(poll.poll);
    answers.style.display = ghostOpenAnswers.has(poll.poll) ? 'flex' : 'none';
    parts.ghost.key = '';
  } });
  const ignore = h('button', { class: 'sgpt-btn', type: 'button', style: 'flex:1', text: t('cmu-spacegpt-ghost-ignore'), onclick: () => forget(poll.poll) });
  const follow = h('button', { class: 'sgpt-btn', type: 'button', style: 'flex:1', text: t('cmu-spacegpt-ghost-follow'), onclick: () => {
    // GhostWarpToTargetRequestEvent(poll.Terminal)
    toast(poll.own ? `Warped to terminal #${poll.terminal}: the one this emulator is.` : `Warped to terminal #${poll.terminal}, ${poll.asker} at it.`);
  } });
  return h('div', { style: 'display:flex;flex-direction:column;gap:4px' },
    h('div', { style: 'white-space:pre-wrap;overflow-wrap:anywhere', text: `"${poll.question}"` }),
    h('div', { style: 'display:flex;gap:6px' }, answer, ignore, follow),
    answers);
}

// ---------------------------------------------------------------- the page tag (CMUNetSpaceGpt)

const TAG_CSS = `
.sgpt-tag{box-sizing:border-box;width:100%;max-width:560px;margin:6px 0;display:flex;flex-direction:column;gap:6px;
  color:var(--sgpt-text);font:inherit;line-height:1.35;text-align:left}
.sgpt-tag *{box-sizing:border-box}
.sgpt-tag-panel{background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.3);min-height:160px}
.sgpt-tag-log{min-height:160px;max-height:320px;overflow-y:auto;padding:6px 8px;display:flex;flex-direction:column;gap:4px}
.sgpt-tag-line{white-space:pre-wrap;overflow-wrap:anywhere}
.sgpt-tag-dim{color:#808080}
.sgpt-tag-row{display:flex;gap:6px;align-items:center}
.sgpt-tag-input{flex:1 1 auto;min-width:0;background:rgba(0,0,0,.45);color:var(--sgpt-text);border:1px solid rgba(255,255,255,.3);padding:4px 6px;font:inherit}
.sgpt-tag-input:focus{outline:1px solid var(--sgpt-link)}
.sgpt-tag-btn{background:rgba(255,255,255,.08);color:var(--sgpt-text);border:1px solid rgba(255,255,255,.35);padding:3px 10px;font:inherit;cursor:pointer;white-space:nowrap}
.sgpt-tag-btn:hover:not(:disabled){background:rgba(255,255,255,.16);border-color:var(--sgpt-link)}
.sgpt-tag-btn:disabled{opacity:.45;cursor:default}
`;

/**
 * The SpaceGPT chat, <CMUNetSpaceGpt/>: the asker's side. The question goes to the simulated server above; a hold
 * makes SpaceGPT stall, an answer or a denial comes back here.
 */
export function createSpaceGpt(options = {}) {
  loadStrings();
  spaceGptRoster();
  startTicking();
  noticeReset();
  const root = h('div', { class: 'sgpt-tag' });
  root.style.setProperty('--sgpt-text', options.text || '#d6e4f5');
  root.style.setProperty('--sgpt-link', options.link || '#f2c94c');
  const log = h('div', { class: 'sgpt-tag-log' });
  const input = h('input', { class: 'sgpt-tag-input', type: 'text', maxlength: String(QUESTION_LENGTH) });
  const askButton = h('button', { class: 'sgpt-tag-btn', type: 'button' });
  root.append(h('style', { text: TAG_CSS }), h('div', { class: 'sgpt-tag-panel' }, log), h('div', { class: 'sgpt-tag-row' }, input, askButton));

  const greeting = h('div', { class: 'sgpt-tag-line' });
  const line = (text, cls = '') => {
    const node = h('div', { class: `sgpt-tag-line ${cls}`, text });
    log.append(node);
    log.scrollTop = log.scrollHeight;
    return node;
  };

  const widget = {
    root, seen: false, waiting: false, held: false, thinking: null, stallAt: 0, stallLine: 0,
    reset() {
      this.waiting = false;
      this.held = false;
      if (this.thinking) this.thinking.remove();
      this.thinking = null;
      askButton.disabled = false;
    },
    /** OnHeld and OnAnswer. */
    receive(message) {
      if ('held' in message && !('answer' in message)) {
        this.held = message.held && this.waiting;
        this.stallAt = 0;
        if (!this.held && this.thinking) this.thinking.textContent = t('cmu-spacegpt-thinking');
        return;
      }
      this.waiting = false;
      this.held = false;
      askButton.disabled = false;
      if (this.thinking) this.thinking.remove();
      this.thinking = null;
      line(t('cmu-spacegpt-answer', { answer: message.answer }));
      line(message.votes > 0 ? t('cmu-spacegpt-votes', { votes: message.votes })
        : message.votes < 0 ? t('cmu-spacegpt-safeties') : t('cmu-spacegpt-no-votes'), 'sgpt-tag-dim');
    },
  };
  widgets.add(widget);

  /** Ask: once the question has gone, the page waits for whatever the server sends back. */
  const submit = () => {
    const text = input.value.trim();
    if (!text || widget.waiting) return;
    widget.waiting = true;
    askButton.disabled = true;
    input.value = '';
    line(t('cmu-spacegpt-you', { question: text }));
    widget.thinking = line(t('cmu-spacegpt-thinking'));
    ask(text, me(), true);
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') submit();
  });
  askButton.addEventListener('click', submit);

  // FrameUpdate: the stalling lines while held, and noticing the page went
  const frame = setInterval(() => {
    if (root.isConnected) {
      widget.seen = true;
    } else if (widget.seen) {
      clearInterval(frame);
      widgets.delete(widget);
      return;
    }
    if (!widget.held || !widget.thinking) return;
    const now = Date.now();
    if (now < widget.stallAt) return;
    widget.stallAt = now + STALL_EVERY;
    widget.thinking.textContent = t(STALLING[widget.stallLine++ % STALLING.length]);
  }, 200);

  const label = () => {
    input.placeholder = t('cmu-spacegpt-placeholder');
    askButton.textContent = t('cmu-spacegpt-ask');
    greeting.textContent = t('cmu-spacegpt-greeting');
  };
  label();
  log.append(greeting);
  loadStrings().then(label);
  dockSeen = true;
  // the layer goes over the emulator once the page is on screen
  requestAnimationFrame(() => render());
  return root;
}

/** For the console and tests: the simulator's state and its commands. */
export const spaceGptSim = {
  get state() {
    return state;
  },
  ask: (question, asker) => ask(question, asker || me(), !asker),
  run,
  setRole,
  queueSamples,
  reset: resetSim,
  tick,
};
