import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(new URL('../../../packages/ui/package.json',import.meta.url));const {JSDOM}=require('jsdom');const dom=new JSDOM('<div id="root"></div>',{url:'https://test.local/orders'});Object.assign(globalThis,{window:dom.window,self:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,CustomEvent:dom.window.CustomEvent,localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});window.HTMLDialogElement.prototype.showModal=function(){this.open=true};window.HTMLDialogElement.prototype.close=function(){this.open=false};const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');const {AuthProvider,useAuth,Orders}=await import('../.test-build/safety-entry.js');
const row=(type='urgent',name='Actual client')=>({id:'same-id',type,client:name,master:null,category:'Actual category',status:'SEARCHING',createdAt:'invalid date'});
const detail=(type='urgent')=>({id:'same-id',type,status:'SEARCHING',address:'Actual address',district:'Actual district',createdAt:'invalid date',client:{name:null,phone:'fixture-phone'},master:null,category:'Actual category',workPrice:null,timeline:[{at:'invalid date',event:'Actual backend timeline'}],canAssign:type==='urgent',...(type==='urgent'?{calloutPrice:0,serviceFee:0,lifecycleVersion:2,commercialMode:'DIRECT_PAYMENT',cancellationAmount:null,materialsPrice:0,quoteTotal:null,quoteVersion:0,consentedVersion:null}:{budget:null})});
async function mount(t,language='en',options={}){t.mock.timers.enable({apis:['setTimeout']});if(!options.preserveRecovery)window.sessionStorage.clear();window.history.replaceState(null,'',options.href??'/orders');localStorage.clear();localStorage.setItem('user',JSON.stringify({id:'A',name:'Actual A',phone:'fixture-phone',role:'OPERATOR'}));localStorage.setItem('token','fixture-a');const requests=[];globalThis.fetch=(url,options)=>new Promise((resolve,reject)=>requests.push({path:new URL(url).pathname.replace('/api/v1','')+new URL(url).search,options,reject,respond:(status,body)=>resolve({ok:status>=200&&status<300,status,json:async()=>body}),resolve:body=>resolve({ok:true,status:200,json:async()=>body})}));let auth,locale;const ui=await import('@masterqala/ui');function Probe(){auth=useAuth();locale=ui.useLocale();return null}const root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(ui.LocaleProvider,{initialLanguage:language},React.createElement(AuthProvider,null,React.createElement(Probe),React.createElement(Orders)))));return{requests,auth:()=>auth,locale:()=>locale,tick:()=>act(async()=>t.mock.timers.tick(400)),resolve:(i,b)=>act(async()=>requests[i].resolve(b)),cleanup:async()=>{await act(async()=>root.unmount());t.mock.timers.reset()}}}
const click=selector=>act(async()=>document.querySelector(selector).click());
const candidate={masterUserId:'actual-master',name:'Actual master',distanceKm:0,isOnline:true};
for(const language of ['ru','kk','en'])test(`${language} actual orders route labels filters and retains authoritative direct/planned distinction`,async t=>{const a=await mount(t,language);try{await a.tick();await a.resolve(0,[row(),row('planned')]);assert.equal(document.querySelector('h1').textContent,({ru:'Заказы',kk:'Тапсырыстар',en:'Orders'})[language]);for(const name of ['type','status','search']){const input=document.querySelector(`[name="${name}"]`);assert.ok(input);assert.ok(document.querySelector(`label[for="${input.id}"]`))}await click('[data-order-select="urgent:same-id"]');await a.resolve(1,detail());assert.ok(document.querySelector('[data-order-quote-unknown]'));assert.ok(document.querySelector('[data-order-open-assign]'));assert.doesNotMatch(document.body.textContent,/Invalid Date|Ержан|Азат|Документы проверены/);await click('[data-order-select="planned:same-id"]');assert.equal(document.querySelector('[data-order-open-assign]'),null);await a.resolve(2,detail('planned'));assert.equal(document.querySelector('[data-order-open-assign]'),null);assert.match(document.body.textContent,/Actual backend timeline/);}finally{await a.cleanup()}});
test('duplicate assignment and unknown response stay locked through modal close/reopen until actual GET reconciliation',async t=>{const a=await mount(t);try{await a.tick();await a.resolve(0,[row()]);await click('[data-order-select]');await a.resolve(1,detail());await click('[data-order-open-assign]');await a.resolve(2,[candidate]);await act(async()=>{document.querySelector('[data-order-assign]').click();document.querySelector('[data-order-assign]').click()});assert.equal(a.requests.filter(r=>r.options.method==='POST').length,1);await click('[data-order-close-assign]');await act(async()=>a.requests[3].reject(new Error('fixture committed response lost')));assert.ok(document.querySelector('[data-order-unknown]'));await click('[data-order-open-assign]');await a.resolve(4,[candidate]);assert.equal(document.querySelector('[data-order-assign]').disabled,true);await click('[data-order-reconcile]');await a.resolve(5,{...detail(),status:'ACCEPTED',canAssign:false,master:{name:'Actual master',phone:'fixture-master'}});await a.resolve(6,[]);assert.ok(a.requests.filter(r=>r.options.method==='POST').length===1);await a.resolve(7,{...detail(),status:'ACCEPTED',canAssign:false,master:{name:'Actual master',phone:'fixture-master'}});await a.resolve(8,[]);assert.equal(document.querySelector('[data-order-open-assign]'),null);}finally{await a.cleanup()}});
test('assignment dialog Escape closes editor without losing pending outcome or allowing retained candidate handler',async t=>{const a=await mount(t);try{await a.tick();await a.resolve(0,[row()]);await click('[data-order-select]');await a.resolve(1,detail());await click('[data-order-open-assign]');await a.resolve(2,[candidate]);const dialog=document.querySelector('dialog');assert.ok(dialog);const button=document.querySelector('[data-order-assign]');const props=Object.keys(button).find(k=>k.startsWith('__reactProps$'));const old=button[props].onClick;await act(async()=>dialog.dispatchEvent(new window.Event('cancel',{cancelable:true})));assert.equal(Boolean(document.querySelector('dialog')),false);await act(async()=>old());assert.equal(a.requests.filter(r=>r.options.method==='POST').length,0);}finally{await a.cleanup()}});
test('failed unknown-outcome reconciliation stays blocked, inputs and candidate retry cannot unlock POST',async t=>{const a=await mount(t);try{await a.tick();await a.resolve(0,[row()]);await click('[data-order-select]');await a.resolve(1,detail());await click('[data-order-open-assign]');await a.resolve(2,[candidate]);await click('[data-order-assign]');await act(async()=>a.requests[3].reject(new Error('fixture unknown')));await click('[data-order-reconcile]');await act(async()=>a.requests[4].reject(new Error('fixture read failed')));await a.resolve(5,[candidate]);assert.ok(document.querySelector('[data-order-unknown]'));assert.equal(document.querySelector('[data-order-assign]').disabled,true);await click('[data-order-candidate-refresh]');await a.resolve(6,[candidate]);assert.equal(document.querySelector('[data-order-assign]').disabled,true);assert.equal(a.requests.filter(r=>r.options.method==='POST').length,1);}finally{await a.cleanup()}});
test('old candidate handlers after detail refresh or owner ABA cannot assign while a current verified handler can',async t=>{const a=await mount(t);try{await a.tick();await a.resolve(0,[row()]);await click('[data-order-select]');await a.resolve(1,detail());await click('[data-order-open-assign]');await a.resolve(2,[candidate]);const node=document.querySelector('[data-order-assign]');const old=node[Object.keys(node).find(k=>k.startsWith('__reactProps$'))].onClick;await click('[data-order-detail-refresh]');assert.equal(Boolean(document.querySelector('dialog')),false);await act(async()=>old());assert.equal(a.requests.filter(r=>r.options.method==='POST').length,0);await a.resolve(3,detail());await act(async()=>old());assert.equal(a.requests.filter(r=>r.options.method==='POST').length,0);await click('[data-order-open-assign]');await a.resolve(4,[candidate]);await click('[data-order-assign]');assert.equal(a.requests.filter(r=>r.options.method==='POST').length,1);await act(async()=>a.auth().login('fixture-b',{id:'B',name:'B',phone:'fixture',role:'OPERATOR'}));assert.equal(document.querySelector('[data-order-unknown]'),null);assert.equal(document.querySelector('[data-order-open-assign]'),null);await act(async()=>a.auth().login('fixture-a2',{id:'A',name:'A',phone:'fixture',role:'OPERATOR'}));await act(async()=>old());await a.resolve(5,{});assert.equal(a.requests.filter(r=>r.options.method==='POST').length,1);assert.equal(document.querySelector('[data-order-unknown]'),null);}finally{await a.cleanup()}});
test('quoted zero remains zero, legacy fees and planned budget do not become direct acceptance assertions',async t=>{const a=await mount(t);try{await a.tick();await a.resolve(0,[row()]);await click('[data-order-select]');await a.resolve(1,{...detail(),quoteVersion:1,workPrice:0,quoteTotal:0});assert.equal(document.querySelector('[data-order-quote-unknown]'),null);assert.match(document.body.textContent,/Total: 0/);await click('[data-order-detail-refresh]');await a.resolve(2,{...detail(),lifecycleVersion:1,commercialMode:'PAID',workPrice:100,serviceFee:50,calloutPrice:25});assert.match(document.body.textContent,/Fee: 50/);assert.doesNotMatch(document.body.textContent,/Acceptance does not confirm payment/);assert.match(document.body.textContent,/Actual backend timeline/);}finally{await a.cleanup()}});
test('filter change clears selected context and old row handler cannot restore it; failed refresh keeps actual rows stale',async t=>{const a=await mount(t);try{await a.tick();await a.resolve(0,[row()]);const node=document.querySelector('[data-order-select]');const old=node[Object.keys(node).find(k=>k.startsWith('__reactProps$'))].onClick;await click('[data-order-select]');await a.resolve(1,detail());await act(async()=>{const input=document.querySelector('[name="search"]');Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,'fixture phone');input.dispatchEvent(new window.Event('input',{bubbles:true}));});assert.equal(document.querySelector('[data-order-open-assign]'),null);await act(async()=>old());assert.equal(document.querySelector('[data-order-open-assign]'),null);await a.tick();assert.equal(a.requests[2].path,'/admin/orders?search=fixture+phone');await a.resolve(2,[row('urgent','Current filtered client')]);await click('[data-order-list-refresh]');await a.tick();await act(async()=>a.requests[3].reject(new Error('fixture refresh failure')));assert.match(document.body.textContent,/Current filtered client/);assert.ok(document.querySelector('[data-order-list-stale]'));assert.equal(document.querySelector('[data-order-list-empty]'),null);assert.ok(a.requests.every(r=>r.options.method!== 'POST'));}finally{await a.cleanup()}});
test('late assignment response reconciles its original urgent target without replacing an equal-ID planned detail',async t=>{const a=await mount(t);try{await a.tick();await a.resolve(0,[row(),row('planned')]);await click('[data-order-select="urgent:same-id"]');await a.resolve(1,detail());await click('[data-order-open-assign]');await a.resolve(2,[candidate]);await click('[data-order-assign]');await click('[data-order-select="planned:same-id"]');await a.resolve(4,{...detail('planned'),budget:777});await a.resolve(3,{});assert.equal(a.requests[5].path,'/admin/orders/same-id?type=urgent');assert.equal(a.requests[6].path,'/admin/orders/same-id/candidates?type=urgent');await a.resolve(5,{...detail(),status:'ACCEPTED',canAssign:false});await a.resolve(6,[]);assert.match(document.body.textContent,/Budget: 777/);assert.equal(document.querySelector('[data-order-open-assign]'),null);assert.equal(document.querySelector('[data-order-unknown]'),null);assert.equal(a.requests.filter(r=>r.options.method==='POST').length,1);assert.equal(a.requests.filter(r=>r.path.includes('type=planned')&&!r.path.includes('assign')).length,1);}finally{await a.cleanup()}});
test('long real fields and valid dates preserve actual text with responsive source card classes and locale-only no read',async t=>{const a=await mount(t);try{const long='Actual long customer '+ 'source '.repeat(80);await a.tick();await a.resolve(0,[row('urgent',long)]);await click('[data-order-select]');const date='2026-10-13T12:34:00Z';await a.resolve(1,{...detail(),createdAt:date,client:{name:long,phone:'fixture'},timeline:[{at:date,event:'Actual raw backend event'}]});assert.ok(document.body.textContent.includes(long));assert.ok(document.body.textContent.includes(new Intl.DateTimeFormat('en-GB',{dateStyle:'short',timeStyle:'short'}).format(new Date(date))));assert.ok(document.querySelector('[data-order-detail-panel] .operator-order-detail-cards'));assert.ok(document.querySelector('aside').className.includes('w-full'));assert.ok(document.querySelector('table').parentElement.className.includes('overflow-x-auto'));await act(async()=>a.locale().setLanguage('kk'));assert.equal(a.requests.length,2);assert.ok(document.body.textContent.includes('Actual raw backend event'));assert.doesNotMatch(document.body.textContent,/{{|undefined|Invalid Date/);}finally{await a.cleanup()}});

test('typed deep link restores planned selection and queue filters; missing type never guesses an order',async t=>{
 const a=await mount(t,'en',{href:'/orders?type=PLANNED&id=same-id&status=PUBLISHED&search=fixture'});
 try{
  assert.equal(a.requests[0].path,'/admin/orders/same-id?type=planned');
  assert.equal(document.querySelector('[name="type"]').value,'planned');
  assert.equal(document.querySelector('[name="status"]').value,'PUBLISHED');
  assert.equal(document.querySelector('[name="search"]').value,'fixture');
  await a.resolve(0,detail('planned'));await a.tick();
  assert.equal(a.requests[1].path,'/admin/orders?type=planned&status=PUBLISHED&search=fixture');
  assert.equal(document.querySelector('[data-order-open-assign]'),null);
  await act(async()=>{window.history.pushState(null,'','/orders?id=same-id&type=invalid&status=__proto__');window.dispatchEvent(new window.PopStateEvent('popstate'));});
  assert.equal(document.querySelector('[data-order-detail-panel]'),null);
  assert.equal(document.querySelector('[name="type"]').value,'ALL');assert.equal(document.querySelector('[name="status"]').value,'');
 }finally{await a.cleanup()}
});

test('selection URL preserves colliding IDs, reload and browser history invalidate the old assignment editor',async t=>{
 const a=await mount(t);let href;
 try{
  await a.tick();await a.resolve(0,[row(),row('planned')]);await click('[data-order-select="urgent:same-id"]');await a.resolve(1,detail());
  const urgentURL=window.location.pathname+window.location.search;assert.equal(new URLSearchParams(window.location.search).get('filter'),'ALL');
  await click('[data-order-open-assign]');await a.resolve(2,[candidate]);
  const node=document.querySelector('[data-order-assign]'),old=node[Object.keys(node).find(k=>k.startsWith('__reactProps$'))].onClick;
  await act(async()=>{window.history.pushState(null,'','/orders?type=planned&id=same-id&filter=ALL');window.dispatchEvent(new window.PopStateEvent('popstate'));});
  assert.equal(document.querySelector('dialog'),null);await act(async()=>old());assert.equal(a.requests.filter(r=>r.options.method==='POST').length,0);
  assert.equal(a.requests[3].path,'/admin/orders/same-id?type=planned');await a.resolve(3,detail('planned'));
  await act(async()=>{window.history.pushState(null,'',urgentURL);window.dispatchEvent(new window.PopStateEvent('popstate'));});
  assert.equal(a.requests[4].path,'/admin/orders/same-id?type=urgent');href=window.location.pathname+window.location.search;
 }finally{await a.cleanup()}
 const b=await mount(t,'en',{href});try{assert.equal(b.requests[0].path,'/admin/orders/same-id?type=urgent');assert.equal(document.querySelector('[name="type"]').value,'ALL');}finally{await b.cleanup()}
});

test('reload preserves unknown assignment; missing order and still-assignable reads cannot unlock another POST',async t=>{
 const a=await mount(t);let href;
 try{
  await a.tick();await a.resolve(0,[row()]);await click('[data-order-select]');await a.resolve(1,detail());await click('[data-order-open-assign]');await a.resolve(2,[candidate]);await click('[data-order-assign]');
  assert.equal(window.sessionStorage.getItem('mq:operator:assignment:A:same-id'),'1');
  await act(async()=>a.requests[3].reject(new Error('response lost')));href=window.location.pathname+window.location.search;
 }finally{await a.cleanup()}
 const b=await mount(t,'en',{href,preserveRecovery:true});
 try{
  assert.ok(document.querySelector('[data-order-unknown]'));await b.resolve(0,detail());await click('[data-order-open-assign]');await b.resolve(1,[candidate]);assert.equal(document.querySelector('[data-order-assign]').disabled,true);
  await click('[data-order-reconcile]');await act(async()=>b.requests[2].reject(new Error('order not found')));await b.resolve(3,[]);
  assert.ok(document.querySelector('[data-order-unknown]'));assert.equal(window.sessionStorage.getItem('mq:operator:assignment:A:same-id'),'1');
  await click('[data-order-reconcile]');await b.resolve(4,detail());await b.resolve(5,[candidate]);
  assert.ok(document.querySelector('[data-order-unknown]'));assert.equal(document.querySelector('[data-order-assign]').disabled,true);
  assert.equal(b.requests.filter(r=>r.options.method==='POST').length,0);
  await b.resolve(6,detail());await b.resolve(7,[candidate]);
  await click('[data-order-reconcile]');await b.resolve(8,{...detail(),status:'ACCEPTED',canAssign:false});await b.resolve(9,[]);
  assert.equal(document.querySelector('[data-order-unknown]'),null);assert.equal(window.sessionStorage.getItem('mq:operator:assignment:A:same-id'),null);
 }finally{await b.cleanup()}
});

test('owner switch clears selected URL and cannot reveal or consume another owner recovery marker',async t=>{
 const a=await mount(t,'en',{href:'/orders?type=urgent&id=same-id'});
 try{
  window.sessionStorage.setItem('mq:operator:assignment:B:same-id','1');
  await a.resolve(0,detail());assert.equal(document.querySelector('[data-order-unknown]'),null);
  await act(async()=>a.auth().login('fixture-b',{id:'B',name:'B',phone:'fixture',role:'OPERATOR'}));
  assert.equal(document.querySelector('[data-order-detail-panel]'),null);assert.equal(window.location.search,'');
  assert.equal(window.sessionStorage.getItem('mq:operator:assignment:B:same-id'),null);
  await act(async()=>a.auth().login('fixture-a',{id:'A',name:'A',phone:'fixture',role:'OPERATOR'}));
  assert.equal(document.querySelector('[data-order-detail-panel]'),null);
 }finally{await a.cleanup()}
});

test('unavailable tab storage blocks assignment before any mutation is sent',async t=>{
 const a=await mount(t);
 try{
  await a.tick();await a.resolve(0,[row()]);await click('[data-order-select]');await a.resolve(1,detail());await click('[data-order-open-assign]');await a.resolve(2,[candidate]);
  const original=window.Storage.prototype.setItem;window.Storage.prototype.setItem=function(){throw new Error('blocked storage')};
  try{await click('[data-order-assign]');}finally{window.Storage.prototype.setItem=original;}
  assert.ok(document.querySelector('[data-order-storage-error]'));assert.equal(document.querySelector('[data-order-assign]').disabled,true);assert.equal(a.requests.filter(r=>r.options.method==='POST').length,0);
 }finally{await a.cleanup()}
});

test('409 busy master requires both fresh reads and a new candidate click before retrying SEARCHING order',async t=>{
 const a=await mount(t),replacement={...candidate,masterUserId:'new-current-master',name:'New current master'};
 try{
  await a.tick();await a.resolve(0,[row()]);await click('[data-order-select]');await a.resolve(1,detail());await click('[data-order-open-assign]');await a.resolve(2,[candidate]);
  const node=document.querySelector('[data-order-assign]'),old=node[Object.keys(node).find(k=>k.startsWith('__reactProps$'))].onClick;
  await click('[data-order-assign]');await act(async()=>a.requests[3].respond(409,{message:'Master is already busy'}));
  assert.match(document.querySelector('[data-order-unknown]').textContent,/server rejected/i);
  assert.equal(window.sessionStorage.getItem('mq:operator:assignment:A:same-id'),'rejected');assert.equal(document.querySelector('[data-order-assign]').disabled,true);
  await click('[data-order-reconcile]');await a.resolve(4,detail());
  assert.equal(document.querySelector('[data-order-assign]').disabled,true);assert.equal(a.requests.filter(r=>r.options.method==='POST').length,1);
  await a.resolve(5,[replacement]);assert.equal(document.querySelector('[data-order-unknown]'),null);
  await a.resolve(6,detail());await a.resolve(7,[replacement]);await act(async()=>old());
  assert.equal(a.requests.filter(r=>r.options.method==='POST').length,1);assert.equal(document.querySelector('[data-order-assign]').disabled,false);
  await click('[data-order-assign]');assert.equal(a.requests.filter(r=>r.options.method==='POST').length,2);
  assert.deepEqual(JSON.parse(a.requests[8].options.body),{masterUserId:'new-current-master'});
 }finally{await a.cleanup()}
});

for(const responseStatus of [400,401,403,404,409])test(`received ${responseStatus} rejection survives reload and requires fresh reconciliation`,async t=>{
 const a=await mount(t);let href;
 try{
  await a.tick();await a.resolve(0,[row()]);await click('[data-order-select]');await a.resolve(1,detail());await click('[data-order-open-assign]');await a.resolve(2,[candidate]);await click('[data-order-assign]');
  await act(async()=>a.requests[3].respond(responseStatus,{message:'Request rejected'}));href=window.location.pathname+window.location.search;
 }finally{await a.cleanup()}
 const b=await mount(t,'en',{href,preserveRecovery:true});
 try{
  assert.match(document.querySelector('[data-order-unknown]').textContent,/server rejected/i);await b.resolve(0,detail());
  assert.ok(document.querySelector('[data-order-unknown]'));await click('[data-order-reconcile]');await b.resolve(1,detail());assert.ok(document.querySelector('[data-order-unknown]'));
  await b.resolve(2,[candidate]);assert.equal(document.querySelector('[data-order-unknown]'),null);
  assert.equal(window.sessionStorage.getItem('mq:operator:assignment:A:same-id'),null);assert.equal(b.requests.filter(r=>r.options.method==='POST').length,0);
 }finally{await b.cleanup()}
});

test('409 after a committed assignment uses assigned detail and never offers a second assignment',async t=>{
 const a=await mount(t),assigned={...detail(),status:'ACCEPTED',canAssign:false,master:{name:'Actual master',phone:'fixture-master'}};
 try{
  await a.tick();await a.resolve(0,[row()]);await click('[data-order-select]');await a.resolve(1,detail());await click('[data-order-open-assign]');await a.resolve(2,[candidate]);await click('[data-order-assign]');
  await act(async()=>a.requests[3].respond(409,{message:'Payment capture conflict after assignment'}));
  assert.doesNotMatch(document.querySelector('[data-order-unknown]').textContent,/not assigned|assignment failed/i);
  await click('[data-order-reconcile]');await a.resolve(4,assigned);await a.resolve(5,[]);await a.resolve(6,assigned);await a.resolve(7,[]);
  assert.equal(document.querySelector('[data-order-open-assign]'),null);assert.equal(document.querySelector('[data-order-assign]'),null);assert.equal(a.requests.filter(r=>r.options.method==='POST').length,1);
 }finally{await a.cleanup()}
});

test('pending assignment and a 503 outcome stay locked despite refreshed SEARCHING order and candidates',async t=>{
 const a=await mount(t);
 try{
  await a.tick();await a.resolve(0,[row()]);await click('[data-order-select]');await a.resolve(1,detail());await click('[data-order-open-assign]');await a.resolve(2,[candidate]);await click('[data-order-assign]');
  assert.equal(document.querySelector('[data-order-reconcile]').disabled,true);await click('[data-order-candidate-refresh]');await a.resolve(4,[candidate]);assert.equal(document.querySelector('[data-order-assign]').disabled,true);
  await act(async()=>a.requests[3].respond(503,{message:'Response outcome uncertain'}));assert.equal(window.sessionStorage.getItem('mq:operator:assignment:A:same-id'),'1');
  await click('[data-order-reconcile]');await a.resolve(5,detail());await a.resolve(6,[candidate]);await a.resolve(7,detail());await a.resolve(8,[candidate]);
  assert.ok(document.querySelector('[data-order-unknown]'));assert.equal(document.querySelector('[data-order-assign]').disabled,true);assert.equal(a.requests.filter(r=>r.options.method==='POST').length,1);
 }finally{await a.cleanup()}
});
