import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
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
 assert.ok([...document.querySelector('footer').querySelectorAll('button')].every(b=>b.classList.contains('min-h-14')));
 assert.equal(mutations,0);
 assert.equal(document.querySelector('[data-quote-total] img').getAttribute('width'),'24');
 }finally{await act(async()=>root.unmount());dom.window.close();}
});
