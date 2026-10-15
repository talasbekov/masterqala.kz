import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/order/1842'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,CustomEvent:dom.window.CustomEvent,IS_REACT_ACT_ENVIRONMENT:true});
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const {DirectMasterOrderView,DirectClientOrderView,LocaleProvider}=await import('../dist/index.js');
const order={id:'1842',status:'PRICE_APPROVED',lifecycleVersion:2,description:'Actual task',address:'Actual address',workPrice:8000,materialsPrice:3500,calloutPrice:2500,quoteTotal:14000,quoteVersion:3,consentedVersion:3,workComment:'Agreed scope',departedAt:null,cancellationAmount:null,updatedAt:'2026-10-13',client:null};
async function mount(View,language,overrides){
 document.body.innerHTML='<div id="root"></div>';localStorage.clear();const root=createRoot(document.getElementById('root'));const calls=[];
 const props={order:{...order,...overrides},busy:false,error:'',online:true,fresh:true,onAction:async(...args)=>{calls.push(args);return true},onCancelPreview:async()=>({amount:0,expectedUpdatedAt:'now'}),onBack(){},onHelp(){}};
 await act(async()=>root.render(React.createElement(LocaleProvider,{initialLanguage:language},React.createElement(View,props))));
 return{calls,cleanup:async()=>act(async()=>root.unmount())};
}
for(const language of ['ru','kk','en']){
 test(`${language}: agreed unavailable amount has an explicit state and cannot start work`,async()=>{
  for(const quoteTotal of [null,undefined,NaN,Infinity,-1]){
   const app=await mount(DirectMasterOrderView,language,{quoteTotal});try{
    assert.ok(document.querySelector('[data-quote-unavailable]'),'show unavailable amount, not zero');
    const start=document.querySelector('footer [data-action="start-work"]');assert.equal(start.disabled,true);
    await act(async()=>start.click());assert.equal(app.calls.length,0);
    assert.doesNotMatch(document.querySelector('[data-approved-explanation]').textContent,/\b0\b|NaN|Infinity/);
   }finally{await app.cleanup()}
  }
 });
 test(`${language}: client never substitutes zero and cannot approve/accept an unavailable total`,async()=>{
  for(const status of ['PRICE_APPROVED','AWAITING_PRICE_CONFIRM','DONE']){
   const app=await mount(DirectClientOrderView,language,{status,quoteTotal:null});try{
    assert.ok(document.querySelector('[data-quote-unavailable]'));
    if(status==='PRICE_APPROVED'){
     assert.equal(document.querySelector('[data-total-amount]').textContent,'—');
     assert.doesNotMatch(document.querySelector('[data-order-status]').textContent,/\b0\b/);
    }else{
     const selector=status==='DONE'?'[data-action="accept-work"]':'[data-action="approve-quote"]';
     const button=document.querySelector(`footer ${selector}`);assert.equal(button.disabled,true);await act(async()=>button.click());assert.equal(app.calls.length,0);
    }
   }finally{await app.cleanup()}
  }
 });
 test(`${language}: actual zero remains a known amount`,async()=>{
  for(const View of [DirectMasterOrderView,DirectClientOrderView]){
   const app=await mount(View,language,{workPrice:0,materialsPrice:0,calloutPrice:0,quoteTotal:0});try{
    assert.equal(document.querySelector('[data-quote-unavailable]'),null);
    const amount=document.querySelector(View===DirectMasterOrderView?'[data-approved-explanation]':'[data-total-amount]');assert.match(amount.textContent,/0/);
   }finally{await app.cleanup()}
  }
 });
}
test('approved desktop component amounts never coerce malformed input into zero or partial totals',async()=>{
 for(const field of ['workPrice','materialsPrice','calloutPrice'])for(const value of [null,undefined,NaN,Infinity,-1]){
  const app=await mount(DirectClientOrderView,'en',{[field]:value,quoteTotal:null});try{
   const selector=field==='calloutPrice'?'[data-approved-callout]':'[data-approved-work-materials]';
   assert.equal(document.querySelector(selector).textContent,'—');
  }finally{await app.cleanup()}
 }
});
