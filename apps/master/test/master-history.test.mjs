import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {RouterFixture,traverseHistory} from './router-fixture.mjs';
const require=createRequire(new URL('../../../packages/ui/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="root"></div>',{url:'https://test.local/'});
Object.assign(globalThis,{window:dom.window,self:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,CustomEvent:dom.window.CustomEvent,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const ui=await import('@masterqala/ui');
const {AuthProvider,useAuth,History,parseMasterHistory}=await import(process.env.MASTER_HISTORY_TEST_BUILD ?? '../.test-build/test/history-entry.js');
const user=id=>({id,phone:'fixture',name:id,role:'CLIENT'});
const item=(id,kind='urgent')=>({id,kind,status:'CLOSED',district:'Fixture district',createdAt:'2026-10-01T00:00:00.000Z',category:{slug:'fixture-category',name:`Fixture ${id}`}});
async function mount(language='en',href='/history') {
  window.history.replaceState({},'',href);
  const navigations=[];
  localStorage.clear();localStorage.setItem('user',JSON.stringify(user('A')));localStorage.setItem('token','fixture-a');
  const requests=[];
  globalThis.fetch=(url,options)=>new Promise((resolve,reject)=>requests.push({url,options,reject,resolve:body=>resolve({ok:true,status:200,json:async()=>body})}));
  let auth,locale; function Probe(){auth=useAuth();locale=ui.useLocale();return null;}
  const root=createRoot(document.getElementById('root'));
  await act(async()=>root.render(React.createElement(RouterFixture,{navigations},React.createElement(ui.LocaleProvider,{initialLanguage:language},React.createElement(AuthProvider,null,React.createElement(Probe),React.createElement(History))))));
  return {requests,navigations,auth:()=>auth,locale:()=>locale,resolve:(i,body)=>act(async()=>requests[i].resolve(body)),cleanup:()=>act(async()=>root.unmount())};
}
const click=selector=>act(async()=>document.querySelector(selector).click());
test('history aside retains DONE awaiting acceptance and excludes server terminal statuses across filters',async()=>{
  const a=await mount();try{
    const terminal=[{...item('no-master'),status:'NO_MASTERS'},item('closed'),{...item('expired','planned'),status:'EXPIRED'}];
    await a.resolve(0,{items:[...terminal,{...item('awaiting-acceptance'),status:'DONE'}],nextCursor:null});
    const aside=()=>document.querySelector('.mq-master-dashboard__aside');
    assert.ok(aside().querySelector('a[href="/order/awaiting-acceptance"]'));
    assert.equal(aside().querySelector('a[href="/order/no-master"]'),null);
    await click('[data-history-filter="history"]');
    assert.equal(new URL(a.requests[1].url).searchParams.get('filter'),'history');
    await a.resolve(1,{items:terminal,nextCursor:null});
    assert.equal(aside().querySelector('a[href^="/order/"],a[href^="/planned/"]'),null);
    assert.equal(document.querySelectorAll('.mq-master-history__row').length,terminal.length);
    assert.ok(a.requests.every(r=>(r.options.method??'GET')==='GET'));
  }finally{await a.cleanup();}
});
for(const [language,title] of [['ru','Мои заказы'],['kk','Менің тапсырыстарым'],['en','My orders']]) test(`${language} real view reads only history endpoint and preserves urgent/planned links`,async()=>{
  const a=await mount(language);try{
    assert.equal(document.querySelector('h1').textContent,title); assert.ok(document.querySelector('[role="status"]'));
    assert.equal(new URL(a.requests[0].url).pathname,'/api/v1/master/orders');
    await a.resolve(0,{items:[{...item('u'),category:{slug:'plumbing',name:'Seed name'}},item('p','planned')],nextCursor:null});
    assert.equal(document.querySelector('li h2').textContent,language==='en'?'Plumbing':'Сантехника');
    assert.ok(document.querySelector('a[href="/order/u"]'));assert.ok(document.querySelector('a[href="/planned/p"]'));
    assert.ok(document.querySelector('a[href="/"]'));
    assert.equal(a.requests[0].options.cache,'no-store'); assert.ok(a.requests.every(r=>(r.options.method??'GET')==='GET'));
  }finally{await a.cleanup();}
});
test('owner ABA, logout, and unmount isolate and abort requests; retained retry cannot fetch old owner',async()=>{
  const a=await mount();try{
    await act(async()=>a.auth().login('fixture-b',user('B')));await act(async()=>a.auth().login('fixture-a-new',user('A')));
    assert.equal(a.requests[0].options.signal.aborted,true);assert.equal(a.requests[1].options.signal.aborted,true);
    await a.resolve(0,{items:[item('stale-a')],nextCursor:null});await a.resolve(1,{items:[item('stale-b')],nextCursor:null});
    assert.doesNotMatch(document.body.textContent,/stale/);
    await a.resolve(2,{items:[item('current')],nextCursor:null});assert.match(document.body.textContent,/Fixture current/);
    await act(async()=>a.auth().logout());assert.doesNotMatch(document.body.textContent,/Fixture current/);assert.equal(a.requests.length,3);
  }finally{await a.cleanup();}
});
test('filter switches hide old rows and discard late pages; language change does not refetch',async()=>{
  const a=await mount();try{
    await click('[data-history-filter="history"]');assert.equal(a.requests[0].options.signal.aborted,true);
    await a.resolve(0,{items:[item('stale')],nextCursor:null});assert.doesNotMatch(document.body.textContent,/Fixture stale/);
    assert.equal(new URL(a.requests[1].url).searchParams.get('filter'),'history');
    await a.resolve(1,{items:[item('history')],nextCursor:null});await act(async()=>a.locale().setLanguage('kk'));
    assert.equal(a.requests.length,2);assert.match(document.body.textContent,/Fixture history/);
  }finally{await a.cleanup();}
});
test('malformed response is an error, retry is single-flight, and empty appears only after successful read',async()=>{
  const a=await mount();try{
    await a.resolve(0,[]);assert.ok(document.querySelector('[role="alert"]'));assert.equal(document.querySelector('[data-history-empty]'),null);
    await act(async()=>{const button=document.querySelector('[role="alert"] button');button.click();button.click();});assert.equal(a.requests.length,2);
    await a.resolve(1,{items:[],nextCursor:null});assert.ok(document.querySelector('[data-history-empty]'));
  }finally{await a.cleanup();}
});
test('pagination retains successful rows on error, retries exact cursor once and appends deduplicated rows',async()=>{
  const a=await mount();try{
    await a.resolve(0,{items:[item('one')],nextCursor:'cursor-one'});
    await act(async()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='Show more');button.click();button.click();});assert.equal(a.requests.length,2);
    assert.equal(new URL(a.requests[1].url).searchParams.get('cursor'),'cursor-one');
    await act(async()=>a.requests[1].reject(new Error('network')));assert.match(document.body.textContent,/Fixture one/);
    await click('[role="alert"] button');await a.resolve(2,{items:[item('one'),item('two','planned')],nextCursor:null});
    assert.equal(document.querySelectorAll('li').length,2);assert.ok(a.requests.every(r=>(r.options.method??'GET')==='GET'));
  }finally{await a.cleanup();}
});
test('unmount and remount reads anew without mutation or retained rows',async()=>{
  const a=await mount();await a.cleanup();assert.equal(a.requests[0].options.signal.aborted,true);
  const b=await mount();try {await a.resolve(0,{items:[item('old-route')],nextCursor:null});assert.doesNotMatch(document.body.textContent,/old-route/);await b.resolve(0,{items:[item('new-route')],nextCursor:null});assert.match(document.body.textContent,/new-route/);assert.equal(b.requests.length,1);assert.equal(b.requests[0].options.method,undefined);}finally{await b.cleanup();}
});
test('parser rejects malformed identities, dates, duplicate keys and cursors',()=>{
  for(const value of [null,{},[],{items:[item('../secret')],nextCursor:null},{items:[{...item('x'),createdAt:'bad'}],nextCursor:null},{items:[item('x'),item('x')],nextCursor:null},{items:[],nextCursor:'bad cursor'}])assert.throws(()=>parseMasterHistory(value));
});


const selectedFilter=()=>document.querySelector('[data-history-filter][aria-pressed="true"]').dataset.historyFilter;
for(const filter of ['all','active','history'])test(`history opens directly at the URL-backed ${filter} filter`,async()=>{
  const a=await mount('en',`/history?filter=${filter}`);
  try {
    assert.equal(selectedFilter(),filter);
    assert.equal(a.requests.length,1);
    assert.equal(new URL(a.requests[0].url).searchParams.get('filter'),filter);
    assert.deepEqual(a.navigations,[]);
  } finally {await a.cleanup();}
});
for(const query of ['','?filter=invalid','?filter=','?filter=%2Factive'])test(`history safely falls back to all for ${query||'a missing filter'}`,async()=>{
  const a=await mount('en',`/history${query}`);
  try {
    assert.equal(selectedFilter(),'all');
    assert.equal(new URL(a.requests[0].url).searchParams.get('filter'),'all');
    assert.equal(a.requests.length,1);
    assert.deepEqual(a.navigations,[]);
  } finally {await a.cleanup();}
});
test('history filter selection updates its URL without dropping unrelated query state or duplicating the current selection',async()=>{
  const a=await mount('en','/history?source=workspace&filter=all');
  try {
    await click('[data-history-filter="active"]');
    assert.equal(window.location.pathname,'/history');
    assert.equal(new URLSearchParams(window.location.search).get('filter'),'active');
    assert.equal(new URLSearchParams(window.location.search).get('source'),'workspace');
    assert.equal(selectedFilter(),'active');
    assert.equal(a.navigations.length,1);
    await click('[data-history-filter="active"]');
    assert.equal(a.navigations.length,1);
    assert.equal(a.requests.length,2);
    assert.ok(a.requests.every(r=>(r.options.method??'GET')==='GET'));
  } finally {await a.cleanup();}
});
test('history restores a selected filter when the route remounts at the same URL',async()=>{
  const a=await mount();
  await click('[data-history-filter="history"]');
  const href=window.location.pathname+window.location.search;
  await a.cleanup();
  const b=await mount('en',href);
  try {
    assert.equal(selectedFilter(),'history');
    assert.equal(new URL(b.requests[0].url).searchParams.get('filter'),'history');
    assert.equal(b.requests.length,1);
  } finally {await b.cleanup();}
});
test('history follows native Back and Forward, hides old rows, and rejects responses from an abandoned filter',async()=>{
  const a=await mount('en','/history?filter=active');
  try {
    await a.resolve(0,{items:[{...item('active-first'),status:'DONE'}],nextCursor:null});
    await click('[data-history-filter="history"]');
    assert.equal(selectedFilter(),'history');assert.equal(new URLSearchParams(window.location.search).get('filter'),'history');assert.doesNotMatch(document.body.textContent,/Fixture active-first/);
    await a.resolve(1,{items:[item('history-first')],nextCursor:null});
    await traverseHistory('back');
    assert.equal(selectedFilter(),'active');assert.doesNotMatch(document.body.textContent,/Fixture history-first/);
    await traverseHistory('forward');
    assert.equal(selectedFilter(),'history');assert.equal(a.requests[2].options.signal.aborted,true);
    await a.resolve(2,{items:[item('abandoned-active')],nextCursor:null});
    assert.doesNotMatch(document.body.textContent,/Fixture abandoned-active/);
    await a.resolve(3,{items:[item('history-current')],nextCursor:null});
    assert.match(document.body.textContent,/Fixture history-current/);
    assert.deepEqual(a.requests.map(r=>new URL(r.url).searchParams.get('filter')),['active','history','active','history']);
    assert.ok(a.requests.every(r=>(r.options.method??'GET')==='GET'));
  } finally {await a.cleanup();}
});
