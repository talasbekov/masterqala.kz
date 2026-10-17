import test from 'node:test';
import assert from 'node:assert/strict';
import {createDraftSession,readNewOrderDraft,currentOrderSubmission} from '../dist/index.js';
const storage=()=>{const data=new Map();let writes=0;return {get writes(){return writes},getItem:key=>data.get(key)??null,setItem:(key,value)=>{writes++;data.set(key,value)},removeItem:key=>data.delete(key)}};
test('saved address patch publishes and persists all fields atomically, preserves task, invalidates late location',()=>{
 const s=storage(),d=createDraftSession('A',s);d.set('description','Keep task');d.set('photoPaths',['photo.jpg']);d.set('categoryId','11111111-1111-4111-8111-111111111111');const late=d.requestLocation();let notifications=0;d.subscribe(()=>notifications++);const before=s.writes;
 d.patch({addressText:'Saved street',district:'',entrance:'2',floor:'3',apartment:'4',addressComment:'Call',geo:{lat:0,lng:0},locationChosen:true,locationNeedsConfirmation:false});
 assert.equal(notifications,1);assert.equal(s.writes,before+1);assert.equal(d.getSnapshot().description,'Keep task');assert.deepEqual(d.getSnapshot().photoPaths,['photo.jpg']);late({lat:51,lng:71});assert.deepEqual(d.getSnapshot().geo,{lat:0,lng:0});assert.equal(readNewOrderDraft('A',s).apartment,'4');
 d.freeze();d.patch({description:'Forbidden'});assert.equal(d.getSnapshot().description,'Keep task');d.dispose();d.patch({description:'Also forbidden'});assert.equal(s.writes,before+1);
});
test('missing saved coordinates stay unconfirmed across text edits and reload until explicit pin choice',()=>{
 const s=storage(),d=createDraftSession('A',s);d.set('categoryId','11111111-1111-4111-8111-111111111111');d.set('description','Task');d.patch({addressText:'Saved street',district:'District',locationChosen:false,locationNeedsConfirmation:true});
 assert.equal(currentOrderSubmission(d.getSnapshot()),null);d.set('addressText','Corrected street');assert.equal(d.getSnapshot().locationChosen,false);assert.equal(currentOrderSubmission(d.getSnapshot()),null);d.dispose();const restored=createDraftSession('A',s);assert.equal(currentOrderSubmission(restored.getSnapshot()),null);restored.set('geo',{lat:0,lng:0});assert.equal(restored.getSnapshot().locationNeedsConfirmation,false);assert.equal(currentOrderSubmission(restored.getSnapshot()).lat,0);
});
