import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/order/1842'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,CustomEvent:dom.window.CustomEvent,IS_REACT_ACT_ENVIRONMENT:true});
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const {DirectMasterOrderView,LocaleProvider}=await import('../dist/index.js');
const order={id:'1842',status:'PRICE_APPROVED',lifecycleVersion:2,description:'Actual task',address:'Actual address',workPrice:8000,materialsPrice:3500,calloutPrice:2500,quoteTotal:14000,quoteVersion:3,consentedVersion:3,workComment:'Original scope',departedAt:null,cancellationAmount:null,updatedAt:'2026-10-13',client:null};
async function mount(language='en'){
 document.body.innerHTML='<div id="root"></div>';localStorage.clear();const root=createRoot(document.getElementById('root'));const calls=[];
 let props={order,busy:false,error:'',online:true,fresh:true,onAction:async(...args)=>{calls.push(args);return true},onBack(){},onHelp(){}};
 const render=async(next={})=>{props={...props,...next};await act(async()=>root.render(React.createElement(LocaleProvider,{initialLanguage:language},React.createElement(DirectMasterOrderView,props))))};await render();
 return{calls,render,cleanup:async()=>act(async()=>root.unmount())};
}
const click=async(selector)=>act(async()=>document.querySelector(selector).click());
async function type(selector,value){const input=document.querySelector(selector),proto=input.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(input,value);await act(async()=>input.dispatchEvent(new window.Event('input',{bubbles:true})))}
test('typed quote draft survives same-version refresh and rejected proposal; deliberate cancel/reopen snapshots current quote',async()=>{
 const app=await mount();try{
 await click('[data-action="revise-approved-quote"]');await type('input[aria-label="Work"]','8123');await type('textarea','Unsaved scope');
 await app.render({order:{...order,updatedAt:'new timestamp'}});assert.equal(document.querySelector('input').value,'8123');assert.equal(document.querySelector('textarea').value,'Unsaved scope');
 await app.render({onAction:async(...args)=>{app.calls.push(args);return false},error:'409 quote changed'});await click('footer [data-action="send-quote"]');assert.equal(app.calls[0][1].amount,8123);assert.equal(app.calls[0][1].comment,'Unsaved scope');assert.equal(app.calls[0][1].expectedQuoteVersion,3);assert.equal(document.querySelector('textarea').value,'Unsaved scope');assert.match(document.body.textContent,/409 quote changed/);
 await app.render({order:{...order,quoteVersion:4,workPrice:9000,workComment:'Latest scope'},error:''});assert.equal(document.querySelector('textarea').value,'Unsaved scope');assert.equal(document.querySelector('footer [data-action="send-quote"]').disabled,true);
 await click('[data-action="cancel-quote-edit"]');assert.equal(document.querySelector('textarea'),null);await click('[data-action="revise-approved-quote"]');assert.equal(document.querySelector('input').value,'9000');assert.equal(document.querySelector('textarea').value,'Latest scope');assert.equal(document.querySelector('[data-quote-draft-conflict]'),null);
 }finally{await app.cleanup()}
});
test('quote proposal remains guarded while busy/offline/stale and missing server version never creates a replacement version',async()=>{
 const app=await mount();try{await click('[data-action="revise-approved-quote"]');for(const guard of [{busy:true},{busy:false,online:false},{online:true,fresh:false}]){await app.render(guard);assert.equal(document.querySelector('footer [data-action="send-quote"]').disabled,true);await click('footer [data-action="send-quote"]');assert.equal(app.calls.length,0)}
 await app.render({fresh:true,order:{...order,quoteVersion:undefined}});assert.ok(document.querySelector('[data-quote-draft-conflict]'));assert.equal(document.querySelector('[data-action="reload-quote-draft"]').disabled,true);await click('footer [data-action="send-quote"]');assert.equal(app.calls.length,0);
 await app.render({order});await click('footer [data-action="send-quote"]');assert.equal(app.calls[0][1].expectedQuoteVersion,3);assert.equal(document.querySelector('textarea'),null);
 }finally{await app.cleanup()}
});
test('new explicit edit snapshots current props in all languages and wrong order identity blocks old draft',async()=>{
 for(const language of ['ru','kk','en']){const app=await mount(language);try{await app.render({order:{...order,quoteVersion:5,workPrice:9100,workComment:'Current agreed scope'}});await click('[data-action="revise-approved-quote"]');assert.equal(document.querySelector('input').value,'9100');await app.render({order:{...order,id:'different-owned-order',quoteVersion:5}});assert.ok(document.querySelector('[data-quote-draft-conflict] [role="alert"]').textContent);assert.equal(document.querySelector('footer [data-action="send-quote"]').disabled,true);await click('footer [data-action="send-quote"]');assert.equal(app.calls.length,0)}finally{await app.cleanup()}}
});
test('same-version stale editor and cancelled approved view expose guarded GET recovery without losing draft or posting',async()=>{
 const app=await mount();let reads=0;const onRefresh=async()=>{reads++;if(reads===1)throw new Error('Actual GET failure')};
 try{await click('[data-action="revise-approved-quote"]');await type('input[aria-label="Work"]','8123');await type('textarea','Unsaved recovery scope');await app.render({fresh:false,onRefresh});let refresh=document.querySelector('[data-action="refresh-quote-version"]');assert.ok(refresh,'same-version stale editor must offer GET recovery');assert.equal(refresh.disabled,false);await click('[data-action="refresh-quote-version"]');assert.match(document.body.textContent,/Actual GET failure/);assert.equal(document.querySelector('input').value,'8123');assert.equal(document.querySelector('textarea').value,'Unsaved recovery scope');assert.equal(document.querySelector('footer [data-action="send-quote"]').disabled,true);await click('[data-action="cancel-quote-edit"]');assert.equal(document.querySelector('textarea'),null);refresh=document.querySelector('[data-action="refresh-quote-version"]');assert.ok(refresh,'stale approved nonediting must retain recovery access');for(const guard of [{online:false},{online:true,busy:true}]){await app.render(guard);await click('[data-action="refresh-quote-version"]');assert.equal(reads,1)}await app.render({busy:false});await click('[data-action="refresh-quote-version"]');assert.equal(reads,2);assert.equal(app.calls.length,0);await app.render({fresh:true});assert.equal(document.querySelector('[data-action="refresh-quote-version"]'),null);
 }finally{await app.cleanup()}
});
