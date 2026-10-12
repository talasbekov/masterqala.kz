import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi, pointAtKm } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { MatchingService } from '../src/orders/matching.service';

function accept(app: INestApplication, token: string, orderId: string) {
  return request(app.getHttpServer())
    .post(`/api/v1/orders/${orderId}/accept`)
    .set('Authorization', `Bearer ${token}`);
}

describe('Принятие заявки (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let matching: MatchingService;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let m1: { token: string; userId: string };
  let m2: { token: string; userId: string };
  let orderId: string;

  beforeAll(async () => {
    // listen: true — нужен реально забинденный порт, иначе supertest вызывает
    // app.listen(0) неявно на каждый request() и параллельные вызовы в
    // Promise.all сериализуются (второй ждёт, пока первый добиндится),
    // из-за чего гонка перестаёт быть настоящей на уровне БД.
    app = await createTestApp({ listen: true });
    prisma = app.get(PrismaService);
    matching = app.get(MatchingService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
    client = await loginAs(app, '+77060000001');
    m1 = await createActiveMaster(app, '+77060000002', plumbingId, pointAtKm(1));
    m2 = await createActiveMaster(app, '+77060000003', plumbingId, pointAtKm(2));
    const order = await createOrderViaApi(app, client.token, plumbingId);
    orderId = order.id;
    await matching.handleWave({ orderId, wave: 1 });
  });

  it('гонка: двое принимают одновременно → 1×200(201) и 1×409, офферы ACCEPTED/LOST, CAPTURE один', async () => {
    // Both real transactions start before acquiring row locks. A barrier AFTER
    // reading the offer would deadlock: the new serializable assignment boundary
    // deliberately prevents the second transaction from reading under the first lock.
    let checkedIn=0;
    let releaseAll!:()=>void;
    const bothArrived=new Promise<void>(resolve=>{releaseAll=resolve;});
    const original=prisma.$transaction.bind(prisma);
    const spy=jest.spyOn(prisma,'$transaction').mockImplementation(async(fn:any,...rest:any[])=>{
      return (original as any)(async(tx:any)=>{
        checkedIn++;
        if(checkedIn===2) releaseAll();
        await bothArrived;
        return fn(tx);
      },...rest);
    });
    const [r1,r2]=await Promise.all([accept(app,m1.token,orderId),accept(app,m2.token,orderId)])
      .finally(()=>spy.mockRestore());

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order!.status).toBe('ACCEPTED');
    expect([m1.userId, m2.userId]).toContain(order!.masterId);

    const outcomes = (await prisma.orderOffer.findMany({ where: { orderId } })).map((o) => o.outcome).sort();
    expect(outcomes).toEqual(['ACCEPTED', 'LOST']);

    expect(await prisma.paymentTransaction.count({ where: { orderId, type: 'CAPTURE' } })).toBe(1);
  });

  it('мастер без оффера не может принять (403)', async () => {
    const stranger = await createActiveMaster(app, '+77060000004', plumbingId, pointAtKm(20));
    await accept(app, stranger.token, orderId).expect(403);
  });

  it('занятый мастер не может принять вторую (409)', async () => {
    await accept(app, m1.token, orderId).expect(201);
    const client2 = await loginAs(app, '+77060000005');
    const order2 = await createOrderViaApi(app, client2.token, plumbingId);
    await matching.handleWave({ orderId: order2.id, wave: 1 });
    await accept(app, m1.token, order2.id).expect(409);
  });
});
