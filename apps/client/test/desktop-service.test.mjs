import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../../packages/ui/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="root"></div>',{url:'https://test.local/payments'});
Object.assign(globalThis,{window:dom.window,self:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,CustomEvent:dom.window.CustomEvent,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const {LocaleProvider,useLocale}=await import('@masterqala/ui');
const {AuthProvider}=await import('../.test-build/lib/auth.js');
const {PaymentsPage,SupportPage,NotificationsPage}=await import('../.test-build/test/desktop-service-entry.js');
const {RouterContext}=await import('next/dist/shared/lib/router-context.shared-runtime.js');
async function mount(Page,language='en',authenticated=true){
 localStorage.clear();if(authenticated){localStorage.setItem('token','fixture');localStorage.setItem('user',JSON.stringify({id:'A',phone:'+77010000000',role:'CLIENT'}));}
 const requests=[],destinations=[];
 globalThis.fetch=(url,options={})=>new Promise((resolve,reject)=>requests.push({url,method:options.method??'GET',signal:options.signal,resolve:body=>resolve({ok:true,status:200,json:async()=>body}),reject}));
 const root=createRoot(document.getElementById('root'));let locale;
 function LocaleControl(){locale=useLocale();return null;}
 const router={pathname:'/payments',asPath:'/payments',push:href=>{destinations.push(href);},replace(){},prefetch:async()=>{}};
 await act(async()=>root.render(React.createElement(LocaleProvider,{initialLanguage:language},React.createElement(LocaleControl),React.createElement(AuthProvider,null,React.createElement(RouterContext.Provider,{value:router},React.createElement(Page))))));
 return {requests,destinations,setLanguage:async language=>act(async()=>locale.setLanguage(language)),resolve:async(body,index=0)=>act(async()=>requests[index].resolve(body)),reject:async(index=0)=>act(async()=>requests[index].reject(Error('Network unavailable'))),cleanup:async()=>act(async()=>root.unmount())};
}
const config=mode=>({commercialMode:mode,paymentsEnabled:mode==='PAID_MOCK',leadCreditsEnabled:mode==='PAID_MOCK',payoutsEnabled:mode==='PAID_MOCK'});
const click=element=>act(async()=>element.dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true,button:0})));
const translated={ru:{support:'Помощь',notifications:'Уведомления',payments:'Оплата',pilot:'Бесплатный пилот',direct:'Оплата напрямую',mock:'Тестовый режим',loading:'Проверяем доступность оплаты',error:'Не удалось проверить доступность оплаты'},kk:{support:'Көмек',notifications:'Хабарламалар',payments:'Төлем',pilot:'Тегін пилот',direct:'Тікелей төлем',mock:'Сынақ режимі',loading:'Төлемнің қолжетімділігін тексеріп жатырмыз',error:'Төлемнің қолжетімділігін тексеру мүмкін болмады'},en:{support:'Help',notifications:'Notifications',payments:'Payments',pilot:'Free pilot',direct:'Direct payment',mock:'Test mode',loading:'Checking payment availability',error:'Could not check payment availability'}};
for(const language of ['ru','kk','en'])for(const [Page,kind] of [[SupportPage,'support'],[NotificationsPage,'notifications']])test(`${language} desktop ${kind} links use supported routes without fetching or submitting`,async()=>{
 const a=await mount(Page,language);try{const page=document.querySelector('.desktop-service');assert.ok(page);assert.equal(page.querySelector('h1').textContent,translated[language][kind]);assert.ok(page.querySelector('[data-service-unavailable]'));assert.equal(page.querySelectorAll('form,input,textarea,button,a[href^="tel:"],a[href^="mailto:"]').length,0);assert.ok(page.querySelector('a[href="/orders"]'));if(kind==='support')assert.ok(page.querySelector('a[href="/profile"]'));else assert.ok(page.querySelector('a[href="/support"]'));await click(page.querySelector('a[href="/orders"]'));assert.deepEqual(a.destinations,['/orders']);assert.equal(a.requests.length,0);}finally{await a.cleanup();}
});
test('desktop support offers sign-in when no session exists',async()=>{const a=await mount(SupportPage,'en',false);try{assert.ok(document.querySelector('.desktop-service a[href="/login"]'));assert.equal(document.querySelector('.desktop-service a[href="/profile"]'),null);assert.equal(a.requests.length,0);}finally{await a.cleanup();}});
for(const language of ['ru','kk','en'])for(const [mode,key] of [['FREE_PILOT','pilot'],['DIRECT_PAYMENT','direct'],['PAID_MOCK','mock']])test(`${language} payments reflects ${mode} and exposes no charge or card controls`,async()=>{
 const a=await mount(PaymentsPage,language);try{assert.equal(document.querySelector('h1').textContent,translated[language].payments);assert.ok(document.body.textContent.includes(translated[language].loading));assert.equal(document.querySelector('[data-payment-mode]'),null);assert.equal(a.requests.length,1);assert.ok(a.requests[0].url.endsWith('/config/public'));assert.equal(a.requests[0].method,'GET');await a.resolve(config(mode));assert.equal(document.querySelector('[data-payment-mode]').dataset.paymentMode,mode);assert.ok(document.body.textContent.includes(translated[language][key]));assert.equal(document.querySelectorAll('button,form,input').length,0);await click(document.querySelector('a[href="/orders"]'));assert.deepEqual(a.destinations,['/orders']);assert.equal(a.requests.length,1);}finally{await a.cleanup();}
});
for(const language of ['ru','kk','en'])test(`${language} failed config is honest and retry only reads public config`,async()=>{const a=await mount(PaymentsPage,language);try{await a.reject();assert.ok(document.querySelector('[role=alert]').textContent.includes(translated[language].error));assert.equal(document.querySelector('[data-payment-mode]'),null);assert.ok(!document.body.textContent.includes(translated[language].pilot));await click(document.querySelector('[data-payment-retry]'));assert.equal(a.requests.length,2);assert.equal(a.requests[1].method,'GET');await a.resolve(config('DIRECT_PAYMENT'),1);assert.equal(document.querySelector('[data-payment-mode]').dataset.paymentMode,'DIRECT_PAYMENT');}finally{await a.cleanup();}});
for(const payload of [null,{},config('PAID_LIVE'),config('PLATFORM_V1_RESERVED'),{...config('FREE_PILOT'),paymentsEnabled:true},{...config('PAID_MOCK'),payoutsEnabled:'yes'}])test(`unknown or inconsistent payment configuration remains unavailable: ${JSON.stringify(payload)}`,async()=>{const a=await mount(PaymentsPage);try{await a.resolve(payload);assert.ok(document.querySelector('[data-payment-unavailable]'));assert.equal(document.querySelector('[data-payment-mode]'),null);assert.equal(document.querySelectorAll('form,input').length,0);assert.equal(a.requests.length,1);}finally{await a.cleanup();}});
test('leaving payments cancels its configuration read',async()=>{const a=await mount(PaymentsPage);await a.cleanup();assert.equal(a.requests[0].signal.aborted,true);});

const paymentFacts={
 FREE_PILOT:{ru:'Платформа не принимает оплату и не списывает деньги.',kk:'Платформа төлем қабылдамайды және ақша алмайды.',en:'The platform does not collect payments or charge money.'},
 DIRECT_PAYMENT:{ru:'Работу оплачивают напрямую мастеру по согласованной смете.',kk:'Жұмыс ақысы келісілген смета бойынша тікелей шеберге төленеді.',en:'Pay the master directly according to the agreed quote.'},
 PAID_MOCK:{ru:'Реальные деньги не списываются и не переводятся.',kk:'Нақты ақша алынбайды және аударылмайды.',en:'No real money is charged or transferred.'},
};
for(const mode of ['FREE_PILOT','DIRECT_PAYMENT','PAID_MOCK'])test(`${mode}: mounted payments switches RU/KK/EN through LocaleProvider with one config read and no writes`,async()=>{
 const a=await mount(PaymentsPage,'ru');try{
  await a.resolve(config(mode));
  for(const language of ['ru','kk','en']){
   await a.setLanguage(language);
   assert.equal(document.querySelector('h1').textContent,translated[language].payments);
   const modeCard=document.querySelector('[data-payment-mode]');assert.equal(modeCard.dataset.paymentMode,mode);
   assert.ok(modeCard.textContent.includes(paymentFacts[mode][language]));
   assert.equal(document.documentElement.lang,language);
   assert.doesNotMatch(document.body.textContent,/(?:payments|service)\.[a-zA-Z]/);
   if(language==='en')assert.doesNotMatch(document.body.textContent,/[А-Яа-яЁё]/);
   assert.equal(document.querySelectorAll('button,form,input').length,0);
  }
  assert.equal(a.requests.length,1);assert.equal(a.requests[0].method,'GET');assert.ok(a.requests[0].url.endsWith('/config/public'));
 }finally{await a.cleanup();}
});
