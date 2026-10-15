import test from 'node:test';
import assert from 'node:assert/strict';
import {getCategories,getAppUrl,getContactPhone,getContactEmail} from '../.test-build/public-entry.js';

test('unconfigured contacts do not fabricate an operational number or email',()=>{
  delete process.env.CONTACT_PHONE;delete process.env.CONTACT_EMAIL;
  assert.equal(getContactPhone(),null);assert.equal(getContactEmail(),null);
});
test('application destinations reject unsafe configured schemes',()=>{
  process.env.APP_URL='javascript:alert(1)';assert.equal(getAppUrl(),null);
  process.env.APP_URL='https://client.example/';assert.equal(getAppUrl(),'https://client.example');delete process.env.APP_URL;
});
test('categories validate successful data before empty or missing slug can be trusted',async()=>{
  const original=global.fetch;
  try{
    for(const value of [{},null,[{id:'one',name:'Plumbing',slug:'../login'}],[{id:'one',name:'',slug:'plumbing'}],[{id:'one',name:'Plumbing',slug:'plumbing'},{id:'one',name:'Other',slug:'other'}]]){
      global.fetch=async()=>({ok:true,json:async()=>value});await assert.rejects(getCategories());
    }
    global.fetch=async()=>({ok:true,json:async()=>[]});assert.deepEqual(await getCategories(),[]);
    const data=[{id:'one',name:'Actual server name',slug:'plumbing'}];global.fetch=async()=>({ok:true,json:async()=>data});assert.deepEqual(await getCategories(),data);
  }finally{global.fetch=original}
});
test('HTTP outage and malformed JSON stay errors rather than a verified empty inventory',async()=>{
  const original=global.fetch;
  try{global.fetch=async()=>({ok:false,status:503});await assert.rejects(getCategories());global.fetch=async()=>({ok:true,json:async()=>{throw Error('malformed')}});await assert.rejects(getCategories())}finally{global.fetch=original}
});
test('retry reads do not reuse an invalid successful category cache',async()=>{const original=global.fetch;let seen;try{global.fetch=async(_url,options)=>{seen=options;return {ok:true,json:async()=>[]}};await getCategories();assert.equal(seen.cache,'no-store')}finally{global.fetch=original}});
test('production without a configured client destination does not send visitors to their own localhost',()=>{const mode=process.env.NODE_ENV;delete process.env.APP_URL;try{process.env.NODE_ENV='production';assert.equal(getAppUrl(),null);process.env.NODE_ENV='development';assert.equal(getAppUrl(),'http://localhost:5173')}finally{if(mode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=mode}});
