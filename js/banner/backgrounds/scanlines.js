// A CRT screen: a glow from the middle and dark scanlines.
export default {
  id: 'scanlines',
  name: 'CRT scanlines',
  tags: ['terminal', 'retro'],
  params: [
    { key: 'base', label: 'Screen', type: 'color', default: '#0A0E12' },
    { key: 'glow', label: 'Glow', type: 'color', default: '#1F6B2C' },
    { key: 'gap', label: 'Line spacing', type: 'range', default: 3, min: 2, max: 8, step: 1 },
    { key: 'strength', label: 'Darkness', type: 'range', default: 0.35, min: 0, max: 1, step: 0.05 },
  ],
  draw(ctx, width, height, params) {
    ctx.fillStyle = params.base;
    ctx.fillRect(0, 0, width, height);
    const g = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.6);
    g.addColorStop(0, params.glow);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = `rgba(0, 0, 0, ${Number(params.strength)})`;
    const gap = Math.max(2, Number(params.gap));
    for (let y = 0; y < height; y += gap) ctx.fillRect(0, y, width, 1);
  },
};
