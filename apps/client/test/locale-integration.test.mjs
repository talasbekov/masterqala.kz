import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';

function coldStart(storage, select) {
  const moduleUrl = new URL('../.test-build/lib/i18n.js', import.meta.url).href;
  const source = `
    const data = new Map(JSON.parse(process.env.TEST_STORAGE));
    let networkCalls = 0;
    globalThis.window = Object.assign(new EventTarget(), { localStorage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) } });
    globalThis.document = { documentElement: { lang: 'ru' } };
    globalThis.fetch = () => { networkCalls += 1; throw new Error('Unexpected request'); };
    const { default: i18n } = await import(${JSON.stringify(moduleUrl)});
    const initialLanguage = i18n.language;
    if (process.env.TEST_SELECT) await i18n.changeLanguage(process.env.TEST_SELECT);
    console.log(JSON.stringify({ initialLanguage, language: i18n.language, documentLanguage: document.documentElement.lang, storage: [...data], networkCalls }));
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', source], {
    encoding: 'utf8', env: { ...process.env, TEST_STORAGE: JSON.stringify(storage), TEST_SELECT: select ?? '' },
  });
  return JSON.parse(output.trim().split('\n').at(-1));
}

test('actual client i18next module restores language on a fresh runtime and persists selection', () => {
  const draft = JSON.stringify({ id: '1842', status: 'PRICE_APPROVED', quoteVersion: 3, consentedVersion: 3 });
  const storage = [['mq.locale', 'kk'], ['orderDraft', draft], ['token', 'test-session']];
  const selected = coldStart(storage, 'en');
  assert.equal(selected.initialLanguage, 'kk');
  assert.equal(selected.language, 'en');
  assert.equal(selected.documentLanguage, 'en');
  assert.equal(new Map(selected.storage).get('mq.locale'), 'en');
  assert.equal(new Map(selected.storage).get('orderDraft'), draft);
  assert.equal(new Map(selected.storage).get('token'), 'test-session');
  assert.equal(selected.networkCalls, 0);
  const reloaded = coldStart(selected.storage);
  assert.equal(reloaded.initialLanguage, 'en');
  assert.deepEqual(reloaded.storage, selected.storage);
  assert.equal(reloaded.networkCalls, 0);
});

test('actual client initialization tolerates a blocked localStorage getter', () => {
  const moduleUrl = new URL('../.test-build/lib/i18n.js', import.meta.url).href;
  const source = `
    globalThis.window = Object.assign(new EventTarget(), {});
    Object.defineProperty(window,'localStorage',{get(){throw new Error('Blocked storage')}});
    globalThis.document = { documentElement: { lang: 'ru' } };
    const { default: i18n } = await import(${JSON.stringify(moduleUrl)});
    await i18n.changeLanguage('kk');
    console.log(JSON.stringify({ language: i18n.language, documentLanguage: document.documentElement.lang }));
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', source], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(output.trim().split('\n').at(-1)), { language: 'kk', documentLanguage: 'kk' });
});
