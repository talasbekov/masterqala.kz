import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { Button } from '../dist/index.js';

function setup() {
  const dom = new JSDOM('<!doctype html><div id="root"></div>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.getElementById('root'));
  return { dom, root, cleanup: async () => { await act(async () => root.unmount()); dom.window.close(); } };
}

test('Figma styles use a real button and default to non-submitting type', async () => {
  const { root, cleanup } = setup();
  for (const variant of ['primary', 'accent', 'secondary', 'white', 'danger']) {
    await act(async () => root.render(React.createElement(Button, { variant }, 'Продолжить')));
    const button = document.querySelector('button');
    assert.equal(button.type, 'button');
    assert.equal(button.textContent, 'Продолжить');
    assert.equal(button.dataset.variant, variant);
  }
  await cleanup();
});

test('disabled and loading block repeated clicks and retain localized accessible text', async () => {
  const { dom, root, cleanup } = setup();
  let clicks = 0;
  for (const state of [{ disabled: true }, { loading: true, loadingLabel: 'Жүктелуде…' }]) {
    await act(async () => root.render(React.createElement(Button, { ...state, onClick: () => { clicks += 1; } }, 'Жалғастыру')));
    const button = document.querySelector('button');
    assert.equal(button.disabled, true);
    await act(async () => { button.click(); button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    assert.equal(clicks, 0);
    if (state.loading) {
      assert.equal(button.getAttribute('aria-busy'), 'true');
      assert.equal(button.textContent, 'Жүктелуде…');
    }
  }
  await cleanup();
});

test('enabled button forwards form type, ref and click behavior', async () => {
  const { dom, root, cleanup } = setup();
  let clicks = 0;
  const ref = React.createRef();
  await act(async () => root.render(React.createElement(Button, { type: 'submit', ref, fullWidth: true, onClick: () => { clicks += 1; } }, 'Accept work')));
  const button = document.querySelector('button');
  assert.equal(ref.current, button);
  assert.equal(button.type, 'submit');
  assert.equal(button.classList.contains('w-full'), true);
  assert.equal(button.style.width, '');
  await act(async () => button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
  assert.equal(clicks, 1);
  await cleanup();
});
