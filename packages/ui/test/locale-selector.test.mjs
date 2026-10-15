import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { LocaleSelector, LOCALE_COPY } from '../dist/index.js';

function setup() {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://test.masterqala.local/orders/1842' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const root = createRoot(document.getElementById('root'));
  return { dom, root, cleanup: async () => { await act(async () => root.unmount()); dom.window.close(); } };
}

test('dialog explicitly centers despite Tailwind preflight margin reset', async () => {
  const { root, cleanup } = setup();
  const style = document.createElement('style');
  style.textContent = '* { margin: 0; }\n' + readFileSync(new URL('../src/locale.css', import.meta.url), 'utf8').replace(/^@import[^;]+;/gm, '');
  document.head.append(style);
  await act(async () => root.render(React.createElement(LocaleSelector, { open: true, locale: 'ru', onSelect() {}, onDismiss() {} })));
  const computed = window.getComputedStyle(document.querySelector('dialog'));
  assert.equal(computed.marginTop, 'auto');
  assert.equal(computed.marginLeft, 'auto');
  await cleanup();
});

test('renders accessible selector copy and options in all three languages', async () => {
  const { root, cleanup } = setup();
  for (const locale of ['ru', 'kk', 'en']) {
    await act(async () => root.render(React.createElement(LocaleSelector, { open: true, locale, onSelect() {}, onDismiss() {} })));
    const dialog = document.querySelector('dialog');
    assert.equal(dialog.open, true);
    assert.equal(document.getElementById(dialog.getAttribute('aria-labelledby')).textContent, LOCALE_COPY[locale].title);
    assert.equal(document.getElementById(dialog.getAttribute('aria-describedby')).textContent, LOCALE_COPY[locale].note);
    assert.deepEqual([...dialog.querySelectorAll('button')].map(button => button.textContent), ['Русский', 'Қазақша', 'English']);
    assert.equal(dialog.querySelector(`button[lang="${locale}"]`).getAttribute('aria-pressed'), 'true');
  }
  await cleanup();
});

test('selection closes a controlled selector and changes only the language callback', async () => {
  const { root, dom, cleanup } = setup();
  const events = [];
  function Harness() {
    const [open, setOpen] = React.useState(true);
    return React.createElement(LocaleSelector, { open, locale: 'ru', onSelect: value => events.push(['select', value]),
      onDismiss: () => { events.push(['dismiss']); setOpen(false); } });
  }
  await act(async () => root.render(React.createElement(Harness)));
  await act(async () => document.querySelector('button[lang="kk"]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
  assert.deepEqual(events, [['select', 'kk'], ['dismiss']]);
  assert.equal(document.querySelector('dialog').open, false);
  assert.equal(window.location.pathname, '/orders/1842');
  await cleanup();
});

test('Escape and backdrop dismiss without selecting a language', async () => {
  const { root, dom, cleanup } = setup();
  let dismissals = 0;
  let selections = 0;
  const onDismiss = () => { dismissals += 1; };
  await act(async () => root.render(React.createElement(LocaleSelector, {
    open: true, locale: 'ru', onSelect: () => { selections += 1; }, onDismiss,
  })));
  const dialog = document.querySelector('dialog');
  await act(async () => dialog.dispatchEvent(new dom.window.Event('cancel', { bubbles: false, cancelable: true })));
  dialog.getBoundingClientRect = () => ({ left: 100, top: 100, right: 500, bottom: 464 });
  await act(async () => dialog.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, clientX: 20, clientY: 20 })));
  assert.equal(dismissals, 2);
  assert.equal(selections, 0);
  await act(async () => root.render(React.createElement(LocaleSelector, { open: false, locale: 'ru', onSelect() {}, onDismiss })));
  assert.equal(dialog.open, false);
  assert.equal(dismissals, 2, 'closed selector does not dismiss again');
  await cleanup();
});
