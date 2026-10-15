import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {useOrderState} from '../dist/index.js';
async function stateHarness(){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/order/owner-A'});const previousNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
 const reads=[];const read=id=>new Promise((resolve,reject)=>reads.push({id,resolve,reject}));let state;
 function Harness({id,onCommit}){state=useOrderState({id,read});React.useLayoutEffect(()=>{onCommit?.(state)},[id,onCommit]);return React.createElement('div',{'data-order':state.order?.id??'', 'data-fresh':state.fresh},state.error)}
 const root=createRoot(document.getElementById('root'));const render=(id,onCommit)=>act(async()=>root.render(React.createElement(Harness,{id,onCommit})));
 await render('owner-A');await act(async()=>reads[0].resolve({id:'owner-A',quoteVersion:3}));
 return{reads,render,state:()=>state,cleanup:async()=>{await act(async()=>root.unmount());dom.window.close();if(previousNavigator)Object.defineProperty(globalThis,'navigator',previousNavigator);else delete globalThis.navigator;}};
}
test('GET refresh synchronously blocks mutation before React reconciliation and resumes only after verified response',async()=>{
 const app=await stateHarness();let writes=0;
 try{assert.equal(app.state().fresh,true);let request;
  await act(async()=>{request=app.state().load();const mutation=app.state().mutate(async()=>{writes++});assert.equal(writes,0,'pending GET must invalidate mutation synchronously');assert.equal(await mutation,false)});
  assert.equal(app.state().fresh,false);await act(async()=>app.reads[1].resolve({id:'owner-A',quoteVersion:4}));await request;assert.equal(app.state().fresh,true);assert.equal(app.state().order.quoteVersion,4);assert.equal(writes,0);
 }finally{await app.cleanup()}
});
test('old-order refresh completion and captured mutation cannot affect or write the new order',async()=>{
 const app=await stateHarness();let writes=0;
 try{const old=app.state();let oldRead;await act(async()=>{oldRead=old.load()});await app.render('owner-B');assert.equal(app.reads[2].id,'owner-B');await act(async()=>app.reads[2].resolve({id:'owner-B',quoteVersion:8}));
  await act(async()=>{const result=await old.mutate(async()=>{writes++});assert.equal(result,false)});assert.equal(writes,0);await act(async()=>app.reads[1].resolve({id:'owner-A',quoteVersion:99}));await oldRead;assert.equal(app.state().order.id,'owner-B');assert.equal(app.state().order.quoteVersion,8);assert.equal(app.state().fresh,true);
 }finally{await app.cleanup()}
});
test('failed refresh retains actual error and stale guard until explicit current-order retry succeeds',async()=>{
 const app=await stateHarness();let writes=0;
 try{let failed;await act(async()=>{failed=app.state().load()});await act(async()=>app.reads[1].reject(new Error('Actual GET failure')));await failed;assert.equal(app.state().fresh,false);assert.equal(app.state().error,'Actual GET failure');assert.equal(await app.state().mutate(async()=>{writes++}),false);let retry;await act(async()=>{retry=app.state().load()});await act(async()=>app.reads[2].resolve({id:'owner-A',quoteVersion:4}));await retry;assert.equal(app.state().fresh,true);assert.equal(app.state().error,'');assert.equal(writes,0);
 }finally{await app.cleanup()}
});
test('mounted master view refresh reads current order and enables versioned start only after the verified response',async()=>{
 const {DirectMasterOrderView,LocaleProvider}=await import('../dist/index.js');const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/order/current-owned'});const previousNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
 const reads=[],writes=[];const read=id=>new Promise(resolve=>reads.push({id,resolve}));const order={id:'current-owned',status:'AWAITING_PRICE_CONFIRM',lifecycleVersion:2,description:'Actual task',address:'Actual address',workPrice:8000,materialsPrice:3500,calloutPrice:2500,quoteTotal:14000,quoteVersion:3,consentedVersion:null,workComment:'Actual scope',updatedAt:'2026-10-13',client:{name:'Actual customer',phone:'+77010000000'}};
 function Harness(){const state=useOrderState({id:order.id,read});return state.order?React.createElement(LocaleProvider,{initialLanguage:'en'},React.createElement(DirectMasterOrderView,{...state,onRefresh:state.load,onAction:(...args)=>state.mutate(async()=>writes.push(args)),onBack(){},onHelp(){}})):null}
 const root=createRoot(document.getElementById('root'));
 try{await act(async()=>root.render(React.createElement(Harness)));await act(async()=>reads[0].resolve(order));await act(async()=>document.querySelector('footer [data-action="refresh-status"]').click());assert.equal(reads.length,2);assert.equal(reads[1].id,order.id);assert.equal(writes.length,0);assert.equal(document.querySelector('[data-action="start-work"]'),null);await act(async()=>reads[1].resolve({...order,status:'PRICE_APPROVED',quoteVersion:4,consentedVersion:4}));const start=document.querySelector('footer [data-action="start-work"]');assert.ok(start);assert.equal(start.disabled,false);await act(async()=>start.click());assert.deepEqual(writes,[['start-work',{quoteVersion:4}]]);await act(async()=>reads[2].resolve({...order,status:'IN_PROGRESS',quoteVersion:4,consentedVersion:4}));assert.equal(document.querySelector('[data-action="start-work"]'),null);assert.equal(document.querySelector('[data-action="refresh-status"]'),null);}
 finally{await act(async()=>root.unmount());dom.window.close();if(previousNavigator)Object.defineProperty(globalThis,'navigator',previousNavigator);else delete globalThis.navigator;}
});

test('new-order commit cannot inherit the previous order verification before passive effect cleanup',async()=>{
 const app=await stateHarness();let writes=0;
 try{await app.render('owner-B',state=>{void state.mutate(async()=>{writes++})});assert.equal(writes,0,'verification belongs to the order ID that was read');}
 finally{await app.cleanup()}
});
test('same-ID mutation handler captured before refresh cannot write after a newer quote generation is verified',async()=>{
 const app=await stateHarness();let writes=0;
 try{const old=app.state();let refreshed;await act(async()=>{refreshed=old.load()});await act(async()=>app.reads[1].resolve({id:'owner-A',quoteVersion:4}));await refreshed;assert.equal(app.state().fresh,true);await act(async()=>{const retained=old.mutate(async()=>{writes++});assert.equal(writes,0,'retained quoteVersion3 handler must not POST after version4 read');assert.equal(await retained,false)});let mutation;await act(async()=>{mutation=app.state().mutate(async()=>{writes++})});assert.equal(writes,1);await act(async()=>app.reads[2].resolve({id:'owner-A',quoteVersion:4}));assert.equal(await mutation,true);assert.equal(app.state().fresh,true);}
 finally{await app.cleanup()}
});
