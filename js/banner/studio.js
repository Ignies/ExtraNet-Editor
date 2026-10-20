// Banner Studio: a canvas editor for site banners. Backgrounds, text layers with 3D effects, game sprites,
// dragging with handles and guides, a layer list, undo, and export into the package.

import { el, debounce, download } from '../util.js';
import { History } from '../history.js';
import { BACKGROUNDS, getBackground, backgroundParams } from './backgrounds/index.js';
import { FONTS, getFont } from './fonts.js';
import { PRESETS } from './presets.js';
import {
  DEFAULT_SIZE, emptyDesign, normaliseDesign, textLayer, spriteLayer, layerId, prepare, renderDesign,
  backgroundThumb, backgroundCredit, canvasToPng, loadFont, loadAllFonts,
} from './engine.js';
import { shapeLayer, SHAPE_KINDS, isOpenShape } from './engine.js';
import { SHAPE_PRESETS } from './shape-presets.js';
import { pickSprite } from '../ui-sprites.js';
import { modal, field, textInput, select, button, buttonRow, toast } from '../ui-dialog.js';
import { deepAds, locale, bundled } from '../repo.js';
import { spriteCanvas, rootedRsi } from '../sprites.js';

const SIZES = [[528, 136], [544, 116], [528, 144], [544, 156], [512, 128]];
const SNAP = 6;

function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Design files in the package: name.design.json next to name.png. */
export function packageDesigns(pkg) {
  return Object.keys(pkg.other).filter(p => /\.design\.json$/i.test(p) && !p.includes('/'));
}

export function readPackageDesign(pkg, file) {
  try {
    return normaliseDesign(JSON.parse(decoder.decode(pkg.other[file])));
  } catch {
    return null;
  }
}

/**
 * Opens the studio. options: { design, name, blockId, onDone(name) }.
 * app gives pkg, changed(), and the editor hooks used by "Use as banner".
 */
export function openStudio(app, options = {}) {
  if (document.querySelector('.studio')) return;
  const studio = new Studio(app, options);
  studio.open();
  return studio;
}

class Studio {
  constructor(app, options) {
    this.app = app;
    this.options = options;
    this.design = options.design ? normaliseDesign(options.design) : emptyDesign();
    if (!options.design && app.pkg && app.pkg.site) {
      this.design.layers[0].text = (app.pkg.site.title || 'SITE TITLE').toUpperCase();
      this.design.layers[1].text = app.pkg.site.address || this.design.layers[1].text;
      const style = app.pkg.site.style || {};
      this.design.background = { type: 'procedural', id: 'gradient', seed: 1, params: { from: style.background || '#0B1630', to: style.link || '#2A5C8A', angle: 90 } };
      if (style.heading) this.design.layers[0].fill = { type: 'solid', color: style.heading };
      if (style.text) this.design.layers[1].fill = { type: 'solid', color: style.text };
      this.fitTitle = true;
    }
    this.name = (options.name || 'banner').replace(/\.png$/i, '');
    this.selected = this.design.layers[0] ? this.design.layers[0].id : null;
    this.history = new History();
    this.history.reset(this.design);
    this.assets = { sprites: new Map(), background: null };
    this.boxes = new Map();
    this.zoom = 1;
    this.leftTab = 'background';
    this.guides = [];
    this.recordSoon = debounce(() => this.record(), 350);
  }

  // ------------------------------------------------------------ frame

  open() {
    this.root = el('div.studio', { tabIndex: -1 });
    // Reachable from the console for testing: document.querySelector('.studio').studio
    this.root.studio = this;
    this.nameInput = textInput(this.name, { className: 'input studio-name', title: 'File name: <name>.png and <name>.design.json' });
    this.nameInput.addEventListener('input', () => {
      this.name = this.nameInput.value.trim().replace(/[^a-z0-9_-]+/gi, '_').toLowerCase() || 'banner';
    });
    this.sizeSelect = select([...SIZES.map(([w, h]) => [`${w}x${h}`, `${w} x ${h}${w === 528 && h === 136 ? ' (most banners)' : ''}`]), ['custom', 'Custom...']], `${this.design.width}x${this.design.height}`);
    this.sizeSelect.addEventListener('change', () => this.changeSize());
    this.pixelSelect = select([['1', 'Pixel look: off'], ['2', 'Pixel look: 1/2'], ['3', 'Pixel look: 1/3']], String(this.design.pixel));
    this.pixelSelect.addEventListener('change', () => this.change(d => {
      d.pixel = Number(this.pixelSelect.value);
    }));
    this.undoBtn = button('↶ Undo', () => this.undo(), '.btn-small');
    this.redoBtn = button('Redo ↷', () => this.redo(), '.btn-small');
    const top = el('header.studio-top', {},
      el('span.studio-title', { text: 'BANNER STUDIO' }),
      field('Name', this.nameInput),
      field('Size', this.sizeSelect),
      field('Look', this.pixelSelect),
      el('span.top-sep'),
      this.undoBtn, this.redoBtn,
      el('span.top-sep'),
      button('Starter designs', () => this.starters(), '.btn-small'),
      button('Open design', () => this.openDesign(), '.btn-small'),
      button('Save design', () => this.saveDesign(), '.btn-small'),
      button('Download PNG', () => this.downloadPng(), '.btn-small'),
      button('Use as banner', () => this.useAsBanner(), '.btn-primary'),
      button('Close', () => this.close(), '.btn-small'));

    this.left = el('aside.studio-left');
    this.right = el('aside.studio-right');
    this.view = el('canvas.studio-view');
    this.overlay = el('canvas.studio-overlay');
    this.stageInner = el('div.studio-canvas', {}, this.view, this.overlay);
    this.zoomLabel = el('span.muted');
    this.stage = el('section.studio-stage', {},
      this.stageInner,
      el('div.studio-hint', {}, this.zoomLabel, ' Drag layers to move them. Corner handle: size. Round handle: rotate (Shift: 15° steps). Arrows nudge (Shift: 10 px). Alt while dragging: no snapping.'));
    this.root.append(top, el('div.studio-main', {}, this.left, this.stage, this.right));
    document.body.append(this.root);
    this.root.focus();

    this.wirePointer();
    this.root.addEventListener('keydown', e => this.keys(e));
    this.resizeObserver = new ResizeObserver(() => this.layoutStage());
    this.resizeObserver.observe(this.stage);
    this.renderLeft();
    this.renderRight();
    this.updateUndo();
    this.refresh();
  }

  close(force = false) {
    if (!force && this.history.canUndo && !this.saved) {
      if (!window.confirm('Close the Banner Studio? Changes not used as a banner or saved as a design are lost.')) return;
    }
    this.resizeObserver.disconnect();
    this.root.remove();
  }

  // ------------------------------------------------------------ state

  layer(id = this.selected) {
    return this.design.layers.find(l => l.id === id) || null;
  }

  /** Changes the design; continuous changes (sliders, typing) are grouped into one undo step. */
  change(fn, { continuous = false, rerenderPanels = false } = {}) {
    fn(this.design);
    this.saved = false;
    if (continuous) this.recordSoon();
    else this.record();
    this.refresh();
    if (rerenderPanels) {
      this.renderLeft();
      this.renderRight();
    }
  }

  record() {
    this.history.record(this.design);
    this.updateUndo();
  }

  updateUndo() {
    this.undoBtn.disabled = !this.history.canUndo;
    this.redoBtn.disabled = !this.history.canRedo;
  }

  undo() {
    this.recordSoon.flush();
    const d = this.history.undo();
    if (!d) return;
    this.design = normaliseDesign(d);
    this.afterRestore();
  }

  redo() {
    const d = this.history.redo();
    if (!d) return;
    this.design = normaliseDesign(d);
    this.afterRestore();
  }

  afterRestore() {
    if (!this.layer()) this.selected = this.design.layers.length ? this.design.layers[this.design.layers.length - 1].id : null;
    this.sizeSelect.value = SIZES.some(([w, h]) => w === this.design.width && h === this.design.height) ? `${this.design.width}x${this.design.height}` : 'custom';
    this.pixelSelect.value = String(this.design.pixel);
    this.updateUndo();
    this.refresh();
    this.renderLeft();
    this.renderRight();
  }

  setDesign(design) {
    this.design = normaliseDesign(design);
    this.selected = this.design.layers.length ? this.design.layers[this.design.layers.length - 1].id : null;
    this.history.record(this.design);
    this.afterRestore();
  }

  async changeSize() {
    let w;
    let h;
    if (this.sizeSelect.value === 'custom') {
      const answer = window.prompt('Banner size in pixels, width x height', `${this.design.width}x${this.design.height}`);
      const m = /^\s*(\d+)\s*[x×, ]\s*(\d+)\s*$/i.exec(answer || '');
      if (!m) {
        this.sizeSelect.value = `${this.design.width}x${this.design.height}`;
        return;
      }
      w = Number(m[1]);
      h = Number(m[2]);
    } else {
      [w, h] = this.sizeSelect.value.split('x').map(Number);
    }
    // Layers keep their place relative to the banner.
    const sx = w / this.design.width;
    const sy = h / this.design.height;
    this.change(d => {
      for (const l of d.layers) {
        l.x = Math.round(l.x * sx);
        l.y = Math.round(l.y * sy);
      }
      d.width = Math.max(16, Math.min(2048, w));
      d.height = Math.max(16, Math.min(1024, h));
    });
  }

  // ------------------------------------------------------------ drawing

  async refresh() {
    const token = (this.renderToken = (this.renderToken || 0) + 1);
    this.assets = await prepare(this.design);
    if (token !== this.renderToken || !this.root.isConnected) return;
    const { canvas, boxes } = renderDesign(this.design, this.assets);
    this.boxes = boxes;
    // A new banner's title is shrunk once to fit the width.
    if (this.fitTitle) {
      this.fitTitle = false;
      const title = this.design.layers.find(l => l.type === 'text');
      const box = title && boxes.get(title.id);
      if (box && box.width > this.design.width * 0.92) {
        title.size = Math.max(10, Math.floor((title.size * this.design.width * 0.9) / box.width));
        this.history.reset(this.design);
        this.refresh();
        this.renderRight();
        return;
      }
    }
    this.last = canvas;
    this.view.width = canvas.width;
    this.view.height = canvas.height;
    this.view.getContext('2d').drawImage(canvas, 0, 0);
    this.layoutStage();
  }

  layoutStage() {
    const r = this.stage.getBoundingClientRect();
    const maxW = Math.max(100, r.width - 40);
    const maxH = Math.max(80, r.height - 70);
    const fit = Math.min(maxW / this.design.width, maxH / this.design.height);
    // Whole steps above 1x keep the pixels square.
    this.zoom = fit >= 1 ? Math.floor(fit * 2) / 2 : fit;
    const w = Math.round(this.design.width * this.zoom);
    const h = Math.round(this.design.height * this.zoom);
    this.stageInner.style.width = `${w}px`;
    this.stageInner.style.height = `${h}px`;
    this.overlay.width = w;
    this.overlay.height = h;
    this.zoomLabel.textContent = `${this.design.width} x ${this.design.height} px at ${Math.round(this.zoom * 100)}%.`;
    this.drawOverlay();
  }

  /** Selection outline, handles and snap guides. */
  drawOverlay() {
    const ctx = this.overlay.getContext('2d');
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    const z = this.zoom;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 0, 200, 0.9)';
    ctx.setLineDash([4, 3]);
    for (const g of this.guides) {
      ctx.beginPath();
      if (g.axis === 'x') {
        ctx.moveTo(g.at * z + 0.5, 0);
        ctx.lineTo(g.at * z + 0.5, this.overlay.height);
      } else {
        ctx.moveTo(0, g.at * z + 0.5);
        ctx.lineTo(this.overlay.width, g.at * z + 0.5);
      }
      ctx.stroke();
    }
    ctx.restore();
    const box = this.boxes.get(this.selected);
    const layer = this.layer();
    if (!box || !layer || !layer.visible) return;
    ctx.save();
    ctx.translate(box.x * z, box.y * z);
    ctx.rotate((box.rotation * Math.PI) / 180);
    ctx.strokeStyle = layer.locked ? '#FFB547' : '#3FE05A';
    ctx.lineWidth = 1.5;
    ctx.setLineDash(layer.locked ? [3, 3] : []);
    ctx.strokeRect(box.left * z - 3, box.top * z - 3, box.width * z + 6, box.height * z + 6);
    if (!layer.locked) {
      ctx.setLineDash([]);
      const hs = this.handles(box);
      ctx.fillStyle = '#3FE05A';
      ctx.fillRect(hs.scale.x * z - 5, hs.scale.y * z - 5, 10, 10);
      ctx.beginPath();
      ctx.moveTo((box.left + box.width / 2) * z, box.top * z - 3);
      ctx.lineTo(hs.rotate.x * z, hs.rotate.y * z);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hs.rotate.x * z, hs.rotate.y * z, 6, 0, Math.PI * 2);
      ctx.fill();
      // A free polygon's points can be dragged one by one.
      if (layer.type === 'shape' && layer.shape === 'path') {
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#FF3FD0';
        for (const [px, py] of layer.path) {
          ctx.fillRect(px * z - 4, py * z - 4, 8, 8);
          ctx.strokeRect(px * z - 4, py * z - 4, 8, 8);
        }
      }
    }
    ctx.restore();
  }

  /** Handle positions in the layer's own (unrotated) coordinates. */
  handles(box) {
    return {
      scale: { x: box.left + box.width + 3 / this.zoom, y: box.top + box.height + 3 / this.zoom },
      rotate: { x: box.left + box.width / 2, y: box.top - 22 / this.zoom },
    };
  }

  /** A point in banner pixels, in a layer's own coordinates. */
  toLocal(box, x, y) {
    const a = (-box.rotation * Math.PI) / 180;
    const dx = x - box.x;
    const dy = y - box.y;
    return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
  }

  hit(x, y) {
    for (let i = this.design.layers.length - 1; i >= 0; i--) {
      const l = this.design.layers[i];
      const box = this.boxes.get(l.id);
      if (!box || !l.visible) continue;
      const p = this.toLocal(box, x, y);
      if (p.x >= box.left - 2 && p.x <= box.left + box.width + 2 && p.y >= box.top - 2 && p.y <= box.top + box.height + 2) return l;
    }
    return null;
  }

  // ------------------------------------------------------------ pointer

  wirePointer() {
    const point = e => {
      const r = this.overlay.getBoundingClientRect();
      return { x: (e.clientX - r.left) / this.zoom, y: (e.clientY - r.top) / this.zoom };
    };
    this.overlay.addEventListener('pointerdown', e => {
      const p = point(e);
      this.root.focus();
      const layer = this.layer();
      const box = layer && this.boxes.get(layer.id);
      if (this.addingPoints) {
        const target = this.layer(this.addingPoints);
        if (target) {
          const local = this.toLocal({ x: target.x, y: target.y, rotation: Number(target.rotation) || 0 }, p.x, p.y);
          this.change(() => {
            target.path.push([Math.round(local.x), Math.round(local.y)]);
          });
          this.renderRight();
          return;
        }
        this.addingPoints = null;
      }
      if (layer && box && !layer.locked && layer.visible) {
        const local = this.toLocal(box, p.x, p.y);
        const hs = this.handles(box);
        const near = (h, r) => Math.hypot(local.x - h.x, local.y - h.y) <= r / this.zoom;
        const vertex = layer.type === 'shape' && layer.shape === 'path'
          ? layer.path.findIndex(([vx, vy]) => near({ x: vx, y: vy }, 7)) : -1;
        if (vertex >= 0 && e.altKey) {
          this.change(() => {
            layer.path.splice(vertex, 1);
          });
          this.renderRight();
          return;
        }
        if (vertex >= 0) {
          this.drag = { mode: 'vertex', layer, index: vertex, start: clone(layer) };
        } else if (near(hs.rotate, 9)) {
          this.drag = { mode: 'rotate', layer, start: clone(layer) };
        } else if (near(hs.scale, 9)) {
          this.drag = { mode: 'scale', layer, start: clone(layer), dist: Math.max(4, Math.hypot(p.x - layer.x, p.y - layer.y)) };
        }
      }
      if (!this.drag) {
        const target = this.hit(p.x, p.y);
        if (target) {
          if (this.selected !== target.id) {
            this.selected = target.id;
            this.renderRight();
            this.renderLayerList();
          }
          if (!target.locked) this.drag = { mode: 'move', layer: target, start: clone(target), from: p };
        } else if (this.selected) {
          this.selected = null;
          this.renderRight();
          this.renderLayerList();
        }
      }
      this.drawOverlay();
      if (this.drag) this.overlay.setPointerCapture(e.pointerId);
    });
    this.overlay.addEventListener('pointermove', e => {
      const p = point(e);
      if (!this.drag) {
        const layer = this.hit(p.x, p.y);
        this.overlay.style.cursor = layer && !layer.locked ? 'move' : 'default';
        return;
      }
      const d = this.drag;
      const l = d.layer;
      if (d.mode === 'move') {
        l.x = Math.round(d.start.x + p.x - d.from.x);
        l.y = Math.round(d.start.y + p.y - d.from.y);
        this.guides = e.altKey ? [] : this.snap(l);
      } else if (d.mode === 'vertex') {
        const local = this.toLocal({ x: l.x, y: l.y, rotation: Number(l.rotation) || 0 }, p.x, p.y);
        l.path[d.index] = [Math.round(local.x), Math.round(local.y)];
      } else if (d.mode === 'scale') {
        const k = Math.max(4, Math.hypot(p.x - l.x, p.y - l.y)) / d.dist;
        if (l.type === 'shape') {
          if (l.shape === 'path') {
            l.path = d.start.path.map(([x, y]) => [Math.round(x * k), Math.round(y * k)]);
          } else if (e.shiftKey || l.shape === 'line' || l.shape === 'arrow') {
            l.w = Math.max(2, Math.round(d.start.w * k));
            l.h = Math.max(2, Math.round(d.start.h * k));
          } else {
            // The corner follows the pointer: width and height change separately (Shift keeps the proportions).
            const local = this.toLocal({ x: l.x, y: l.y, rotation: Number(l.rotation) || 0 }, p.x, p.y);
            l.w = Math.max(2, Math.round(Math.abs(local.x) * 2));
            l.h = Math.max(2, Math.round(Math.abs(local.y) * 2));
          }
        } else if (l.type === 'text') l.size = Math.max(4, Math.round(d.start.size * k));
        else l.scale = e.shiftKey ? Math.max(0.25, Math.round(d.start.scale * k * 4) / 4) : Math.max(1, Math.round(d.start.scale * k));
      } else if (d.mode === 'rotate') {
        let a = (Math.atan2(p.y - l.y, p.x - l.x) * 180) / Math.PI + 90;
        if (e.shiftKey) a = Math.round(a / 15) * 15;
        else a = Math.round(a);
        if (a > 180) a -= 360;
        l.rotation = a;
      }
      this.refresh();
    });
    const end = () => {
      if (!this.drag) return;
      this.drag = null;
      this.guides = [];
      this.saved = false;
      this.record();
      this.drawOverlay();
      this.renderRight();
    };
    this.overlay.addEventListener('pointerup', end);
    this.overlay.addEventListener('pointercancel', end);
  }

  /** Snaps a moving layer to the banner's centre lines and edges. Returns the guides to draw. */
  snap(l) {
    const box = this.boxes.get(l.id);
    const guides = [];
    const W = this.design.width;
    const H = this.design.height;
    if (!box) return guides;
    const cx = l.x + (l.rotation ? 0 : box.left + box.width / 2);
    const cy = l.y + (l.rotation ? 0 : box.top + box.height / 2);
    if (Math.abs(cx - W / 2) < SNAP) {
      l.x += Math.round(W / 2 - cx);
      guides.push({ axis: 'x', at: W / 2 });
    }
    if (Math.abs(cy - H / 2) < SNAP) {
      l.y += Math.round(H / 2 - cy);
      guides.push({ axis: 'y', at: H / 2 });
    }
    if (!l.rotation) {
      const left = l.x + box.left;
      const right = left + box.width;
      const top = l.y + box.top;
      const bottom = top + box.height;
      if (Math.abs(left) < SNAP) {
        l.x -= Math.round(left);
        guides.push({ axis: 'x', at: 0 });
      } else if (Math.abs(right - W) < SNAP) {
        l.x += Math.round(W - right);
        guides.push({ axis: 'x', at: W });
      }
      if (Math.abs(top) < SNAP) {
        l.y -= Math.round(top);
        guides.push({ axis: 'y', at: 0 });
      } else if (Math.abs(bottom - H) < SNAP) {
        l.y += Math.round(H - bottom);
        guides.push({ axis: 'y', at: H });
      }
    }
    return guides;
  }

  keys(e) {
    const typing = e.target.closest('input, textarea, select');
    const mod = e.ctrlKey || e.metaKey;
    if (this.addingPoints && !typing && (e.key === 'Escape' || e.key === 'Enter')) {
      e.preventDefault();
      this.finishPoints();
      return;
    }
    if (e.key === 'Escape' && !typing) {
      if (document.querySelector('dialog[open]')) return;
      this.close();
      return;
    }
    if (typing) return;
    if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.undo();
      return;
    }
    if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault();
      this.redo();
      return;
    }
    const layer = this.layer();
    if (!layer) return;
    const step = e.shiftKey ? 10 : 1;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key] && !layer.locked) {
      e.preventDefault();
      this.change(() => {
        layer.x += moves[e.key][0];
        layer.y += moves[e.key][1];
      }, { continuous: true });
      this.renderRight();
    } else if (e.key === 'Delete') {
      e.preventDefault();
      this.removeLayer(layer.id);
    } else if (mod && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      this.duplicateLayer(layer.id);
    }
  }

  // ------------------------------------------------------------ layers

  addLayer(layer) {
    this.change(d => {
      d.layers.push(layer);
    });
    this.selected = layer.id;
    this.leftTab = 'layers';
    this.renderLeft();
    this.renderRight();
  }

  removeLayer(id) {
    this.change(d => {
      d.layers = d.layers.filter(l => l.id !== id);
    });
    if (this.selected === id) this.selected = null;
    this.renderLeft();
    this.renderRight();
  }

  duplicateLayer(id) {
    const l = this.layer(id);
    if (!l) return;
    const copy = { ...clone(l), id: layerId(l.type), name: `${l.name} copy`, x: l.x + 8, y: l.y + 8 };
    const at = this.design.layers.indexOf(l);
    this.change(d => {
      d.layers.splice(at + 1, 0, copy);
    });
    this.selected = copy.id;
    this.renderLeft();
    this.renderRight();
  }

  moveLayer(id, delta) {
    const i = this.design.layers.findIndex(l => l.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= this.design.layers.length) return;
    this.change(d => {
      const [l] = d.layers.splice(i, 1);
      d.layers.splice(j, 0, l);
    });
    this.renderLayerList();
  }

  async addSprite() {
    const r = await pickSprite();
    if (!r) return;
    const state = r.state;
    this.addLayer(spriteLayer({ kind: 'rsi', rsi: r.rsi, state }, { name: state, scale: Math.max(1, Math.round(Number(r.scale) || 2)), x: Math.round(this.design.width * 0.8), y: Math.round(this.design.height / 2) }));
  }

  async addAdSprite() {
    const chosen = await modal('Item sprite from an ad', (body, close) => {
      const list = el('div.ad-list', {}, el('div.muted', { text: 'Loading...' }));
      body.append(el('p.note', { text: 'The products the game\'s ads show, drawn from their own item sprites (all their layers).' }), list, buttonRow(button('Cancel', () => close(null))));
      Promise.all([deepAds(), locale().catch(() => ({})), bundled('ad_sprites.json')]).then(([ads, strings, sprites]) => {
        list.replaceChildren();
        for (const ad of ads.values()) {
          const layers = ad.entity && sprites[ad.entity];
          if (!layers) continue;
          const art = el('span.ad-art');
          spriteCanvas(layers[0].rsi, layers[0].state, 1).then(c => art.append(c)).catch(() => {});
          const label = strings[ad.product] || ad.entity;
          list.append(el('button.ad-item', { type: 'button', onclick: () => close({ label, layers }) }, art, el('span', {}, el('strong', { text: label }), el('br'), el('span.muted', { text: ad.entity }))));
        }
      }).catch(e => list.replaceChildren(el('div.attr-missing', { text: `Could not load the ads: ${e.message}` })));
    }, { wide: true });
    if (!chosen) return;
    this.addLayer(spriteLayer({ kind: 'layers', label: chosen.label, layers: chosen.layers }, { name: chosen.label, scale: 2, x: Math.round(this.design.width * 0.8), y: Math.round(this.design.height / 2) }));
  }

  pickFile(accept) {
    return new Promise(resolve => {
      const input = el('input', { type: 'file', accept });
      input.addEventListener('change', () => resolve(input.files[0] || null));
      input.click();
    });
  }

  async fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async addImageLayer() {
    const file = await this.pickFile('image/png');
    if (!file) return;
    const src = await this.fileToDataUrl(file);
    this.addLayer(spriteLayer({ kind: 'image', label: file.name, src }, { name: file.name, scale: 1, x: Math.round(this.design.width / 2), y: Math.round(this.design.height / 2) }));
    toast('Only upload art you made or may share; game objects should be real game sprites.');
  }

  // ------------------------------------------------------------ left panel

  renderLeft() {
    const tabs = el('div.left-tabs', {}, ...[['background', 'Background'], ['layers', 'Layers']].map(([id, label]) =>
      el(`button.left-tab${this.leftTab === id ? '.active' : ''}`, { type: 'button', text: label, onclick: () => {
        this.leftTab = id;
        this.renderLeft();
      } })));
    const body = el('div.studio-panel');
    this.left.replaceChildren(tabs, body);
    if (this.leftTab === 'background') this.renderBackgroundPanel(body);
    else this.renderLayersPanel(body);
  }

  renderBackgroundPanel(body) {
    const bg = this.design.background;
    const grid = el('div.bg-grid');
    // Backgrounds with a `group` get their own heading after the ungrouped ones.
    const groups = new Map();
    for (const b of BACKGROUNDS) {
      const active = bg.type === 'procedural' && bg.id === b.id;
      const thumb = backgroundThumb({ type: 'procedural', id: b.id, seed: 1, params: active ? bg.params : {} });
      const card = el(`button.bg-card${active ? '.active' : ''}`, { type: 'button', title: b.name, onclick: () => {
        this.change(d => {
          d.background = { type: 'procedural', id: b.id, seed: d.background.seed || 1, params: {} };
        }, { rerenderPanels: true });
      } }, thumb, el('span', { text: b.name }));
      if (!b.group) {
        grid.append(card);
        continue;
      }
      if (!groups.has(b.group)) groups.set(b.group, el('div.bg-grid'));
      groups.get(b.group).append(card);
    }
    const imageActive = bg.type === 'image';
    grid.append(el(`button.bg-card.bg-card-image${imageActive ? '.active' : ''}`, { type: 'button', onclick: async () => {
      const file = await this.pickFile('image/png,image/jpeg');
      if (!file) return;
      const src = await this.fileToDataUrl(file);
      this.change(d => {
        d.background = { type: 'image', src, fit: 'cover' };
      }, { rerenderPanels: true });
    } }, el('div.bg-image-icon', { text: '⬆' }), el('span', { text: 'Your image...' })));
    const gridHead = el('h3.section-title', { text: 'Background' });

    const controls = el('div.bg-controls');
    if (bg.type === 'procedural') {
      const def = getBackground(bg.id);
      const values = backgroundParams(def, bg.params);
      for (const p of def.params) controls.append(this.paramControl(p, values[p.key], v => {
        this.change(d => {
          d.background.params = { ...backgroundParams(def, d.background.params), [p.key]: v };
        }, { continuous: true });
      }));
      controls.append(buttonRow(button('Shuffle', () => this.change(d => {
        d.background.seed = 1 + Math.floor(Math.random() * 1e6);
      }), '.btn-small'), button('Reset colours', () => this.change(d => {
        d.background.params = {};
      }, { rerenderPanels: true }), '.btn-small')));
    } else {
      const fit = select([['cover', 'Cover (fill, crop)'], ['contain', 'Contain (whole image)'], ['tile', 'Tile']], bg.fit || 'cover');
      fit.addEventListener('change', () => this.change(d => {
        d.background.fit = fit.value;
      }));
      controls.append(field('Fit', fit), el('p.note', { text: 'The image is kept inside the design file. Only use art you made or may share.' }));
    }
    body.append(el('h3.section-title', { text: 'Background settings' }), controls, gridHead, grid);
    for (const [title, g] of groups) {
      body.append(el('h3.section-title', { text: title }));
      body.append(g);
    }
  }

  paramControl(p, value, onChange) {
    if (p.type === 'color') {
      const input = el('input.colour-swatch.wide', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000' });
      input.addEventListener('input', () => onChange(input.value.toUpperCase()));
      return field(p.label, input);
    }
    if (p.type === 'select') {
      const s = select((p.options || []).map(o => (Array.isArray(o) ? o : [o, o])), value);
      s.addEventListener('change', () => onChange(s.value));
      return field(p.label, s);
    }
    const range = el('input.range', { type: 'range', min: p.min ?? 0, max: p.max ?? 1, step: p.step ?? 0.01, value });
    const out = el('span.range-value', { text: String(value) });
    range.addEventListener('input', () => {
      out.textContent = range.value;
      onChange(Number(range.value));
    });
    return el('label.field', {}, el('span.field-label', {}, p.label, ' ', out), range);
  }

  renderLayersPanel(body) {
    body.append(el('h3.section-title', { text: 'Add' }),
      el('div.add-grid', {},
        button('+ Text', () => this.addLayer(textLayer({ name: 'Text', text: 'NEW TEXT', x: Math.round(this.design.width / 2), y: Math.round(this.design.height / 2), fill: { type: 'solid', color: '#FFFFFF' }, outline: { color: '#000000', width: 2 } })), '.btn-small'),
        button('+ Shape', () => this.addShape(), '.btn-small'),
        button('+ Game sprite', () => this.addSprite(), '.btn-small'),
        button('+ Item from an ad', () => this.addAdSprite(), '.btn-small'),
        button('+ Your PNG', () => this.addImageLayer(), '.btn-small')),
      el('p.note', { text: 'Anything that exists in game goes in as its real sprite. Upload art only for things the game has no sprite for.' }),
      el('h3.section-title', { text: 'Layers (front on top)' }));
    this.layerList = el('div.layer-list');
    body.append(this.layerList);
    this.renderLayerList();
  }

  renderLayerList() {
    if (!this.layerList || !this.layerList.isConnected) return;
    this.layerList.replaceChildren();
    const layers = [...this.design.layers].reverse();
    for (const l of layers) {
      const row = el(`div.layer-row${l.id === this.selected ? '.active' : ''}${l.visible ? '' : '.hidden'}`, { draggable: true, dataset: { id: l.id } },
        el('button.layer-btn', { type: 'button', title: l.visible ? 'Hide' : 'Show', text: l.visible ? '◉' : '○', onclick: e => {
          e.stopPropagation();
          this.change(() => {
            l.visible = !l.visible;
          });
          this.renderLayerList();
        } }),
        el('button.layer-btn', { type: 'button', title: l.locked ? 'Unlock' : 'Lock', text: l.locked ? '\u{1F512}' : '□', onclick: e => {
          e.stopPropagation();
          this.change(() => {
            l.locked = !l.locked;
          });
          this.renderLayerList();
        } }),
        el('span.layer-kind', { text: l.type === 'text' ? 'T' : l.type === 'shape' ? '◆' : '✦' }),
        el('span.layer-name', { text: l.type === 'text' ? (l.text || l.name).replace(/\n/g, ' ') : l.name }),
        el('button.layer-btn', { type: 'button', title: 'Up (towards the front)', text: '↑', onclick: e => {
          e.stopPropagation();
          this.moveLayer(l.id, 1);
        } }),
        el('button.layer-btn', { type: 'button', title: 'Down (towards the back)', text: '↓', onclick: e => {
          e.stopPropagation();
          this.moveLayer(l.id, -1);
        } }),
        el('button.layer-btn', { type: 'button', title: 'Duplicate', text: '⧉', onclick: e => {
          e.stopPropagation();
          this.duplicateLayer(l.id);
        } }),
        el('button.layer-btn.layer-del', { type: 'button', title: 'Delete', text: '✕', onclick: e => {
          e.stopPropagation();
          this.removeLayer(l.id);
        } }));
      row.addEventListener('click', () => {
        this.selected = l.id;
        this.renderLayerList();
        this.renderRight();
        this.drawOverlay();
      });
      row.addEventListener('dragstart', e => {
        this.dragRow = l.id;
        e.dataTransfer.setData('text/plain', l.id);
      });
      row.addEventListener('dragover', e => {
        if (this.dragRow) e.preventDefault();
      });
      row.addEventListener('drop', e => {
        e.preventDefault();
        const from = this.design.layers.findIndex(x => x.id === this.dragRow);
        const to = this.design.layers.findIndex(x => x.id === l.id);
        this.dragRow = null;
        if (from < 0 || to < 0 || from === to) return;
        this.change(d => {
          const [m] = d.layers.splice(from, 1);
          d.layers.splice(to, 0, m);
        });
        this.renderLayerList();
      });
      this.layerList.append(row);
    }
    if (!layers.length) this.layerList.append(el('p.note', { text: 'No layers yet.' }));
  }

  // ------------------------------------------------------------ right panel

  renderRight() {
    const layer = this.layer();
    this.right.replaceChildren();
    if (!layer) {
      this.right.append(el('h3.section-title', { text: 'Banner' }),
        el('p.note', { text: 'Click a layer on the banner, or in the layer list, to edit it.' }),
        el('p.note', { text: `Use as banner writes ./${this.name}.png and ./${this.name}.design.json into the package.` }));
      return;
    }
    const L = (fn, opts = {}) => this.change(() => fn(layer), { continuous: true, ...opts });
    const num = (label, key, props = {}) => {
      const input = el('input.input.input-narrow', { type: 'number', value: layer[key], step: props.step || 1, ...props });
      input.addEventListener('input', () => {
        if (input.value === '') return;
        L(l => {
          l[key] = Number(input.value);
        });
      });
      return field(label, input);
    };
    const check = (label, value, fn) => {
      const box = el('input', { type: 'checkbox', checked: !!value });
      box.addEventListener('change', () => {
        this.change(() => fn(box.checked));
        this.renderRight();
        this.renderLayerList();
      });
      return el('label.check', {}, box, label);
    };
    const colourField = (label, value, fn) => {
      const input = el('input.colour-swatch.wide', { type: 'color', value: /^#[0-9a-f]{6}/i.test(value || '') ? value.slice(0, 7) : '#000000' });
      input.addEventListener('input', () => L(() => fn(input.value.toUpperCase())));
      return field(label, input);
    };
    const range = (label, value, min, max, step, fn) => this.paramControl({ label, min, max, step }, value, v => L(() => fn(v)));

    this.right.append(el('div.props-head', {}, el('span.props-title', { text: layer.type === 'text' ? 'Text layer' : layer.type === 'shape' ? 'Shape layer' : 'Sprite layer' })),
      el('div.grid-3', {}, num('X', 'x'), num('Y', 'y'), num('Rotation', 'rotation')),
      range('Opacity', layer.opacity, 0, 1, 0.05, v => {
        layer.opacity = v;
      }));

    if (layer.type === 'text') this.textProps(layer, { L, num, check, colourField, range });
    else if (layer.type === 'shape') this.shapeProps(layer, { L, num, check, colourField, range });
    else this.spriteProps(layer, { L, num, check, colourField, range });
  }

  textProps(layer, { L, check, colourField, range }) {
    const text = el('textarea.input', { rows: 2, value: layer.text });
    text.addEventListener('input', () => L(l => {
      l.text = text.value;
    }));
    this.right.append(field('Text', text, 'Enter starts a new line.'));

    const presets = el('div.preset-row');
    for (const p of PRESETS) {
      presets.append(button(p.name, () => {
        this.change(() => {
          for (const [k, v] of Object.entries(p.style)) layer[k] = clone(v);
        });
        this.renderRight();
      }, '.btn-small'));
    }
    this.right.append(el('div.field-label', { text: 'Style presets' }), presets);

    this.right.append(field('Font', this.fontPicker(layer)));
    this.right.append(
      range('Size', layer.size, 6, 160, 1, v => {
        layer.size = v;
      }),
      range('Letter spacing', layer.letterSpacing, -6, 30, 1, v => {
        layer.letterSpacing = v;
      }),
      range('Line height', layer.lineHeight ?? 1.1, 0.6, 2, 0.05, v => {
        layer.lineHeight = v;
      }),
      range('Slant (skew)', layer.skew, -30, 30, 1, v => {
        layer.skew = v;
      }));
    const align = el('div.align-row', {}, ...['left', 'center', 'right'].map(a => button(a[0].toUpperCase() + a.slice(1), () => {
      this.change(() => {
        layer.align = a;
      });
      this.renderRight();
    }, layer.align === a ? '.btn-small.btn-primary' : '.btn-small')));
    this.right.append(el('div.field-label', { text: 'Align' }), align, check('Capitals', layer.upper, v => {
      layer.upper = v;
    }));

    this.fillSection(layer, { L, colourField, range });

    // Effects
    const effect = (title, key, make, build) => {
      const on = !!layer[key];
      const section = el('div.effect');
      section.append(el('div.effect-head', {}, check(title, on, v => {
        layer[key] = v ? make() : null;
      })));
      if (on) build(section, layer[key]);
      this.right.append(section);
    };
    effect('Outline', 'outline', () => ({ color: '#000000', width: 2 }), (s, o) => s.append(
      colourField('Colour', o.color, v => {
        o.color = v;
      }),
      range('Width', o.width, 0.5, 12, 0.5, v => {
        o.width = v;
      })));
    effect('3D extrude', 'extrude', () => ({ depth: 6, angle: 45, color: null, shade: 0.4 }), (s, x) => {
      const auto = el('input', { type: 'checkbox', checked: !x.color });
      auto.addEventListener('change', () => {
        this.change(() => {
          x.color = auto.checked ? null : '#552200';
        });
        this.renderRight();
      });
      s.append(range('Depth', x.depth, 1, 40, 1, v => {
        x.depth = v;
      }), range('Angle (0 right, 90 down)', x.angle, 0, 360, 5, v => {
        x.angle = v;
      }), el('label.check', {}, auto, 'Darkened fill colour'));
      if (x.color) s.append(colourField('Side colour', x.color, v => {
        x.color = v;
      }));
      s.append(range('Shade towards the back', x.shade ?? 0.4, 0, 1, 0.05, v => {
        x.shade = v;
      }));
    });
    effect('Bevel highlight', 'bevel', () => ({ light: '#FFFFFF', dark: '#000000', size: 1, strength: 0.6 }), (s, b) => s.append(
      colourField('Light', b.light, v => {
        b.light = v;
      }),
      colourField('Dark', b.dark, v => {
        b.dark = v;
      }),
      range('Size', b.size, 0.5, 4, 0.5, v => {
        b.size = v;
      }),
      range('Strength', b.strength, 0, 1, 0.05, v => {
        b.strength = v;
      })));
    effect('Drop shadow', 'shadow', () => ({ color: '#000000AA', blur: 0, x: 3, y: 3 }), (s, sh) => this.shadowControls(s, sh, colourField, range));
    effect('Glow', 'glow', () => ({ color: '#FFD24A', blur: 10, strength: 1 }), (s, g) => s.append(
      colourField('Colour', g.color, v => {
        g.color = v;
      }),
      range('Blur', g.blur, 1, 40, 1, v => {
        g.blur = v;
      }),
      range('Strength', g.strength, 1, 3, 1, v => {
        g.strength = v;
      })));
  }

  shadowControls(s, sh, colourField, range) {
    s.append(colourField('Colour', sh.color, v => {
      sh.color = v.length === 7 ? `${v}AA` : v;
    }), range('Blur', sh.blur, 0, 30, 1, v => {
      sh.blur = v;
    }), range('Offset X', sh.x, -20, 20, 1, v => {
      sh.x = v;
    }), range('Offset Y', sh.y, -20, 20, 1, v => {
      sh.y = v;
    }));
  }

  /** Fill as a solid colour or a gradient (and, for shapes, none). Shared by text and shape layers. */
  fillSection(layer, { L, colourField, range }, { allowNone = false } = {}) {
    this.right.append(el('h3.section-title', { text: 'Fill' }));
    const current = layer.fill ? layer.fill.type : 'none';
    const fillType = select([...(allowNone ? [['none', 'No fill']] : []), ['solid', 'Solid colour'], ['gradient', 'Gradient']], current);
    fillType.addEventListener('change', () => {
      this.change(() => {
        const base = !layer.fill ? '#888888' : layer.fill.type === 'solid' ? layer.fill.color : layer.fill.stops[0].color;
        if (fillType.value === 'none') layer.fill = null;
        else if (fillType.value === 'solid') layer.fill = { type: 'solid', color: base };
        else layer.fill = { type: 'gradient', angle: 90, stops: [{ at: 0, color: '#FFFFFF' }, { at: 1, color: base || '#888888' }] };
      });
      this.renderRight();
    });
    this.right.append(fillType);
    if (!layer.fill) return;
    if (layer.fill.type === 'solid') {
      this.right.append(colourField('Colour', layer.fill.color, v => {
        layer.fill.color = v;
      }));
      return;
    }
    this.right.append(range('Angle (0 left to right, 90 top to bottom)', layer.fill.angle || 0, 0, 360, 5, v => {
      layer.fill.angle = v;
    }));
    layer.fill.stops.forEach((stop, i) => {
      this.right.append(el('div.stop-row', {},
        colourField(`Stop ${i + 1}`, stop.color, v => {
          stop.color = v;
        }),
        this.paramControl({ label: 'At', min: 0, max: 1, step: 0.01 }, stop.at, v => L(() => {
          stop.at = v;
        })),
        layer.fill.stops.length > 2 ? button('✕', () => {
          this.change(() => {
            layer.fill.stops.splice(i, 1);
          });
          this.renderRight();
        }, '.btn-icon.btn-danger') : null));
    });
    if (layer.fill.stops.length < 5) {
      this.right.append(button('+ Stop', () => {
        this.change(() => {
          layer.fill.stops.push({ at: 1, color: '#FFFFFF' });
        });
        this.renderRight();
      }, '.btn-small'));
    }
  }

  shapeProps(layer, tools) {
    const { L, check, colourField, range } = tools;
    const kind = select(SHAPE_KINDS, layer.shape);
    kind.addEventListener('change', () => {
      this.change(() => {
        layer.shape = kind.value;
        if (kind.value === 'path' && !layer.path.length) layer.path = [[-40, 20], [0, -24], [40, 20]];
      });
      this.renderRight();
    });
    this.right.append(field('Shape', kind));
    if (layer.shape !== 'path') {
      const size = el('div.grid-2', {},
        field('Width', this.numberInput(layer.w, v => L(l => {
          l.w = Math.max(1, v);
        }))),
        layer.shape === 'line' || layer.shape === 'arrow' ? null : field('Height', this.numberInput(layer.h, v => L(l => {
          l.h = Math.max(1, v);
        }))));
      this.right.append(size);
    }
    if (layer.shape === 'rect') {
      this.right.append(range('Corner radius', layer.radius || 0, 0, 60, 1, v => {
        layer.radius = v;
      }));
    }
    if (layer.shape === 'polygon') {
      this.right.append(range('Sides', layer.sides, 3, 12, 1, v => {
        layer.sides = v;
      }));
    }
    if (layer.shape === 'star') {
      this.right.append(range('Points', layer.points, 3, 32, 1, v => {
        layer.points = v;
      }), range('Inner size', layer.inner, 0.1, 0.95, 0.05, v => {
        layer.inner = v;
      }));
    }
    if (layer.shape === 'path') {
      const adding = this.addingPoints === layer.id;
      this.right.append(
        el('p.note', { text: `${layer.path.length} points. Drag a point to move it; Alt+click a point to remove it.` }),
        buttonRow(
          button(adding ? 'Done adding points' : 'Add points by clicking', () => (adding ? this.finishPoints() : this.startPoints(layer.id)), adding ? '.btn-small.btn-primary' : '.btn-small'),
          button('Remove last point', () => {
            this.change(() => {
              layer.path.pop();
            });
            this.renderRight();
          }, '.btn-small')),
        check('Closed (joins the last point to the first)', layer.closed, v => {
          layer.closed = v;
        }));
    }
    if (!isOpenShape(layer)) this.fillSection(layer, tools, { allowNone: true });

    this.right.append(el('h3.section-title', { text: 'Line' }));
    const strokeOn = el('input', { type: 'checkbox', checked: !!layer.stroke });
    strokeOn.addEventListener('change', () => {
      this.change(() => {
        layer.stroke = strokeOn.checked ? { color: '#FFFFFF', width: 2, dash: 'solid' } : null;
      });
      this.renderRight();
    });
    this.right.append(el('label.check', {}, strokeOn, 'Outline or line'));
    if (layer.stroke) {
      const st = layer.stroke;
      const dash = select([['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']], st.dash || 'solid');
      dash.addEventListener('change', () => this.change(() => {
        st.dash = dash.value;
      }));
      this.right.append(colourField('Colour', st.color, v => {
        st.color = v;
      }), range('Width', st.width, 0.5, 16, 0.5, v => {
        st.width = v;
      }), field('Pattern', dash));
    }
    this.right.append(check('Pixel edges (no smoothing, like the game\'s art)', layer.pixel, v => {
      layer.pixel = v;
    }));

    const effect = (title, key, make, build) => {
      const on = !!layer[key];
      const section = el('div.effect');
      section.append(el('div.effect-head', {}, check(title, on, v => {
        layer[key] = v ? make() : null;
      })));
      if (on) build(section, layer[key]);
      this.right.append(section);
    };
    effect('Drop shadow', 'shadow', () => ({ color: '#000000AA', blur: 0, x: 3, y: 3 }), (s, sh) => this.shadowControls(s, sh, colourField, range));
    effect('Glow', 'glow', () => ({ color: '#FFD24A', blur: 8, strength: 1 }), (s, g) => s.append(
      colourField('Colour', g.color, v => {
        g.color = v;
      }),
      range('Blur', g.blur, 1, 40, 1, v => {
        g.blur = v;
      }),
      range('Strength', g.strength, 1, 3, 1, v => {
        g.strength = v;
      })));
  }

  numberInput(value, onChange) {
    const input = el('input.input.input-narrow', { type: 'number', value, step: 1 });
    input.addEventListener('input', () => {
      if (input.value !== '') onChange(Number(input.value));
    });
    return input;
  }

  /** Free polygon: clicks on the banner add points until Done (or Enter or Escape). */
  startPoints(id) {
    this.addingPoints = id;
    this.overlay.style.cursor = 'crosshair';
    this.renderRight();
    this.drawOverlay();
  }

  finishPoints() {
    const layer = this.layer(this.addingPoints);
    this.addingPoints = null;
    this.overlay.style.cursor = 'default';
    if (layer && layer.path.length) {
      // Re-centre the layer on its points, so handles and snapping use the shape's real middle.
      const xs = layer.path.map(p => p[0]);
      const ys = layer.path.map(p => p[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const a = ((Number(layer.rotation) || 0) * Math.PI) / 180;
      this.change(() => {
        layer.path = layer.path.map(([x, y]) => [Math.round(x - cx), Math.round(y - cy)]);
        layer.x = Math.round(layer.x + cx * Math.cos(a) - cy * Math.sin(a));
        layer.y = Math.round(layer.y + cx * Math.sin(a) + cy * Math.cos(a));
      });
    }
    this.renderRight();
    this.drawOverlay();
  }

  /** Adds a shape, or one of the shape presets. */
  async addShape() {
    const pick = await modal('Add a shape', (body, close) => {
      const grid = el('div.shape-grid');
      for (const [kind, label] of SHAPE_KINDS) grid.append(button(label, () => close({ kind }), '.btn-small'));
      const presets = el('div.shape-grid');
      for (const p of SHAPE_PRESETS) presets.append(button(p.name, () => close({ preset: p }), '.btn-small'));
      body.append(el('h3.section-title', { text: 'Shapes' }), grid,
        el('h3.section-title', { text: 'Ready-made' }), presets,
        el('p.note', { text: 'A free polygon starts empty: click on the banner to add its points.' }),
        buttonRow(button('Cancel', () => close(null))));
    });
    if (!pick) return;
    const at = { x: Math.round(this.design.width / 2), y: Math.round(this.design.height / 2) };
    if (pick.preset) {
      this.addLayer(shapeLayer({ name: pick.preset.name, ...at, ...clone(pick.preset.layer) }));
      return;
    }
    const layer = shapeLayer({ name: SHAPE_KINDS.find(k => k[0] === pick.kind)[1], shape: pick.kind, ...at });
    if (pick.kind === 'ellipse') Object.assign(layer, { w: 80, h: 80 });
    if (pick.kind === 'line' || pick.kind === 'arrow') Object.assign(layer, { w: 140, fill: null, stroke: { color: '#FFFFFF', width: 3, dash: 'solid' } });
    if (pick.kind === 'polygon' || pick.kind === 'star' || pick.kind === 'triangle') Object.assign(layer, { w: 80, h: 80 });
    if (pick.kind === 'path') Object.assign(layer, { path: [], closed: true });
    this.addLayer(layer);
    if (pick.kind === 'path') this.startPoints(layer.id);
  }

  spriteProps(layer, { check, colourField, range }) {
    const src = layer.source;
    const label = src.kind === 'rsi' ? `${src.rsi} / ${src.state}` : src.kind === 'layers' ? `${src.label} (${src.layers.length} layers)` : `Your image: ${src.label || ''}`;
    this.right.append(el('div.muted.sprite-source', { text: label }));
    if (src.kind === 'rsi') {
      this.right.append(buttonRow(button('Change sprite...', async () => {
        const r = await pickSprite({ rsi: src.rsi, state: src.state });
        if (!r) return;
        this.change(() => {
          layer.source = { kind: 'rsi', rsi: r.rsi, state: r.state };
          layer.name = r.state;
        });
        this.renderRight();
        this.renderLayerList();
      }, '.btn-small')));
    }
    const scaleValue = el('span.scale-value', { text: `${layer.scale}x` });
    const setScale = v => {
      this.change(() => {
        layer.scale = v;
      });
      scaleValue.textContent = `${layer.scale}x`;
    };
    this.right.append(el('div.field-label', { text: 'Scale' }), el('div.scale-row', {},
      button('−', () => setScale(Math.max(1, Math.round(layer.scale) - 1)), '.btn-icon'),
      scaleValue,
      button('+', () => setScale(Math.round(layer.scale) + 1), '.btn-icon'),
      button('½', () => setScale(Math.max(0.25, layer.scale / 2)), '.btn-icon')),
    el('p.note', { text: 'Whole steps keep the pixels crisp (drag the corner handle; Shift for quarter steps).' }),
    check('Flip left to right', layer.flipX, v => {
      layer.flipX = v;
    }),
    check('Flip upside down', layer.flipY, v => {
      layer.flipY = v;
    }),
    check('Smooth when scaled (usually off)', layer.smooth, v => {
      layer.smooth = v;
    }));
    const section = el('div.effect');
    section.append(el('div.effect-head', {}, (() => {
      const box = el('input', { type: 'checkbox', checked: !!layer.shadow });
      box.addEventListener('change', () => {
        this.change(() => {
          layer.shadow = box.checked ? { color: '#000000AA', blur: 0, x: 2, y: 2 } : null;
        });
        this.renderRight();
      });
      return el('label.check', {}, box, 'Drop shadow');
    })()));
    if (layer.shadow) this.shadowControls(section, layer.shadow, colourField, range);
    this.right.append(section);
  }

  /** A font picker that shows every name in its own face. */
  fontPicker(layer) {
    const current = getFont(layer.font);
    const btn = el('button.font-current', { type: 'button', text: current.name, style: { fontFamily: `"${current.family}", sans-serif`, fontWeight: String(current.weight) } });
    loadFont(current.id);
    btn.addEventListener('click', () => {
      const existing = this.root.querySelector('.font-pop');
      if (existing) {
        existing.remove();
        return;
      }
      loadAllFonts();
      const pop = el('div.font-pop');
      const groups = [['The game\'s fonts', FONTS.filter(f => f.game)], ['Google Fonts (OFL)', FONTS.filter(f => !f.game)]];
      for (const [title, fonts] of groups) {
        pop.append(el('div.font-group', { text: title }));
        for (const f of fonts) {
          pop.append(el(`button.font-option${f.id === layer.font ? '.active' : ''}`, { type: 'button', title: (f.tones || []).join(', '), style: { fontFamily: `"${f.family}", sans-serif`, fontWeight: String(f.weight) }, onclick: () => {
            this.change(() => {
              layer.font = f.id;
            });
            pop.remove();
            this.renderRight();
          } }, f.name));
        }
      }
      btn.after(pop);
    });
    return el('div.font-picker', {}, btn);
  }

  // ------------------------------------------------------------ output

  async png() {
    const assets = await prepare(this.design);
    const { canvas } = renderDesign(this.design, assets);
    return canvasToPng(canvas);
  }

  designJson() {
    return `${JSON.stringify({ ...this.design, name: this.design.name || this.name }, null, 2)}\n`;
  }

  async downloadPng() {
    const bytes = await this.png();
    download(new Blob([bytes], { type: 'image/png' }), `${this.name}.png`);
  }

  saveDesign() {
    this.app.pkg.other[`${this.name}.design.json`] = encoder.encode(this.designJson());
    this.saved = true;
    this.app.changed('images', 'banner');
    toast(`Saved ./${this.name}.design.json in the package.`);
  }

  async openDesign() {
    const files = packageDesigns(this.app.pkg);
    const pick = await modal('Open a design', (body, close) => {
      body.append(el('p.note', { text: 'Design files in this package, or a .design.json from your computer.' }));
      for (const f of files) body.append(buttonRow(button(f, () => close({ file: f }), '.btn-small')));
      if (!files.length) body.append(el('p.muted', { text: 'This package has no design files yet.' }));
      body.append(buttonRow(button('From a file...', () => close({ upload: true }), '.btn-small'), button('Cancel', () => close(null))));
    });
    if (!pick) return;
    if (pick.file) {
      const d = readPackageDesign(this.app.pkg, pick.file);
      if (!d) {
        toast(`${pick.file} is not a banner design.`, 'error');
        return;
      }
      this.name = pick.file.replace(/\.design\.json$/i, '');
      this.nameInput.value = this.name;
      this.setDesign(d);
      return;
    }
    const file = await this.pickFile('.json,application/json');
    if (!file) return;
    try {
      this.setDesign(JSON.parse(await file.text()));
    } catch (e) {
      toast(`Could not read ${file.name}: ${e.message}`, 'error');
    }
  }

  async starters() {
    let list = [];
    try {
      const r = await fetch(new URL('../../data/banner-designs/index.json', import.meta.url));
      list = await r.json();
    } catch {
      toast('Could not load the starter designs.', 'error');
      return;
    }
    const chosen = await modal('Starter designs', (body, close) => {
      const grid = el('div.starter-grid');
      body.append(el('p.note', { text: 'A starting point: every layer stays editable. This replaces the current design (Undo brings it back).' }), grid, buttonRow(button('Cancel', () => close(null))));
      for (const entry of list) {
        const holder = el('div.starter-thumb', { text: 'Drawing...' });
        const card = el('button.starter-card', { type: 'button' }, holder, el('strong', { text: entry.name }), el('span.muted', { text: (entry.tags || []).join(', ') }));
        grid.append(card);
        fetch(new URL(`../../data/banner-designs/${entry.file}`, import.meta.url)).then(r => r.json()).then(async raw => {
          const design = normaliseDesign(raw);
          card.addEventListener('click', () => close(design));
          const assets = await prepare(design);
          const { canvas } = renderDesign(design, assets);
          canvas.className = 'starter-canvas';
          holder.replaceChildren(canvas);
        }).catch(() => {
          holder.textContent = 'Could not load';
        });
      }
    }, { wide: true });
    if (chosen) this.setDesign(chosen);
  }

  /** Writes the PNG and the design into the package and puts the banner on the current page. */
  async useAsBanner() {
    const name = this.name || 'banner';
    const pngName = `${name}.png`;
    let bytes;
    try {
      bytes = await this.png();
    } catch (e) {
      toast(`Could not make the PNG: ${e.message}`, 'error');
      return;
    }
    const replacing = pngName in this.app.pkg.images;
    this.app.pkg.images[pngName] = bytes;
    this.app.pkg.other[`${name}.design.json`] = encoder.encode(this.designJson());
    this.saved = true;
    const sprites = [...new Set(this.design.layers.filter(l => l.type === 'sprite').flatMap(l => (l.source.kind === 'rsi' ? [l.source.rsi] : l.source.kind === 'layers' ? l.source.layers.map(x => x.rsi) : [])).map(rootedRsi))];
    const uploads = this.design.layers.some(l => l.type === 'sprite' && l.source.kind === 'image') || this.design.background.type === 'image';
    const backdrop = backgroundCredit(this.design.background);
    this.app.bannerMade(pngName, {
      blockId: this.options.blockId || null,
      replacing,
      height: this.design.height,
      attribution: {
        license: 'CC-BY-SA-3.0',
        copyright: `Banner made with the ExtraNet editor's Banner Studio${sprites.length ? `, using game sprites from ${sprites.join(', ')}` : ''}${backdrop ? `; background: ${backdrop}` : ''}${uploads ? '; includes uploaded art (credit its author here)' : ''}`,
        source: 'https://github.com/Ignies/ColonialMarinesUniverse',
      },
    });
    this.close(true);
    if (this.options.onDone) this.options.onDone(pngName);
  }
}
