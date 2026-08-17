import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  resetDb,
  seedCategories,
  loginAs,
  createActiveMaster,
  createOrderViaApi,
  createPlannedOrderViaApi,
} from './helpers';

describe('Admin orders (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let categories: Awaited<ReturnType<typeof seedCategories>>;
  let operator: { token: string; userId: string };
  let client: { token: string; userId: string };
  let seededMaster: { token: string; userId: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());
  beforeEach(async () => {
    await resetDb(app);
    categories = await seedCategories(app);
    operator = await loginAs(app, '+77010000001', 'OPERATOR');
    client = await loginAs(app, '+77010000002');
    seededMaster = await createActiveMaster(app, '+77010000003', categories.plumbing.id);
  });

  it('lists urgent orders and marks a stuck wave-3 search as assignable in the detail view', async () => {
    const created = await createOrderViaApi(app, client.token, categories.plumbing.id);
    await prisma.order.update({
      where: { id: created.id },
      data: { wave: 3, createdAt: new Date(Date.now() - 10 * 60_000) },
    });

    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/orders')
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);
    expect(list.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: created.id, type: 'urgent', status: 'SEARCHING' })]),
    );

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/orders/${created.id}?type=urgent`)
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);
    expect(detail.body.canAssign).toBe(true);
    expect(detail.body.timeline[0]).toMatchObject({ event: expect.stringContaining('создана') });
  });

  it('rejects non-operator callers', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/orders')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(403);
  });

  it('lists a nearby online master as a manual-assign candidate', async () => {
    const created = await createOrderViaApi(app, client.token, categories.plumbing.id);
    await prisma.order.update({
      where: { id: created.id },
      data: { wave: 3, createdAt: new Date(Date.now() - 10 * 60_000) },
    });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/orders/${created.id}/candidates`)
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);

    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toMatchObject({ isOnline: true });
  });

  it('force-assigns a stuck search to a chosen master and logs it in the audit trail', async () => {
    const created = await createOrderViaApi(app, client.token, categories.plumbing.id);
    await prisma.order.update({
      where: { id: created.id },
      data: { wave: 3, createdAt: new Date(Date.now() - 10 * 60_000) },
    });
    const candidates = await request(app.getHttpServer())
      .get(`/api/v1/admin/orders/${created.id}/candidates`)
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);
    const masterUserId = candidates.body[0].masterUserId;

    await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${created.id}/assign`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ masterUserId })
      .expect(201);

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: created.id } });
    expect(updated.status).toBe('ACCEPTED');
    expect(updated.masterId).toBe(masterUserId);

    const log = await prisma.auditLog.findFirstOrThrow({
      where: { targetId: created.id, action: 'ORDER_MANUALLY_ASSIGNED' },
    });
    expect(log.actorType).toBe('OPERATOR');
    expect(log.actorId).toBe(operator.userId);
  });

  it('rejects manual assignment to a masterUserId that is not an active master (4xx, not 500)', async () => {
    const created = await createOrderViaApi(app, client.token, categories.plumbing.id);
    await prisma.order.update({
      where: { id: created.id },
      data: { wave: 3, createdAt: new Date(Date.now() - 10 * 60_000) },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${created.id}/assign`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ masterUserId: 'this-user-does-not-exist' })
      .expect(404);

    const untouched = await prisma.order.findUniqueOrThrow({ where: { id: created.id } });
    expect(untouched.status).toBe('SEARCHING');
    expect(untouched.masterId).toBeNull();
  });

  it('rejects manual assignment to a master already busy on another active order (no double-booking)', async () => {
    const busyMaster = await createActiveMaster(app, '+77010000004', categories.plumbing.id);
    const otherClient = await loginAs(app, '+77010000005');
    const busyOrder = await createOrderViaApi(app, otherClient.token, categories.plumbing.id);
    await prisma.order.update({
      where: { id: busyOrder.id },
      data: { status: 'ACCEPTED', masterId: busyMaster.userId, acceptedAt: new Date() },
    });

    const target = await createOrderViaApi(app, client.token, categories.plumbing.id);
    await prisma.order.update({
      where: { id: target.id },
      data: { wave: 3, createdAt: new Date(Date.now() - 10 * 60_000) },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${target.id}/assign`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ masterUserId: busyMaster.userId })
      .expect(409);

    const untouched = await prisma.order.findUniqueOrThrow({ where: { id: target.id } });
    expect(untouched.status).toBe('SEARCHING');
    expect(untouched.masterId).toBeNull();
  });

  it('rejects manual assignment for an order that already left SEARCHING', async () => {
    const created = await createOrderViaApi(app, client.token, categories.plumbing.id);
    await prisma.order.update({ where: { id: created.id }, data: { status: 'NO_MASTERS' } });

    await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${created.id}/assign`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ masterUserId: seededMaster.userId })
      .expect(409);
  });

  it('rejects candidates/assign for a planned order with 400, not a 404', async () => {
    const created = await createPlannedOrderViaApi(app, client.token, categories.plumbing.id);

    await request(app.getHttpServer())
      .get(`/api/v1/admin/orders/${created.id}/candidates?type=planned`)
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${created.id}/assign?type=planned`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ masterUserId: 'irrelevant' })
      .expect(400);
  });
});
