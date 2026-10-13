import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { TextField } from '../dist/index.js';

function setup() {
  const dom = new JSDOM('<!doctype html><div id="root"></div>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.getElementById('root'));
  return { dom, root, cleanup: async () => { await act(async () => root.unmount()); dom.window.close(); } };
}

test('field permanently labels its native input and preserves controlled value and input attributes', async () => {
  const { root, dom, cleanup } = setup();
  let inputs = 0;
  await act(async () => root.render(React.createElement(TextField, {
    label: 'Адрес', id: 'address', name: 'address', value: 'Кабанбай батыра, 40', onChange() {},
    autoComplete: 'street-address', required: true, onInput: () => { inputs += 1; },
  })));
  const input = document.querySelector('input');
  assert.equal(document.querySelector('label').htmlFor, input.id);
  assert.equal(document.querySelector('label').textContent, 'Адрес');
  assert.equal(input.value, 'Кабанбай батыра, 40');
  assert.equal(input.name, 'address');
  assert.equal(input.required, true);
  assert.equal(input.autocomplete, 'street-address');
  await act(async () => input.dispatchEvent(new dom.window.Event('input', { bubbles: true })));
  assert.equal(inputs, 1);
  await cleanup();
});

test('error and helper text describe the input without losing caller accessibility references', async () => {
  const { root, cleanup } = setup();
  await act(async () => root.render(React.createElement(TextField, {
    label: 'Мекенжай', error: 'Мекенжайды тексеріңіз', helper: 'Астана', 'aria-describedby': 'external-help',
  })));
  const input = document.querySelector('input');
  assert.equal(input.getAttribute('aria-invalid'), 'true');
  const ids = input.getAttribute('aria-describedby').split(' ');
  assert.equal(ids.includes('external-help'), true);
  assert.equal(ids.some(id => document.getElementById(id)?.textContent === 'Мекенжайды тексеріңіз'), true);
  assert.equal(ids.some(id => document.getElementById(id)?.textContent === 'Астана'), true);
  await cleanup();
});

test('disabled/loading prevent editing while loading keeps the current value', async () => {
  const { root, cleanup } = setup();
  for (const state of [{ disabled: true }, { loading: true }]) {
    await act(async () => root.render(React.createElement(TextField, { ...state, label: 'Address', value: 'Current address', onChange() {} })));
    const input = document.querySelector('input');
    assert.equal(input.disabled, true);
    assert.equal(input.value, 'Current address');
    if (state.loading) assert.equal(input.getAttribute('aria-busy'), 'true');
  }
  await cleanup();
});


test('focus treatment does not change field box-model border or padding', () => {
  const css = readFileSync(new URL('../src/controls.css', import.meta.url), 'utf8');
  const rule = css.match(/\.mq-field:focus-within:not\(\[data-error='true'\]\)\s*\{([^}]+)\}/)[1];
  assert.match(rule, /outline: 2px solid #123b52/);
  assert.match(rule, /outline-offset: -2px/);
  assert.doesNotMatch(rule, /border:|padding:/);
});
