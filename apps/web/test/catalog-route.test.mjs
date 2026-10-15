import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(new URL('../../../packages/ui/package.json',import.meta.url));const {JSDOM}=require('jsdom');const dom=new JSDOM('<div id="root"></div>',{url:'https://test.local/'});Object.assign(globalThis,{window:dom.window,self:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,CustomEvent:dom.window.CustomEvent,IS_REACT_ACT_ENVIRONMENT:true});Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');const ui=await import('@masterqala/ui');
const {MemoryRouter,Routes,Route,useLocation}=await import('react-router-dom');const {AuthProvider,useAuth}=await import('../.test-build/auth.js');const {default:Page}=await import('../.test-build/features/client-v2/pages/CatalogPage.js');
async function mount(language='en'){localStorage.clear();window.sessionStorage.clear();localStorage.setItem('token','fixture-a');localStorage.setItem('user',JSON.stringify({id:'A',phone:'+77010000000',name:'Actual A',role:'CLIENT'}));const reads=[],pushes=[];globalThis.fetch=(url,options)=>new Promise((resolve,reject)=>reads.push({path:new URL(url).pathname.replace('/api/v1',''),method:options.method??'GET',reject,resolve:body=>resolve({ok:true,status:200,json:async()=>body})}));const root=createRoot(document.getElementById('root'));let auth;function Controls(){auth=useAuth();return null};const content=React.createElement(React.Fragment,null,React.createElement(Controls),React.createElement(Page));
function Destination(){const location=useLocation();return React.createElement('p',null,'Actual destination '+location.pathname)}function Router(){return React.createElement(MemoryRouter,{initialEntries:['/catalog']},React.createElement(Routes,null,React.createElement(Route,{path:'/catalog',element:content}),React.createElement(Route,{path:'*',element:React.createElement(Destination)})))}
await act(async()=>root.render(React.createElement(ui.LocaleProvider,{initialLanguage:language},React.createElement(AuthProvider,null,React.createElement(Router)))));return {reads,auth:()=>auth,resolve:(i,body)=>act(async()=>reads[i].resolve(body)),cleanup:async()=>{await act(async()=>auth.logout());await act(async()=>root.unmount())}}}

const categories=[{id:'fixture-cat',slug:'fixture',name:'Actual service'}];
for(const language of ['ru','kk','en'])test(`${language} actual catalog searches actual categories and navigates without modifying submitted draft`,async()=>{
 const a=await mount(language);
 try {
  assert.deepEqual(a.reads.map(r=>r.path),['/categories']);
  await a.resolve(0,categories);
  assert.ok(document.querySelector('input[type="search"]'));
  assert.equal(document.querySelector('h1').textContent,({ru:'Услуги',kk:'Қызметтер',en:'Services'})[language]);
  const draft=ui.createDraftSession('A',window.sessionStorage);
  for(const [key,value] of Object.entries({step:4,categoryId:'11111111-1111-4111-8111-111111111111',description:'Saved task',addressText:'Actual address',district:'Actual district',geo:{lat:51.2,lng:71.6},locationChosen:true}))draft.set(key,value);
  draft.dispose();ui.beginPendingCreate('A',window.sessionStorage,ui.currentOrderSubmission(ui.readNewOrderDraft('A')));
  const pending=window.sessionStorage.getItem(ui.CREATE_PENDING_KEY),saved=window.sessionStorage.getItem(ui.DRAFT_STORAGE_KEY);
  const input=document.querySelector('input[type="search"]');
  await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,' ACTUAL ');input.dispatchEvent(new window.Event('input',{bubbles:true}));});
  const link=document.querySelector('a[href="/order/new"]');assert.match(link.getAttribute('aria-label'),/Actual service/);
  await act(async()=>link.dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true,button:0})));
  assert.match(document.body.textContent,/Actual destination \/order\/new/);
  assert.equal(window.sessionStorage.getItem(ui.CREATE_PENDING_KEY),pending);assert.equal(window.sessionStorage.getItem(ui.DRAFT_STORAGE_KEY),saved);
  assert.ok(a.reads.every(r=>r.method==='GET'));assert.equal(a.reads.length,1);
 }finally{await a.cleanup()}
});
test('actual catalog malformed response shows error, retries and provides real Home navigation',async()=>{
 const a=await mount();try{await a.resolve(0,{notCategories:[]});assert.ok(document.querySelector('[role="alert"]'));assert.equal(document.querySelector('[data-category-empty]'),null);await act(async()=>document.querySelector('[role="alert"] button').click());await a.resolve(1,[]);assert.ok(document.querySelector('[data-category-empty]'));await act(async()=>document.querySelector('a[href="/"]').dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true,button:0})));assert.equal(document.body.textContent,'Actual destination /');assert.ok(a.reads.every(r=>r.method==='GET'))}finally{await a.cleanup()}
});
