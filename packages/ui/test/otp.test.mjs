import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { CodeInput } from '../dist/index.js';

async function setup(props) {
  const dom = new JSDOM('<div id="root"></div>');
  globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(CodeInput, { label: 'Код из SMS', value: '', onChange() {}, ...props })));
  return { dom, root, cleanup: async () => { await act(async () => root.unmount()); dom.window.close(); } };
}

test('one native accessible OTP input provides autofill hints and normalizes paste with six noninteractive visual cells', async () => {
  const changes = [];
  const app = await setup({ onChange: value => changes.push(value) });
  const input = document.querySelector('input');
  assert.equal(document.querySelectorAll('input').length, 1);
  assert.equal(input.autocomplete, 'one-time-code');
  assert.equal(input.inputMode, 'numeric');
  assert.equal(input.maxLength, 6);
  assert.equal(document.querySelector(`label[for="${input.id}"]`).textContent, 'Код из SMS');
  assert.equal(document.querySelectorAll('.mq-code-digit').length, 6);
  assert.equal(document.querySelector('.mq-code-digits').getAttribute('aria-hidden'), 'true');
  input.value = '12a3 4567';
  await act(async () => input.dispatchEvent(new app.dom.window.Event('input', { bubbles: true })));
  const paste = new app.dom.window.Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(paste, 'clipboardData', { value: { getData: () => '987 654' } });
  await act(async () => input.dispatchEvent(paste));
  assert.equal(paste.defaultPrevented, true);
  assert.deepEqual(changes, ['123456', '987654']);
  await app.cleanup();
});

test('filled/error/loading retain OTP value and accessible error without extra focus targets', async () => {
  let changes = 0;
  const app = await setup({ value: '123456', error: 'Неверный код', disabled: true, onChange: () => changes++ });
  const input = document.querySelector('input');
  assert.equal(input.value, '123456');
  assert.equal(input.disabled, true);
  await act(async () => input.dispatchEvent(new app.dom.window.Event('input', { bubbles: true })));
  assert.equal(changes, 0);
  assert.equal(input.getAttribute('aria-invalid'), 'true');
  assert.equal(document.getElementById(input.getAttribute('aria-describedby')).textContent, 'Неверный код');
  assert.equal([...document.querySelectorAll('.mq-code-digit')].map(cell => cell.textContent).join(''), '123456');
  await app.cleanup();
});
