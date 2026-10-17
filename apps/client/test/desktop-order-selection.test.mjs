import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(new URL('../../../packages/ui/package.json',import.meta.url));const {JSDOM}=require('jsdom');const dom=new JSDOM('<div id="root"></div>',{url:'https://test.local/?category=one'});Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const {SavedAddressPicker,useCategoryLink,savedAddressCopy,desktopCopy,savedAddressPatch}=await import(process.env.MQ_DESKTOP_ORDER_TEST_BUILD??'../.test-build/test/desktop-order-entry.js');
const {createDraftSession,readNewOrderDraft,currentOrderSubmission}=await import('@masterqala/ui');
const address={id:'A-address',label:'Home',address:'Actual street',entrance:'2',floor:'3',apartment:'4',comment:'Call first',lat:0,lng:0};
async function mount(language='en',onApply=()=>{}){
 const root=createRoot(document.getElementById('root')),calls=[],applied=[];const api=(path,options)=>new Promise((resolve,reject)=>calls.push({path,options,resolve,reject}));
 const render=ownerId=>act(async()=>root.render(React.createElement(SavedAddressPicker,{ownerId,api,copy:{...desktopCopy[language],...savedAddressCopy[language]},onApply:value=>{applied.push(value);onApply(value)}})));
 await render('A');return {calls,applied,render,resolve:(i,value)=>act(async()=>calls[i].resolve(value)),reject:i=>act(async()=>calls[i].reject(Error('Raw Russian server error'))),cleanup:()=>act(async()=>root.unmount())};
}
function select(id){const el=document.querySelector('select');el.value=id;el.dispatchEvent(new window.Event('change',{bubbles:true}));}
test('a single saved address can be reapplied after manual edits by clearing the picker selection',async()=>{
 window.sessionStorage.clear();const draft=createDraftSession('A');const f=await mount('en',address=>draft.patch(savedAddressPatch(address)));
 try{await f.resolve(0,[address]);await act(async()=>select(address.id));draft.set('addressText','Manual street');draft.set('apartment','Manual apartment');await act(async()=>select(''));assert.equal(document.querySelector('select').value,'');assert.equal(draft.getSnapshot().addressText,'Manual street');assert.equal(f.applied.length,1);await act(async()=>select(address.id));assert.equal(draft.getSnapshot().addressText,address.address);assert.equal(draft.getSnapshot().apartment,address.apartment);assert.equal(f.applied.length,2);assert.equal(f.calls.length,1);}finally{await f.cleanup();draft.dispose();window.sessionStorage.clear();}
});
test('owner saved-address read never auto-applies; deliberate selection copies exact API data with no writes',async()=>{
 const f=await mount();try{assert.equal(document.querySelector('select').disabled,true);await f.resolve(0,[address]);assert.equal(f.applied.length,0);await act(async()=>select(address.id));assert.deepEqual(f.applied,[address]);assert.equal(f.calls.length,1);assert.equal(f.calls[0].path,'/addresses');assert.equal(f.calls[0].options.method,undefined);}finally{await f.cleanup();}
});
test('late owner A list cannot appear or apply after B takes over, including A→B→A',async()=>{
 const f=await mount();try{await f.render('B');assert.equal(f.calls[0].options.signal.aborted,true);await f.resolve(0,[address]);assert.doesNotMatch(document.body.textContent,/Actual street/);await f.resolve(1,[{...address,id:'B-address',address:'B street'}]);await act(async()=>select('B-address'));assert.equal(f.applied[0].address,'B street');await f.render('A');assert.doesNotMatch(document.body.textContent,/B street/);assert.equal(f.calls.length,3);assert.equal(document.querySelector('select').disabled,true);}finally{await f.cleanup();}
});
for(const language of ['ru','kk','en'])test(`${language} saved address failure has localized retry and empty recovery, never raw error`,async()=>{
 const f=await mount(language);try{await f.reject(0);assert.ok(document.querySelector('[role=alert]').textContent.includes(savedAddressCopy[language].savedAddressError));assert.doesNotMatch(document.body.textContent,/Raw Russian server error/);await act(async()=>document.querySelector('button').click());assert.equal(f.calls.length,2);await f.resolve(1,[]);assert.ok(document.body.textContent.includes(savedAddressCopy[language].savedAddressEmpty));assert.equal(f.applied.length,0);}finally{await f.cleanup();}
});
test('address selection persists one full patch and preserves task/category/photos across reload without submission',()=>{
 window.sessionStorage.clear();const d=createDraftSession('A');d.set('description','Entered task');d.set('categoryId','11111111-1111-4111-8111-111111111111');d.set('photoPaths',['11111111-1111-4111-8111-111111111111.jpg']);d.patch(savedAddressPatch({...address,lat:null,lng:null}));d.set('district','Actual district');d.set('addressText','Corrected address');d.dispose();const restored=createDraftSession('A');const value=readNewOrderDraft('A');assert.equal(value.description,'Entered task');assert.equal(value.categoryId,'11111111-1111-4111-8111-111111111111');assert.equal(value.photoPaths.length,1);assert.equal(value.apartment,'4');assert.equal(currentOrderSubmission(restored.getSnapshot()),null);restored.set('geo',{lat:0,lng:0});assert.equal(currentOrderSubmission(restored.getSnapshot()).lat,0);restored.dispose();window.sessionStorage.clear();
});
test('category intent waits for validated catalog, applies once, consumes URL, and never resets later selection',async()=>{
 const root=createRoot(document.getElementById('root'));let selected='existing';const replacements=[];function Harness({search,categories}){useCategoryLink(search,categories,id=>{selected=id},href=>replacements.push(href));return null;}
 const render=(search,categories)=>act(async()=>root.render(React.createElement(Harness,{search,categories})));
 try{await render('category=one',null);assert.equal(selected,'existing');await render('category=one',[{id:'one'},{id:'two'}]);assert.equal(selected,'one');assert.deepEqual(replacements,['/']);selected='two';await render('category=one',[{id:'one'},{id:'two'}]);assert.equal(selected,'two');await render('',[{id:'one'}]);await render('category=invalid',[{id:'one'}]);assert.equal(selected,'two');await render('category=one',[{id:'one'}]);assert.equal(selected,'one');}finally{await act(async()=>root.unmount());}
});
