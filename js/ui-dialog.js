// Modal dialogs and small form helpers.

import { el } from './util.js';

/** Opens a modal. build(body, close) fills it; returns a promise of the value passed to close(). */
export function modal(title, build, { wide = false } = {}) {
  return new Promise(resolve => {
    const dialog = el(`dialog.modal${wide ? '.modal-wide' : ''}`);
    const close = value => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    const body = el('div.modal-body');
    dialog.append(
      el('div.modal-head', {}, el('span.modal-title', { text: title }), el('button.btn.btn-icon', { type: 'button', text: 'X', title: 'Close', onclick: () => close(null) })),
      body);
    dialog.addEventListener('cancel', e => {
      e.preventDefault();
      close(null);
    });
    document.body.append(dialog);
    build(body, close);
    dialog.showModal();
    const first = body.querySelector('input, select, textarea, button');
    if (first) first.focus();
  });
}

export function field(label, input, hint) {
  return el('label.field', {}, el('span.field-label', { text: label }), input, hint ? el('span.field-hint', { text: hint }) : null);
}

export function textInput(value, props = {}) {
  return el('input.input', { type: 'text', value: value ?? '', spellcheck: false, ...props });
}

export function select(options, value, props = {}) {
  const node = el('select.input', props);
  for (const option of options) {
    const [v, label] = Array.isArray(option) ? option : [option, option];
    node.append(el('option', { value: v, text: label, selected: v === value }));
  }
  node.value = value ?? '';
  return node;
}

export function buttonRow(...buttons) {
  return el('div.button-row', {}, ...buttons);
}

export function button(text, onclick, cls = '') {
  return el(`button.btn${cls}`, { type: 'button', text, onclick });
}

/** Simple form dialog. fields: [{ key, label, value, type: 'text'|'select'|'color'|'number'|'textarea', options, hint }] */
export function formDialog(title, fields, okLabel = 'Insert') {
  return modal(title, (body, close) => {
    const inputs = {};
    for (const f of fields) {
      let input;
      if (f.type === 'select') input = select(f.options, f.value);
      else if (f.type === 'textarea') input = el('textarea.input', { rows: 3, value: f.value ?? '' });
      else if (f.type === 'checkbox') input = el('input', { type: 'checkbox', checked: !!f.value });
      else if (f.type === 'color') input = colourInput(f.value);
      else input = textInput(f.value, f.type === 'number' ? { inputmode: 'decimal' } : {});
      if (f.list) {
        const id = `list-${f.key}-${Math.random().toString(36).slice(2)}`;
        input.setAttribute('list', id);
        body.append(el('datalist', { id }, f.list.map(v => el('option', { value: v }))));
      }
      inputs[f.key] = input;
      body.append(f.type === 'checkbox' ? el('label.check', {}, input, f.label) : field(f.label, input, f.hint));
    }
    const read = () => {
      const out = {};
      for (const f of fields) {
        const input = inputs[f.key];
        out[f.key] = f.type === 'checkbox' ? input.checked : f.type === 'color' ? input.value() : input.value;
      }
      return out;
    };
    body.append(buttonRow(button(okLabel, () => close(read()), '.btn-primary'), button('Cancel', () => close(null))));
    body.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') {
        e.preventDefault();
        close(read());
      }
    });
  });
}

/**
 * A colour picker paired with a #RRGGBB text box. Empty text means "not set".
 * Returns an element with value() and set(v), firing 'change' when edited.
 */
export function colourInput(value, { allowEmpty = false } = {}) {
  const picker = el('input.colour-swatch', { type: 'color', value: /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#000000' });
  const text = textInput(value || '', { placeholder: allowEmpty ? 'not set' : '#RRGGBB', maxlength: 9, className: 'input colour-text' });
  const wrap = el('span.colour-input', {}, picker, text);
  picker.addEventListener('input', () => {
    text.value = picker.value.toUpperCase();
    wrap.dispatchEvent(new Event('change'));
  });
  text.addEventListener('input', () => {
    if (/^#[0-9a-fA-F]{6}$/.test(text.value)) picker.value = text.value;
    wrap.dispatchEvent(new Event('change'));
  });
  wrap.value = () => text.value.trim();
  wrap.set = v => {
    text.value = v || '';
    if (/^#[0-9a-fA-F]{6}$/.test(v || '')) picker.value = v;
  };
  return wrap;
}

export function toast(message, level = 'info') {
  let host = document.querySelector('.toasts');
  if (!host) {
    host = el('div.toasts');
    document.body.append(host);
  }
  const node = el(`div.toast.toast-${level}`, { text: message });
  host.append(node);
  setTimeout(() => node.classList.add('toast-out'), level === 'error' ? 7000 : 3500);
  setTimeout(() => node.remove(), level === 'error' ? 7600 : 4100);
}

export function confirmDialog(title, message, okLabel = 'OK') {
  return modal(title, (body, close) => {
    body.append(el('p', { text: message }), buttonRow(button(okLabel, () => close(true), '.btn-primary'), button('Cancel', () => close(false))));
  });
}
