import test from 'node:test';import assert from 'node:assert/strict';
const {api,fetchApplication}=await import('../.test-build/test/safety-entry.js');
const reply=(status,body)=>{globalThis.fetch=async()=>({ok:status>=200&&status<300,status,json:async()=>body})};
test('master API preserves HTTP status and existing server error message',async()=>{reply(500,{message:'Fixture server unavailable'});await assert.rejects(api('/masters/application'),e=>e.status===500&&e.message==='Fixture server unavailable')});
test('only actual404 application response is absence,500 and network failure reject',async()=>{reply(404,{message:'Missing application'});assert.equal(await fetchApplication(),null);reply(500,{message:'Fixture server unavailable'});await assert.rejects(fetchApplication(),/Fixture server unavailable/);globalThis.fetch=async()=>{throw new Error('Fixture network unavailable')};await assert.rejects(fetchApplication(),/Fixture network unavailable/)});
