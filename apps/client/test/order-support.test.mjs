import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire,register} from 'node:module';
register('./home-socket-loader.mjs',import.meta.url);
register('./order-support-map-loader.mjs',import.meta.url);
const require=createRequire(new URL('../../../packages/ui/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="root"></div>',{url:'https://test.local/support'});
Object.assign(globalThis,{window:dom.window,self:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,CustomEvent:dom.window.CustomEvent,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const ui=await import('@masterqala/ui');
const {AppRouterContext}=await import('next/dist/shared/lib/app-router-context.shared-runtime.js');
const {RouterContext}=await import('next/dist/shared/lib/router-context.shared-runtime.js');
const {SearchParamsContext,PathParamsContext}=await import('next/dist/shared/lib/hooks-client-context.shared-runtime.js');
const {AuthProvider,useAuth,SupportPage,OrderPage,i18n}=await import('../.test-build/test/order-support-entry.js');
const order={id:'order-A',status:'DONE',lifecycleVersion:2,commercialMode:'FREE_PILOT',description:'Actual task',address:'Actual address',workPrice:8300,materialsPrice:420,calloutPrice:0,quoteTotal:8720,quoteVersion:3,consentedVersion:3,workComment:'Actual agreed work',departedAt:'2026-10-20T10:00:00Z',cancellationAmount:null,updatedAt:'2026-10-20T12:00:00Z',createdAt:'2026-10-20T09:00:00Z',review:null,master:null};
async function mount(initial='/support?orderId=order-A',language='en'){
 window.history.replaceState({},'',initial);
 localStorage.clear();window.sessionStorage.clear();localStorage.setItem('token','fixture-a');localStorage.setItem('user',JSON.stringify({id:'owner-A',phone:'fixture',role:'CLIENT',name:'A'}));
 const reads=[],pushes=[];let navigate,auth;
 globalThis.__homeSocket={on(){},off(){},disconnect(){}};
 globalThis.fetch=async(url,options={})=>{reads.push({url,method:options.method??'GET'});return {ok:true,status:200,json:async()=>({...order})}};
 await i18n.changeLanguage(language);
 function Probe(){auth=useAuth();return null;}
 function Router(){const [href,setHref]=React.useState(initial);React.useEffect(()=>{const onPop=()=>setHref(window.location.pathname+window.location.search);window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop)},[]);const url=new URL(href,'https://test.local');navigate=next=>{pushes.push(next);window.history.pushState({},'',next);setHref(next)};const router={push:navigate,replace:navigate,prefetch:async()=>{}};
 const page=url.pathname==='/support'?React.createElement(SupportPage):url.pathname.startsWith('/order/')?React.createElement(OrderPage):React.createElement('p',null,'Other destination');
 return React.createElement(AppRouterContext.Provider,{value:router},React.createElement(RouterContext.Provider,{value:{...router,pathname:url.pathname,asPath:href}},React.createElement(SearchParamsContext.Provider,{value:url.searchParams},React.createElement(PathParamsContext.Provider,{value:{id:url.pathname.split('/')[2]}},page))));}
 const root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(ui.LocaleProvider,{initialLanguage:language},React.createElement(AuthProvider,null,React.createElement(Probe),React.createElement(Router)))));
 return {reads,pushes,navigate:path=>act(async()=>navigate(path)),cleanup:()=>act(async()=>{auth.logout();root.unmount()})};
}
const click=node=>act(async()=>node.dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true,button:0})));
for(const language of ['ru','kk','en'])test(`${language}: order-specific help keeps exact return on mobile and desktop without submitting`,async()=>{
 const a=await mount('/support?orderId=order-A',language);try{
  for(const selector of ['.desktop-service-mobile','.desktop-service-desktop']){
   const view=document.querySelector(selector);assert.ok(view.querySelector('a[href="/order/order-A"]'));assert.match(view.textContent,/order-A/);assert.ok(view.querySelector('[data-service-unavailable]'));
  }
  assert.equal(a.reads.length,0);assert.equal(document.querySelectorAll('form,input,textarea').length,0);
  await click(document.querySelector('.desktop-service-mobile a[href="/order/order-A"]'));
  assert.equal(a.pushes.at(-1),'/order/order-A');assert.equal(a.reads.length,1);assert.ok(a.reads.every(r=>r.method==='GET'));
 }finally{await a.cleanup();}
});
test('actual lifecycle Help retains order identity, quote and acceptance stage through repeat/back',async()=>{
 const a=await mount('/order/order-A');try{
  const before=JSON.stringify(order);
  for(let i=0;i<2;i++){
   await click(document.querySelector('[data-action="report-problem"]'));
   assert.equal(a.pushes.at(-1),'/support?orderId=order-A');
   assert.ok(document.querySelector('[data-service-unavailable]'));
   await click(document.querySelector('.desktop-service-mobile a[href="/order/order-A"]'));
   assert.ok(document.querySelector('[data-action="report-problem"]'));
  }
  assert.equal(JSON.stringify(order),before);assert.ok(a.reads.every(r=>r.method==='GET'));
  assert.equal(a.reads.length,3);
 }finally{await a.cleanup();}
});
for(const query of ['', '?orderId=', '?orderId=..', '?orderId=%2F%2Fevil.example', '?orderId=order-A%2Fdispute', '?orderId=order-A&orderId=order-B', '?orderId='+ 'x'.repeat(65)])test(`generic or invalid Help context stays neutral: ${query}`,async()=>{
 const a=await mount('/support'+query);try{
  assert.equal(document.querySelectorAll('a[href^="/order/"]').length,0);
  assert.ok(document.querySelector('a[href="/orders"]'));assert.equal(a.reads.length,0);
 }finally{await a.cleanup();}
});
test('changing help query and then opening general Help discards prior order context',async()=>{
 const a=await mount();try{
  await a.navigate('/support?orderId=order-B');assert.equal(document.querySelectorAll('a[href="/order/order-A"]').length,0);assert.ok(document.querySelector('a[href="/order/order-B"]'));
  await a.navigate('/support');assert.equal(document.querySelectorAll('a[href^="/order/"]').length,0);assert.equal(a.reads.length,0);
 }finally{await a.cleanup();}
});

test('native Back/Forward restores exact order Help context without mutating the order',async()=>{
 const a=await mount('/order/order-A');
 const traverse=direction=>act(async()=>new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Expected popstate')),2000);window.addEventListener('popstate',()=>{clearTimeout(timeout);resolve()},{once:true});window.history[direction]()}));
 try{
  await click(document.querySelector('[data-action="report-problem"]'));
  assert.equal(window.location.search,'?orderId=order-A');
  await traverse('back');assert.equal(window.location.pathname,'/order/order-A');assert.ok(document.querySelector('[data-action="report-problem"]'));
  await traverse('forward');assert.equal(window.location.pathname,'/support');assert.ok(document.querySelector('a[href="/order/order-A"]'));
  assert.equal(a.reads.length,2);assert.ok(a.reads.every(r=>r.method==='GET'));
 }finally{await a.cleanup();}
});
