import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const seed = new JSDOM('<div></div>', {url:'https://fixture.local/'});
Object.assign(globalThis,{window:seed.window,document:seed.window.document});
const React=await import('react'), {act}=React;
const {createRoot}=await import('react-dom/client');
const ui=await import('../dist/index.js');
const rows = [{id:'actual-service',slug:'actual',name:'Actual plumbing'}, {id:'other-service',slug:'other',name:'Other repair'}];
async function mount(language='en') {
  assert.equal(typeof ui.useCategoryBrowser,'function');
  assert.equal(typeof ui.CategoryBrowserView,'function');
  const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.local/'});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,CustomEvent:dom.window.CustomEvent,IS_REACT_ACT_ENVIRONMENT:true});
  const requests=[];
  const api=path=>new Promise((resolve,reject)=>requests.push({path,resolve,reject}));
  let state, locale;
  function Host({read}){locale=ui.useLocale();state=ui.useCategoryBrowser({api:read});return React.createElement(ui.CategoryBrowserView,{...state,onRetry:()=>{void state.retry()},renderLink:({href,children,className,ariaLabel})=>React.createElement('a',{href,className,'aria-label':ariaLabel},children)});}
  const root=createRoot(document.getElementById('root'));
  await act(async()=>root.render(React.createElement(ui.LocaleProvider,{initialLanguage:language},React.createElement(Host,{read:api}))));
  return {requests,state:()=>state,changeLanguage:language=>act(async()=>locale.setLanguage(language)),replaceApi:()=>act(async()=>root.render(React.createElement(ui.LocaleProvider,{initialLanguage:language},React.createElement(Host,{read:path=>new Promise((resolve,reject)=>requests.push({path,resolve,reject}))})))),resolve:(i,value)=>act(async()=>requests[i].resolve(value)),reject:i=>act(async()=>requests[i].reject(new Error('Fixture failure'))),cleanup:async()=>{await act(async()=>root.unmount());dom.window.close()}};
}
for(const language of ['ru','kk','en']) test(`${language} public categories expose labelled local search and real generic order links`,async()=>{
  const a=await mount(language);
  try {
    assert.deepEqual(a.requests.map(r=>r.path),['/categories']);
    assert.ok(document.querySelector('[role="status"]'));
    await a.resolve(0,rows);
    assert.ok(document.querySelector('a[href="/"]'));
    assert.equal(document.querySelectorAll('a[href="/order/new"]').length,2);
    const input=document.querySelector('input[type="search"]');
    assert.ok(document.querySelector(`label[for="${input.id}"]`));
    await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,'  PLUMBING  ');input.dispatchEvent(new window.Event('input',{bubbles:true}));});
    assert.equal(document.querySelectorAll('a[href="/order/new"]').length,1);
    assert.match(document.body.textContent,/Actual plumbing/);
    assert.doesNotMatch(document.body.textContent,/Other repair|verified|15|24.?7/);
    await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,'Missing');input.dispatchEvent(new window.Event('input',{bubbles:true}));});
    assert.ok(document.querySelector('[data-category-no-match]'));
    assert.equal(document.querySelector('[data-category-empty]'),null);
    assert.equal(a.requests.length,1);
  } finally {await a.cleanup();}
});
test('malformed public response is not empty, retry keeps valid rows honestly stale and blocks duplicate requests',async()=>{
  const a=await mount();
  try {
    await a.resolve(0,{categories:[]});
    assert.ok(document.querySelector('[role="alert"]'));
    assert.equal(document.querySelector('[data-category-empty]'),null);
    await act(async()=>{void a.state().retry();void a.state().retry()});
    assert.equal(a.requests.length,2);
    await a.resolve(1,rows);
    await act(async()=>{void a.state().retry()});
    await a.reject(2);
    assert.equal(a.state().categories.length,2);
    assert.ok(document.querySelector('[data-category-stale]'));
    await act(async()=>{void a.state().retry()});
    await a.resolve(3,[]);
    assert.ok(document.querySelector('[data-category-empty]'));
    assert.equal(document.querySelector('[role="alert"]'),null);
  }finally{await a.cleanup();}
});
for(const value of [[{id:'same',slug:'real',name:'Valid'},{id:'same',slug:'real',name:'Duplicate'}],[{id:'empty',slug:'real',name:' '}],[{id:'empty',slug:'',name:'Actual'}]])test('invalid category keys/names never become valid rows',async()=>{const a=await mount();try{await a.resolve(0,value);assert.ok(a.state().error);assert.equal(a.state().categories.length,0);assert.equal(document.querySelector('[data-category-empty]'),null)}finally{await a.cleanup()}});
test('disposed public read and retained retry cannot initiate further requests',async()=>{const a=await mount();const retry=a.state().retry;await a.cleanup();await act(async()=>{a.requests[0].resolve(rows);void retry()});assert.equal(a.requests.length,1)});

test('new public API lifetime rejects old response and old retained retry',async()=>{
  const a=await mount();
  try {
    const oldRetry=a.state().retry;
    await a.replaceApi();
    assert.equal(a.requests.length,2);
    await a.resolve(1,rows);
    await a.resolve(0,[{id:'old',slug:'old',name:'Old source'}]);
    assert.equal(a.state().categories[0].id,'actual-service');
    await act(async()=>{void oldRetry()});
    assert.equal(a.requests.length,2);
  }finally{await a.cleanup();}
});

test('long actual names and locale-only changes preserve local search without another GET',async()=>{
 const a=await mount('en');try{
  const name='Actual plumbing '.repeat(40);await a.resolve(0,[{id:'long',slug:'actual',name}]);
  const input=document.querySelector('input[type="search"]');
  await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,'plumbing');input.dispatchEvent(new window.Event('input',{bubbles:true}));});
  await a.changeLanguage('kk');
  assert.equal(document.querySelector('h1').textContent,'Қызметтер');
  assert.equal(document.querySelector('input').value,'plumbing');
  assert.equal(document.querySelector('a[href="/order/new"]').textContent,name);
  assert.ok(document.querySelector('a[href="/order/new"]').className.includes('break-words'));
  assert.equal(a.requests.length,1);
 }finally{await a.cleanup()}
});
