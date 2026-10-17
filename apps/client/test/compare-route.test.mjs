import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire,register} from 'node:module';
register('./home-socket-loader.mjs',import.meta.url);
register('./css-test-loader.mjs',import.meta.url);
const require=createRequire(new URL('../../../packages/ui/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="root"></div>',{url:'https://test.local/planned/A/compare'});
Object.assign(globalThis,{window:dom.window,self:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,CustomEvent:dom.window.CustomEvent,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const {LocaleProvider}=await import('@masterqala/ui');
const {AppRouterContext}=await import('next/dist/shared/lib/app-router-context.shared-runtime.js');
const {PathParamsContext}=await import('next/dist/shared/lib/hooks-client-context.shared-runtime.js');
const {default:Page,AuthProvider,useAuth,i18n}=await import('../.test-build/test/compare-entry.js');
const offer=(id='bid-1')=>({id,price:12000,term:'Tomorrow',comment:'Actual offer',master:{id:'master-'+id,name:'Master '+id,experienceYears:4,completedCount:12,verified:true,rating:4.7,reviewCount:9}});
const order=(overrides={})=>({id:'A',status:'PUBLISHED',lifecycleModel:'LEGACY',commercialMode:'FREE_PILOT',category:{name:'Plumbing',slug:'plumbing'},description:'Actual task',address:'Actual address',district:'Centre',slotStart:'2026-10-19T04:00:00Z',slotEnd:'2026-10-19T07:00:00Z',budget:15000,bids:[offer()],...overrides});
async function mount(language='en'){
 localStorage.clear();localStorage.setItem('token','fixture-a');localStorage.setItem('user',JSON.stringify({id:'owner-A',phone:'+77010000000',name:'A',role:'CLIENT'}));
 const requests=[],listeners=[],pushes=[];
 globalThis.__homeSocket={on:(event,callback)=>listeners.push({event,callback,active:true}),off:(event,callback)=>{const x=listeners.find(x=>x.event===event&&x.callback===callback);if(x)x.active=false},disconnect(){}};
 globalThis.fetch=(url,options)=>new Promise((resolve,reject)=>requests.push({path:new URL(url).pathname.replace('/api/v1',''),method:options.method??'GET',body:options.body,signal:options.signal,reject,resolve:(body,status=200)=>resolve({ok:status<400,status,json:async()=>body})}));
 await i18n.changeLanguage(language);
 const root=createRoot(document.getElementById('root'));let auth;
 function Controls(){auth=useAuth();return null}
 const render=id=>act(async()=>root.render(React.createElement(LocaleProvider,{initialLanguage:language},React.createElement(AuthProvider,null,React.createElement(AppRouterContext.Provider,{value:{push:href=>pushes.push(href),replace(){},prefetch(){}}},React.createElement(PathParamsContext.Provider,{value:{id}},React.createElement(Controls),React.createElement(Page)))))));
 await render('A');
 let cleaned=false;
 return {requests,listeners,pushes,render,auth:()=>auth,resolve:(index,body,status)=>act(async()=>requests[index].resolve(body,status)),event:event=>act(async()=>listeners.filter(x=>x.active&&x.event===event).forEach(x=>x.callback({plannedOrderId:'A'}))),cleanup:async()=>{if(cleaned)return;cleaned=true;await act(async()=>auth.logout());await act(async()=>root.unmount());}};
}
for(const language of ['ru','kk','en'])test(`${language}: actual comparison aligns actions with offers and keeps completed records read only`,async()=>{
 const a=await mount(language);try{await a.resolve(0,order({status:'CLOSED',bids:[offer(),offer('bid-2')]}));assert.equal(document.querySelectorAll('[data-compare-offer]').length,2);assert.equal(document.querySelectorAll('[data-compare-select]').length,0);assert.equal(document.querySelector('h1').textContent,{ru:'Сравните предложения',kk:'Ұсыныстарды салыстырыңыз',en:'Compare offers'}[language]);assert.ok(document.body.textContent.includes(new Intl.NumberFormat(language,{style:'unit',unit:'year',unitDisplay:'long'}).format(4)));assert.match(document.body.textContent,/Actual task/);assert.ok(a.requests.every(x=>x.method==='GET'));}finally{await a.cleanup()}
});
for(const language of ['ru','kk','en'])test(`${language}: choosing an offer opens translated confirmation without submitting`,async()=>{
 const a=await mount(language);try{await a.resolve(0,order());await act(async()=>document.querySelector('[data-compare-select]').click());assert.equal(document.querySelector('[data-select-confirm]').textContent,{ru:'Подтвердить выбор',kk:'Таңдауды растау',en:'Confirm choice'}[language]);assert.ok(a.requests.every(x=>x.method==='GET'));}finally{await a.cleanup()}
});
test('refresh failure disables selection until explicit retry and stale selected bids close',async()=>{
 const a=await mount();try{await a.resolve(0,order());await act(async()=>document.querySelector('[data-compare-select]').click());assert.ok(document.querySelector('[data-select-confirm]'));await a.event('bid:new');assert.equal(document.querySelector('[data-select-confirm]').disabled,true);await act(async()=>a.requests[1].reject(new Error('lost')));assert.ok(document.querySelector('[role="alert"]'));assert.equal(document.querySelector('[data-select-confirm]').disabled,true);await act(async()=>document.querySelector('[data-compare-retry]').click());await a.resolve(2,order({bids:[]}));assert.equal(document.querySelector('[data-select-confirm]'),null);assert.ok(document.querySelector('[data-compare-empty]'));}finally{await a.cleanup()}
});
test('owner and A to B to A route changes reject old reads and retained socket callbacks',async()=>{
 const a=await mount();try{const old=a.listeners[0]?.callback;await a.render('B');await a.render('A');await a.resolve(2,order({description:'Current task'}));await a.resolve(0,order({description:'Old private task'}));assert.doesNotMatch(document.body.textContent,/Old private task/);assert.equal(a.requests[0].signal.aborted,true);await act(async()=>old?.({plannedOrderId:'A'}));assert.equal(a.requests.length,3);await act(async()=>a.auth().login('fixture-b',{id:'owner-B',phone:'+77020000000',name:'B',role:'CLIENT'}));assert.doesNotMatch(document.body.textContent,/Current task/);await a.resolve(3,order({description:'Owner B task'}));assert.match(document.body.textContent,/Owner B task/);}finally{await a.cleanup()}
});
test('selection is single flight through socket refresh and late completion cannot navigate after unmount',async()=>{
 const a=await mount();try{await a.resolve(0,order());await act(async()=>document.querySelector('[data-compare-select]').click());await act(async()=>{document.querySelector('[data-select-confirm]').click();document.querySelector('[data-select-confirm]').click()});assert.equal(a.requests.filter(x=>x.method==='POST').length,1);assert.equal(a.requests[1].body,JSON.stringify({bidId:'bid-1'}));await a.event('planned:status');await a.resolve(2,order());assert.equal(document.querySelector('[data-select-confirm]').disabled,true);await a.cleanup();await a.resolve(1,{});assert.deepEqual(a.pushes,[]);}finally{await a.cleanup()}
});
test('reconnect refreshes and retryable selection rejection permits one new explicit attempt',async()=>{
 const a=await mount();try{await a.resolve(0,order());await a.event('connect');await a.resolve(1,order());await act(async()=>document.querySelector('[data-compare-select]').click());await act(async()=>document.querySelector('[data-select-confirm]').click());await a.resolve(2,{message:'Offer no longer available'},409);assert.match(document.body.textContent,/Offer no longer available/);await act(async()=>{document.querySelector('[data-select-confirm]').click();document.querySelector('[data-select-confirm]').click()});assert.equal(a.requests.filter(x=>x.method==='POST').length,2);await a.resolve(3,{});assert.deepEqual(a.pushes,['/planned/A']);}finally{await a.cleanup()}
});
test('refresh invalidates confirmation synchronously before React renders, and latest read wins',async()=>{
 const a=await mount();try{await a.resolve(0,order({bids:[offer(),offer('bid-2')]}));const actions=[...document.querySelectorAll('[data-compare-select]')];assert.equal(actions[1].closest('[data-compare-offer]').dataset.compareOffer,'bid-2');await act(async()=>actions[1].click());await act(async()=>{a.listeners.find(x=>x.active&&x.event==='bid:new').callback({plannedOrderId:'A'});document.querySelector('[data-select-confirm]').click()});assert.equal(a.requests.filter(x=>x.method==='POST').length,0);await a.event('bid:new');assert.equal(a.requests[1].signal.aborted,true);await a.resolve(2,order({bids:[offer()],description:'Latest task'}));await a.resolve(1,order({bids:[offer(),offer('bid-2')],description:'Stale task'}));assert.match(document.body.textContent,/Latest task/);assert.doesNotMatch(document.body.textContent,/Stale task/);assert.equal(document.querySelector('[data-select-confirm]'),null);}finally{await a.cleanup()}
});
test('initial error has GET retry, and offline blocks selection until a new verified read',async()=>{
 const a=await mount();try{await act(async()=>a.requests[0].reject(new Error('unavailable')));assert.ok(document.querySelector('[data-compare-retry]'));await act(async()=>document.querySelector('[data-compare-retry]').click());await a.resolve(1,order());await act(async()=>window.dispatchEvent(new window.Event('offline')));assert.equal(document.querySelector('[data-compare-select]').disabled,true);await act(async()=>window.dispatchEvent(new window.Event('online')));assert.equal(document.querySelector('[data-compare-select]').disabled,true);await a.resolve(2,order());assert.equal(document.querySelector('[data-compare-select]').disabled,false);assert.ok(a.requests.every(x=>x.method==='GET'));}finally{await a.cleanup()}
});
