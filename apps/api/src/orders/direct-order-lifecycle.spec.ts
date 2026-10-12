import { DirectOrderLifecycleService } from './direct-order-lifecycle.service';
import { OrdersService } from './orders.service';

// External persistence boundary only: gates and transitions run in the real service.
function fixture(status='AWAITING_PRICE_CONFIRM') {
  const state:any={id:'order-1',clientId:'client-1',masterId:'master-1',status,commercialMode:'DIRECT_PAYMENT',
    lifecycleVersion:2,dispatchMode:'SEQUENTIAL',workPrice:8000,materialsPrice:3500,calloutPrice:2500,serviceFee:0,
    quoteVersion:1,consentedVersion:null,departedAt:new Date('2026-10-12T00:00:00Z'),onSiteAt:new Date('2026-10-12T00:01:00Z'),
    priceProposedAt:new Date(),updatedAt:new Date(),completedAt:null,closedAt:null,quoteApprovedAt:null,workStartedAt:null,
    workComment:'Replace pipe',cancellationAmount:null,cancelReason:null,photos:[],review:null};
  const delegate={
    findUnique:async()=>({...state}),findUniqueOrThrow:async()=>({...state}),
    updateMany:async({where,data}:any)=>{const matches=Array.isArray(where.status?.in)?where.status.in.includes(state.status):(!where.status||where.status===state.status);
      if(!matches||(where.masterId&&where.masterId!==state.masterId)||('departedAt' in where&&where.departedAt!==state.departedAt))return{count:0};Object.assign(state,data,{updatedAt:new Date()});return{count:1};},
    update:async({data}:any)=>{Object.assign(state,data,{updatedAt:new Date()});return{...state};},
  };
  const prisma:any={order:delegate,orderOffer:{findMany:async()=>[],updateMany:async()=>({count:0})},dispute:{findFirst:async()=>null},$queryRaw:async()=>[{id:state.id}],
    $transaction:async(fn:any)=>fn(prisma)};
  const queue:any={send:jest.fn()},gateway:any={emitToUser:jest.fn()},payments:any={},penalties:any={},compensation:any={accrueCallout:jest.fn()},
    disputes:any={hasOpenDispute:async()=>false},storage:any={},reviews:any={attachRating:async(value:any)=>value},audit:any={write:jest.fn()},mode:any={mode:()=> 'DIRECT_PAYMENT'};
  const Constructor:any=OrdersService;
  const service:any=new Constructor(prisma,{},queue,gateway,payments,penalties,compensation,disputes,storage,reviews,audit,mode,new DirectOrderLifecycleService(prisma));
  return{service,state,queue,compensation,prisma};
}

describe('Direct order transitions',()=>{
  it('recovers a persisted offer with its original server deadline',async()=>{
    const{service,prisma}=fixture('SEARCHING');
    const expiresAt=new Date(Date.now()+20000);
    prisma.orderOffer.findFirst=jest.fn(async()=>({id:'offer-1',orderId:'order-1',masterUserId:'master-1',attempt:1,expiresAt,distanceKm:1.2,order:{id:'order-1',searchAttempt:1,category:{name:'Plumbing'},description:'Pipe',district:'Centre'}}));
    await expect(service.pendingOffer('master-1')).resolves.toMatchObject({offerId:'offer-1',deadline:expiresAt.toISOString(),directPayment:true});
    expect(prisma.orderOffer.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({masterUserId:'master-1',outcome:'PENDING'})}));
  });
  it('approval waits for the master instead of silently starting work',async()=>{
    const{service,state}=fixture();await service.confirmPrice('client-1','order-1',{quoteVersion:1});
    expect(state.status).toBe('PRICE_APPROVED');expect(state.consentedVersion).toBe(1);expect(state.workStartedAt).toBeNull();
  });
  it('a stale quote cannot be approved',async()=>{
    const{service,state}=fixture();state.quoteVersion=2;
    await expect(service.confirmPrice('client-1','order-1',{quoteVersion:1})).rejects.toMatchObject({status:409});
    expect(state.status).toBe('AWAITING_PRICE_CONFIRM');
  });
  it('a background close job never accepts direct-payment work for the client',async()=>{
    const{service,state,compensation}=fixture('DONE');await service.handleAutoClose({orderId:'order-1'});
    expect(state.status).toBe('DONE');expect(compensation.accrueCallout).not.toHaveBeenCalled();
  });
});

describe('Direct cancellation',()=>{
  it('stale master cannot cancel a new assignment',async()=>{
    const{service,state}=fixture('ACCEPTED');state.departedAt=null;const stale={...state};state.masterId='another-master';
    await expect(service.cancelByMaster(stale)).rejects.toMatchObject({status:409});expect(state.masterId).toBe('another-master');
  });
  it('master cancellation cannot erase a departure committed after the preliminary read',async()=>{
    const{service,state}=fixture('ACCEPTED');state.departedAt=null;
    const stale={...state};state.status='MASTER_ON_WAY';state.departedAt=new Date();
    await expect(service.cancelByMaster(stale)).rejects.toMatchObject({status:409});
    expect(state.status).toBe('MASTER_ON_WAY');expect(state.departedAt).not.toBeNull();
  });
  it('does not charge an assignment before actual departure',async()=>{
    const{service,state}=fixture('ACCEPTED');state.departedAt=null;
    await service.cancel({id:'client-1'},'order-1',{expectedAmount:0,expectedUpdatedAt:state.updatedAt.toISOString()});
    expect(state.cancellationAmount).toBe(0);expect(state.status).toBe('CANCELLED_BY_CLIENT');
  });
  it('allows cancellation during inspection with only 2500 KZT due directly to the master',async()=>{
    const{service,state,compensation}=fixture('INSPECTION');
    await service.cancel({id:'client-1'},'order-1',{expectedAmount:2500,expectedUpdatedAt:state.updatedAt.toISOString()});
    expect(state.cancellationAmount).toBe(2500);expect(compensation.accrueCallout).not.toHaveBeenCalled();
  });
  it('refuses a stale free cancellation after the master has departed',async()=>{
    const{service,state}=fixture('MASTER_ON_WAY');
    await expect(service.cancel({id:'client-1'},'order-1',{expectedAmount:0,expectedUpdatedAt:state.updatedAt.toISOString()})).rejects.toMatchObject({status:409});
    expect(state.status).toBe('MASTER_ON_WAY');
  });
});
