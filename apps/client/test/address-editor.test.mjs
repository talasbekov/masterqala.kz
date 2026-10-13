import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { readFileSync } from 'node:fs';
import { AddressDetails, AddressEditor } from '../.test-build/components/AddressEditor.js';

async function setup() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://test.masterqala.local/addresses' });
  globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const i18n = createInstance();
  const resources = Object.fromEntries(['ru', 'kk', 'en'].map(locale => [locale, { translation: JSON.parse(readFileSync(new URL(`../lib/locales/${locale}.json`, import.meta.url))) }]));
  await i18n.use(initReactI18next).init({ resources, lng: 'ru', fallbackLng: 'ru', interpolation: { escapeValue: false } });
  const root = createRoot(document.getElementById('root'));
  let saves = 0;
  const value = { label: 'Дом', address: 'Кабанбай батыра, 40', entrance: '3', floor: '7', apartment: '84', comment: 'код 84#', isDefault: true };
  const render = async extra => act(async () => root.render(React.createElement(I18nextProvider, { i18n }, React.createElement(AddressEditor, { value, onChange() {}, isNew: false, submitting: false, error: '', onSave: () => saves++, ...extra }))));
  return { dom, root, i18n, value, render, saves: () => saves, cleanup: async () => { await act(async () => root.unmount()); dom.window.close(); } };
}

test('real address editor changes only display copy in three languages while retaining all address values', async () => {
  const app = await setup();
  await app.render();
  for (const [locale, expected] of [['ru', 'Название'], ['kk', 'Атауы'], ['en', 'Name']]) {
    await act(async () => app.i18n.changeLanguage(locale));
    const field = document.querySelector('input[name="label"]');
    assert.equal(document.querySelector(`label[for="${field.id}"]`).textContent, expected);
    for (const name of ['label', 'address', 'entrance', 'floor', 'apartment', 'comment']) assert.equal(document.querySelector(`input[name="${name}"]`).value, app.value[name]);
    assert.equal(document.querySelector('input[type="checkbox"]').checked, true);
  }
  assert.equal(app.saves(), 0);
  assert.equal(window.location.pathname, '/addresses');
  await app.cleanup();
});

test('loading and invalid required values suppress duplicate submit; error remains accessible', async () => {
  const app = await setup();
  const submit = () => document.querySelector('form').dispatchEvent(new app.dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await app.render({ submitting: true, error: 'Server rejected address' });
  assert.equal(document.querySelector('[role="alert"]').textContent, 'Server rejected address');
  assert.equal([...document.querySelectorAll('input')].every(input => input.disabled), true);
  await act(async () => submit());
  assert.equal(app.saves(), 0);
  await app.render({ value: { ...app.value, address: '' } });
  await act(async () => submit());
  assert.equal(app.saves(), 0);
  await app.render();
  await act(async () => submit());
  assert.equal(app.saves(), 1);
  await app.cleanup();
});


test('saved address details use the current language and retain original values', async () => {
  const app = await setup();
  await act(async () => app.root.render(React.createElement(I18nextProvider, { i18n: app.i18n },
    React.createElement('span', { id: 'details' }, React.createElement(AddressDetails, { entrance: '3', floor: '7', apartment: '84' })))));
  for (const [locale, expected] of [['ru', ' · под. 3, эт. 7, кв. 84'], ['kk', ' · кір. 3, қаб. 7, пәт. 84'], ['en', ' · entr. 3, fl. 7, apt. 84']]) {
    await act(async () => app.i18n.changeLanguage(locale));
    assert.equal(document.querySelector('#details').textContent, expected);
  }
  assert.equal(app.saves(), 0);
  await app.cleanup();
});
