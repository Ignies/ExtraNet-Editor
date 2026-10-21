// The colony simulator's dock, on the left of the emulator: which colony terminal you sit at, your engineering skill,
// the access tuner on that terminal (retune it dark or back onto the colony network, or hack it into the deep), and
// the colony's terminals with what each is doing. Sit at the security desk to see the other side: the terminal map
// with a dark one flagged where it was last seen, and the unauthorized-use log (security.seegson.net).
//
// The game's popups for the tuner's user show over the screen (with the machine on) and on the dock's last line.
// The dock sits under the emulator's own windows (the tuner, consoles, paper), so it never covers them.

import { el } from '../../util.js';
import { L } from '../data.js';
import { machineById } from '../computers.js';
import {
  sim, seats, seatFor, terminal, location, status, setSeat, setSkill, setCollapsed, setHacked, resetSim, onChange,
  setSeatProbe, setOutcome, startRetune, startHack, mapTerminals, SKILLS, STATUS,
} from './colony.js';
import { openTuner } from './tuner.js';

const CSS = `
.sim-dock{position:absolute;left:12px;top:60px;z-index:19;width:280px;max-height:calc(100% - 72px);overflow:auto;
  background:var(--surface,#111215);border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.5),inset 0 0 0 1px var(--hair-2,rgba(255,255,255,.1));
  padding:10px;display:flex;flex-direction:column;gap:8px;font:12px var(--font,system-ui);color:var(--text,#e8e9eb)}
.sim-dock-head{display:flex;align-items:center;gap:6px;font-weight:600}
.sim-dock-head span{flex:1}
.sim-dock-body{display:flex;flex-direction:column;gap:8px}
.sim-dock-field{display:flex;align-items:center;gap:6px;color:var(--text-2,#a3a7ae)}
.sim-dock-field > span{width:44px;flex:none}
.sim-dock-field select{flex:1;min-width:0;padding:4px 8px}
.sim-dock-row{display:flex;gap:6px;flex-wrap:wrap}
.sim-dock-row .btn{flex:1}
.sim-dock-note{color:var(--text-3,#686d75);font-size:11px;line-height:1.35}
.sim-dock-said{color:var(--text-2,#a3a7ae);font-size:11px;line-height:1.35;min-height:1em}
.sim-dock-said.caution{color:#ff8080}
.sim-dock-seat{font-size:12px;line-height:1.35}
.sim-dock-list{display:flex;flex-direction:column;gap:2px}
.sim-dock-term{display:flex;gap:6px;font-size:11px;color:var(--text-2,#a3a7ae)}
.sim-dock-term b{color:var(--text,#e8e9eb);font-weight:600;white-space:nowrap;width:28px}
.sim-dock-term span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sim-dock-term i{font-style:normal;white-space:nowrap}
.sim-dock-term.you b::after{content:' *'}
`;

/** CMUNetSecurityPanel's status colours. */
const COLOURS = { Online: '#3FE05A', LoggedIn: '#8FC4FF', Off: '#6B7480', Unpowered: '#FFB000', Dark: '#E0303A', Hacked: '#C04CFF' };
const STATUS_TEXT = { Online: 'online', LoggedIn: 'logged in', Off: 'switched off', Unpowered: 'no power', Dark: 'OFFLINE' };

const SECURITY_SEAT = 'CMUPersonalDesktopSecurity';

let mounted = null;

/** Puts the dock on the emulator. emu: the Emulator (emulator.js). */
export function simDock(emu) {
  if (mounted && mounted.isConnected) mounted.remove();
  const strings = emu.data.strings;
  const t = (id, vars) => L(strings, id, vars);

  // How the seat the player sits at is doing, from the emulator itself.
  setSeatProbe(() => {
    if (!seatFor(emu.settings.machine)) return null;
    return { on: emu.state !== 'off', user: emu.state === 'on' && emu.cardIn ? emu.settings.name : null, guest: emu.state === 'on' && emu.guest, hacked: !!emu.settings.deep };
  });

  /**
   * The terminal reboots onto its new carrier, closing its screen for whoever was at it (SetDark), or comes up in
   * the deep (Solve): the emulator takes the new configuration and shows the session again, without a boot.
   */
  const refresh = async () => {
    await emu.configure();
    if (emu.state === 'on') {
      emu.quietLogin = true;
      emu.showSession();
    }
  };

  let said = '';
  let caution = false;
  const say = (text, isCaution = false) => {
    said = text;
    caution = isCaution;
    render();
  };

  // the screen a solve brings back up, which the popup waits for so it shows over the new session
  let refreshing = Promise.resolve();
  setOutcome({
    popup: ({ text, vars, caution: c }) => {
      const line = t(text, vars);
      refreshing.then(() => emu.popup(line, !!c));
      say(line, !!c);
    },
    done: ({ kind }) => {
      const seat = seatFor(emu.settings.machine);
      if (kind === 'hack') {
        emu.deepToggle.checked = true;
        if (seat) setHacked(seat.id, true);
      }
      refreshing = refresh().catch(() => {});
    },
  });

  /** Sits at a seat: its machine, as built, with its own OS (the colony's Seegson where it has none). */
  const sit = id => {
    const here = seatFor(emu.settings.machine);
    if (here) setHacked(here.id, !!emu.settings.deep);
    setSeat(id);
    const seat = terminal(id);
    const machine = machineById(seat.machine);
    emu.machineSelect.value = machine.id;
    emu.casingSelect.value = '';
    emu.osSelect.value = machine.os || 'CMUOsSeegson';
    emu.deepToggle.checked = !!seat.hacked;
    emu.reconfigure();
    render();
  };

  const seatSelect = el('select.input', { title: 'The colony terminal you sit at' });
  for (const seat of seats()) {
    seatSelect.append(el('option', { value: String(seat.id), text: `#${seat.id} ${location(seat)}: ${machineById(seat.machine).name}` }));
  }
  seatSelect.addEventListener('change', () => sit(Number(seatSelect.value)));
  const skillSelect = el('select.input', { title: "Your engineering skill (RMCSkillEngineer): the tuner needs 2; more gives a cleaner carrier, more time and a smaller board, and an expert's hack skips the dials" },
    ...SKILLS.map(([value, label]) => el('option', { value: String(value), text: label })));
  skillSelect.addEventListener('change', () => setSkill(Number(skillSelect.value)));

  const tune = (start, kind) => {
    const seat = seatFor(emu.settings.machine);
    if (!seat) return;
    const result = kind === 'hack' ? start(seat.id, sim().skill, !!emu.settings.deep) : start(seat.id, sim().skill);
    if (!result.ok) {
      if (result.popup) {
        const line = t(result.popup.text, result.popup.vars);
        emu.popup(line, !!result.popup.caution);
        say(line, !!result.popup.caution);
      }
      return;
    }
    say('');
    openTuner({ overlay: emu.overlay, strings, id: seat.id });
  };

  const retune = el('button.btn.btn-small', { type: 'button', onclick: () => tune(startRetune, 'retune') });
  const hack = el('button.btn.btn-small', { type: 'button', text: 'Hack terminal', title: "The access tuner's hack: lock the carrier, then route it to the core; solved, the terminal is in the deep (Deep web access). Security sees the port opened, unless the terminal is dark", onclick: () => tune(startHack, 'hack') });
  const security = el('button.btn.btn-small', { type: 'button', text: 'Security desk', title: 'Sit at the colony security desk: log in and its home page is the unauthorized-use log, its MAP tab the terminal map', onclick: () => {
    const desk = seats().find(s => s.machine === SECURITY_SEAT);
    if (desk) sit(desk.id);
  } });
  const sitDown = el('button.btn.btn-small', { type: 'button', text: 'Sit down', title: "Put this seat's machine in the bar", onclick: () => sit(sim().seat) });
  const seatLine = el('div.sim-dock-seat');
  const list = el('div.sim-dock-list');
  const saidLine = el('div.sim-dock-said');
  const note = el('div.sim-dock-note');
  const fold = el('button.btn.btn-small', { type: 'button', title: 'Fold the simulator away, or open it', onclick: () => {
    setCollapsed(!sim().collapsed);
    render();
  } });
  const reset = el('button.btn.btn-small', { type: 'button', text: 'Reset', title: "Start the colony's shift over: terminals back as they were, the log as it was, no lockouts", onclick: () => {
    resetSim();
    const here = seatFor(emu.settings.machine);
    if (here) setHacked(here.id, !!emu.settings.deep);
    say('');
    // the seat may be another terminal now, and no longer dark
    refreshing = refresh().catch(() => {});
  } });
  const body = el('div.sim-dock-body', {},
    el('label.sim-dock-field', {}, el('span', { text: 'Seat' }), seatSelect),
    el('label.sim-dock-field', {}, el('span', { text: 'Skill' }), skillSelect),
    seatLine,
    el('div.sim-dock-row', {}, retune, hack),
    el('div.sim-dock-row', {}, security, sitDown),
    saidLine,
    el('div.sim-dock-note', { text: 'Colony terminals (* your seat):' }),
    list,
    note);
  const root = el('div.sim-dock', {}, el('style', { text: CSS }),
    el('div.sim-dock-head', {}, el('span', { text: 'Colony simulator' }), reset, fold),
    body);

  function render() {
    const s = sim();
    seatSelect.value = String(s.seat);
    skillSelect.value = String(s.skill);
    body.style.display = s.collapsed ? 'none' : 'flex';
    root.style.width = s.collapsed ? 'auto' : '';
    fold.textContent = s.collapsed ? 'Open' : 'Fold';
    if (s.collapsed) return;
    const here = seatFor(emu.settings.machine);
    const seat = terminal(s.seat);
    sitDown.style.display = here ? 'none' : '';
    retune.disabled = !here;
    hack.disabled = !here;
    retune.textContent = seat && seat.dark ? 'Retune to colony' : 'Retune dark';
    retune.title = seat && seat.dark
      ? 'The access tuner: lock onto the colony carrier to put this terminal back on the colony network'
      : 'The access tuner: lock onto the colony carrier to take this terminal off the colony network (dark)';
    seatLine.textContent = here
      ? `Terminal #${here.id}, ${location(here)}: ${here.dark ? 'OFFLINE, tuned off the colony network' : 'on the colony network'}${emu.settings.deep ? ', in the deep' : ''}.`
      : `Not at your seat: the bar's computer is not #${seat.id}'s ${machineById(seat.machine).name}.`;
    saidLine.textContent = said;
    saidLine.classList.toggle('caution', caution);
    const flagged = new Map(mapTerminals().map(m => [m.id, m]));
    list.replaceChildren(...s.terminals.map(term => {
      const st = status(term);
      const seen = flagged.get(term.id);
      const hacked = seen && seen.hacked;
      const colour = st === STATUS.Dark ? COLOURS.Dark : hacked ? COLOURS.Hacked : COLOURS[st];
      return el(`div.sim-dock-term${term.id === s.seat ? '.you' : ''}`, {},
        el('b', { text: `#${term.id}` }),
        el('span', { text: `${location(term)}${term.user && st === STATUS.LoggedIn ? `, ${term.user}` : ''}`, title: machineById(term.machine).name }),
        el('i', { style: { color: colour }, text: `${hacked ? 'HACKED, ' : ''}${STATUS_TEXT[st]}` }));
    }));
    note.textContent = here && emu.theme.networks.includes('CMUNetSecurity')
      ? 'At the security desk: security.seegson.net lists the unauthorized use; its MAP tab shows every terminal, a dark one flagged where it was last seen.'
      : 'Retune a terminal dark, then sit at the Security desk to see it from the other side.';
  }

  const unsubscribe = onChange(render);
  emu.deepToggle.addEventListener('change', () => {
    const here = seatFor(emu.settings.machine);
    if (here) setHacked(here.id, emu.deepToggle.checked);
  });
  const timer = setInterval(() => {
    if (!root.isConnected) {
      clearInterval(timer);
      unsubscribe();
      return;
    }
    render();
  }, 1000);
  emu.root.append(root);
  mounted = root;
  render();
  return root;
}
