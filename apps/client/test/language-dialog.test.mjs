import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { LanguageDialogController, useLanguageDialog } from '../.test-build/components/LanguageDialogController.js';

async function setup(initial = '/orders/1842?tab=quote') {
  const dom = new JSDOM('<div id="root"></div>', { url: `https://test.masterqala.local${initial}` });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const root = createRoot(document.getElementById('root'));
  let router;
  let selections = [];
  function Content() {
    const open = useLanguageDialog();
    const [draft, setDraft] = React.useState('approved quote v3');
    return React.createElement(React.Fragment, null,
      React.createElement('button', { id: 'trigger', onClick: open }, 'language'),
      React.createElement('input', { id: 'order-draft', value: draft, onChange: event => setDraft(event.target.value) }));
  }
  function Harness() {
    const [href, setHref] = React.useState(window.location.pathname + window.location.search);
    const sync = () => setHref(window.location.pathname + window.location.search);
    React.useEffect(() => { window.addEventListener('popstate', sync); return () => window.removeEventListener('popstate', sync); }, []);
    router = { push(url) { window.history.pushState({}, '', url); sync(); }, replace(url) { window.history.replaceState({}, '', url); sync(); }, back() { window.history.back(); } };
    return React.createElement(LanguageDialogController, { href, router, locale: 'ru', onSelect: value => selections.push(value) }, React.createElement(Content));
  }
  await act(async () => root.render(React.createElement(Harness)));
  const click = async selector => act(async () => document.querySelector(selector).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
  const pop = async action => { await act(async () => { const event = new Promise(resolve => window.addEventListener('popstate', resolve, { once: true })); action(); await event; }); };
  return { dom, root, click, pop, selections, router: () => router, cleanup: async () => { await act(async () => root.unmount()); dom.window.close(); } };
}

test('router-owned Back closes one dialog without changing the current order or draft', { timeout: 3000 }, async () => {
  const app = await setup();
  const originalDraft = document.querySelector('#order-draft');
  await app.click('#trigger');
  assert.equal(document.querySelectorAll('dialog').length, 1);
  assert.equal(document.querySelector('dialog').open, true);
  assert.equal(window.location.search, '?tab=quote&modal=language');
  await app.pop(() => window.history.back());
  assert.equal(window.location.pathname + window.location.search, '/orders/1842?tab=quote');
  assert.equal(document.querySelector('dialog').open, false);
  assert.equal(document.querySelector('#order-draft').value, 'approved quote v3');
  assert.equal(document.querySelector('#order-draft'), originalDraft, 'query-only modal transition retains the mounted draft control');
  assert.deepEqual(app.selections, []);
  await app.click('#trigger');
  assert.equal(document.querySelector('dialog').open, true, 'same route can reopen after Back');
  await app.cleanup();
});

test('rapid close/reopen does not enqueue another history entry', { timeout: 3000 }, async () => {
  const app = await setup('/orders');
  await act(async () => app.router().push('/orders/1842'));
  await app.click('#trigger');
  await app.pop(() => {
    document.querySelector('button[lang="en"]').click();
    document.querySelector('#trigger').click();
  });
  assert.deepEqual(app.selections, ['en']);
  assert.equal(document.querySelector('dialog').open, false);
  await app.pop(() => window.history.back());
  assert.equal(window.location.pathname, '/orders');
  await app.cleanup();
});

test('navigation before popstate and unmount cannot retain a pending dialog lock', { timeout: 3000 }, async () => {
  const app = await setup();
  await app.click('#trigger');
  await act(async () => {
    document.querySelector('button[lang="kk"]').click();
    app.router().push('/profile');
  });
  assert.equal(window.location.pathname, '/profile');
  await app.click('#trigger');
  assert.equal(document.querySelector('dialog').open, true, 'new route can open immediately without awaiting a cancelled traversal');
  await act(async () => app.root.unmount());
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(LanguageDialogController, { href: '/profile?modal=language', router: app.router(), locale: 'ru', onSelect() {} })));
  assert.equal(document.querySelector('dialog').open, true, 'fresh mount has no global lock');
  await act(async () => root.unmount());
  app.dom.window.close();
});

test('direct query entry dismisses on the same route rather than going to an unrelated page', async () => {
  const app = await setup('/orders/1842?tab=quote&modal=language');
  await app.click('button[lang="en"]');
  assert.equal(window.location.pathname + window.location.search, '/orders/1842?tab=quote');
  assert.equal(document.querySelector('dialog').open, false);
  await app.cleanup();
});
