// A flat colour.
export default {
  id: 'solid',
  name: 'Solid colour',
  tags: ['plain'],
  params: [
    { key: 'color', label: 'Colour', type: 'color', default: '#141A22' },
  ],
  draw(ctx, width, height, params) {
    ctx.fillStyle = params.color;
    ctx.fillRect(0, 0, width, height);
  },
};
