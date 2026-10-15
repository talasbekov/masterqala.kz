import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { createInstance } from 'i18next';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import { readFileSync } from 'node:fs';
import { usePhoneLogin } from '../.test-build/components/usePhoneLogin.js';
import { LoginForm } from '../.test-build/components/LoginForm.js';

async function setup() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://test.masterqala.local/login?returnTo=%2Forder%2F1842' });
  globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.HTMLElement.prototype.attachEvent = function () {}; dom.window.HTMLElement.prototype.detachEvent = function () {};
  const i18n = createInstance();
  await i18n.use(initReactI18next).init({ lng: 'ru', resources: { ru: { translation: JSON.parse(readFileSync(new URL('../lib/locales/ru.json', import.meta.url))) } } });
  let flow;
  const requests = [], authenticated = [], navigation = [];
  const request = (path, options) => new Promise((resolve, reject) => requests.push({ path, body: JSON.parse(options.body), resolve, reject }));
  function Harness() {
    flow = usePhoneLogin({ request, onAuthenticated: (...args) => authenticated.push(args), onSuccess: () => navigation.push('success') });
    return React.createElement(LoginForm, flow);
  }
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(I18nextProvider, { i18n }, React.createElement(Harness))));
  await act(async () => flow.onPhone('701 123 45 67'));
  return { flow: () => flow, requests, authenticated, navigation, cleanup: async () => { await act(async () => root.unmount()); dom.window.close(); } };
}

test('actual asynchronous login controller prevents duplicates and focuses OTP after send completion', async t => {
  const app = await setup();
  t.after(() => app.cleanup());
  let sending;
  await act(async () => { sending = app.flow().onRequest(); void app.flow().onRequest(); });
  assert.equal(app.requests.length, 1);
  assert.deepEqual(app.requests[0].body, { phone: '+77011234567' });
  assert.equal(document.querySelector('button[type="submit"]').textContent, 'Отправка кода…');
  await act(async () => { app.requests[0].resolve(null); await sending; });
  assert.equal(app.flow().step, 'sms');
  assert.equal(document.activeElement === document.querySelector('input[name="code"]'), true);
  await act(async () => app.flow().onCode('123456'));
  let verifying;
  await act(async () => { verifying = app.flow().onVerify(); void app.flow().onVerify(); });
  assert.equal(app.requests.length, 2);
  assert.deepEqual(app.requests[1].body, { phone: '+77011234567', code: '123456' });
  assert.equal(document.querySelector('button[type="submit"]').textContent, 'Проверка кода…');
  const user = { id: 'test-user', phone: '+77011234567', name: null, role: 'CLIENT' };
  await act(async () => { app.requests[1].resolve({ accessToken: 'test-token', user }); await verifying; });
  assert.deepEqual(app.authenticated, [['test-token', user]]);
  assert.deepEqual(app.navigation, ['success']);
});

test('resend has its own loading action and error releases guard without verifying or losing code', async t => {
  const app = await setup();
  t.after(async () => { t.mock.timers.reset(); await app.cleanup(); });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let sending;
  await act(async () => { sending = app.flow().onRequest(); });
  await act(async () => { app.requests[0].resolve(null); await sending; });
  for (let second = 0; second < 30; second++) await act(async () => t.mock.timers.tick(1000));
  assert.equal(app.flow().resendIn, 0);
  await act(async () => app.flow().onCode('123456'));
  let resending;
  await act(async () => { resending = app.flow().onRequest(); void app.flow().onRequest(); });
  assert.equal(app.requests.length, 2);
  assert.equal(document.querySelector('[data-resend]').getAttribute('aria-busy'), 'true');
  assert.equal(document.querySelector('[data-resend]').textContent, 'Отправка кода…');
  assert.equal(document.querySelector('button[type="submit"]').getAttribute('aria-busy'), null);
  await act(async () => { app.requests[1].reject(new Error('SMS unavailable')); await resending; });
  assert.equal(app.flow().pendingAction, null);
  assert.equal(app.flow().code, '123456');
  assert.equal(document.querySelector('[role="alert"]').textContent, 'SMS unavailable');
  assert.deepEqual(app.authenticated, []);
  assert.deepEqual(app.navigation, []);

});
