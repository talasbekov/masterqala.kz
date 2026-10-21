import { AccessTokenService } from '../src/auth/access-token.service';
import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request = require('supertest');
import { PrismaService } from '../src/prisma/prisma.service';
import { MasterHistoryController } from '../src/master-history/master-history.controller';
import { MasterHistoryService } from '../src/master-history/master-history.service';

describe('master history PostgreSQL query boundary', () => {
  let app: INestApplication, db: PrismaService, jwt: JwtService;
  const owner=randomUUID(), other=randomUUID(), client=randomUUID(), category=randomUUID();
  const u1=randomUUID(),u2=randomUUID(),p1=randomUUID(),p2=randomUUID();
  beforeAll(async()=>{
    const url=new URL(process.env.DATABASE_URL!);
    if (!['localhost','127.0.0.1'].includes(url.hostname) || url.port!=='5433' || !url.pathname.endsWith('_test')) throw Error('History integration requires local test database on 5433');
    const module=await Test.createTestingModule({imports:[JwtModule.register({secret:'history-integration-test-secret-32-characters'})],controllers:[MasterHistoryController],providers:[AccessTokenService,PrismaService,MasterHistoryService]}).compile();
    app=module.createNestApplication();await app.listen(0, '127.0.0.1');db=app.get(PrismaService);jwt=app.get(JwtService);
    await db.user.createMany({data:[owner,other,client].map(id=>({id,phone:`history-test-${id}`}))});
    await db.category.create({data:{id:category,slug:`history-test-${category}`,name:'History integration fixture'}});
    for (const userId of [owner,other]) await db.masterProfile.create({data:{userId,fullName:'History fixture',iin:'000000000000',district:'Fixture',experienceYears:1,status:'ACTIVE'}});
    const common={clientId:client,categoryId:category,description:'private description',address:'private address',district:'Fixture',commercialMode:'FREE_PILOT' as const,createdAt:new Date('2026-10-01T00:00:00.000Z')};
    await db.order.createMany({data:[{id:u1,masterId:owner,status:'CLOSED'},{id:u2,masterId:owner,status:'DONE'},{masterId:other,status:'CLOSED'},{masterId:null,status:'SEARCHING'}].map(row=>({...common,...row,status:row.status as any,calloutPrice:0,serviceFee:0}))});
    await db.plannedOrder.createMany({data:[{id:p1,masterId:owner,status:'CLOSED'},{id:p2,masterId:owner,status:'MASTER_SELECTED'},{masterId:other,status:'CLOSED'},{masterId:null,status:'PUBLISHED'}].map(row=>({...common,...row,status:row.status as any,slotStart:new Date('2026-10-10'),slotEnd:new Date('2026-10-11')}))});
  });
  afterAll(async()=>{
    if(db){
      // Only this suite's UUID-scoped fixtures; never truncate a shared database.
      await db.order.deleteMany({where:{clientId:client}});
      await db.plannedOrder.deleteMany({where:{clientId:client}});
      await db.masterProfile.deleteMany({where:{userId:{in:[owner,other]}}});
      await db.category.deleteMany({where:{id:category}});
      await db.user.deleteMany({where:{id:{in:[owner,other,client]}}});
    }
    await app?.close();
  });
  const get=(id:string,query='')=>request(app.getHttpServer()).get(`/master/orders${query}`).set('Authorization',`Bearer ${jwt.sign({sub:id,role:'CLIENT',authVersion:0}, { expiresIn: '30d' })}`);
  it('enforces real stored owner and projection, then paginates database ties without loss',async()=>{
    await request(app.getHttpServer()).get('/master/orders').expect(401);await get(client).expect(403);
    const ids:string[]=[];let cursor:string|null=null;
    do {
      const {body}: {body: {items: {id: string}[]; nextCursor: string | null}}=await get(owner,`?limit=1${cursor?`&cursor=${cursor}`:''}`).expect(200);
      expect(body.items).toHaveLength(1);expect(Object.keys(body.items[0]).sort()).toEqual(['category','createdAt','district','id','kind','status']);
      ids.push(body.items[0].id);cursor=body.nextCursor;if(ids.length>4)throw Error('Pagination repeated');
    }while(cursor);
    expect(ids).toEqual([...[p1,p2].sort().reverse(),...[u1,u2].sort().reverse()]);
    expect((await get(owner,'?filter=active').expect(200)).body.items.map((row:any)=>row.id)).toEqual([p2,u2]);
    expect((await get(owner,'?filter=history').expect(200)).body.items.map((row:any)=>row.id)).toEqual([p1,u1]);
    expect((await get(other).expect(200)).body.items.every((row:any)=>!ids.includes(row.id))).toBe(true);
    const first=(await get(owner,'?limit=1').expect(200)).body;
    await get(other,`?cursor=${first.nextCursor}`).expect(400);
    expect(await db.order.count({where:{clientId:client}})).toBe(4);
    expect(await db.plannedOrder.count({where:{clientId:client}})).toBe(4);
  });
});
