import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createPlannedOrderViaApi, grantLeadCredits } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Спор по плановой заявке (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let master: { token: string; userId: string };
  let operator: { token: string; userId: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
    client = await loginAs(app, '+77090400001');
    master = await createActiveMaster(app, '+77090400002', plumbingId);
    operator = await loginAs(app, '+77090400003', 'OPERATOR');
    await grantLeadCredits(app, master.userId, 5);
  });

  async function toDone(): Promise<string> {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    const bidRes = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ price: 7000, term: 'сегодня' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/select`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ bidId: bidRes.body.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/confirm`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/on-site`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/complete`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(201);
    return order.id;
  }

  it('refundServiceFee игнорируется для планового спора: в БД сохраняется false, несмотря на запрошенный true', async () => {
    const orderId = await toDone();
    const disputeRes = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${orderId}/disputes`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ reason: 'Не устранили течь' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/disputes/${disputeRes.body.id}/resolve`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ refundServiceFee: true, penalizeMaster: false, resolutionNote: 'ok' })
      .expect(201);

    const dispute = await prisma.dispute.findUniqueOrThrow({ where: { id: disputeRes.body.id } });
    expect(dispute.refundServiceFee).toBe(false);
  });

  it('полный флоу планового спора: открытие + разрешение со штрафом, DONE→CLOSED, санкция за спор не считается в окно отмен', async () => {
    const orderId = await toDone();
    const disputeRes = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${orderId}/disputes`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ reason: 'Работа выполнена некачественно' })
      .expect(201);
    expect(disputeRes.body).toMatchObject({ plannedOrderId: orderId, openedByRole: 'CLIENT', status: 'OPEN' });

    await request(app.getHttpServer())
      .post(`/api/v1/admin/disputes/${disputeRes.body.id}/resolve`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ refundServiceFee: false, penalizeMaster: true, resolutionNote: 'Подтверждено' })
      .expect(201);

    const order = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('CLOSED');

    const penalty = await prisma.leadCreditTransaction.findFirstOrThrow({ where: { masterUserId: master.userId, type: 'PENALTY' } });
    expect(penalty.amount).toBe(-2);

    // санкция за спор — не за отмену (§3.9 vs §3.10): окно блокировки за отмены не должно расти
    expect(await prisma.masterCancellation.count({ where: { masterUserId: master.userId } })).toBe(0);
  });
});
