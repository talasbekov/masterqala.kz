import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {DirectClientOrderView,LocaleProvider} from '../dist/index.js';
test('approved client state uses scoped success badge, designed information row and mobile action size',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/order/1842'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
 const root=createRoot(document.getElementById('root'));
 let mutations=0;
 const order={id:'1842',status:'PRICE_APPROVED',lifecycleVersion:2,description:'Actual description',address:'Actual address',workPrice:8000,materialsPrice:3500,calloutPrice:2500,quoteTotal:14000,quoteVersion:3,consentedVersion:3,workComment:'Actual scope',departedAt:null,cancellationAmount:null,updatedAt:'2026-10-13',master:{name:'Azat',phone:'+77010000000',rating:4.9,reviewCount:126}};
 try {
 await act(async()=>root.render(React.createElement(LocaleProvider,{initialLanguage:'ru'},React.createElement(DirectClientOrderView,{order,busy:false,error:'',online:true,fresh:true,onAction:async()=>{mutations++;return true},onCancelPreview:async()=>({amount:0,expectedUpdatedAt:order.updatedAt}),onBack(){},onHelp(){}}))));
 assert.ok(document.querySelector('[data-order-status="PRICE_APPROVED"]').classList.contains('text-approved'));
 const info=document.querySelector('[data-quote-total]');
 assert.ok(info.classList.contains('p-4'));
 assert.ok(info.querySelector('[data-total-caption]').classList.contains('font-semibold'));
 assert.ok(info.querySelector('[data-total-amount]').classList.contains('text-sm'));
 assert.ok([...document.querySelector('footer').querySelectorAll('button')].every(b=>b.classList.contains('min-h-[56px]')));
 assert.equal(mutations,0);
 assert.equal(document.querySelector('[data-quote-total] img').getAttribute('width'),'24');
 }finally{await act(async()=>root.unmount());dom.window.close();}
});

const approvedOrder={id:'1842',status:'PRICE_APPROVED',lifecycleVersion:2,description:'Actual task',address:'Actual address',workPrice:8000,materialsPrice:3500,calloutPrice:2500,quoteTotal:14000,quoteVersion:3,consentedVersion:3,workComment:'Actual agreed scope',departedAt:null,cancellationAmount:null,updatedAt:'2026-10-13',client:{name:'Айгерим',phone:'+77010000000'}};
async function stateView(Component,language='ru',extra={}){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/order/1842'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,CustomEvent:dom.window.CustomEvent,IS_REACT_ACT_ENVIRONMENT:true});
 const calls=[];let back=0,help=0;const root=createRoot(document.getElementById('root'));
 const render=async(props={})=>act(async()=>root.render(React.createElement(LocaleProvider,{key:language,initialLanguage:language},React.createElement(Component,{order:approvedOrder,busy:false,error:'',online:true,fresh:true,onAction:async(...args)=>{calls.push(args);return true},onCancelPreview:async()=>({amount:0,expectedUpdatedAt:approvedOrder.updatedAt}),onBack(){back++},onHelp(){help++},...extra,...props}))));
 await render();return{dom,calls,render,back:()=>back,help:()=>help,cleanup:async()=>{await act(async()=>root.unmount());dom.window.close()}};
}

test('desktop consent-change notice is approved-only and localized without render or Back mutations',async()=>{
 for(const language of ['ru','kk','en']){
  const app=await stateView(DirectClientOrderView,language);
  try{const notice=document.querySelector('[data-approved-notice]');assert.ok(notice,'approved desktop notice required');assert.ok(notice.classList.contains('lg:w-[330px]'));assert.ok(notice.querySelector('h2').classList.contains('text-xl'));assert.ok(notice.querySelector('p').classList.contains('leading-6'));assert.ok(notice.querySelector('p').textContent.startsWith({ru:'Если',kk:'Жұмыс',en:'If'}[language]));assert.equal(app.calls.length,0);
   await act(async()=>document.querySelector('header button').click());assert.equal(app.back(),1);assert.equal(app.calls.length,0);
   for(const status of ['AWAITING_PRICE_CONFIRM','IN_PROGRESS','DONE']){await app.render({order:{...approvedOrder,status}});assert.equal(document.querySelector('[data-approved-notice]'),null);assert.ok(document.querySelector('main').parentElement.parentElement.classList.contains('md:max-w-[400px]'));}
  }finally{await app.cleanup()}
 }
});

test('approved master explains actual named or unnamed consent and additional-work approval in three languages',async()=>{
 const {DirectMasterOrderView}=await import('../dist/index.js');
 for(const language of ['ru','kk','en'])for(const name of ['Айгерим '.repeat(30),null,'   ']){
  const app=await stateView(DirectMasterOrderView,language,{order:{...approvedOrder,client:{name,phone:'+77010000000'}}});
  try{const note=document.querySelector('[data-approved-explanation]');assert.ok(note,'approved explanation required');if(name?.trim())assert.ok(note.textContent.includes(name.trim()));assert.match(note.textContent,/14/);assert.doesNotMatch(note.textContent,/undefined|null/);assert.ok(note.classList.contains('break-words'));
   assert.ok(document.querySelector('[data-master-status]').classList.contains('text-approved'));assert.ok(document.querySelector('[data-additional-consent]').textContent.length>30);assert.equal(document.querySelector('[data-agreed-scope] h2').textContent.length>0,true);assert.ok(document.querySelector('[data-action="start-work"]').classList.contains('min-h-[56px]'));assert.equal(app.calls.length,0);assert.ok(document.querySelector('[data-agreed-scope]').textContent.includes('Actual agreed scope'));assert.ok(document.querySelector('[data-agreed-scope]').textContent.includes('Actual address'));
  }finally{await app.cleanup()}
 }
});

test('master start keeps quoteVersion and busy/offline/reconciling guards; revision removes approved-only explanation',async()=>{
 const {DirectMasterOrderView}=await import('../dist/index.js');const app=await stateView(DirectMasterOrderView);
 try{for(const guard of [{busy:true},{online:false},{fresh:false}]){await app.render(guard);const start=document.querySelector('[data-action="start-work"]');assert.ok(start);assert.equal(start.disabled,true);await act(async()=>start.click());assert.equal(app.calls.length,0);}
  await app.render();await act(async()=>document.querySelector('[data-action="start-work"]').click());assert.deepEqual(app.calls,[['start-work',{quoteVersion:3}]]);
  const revise=[...document.querySelectorAll('button')].find(button=>button.textContent==='Изменить смету');await act(async()=>revise.click());assert.equal(document.querySelector('[data-action="start-work"]'),null);assert.equal(document.querySelector('[data-approved-explanation]'),null);
  const send=[...document.querySelectorAll('button')].find(button=>button.textContent.startsWith('Отправить ·'));assert.ok(send);await act(async()=>send.click());assert.equal(app.calls[1][0],'propose-price');assert.equal(app.calls[1][1].expectedQuoteVersion,3);
  await app.render({order:{...approvedOrder,status:'AWAITING_PRICE_CONFIRM',quoteVersion:4,consentedVersion:null}});assert.equal(document.querySelector('[data-action="start-work"]'),null);assert.equal(document.querySelector('[data-approved-explanation]'),null);assert.ok(!document.querySelector('[data-agreed-scope]'));
 }finally{await app.cleanup()}
});


test('generated scoped56px action rule wins over shared52px default',()=>{
 const css=readFileSync(new URL('../dist/styles.css',import.meta.url),'utf8');
 const defaultRule=css.indexOf('.min-h-\\[52px\\]{min-height:52px}');
 const actionRule=css.indexOf('.min-h-\\[56px\\]{min-height:56px}');
 assert.ok(defaultRule>=0);assert.ok(actionRule>defaultRule);
 assert.ok(css.includes('.md\\:min-h-\\[52px\\]{min-height:52px}'));
});
