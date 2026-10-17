import test from 'node:test';
import assert from 'node:assert/strict';
import {savedAddressPatch,categoryIntent} from './saved-address.ts';
const address={id:'saved',label:'Home',address:'Actual street',entrance:'2',floor:'3',apartment:'4',comment:'Call first',lat:0,lng:0};
test('saved address copies full details, preserves real zero coordinates, and clears unsupported district',()=>{
 assert.deepEqual(savedAddressPatch(address),{addressText:'Actual street',entrance:'2',floor:'3',apartment:'4',addressComment:'Call first',district:'',geo:{lat:0,lng:0},locationChosen:true,locationNeedsConfirmation:false});
});
test('missing, invalid or partial coordinates keep the current map center unconfirmed without guessed district',()=>{
 for(const coordinates of [{lat:null,lng:null},{lat:0,lng:null},{lat:91,lng:0},{lat:0,lng:Infinity},{lat:'0',lng:'0'}]){const patch=savedAddressPatch({...address,...coordinates,entrance:null});assert.equal(patch.geo,undefined);assert.equal(patch.locationChosen,false);assert.equal(patch.locationNeedsConfirmation,true);assert.equal(patch.district,'');assert.equal(patch.entrance,'');}
});
test('category intent validates fetched identities and removes only the consumed category query',()=>{
 assert.deepEqual(categoryIntent('?category=known&keep=yes',[{id:'known'}]),{categoryId:'known',href:'/?keep=yes'});assert.deepEqual(categoryIntent('?category=unknown',[{id:'known'}]),{categoryId:null,href:'/'});assert.deepEqual(categoryIntent('?category=known&category=other',[{id:'known'}]),{categoryId:null,href:'/'});assert.equal(categoryIntent('?keep=yes',[{id:'known'}]),null);
});
