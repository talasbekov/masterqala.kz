import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../../packages/ui/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="root"></div>',{url:'https://test.local/become-master'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,CustomEvent:dom.window.CustomEvent,IS_REACT_ACT_ENVIRONMENT:true});
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const {LocaleProvider,useLocale}=await import('@masterqala/ui');
// This suite can run in the full bundle or an isolated application-only build.
const {useMasterApplicationController,ApiError,MASTER_APPLICATION_DRAFT_PREFIX,createMasterApplicationDraftStore,masterApplicationDraftStore,clearMasterApplicationDrafts}=await import(process.env.APPLICATION_DRAFT_TEST_ENTRY??'../.test-build/test/application-draft-entry.js');
const form={fullName:'Actual draft master',iin:'123456789012',district:'Actual district',experienceYears:4};
const categories=[{id:'actual-category',name:'Actual specialty',slug:'actual'}];
const application=(status='NEEDS_INFO',name='Server master')=>({id:'actual-application',...form,fullName:name,status,categories:categories.map(category=>({category})),documents:[]});
const key=owner=>MASTER_APPLICATION_DRAFT_PREFIX+encodeURIComponent(owner);
async function mount({owner='owner-A',clear=false,upload}={}){
 if(clear){window.sessionStorage.clear();localStorage.clear();}
 const requests=[];let controller,locale;const root=createRoot(document.getElementById('root'));
 const api=(path,options={})=>new Promise((resolve,reject)=>requests.push({path,options,method:options.method??'GET',resolve,reject}));
 function Probe({ownerId}){controller=useMasterApplicationController({ownerId,api,upload});locale=useLocale();return null;}
 const render=ownerId=>act(async()=>root.render(React.createElement(LocaleProvider,{initialLanguage:'ru'},React.createElement(Probe,{ownerId}))));
 await render(owner);
 const next=path=>requests.find(request=>!request.settled&&request.method==='GET'&&request.path===path);
 const resolve=async(path,value)=>{const request=next(path);assert.ok(request,path);request.settled=true;await act(async()=>request.resolve(value));};
 const reject=async(path,error)=>{const request=next(path);assert.ok(request,path);request.settled=true;await act(async()=>request.reject(error));};
 const ready=async(value=null)=>{await resolve('/categories',categories);if(value)await resolve('/masters/application',value);else await reject('/masters/application',new ApiError(404,'No application'));};
 return {get controller(){return controller;},requests,render,ready,resolve,reject,language:language=>act(async()=>locale.setLanguage(language)),cleanup:()=>act(async()=>root.unmount())};
}
async function fill(a){await act(async()=>{for(const [field,value] of Object.entries(form))a.controller.changeField(field,value);a.controller.changeCategory('actual-category',true);});}
const posts=a=>a.requests.filter(request=>request.method==='POST');

test('Back/unmount and reload restore exact draft through locale changes without writes',async()=>{
 const first=await mount({clear:true});await first.ready();await fill(first);await first.language('kk');assert.deepEqual(first.controller.form,form);assert.equal(posts(first).length,0);await first.cleanup();
 const reload=await mount();try{assert.equal(reload.controller.canSubmit,false);await reload.ready();assert.deepEqual(reload.controller.form,form);assert.deepEqual(reload.controller.categoryIds,['actual-category']);assert.equal(reload.controller.draftRestored,true);assert.equal(reload.controller.canSubmit,true);await reload.language('en');assert.deepEqual(reload.controller.form,form);assert.equal(posts(reload).length,0);assert.equal(localStorage.getItem(key('owner-A')),null);}finally{await reload.cleanup();}
});
test('explicit cancel clears the owner draft and invalidates retained editing callbacks',async()=>{
 const a=await mount({clear:true});try{await a.ready(application());await act(async()=>a.controller.edit());await fill(a);const oldChange=a.controller.changeField,oldSubmit=a.controller.submit;assert.ok(window.sessionStorage.getItem(key('owner-A')));await act(async()=>a.controller.cancel());assert.equal(window.sessionStorage.getItem(key('owner-A')),null);await act(async()=>{oldChange('fullName','Stale callback');void oldSubmit();});assert.equal(window.sessionStorage.getItem(key('owner-A')),null);assert.equal(a.controller.form.fullName,'Server master');assert.equal(posts(a).length,0);}finally{await a.cleanup();}
});
test('confirmed submission sends one exact DTO and removes draft',async()=>{
 const a=await mount({clear:true});try{await a.ready();await fill(a);await act(async()=>{void a.controller.submit();void a.controller.submit();});assert.equal(posts(a).length,1);assert.deepEqual(JSON.parse(posts(a)[0].options.body),{...form,categoryIds:['actual-category']});assert.equal(masterApplicationDraftStore.load('owner-A').pendingSubmit,true);await act(async()=>posts(a)[0].resolve(application('PENDING_REVIEW')));assert.equal(window.sessionStorage.getItem(key('owner-A')),null);assert.equal(a.controller.showForm,false);assert.equal(a.controller.canSubmit,false);}finally{await a.cleanup();}
});
test('lost POST response survives reload and failed reconciliation; confirmed server result removes draft without another POST',async()=>{
 const first=await mount({clear:true});await first.ready();await fill(first);await act(async()=>{void first.controller.submit();});const original=posts(first)[0];await first.cleanup();assert.equal(original.options.signal.aborted,true);
 const second=await mount();try{assert.equal(second.controller.submissionUncertain,true);assert.equal(second.controller.canSubmit,false);await second.resolve('/categories',categories);await second.reject('/masters/application',Error('Read failed'));assert.equal(masterApplicationDraftStore.load('owner-A').pendingSubmit,true);await act(async()=>{void second.controller.submit();});assert.equal(posts(second).length,0);await act(async()=>second.controller.refresh());await second.ready(application('PENDING_REVIEW','Server committed master'));assert.equal(second.controller.submissionUncertain,false);assert.equal(window.sessionStorage.getItem(key('owner-A')),null);assert.equal(second.controller.form.fullName,'Server committed master');assert.equal(posts(second).length,0);await act(async()=>original.resolve(application('PENDING_REVIEW','Late old result')));assert.equal(second.controller.form.fullName,'Server committed master');}finally{await second.cleanup();}
});
test('authoritative missing read after unknown outcome permits only a deliberate repeat submission',async()=>{
 const first=await mount({clear:true});await first.ready();await fill(first);await act(async()=>{void first.controller.submit();});await act(async()=>posts(first)[0].reject(Error('Response lost')));assert.equal(first.controller.submissionUncertain,true);await first.cleanup();
 const reload=await mount();try{await reload.resolve('/categories',categories);assert.equal(reload.controller.canSubmit,false);await act(async()=>{void reload.controller.submit();});assert.equal(posts(reload).length,0);await reload.reject('/masters/application',new ApiError(404,'No application'));assert.equal(reload.controller.canSubmit,true);assert.equal(reload.controller.submissionUncertain,false);assert.deepEqual(reload.controller.form,form);assert.equal(posts(reload).length,0);await act(async()=>{void reload.controller.submit();});assert.equal(posts(reload).length,1);}finally{await reload.cleanup();}
});
test('old owner and unmounted callbacks cannot change another owner draft or clear its pending marker',async()=>{
 const a=await mount({clear:true});await a.ready();await fill(a);const oldChange=a.controller.changeField,oldCancel=a.controller.cancel;await act(async()=>{void a.controller.submit();});const oldPost=posts(a)[0];await a.render('owner-B');await a.ready();assert.equal(a.controller.form.fullName,'');await fill(a);await act(async()=>a.controller.changeField('fullName','Second owner draft'));const before=window.sessionStorage.getItem(key('owner-B'));await act(async()=>{oldChange('fullName','Old owner injected');oldCancel();oldPost.resolve(application('PENDING_REVIEW'));});assert.equal(window.sessionStorage.getItem(key('owner-B')),before);assert.equal(masterApplicationDraftStore.load('owner-A').pendingSubmit,true);const stale=a.controller.changeField;await a.cleanup();await act(async()=>stale('fullName','After unmount'));assert.equal(window.sessionStorage.getItem(key('owner-B')),before);
});
test('editing an existing application restores across reload and authoritative active status discards stale edits',async()=>{
 const first=await mount({clear:true});await first.ready(application());await act(async()=>first.controller.edit());await fill(first);await first.cleanup();const reload=await mount();try{await reload.ready(application());assert.equal(reload.controller.editing,true);assert.deepEqual(reload.controller.form,form);assert.equal(reload.controller.canSubmit,true);await act(async()=>reload.controller.refresh());await reload.ready(application('ACTIVE','Authoritative master'));assert.equal(reload.controller.showForm,false);assert.equal(reload.controller.form.fullName,'Authoritative master');assert.equal(window.sessionStorage.getItem(key('owner-A')),null);assert.equal(posts(reload).length,0);}finally{await reload.cleanup();}
});
test('partial draft restores but strict DTO and known category checks prevent a POST',async()=>{
 const a=await mount({clear:true});try{await a.ready();await act(async()=>{a.controller.changeField('fullName','A');a.controller.changeField('iin','123');a.controller.changeField('district','D');a.controller.changeCategory('unknown-category',true);});assert.equal(a.controller.canSubmit,false);assert.deepEqual(a.controller.categoryIds,[]);await act(async()=>{void a.controller.submit();});assert.equal(posts(a).length,0);assert.equal(masterApplicationDraftStore.load('owner-A').form.iin,'123');}finally{await a.cleanup();}
});
test('file contents and selections never enter persistent draft',async()=>{
 let rejectUpload;const upload=()=>new Promise((resolve,reject)=>{rejectUpload=reject;});const a=await mount({clear:true,upload});try{await a.ready(application());await act(async()=>a.controller.edit());await fill(a);const before=window.sessionStorage.getItem(key('owner-A'));await act(async()=>{void a.controller.uploadFile('ID_CARD',new File(['secret document bytes'],'private-id.pdf',{type:'application/pdf'}));});assert.equal(window.sessionStorage.getItem(key('owner-A')),before);await act(async()=>rejectUpload(Error('Upload failed')));assert.ok(a.controller.files.ID_CARD);assert.doesNotMatch(window.sessionStorage.getItem(key('owner-A')),/private-id|secret document|files|documents/);}finally{await a.cleanup();}
 const reload=await mount();try{assert.deepEqual(reload.controller.files,{});}finally{await reload.cleanup();}
});
test('logout cleanup removes only application drafts for all owners',()=>{
 window.sessionStorage.clear();const value={form,categoryIds:['actual-category'],editing:true,pendingSubmit:false};masterApplicationDraftStore.save('owner-A',value);masterApplicationDraftStore.save('owner-B',value);window.sessionStorage.setItem('unrelated','preserve');clearMasterApplicationDrafts();assert.equal(masterApplicationDraftStore.load('owner-A'),null);assert.equal(masterApplicationDraftStore.load('owner-B'),null);assert.equal(window.sessionStorage.getItem('unrelated'),'preserve');
});
test('a restored retired category is reconciled with the current catalog so a valid replacement can be selected',async()=>{
 window.sessionStorage.clear();masterApplicationDraftStore.save('owner-A',{form,categoryIds:['retired-category'],editing:false,pendingSubmit:false});
 const a=await mount();try{await a.ready();assert.deepEqual(a.controller.categoryIds,[]);assert.equal(a.controller.canSubmit,false);await act(async()=>a.controller.changeCategory('actual-category',true));assert.equal(a.controller.canSubmit,true);assert.deepEqual(masterApplicationDraftStore.load('owner-A').categoryIds,['actual-category']);assert.equal(posts(a).length,0);}finally{await a.cleanup();}
});
test('owner isolation, tab isolation and untrusted stored shapes never expose invalid draft values',()=>{
 const memory=()=>{const map=new Map();return {get length(){return map.size;},key:index=>[...map.keys()][index]??null,getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};};const one=memory(),two=memory(),first=createMasterApplicationDraftStore(()=>one),second=createMasterApplicationDraftStore(()=>two);const value={form,categoryIds:['actual-category'],editing:true,pendingSubmit:false};assert.equal(first.save('owner-A',value),true);assert.equal(first.load('owner-B'),null);assert.equal(second.load('owner-A'),null);
 for(const bad of [{...value,files:['private.pdf']},{...value,form:{...form,experienceYears:1.5}},{...value,form:{...form,iin:'bad'}},{...value,categoryIds:[1]},{...value,pendingSubmit:'yes'}]){one.setItem(key('owner-A'),JSON.stringify({version:1,ownerId:'owner-A',value:bad}));assert.equal(first.load('owner-A'),null);assert.equal(one.getItem(key('owner-A')),null);}
 one.setItem(key('owner-A'),JSON.stringify({version:1,ownerId:'owner-B',value}));assert.equal(first.load('owner-A'),null);const blocked=createMasterApplicationDraftStore(()=>{throw Error('Storage unavailable');});assert.equal(blocked.save('owner-A',value),false);assert.equal(blocked.load('owner-A'),null);assert.doesNotThrow(()=>blocked.clear());
});
