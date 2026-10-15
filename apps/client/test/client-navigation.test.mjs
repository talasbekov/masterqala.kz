import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { ClientNavigationView } from '../.test-build/components/ClientNavigationView.js';

async function setup(pathname) {
  const dom = new JSDOM('<div id="root"></div>', { url: `https://test.masterqala.local${pathname}` });
  globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(ClientNavigationView, { pathname, labels: { order: 'Заказать мастера', orders: 'Мои заказы', profile: 'Профиль', home: 'Главная', notifications: 'Уведомления', navigation: 'Навигация' }, languageControl: React.createElement('button', { id: 'language' }, 'RU · Астана') })));
  return { dom, root, cleanup: async () => { await act(async () => root.unmount()); dom.window.close(); } };
}

test('desktop/mobile route destinations remain accessible and detail route marks only its parent tab', async () => {
  const app = await setup('/order/1842');
  const desktop = document.querySelector('.mq-client-desktop-nav');
  assert.deepEqual([...desktop.querySelectorAll('a')].map(link => link.getAttribute('href')), ['/order/new', '/orders', '/profile']);
  const mobile = document.querySelector('.mq-client-mobile-nav');
  assert.deepEqual([...mobile.querySelectorAll('a')].map(link => link.getAttribute('href')), ['/', '/orders', '/notifications', '/profile']);
  assert.deepEqual([...mobile.querySelectorAll('[aria-current="page"]')].map(link => link.getAttribute('href')), ['/orders']);
  assert.equal(document.querySelector('#language').textContent, 'RU · Астана');
  await app.cleanup();
});

test('shell source constraints remove sidebar width and use a four-column narrow navigation fallback', async () => {
  const app = await setup('/addresses');
  const brand = document.querySelector('.mq-client-brand');
  assert.equal(brand.getAttribute('href'), '/');
  assert.equal(document.querySelector('aside'), null, 'no persistent width-consuming sidebar');
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.match(css, /\.mq-client-shell\s*\{[^}]*flex-direction:\s*column/);
  assert.match(css, /\.mq-client-main\s*\{[^}]*min-width:\s*0/);
  assert.match(css, /\.mq-client-mobile-nav\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /padding-bottom:\s*calc\(64px \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(css, /position:\s*fixed;[^}]*bottom:\s*0/);
  assert.match(css, /@media\s*\(max-width:\s*767px\)/);
  await app.cleanup();
});


test('active tab mapping preserves access to order creation and account subpages', async () => {
  for (const [pathname, desktopHref, mobileHref] of [
    ['/order/new', '/order/new', '/orders'], ['/planned/1842', '/orders', '/orders'],
    ['/addresses', '/profile', '/profile'], ['/notifications', null, '/notifications'], ['/', null, '/'],
  ]) {
    const app = await setup(pathname);
    const selected = selector => document.querySelector(`${selector} [aria-current="page"]`)?.getAttribute('href') ?? null;
    assert.equal(selected('.mq-client-desktop-nav'), desktopHref);
    assert.equal(selected('.mq-client-mobile-nav'), mobileHref);
    await app.cleanup();
  }
});


test('private layout retains direct-order shell exception instead of adding duplicate headers or tabs',()=>{
 const layout=readFileSync(new URL('../app/(app)/layout.tsx',import.meta.url),'utf8');
 assert.match(layout,/startsWith\('\/order\/'\)/);
 assert.match(layout,/if\(orderPage\)return[^;]*<AuthGuard>\{children\}<\/AuthGuard>/);
 assert.match(layout,/return <ClientShell><AuthGuard>\{children\}<\/AuthGuard><\/ClientShell>/);
 assert.doesNotMatch(layout,/<Sidebar/);
});
