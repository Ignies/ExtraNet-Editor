// A two colour gradient at any angle.
export default {
  id: 'gradient',
  name: 'Two colour gradient',
  tags: ['plain', 'corporate'],
  params: [
    { key: 'from', label: 'From', type: 'color', default: '#0B1630' },
    { key: 'to', label: 'To', type: 'color', default: '#2A5C8A' },
    { key: 'angle', label: 'Angle', type: 'range', default: 90, min: 0, max: 360, step: 5 },
  ],
  draw(ctx, width, height, params) {
    const a = (Number(params.angle) * Math.PI) / 180;
    const dx = Math.sin(a);
    const dy = -Math.cos(a);
    const half = (Math.abs(dx) * width + Math.abs(dy) * height) / 2;
    const cx = width / 2;
    const cy = height / 2;
    const g = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
    g.addColorStop(0, params.from);
    g.addColorStop(1, params.to);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  },
};
