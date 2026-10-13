import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const uiRequire=createRequire(new URL('../../../packages/ui/package.json',import.meta.url));
const {JSDOM}=uiRequire('jsdom');
const dom=new JSDOM('<div id="root"></div>',{url:'https://mobile.test/order/new',pretendToBeVisual:true});
Object.assign(globalThis,{Element:dom.window.Element,HTMLElement:dom.window.HTMLElement,SVGElement:dom.window.SVGElement,window:dom.window,self:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,CustomEvent:dom.window.CustomEvent,getComputedStyle:dom.window.getComputedStyle,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const {MemoryRouter,Routes,Route,Link,useLocation}=await import('react-router-dom');
const shared=await import('@masterqala/ui');
const {default:i18next}=await import('i18next'),{initReactI18next}=await import('react-i18next');
const ru=JSON.parse(readFileSync(new URL('../src/features/client-v2/i18n/locales/ru.json',import.meta.url),'utf8'));
await i18next.use(initReactI18next).init({lng:'ru',resources:{ru:{translation:ru}},interpolation:{escapeValue:false}});
const {AuthProvider,useAuth}=await import('../.test-build/auth.js');
const {default:NewOrderPage}=await import('../.test-build/features/client-v2/pages/NewOrderPage.js');
// Actual provider, transport and router; no success-shaped mock controller.
const {RequireAuth}=await import('../.test-build/RequireAuth.js');
const {default:LoginPage}=await import('../.test-build/features/client-v2/pages/LoginPage.js');
const categoryId='11111111-1111-4111-8111-111111111111';
function seedDraft(owner='owner-a',step=4){
 const session=shared.createDraftSession(owner,window.sessionStorage);for(const [key,value] of Object.entries({step,categoryId,description:'Persisted request details',addressText:'Actual address',district:'Actual district',geo:{lat:51.2,lng:71.6},locationChosen:true}))session.set(key,value);session.dispose();
}
async function mount({post,onGet,initialEntry='/order/new',protectedRoute=false}={}){
 document.body.innerHTML='<div id="root"></div>';const root=createRoot(document.getElementById('root'));const requests=[];
 globalThis.fetch=async(url,options={})=>{
  const path=new URL(url).pathname.replace('/api/v1','');requests.push([path,options]);
  if(options.method==='POST'&&(path==='/orders'||path==='/orders/idempotent'))return post(path,options);
  let body=path==='/auth/verify-code'?{accessToken:'fixture-token',user:{id:'owner-a',phone:'+77010000000',name:'A',role:'CLIENT'}}:path==='/config/public'?{commercialMode:'DIRECT_PAYMENT',paymentsEnabled:false,leadCreditsEnabled:false,payoutsEnabled:false}:path==='/categories'?[{id:categoryId,slug:'plumbing',name:'Actual category'}]:path==='/addresses'?[]:path==='/orders/preview'?{available:true}:{};
  if(onGet)body=onGet(path,body);return{ok:true,status:200,json:async()=>body};
 };
 const {CommercialModeProvider}=await import('../.test-build/commercial-mode.js');
 function Location(){const location=useLocation();return React.createElement('output',{'data-location':true},location.pathname+location.search+location.hash)}
 function AuthControls(){const auth=useAuth();return React.createElement('div',null,React.createElement('button',{onClick:auth.logout},'Logout test'),React.createElement('button',{onClick:()=>auth.login('fixture-b',{id:'owner-b',phone:'+77020000000',name:'B',role:'CLIENT'})},'Switch owner test'))}
 function Support(){return React.createElement('div',null,'Support route',React.createElement(Link,{to:'/order/new'},'Return to draft'))}
 await act(async()=>root.render(React.createElement(shared.LocaleProvider,{initialLanguage:'ru'},React.createElement(AuthProvider,null,React.createElement(CommercialModeProvider,null,React.createElement(MemoryRouter,{initialEntries:[initialEntry]},React.createElement(React.Fragment,null,React.createElement(AuthControls),React.createElement(Location),React.createElement(Routes,null,React.createElement(Route,{path:'/',element:React.createElement('p',null,'Home route')}),React.createElement(Route,{path:'/login',element:React.createElement(LoginPage)}),protectedRoute?React.createElement(Route,{element:React.createElement(RequireAuth)},React.createElement(Route,{path:'/order/new',element:React.createElement(NewOrderPage)})):React.createElement(Route,{path:'/order/new',element:React.createElement(NewOrderPage)}),React.createElement(Route,{path:'/support',element:React.createElement(Support)}),React.createElement(Route,{path:'/orders',element:React.createElement('p',null,'Owned orders')}),React.createElement(Route,{path:'/order/:id',element:React.createElement('p',null,'Created order route')})))))))));
 return{requests,cleanup:async()=>act(async()=>root.unmount())};
}
test('Vite restores the same owner submitted draft and routes creation through the shared exact-key endpoint',async()=>{
 localStorage.clear();window.sessionStorage.clear();localStorage.setItem('user',JSON.stringify({id:'owner-a',phone:'+77010000000',name:'Actual user',role:'CLIENT'}));localStorage.setItem('token','fixture-token');seedDraft();const posts=[];const app=await mount({post:async(path,options)=>{posts.push([path,JSON.parse(options.body)]);return{ok:true,status:201,json:async()=>({id:'created-order'})}}});
 try{assert.equal(document.body.textContent.includes('Persisted request details'),true,'same-owner restored draft must reach summary');const button=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Найти мастера'));assert.ok(button);await act(async()=>button.click());assert.equal(posts.length,1);assert.equal(posts[0][0],'/orders/idempotent');assert.match(posts[0][1].clientRequestId,/^[0-9a-f-]{36}$/i);assert.equal(posts[0][1].description,'Persisted request details');}
 finally{await app.cleanup()}
});

function reset(){shared.clearNewOrderDraft();localStorage.clear();window.sessionStorage.clear();localStorage.setItem('user',JSON.stringify({id:'owner-a',phone:'+77010000000',name:'Actual user',role:'CLIENT'}));localStorage.setItem('token','fixture-token');}
const button=(text)=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes(text));
const link=(href)=>document.querySelector(`a[href="${href}"]`);
const response=(body,status=200)=>({ok:status<400,status,json:async()=>body});
test('router Link keeps unknown creation locked across support/remount and settles only the exact late response',async()=>{
 reset();seedDraft();let finish;const posts=[];const app=await mount({post:(path,options)=>{posts.push([path,JSON.parse(options.body)]);return new Promise(resolve=>{finish=resolve})}});
 try{await act(async()=>{button('Найти мастера').click();button('Найти мастера')?.click()});assert.equal(posts.length,1);await act(async()=>link('/support').dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true,button:0})));assert.match(document.body.textContent,/Support route/);await act(async()=>link('/order/new').dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true,button:0})));assert.equal(!!button('Найти мастера'),false);assert.match(document.querySelector('h1').textContent,/неизвестен/);await act(async()=>finish(response({id:'exact-late-order'},201)));assert.equal(posts.length,1);assert.equal(!!link('/order/exact-late-order'),true);assert.equal(window.sessionStorage.getItem(shared.CREATE_PENDING_KEY),null);}
 finally{await app.cleanup()}
});
test('reload-style remount reuses exact UUID and submitted snapshot; old API404 never falls back',async()=>{
 reset();seedDraft();const posts=[];let app=await mount({post:async(path,options)=>{posts.push([path,JSON.parse(options.body)]);return response({message:'Old API unavailable'},404)}});
 await act(async()=>button('Найти мастера').click());assert.equal(posts.length,1);await app.cleanup();app=await mount({post:async(path,options)=>{posts.push([path,JSON.parse(options.body)]);return response({id:'replayed'},201)}});
 try{assert.equal(posts.length,1);await act(async()=>button('Проверить отправку').click());assert.equal(posts.length,2);assert.deepEqual(posts[1],posts[0]);assert.equal(posts.every(([path])=>path==='/orders/idempotent'),true);assert.match(document.body.textContent,/Created order route/);}
 finally{await app.cleanup()}
});
test('explicit Vite logout clears owner pending/draft without clearing locale',async()=>{
 reset();seedDraft();localStorage.setItem('mq.locale','en');const app=await mount({post:async()=>response({message:'Unknown'},500)});
 try{await act(async()=>button('Найти мастера').click());assert.equal(!!window.sessionStorage.getItem(shared.CREATE_PENDING_KEY),true);await act(async()=>link('/support').dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true,button:0})));await act(async()=>button('Logout test').click());assert.equal(window.sessionStorage.getItem(shared.CREATE_PENDING_KEY),null);assert.equal(window.sessionStorage.getItem(shared.DRAFT_STORAGE_KEY),null);assert.equal(localStorage.getItem('mq.locale'),'en');}
 finally{await app.cleanup()}
});

function inputValue(input,value){Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new window.Event('input',{bubbles:true}));}
test('actual Vite login resumes safe interrupted current-order route with query/hash',async()=>{
 reset();localStorage.removeItem('user');localStorage.removeItem('token');const app=await mount({initialEntry:'/login?returnTo='+encodeURIComponent('/order/new?draft=yes#address')});
 try{await act(async()=>button('MasterQala').click());await act(async()=>inputValue(document.querySelector('input'),'7010000000'));await act(async()=>button('Получить код').click());await act(async()=>inputValue(document.querySelector('input'),'123456'));await act(async()=>button('Войти').click());assert.equal(document.querySelector('[data-location]').textContent,'/order/new?draft=yes#address');}
 finally{await app.cleanup()}
});

test('damaged same-owner pending marker remains conservative without replay or fresh creation',async()=>{
 for(const key of [undefined,'','x'.repeat(200)]){reset();seedDraft();window.sessionStorage.setItem(shared.CREATE_PENDING_KEY,JSON.stringify({schemaVersion:2,ownerId:'owner-a',requestId:key,protocol:'SERVER_KEYED',submitted:{}}));const posts=[];const app=await mount({post:async(...args)=>{posts.push(args);return response({id:'unexpected'})}});try{assert.match(document.querySelector('h1').textContent,/неизвестен/);assert.equal(!!button('Проверить отправку'),false);assert.equal(!!button('Найти мастера'),false);assert.equal(posts.length,0);assert.equal(!!link('/orders'),true);assert.equal(!!link('/support'),true);}finally{await app.cleanup()}}
});
test('storage-blocked same-document pending survives route remount and explicit logout clears fallback',async()=>{
 reset();seedDraft();let finish;const app=await mount({post:()=>new Promise(resolve=>{finish=resolve})});const descriptor=Object.getOwnPropertyDescriptor(window,'sessionStorage');
 try{Object.defineProperty(window,'sessionStorage',{configurable:true,get(){throw new Error('Storage blocked')}});await act(async()=>button('Найти мастера').click());assert.match(document.body.textContent,/статус отправки не сохранён/);await act(async()=>link('/support').dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true,button:0})));await act(async()=>link('/order/new').dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true,button:0})));assert.equal(!!button('Найти мастера'),false);assert.equal(!!button('Проверить отправку'),true);await act(async()=>link('/support').dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true,button:0})));await act(async()=>button('Logout test').click());assert.equal(shared.readPendingCreate('owner-a'),null);await act(async()=>finish(response({id:'late-after-logout'},201)));assert.equal(!!link('/order/late-after-logout'),false);}
 finally{Object.defineProperty(window,'sessionStorage',descriptor);await app.cleanup();shared.clearNewOrderDraft();}
});
test('new account does not restore previous owner data or navigate on its late response',async()=>{
 reset();seedDraft();let finish;const app=await mount({post:()=>new Promise(resolve=>{finish=resolve})});
 try{await act(async()=>button('Найти мастера').click());await act(async()=>button('Switch owner test').click());assert.equal(document.body.textContent.includes('Persisted request details'),false);assert.equal(!!button('Найти мастера'),false);await act(async()=>finish(response({id:'old-owner-order'},201)));assert.equal(document.querySelector('[data-location]').textContent,'/order/new');assert.equal(!!link('/order/old-owner-order'),false);assert.equal(shared.readNewOrderDraft('owner-b'),null);}
 finally{await app.cleanup()}
});

test('explicit late geolocation cannot replace a newer saved address',async()=>{
 reset();seedDraft('owner-a',3);const calls=[];const geoDescriptor=Object.getOwnPropertyDescriptor(navigator,'geolocation');Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:success=>calls.push(success)}});const app=await mount({onGet:(path,body)=>path==='/addresses'?[{id:'saved',label:'Saved home',address:'Chosen address',entrance:'2',floor:'3',apartment:'4',lat:51.4,lng:71.8}]:body});
 try{await act(async()=>button('Моё место').click());assert.equal(calls.length,2);await act(async()=>button('Saved home').click());await act(async()=>calls[1]({coords:{latitude:10,longitude:20}}));const saved=shared.readNewOrderDraft('owner-a');assert.equal(saved.addressText,'Chosen address');assert.deepEqual(saved.geo,{lat:51.4,lng:71.8});}
 finally{await app.cleanup();if(geoDescriptor)Object.defineProperty(navigator,'geolocation',geoDescriptor);else delete navigator.geolocation;}
});
test('photo upload started by another owner cannot append a reference to the new account draft',async()=>{
 reset();seedDraft('owner-a',2);let finish;const app=await mount({onGet:(path,body)=>path==='/uploads'?new Promise(resolve=>{finish=resolve}):body});
 try{const input=document.querySelector('input[type="file"]');Object.defineProperty(input,'files',{configurable:true,value:[new File(['photo'],'photo.jpg',{type:'image/jpeg'})]});await act(async()=>input.dispatchEvent(new window.Event('change',{bubbles:true})));assert.equal(typeof finish,'function');await act(async()=>button('Switch owner test').click());await act(async()=>finish({path:'22222222-2222-4222-8222-222222222222.jpg',scanStatus:'CLEAN'}));assert.deepEqual(shared.readNewOrderDraft('owner-b')?.photoPaths??[],[]);}
 finally{await app.cleanup()}
});

test('actual Vite auth guard retains protected destination including query/hash',async()=>{
 reset();localStorage.removeItem('user');const app=await mount({protectedRoute:true,initialEntry:'/order/new?source=draft#address'});
 try{const url=new URL(document.querySelector('[data-location]').textContent,'https://mobile.test');assert.equal(url.pathname,'/login');assert.equal(url.searchParams.get('returnTo'),'/order/new?source=draft#address');assert.equal(!!button('Найти мастера'),false);}
 finally{await app.cleanup()}
});
test('actual SMS login refuses external return URL and login-loop destination',async()=>{
 for(const target of ['https://evil.example/path','//evil.example/path','/login?returnTo=/order/new','/%2f%2fevil.example']){reset();localStorage.removeItem('user');const app=await mount({initialEntry:'/login?returnTo='+encodeURIComponent(target)});try{await act(async()=>button('MasterQala').click());await act(async()=>inputValue(document.querySelector('input'),'7010000000'));await act(async()=>button('Получить код').click());await act(async()=>inputValue(document.querySelector('input'),'123456'));await act(async()=>button('Войти').click());assert.equal(document.querySelector('[data-location]').textContent,'/');}finally{await app.cleanup()}}
});
test('offline creation remains editable and sends no POST until connectivity returns',async()=>{
 reset();seedDraft();const posts=[];const app=await mount({post:async(...args)=>{posts.push(args);return response({id:'created'})}});const descriptor=Object.getOwnPropertyDescriptor(navigator,'onLine');
 try{Object.defineProperty(navigator,'onLine',{configurable:true,value:false});await act(async()=>window.dispatchEvent(new window.Event('offline')));assert.equal(button('Найти мастера').disabled,true);await act(async()=>button('Найти мастера').click());assert.equal(posts.length,0);assert.equal(shared.readPendingCreate('owner-a'),null);Object.defineProperty(navigator,'onLine',{configurable:true,value:true});await act(async()=>window.dispatchEvent(new window.Event('online')));await act(async()=>button('Найти мастера').click());assert.equal(posts.length,1);}
 finally{if(descriptor)Object.defineProperty(navigator,'onLine',descriptor);else delete navigator.onLine;await app.cleanup()}
});

test('restored summary revalidates preview before creation and preserves existing mode availability gates',async()=>{
 for(const [mode,available,enabled] of [['DIRECT_PAYMENT',false,true],['FREE_PILOT',false,false],['PAID_MOCK',false,false]]){reset();seedDraft();let finishPreview;const posts=[];const app=await mount({post:async(...args)=>{posts.push(args);return response({id:'created'})},onGet:(path,body)=>path==='/config/public'?{commercialMode:mode,paymentsEnabled:mode==='PAID_MOCK',leadCreditsEnabled:false,payoutsEnabled:false}:path==='/orders/preview'?new Promise(resolve=>{finishPreview=resolve}):body});try{const submitButton=[...document.querySelectorAll('button')].at(-1);assert.equal(submitButton.disabled,true);assert.equal(posts.length,0);await act(async()=>finishPreview({available,calloutPrice:2500,serviceFee:0}));assert.equal([...document.querySelectorAll('button')].at(-1).disabled,!enabled);}finally{await app.cleanup()}}
});
test('an unresolved old-owner POST cannot keep a new owner draft busy',async()=>{
 reset();seedDraft();let finishOld;const posts=[];const app=await mount({post:(path,options)=>{posts.push(JSON.parse(options.body));return posts.length===1?new Promise(resolve=>{finishOld=resolve}):Promise.resolve(response({id:'new-owner-created'},201))}});
 try{await act(async()=>button('Найти мастера').click());seedDraft('owner-b');await act(async()=>button('Switch owner test').click());assert.equal(button('Найти мастера').disabled,false);await act(async()=>button('Найти мастера').click());assert.equal(posts.length,2);assert.notEqual(posts[0].clientRequestId,posts[1].clientRequestId);await act(async()=>finishOld(response({id:'old-owner-late'},201)));assert.equal(document.querySelector('[data-location]').textContent,'/order/new-owner-created');}
 finally{await app.cleanup()}
});
