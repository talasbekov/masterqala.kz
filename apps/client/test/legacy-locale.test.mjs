import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(new URL('../../../packages/ui/package.json', import.meta.url));
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://test.local/' });
Object.assign(globalThis, { window: dom.window, self: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const React = await import('react'), { act } = React;
const { createRoot } = await import('react-dom/client');
const { createInstance } = await import('i18next');
const { I18nextProvider, initReactI18next } = await import('react-i18next');
const views = await import('../.test-build/test/legacy-locale-entry.js');
const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime.js');
const { RouterContext } = await import('next/dist/shared/lib/router-context.shared-runtime.js');
const router = { push(){}, replace(){}, back(){}, prefetch:async()=>{}, pathname:'/', asPath:'/' };
const resources = Object.fromEntries(['ru','kk','en'].map(l => [l, { translation: JSON.parse(readFileSync(new URL(`../lib/locales/${l}.json`, import.meta.url))) }]));
const order = { id: 'order-123', status: 'IN_PROGRESS', commercialMode: 'FREE_PILOT', calloutPrice: 0, workPrice: 4500, master: { name: 'Master' }, category: { name: 'Category' }, bids: [], description: 'Description', address: 'Address', slotStart: '2026-10-20T12:30:00Z' };
// Payments now uses LocaleProvider and GET /config/public. Its mounted language
// switching and no-write coverage lives in desktop-service.test.mjs.
for (const [view, key, commercialMode = 'FREE_PILOT', status = 'IN_PROGRESS'] of [['PriceView','orderDetail.pilotPriceNote'], ['DoneView','orderDetail.pilotDoneNote'], ['ProgressView','orderDetail.pilotProgressNote'], ['PactiveView','plannedStatus.IN_PROGRESS'], ['PriceView','orderDetail.priceRejectNote','PAID_MOCK'], ['DoneView','orderDetail.doneNote','PAID_MOCK'], ['ProgressView','orderDetail.progressNote','PAID_MOCK'], ['PactiveView','plannedStatus.MASTER_SELECTED','FREE_PILOT','MASTER_SELECTED']]) {
 test(`${view} ${commercialMode} ${status}: actual mounted RU/KK/EN switches preserve facts and send no writes`, async () => {
  let requests = 0; globalThis.fetch = () => { requests++; throw new Error('Unexpected request'); };
  const i18n = createInstance(); await i18n.use(initReactI18next).init({ lng: 'ru', fallbackLng: 'ru', resources });
  const root = createRoot(document.getElementById('root'));
  try {
   await act(async () => root.render(React.createElement(I18nextProvider, { i18n }, React.createElement(AppRouterContext.Provider, { value: router }, React.createElement(RouterContext.Provider, { value: router }, React.createElement(views[view], { order: { ...order, commercialMode, status }, orderId: order.id, onChanged(){} }))))));
   for (const language of ['ru','kk','en']) {
    await act(async () => i18n.changeLanguage(language));
    assert.ok(i18n.exists(key, { lng: language, fallbackLng: false }), `${language}: own translation ${key}`);
    assert.ok(document.body.textContent.includes(i18n.t(key, { price: 4500 })));
    assert.doesNotMatch(document.body.textContent, /(?:orderDetail|plannedDetail|payments|plannedStatus)\./);
    if (language === 'en') assert.doesNotMatch(document.body.textContent, /[А-Яа-яЁё]/);
    if (view === 'PactiveView' && status !== 'MASTER_SELECTED') {
     const date = new Date(order.slotStart).toLocaleString({ ru:'ru-RU', kk:'kk-KZ', en:'en-GB' }[language], { timeZone:'Asia/Almaty', weekday:'short', day:'2-digit', month:'long', hour:'2-digit', minute:'2-digit' });
     assert.ok(document.body.textContent.includes(date));
     assert.ok(document.body.textContent.includes('Master'));
    }
   }
   assert.equal(requests, 0);
  } finally { await act(async () => root.unmount()); }
 });
}

const plannedTerminalCases = [
 ['PlannedDoneView', 'DONE', null, ['doneTitle','workLabel','doneNote','confirmDone','openDispute']],
 ['PlannedClosedView', 'CLOSED', null, ['closedTitle','rateTitle','toHome']],
 ['PlannedClosedView', 'CLOSED', {rating:5,comment:null}, ['closedTitle','rateThanks','toHome']],
 ['PlannedClosedView', 'EXPIRED', null, ['closedExpiredTitle','toHome']],
 ['PlannedClosedView', 'CANCELLED', null, ['closedCancelledTitle','toHome']],
];
for (const [view,status,review,keys] of plannedTerminalCases) {
 test(`planned ${status} ${review?'reviewed':'unreviewed'}: actual terminal view owns every RU/KK/EN translation without fallback or writes`, async () => {
  let requests=0; globalThis.fetch=()=>{requests++;throw new Error('Unexpected request');};
  const i18n=createInstance();await i18n.use(initReactI18next).init({lng:'ru',fallbackLng:'ru',resources});
  const root=createRoot(document.getElementById('root'));
  try {
   await act(async()=>root.render(React.createElement(I18nextProvider,{i18n},React.createElement(AppRouterContext.Provider,{value:router},React.createElement(views[view],{order:{...order,status,review},orderId:order.id,onChanged(){}})))));
   for(const language of ['ru','kk','en']) {
    await act(async()=>i18n.changeLanguage(language));
    for(const key of keys) {
     assert.ok(i18n.exists(`plannedDetail.${key}`,{lng:language,fallbackLng:false}),`${language} must own plannedDetail.${key}`);
     assert.ok(document.body.textContent.includes(resources[language].translation.plannedDetail[key]),`${language} renders its own ${key}`);
    }
    assert.doesNotMatch(document.body.textContent,/plannedDetail\./);
    if(language==='en')assert.doesNotMatch(document.body.textContent,/[А-Яа-яЁё]/);
   }
   assert.equal(requests,0);
  } finally {await act(async()=>root.unmount());}
 });
}
