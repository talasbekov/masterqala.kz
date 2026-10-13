import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import * as ui from '../dist/index.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
async function setup(){
 assert.equal(typeof ui.useOwnedAccountResource,'function');
 const dom=new JSDOM('<div id="root"></div>');globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const root=createRoot(document.getElementById('root'));let value;const calls=[];
 const api=(path,options)=>{const task=deferred();calls.push({path,options,task});return task.promise;};
 function Host({owner}){value=ui.useOwnedAccountResource({ownerId:owner,path:'/users/me',api});return React.createElement('output',null,JSON.stringify({data:value.data,error:value.error,loading:value.loading,busy:value.busy}));}
 const render=owner=>act(async()=>root.render(React.createElement(Host,{owner})));
 await render('A');return {calls,render,get:()=>value,resolve:async(i,data)=>act(async()=>calls[i].task.resolve(data)),reject:async(i,error)=>act(async()=>calls[i].task.reject(new Error(error))),cleanup:async()=>{await act(async()=>root.unmount());dom.window.close();}};
}
test('account reads and retained actions never cross A→B→A generations',async()=>{
 const a=await setup();const old=a.get();await a.render('B');await a.resolve(0,{name:'Old A'});assert.equal(a.get().data,null);
 await a.resolve(1,{name:'B'});assert.equal(a.get().data.name,'B');await a.render('A');await act(async()=>old.retry());assert.equal(a.calls.length,3);
 await a.resolve(2,{name:'New A'});assert.equal(a.get().data.name,'New A');await a.cleanup();
});
test('write completion from old owner cannot update data or execute success callback',async()=>{
 const a=await setup();await a.resolve(0,{name:'A'});let successes=0;let pending;
 await act(async()=>{pending=a.get().mutate('/users/me',{method:'PATCH',body:'{"name":"Changed"}'},()=>successes++);});
 await a.render('B');await a.resolve(1,{name:'Changed'});await pending;assert.equal(successes,0);assert.equal(a.get().data,null);
 await a.resolve(2,{name:'B'});await a.cleanup();
});
test('duplicate save/delete is synchronously gated, failures retain data and retry is GET-only',async()=>{
 const a=await setup();await a.resolve(0,{name:'A'});let pending;
 await act(async()=>{pending=a.get().mutate('/addresses/owned',{method:'DELETE'});void a.get().mutate('/addresses/owned',{method:'DELETE'});});
 assert.equal(a.calls.length,2);await a.reject(1,'Delete failed');await pending;assert.equal(a.get().data.name,'A');assert.equal(a.get().error,'Delete failed');
 await act(async()=>{void a.get().retry();});assert.equal(a.calls[2].options,undefined);await a.resolve(2,{name:'A'});assert.equal(a.get().error,'');await a.cleanup();
});
test('failed read and signed-out resource prohibit writes; stale retained callbacks stay invalid after retry',async()=>{
 const a=await setup();await a.reject(0,'Read failed');await act(async()=>a.get().mutate('/users/me',{method:'PATCH'}));assert.equal(a.calls.length,1);
 await act(async()=>{void a.get().retry();});await a.resolve(1,{name:'A'});const retained=a.get();await act(async()=>{void a.get().retry();});await a.resolve(2,{name:'A2'});
 await act(async()=>retained.mutate('/users/me',{method:'PATCH'}));assert.equal(a.calls.length,3);
 await a.render(null);await act(async()=>a.get().retry());await act(async()=>a.get().mutate('/users/me',{method:'PATCH'}));assert.equal(a.calls.length,3);assert.equal(a.get().data,null);await a.cleanup();
});
test('unmounted account write cannot invoke its success callback or reopen resource state',async()=>{
 const a=await setup();await a.resolve(0,{name:'A'});let successes=0,pending;
 await act(async()=>{pending=a.get().mutate('/users/me',{method:'PATCH'},()=>successes++);});
 await a.cleanup();a.calls[1].task.resolve({name:'Late result'});await pending;assert.equal(successes,0);
});
