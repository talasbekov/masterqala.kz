import {randomUUID} from 'crypto';
import {INestApplication} from '@nestjs/common';
import * as request from 'supertest';
import PgBoss = require('pg-boss');
import {PrismaService} from '../src/prisma/prisma.service';
import {QueueService} from '../src/queue/queue.service';
import {JOBS} from '../src/queue/queue.constants';
import {assertIsolatedQueueDatabase} from './queue-safety';
import {ALMATY,createActiveMaster,createTestApp,loginAs,pointAtKm,resetDb,seedCategories} from './helpers';

type Invocation={name:string;data:any;finished:boolean;error?:unknown;beforeOutcome?:string;afterOutcome?:string;afterOfferIds?:string[]};
// Pinned pg-boss10.4.2 exposes no public worker-stop wait after nongraceful stop.
// Observe original internal worker states only; never replace fetch/handlers/stop.
type ObservedWorker={stopped:boolean};
const Manager=require('pg-boss/src/manager') as {prototype:{getWorkers:()=>ObservedWorker[]}};
const bound=180000;
async function until<T>(read:()=>Promise<T>,accept:(value:T)=>boolean,label:string,timeout=bound):Promise<T>{
  const deadline=Date.now()+timeout;
  let latest:T;
  do{latest=await read();if(accept(latest))return latest;await new Promise(resolve=>setTimeout(resolve,200));}while(Date.now()<deadline);
  throw new Error(`Condition deadline exceeded: ${label}`);
}

describe('urgent lifecycle through real AppModule pg-boss workers',()=>{
 let app:INestApplication,prisma:PrismaService,queue:QueueService,maintenance:PgBoss;
 const running=new Set<Promise<void>>(),calls:Invocation[]=[];
 let spy:jest.SpyInstance,workerSpy:jest.SpyInstance;
 const workers=new Set<ObservedWorker>();
 async function identity(){
  assertIsolatedQueueDatabase(process.env.DATABASE_URL,process.env.ALLOW_ISOLATED_QUEUE_TESTS,process.env.NODE_ENV);
  const [row]=await prisma.$queryRaw<{name:string}[]>`SELECT current_database() AS name`;
  expect(row.name).toBe('masterqala_urgent_queue_ci');
 }
 async function stopWorkers(){
  await queue.onApplicationShutdown();
  // Observe actual wrapped handler completion; shutdown alone must not imply quiescence.
  await until(async()=>running.size===0&&[...workers].every(worker=>worker.stopped),Boolean,'all actual pg-boss workers and AppModule handlers quiescent',15000);
  expect(queue.healthCheck().status).toBe('DOWN');
 }
 async function clean(){
  await identity();
  expect(running.size).toBe(0);expect(queue.healthCheck().status).toBe('DOWN');
  await maintenance.clearStorage(); // Dedicated disposable DB only; never normal/shared DB.
  await resetDb(app);
  calls.length=0;
 }
 async function startWorkers(recoveryCron=true){
  await identity();await maintenance.unschedule(JOBS.SEQUENTIAL_RECOVERY);
  // Test-only scheduling isolation, snapshot restored immediately after original bootstrap.
  // The independent minute-cron case passes true and uses original complete scheduling.
  const config=queue as unknown as {crons:{name:string;cron:string}[]};const original=config.crons;
  if(!recoveryCron)config.crons=original.filter(cron=>cron.name!==JOBS.SEQUENTIAL_RECOVERY);
  try{await queue.onApplicationBootstrap();}finally{config.crons=original;}
 }
 beforeAll(async()=>{
  const getWorkers=Manager.prototype.getWorkers;
  workerSpy=jest.spyOn(Manager.prototype,'getWorkers').mockImplementation(function(){const actual=getWorkers.call(this);actual.forEach(worker=>workers.add(worker));return actual;});
  const register=QueueService.prototype.register;
  spy=jest.spyOn(QueueService.prototype,'register').mockImplementation(function(this:QueueService,name,handler){
   register.call(this,name,async data=>{
    const invocation:Invocation={name,data,finished:false};calls.push(invocation);
    let settle!:()=>void;const done=new Promise<void>(resolve=>{settle=resolve});running.add(done);
    try{
     if(name===JOBS.SEQUENTIAL_TIMEOUT&&prisma)invocation.beforeOutcome=(await prisma.orderOffer.findUnique({where:{id:data.offerId}}))?.outcome;
     await handler(data);
     if(name===JOBS.SEQUENTIAL_TIMEOUT&&prisma){invocation.afterOutcome=(await prisma.orderOffer.findUnique({where:{id:data.offerId}}))?.outcome;invocation.afterOfferIds=(await prisma.orderOffer.findMany({where:{orderId:data.orderId}})).map(offer=>offer.id);}
    }catch(error){invocation.error=error;throw error;}
    finally{invocation.finished=true;running.delete(done);settle();}
   });
  });
  app=await createTestApp();prisma=app.get(PrismaService);queue=app.get(QueueService);
  expect(queue.healthCheck().status).toBe('UP');await identity();await stopWorkers();
  // No workers/schedules in this cleanup client; production worker defaults stay unchanged.
  maintenance=new PgBoss({connectionString:process.env.DATABASE_URL!,schedule:false,supervise:false});
  await maintenance.start();
 });
 beforeEach(async()=>{await stopWorkers();await clean();});
 afterEach(async()=>{if(queue)await stopWorkers();});
 afterAll(async()=>{
  try{if(queue)await stopWorkers();if(maintenance)await maintenance.stop();if(app)await app.close();}
  finally{spy?.mockRestore();workerSpy?.mockRestore();}
 });
 async function fixture(twoMasters=false){
  const {plumbing}=await seedCategories(app);const client=await loginAs(app,'+77073910001');
  const nearest=await createActiveMaster(app,'+77073910002',plumbing.id,pointAtKm(1));
  const next=twoMasters?await createActiveMaster(app,'+77073910003',plumbing.id,pointAtKm(2)):null;
  const payload={clientRequestId:randomUUID(),categoryId:plumbing.id,description:'Queue integration fixture',address:'Test address',district:'Test district',...ALMATY};
  return {client,nearest,next,payload};
 }
 async function create(f:Awaited<ReturnType<typeof fixture>>){
  const response=await request(app.getHttpServer()).post('/api/v1/orders/idempotent').set('Authorization',`Bearer ${f.client.token}`).send(f.payload).expect(201);
  return response.body;
 }
 async function offers(orderId:string){return prisma.orderOffer.findMany({where:{orderId},orderBy:{sentAt:'asc'}});}
 async function firstOffer(orderId:string){
  const rows=await until(()=>offers(orderId),rows=>rows.length===1,'first real queued offer');
  await until(async()=>calls.some(call=>call.name===JOBS.SEQUENTIAL_DISPATCH&&call.data.orderId===orderId&&call.finished),Boolean,'queued dispatch completed');
  return rows[0];
 }
 it('keyed HTTP creation is delivered by the real dispatcher exactly once to nearest eligible master',async()=>{
  await startWorkers();const f=await fixture();const order=await create(f);const first=await firstOffer(order.id);
  expect(first).toMatchObject({masterUserId:f.nearest.userId,outcome:'PENDING',sequential:true});
  expect(first.expiresAt!.getTime()-first.sentAt.getTime()).toBe(30000);
  const replay=await create(f);expect(replay.id).toBe(order.id);expect(await offers(order.id)).toHaveLength(1);
  expect(calls.filter(call=>call.name===JOBS.SEQUENTIAL_DISPATCH&&call.data.orderId===order.id)).toHaveLength(1);
  expect(calls.some(call=>call.error)).toBe(false);
 });
 it('actual30s deadline expires one offer and duplicate queued timeout delivery advances only once',async()=>{
  await startWorkers(false);const f=await fixture(true);const order=await create(f);const first=await firstOffer(order.id);
  const advanced=await until(()=>offers(order.id),rows=>rows.length===2&&rows[0].outcome==='EXPIRED','real30s expiry advances');
  expect(advanced[1]).toMatchObject({masterUserId:f.next!.userId,outcome:'PENDING'});
  expect(advanced[1].sentAt.getTime()).toBeGreaterThanOrEqual(first.expiresAt!.getTime());
  const timeout={orderId:order.id,attempt:first.attempt,offerId:first.id};
  await until(async()=>calls.some(call=>call.name===JOBS.SEQUENTIAL_TIMEOUT&&call.data.offerId===first.id&&call.finished),Boolean,'original timeout job completed');
  const causal=calls.find(call=>call.name===JOBS.SEQUENTIAL_TIMEOUT&&call.data.offerId===first.id&&call.beforeOutcome==='PENDING'&&call.afterOutcome==='EXPIRED'&&call.finished);
  expect(causal).toBeDefined();expect(causal!.afterOfferIds).toContain(advanced[1].id);
  expect(calls.filter(call=>call.name===JOBS.SEQUENTIAL_RECOVERY)).toHaveLength(0);
  const markers=[randomUUID(),randomUUID()];
  for(const testDeliveryMarker of markers)await queue.send(JOBS.SEQUENTIAL_TIMEOUT,{...timeout,testDeliveryMarker});
  const delivered=await until(()=>prisma.$queryRaw<{id:string;state:string;marker:string}[]>`SELECT id,state::text,data->>'testDeliveryMarker' AS marker FROM pgboss.job WHERE name=${JOBS.SEQUENTIAL_TIMEOUT} AND (data->>'testDeliveryMarker'=${markers[0]} OR data->>'testDeliveryMarker'=${markers[1]})`,rows=>rows.length===2&&rows.every(row=>row.state==='completed'),'both exact marked duplicate jobs completed');
  expect(new Set(delivered.map(row=>row.id)).size).toBe(2);expect(delivered.map(row=>row.marker).sort()).toEqual([...markers].sort());
  for(const marker of markers)expect(calls.some(call=>call.data.testDeliveryMarker===marker&&call.finished&&!call.error)).toBe(true);
  expect(await offers(order.id)).toHaveLength(2);expect(calls.some(call=>call.error)).toBe(false);
 });
 it('stop/restart resumes persisted delayed timeout without dispatch/recovery shortcuts',async()=>{
  await startWorkers(false);const f=await fixture(true);const order=await create(f);const first=await firstOffer(order.id);
  const jobs=await prisma.$queryRaw<{id:string;startafter:Date}[]>`SELECT id,start_after AS startafter FROM pgboss.job WHERE name=${JOBS.SEQUENTIAL_TIMEOUT} AND data->>'offerId'=${first.id}`;
  expect(jobs.length).toBeGreaterThanOrEqual(1);expect(jobs[0].startafter.getTime()).toBeGreaterThanOrEqual(first.expiresAt!.getTime()-1000);
  await stopWorkers();expect(Date.now()).toBeLessThan(first.expiresAt!.getTime());
  const persisted=await prisma.$queryRaw<{id:string}[]>`SELECT id FROM pgboss.job WHERE id=${jobs[0].id}::uuid`;
  expect(persisted[0].id).toBe(jobs[0].id);
  await startWorkers(false);
  await until(()=>maintenance.getJobById(JOBS.SEQUENTIAL_TIMEOUT,jobs[0].id,{includeArchive:true}),job=>job?.id===jobs[0].id&&job.state==='completed','captured exact persisted timeout job completed after restart');
  await until(async()=>calls.some(call=>call.name===JOBS.SEQUENTIAL_TIMEOUT&&call.data.offerId===first.id&&call.finished),Boolean,'persisted timeout handler completed after restart');
  const causal=calls.find(call=>call.name===JOBS.SEQUENTIAL_TIMEOUT&&call.data.offerId===first.id&&call.beforeOutcome==='PENDING'&&call.afterOutcome==='EXPIRED'&&call.finished);expect(causal).toBeDefined();
  expect(calls.filter(call=>call.name===JOBS.SEQUENTIAL_RECOVERY)).toHaveLength(0);
  const advanced=await offers(order.id);expect(advanced).toHaveLength(2);expect(advanced[0].outcome).toBe('EXPIRED');expect(advanced[1].masterUserId).toBe(f.next!.userId);
  expect(calls.some(call=>call.error)).toBe(false);
 });
 it('real minute recovery repairs committed SEARCHING with no dispatched job while exact replay preserves identity',async()=>{
  const f=await fixture();const order=await create(f);const replay=await create(f);
  expect(replay.id).toBe(order.id);expect(await offers(order.id)).toHaveLength(0);
  expect(await prisma.order.count({where:{clientId:f.client.userId}})).toBe(1);
  expect((await prisma.order.findUniqueOrThrow({where:{id:order.id}})).status).toBe('SEARCHING');
  await startWorkers();
  await until(()=>offers(order.id),rows=>rows.length===1,'actual cron recovers missed dispatch');
  await until(async()=>calls.some(call=>call.name===JOBS.SEQUENTIAL_RECOVERY&&call.finished),Boolean,'actual recovery cron completed');
  expect(calls.filter(call=>call.name===JOBS.SEQUENTIAL_DISPATCH&&call.data.orderId===order.id)).toHaveLength(0);
  expect((await offers(order.id))[0].masterUserId).toBe(f.nearest.userId);
  expect(calls.some(call=>call.error)).toBe(false);
 });
});
