import assert from 'node:assert/strict';
import test from 'node:test';
import {readNewOrderDraft,writeNewOrderDraft,clearNewOrderDraft,DRAFT_STORAGE_KEY} from '../.test-build/lib/new-order-draft.js';
const draft={step:3,categoryId:'category-1',description:'Actual task',photoPaths:['uploads/clean-owner-photo.jpg'],geo:{lat:51.1,lng:71.4},addressText:'Actual selected address',district:'District',entrance:'3',floor:'7',apartment:'84',addressComment:'Call first',locationChosen:true};
const storage=()=>{const data=new Map();return{data,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)}};
test('one owner-scoped session record restores only necessary draft fields, not credentials or prices',()=>{
 const s=storage();assert.equal(writeNewOrderDraft('owner-a',{...draft,token:'never-save',quoteTotal:14000,preview:{available:true}},s),true);
 assert.deepEqual(readNewOrderDraft('owner-a',s),draft);const saved=s.getItem(DRAFT_STORAGE_KEY);assert.ok(!saved.includes('never-save'));assert.ok(!saved.includes('quoteTotal'));assert.ok(!saved.includes('preview'));assert.equal(s.data.size,1);
});
test('a different account never receives another owner’s draft and removes the bounded stale record',()=>{
 const s=storage();writeNewOrderDraft('owner-a',draft,s);assert.equal(readNewOrderDraft('owner-b',s),null);assert.equal(s.getItem(DRAFT_STORAGE_KEY),null);writeNewOrderDraft('owner-b',{...draft,addressText:'Owner B'},s);assert.equal(s.data.size,1);assert.equal(readNewOrderDraft('owner-a',s),null);
});
test('malformed/schema-invalid records and file/blob previews are rejected safely',()=>{
 const s=storage();for(const record of ['broken JSON',JSON.stringify({schemaVersion:99,ownerId:'owner-a',draft}),JSON.stringify({schemaVersion:1,ownerId:'owner-a',draft:{...draft,geo:{lat:NaN,lng:Infinity}}}),JSON.stringify({schemaVersion:1,ownerId:'owner-a',draft:{...draft,photoPaths:['blob:preview']}})]){s.setItem(DRAFT_STORAGE_KEY,record);assert.equal(readNewOrderDraft('owner-a',s),null);assert.equal(s.getItem(DRAFT_STORAGE_KEY),null)}
 assert.equal(writeNewOrderDraft('owner-a',{...draft,photoPaths:['data:image/png;base64,secret-file']},s),false);
});
test('blocked storage remains usable and logout clearing does not delete unrelated preferences or data',()=>{
 const broken={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},removeItem(){throw Error('blocked')}};assert.equal(readNewOrderDraft('owner-a',broken),null);assert.equal(writeNewOrderDraft('owner-a',draft,broken),false);assert.doesNotThrow(()=>clearNewOrderDraft(broken));const s=storage();s.setItem('mq.locale','kk');s.setItem('unrelated','keep');s.setItem(DRAFT_STORAGE_KEY,JSON.stringify({schemaVersion:1,ownerId:'owner-a',draft}));clearNewOrderDraft(s);assert.equal(s.getItem(DRAFT_STORAGE_KEY),null);assert.equal(s.getItem('mq.locale'),'kk');assert.equal(s.getItem('unrelated'),'keep');
});

const {createDraftSession}=await import('../.test-build/lib/new-order-draft.js');
test('live draft edits survive remount; late initial location cannot overwrite selected or restored coordinates',()=>{
 const s=storage();const session=createDraftSession('owner-a',s);session.set('addressText','Explicit street');session.set('geo',{lat:51.2,lng:71.6});session.applyInitialLocation({lat:40,lng:20});assert.equal(session.getSnapshot().addressText,'Explicit street');assert.deepEqual(session.getSnapshot().geo,{lat:51.2,lng:71.6});session.dispose();const restored=createDraftSession('owner-a',s);assert.equal(restored.getSnapshot().addressText,'Explicit street');restored.applyInitialLocation({lat:41,lng:21});assert.deepEqual(restored.getSnapshot().geo,{lat:51.2,lng:71.6});
});
test('completion or disposal invalidates late upload/location callbacks without recreating cleared draft',()=>{
 const s=storage();const session=createDraftSession('owner-a',s);session.set('description','Task');session.complete();assert.equal(s.getItem(DRAFT_STORAGE_KEY),null);session.set('photoPaths',paths=>[...paths,'uploads/late.jpg']);session.applyInitialLocation({lat:40,lng:20});assert.equal(s.getItem(DRAFT_STORAGE_KEY),null);const second=createDraftSession('owner-a',s);second.set('description','Unsaved request failed');second.dispose();second.set('description','Late callback');assert.equal(readNewOrderDraft('owner-a',s).description,'Unsaved request failed');
});
test('fresh initial location is usable, but restoring even incomplete draft keeps its coordinates',()=>{
 const s=storage();const session=createDraftSession('owner-a',s);session.applyInitialLocation({lat:51.5,lng:71.5});assert.deepEqual(session.getSnapshot().geo,{lat:51.5,lng:71.5});session.set('description','Pending');session.dispose();const restored=createDraftSession('owner-a',s);restored.applyInitialLocation({lat:40,lng:20});assert.deepEqual(restored.getSnapshot().geo,{lat:51.5,lng:71.5});
});
test('an old disposed request cannot clear a newer account’s draft when its create response arrives',()=>{
 const s=storage();const old=createDraftSession('owner-a',s);old.set('description','Old task');old.dispose();const current=createDraftSession('owner-b',s);current.set('description','Current owner task');assert.equal(old.complete(),false);assert.equal(readNewOrderDraft('owner-b',s).description,'Current owner task');assert.equal(current.complete(),true);assert.equal(s.getItem(DRAFT_STORAGE_KEY),null);
});
test('explicit geolocation callbacks lose ownership to later address/map choices and newer location requests',()=>{
 const s=storage();const session=createDraftSession('owner-a',s);const first=session.requestLocation();session.set('addressText','Saved address');session.set('geo',{lat:51.3,lng:71.7});first({lat:40,lng:20});assert.deepEqual(session.getSnapshot().geo,{lat:51.3,lng:71.7});assert.equal(session.getSnapshot().addressText,'Saved address');const older=session.requestLocation();const latest=session.requestLocation();latest({lat:51.6,lng:71.8});older({lat:40,lng:20});assert.deepEqual(session.getSnapshot().geo,{lat:51.6,lng:71.8});const afterUnmount=session.requestLocation();session.dispose();afterUnmount({lat:40,lng:20});assert.deepEqual(session.getSnapshot().geo,{lat:51.6,lng:71.8});
});
const {beginPendingCreate,readPendingCreate,resolvePendingCreate,CREATE_PENDING_KEY}=await import('../.test-build/lib/new-order-draft.js');
test('pending creation survives same-owner remount and refuses blind resubmit; exact late success resolves its record',()=>{
 const s=storage();writeNewOrderDraft('owner-a',draft,s);const request=beginPendingCreate('owner-a',s);assert.ok(request);assert.equal(readPendingCreate('owner-a',s).requestId,request.requestId);assert.equal(beginPendingCreate('owner-a',s),null);assert.equal(resolvePendingCreate({...request,requestId:'different'},'order-1',s),false);assert.ok(s.getItem(CREATE_PENDING_KEY));assert.equal(resolvePendingCreate(request,'order-1',s),true);assert.equal(s.getItem(CREATE_PENDING_KEY),null);assert.equal(s.getItem(DRAFT_STORAGE_KEY),null);
});
test('late success from an old request cannot remove another owner or a newer same-owner draft',()=>{
 const s=storage();writeNewOrderDraft('owner-a',draft,s);const old=beginPendingCreate('owner-a',s);clearNewOrderDraft(s);writeNewOrderDraft('owner-a',{...draft,description:'New task after intentional logout'},s);const newer=beginPendingCreate('owner-a',s);assert.equal(resolvePendingCreate(old,'order-old',s),false);assert.equal(readNewOrderDraft('owner-a',s).description,'New task after intentional logout');assert.equal(readPendingCreate('owner-a',s).requestId,newer.requestId);clearNewOrderDraft(s);writeNewOrderDraft('owner-b',{...draft,description:'Owner B'},s);const b=beginPendingCreate('owner-b',s);assert.equal(resolvePendingCreate(newer,'order-old',s),false);assert.equal(readNewOrderDraft('owner-b',s).description,'Owner B');assert.equal(readPendingCreate('owner-b',s).requestId,b.requestId);
});
test('storage-denied pending requests are explicitly volatile rather than pretending reload-safe persistence',()=>{
 const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},removeItem(){throw Error('blocked')}};const request=beginPendingCreate('owner-a',blocked);assert.ok(request);assert.equal(request.persistent,false);assert.equal(readPendingCreate('owner-a',blocked),null);assert.equal(resolvePendingCreate(request,'known-order',blocked),false);
});
