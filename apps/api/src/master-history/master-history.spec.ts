import { AccessTokenService } from '../auth/access-token.service';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request = require('supertest');
import { PrismaService } from '../prisma/prisma.service';
import { MasterHistoryController } from './master-history.controller';
import { MasterHistoryService } from './master-history.service';
import { PlannedOrdersService } from '../planned-orders/planned-orders.service';
import { OrdersService } from '../orders/orders.service';

const at = new Date('2026-10-01T00:00:00.000Z');
const fixture = (id: string, masterId: string | null, status = 'CLOSED') => ({id, masterId, status, district: 'Fixture district', createdAt: at, category: {slug: 'plumbing', name: 'Fixture service'}, lifecycleModel: 'LEGACY', clientId: 'client', client: {phone:'private'}, payments: [{amount:1}], description: 'private', evidence: ['private']});
function matches(row: any, where: any): boolean {
  return Object.entries(where).every(([key, value]: [string, any]) => {
    if (key === 'OR') return value.some((part: any) => matches(row, part));
    if (value instanceof Date) return row[key].getTime() === value.getTime();
    if (value && typeof value === 'object') {
      if ('lt' in value) return row[key] < value.lt;
      if ('in' in value) return value.in.includes(row[key]);
      if ('notIn' in value) return !value.notIn.includes(row[key]);
    }
    return row[key] === value;
  });
}
describe('master assigned-order history contract', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let urgent: any[], planned: any[];
  const find = (rows: () => any[]) => jest.fn(async (query: any) => rows().filter(row => matches(row, query.where)).sort((a,b) => b.createdAt-a.createdAt || (a.id>b.id?-1:1)).slice(0,query.take).map(row => Object.fromEntries(Object.keys(query.select).map(key => [key,row[key]]))));
  const db = {user: {findUnique: jest.fn(async ({where}: any) => ['a','b','client'].includes(where.id) ? {id:where.id, role:'CLIENT',authVersion:0,isBlocked:false}:null)}, masterProfile:{findUnique:jest.fn(async ({where}:any)=>['a','b'].includes(where.userId)?{id:where.userId}:null)}, order:{findMany:find(()=>urgent)}, plannedOrder:{findMany:find(()=>planned)}};
  beforeAll(async () => {
    const module = await Test.createTestingModule({imports:[JwtModule.register({secret:'history-test-only-secret-at-least-32-characters'})],controllers:[MasterHistoryController],providers:[AccessTokenService,MasterHistoryService,{provide:PrismaService,useValue:db}]}).compile();
    app=module.createNestApplication(); await app.init(); jwt=module.get(JwtService);
  });
  afterAll(async()=>{await app.close();});
  beforeEach(()=>{
    urgent=[fixture('u3','a'),fixture('u2','a','DONE'),fixture('u1','b'),fixture('offered',null,'SEARCHING')];
    planned=[fixture('p3','a'),fixture('p2','a','MASTER_SELECTED'),fixture('p1','b'),fixture('bid-only',null,'PUBLISHED'),{...fixture('reserved','a'),lifecycleModel:'PLATFORM_V1_RESERVED'}];
    jest.clearAllMocks();
  });
  const get=(owner:string,path='/master/orders')=>request(app.getHttpServer()).get(path).set('Authorization',`Bearer ${jwt.sign({sub:owner,role:'CLIENT',authVersion:0}, { expiresIn: '30d' })}`);
  it('uses real JWT guard: no auth / bad auth are 401; clients without master profile are 403',async()=>{
    await request(app.getHttpServer()).get('/master/orders').expect(401);
    await request(app.getHttpServer()).get('/master/orders').set('Authorization','Bearer invalid').expect(401);
    await get('missing').expect(401); await get('client').expect(403);
    expect(db.order.findMany).not.toHaveBeenCalled();
  });
  it('returns only JWT owner assignments; excludes offers, bids, reserved models and private fields',async()=>{
    const {body,headers}=await get('a').expect(200);
    expect(body.items.map((item:any)=>item.id)).toEqual(['p3','p2','u3','u2']);
    expect(headers['cache-control']).toBe('private, no-store');
    expect(Object.keys(body.items[0]).sort()).toEqual(['category','createdAt','district','id','kind','status']);
    expect(JSON.stringify(body)).not.toContain('private');
    expect((await get('b').expect(200)).body.items.map((item:any)=>item.id)).toEqual(['p1','u1']);
    await get('a','/master/orders?userId=b').expect(400);
  });
  it('orders by immutable createdAt desc then kind asc/id desc and paginates cross-kind ties without gaps',async()=>{
    urgent.push({...fixture('newer','a'),createdAt:new Date(at.getTime()+1000)});
    let path='/master/orders?limit=2'; const ids:string[]=[]; let count=0;
    do {const {body}=await get('a',path).expect(200);ids.push(...body.items.map((item:any)=>item.id));path=body.nextCursor?`/master/orders?limit=2&cursor=${body.nextCursor}`:'';if(++count>5)throw Error('cursor loop');}while(path);
    expect(ids).toEqual(['newer','p3','p2','u3','u2']);
    expect(db.order.findMany.mock.calls.every(([query])=>query.take===3)).toBe(true);
  });
  it('classifies DONE and selected orders as current; terminal records as history',async()=>{
    expect((await get('a','/master/orders?filter=active').expect(200)).body.items.map((item:any)=>item.id)).toEqual(['p2','u2']);
    expect((await get('a','/master/orders?filter=history').expect(200)).body.items.map((item:any)=>item.id)).toEqual(['p3','u3']);
    urgent=[];planned=[]; expect((await get('a').expect(200)).body).toEqual({items:[],nextCursor:null});
  });
  it('rejects invalid/bounded parameters and owner/filter cursor reuse',async()=>{
    for(const query of ['limit=0','limit=51','limit=1.5','limit=1&limit=2','filter=unknown','cursor=bad'])await get('a',`/master/orders?${query}`).expect(400);
    const {body}=await get('a','/master/orders?limit=1').expect(200);
    await get('b',`/master/orders?cursor=${body.nextCursor}`).expect(400);
    await get('a',`/master/orders?filter=active&cursor=${body.nextCursor}`).expect(400);
  });
});

describe('order detail ownership boundary',()=>{
  const foreign={id:'b',role:'CLIENT'} as any;
  it('urgent foreign users cannot read an assigned order',async()=>{
    const service=Object.create(OrdersService.prototype) as OrdersService;
    (service as any).prisma={order:{findUnique:async()=>fixture('u','a')}};
    await expect(service.getById(foreign,'u')).rejects.toMatchObject({status:403});
  });
  it('planned foreign/client reads reject assigned or closed records, including detail obtained from history',async()=>{
    const service=Object.create(PlannedOrdersService.prototype);
    for(const row of [fixture('p','a'),fixture('p','a','CONFIRMED'),fixture('p',null,'CLOSED')]){
      service.findOrThrow=async()=>row;
      await expect(service.getByIdForUser(foreign,'p')).rejects.toMatchObject({status:403});
    }
  });
  it('assigned master keeps own detail, eligible public-feed master gets only redacted detail',async()=>{
    const service=Object.create(PlannedOrdersService.prototype);
    service.findOrThrow=async()=>fixture('p','a');
    expect((await service.getByIdForUser({id:'a'},'p')).id).toBe('p');
    const operator=await service.getByIdForUser({id:'operator',role:'OPERATOR'},'p');
    expect(operator.client).toBeNull();expect(operator.address).toBeNull();
    service.findOrThrow=async()=>({...fixture('p',null,'PUBLISHED'),categoryId:'category',master:null,bids:[{id:'own',masterUserId:'b',price:100,term:'fixture',comment:null,createdAt:at},{id:'foreign',masterUserId:'other',price:200,term:'private'}],dispute:{evidenceDocIds:['private']}});
    service.prisma={masterCategory:{findFirst:jest.fn(async()=>null)}};
    await expect(service.getByIdForUser(foreign,'p')).rejects.toMatchObject({status:403});
    service.prisma.masterCategory.findFirst.mockResolvedValue({categoryId:'category'});
    const result=await service.getByIdForUser(foreign,'p');
    expect(result.client).toBeNull();expect(result.bids).toEqual([]);expect(result.address).toBeNull();
    expect(result.ownBid.id).toBe('own');expect(result._count.bids).toBe(2);expect(result.dispute).toBeNull();
    expect(service.prisma.masterCategory.findFirst).toHaveBeenLastCalledWith({where:{categoryId:'category',masterProfile:{userId:'b',status:'ACTIVE'}},select:{categoryId:true}});
  });
});
