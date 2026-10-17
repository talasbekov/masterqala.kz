import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<div id="root"></div>',{url:'https://test.local/addresses'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const {AccountAddressBook,AccountProfileView}=await import('../dist/index.js');
const address={id:'saved',label:'Home',address:'Saved street',entrance:null,floor:null,apartment:null,comment:null,isDefault:false};
const draft={editingId:'new',form:{label:'Draft home',address:'Unsaved street',entrance:'2',floor:'3',apartment:'4',comment:'Draft note',isDefault:false},pendingCreate:false};
const button=text=>[...document.querySelectorAll('button')].find(x=>x.textContent===text);
async function mount(Component,initial,{t=key=>key,desktop=true}={}){
 let stored=initial;const calls=[];const root=createRoot(document.getElementById('root'));
 const store={load:()=>stored,save:(_owner,value)=>{stored=value;return true;},clear:()=>{stored=null;}};
 const api=(path,options)=>new Promise((resolve,reject)=>calls.push({path,options,resolve,reject}));
 const render=owner=>act(async()=>root.render(React.createElement(Component,{ownerId:owner,api,t,draftStore:desktop?store:undefined,onBack(){},onLogout(){},languageControl:null})));
 await render('A');
 return {calls,render,store,get stored(){return stored;},resolve:async(i,value)=>act(async()=>calls[i].resolve(value)),reject:async(i)=>act(async()=>calls[i].reject(new Error('Network response lost'))),cleanup:()=>act(async()=>root.unmount())};
}
test('restored profile name survives fresh GET and performs no automatic PATCH',async()=>{
 const f=await mount(AccountProfileView,{name:'Unsaved name'});
 try{await f.resolve(0,{name:'Server name',phone:'+77010000000'});assert.equal(document.querySelector('[name=name]').value,'Unsaved name');assert.equal(f.calls.length,1);}finally{await f.cleanup();}
});
test('restored address draft survives fresh GET without automatically creating an address',async()=>{
 const f=await mount(AccountAddressBook,draft);
 try{await f.resolve(0,[address]);assert.equal(document.querySelector('[name=address]').value,'Unsaved street');assert.equal(f.calls.length,1);}finally{await f.cleanup();}
});
test('uncertain address creation remains blocked after refresh and reload until explicitly discarded',async()=>{
 const f=await mount(AccountAddressBook,draft);
 try{
  await f.resolve(0,[]);
  await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(f.calls[1].options.method,'POST');assert.equal(f.stored.pendingCreate,true);
  await f.reject(1);
  await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(f.calls.length,2);
  assert.ok(document.querySelector('[data-address-create-uncertain]'));
 }finally{await f.cleanup();}
 const reload=await mount(AccountAddressBook,{...draft,pendingCreate:true});
 try{await reload.resolve(0,[address]);assert.equal(document.querySelector('button[type=submit]').disabled,true);assert.equal(reload.calls.length,1);
  await act(async()=>button('addresses.discardDraft').click());assert.equal(reload.stored,null);
 }finally{await reload.cleanup();}
});
test('successful explicit address save clears the draft',async()=>{
 const f=await mount(AccountAddressBook,draft);
 try{await f.resolve(0,[]);await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));await f.resolve(1,{...address,id:'created',address:'Unsaved street'});assert.equal(f.stored,null);}finally{await f.cleanup();}
});

const errorCopy={ru:{'profile.requestError':'Не удалось загрузить или сохранить профиль.','addresses.requestError':'Не удалось загрузить или изменить адреса.'},kk:{'profile.requestError':'Профильді жүктеу немесе сақтау мүмкін болмады.','addresses.requestError':'Мекенжайларды жүктеу немесе өзгерту мүмкін болмады.'},en:{'profile.requestError':'Could not load or save your profile.','addresses.requestError':'Could not load or update your addresses.'}};
for(const language of ['ru','kk','en'])for(const [Component,key,initial,response,field,expected] of [
 [AccountProfileView,'profile.requestError',{name:'Unsaved name'},{name:'Server name',phone:'+77010000000'},'name','Unsaved name'],
 [AccountAddressBook,'addresses.requestError',{...draft,editingId:'saved'},[address],'address','Unsaved street'],
])test(`${language} desktop account errors are localized and keep unsaved fields with GET-only recovery (${key})`,async()=>{
 const f=await mount(Component,initial,{t:key=>errorCopy[language][key]??key});
 try{
  await f.resolve(0,response);
  await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  await f.reject(1);
  assert.ok(document.querySelector('[role=alert]').textContent.includes(errorCopy[language][key]));
  assert.doesNotMatch(document.body.textContent,/Network response lost/);
  assert.equal(document.querySelector(`[name=${field}]`).value,expected);
  await act(async()=>document.querySelector('[data-account-retry]').click());
  assert.equal(f.calls[2].options,undefined);
  await f.resolve(2,response);
  assert.equal(document.querySelector(`[name=${field}]`).value,expected);
 }finally{await f.cleanup();}
});
for(const Component of [AccountProfileView,AccountAddressBook])test('legacy account view retains its existing raw error presentation',async()=>{
 const f=await mount(Component,null,{desktop:false});try{await f.reject(0);assert.match(document.querySelector('[role=alert]').textContent,/Network response lost/);}finally{await f.cleanup();}
});
