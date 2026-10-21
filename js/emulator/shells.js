// The desktop shells added after the first three (CMUComputerShellStyle and its four shells): each lays out the
// desktop's parts its own way, frames its windows and draws its icons, and the same icons open the same programs
// in the same windows whatever the shell.
// - Tactical (CMUTacticalShell): the crest and force across the top, the programs on function keys under it, a
//   status column down the right, bracket cornered windows, and a command prompt along the bottom.
// - Ministry (CMUMinistryShell): a filled banner with the crest, the state's name and its motto between marks, the
//   programs as directorate tabs with the session's buttons at the end, double framed windows, and a directive
//   line along the bottom that cycles the OS's notices.
// - Clinical (CMUClinicalShell): a slim bar along the top with the logo, the product, the open programs and the
//   clock, a soft gradient, and a floating dock of round program buttons with the menu at its end. Its labels keep
//   their case.
// - Police (CMUPoliceShell): the badge and agency over a police checker, case file navigation down the left with
//   the session's buttons under it, windows with the agency's stripe down their side, and a ticker of notices.
// The frames, icons and backgrounds are drawn by css/emulator.css (.emu-shell-<name>); this lays the parts out.
//
// The shells read a few strings the game's locale does not have yet (cmu-os-shell-status and the rest): the game
// would show their ids; the emulator shows the English below until the locale has them.

import { el } from '../util.js';
import { L } from './data.js';

const FALLBACK = {
  'cmu-os-shell-status': 'STATUS',
  'cmu-os-shell-field-terminal': 'TERMINAL',
  'cmu-os-shell-field-user': 'USER',
  'cmu-os-shell-field-role': 'ROLE',
  'cmu-os-shell-field-network': 'NETWORK',
  'cmu-os-shell-network-up': 'ONLINE',
  'cmu-os-shell-network-down': 'NO CARRIER',
  'cmu-os-shell-menu': 'Menu',
  'cmu-os-shell-case-files': 'CASE FILES',
  'cmu-os-shell-officer': 'OFFICER: { $name }',
  'cmu-os-shell-terminal': 'TERMINAL #{ $id }',
};

/** How long each notice stays on the Ministry's directive line. */
const NOTICE_SECONDS = 7;

function say(strings, id, vars) {
  return L(strings[id] === undefined ? FALLBACK : strings, id, vars);
}

const upper = text => text.toUpperCase();

/** The header's logo (CMUComputerShellStyle.Logo): the OS's first logo image, fitted to the bar; none without one. */
function logo(desktop, height, minWidth) {
  const img = desktop.logo('.emu-shell-logo', [minWidth, height / 2], height);
  return img;
}

/** Runs a frame update for as long as the desktop is on screen. */
function every(desktop, ms, update) {
  let attached = false;
  const step = () => {
    if (!desktop.root.isConnected && attached) return;
    if (desktop.root.isConnected) attached = true;
    update();
    setTimeout(step, ms);
  };
  step();
}

function field(name, value) {
  return el('div.emu-tc-field', {}, el('div.emu-shell-small.emu-dim', { text: name }), el('div.emu-tc-value', { text: value }));
}

const STYLES = {
  tactical: {
    hasStartMenu: false,
    singleClick: true,
    labelLength: 11,
    windowOffset: 14,
    fonts: ['Mono'],
    icon: 'emu-fkey',
    watermark: theme => (theme.shellTitle || theme.name).toUpperCase(),
    build(d) {
      const { theme } = d;
      const s = id => say(d.strings, id);
      const title = theme.shellTitle || theme.name.toUpperCase();
      const header = el('div.emu-tc-header', {},
        logo(d, 28, 48),
        el('div.emu-tc-force', {},
          el('div.emu-tc-title', { text: title }),
          el('div.emu-shell-small.emu-dim', { text: theme.shellSubtitle || '' })),
        d.clock);
      const network = el('div.emu-tc-value');
      const status = el('div.emu-tc-status', {},
        el('div.emu-tc-heading', { text: s('cmu-os-shell-status') }),
        el('div.emu-tc-rule'),
        field(s('cmu-os-shell-field-terminal'), `#${d.ctx.terminal}`),
        field(s('cmu-os-shell-field-user'), d.ctx.guest ? '-' : (d.ctx.user.name || '-').toUpperCase()),
        field(s('cmu-os-shell-field-role'), d.ctx.guest ? '-' : (d.ctx.user.job || '-').toUpperCase()),
        el('div.emu-shell-small.emu-dim', { text: s('cmu-os-shell-field-network') }),
        network,
        el('div.emu-tc-spacer'),
        ...d.sessionButtons());
      const prompt = el('span.emu-tc-prompt');
      d.root.append(
        header,
        el('div.emu-tc-keys', {}, d.icons),
        el('div.emu-tc-rule'),
        el('div.emu-shell-main', {}, d.area, el('div.emu-tc-column', {}, status)),
        el('div.emu-rule'),
        el('div.emu-tc-bottom', {}, prompt, d.tasks));
      let blink = 0;
      every(d, 100, () => {
        blink += 0.1;
        const line = theme.shellStatus ? L(d.strings, theme.shellStatus, { id: d.ctx.terminal }) : '';
        prompt.textContent = `> ${line}${blink % 1 < 0.55 ? '_' : ' '}`;
        // the carrier: a PC tuned dark is off the colony network
        const carrier = d.ctx.carrier ? d.ctx.carrier() : true;
        network.textContent = s(carrier ? 'cmu-os-shell-network-up' : 'cmu-os-shell-network-down');
        network.classList.toggle('emu-tc-down', !carrier);
      });
    },
  },

  ministry: {
    hasStartMenu: false,
    singleClick: true,
    labelLength: 12,
    windowOffset: 14,
    fonts: ['Display'],
    icon: 'emu-dtab',
    watermark: theme => (theme.shellTitle || theme.name).toUpperCase(),
    build(d) {
      const { theme } = d;
      const mark = theme.shellMark || '*';
      const banner = el('div.emu-mn-banner', {},
        logo(d, 30, 40),
        el('div.emu-mn-words', {},
          el('div.emu-mn-title', { text: (theme.shellTitle || theme.name).toUpperCase() }),
          theme.shellSubtitle ? el('div.emu-shell-small.emu-mn-motto', { text: `${mark}  ${theme.shellSubtitle}  ${mark}` }) : null));
      const tabs = el('div.emu-mn-tabs', {}, el('div.emu-mn-scroll', {}, d.icons), ...d.sessionButtons());
      const directive = el('span.emu-shell-small.emu-mn-directive');
      d.root.append(
        el('div.emu-mn-band', {}, banner),
        el('div.emu-mn-rule'),
        el('div.emu-mn-tabbar', {}, tabs),
        d.area,
        el('div.emu-mn-bottom', {}, directive, d.tasks, d.clock));
      const started = performance.now();
      every(d, 500, () => {
        const notices = theme.shellTicker;
        const time = (performance.now() - started) / 1000;
        directive.textContent = notices.length
          ? L(d.strings, notices[Math.floor(time / NOTICE_SECONDS) % notices.length], { id: d.ctx.terminal })
          : (theme.shellStatus ? L(d.strings, theme.shellStatus, { id: d.ctx.terminal }) : '');
      });
    },
  },

  clinical: {
    hasStartMenu: true,
    singleClick: true,
    labelLength: 10,
    windowOffset: 40,
    fonts: ['Sans'],
    icon: 'emu-round',
    letter: text => text,
    watermark: theme => theme.shellTitle || theme.name,
    build(d) {
      const { theme } = d;
      const menu = el('button.emu-btn.emu-cl-menu', { type: 'button', text: say(d.strings, 'cmu-os-shell-menu'), onclick: e => {
        e.stopPropagation();
        d.toggleStartMenu();
      } });
      d.root.append(
        el('div.emu-cl-bar', {}, logo(d, 18, 40), el('span.emu-cl-product', { text: theme.shellTitle || theme.name }), d.tasks, d.clock),
        d.area,
        el('div.emu-cl-gap'),
        el('div.emu-cl-dock', {}, el('div.emu-cl-scroll', {}, d.icons), menu),
        el('div.emu-cl-gap.emu-cl-gap-low'));
    },
  },

  police: {
    hasStartMenu: false,
    singleClick: true,
    labelLength: 15,
    windowOffset: 14,
    fonts: ['Display'],
    icon: 'emu-case',
    watermark: theme => theme.name,
    build(d) {
      const { theme } = d;
      const header = el('div.emu-pl-header', {},
        logo(d, 30, 48),
        el('div.emu-pl-agency', {},
          el('div.emu-pl-title', { text: (theme.shellTitle || theme.name).toUpperCase() }),
          el('div.emu-shell-small.emu-dim', { text: theme.shellSubtitle || '' })),
        el('div.emu-pl-right', {}, d.clock, el('div.emu-shell-small.emu-dim', { text: say(d.strings, 'cmu-os-shell-terminal', { id: d.ctx.terminal }) })));
      const nav = el('div.emu-pl-nav', {},
        el('div.emu-shell-small.emu-dim', { text: say(d.strings, 'cmu-os-shell-case-files') }),
        el('div.emu-pl-scroll', {}, d.icons),
        el('div.emu-pl-rule'),
        d.ctx.guest ? null : el('div.emu-shell-small.emu-dim.emu-pl-officer', { text: say(d.strings, 'cmu-os-shell-officer', { name: d.ctx.user.name.toUpperCase() }) }),
        ...d.sessionButtons());
      const notices = theme.shellTicker.map(n => L(d.strings, n, { id: d.ctx.terminal }));
      const run = el('span.emu-pl-run', { text: notices.join('     ///     ') });
      const ticker = el('div.emu-pl-ticker', {}, run);
      d.root.append(
        el('div.emu-pl-band', {}, header),
        el('div.emu-pl-checker'),
        el('div.emu-shell-main', {}, el('div.emu-pl-column', {}, nav), d.area),
        el('div.emu-pl-tasks', {}, d.tasks),
        ticker);
      // right to left, 40 pixels a second, round and round
      const started = performance.now();
      const step = now => {
        if (!d.root.isConnected && d.attachedTicker) return;
        if (d.root.isConnected) d.attachedTicker = true;
        const width = ticker.clientWidth;
        const runWidth = run.offsetWidth;
        const loop = width + runWidth;
        if (loop > 0) run.style.transform = `translateX(${width - (((now - started) / 1000) * 40) % loop}px)`;
        requestAnimationFrame(step);
      };
      if (notices.length) requestAnimationFrame(step);
    },
  },
};

/** The shell's style, or null for the classic, Seegson and Weyland desktops, which the desktop lays out itself. */
export function shellStyle(shell) {
  const style = STYLES[String(shell || '').toLowerCase()];
  if (!style) return null;
  return { letter: upper, ...style };
}
