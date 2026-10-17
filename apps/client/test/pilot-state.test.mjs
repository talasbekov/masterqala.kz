import test from 'node:test';
import assert from 'node:assert/strict';
import {pilotActions,validOrderPoint} from '../.test-build/components/desktop-urgent/pilot-state.js';
const order=(status,workPrice=8000,review=null)=>({status,workPrice,review});
test('pilot actions match existing server lifecycle, including inspection cancellation prohibition',()=>{
 for(const status of ['CREATED','SEARCHING','ACCEPTED','MASTER_ON_WAY'])assert.deepEqual(pilotActions(order(status)),['cancel']);
 assert.deepEqual(pilotActions(order('NO_MASTERS')),['retry-search','cancel']);
 for(const status of ['INSPECTION','IN_PROGRESS','CANCELLED_BY_CLIENT','DISPUTE','UNKNOWN'])assert.deepEqual(pilotActions(order(status)),[]);
 assert.deepEqual(pilotActions(order('AWAITING_PRICE_CONFIRM')),['confirm-price','reject-price']);
 assert.deepEqual(pilotActions(order('DONE')),['confirm-completion']);
 assert.deepEqual(pilotActions(order('CLOSED')),['review']);assert.deepEqual(pilotActions(order('CLOSED',8000,{rating:4})),[]);
});
test('missing or invalid work price cannot be confirmed; a real zero remains valid',()=>{for(const value of [null,NaN,Infinity,-1])assert.deepEqual(pilotActions(order('AWAITING_PRICE_CONFIRM',value)),['reject-price']);assert.deepEqual(pilotActions(order('AWAITING_PRICE_CONFIRM',0)),['confirm-price','reject-price']);});
test('map does not fabricate coordinates or accept malformed location events',()=>{assert.equal(validOrderPoint(51.16,71.47),true);assert.equal(validOrderPoint(0,0),true);for(const pair of [[null,71],[51,undefined],[91,71],[51,181],[NaN,71],['51',71]])assert.equal(validOrderPoint(...pair),false);});
