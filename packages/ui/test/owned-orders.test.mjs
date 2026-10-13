import test from 'node:test';
import assert from 'node:assert/strict';
import * as ui from '../dist/index.js';
const urgent=(extra={})=>({kind:'urgent',id:'real',status:'PRICE_APPROVED',lifecycleVersion:2,commercialMode:'DIRECT_PAYMENT',quoteVersion:3,quoteTotal:14000,workPrice:8000,calloutPrice:2500,...extra});
test('direct list amount uses only the versioned authoritative quote total',()=>{
 assert.equal(typeof ui.presentOwnedOrderAmount,'function');
 assert.deepEqual(ui.presentOwnedOrderAmount(urgent()),{label:'total',amount:14000});
 for(const quoteTotal of [null,undefined,NaN,Infinity,-1,'14000'])assert.equal(ui.presentOwnedOrderAmount(urgent({quoteTotal})).amount,null);
 assert.equal(ui.presentOwnedOrderAmount(urgent({quoteTotal:0})).amount,0);
 assert.equal(ui.presentOwnedOrderAmount(urgent({quoteVersion:4,quoteTotal:17000})).amount,17000);
 for(const quoteVersion of [0,null,undefined,Infinity,NaN,-1,1.5])assert.deepEqual(ui.presentOwnedOrderAmount(urgent({quoteVersion,calloutPrice:0})),{label:'moneyUnknown',amount:null});
});
test('direct cancellation uses actual cancellation amount only when applicable',()=>{
 assert.equal(typeof ui.presentOwnedOrderAmount,'function');
 for(const status of ['CANCELLED_BY_CLIENT','CANCELLED_BY_MASTER']){
 assert.equal(ui.presentOwnedOrderAmount(urgent({status,cancellationAmount:0})),null);
 assert.deepEqual(ui.presentOwnedOrderAmount(urgent({status,cancellationAmount:0,departedAt:'2026-10-13'})),{label:'cancelAmount',amount:0});
 assert.deepEqual(ui.presentOwnedOrderAmount(urgent({status,cancellationAmount:2500})),{label:'cancelAmount',amount:2500});
 for(const cancellationAmount of [null,undefined,-1,Infinity,'2500'])assert.equal(ui.presentOwnedOrderAmount(urgent({status,cancellationAmount,departedAt:'2026-10-13'})),null);
 }
});
test('legacy and planned amount selection and existing terminal predicates remain unchanged',()=>{
 assert.equal(typeof ui.isOwnedOrderActive,'function');
 assert.equal(ui.presentOwnedOrderAmount(urgent({lifecycleVersion:1})).amount,8000);
 assert.equal(ui.presentOwnedOrderAmount(urgent({commercialMode:'PAID',workPrice:null})).amount,2500);
 assert.equal(ui.presentOwnedOrderAmount({kind:'planned',workPrice:null,budget:12000}).amount,12000);
 assert.equal(ui.presentOwnedOrderAmount({kind:'planned',workPrice:0,budget:12000}).amount,0);
 for(const kind of ['urgent','planned']){
 for(const status of ['DONE','NO_MASTERS','IN_PROGRESS','DISPUTE'])assert.equal(ui.isOwnedOrderActive({kind,status}),true);
 for(const status of ['CLOSED','CANCELLED_BY_CLIENT','CANCELLED_BY_MASTER'])assert.equal(ui.isOwnedOrderActive({kind,status}),false);
 }
 assert.equal(ui.isOwnedOrderActive({kind:'urgent',status:'EXPIRED'}),true);
 assert.equal(ui.isOwnedOrderActive({kind:'planned',status:'EXPIRED'}),false);
});
