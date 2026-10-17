import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../packages/ui/package.json', import.meta.url));
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://test.local/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const React = await import('react'), { act } = React, { createRoot } = await import('react-dom/client');
const { usePlannedOrder, parsePlannedDetail, parsePlannedFeed, ownPlannedBid, plannedActions, validBid, plannedDraftKey, readPlannedDraft, writePlannedDraft, clearPlannedDrafts, plannedCopy } = await import(process.env.MQ_PLANNED_TEST_BUILD || '../.test-build/test/planned-entry.js');
const item = (extra = {}) => ({ id: 'order-A', lifecycleModel: 'LEGACY', commercialMode: 'FREE_PILOT', status: 'PUBLISHED', masterId: null, category: { name: 'Repair' }, district: 'District', description: 'Task', slotStart: '2026-11-01T09:00:00Z', slotEnd: '2026-11-01T11:00:00Z', budget: 1000, _count: { bids: 0 }, ownBid: null, ...extra });
const ownBid = { id: 'bid-A', masterUserId: 'A', price: 1000, term: 'Today', comment: '' };
const bidValues = { price: 1000, term: 'Today', comment: '' };
async function mount(ownerId = 'A', id = 'order-A', assignedOnly = false) {
  let state;
  const requests = [], listeners = new Map(), root = createRoot(document.getElementById('root'));
  const api = (path, options = {}) => new Promise((resolve, reject) => requests.push({ path, options, resolve, reject }));
  const socket = { on: (event, fn) => listeners.set(event, fn), off: (event, fn) => { if (listeners.get(event) === fn) listeners.delete(event); } };
  const getSocket = () => socket;
  function Probe(props) { state = usePlannedOrder({ ...props, api, getSocket }); return React.createElement('div', null, state.order?.id); }
  const render = (ownerId, id = 'order-A', assignedOnly = false) => act(async () => root.render(React.createElement(Probe, { ownerId, id, assignedOnly })));
  await render(ownerId, id, assignedOnly);
  return { state: () => state, requests, listeners, render, resolve: (i, value) => act(async () => requests[i].resolve(value)), reject: (i) => act(async () => requests[i].reject(new Error('Network lost'))), cleanup: () => act(async () => root.unmount()) };
}
test('assigned route rejects foreign, unassigned, wrong-id and reserved detail; own order permits exact state actions', () => {
  for (const value of [item(), item({ masterId: 'B' }), item({ id: 'foreign', masterId: 'A' }), item({ masterId: 'A', lifecycleModel: 'PLATFORM_V1_RESERVED' })]) assert.throws(() => parsePlannedDetail(value, 'order-A', 'A', true));
  assert.equal(parsePlannedDetail(item({ masterId: 'A' }), 'order-A', 'A', true).masterId, 'A');
  assert.deepEqual(plannedActions(item({ masterId: 'A', status: 'MASTER_SELECTED' }), 'A'), ['confirm', 'decline']);
  assert.deepEqual(plannedActions(item({ masterId: 'A', status: 'CONFIRMED' }), 'A'), ['on-site', 'cancel']);
  assert.deepEqual(plannedActions(item({ masterId: 'A', status: 'IN_PROGRESS' }), 'A'), ['complete', 'cancel']);
  for (const status of ['DONE', 'CLOSED', 'CANCELLED_BY_CLIENT']) assert.deepEqual(plannedActions(item({ masterId: 'A', status }), 'A'), []);
});
test('eligible published details use actual bid capacity and expose only owner offer', () => {
  assert.deepEqual(plannedActions(item(), 'A'), ['bids']);
  assert.deepEqual(plannedActions(item({ _count: { bids: 5 } }), 'A'), []);
  assert.deepEqual(plannedActions(item({ ownBid }), 'A'), []);
  assert.equal(ownPlannedBid(item({ ownBid: { ...ownBid, masterUserId: 'B' } }), 'A'), null);
  assert.equal(parsePlannedFeed([item(), item({ lifecycleModel: 'PLATFORM_V1_RESERVED' })]).length, 1);
  assert.throws(() => parsePlannedFeed({}));
  assert.equal(validBid({ price: 1.5, term: 'Today' }), false);
  assert.equal(validBid({ price: 10, term: ' ' }), false);
});
test('drafts survive reload and Back by owner/id while tab storage stays independent and corruption is safe', () => {
  const storage = dom.window.sessionStorage; storage.clear();
  const draft = { price: '1000', term: 'Tomorrow', comment: 'Keep me' };
  assert.equal(writePlannedDraft(storage, 'A', 'one', draft), true);
  assert.deepEqual(readPlannedDraft(storage, 'A', 'one'), draft);
  assert.equal(readPlannedDraft(storage, 'B', 'one').price, '');
  assert.equal(readPlannedDraft(storage, 'A', 'two').price, '');
  const otherTab = new JSDOM('', { url: 'https://test.local/' }).window.sessionStorage;
  assert.equal(readPlannedDraft(otherTab, 'A', 'one').price, '');
  storage.setItem(plannedDraftKey('A', 'one'), '{broken');
  assert.equal(readPlannedDraft(storage, 'A', 'one').price, '');
  assert.equal(writePlannedDraft({ setItem() { throw new Error(); } }, 'A', 'one', draft), false);
  storage.setItem('unrelated', 'keep'); clearPlannedDrafts(storage);
  assert.equal(storage.getItem(plannedDraftKey('A', 'one')), null); assert.equal(storage.getItem('unrelated'), 'keep');
});
test('lost bid POST response reconciles ownBid before allowing retry; synchronous repeated actions send once', async () => {
  const app = await mount(); try {
    await app.resolve(0, item());
    await act(async () => { void app.state().act('bids', bidValues); void app.state().act('bids', bidValues); });
    assert.equal(app.requests.length, 2); assert.equal(app.requests[1].options.method, undefined);
    await app.resolve(1, item()); assert.equal(app.requests[2].options.method, 'POST');
    await app.reject(2); assert.equal(app.requests[3].options.method, undefined);
    await app.resolve(3, item({ ownBid, _count: { bids: 1 } }));
    assert.equal(app.state().issue, ''); assert.equal(app.state().fresh, true);
    await act(async () => { void app.state().act('bids', bidValues); }); assert.equal(app.requests.length, 4);
  } finally { await app.cleanup(); }
});
test('uncertain response blocks another POST until GET retry succeeds', async () => {
  const app = await mount(); try {
    await app.resolve(0, item()); await act(async () => { void app.state().act('bids', bidValues); });
    await app.resolve(1, item()); await app.reject(2); await app.reject(3);
    assert.equal(app.state().issue, 'uncertain'); assert.equal(app.state().fresh, false);
    await act(async () => { void app.state().act('bids', bidValues); }); assert.equal(app.requests.length, 4);
    await act(async () => { void app.state().refresh(); }); await app.resolve(4, item({ ownBid }));
    assert.equal(app.state().fresh, true);
  } finally { await app.cleanup(); }
});
test('fresh preflight catches selection change and sends no stale confirm', async () => {
  const app = await mount('A', 'order-A', true); try {
    await app.resolve(0, item({ masterId: 'A', status: 'MASTER_SELECTED', selectedBidId: 'first' }));
    await act(async () => { void app.state().act('confirm'); });
    await app.resolve(1, item({ masterId: 'A', status: 'MASTER_SELECTED', selectedBidId: 'second' }));
    assert.equal(app.requests.length, 2); assert.equal(app.state().issue, 'changed');
  } finally { await app.cleanup(); }
});
test('owner and id ABA invalidate old reads, retained actions and removed socket listeners', async () => {
  const app = await mount(); try {
    await app.resolve(0, item()); const oldAction = app.state().act, oldRefresh = app.state().refresh, oldSocket = app.listeners.get('planned:status');
    await app.render('B', 'order-B'); await app.render('A', 'order-A');
    await act(async () => { void oldAction('bids', bidValues); void oldRefresh(); oldSocket(); });
    assert.equal(app.requests.length, 3); assert.equal(app.state().order, null);
    await app.resolve(1, item({ id: 'order-B' })); assert.equal(app.state().order, null);
    await app.resolve(2, item()); assert.equal(app.state().order.id, 'order-A');
    await app.render(null); assert.equal(app.state().order, null); assert.equal(app.listeners.size, 0);
  } finally { await app.cleanup(); }
});
test('unmount during preflight never dispatches the mutation', async () => {
  const app = await mount(); await app.resolve(0, item());
  await act(async () => { void app.state().act('bids', bidValues); }); await app.cleanup();
  await app.resolve(1, item()); assert.equal(app.requests.length, 2);
});
test('retained rendered confirm cannot act on a refreshed replacement selection', async () => {
  const app = await mount('A', 'order-A', true); try {
    await app.resolve(0, item({ masterId: 'A', status: 'MASTER_SELECTED', selectedBidId: 'first' }));
    const oldAction = app.state().act;
    await act(async () => { void app.state().refresh(); });
    await app.resolve(1, item({ masterId: 'A', status: 'MASTER_SELECTED', selectedBidId: 'second' }));
    await act(async () => { void oldAction('confirm'); }); assert.equal(app.requests.length, 2);
  } finally { await app.cleanup(); }
});
test('decline reconciles release and clears private order details from the assigned route', async () => {
  const app = await mount('A', 'order-A', true); try {
    const selected = item({ masterId: 'A', status: 'MASTER_SELECTED', selectedBidId: 'bid-A', address: 'Private address', client: { phone: 'private' } });
    await app.resolve(0, selected); await act(async () => { void app.state().act('decline'); });
    await app.resolve(1, selected); await app.reject(2); await app.resolve(3, item());
    assert.equal(app.state().released, true); assert.equal(app.state().order, null); assert.equal(app.state().issue, '');
    await act(async () => { void app.state().act('confirm'); }); assert.equal(app.requests.length, 4);
  } finally { await app.cleanup(); }
});
test('offline and failed refresh retain details without allowing mutation', async () => {
  const app = await mount(); try {
    await app.resolve(0, item());
    await act(async () => window.dispatchEvent(new dom.window.Event('offline')));
    await act(async () => { void app.state().act('bids', bidValues); }); assert.equal(app.requests.length, 1);
    await act(async () => { void app.state().refresh(); }); await app.reject(1);
    assert.equal(app.state().order.id, 'order-A'); assert.equal(app.state().fresh, false);
    await act(async () => { void app.state().act('bids', bidValues); }); assert.equal(app.requests.length, 2);
  } finally { await app.cleanup(); }
});
test('all three locale dictionaries include the full workflow without raw state names', () => {
  const keys = Object.keys(plannedCopy('en'));
  for (const language of ['ru', 'kk', 'en']) { const copy = plannedCopy(language); assert.deepEqual(Object.keys(copy), keys); assert.ok(Object.values(copy).every(value => typeof value === 'string' && value.length > 0)); assert.notEqual(copy.MASTER_SELECTED, 'MASTER_SELECTED'); }
});
