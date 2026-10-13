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

test('approved desktop has separate summary/details cards with real prices/address and preserved actions in three languages',async()=>{
 for(const language of ['ru','kk','en']){
  const actual={...approvedOrder,id:'actual-owned-order-uuid',description:'Real task\nSecond line',address:'Real selected address',entrance:'3',floor:'7',apartment:'84',master:{name:'Actual master',phone:'+77010000000'},calloutPrice:777,quoteTotal:12277};
  const app=await stateView(DirectClientOrderView,language,{order:actual});
  try{const summary=document.querySelector('[data-approved-desktop-summary]'),details=document.querySelector('[data-approved-order-details]');assert.ok(summary);assert.ok(details);assert.notEqual(summary,details);assert.ok(summary.classList.contains('p-6'));assert.ok(details.classList.contains('p-6'));
   assert.match(summary.querySelector('[data-approved-work-materials]').textContent.replace(/[^0-9]/g,''),/11500/);assert.match(summary.querySelector('[data-approved-callout]').textContent.replace(/[^0-9]/g,''),/777/);assert.match(summary.querySelector('[data-approved-total]').textContent.replace(/[^0-9]/g,''),/12277/);
   assert.ok(details.textContent.includes(actual.description));assert.ok(details.textContent.includes(actual.address));for(const value of ['3','7','84'])assert.ok(details.querySelector('[data-approved-address-details]').textContent.includes(value));assert.ok(details.querySelector('h2').textContent.includes(actual.id.slice(0,8)));
   assert.equal(summary.querySelector('a[href="tel:+77010000000"]')?.getAttribute('href'),'tel:+77010000000');assert.ok(details.querySelector('button'));assert.equal(app.calls.length,0);assert.ok(document.querySelector('footer'));assert.ok(document.querySelector('[data-quote-total]'));
   for(const status of ['AWAITING_PRICE_CONFIRM','IN_PROGRESS','DONE']){await app.render({order:{...actual,status}});assert.equal(document.querySelector('[data-approved-desktop-summary]'),null);assert.equal(document.querySelector('[data-approved-order-details]'),null);assert.equal(app.calls.length,0);}
  }finally{await app.cleanup()}
 }
});
test('desktop approved call target uses52px while unavailable details stay honest and help retains real handler',async()=>{
 const app=await stateView(DirectClientOrderView,'en',{order:{...approvedOrder,master:{name:null,phone:'+77010000000'}}});
 try{const summary=document.querySelector('[data-approved-desktop-summary]');assert.ok(summary.querySelector('a').classList.contains('md:min-h-[52px]'));assert.ok(summary.querySelector('h1'));assert.equal(document.querySelector('[data-approved-address-details]'),null);assert.doesNotMatch(document.querySelector('[data-approved-order-details]').textContent,/undefined|null/);
  globalThis.HTMLElement=app.dom.window.HTMLElement;app.dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true};app.dom.window.HTMLDialogElement.prototype.close=function(){this.open=false};await act(async()=>document.querySelector('[data-approved-order-details] button').click());assert.equal(document.querySelector('dialog').open,true);const support=[...document.querySelector('dialog').querySelectorAll('button')].find(button=>button.textContent==='Support');assert.ok(support);await act(async()=>support.click());assert.equal(app.help(),1);assert.equal(app.calls.length,0);
 }finally{await app.cleanup();delete globalThis.HTMLElement;}
});
test('desktop approved explanation waits for actual start without promising an ETA',async()=>{
 for(const language of ['ru','kk','en']){const app=await stateView(DirectClientOrderView,language);try{const note=document.querySelector('[data-approved-desktop-summary] [data-approved-desktop-note]');assert.ok(note);assert.doesNotMatch(note.textContent,/скоро|жақында|soon/i);assert.match(note.textContent,language==='ru'?/Ожидаем/:language==='kk'?/күтіп/:/Waiting/);}finally{await app.cleanup()}}
});
test('desktop summary retains unknown amounts and stale/offline/error states without render mutations',async()=>{
 const app=await stateView(DirectClientOrderView,'en',{order:{...approvedOrder,id:'owned-null-price-order',workPrice:null,quoteTotal:null,entrance:null,floor:' ',apartment:null},fresh:false,error:'Actual error'});
 try{const summary=document.querySelector('[data-approved-desktop-summary]');assert.equal(summary.querySelector('[data-approved-work-materials]').textContent,'—');assert.equal(summary.querySelector('[data-approved-total]').textContent,'—');assert.equal(summary.querySelector('[role="alert"]').textContent,'Actual error');assert.ok(summary.querySelector('[role="status"]'));assert.equal(document.querySelector('[data-approved-address-details]'),null);await app.render({online:false});assert.ok(document.querySelector('[data-approved-desktop-summary] [role="status"]'));assert.equal(app.calls.length,0);assert.doesNotMatch(document.querySelector('[data-approved-order-details]').textContent,/1842|undefined|null/);}
 finally{await app.cleanup()}
});
test('desktop details preserve changed agreed scope alongside original request and avoid identical duplicates',async()=>{
 const app=await stateView(DirectClientOrderView,'en',{order:{...approvedOrder,description:'Leaking pipe',workComment:'Replace pipe and valve'}});
 try{const details=document.querySelector('[data-approved-order-details]');assert.ok(details.textContent.includes('Leaking pipe'));const scope=details.querySelector('[data-approved-desktop-scope]');assert.ok(scope);assert.ok(scope.textContent.includes('Replace pipe and valve'));assert.equal(scope.querySelector('h3').textContent,'Agreed scope');await app.render({order:{...approvedOrder,description:'Leaking pipe',workComment:'  Leaking pipe  '}});assert.equal(document.querySelector('[data-approved-desktop-scope]'),null);await app.render({order:{...approvedOrder,description:'Leaking pipe',workComment:' '}});assert.equal(document.querySelector('[data-approved-desktop-scope]'),null);assert.ok(document.querySelector('[data-approved-order-details]').textContent.includes('Leaking pipe'));assert.equal(app.calls.length,0);}
 finally{await app.cleanup()}
});
test('approved mobile master fixed actions are Start then real Call; guarded revise stays in scroll content and Help stays in header',async()=>{
 const {DirectMasterOrderView}=await import('../dist/index.js');const app=await stateView(DirectMasterOrderView,'en');
 try{const footer=document.querySelector('footer');assert.equal(footer.children.length,2);assert.equal(footer.firstElementChild.dataset.action,'start-work');assert.equal(footer.lastElementChild.getAttribute('href'),'tel:+77010000000');assert.ok(document.querySelector('main [data-action="revise-approved-quote"]'));
  for(const guard of [{busy:true},{online:false},{fresh:false}]){await app.render(guard);const revise=document.querySelector('main [data-action="revise-approved-quote"]');assert.equal(revise.disabled,true);assert.equal(document.querySelector('footer [data-action="start-work"]').disabled,true);await act(async()=>revise.click());assert.ok(document.querySelector('footer [data-action="start-work"]'));assert.equal(app.calls.length,0);}
  await app.render();await act(async()=>document.querySelector('header button:last-child').click());assert.equal(app.help(),1);assert.equal(app.calls.length,0);await act(async()=>document.querySelector('main [data-action="revise-approved-quote"]').click());assert.equal(document.querySelector('footer [data-action="start-work"]'),null);assert.equal(document.querySelector('main [data-action="revise-approved-quote"]'),null);assert.ok(document.querySelector('main input'));assert.equal(app.calls.length,0);
 }finally{await app.cleanup()}
});
test('approved mobile master uses localized real targets without fabricating missing phone; awaiting and edit actions stay available',async()=>{
 const {DirectMasterOrderView}=await import('../dist/index.js');
 for(const language of ['ru','kk','en']){
  const app=await stateView(DirectMasterOrderView,language,{order:{...approvedOrder,client:{name:'Actual client',phone:null}}});
  try{assert.equal(document.querySelector('footer').children.length,1);assert.equal(document.querySelector('footer a'),null);assert.ok(document.querySelector('main [data-action="revise-approved-quote"]').classList.contains('md:hidden'));assert.ok(document.querySelector('header button:last-child').getAttribute('aria-label'));assert.equal(app.calls.length,0);
   await app.render({order:{...approvedOrder,status:'AWAITING_PRICE_CONFIRM'}});assert.equal(document.querySelector('main [data-action="revise-approved-quote"]'),null);const footer=document.querySelector('footer');assert.equal(footer.children.length,3);assert.equal(footer.firstElementChild.tagName,'BUTTON');assert.equal(footer.children[1].getAttribute('href'),'tel:+77010000000');await act(async()=>footer.firstElementChild.click());assert.ok(document.querySelector('main input'));assert.equal(document.querySelector('footer').children.length,3);assert.equal(app.calls.length,0);
  }finally{await app.cleanup()}
 }
});
test('client DONE shows actual agreed quote before explicit acceptance and exposes problem support without accepting',async()=>{
 for(const language of ['ru','kk','en']){
  const order={...approvedOrder,status:'DONE',description:'Leaking pipe',workComment:'Replace pipe and valve',workPrice:4567,materialsPrice:891,calloutPrice:222,quoteTotal:5680};const app=await stateView(DirectClientOrderView,language,{order});
  try{const quote=document.querySelector('[data-acceptance-quote]');assert.ok(quote,'agreed quote required at acceptance');assert.ok(quote.textContent.includes(order.workComment));assert.ok(quote.textContent.replace(/[^0-9]/g,'').includes('5680'));assert.ok(document.querySelector('[data-acceptance-guidance]'));const payment=document.querySelector('[data-acceptance-payment]');assert.ok(payment);assert.doesNotMatch(payment.textContent,/paid|оплачено|төленді/i);assert.equal(app.calls.length,0);
   const problem=document.querySelector('footer [data-action="report-problem"]');assert.ok(problem);assert.ok(problem.classList.contains('min-h-[56px]'));await act(async()=>problem.click());assert.equal(app.help(),1);assert.equal(app.calls.length,0);for(const guard of [{busy:true},{online:false},{fresh:false}]){await app.render(guard);const accept=document.querySelector('footer [data-action="accept-work"]');assert.equal(accept.disabled,true);await act(async()=>accept.click());assert.equal(app.calls.length,0);}
   await app.render();await act(async()=>document.querySelector('footer [data-action="accept-work"]').click());assert.deepEqual(app.calls,[['confirm-completion']]);await app.render({order:{...order,status:'IN_PROGRESS'}});assert.equal(document.querySelector('[data-acceptance-quote]'),null);assert.equal(document.querySelector('[data-acceptance-guidance]'),null);assert.equal(document.querySelector('footer [data-action="report-problem"]'),null);
  }finally{await app.cleanup()}
 }
});
test('DONE agreed quote preserves unknown amounts as unavailable and real zero as zero',async()=>{
 const app=await stateView(DirectClientOrderView,'en',{order:{...approvedOrder,status:'DONE',workPrice:null,quoteTotal:null}});
 try{const quote=document.querySelector('[data-acceptance-quote]');assert.ok(quote);assert.match(quote.textContent,/Work—/);assert.match(quote.textContent,/Total—/);await app.render({order:{...approvedOrder,status:'DONE',workPrice:0,quoteTotal:0}});const realZero=document.querySelector('[data-acceptance-quote]');assert.match(realZero.textContent,/Work0/);assert.match(realZero.textContent,/Total0/);assert.equal(app.calls.length,0);}
 finally{await app.cleanup()}
});
test('mobile quote consent explains actual scope and Discuss uses real master telephone without consenting',async()=>{
 for(const language of ['ru','kk','en']){
  const order={...approvedOrder,status:'AWAITING_PRICE_CONFIRM',workComment:'Replace pipe and valve',master:{name:'Actual specialist',phone:'+77015551234'}};const app=await stateView(DirectClientOrderView,language,{order});
  try{const intro=document.querySelector('[data-quote-introduction]');assert.ok(intro,'actual proposed scope required');assert.ok(intro.textContent.includes(order.workComment));const discuss=document.querySelector('footer [data-action="discuss-quote"]');assert.equal(discuss.getAttribute('href'),'tel:+77015551234');assert.ok(discuss.classList.contains('min-h-[56px]'));assert.equal(app.calls.length,0);
   for(const guard of [{busy:true},{online:false},{fresh:false}]){await app.render(guard);const approve=document.querySelector('footer [data-action="approve-quote"]');assert.equal(approve.disabled,true);await act(async()=>approve.click());assert.equal(app.calls.length,0)}await app.render();const approve=document.querySelector('footer [data-action="approve-quote"]');assert.ok(approve.classList.contains('min-h-[56px]'));await act(async()=>approve.click());assert.deepEqual(app.calls,[['confirm-price',{quoteVersion:3}]]);
   await app.render({order:{...order,status:'PRICE_APPROVED'}});assert.equal(document.querySelector('[data-quote-introduction]'),null);assert.equal(document.querySelector('footer [data-action="discuss-quote"]'),null);
  }finally{await app.cleanup()}
 }
});
test('mobile quote discussion offers honest existing support when phone is unavailable and retains header Help',async()=>{
 for(const language of ['ru','kk','en']){const app=await stateView(DirectClientOrderView,language,{order:{...approvedOrder,status:'AWAITING_PRICE_CONFIRM',workComment:' ',description:'Real request detail',master:null}});
  try{assert.ok(document.querySelector('[data-quote-introduction]').textContent.includes('Real request detail'));const discuss=document.querySelector('footer [data-action="discuss-quote"]');assert.equal(discuss.tagName,'BUTTON');assert.equal(discuss.getAttribute('href'),null);assert.match(discuss.textContent,language==='ru'?/поддержк/:language==='kk'?/қолдау/:/support/i);await act(async()=>discuss.click());assert.equal(app.help(),1);assert.equal(app.calls.length,0);assert.ok(document.querySelector('header > button:last-child').getAttribute('aria-label'));}
  finally{await app.cleanup()}
 }
});
test('mobile consent does not invent an unavailable total or use a blank telephone',async()=>{
 const app=await stateView(DirectClientOrderView,'en',{order:{...approvedOrder,status:'AWAITING_PRICE_CONFIRM',quoteTotal:null,master:{name:null,phone:'   '}}});
 try{const approve=document.querySelector('footer [data-action="approve-quote"]');assert.equal(approve.disabled,true);assert.doesNotMatch(approve.textContent,/0/);await act(async()=>approve.click());assert.equal(app.calls.length,0);const discuss=document.querySelector('footer [data-action="discuss-quote"]');assert.equal(discuss.tagName,'BUTTON');assert.match(discuss.textContent,/support/i);}
 finally{await app.cleanup()}
});
test('master waiting/DONE refresh is read-only, localized, stale-retryable and guarded against repeated clicks',async()=>{
 const {DirectMasterOrderView}=await import('../dist/index.js');
 for(const language of ['ru','kk','en'])for(const status of ['AWAITING_PRICE_CONFIRM','DONE']){
  let reads=0,resolve;const onRefresh=()=>{reads++;return new Promise(r=>resolve=r)};const app=await stateView(DirectMasterOrderView,language,{order:{...approvedOrder,status},fresh:false,onRefresh});
  try{const refresh=document.querySelector('footer [data-action="refresh-status"]');assert.ok(refresh,'explicit GET refresh required');assert.equal(refresh.disabled,false);assert.ok(refresh.classList.contains('min-h-[56px]'));await act(async()=>{refresh.click();refresh.click()});assert.equal(reads,1);assert.equal(refresh.disabled,true);assert.equal(refresh.getAttribute('aria-busy'),'true');assert.equal(app.calls.length,0);await act(async()=>resolve());assert.equal(refresh.disabled,false);
   for(const guard of [{online:false},{busy:true}]){await app.render(guard);await act(async()=>document.querySelector('footer [data-action="refresh-status"]').click());assert.equal(reads,1)}await app.render({order:{...approvedOrder,status:'PRICE_APPROVED'}});assert.equal(document.querySelector('[data-action="refresh-status"]'),null);assert.equal(app.calls.length,0);
  }finally{await app.cleanup()}
 }
});
test('master refresh request identity survives new-order rerender and ignores late old failure or settlement',async()=>{
 const {DirectMasterOrderView}=await import('../dist/index.js');let firstResolve,secondResolve,firstReject;const app=await stateView(DirectMasterOrderView,'en',{order:{...approvedOrder,status:'DONE'},onRefresh:()=>new Promise((resolve,reject)=>{firstResolve=resolve;firstReject=reject})});
 try{await act(async()=>document.querySelector('footer [data-action="refresh-status"]').click());await app.render({order:{...approvedOrder,id:'second-owned-order',status:'DONE'},onRefresh:()=>new Promise(resolve=>secondResolve=resolve)});assert.equal(document.querySelector('footer [data-action="refresh-status"]').disabled,false);await act(async()=>document.querySelector('footer [data-action="refresh-status"]').click());await act(async()=>firstReject(new Error('Old order failure')));assert.equal(document.querySelector('footer [data-action="refresh-status"]').disabled,true);assert.equal(document.querySelector('[role="alert"]'),null);await act(async()=>secondResolve());assert.equal(document.querySelector('footer [data-action="refresh-status"]').disabled,false);assert.equal(app.calls.length,0);}
 finally{await app.cleanup()}
});
test('rejected read-only refresh shows actual error and allows explicit retry without an order mutation',async()=>{
 const {DirectMasterOrderView}=await import('../dist/index.js');let reads=0;const app=await stateView(DirectMasterOrderView,'en',{order:{...approvedOrder,status:'DONE'},fresh:false,onRefresh:async()=>{reads++;if(reads===1)throw new Error('Actual refresh failure')}});
 try{await act(async()=>document.querySelector('footer [data-action="refresh-status"]').click());assert.equal(document.querySelector('[role="alert"]').textContent,'Actual refresh failure');assert.equal(document.querySelector('footer [data-action="refresh-status"]').disabled,false);await act(async()=>document.querySelector('footer [data-action="refresh-status"]').click());assert.equal(reads,2);assert.equal(document.querySelector('[role="alert"]'),null);assert.equal(app.calls.length,0);}
 finally{await app.cleanup()}
});
test('closed client keeps real quote/payment uncertainty and offers Home/Orders with contact preserved in content',async()=>{
 for(const language of ['ru','kk','en'])for(const reviewed of [false,true]){
  let homes=0;const order={...approvedOrder,status:'CLOSED',workComment:'Actual accepted scope',master:{name:'Actual specialist',phone:'+77015551234'},review:reviewed?{rating:5,comment:'Actual review'}:null};const app=await stateView(DirectClientOrderView,language,{order,onHome:()=>homes++});
  try{const quote=document.querySelector('[data-closed-quote]');assert.ok(quote,'closed quote required');assert.ok(quote.textContent.includes(order.workComment));assert.ok(quote.textContent.replace(/[^0-9]/g,'').includes('14000'));const payment=document.querySelector('[data-closed-payment]');assert.ok(payment);assert.match(payment.textContent,language==='ru'?/Если ещё не оплатили/:language==='kk'?/төлемеген/:/If you haven.t paid/i);assert.ok(document.querySelector('main [data-action="call-closed-master"]').classList.contains('min-h-[56px]'));
   const home=document.querySelector('footer [data-action="go-home"]'),orders=document.querySelector('footer [data-action="open-orders"]');assert.ok(home);assert.ok(orders);assert.ok(home.classList.contains('min-h-[56px]'));await act(async()=>{home.click();orders.click()});assert.equal(homes,1);assert.equal(app.back(),1);assert.equal(app.calls.length,0);assert.equal(!!document.querySelector('textarea'),!reviewed);assert.ok(document.querySelector('header > button:last-child').getAttribute('aria-label'));
   await app.render({order:{...order,status:'IN_PROGRESS'}});assert.equal(document.querySelector('[data-closed-quote]'),null);assert.equal(document.querySelector('[data-closed-payment]'),null);assert.equal(document.querySelector('footer [data-action="go-home"]'),null);
  }finally{await app.cleanup()}
 }
});
test('closed unknown prices remain unavailable, missing contact stays absent and optional review retains mutation guards',async()=>{
 const app=await stateView(DirectClientOrderView,'en',{order:{...approvedOrder,status:'CLOSED',workPrice:null,quoteTotal:null,workComment:' ',description:'Actual accepted request',master:null},onHome(){}});
 try{const quote=document.querySelector('[data-closed-quote]');assert.ok(quote);assert.ok(quote.textContent.includes('Actual accepted request'));assert.match(quote.textContent,/Total—/);assert.match(document.querySelector('[data-closed-payment]').textContent,/—/);assert.equal(document.querySelector('[data-action="call-closed-master"]'),null);await act(async()=>document.querySelector('button[aria-label="5"]').click());
  for(const guard of [{busy:true},{online:false},{fresh:false}]){await app.render(guard);const submit=document.querySelector('[data-action="submit-review"]');assert.equal(submit.disabled,true);await act(async()=>submit.click());assert.equal(app.calls.length,0)}await app.render();await act(async()=>document.querySelector('[data-action="submit-review"]').click());assert.deepEqual(app.calls,[['review',{rating:5,comment:undefined}]]);
 }finally{await app.cleanup()}
});
