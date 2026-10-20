// Ready-made shapes for the Banner Studio. Each is { id, name, layer } where layer holds shape layer fields
// (see README.md, "Banner Studio: adding art"); it is added at the middle of the banner and stays editable.

export const SHAPE_PRESETS = [
  {
    // The thin ring around the ball on the Spin Okafor banner.
    id: 'orbit-ring',
    name: 'Orbit ring',
    layer: {
      shape: 'ellipse', w: 220, h: 64, rotation: -8,
      fill: null, stroke: { color: '#6FA8FF', width: 1, dash: 'solid' }, pixel: true,
      glow: null, shadow: null,
    },
  },
  {
    id: 'price-burst',
    name: 'Price burst',
    layer: {
      shape: 'star', w: 76, h: 76, points: 14, inner: 0.78, rotation: 8,
      fill: { type: 'solid', color: '#FFD200' }, stroke: { color: '#7A1A00', width: 2, dash: 'solid' }, pixel: true,
      shadow: { color: '#00000088', blur: 0, x: 3, y: 3 }, glow: null,
    },
  },
  {
    id: 'panel-frame',
    name: 'Panel with frame',
    layer: {
      shape: 'rect', w: 120, h: 96, radius: 4,
      fill: { type: 'gradient', angle: 90, stops: [{ at: 0, color: '#2A3440' }, { at: 1, color: '#11161C' }] },
      stroke: { color: '#C9D4E0', width: 2, dash: 'solid' }, pixel: true,
      shadow: { color: '#000000AA', blur: 0, x: 3, y: 3 }, glow: null,
    },
  },
  {
    id: 'ribbon',
    name: 'Ribbon',
    layer: {
      shape: 'path', closed: true, path: [[-110, -14], [110, -14], [96, 0], [110, 14], [-110, 14], [-96, 0]],
      fill: { type: 'solid', color: '#C0262D' }, stroke: { color: '#5A0A0E', width: 2, dash: 'solid' }, pixel: true,
      shadow: { color: '#00000088', blur: 0, x: 2, y: 2 }, glow: null,
    },
  },
  {
    id: 'underline-rule',
    name: 'Underline rule',
    layer: {
      shape: 'rect', w: 300, h: 3, radius: 0,
      fill: { type: 'gradient', angle: 0, stops: [{ at: 0, color: '#FFFFFF00' }, { at: 0.5, color: '#FFFFFF' }, { at: 1, color: '#FFFFFF00' }] },
      stroke: null, pixel: false, shadow: null, glow: null,
    },
  },
  {
    id: 'spotlight-cone',
    name: 'Spotlight cone',
    layer: {
      shape: 'path', closed: true, path: [[-10, -60], [10, -60], [70, 60], [-70, 60]],
      fill: { type: 'gradient', angle: 90, stops: [{ at: 0, color: '#FFF6C8CC' }, { at: 1, color: '#FFF6C800' }] },
      stroke: null, pixel: false, shadow: null, glow: null, opacity: 0.8,
    },
  },
  {
    id: 'dashed-frame',
    name: 'Dashed frame',
    layer: {
      shape: 'rect', w: 500, h: 116, radius: 0,
      fill: null, stroke: { color: '#FFD24A', width: 2, dash: 'dashed' }, pixel: true, shadow: null, glow: null,
    },
  },
];
