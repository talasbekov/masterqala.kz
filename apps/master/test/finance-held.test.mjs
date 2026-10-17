import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../packages/ui/package.json', import.meta.url));
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://test.local/' });
Object.assign(globalThis, { window: dom.window, self: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, CustomEvent: dom.window.CustomEvent, IS_REACT_ACT_ENVIRONMENT: true });
const React = await import('react'), { act } = React, { createRoot } = await import('react-dom/client');
const { LocaleProvider, useLocale } = await import('@masterqala/ui');
const { Wallet, Credits, MasterFinanceLinks } = await import('../.test-build/test/finance-entry.js');
const titles = { ru: ['Деньги и выплаты', 'Лид-кредиты'], kk: ['Ақша және төлемдер', 'Лид-кредиттер'], en: ['Money and payouts', 'Lead credits'] };
for (const language of ['ru', 'kk', 'en']) for (const [index, View] of [Wallet, Credits].entries()) {
  test(language + ' finance route has no API activity or financial input', async () => {
    const calls = []; globalThis.fetch = (...args) => { calls.push(args); throw new Error('Financial requests forbidden'); };
    const root = createRoot(document.getElementById('root'));
    try {
      await act(async () => root.render(React.createElement(LocaleProvider, { initialLanguage: language }, React.createElement(View))));
      assert.equal(document.querySelector('h1').textContent, titles[language][index]);
      assert.equal(document.querySelectorAll('input,form').length, 0);
      const button = document.querySelector('button');
      assert.equal(button.disabled, true);
      await act(async () => { button.click(); button.click(); });
      assert.equal(document.querySelectorAll('.mq-master-current-actions a').length, 2);
      assert.ok(document.querySelector('a[href="' + (index ? '/?tab=planned' : '/history') + '"]'));
      assert.ok(document.getElementById(button.getAttribute('aria-describedby')));
      assert.deepEqual(calls, []);
    } finally { await act(async () => root.unmount()); }
  });
}
test('finance links and mounted route follow locale changes without losing destinations', async () => {
  const root = createRoot(document.getElementById('root')); let locale;
  function Probe() { locale = useLocale(); return null; }
  try {
    await act(async () => root.render(React.createElement(LocaleProvider, { initialLanguage: 'ru' }, React.createElement(Probe), React.createElement(Wallet), React.createElement(MasterFinanceLinks))));
    const hrefs = [...document.querySelectorAll('a')].map(a => a.getAttribute('href'));
    for (const language of ['kk', 'en']) {
      await act(async () => locale.setLanguage(language));
      assert.equal(document.querySelector('h1').textContent, titles[language][0]);
      assert.deepEqual([...document.querySelectorAll('a')].map(a => a.getAttribute('href')), hrefs);
    }
  } finally { await act(async () => root.unmount()); }
});
