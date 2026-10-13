import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { readFileSync } from 'node:fs';
import { LoginForm } from '../.test-build/components/LoginForm.js';

async function setup(extra) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://test.masterqala.local/login' });
  globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // React was loaded before jsdom; only its legacy input-event shim needs these no-ops.
  dom.window.HTMLElement.prototype.attachEvent = function () {};
  dom.window.HTMLElement.prototype.detachEvent = function () {};
  const i18n = createInstance();
  await i18n.use(initReactI18next).init({ resources: Object.fromEntries(['ru', 'kk', 'en'].map(locale => [locale, { translation: JSON.parse(readFileSync(new URL(`../lib/locales/${locale}.json`, import.meta.url))) }])), lng: 'ru', fallbackLng: 'ru' });
  const root = createRoot(document.getElementById('root'));
  const calls = [];
  const props = { step: 'phone', phone: '7011234567', code: '', resendIn: 30, pendingAction: null, error: '', onPhone() {}, onCode() {}, onRequest: () => calls.push('request'), onVerify: () => calls.push('verify'), onChangeNumber: () => calls.push('change'), ...extra };
  const render = async changes => act(async () => root.render(React.createElement(I18nextProvider, { i18n }, React.createElement(LoginForm, { ...props, ...changes }))));
  await render();
  return { dom, i18n, root, render, calls, cleanup: async () => { await act(async () => root.unmount()); dom.window.close(); } };
}

test('phone form retains input across RU/KZ/EN and blocks incomplete/loading submit', async () => {
  const app = await setup();
  for (const locale of ['ru', 'kk', 'en']) {
    await act(async () => app.i18n.changeLanguage(locale));
    const input = document.querySelector('input[name="phone"]');
    assert.equal(input.value, '7011234567');
    assert.equal(input.type, 'tel');
    assert.equal(input.autocomplete, 'tel-national');
    assert.equal(document.querySelector(`label[for="${input.id}"]`).textContent.includes('auth.'), false);
  }
  const submit = async () => act(async () => document.querySelector('form').dispatchEvent(new app.dom.window.Event('submit', { bubbles: true, cancelable: true })));
  await app.render({ phone: '701', pendingAction: null }); await submit();
  await app.render({ pendingAction: 'send' }); await submit();
  assert.deepEqual(app.calls, []);
  await app.render({ pendingAction: null }); await submit();
  assert.deepEqual(app.calls, ['request']);
  await app.cleanup();
});

test('OTP form has accessible error, six-digit guard, cooldown and submitting resend suppression', async () => {
  const app = await setup({ step: 'sms', error: 'Неверный код' });
  assert.equal(document.querySelector('input').autocomplete, 'one-time-code');
  assert.equal(document.querySelector('[role="alert"]').textContent, 'Неверный код');
  assert.equal(document.querySelector('[data-resend]').disabled, true);
  await act(async () => document.querySelector('form').dispatchEvent(new app.dom.window.Event('submit', { bubbles: true, cancelable: true })));
  assert.deepEqual(app.calls, []);
  await app.render({ code: '123456', resendIn: 0, error: '' });
  await act(async () => document.querySelector('[data-resend]').click());
  await act(async () => document.querySelector('form').dispatchEvent(new app.dom.window.Event('submit', { bubbles: true, cancelable: true })));
  assert.deepEqual(app.calls, ['request', 'verify']);
  await app.render({ code: '123456', resendIn: 0, pendingAction: 'verify' });
  assert.equal(document.querySelector('[data-resend]').disabled, true);
  assert.equal(document.querySelector('[data-change-number]').disabled, true);
  await app.cleanup();
});


test('phone to OTP transition intentionally restores focus to the sole native code input', async () => {
  const app = await setup();
  const phone = document.querySelector('input[name="phone"]');
  await act(async () => phone.focus());
  assert.equal(document.activeElement === phone, true);
  await app.render({ step: 'sms' });
  assert.equal(document.activeElement === document.querySelector('input[name="code"]'), true);
  await app.render({ step: 'phone' });
  assert.equal(document.activeElement === document.querySelector('input[name="phone"]'), true);
  await app.cleanup();
});

test('resending and verifying present busy status only on the actual asynchronous action', async () => {
  const app = await setup({ step: 'sms', code: '123456', resendIn: 0 });
  await app.render({ pendingAction: 'resend' });
  assert.equal(document.querySelector('[data-resend]').getAttribute('aria-busy'), 'true');
  assert.equal(document.querySelector('[data-resend]').textContent, 'Отправка кода…');
  assert.equal(document.querySelector('button[type="submit"]').getAttribute('aria-busy'), null);
  assert.equal(document.querySelector('button[type="submit"]').disabled, true);
  await app.render({ pendingAction: 'verify' });
  assert.equal(document.querySelector('button[type="submit"]').getAttribute('aria-busy'), 'true');
  assert.equal(document.querySelector('button[type="submit"]').textContent, 'Проверка кода…');
  assert.equal(document.querySelector('[data-resend]').getAttribute('aria-busy'), null);
  assert.equal(document.querySelector('[data-resend]').disabled, true);
  await app.render({ pendingAction: null });
  assert.equal(document.querySelector('[data-resend]').disabled, false);
  await app.cleanup();
});


test('auth layout supplies viewport-height flex ancestors for mobile bottom actions', () => {
  const layout = readFileSync(new URL('../app/(auth)/layout.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.match(layout, /className="mq-auth-shell"/);
  assert.match(layout, /className="mq-auth-main"/);
  assert.match(css, /\.mq-auth-shell\s*\{[^}]*min-height:\s*100dvh;[^}]*display:\s*flex;[^}]*flex-direction:\s*column/);
  assert.match(css, /\.mq-auth-main\s*\{[^}]*flex:\s*1;[^}]*display:\s*flex/);
  assert.match(css, /\.mq-login-actions\s*\{[^}]*margin-top:\s*auto/);
});
