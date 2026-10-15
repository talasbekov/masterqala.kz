import {assertIsolatedQueueDatabase} from './queue-safety';
const dedicated='postgresql://fixture:fixture@localhost:5434/masterqala_urgent_queue_ci';
describe('queue destructive-test boundary',()=>{
 it('accepts only the explicitly opted-in dedicated test identity',()=>expect(()=>assertIsolatedQueueDatabase(dedicated,'1','test')).not.toThrow());
 it.each([undefined,'postgresql://fixture:fixture@localhost:5433/masterqala_test','postgresql://fixture:fixture@production.example:5434/masterqala_urgent_queue_ci','postgresql://fixture:fixture@localhost:5434/production',dedicated+'?schema=shared',dedicated+'#ignored'])('rejects nonisolated target%p',url=>expect(()=>assertIsolatedQueueDatabase(url,'1','test')).toThrow());
 it.each([['0','test'],[undefined,'test'],['1','production'],['1',undefined]])('requires explicit opt-in%s and test environment%s',(optIn,nodeEnv)=>expect(()=>assertIsolatedQueueDatabase(dedicated,optIn,nodeEnv)).toThrow());
});

import {completedMarkedTimeout} from './queue-observation';
import {JOBS} from '../src/queue/queue.constants';
describe('marked timeout observer',()=>{
 it('ignores incidental cron invocation with null data',()=>expect(completedMarkedTimeout({name:JOBS.SEQUENTIAL_RECOVERY,data:null,finished:true},'exact-marker')).toBe(false));
 it('requires actual timeout name, exact marker and successful completion',()=>{
  const done={name:JOBS.SEQUENTIAL_TIMEOUT,data:{testDeliveryMarker:'exact-marker'},finished:true};
  expect(completedMarkedTimeout(done,'exact-marker')).toBe(true);
  expect(completedMarkedTimeout({...done,name:JOBS.SEQUENTIAL_RECOVERY},'exact-marker')).toBe(false);
  expect(completedMarkedTimeout(done,'different-marker')).toBe(false);
  expect(completedMarkedTimeout({...done,finished:false},'exact-marker')).toBe(false);
  expect(completedMarkedTimeout({...done,error:new Error('failed')},'exact-marker')).toBe(false);
 });
});
