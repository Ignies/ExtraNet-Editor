// Consoles as programs (CMUComputerBridgeServerSystem, CMUComputerSessionSystem.OnOpenConsole): every computer on a
// colony map except the dropship consoles runs the PC OS, and its own window becomes a program on the desktop,
// named after the console. Opening it opens the console's own interface in a window of its own, outside the OS,
// the way using the console did before it ran the OS; it needs the machine on and a card in the reader, and goes
// when the machine is switched off or the session ends (CloseConsoleApps).
//
// The emulator draws the camera monitor's window (RMCCameraWindow: the camera list with its search, the camera
// view, and the camera map) for the colony's camera monitors, the Marshals' among them. The camera view has no
// world to show, so it shows the static of a feed with nothing behind it. The other consoles' windows belong to
// other systems (requisitions, departments, research, corporate affairs) and are shown as their console window
// with what it is for, not emulated.

import { el } from '../util.js';
import { colonyGrid, colonyMapView, tileFor } from './colonymap.js';

const AREAS = ['Colony Bar', 'Hydroponics', 'Engineering', 'Medbay Lobby', 'Cargo Bay', 'Dormitory B', 'Mining Office', 'Marshal Office', 'Security Post', 'Landing Pad', 'Administration'];

/** Each camera network's cameras, by the areas they watch (CameraNetworkReceiver.networks). */
const NETWORK_AREAS = {
  CMB: [0, 1, 2, 3, 4, 5, 6, 7, 9],
  GOVFOR: [0, 2, 4, 8, 9, 10],
  WEYU: [2, 4, 6, 9, 10],
};

/** What the other consoles' own windows are for, from their prototypes' descriptions. */
const PURPOSE = {
  department: 'Manages employees, salaries, and announcements for the { $department } department.',
  corporate: 'A Weyland-Yutani corporate affairs terminal for managing transit tariffs and corporate support operations.',
  requisitions: 'A console for the Automated Storage Retrieval System.',
  research: 'A terminal for accessing research data.',
};

const STRINGS = {
  'rmc-camera-ui-tab-list': 'List',
  'rmc-camera-ui-tab-map': 'Map',
  'rmc-camera-ui-map-empty': 'No accessible camera map markers',
  'rmc-camera-editor-manage': 'Manage networks',
  'surveillance-camera-monitor-ui-refresh-subnets': 'Refresh subnets',
  'surveillance-camera-monitor-ui-disconnect': 'Disconnect',
  'surveillance-camera-monitor-ui-legend-active': 'Active',
  'surveillance-camera-monitor-ui-legend-inactive': 'Inactive',
  'surveillance-camera-monitor-ui-legend-selected': 'Selected',
  'surveillance-camera-monitor-ui-legend-invalid': 'Invalid',
};

function t(id, vars = {}) {
  return (STRINGS[id] || PURPOSE[id] || id).replace(/\{\s*\$(\w+)\s*\}/g, (m, k) => (k in vars ? vars[k] : m));
}

/** An engine window (DefaultWindow): its title bar with the close button, dragged by the bar. */
function engineWindow(overlay, title, body, [w, h], onClose) {
  const close = el('button.emu-con-close', { type: 'button', title: 'Close', 'aria-label': 'Close', text: '×' });
  const bar = el('div.emu-con-bar', {}, el('span.emu-con-title', { text: title }), close);
  const win = el('div.emu-con', { role: 'dialog', 'aria-label': title }, bar, el('div.emu-con-body', {}, body));
  const box = overlay.getBoundingClientRect();
  const width = Math.min(w, box.width - 24);
  const height = Math.min(h, box.height - 24);
  const count = overlay.querySelectorAll('.emu-con').length;
  Object.assign(win.style, {
    width: `${width}px`, height: `${height}px`,
    left: `${Math.max(8, (box.width - width) / 2 + count * 24)}px`, top: `${Math.max(8, (box.height - height) / 2 + count * 24)}px`,
  });
  const front = () => {
    let z = 10;
    for (const other of overlay.querySelectorAll('.emu-con, .emu-paper')) z = Math.max(z, Number(other.style.zIndex) || 10);
    win.style.zIndex = String(z + 1);
  };
  win.addEventListener('pointerdown', front);
  front();
  close.addEventListener('click', () => {
    win.remove();
    if (onClose) onClose();
  });
  bar.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    const start = { x: e.clientX, y: e.clientY, left: win.offsetLeft, top: win.offsetTop };
    bar.setPointerCapture(e.pointerId);
    const move = ev => {
      win.style.left = `${start.left + ev.clientX - start.x}px`;
      win.style.top = `${Math.max(0, start.top + ev.clientY - start.y)}px`;
    };
    const up = () => {
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', up);
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
  });
  overlay.append(win);
  return win;
}

/** A feed with nothing behind it: moving static, the camera's name and the time over it. */
function staticFeed(canvas, label) {
  const ctx = canvas.getContext('2d');
  let frame = 0;
  const step = () => {
    if (!canvas.isConnected && frame > 2) return;
    frame++;
    const w = canvas.width = 160;
    const h = canvas.height = 120;
    const image = ctx.createImageData(w, h);
    for (let i = 0; i < image.data.length; i += 4) {
      const v = 20 + Math.random() * 70;
      image.data[i] = v;
      image.data[i + 1] = v;
      image.data[i + 2] = v + 8;
      image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '8px monospace';
    ctx.fillText(label(), 4, 10);
    setTimeout(() => requestAnimationFrame(step), 90);
  };
  step();
}

/** RMCCameraWindow: the camera list with its search, the camera's view, and the camera map. */
function cameraWindow(app, ctx) {
  const areas = (NETWORK_AREAS[app.network] || NETWORK_AREAS.CMB).map(i => AREAS[i]);
  const grid = colonyGrid(ctx.colony, AREAS);
  const cameras = areas.map((area, i) => ({ name: `${area} camera`, area, ...tileFor(grid, { room: AREAS.indexOf(area), seed: i + 3 }) }));
  let active = null;
  const search = el('input.emu-con-field', { placeholder: 'Search for a camera' });
  const list = el('div.emu-con-list');
  const name = el('span.emu-con-camname');
  const disconnect = el('button.emu-con-btn', { type: 'button', text: t('surveillance-camera-monitor-ui-disconnect') });
  const prev = el('button.emu-con-btn', { type: 'button', text: '<' });
  const next = el('button.emu-con-btn', { type: 'button', text: '>' });
  const network = el('select.emu-con-field.emu-con-select', {}, el('option', { text: `${app.network || 'CMB'} cameras` }));
  const feed = el('canvas.emu-con-feed');
  const view = el('div.emu-con-view', {}, feed);
  const clock = () => new Date().toTimeString().slice(0, 8);
  staticFeed(feed, () => (active ? `${active.name.toUpperCase()}  ${clock()}` : 'NO SIGNAL'));
  const pick = camera => {
    active = camera;
    name.textContent = camera ? camera.name : '';
    disconnect.disabled = !camera;
    draw();
    mapView.redraw && redrawMap();
  };
  const draw = () => {
    const filter = search.value.trim().toLowerCase();
    list.replaceChildren(...cameras.filter(c => !filter || c.name.toLowerCase().includes(filter)).map(c => {
      const button = el('button.emu-con-btn.emu-con-cam', { type: 'button', text: c.name, onclick: () => pick(c) });
      button.classList.toggle('on', c === active);
      return button;
    }));
  };
  search.addEventListener('input', draw);
  disconnect.addEventListener('click', () => pick(null));
  prev.addEventListener('click', () => pick(cameras[(cameras.indexOf(active) - 1 + cameras.length) % cameras.length]));
  next.addEventListener('click', () => pick(cameras[(cameras.indexOf(active) + 1) % cameras.length]));
  const listTab = el('div.emu-con-tab.emu-con-listtab', {},
    el('div.emu-con-left', {}, search, list),
    el('div.emu-con-right', {},
      el('div.emu-con-row', {}, name, network,
        el('button.emu-con-btn', { type: 'button', text: t('surveillance-camera-monitor-ui-refresh-subnets') }),
        disconnect,
        el('button.emu-con-btn', { type: 'button', text: t('rmc-camera-editor-manage') }),
        prev, next),
      view));
  // the camera map: grey for a camera, yellow for the one being watched
  const pins = () => cameras.map(c => ({ x: c.x, y: c.y, colour: c === active ? '#FFFF00' : '#808080', flagged: false, title: c.name, camera: c }));
  let mapView = colonyMapView({ grid, pins: pins(), background: 'background', onPick: pin => pick(pin.camera), height: 300 });
  const mapHolder = el('div.emu-con-maphold', {}, mapView);
  const redrawMap = () => {
    const fresh = colonyMapView({ grid, pins: pins(), background: 'background', onPick: pin => pick(pin.camera), height: 300 });
    mapHolder.replaceChildren(fresh);
    mapView = fresh;
  };
  const legend = el('div.emu-con-legend', {},
    el('span', { style: 'color:#ff00ff', text: '▲' }), el('span', { text: t('surveillance-camera-monitor-ui-legend-active') }),
    el('span', { style: 'color:#ffff00', text: '▲' }), el('span', { text: t('surveillance-camera-monitor-ui-legend-selected') }),
    el('span', { style: 'color:#808080', text: '●' }), el('span', { text: t('surveillance-camera-monitor-ui-legend-inactive') }),
    el('span', { style: 'color:#ff0000', text: '●' }), el('span', { text: t('surveillance-camera-monitor-ui-legend-invalid') }));
  const mapTab = el('div.emu-con-tab', {}, mapHolder, legend);
  mapTab.hidden = true;
  const tabList = el('button.emu-con-tabbtn.on', { type: 'button', text: t('rmc-camera-ui-tab-list') });
  const tabMap = el('button.emu-con-tabbtn', { type: 'button', text: t('rmc-camera-ui-tab-map') });
  tabList.addEventListener('click', () => {
    listTab.hidden = false;
    mapTab.hidden = true;
    tabList.classList.add('on');
    tabMap.classList.remove('on');
  });
  tabMap.addEventListener('click', () => {
    listTab.hidden = true;
    mapTab.hidden = false;
    tabMap.classList.add('on');
    tabList.classList.remove('on');
    redrawMap();
  });
  draw();
  pick(null);
  return el('div.emu-con-cameras', {}, el('div.emu-con-tabs', {}, tabList, tabMap), listTab, mapTab);
}

function otherWindow(app, machine) {
  return el('div.emu-con-other', {},
    el('div.emu-con-strong', { text: machine.name }),
    el('div', { text: t(app.kind, { department: app.department || '' }) }),
    el('div.emu-con-dim', { text: 'In game this is the console\'s own window, opened from its program on the desktop. It belongs to another system, so the emulator shows only that it opens.' }));
}

/**
 * The console's programs for a machine: [{ name, open() }]. ctx: { overlay, colony, allowed() }: allowed says
 * whether the console will open now (the machine on, a card in the reader).
 */
export function consolePrograms(machine, ctx) {
  const opened = new Set();
  const programs = (machine.apps || []).map(app => ({
    name: machine.name,
    open() {
      if (ctx.allowed && !ctx.allowed()) return;
      // the console's window, once: a second press brings it to the front
      for (const win of opened) {
        if (win.isConnected && win.dataset.kind === app.kind) {
          win.dispatchEvent(new PointerEvent('pointerdown'));
          return;
        }
      }
      const cameras = app.kind === 'cameras';
      const title = cameras ? 'Ship Security Cameras' : machine.name;
      const body = cameras ? cameraWindow(app, ctx) : otherWindow(app, machine);
      const win = engineWindow(ctx.overlay, title, body, cameras ? [900, 560] : [420, 220], () => opened.delete(win));
      win.dataset.kind = app.kind;
      opened.add(win);
    },
  }));
  return {
    programs,
    /** CloseConsoleApps: the machine went off or the session ended. */
    closeAll() {
      for (const win of opened) win.remove();
      opened.clear();
    },
  };
}
