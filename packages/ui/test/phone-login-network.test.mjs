import test from 'node:test';
import assert from 'node:assert/strict';
import React, {act} from 'react';
import {JSDOM} from 'jsdom';
import {LoginForm, LocaleProvider, phoneLoginText, useLocale, usePhoneLogin} from '../dist/index.js';

const messages = {
  ru: 'Не удалось связаться с сервером. Проверьте подключение к интернету и попробуйте ещё раз.',
  kk: 'Серверге қосылу мүмкін болмады. Интернет байланысын тексеріп, қайталап көріңіз.',
  en: 'Unable to reach the server. Check your internet connection and try again.',
};

async function mount(language) {
  const dom = new JSDOM('<div id="root"></div>', {url: 'https://test.local'});
  Object.assign(globalThis, {window: dom.window, document: dom.window.document,
    localStorage: dom.window.localStorage, CustomEvent: dom.window.CustomEvent, IS_REACT_ACT_ENVIRONMENT: true});
  const {createRoot} = await import('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  let flow, locale, failure;
  const authenticated = [];
  function Host() {
    locale = useLocale();
    flow = usePhoneLogin({request: async () => {if (failure) throw failure; return null;},
      onAuthenticated: (...args) => authenticated.push(args), onSuccess: () => authenticated.push('navigate')});
    return React.createElement(LoginForm, {...flow, t: (key, values) => phoneLoginText(locale.language, key, values)});
  }
  await act(async () => root.render(React.createElement(LocaleProvider, {initialLanguage: language}, React.createElement(Host))));
  await act(async () => flow.onPhone('7000000001'));
  return {get: () => flow, fail: value => {failure = value;}, authenticated,
    language: value => act(async () => locale.setLanguage(value)),
    alert: () => document.querySelector('[role="alert"]')?.textContent,
    cleanup: async () => {await act(async () => root.unmount()); dom.window.close();}};
}

for (const language of ['ru', 'kk', 'en']) {
  for (const action of ['send', 'resend', 'verify']) test(`${language} ${action} shows a localized network error without losing input`, async () => {
    const a = await mount(language);
    try {
      if (action !== 'send') await act(async () => a.get().onRequest());
      if (action === 'verify') await act(async () => a.get().onCode('123456'));
      a.fail(new TypeError('Failed to fetch'));
      await act(async () => action === 'verify' ? a.get().onVerify() : a.get().onRequest());
      assert.equal(a.alert(), messages[language]);
      assert.equal(a.get().phone, '7000000001');
      assert.equal(a.get().step, action === 'send' ? 'phone' : 'sms');
      assert.equal(a.get().pendingAction, null);
      if (action === 'verify') assert.equal(a.get().code, '123456');
      assert.deepEqual(a.authenticated, []);
    } finally {await a.cleanup();}
  });
}

test('an existing network error follows locale changes and a retry clears it', async () => {
  const a = await mount('ru');
  try {
    a.fail(new TypeError('NetworkError when attempting to fetch resource.'));
    await act(async () => a.get().onRequest());
    for (const language of ['ru', 'kk', 'en']) {
      await a.language(language);
      assert.equal(a.alert(), messages[language]);
    }
    a.fail(null);
    await act(async () => a.get().onRequest());
    assert.equal(a.alert(), undefined);
    assert.equal(a.get().step, 'sms');
  } finally {await a.cleanup();}
});

for (const message of ['Load failed', 'fetch failed']) test(`browser network failure ${message} is localized`, async () => {
  const a = await mount('kk');
  try {
    a.fail(new TypeError(message));
    await act(async () => a.get().onRequest());
    assert.equal(a.alert(), messages.kk);
  } finally {await a.cleanup();}
});

for (const action of ['send', 'verify']) test(`${action} preserves useful API error messages`, async () => {
  const a = await mount('en');
  try {
    if (action === 'verify') {
      await act(async () => a.get().onRequest());
      await act(async () => a.get().onCode('123456'));
    }
    const message = action === 'send' ? 'Too many attempts. Try again in 10 minutes.' : 'The code has expired. Request another code.';
    a.fail(new Error(message));
    await act(async () => action === 'verify' ? a.get().onVerify() : a.get().onRequest());
    assert.equal(a.alert(), message);
    assert.deepEqual(a.authenticated, []);
  } finally {await a.cleanup();}
});
