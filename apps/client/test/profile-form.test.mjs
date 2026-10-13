import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { createInstance } from 'i18next';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import { readFileSync } from 'node:fs';
import { ProfileForm } from '../.test-build/components/ProfileForm.js';

async function setup() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://test.masterqala.local/profile' });
  globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const i18n = createInstance();
  await i18n.use(initReactI18next).init({ lng: 'ru', fallbackLng: 'ru', resources: Object.fromEntries(['ru', 'kk', 'en'].map(locale => [locale, { translation: JSON.parse(readFileSync(new URL(`../lib/locales/${locale}.json`, import.meta.url))) }])) });
  const root = createRoot(document.getElementById('root'));
  let saves = 0;
  const render = async props => act(async () => root.render(React.createElement(I18nextProvider, { i18n }, React.createElement(ProfileForm, { name: 'Ержан', phone: '+77011234532', loading: false, saving: false, error: '', onName() {}, onSave: () => saves++, languageControl: React.createElement('button', { type: 'button' }, 'Язык'), ...props }))));
  await render();
  return { dom, i18n, render, saves: () => saves, cleanup: async () => { await act(async () => root.unmount()); dom.window.close(); } };
}

test('personal form permanently labels editable name and read-only masked phone; locale changes preserve name', async () => {
  const app = await setup();
  const original = document.querySelector('input[name="name"]');
  for (const [locale, label] of [['ru', 'Имя'], ['kk', 'Аты'], ['en', 'Name']]) {
    await act(async () => app.i18n.changeLanguage(locale));
    const name = document.querySelector('input[name="name"]');
    assert.equal(name === original, true);
    assert.equal(name.value, 'Ержан');
    assert.equal(document.querySelector(`label[for="${name.id}"]`).textContent, label);
    const phone = document.querySelector('input[name="phone"]');
    assert.equal(phone.value, '+7 701 *** ** 32');
    assert.equal(phone.readOnly, true);
  }
  assert.equal(app.saves(), 0);
  await app.cleanup();
});

test('pending/loading suppress submit, error is accessible, and empty name remains allowed by existing API', async () => {
  const app = await setup();
  const submit = async () => act(async () => document.querySelector('form').dispatchEvent(new app.dom.window.Event('submit', { bubbles: true, cancelable: true })));
  await app.render({ saving: true, error: 'Save failed' }); await submit();
  assert.equal(document.querySelector('[role="alert"]').textContent, 'Save failed');
  assert.equal(document.querySelector('button[type="submit"]').getAttribute('aria-busy'), 'true');
  await app.render({ loading: true }); await submit();
  assert.equal(app.saves(), 0);
  await app.render({ name: '' }); await submit();
  assert.equal(app.saves(), 1);
  await app.cleanup();
});


test('profile layout source has no fixed 380px column on narrow screens', () => {
  const css = readFileSync(new URL('../../../packages/ui/src/account.css', import.meta.url), 'utf8');
  assert.match(css, /\.mq-profile-columns\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  const page = readFileSync(new URL('../app/(app)/profile/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /w-\[380px\]/);
});
