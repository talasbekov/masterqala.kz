import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import * as ui from '../dist/index.js';
async function harness(owner=null){
 assert.equal(typeof ui.useOwnedOrders,'function');
 const dom=new JSDOM('<div id="root"></div>');Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const reads=[];const api=path=>new Promise((resolve,reject)=>reads.push({path,resolve,reject}));let state;
 function App({owner,onCommit}){state=ui.useOwnedOrders({ownerId:owner,api});React.useLayoutEffect(()=>onCommit?.(state),[owner,onCommit]);return React.createElement('div',null,state.items.map(x=>x.id).join(','))}
 const root=createRoot(document.getElementById('root'));const render=(owner,onCommit)=>act(async()=>root.render(React.createElement(App,{owner,onCommit})));await render(owner);
 return {reads,render,state:()=>state,resolve:async(i,items)=>act(async()=>reads[i].resolve(items)),reject:async(i)=>act(async()=>reads[i].reject(new Error('Read failed'))),cleanup:async()=>{await act(async()=>root.unmount());dom.window.close()}};
}
const row=id=>({id,status:'SEARCHING',createdAt:'2026-10-13T00:00:00Z'});
test('owned reads require an owner and old owner results/rejections cannot affect a new account or logout',async()=>{
 const app=await harness();try{
 assert.equal(app.reads.length,0);await app.render('A');assert.deepEqual(app.reads.map(x=>x.path),['/orders','/planned-orders/mine']);
 await app.render('B',state=>assert.deepEqual(state.items,[]));await app.resolve(2,[row('B')]);await app.resolve(3,[]);await app.resolve(0,[row('A')]);await app.reject(1);assert.deepEqual(app.state().items.map(x=>x.id),['B']);assert.equal(app.state().error,'');assert.equal(app.state().loading,false);
 await app.render(null);assert.deepEqual(app.state().items,[]);assert.equal(app.state().loading,false);
 }finally{await app.cleanup()}
});
test('partial planned failure retains successful urgent data and retry keeps stale data visibly incomplete',async()=>{
 const app=await harness('A');try{
 await app.resolve(0,[row('active')]);await app.reject(1);assert.deepEqual(app.state().items.map(x=>x.id),['active']);assert.ok(app.state().error);assert.equal(app.state().incomplete,true);assert.equal(app.state().loading,false);
 await act(async()=>{void app.state().retry()});assert.equal(app.state().loading,true);assert.equal(app.state().incomplete,true);assert.deepEqual(app.state().items.map(x=>x.id),['active']);await app.reject(2);await app.resolve(3,[row('planned')]);assert.deepEqual(new Set(app.state().items.map(x=>x.id)),new Set(['active','planned']));assert.equal(app.state().incomplete,true);
 await act(async()=>{void app.state().retry()});await app.resolve(4,[]);await app.resolve(5,[]);assert.deepEqual(app.state().items,[]);assert.equal(app.state().incomplete,false);assert.equal(app.state().error,'');assert.equal(app.reads.length,6);
 }finally{await app.cleanup()}
});
test('new retry generation and unmount ignore retained handlers and late reads',async()=>{
 const app=await harness('A');try{
 const old=app.state();await act(async()=>{void old.retry()});await app.resolve(2,[row('new')]);await app.resolve(3,[]);await app.resolve(0,[row('old')]);await app.reject(1);assert.deepEqual(app.state().items.map(x=>x.id),['new']);assert.equal(app.state().error,'');
 await app.render('B');const count=app.reads.length;await act(async()=>{void old.retry()});assert.equal(app.reads.length,count);assert.equal(app.state().loading,true);await app.resolve(4,[]);await app.resolve(5,[]);await app.render('A');const revisited=app.reads.length;await act(async()=>{void old.retry()});assert.equal(app.reads.length,revisited,'retained first-account handler must not start a new session read');
 }finally{await app.cleanup()}
 const count=app.reads.length;await app.state().retry();assert.equal(app.reads.length,count);
});
test('invalid endpoint payload stays incomplete instead of claiming an empty list',async()=>{
 const app=await harness('A');try{await app.resolve(0,{items:[]});await app.resolve(1,[]);assert.equal(app.state().incomplete,true);assert.ok(app.state().error)}finally{await app.cleanup()}
});
