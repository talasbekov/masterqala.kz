import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import {
  createTestApp,
  resetDb,
  seedCategories,
  loginAs,
  ALMATY,
  createActiveMaster,
  pointAtKm,
} from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/queue/queue.service';
import { MockPaymentProvider } from '../src/payments/mock-payment.provider';
import { PhotoReferenceGuard } from '../src/storage/photo-reference.guard';

describe('Owned current-order creation idempotency (PostGIS)', () => {
  let app: INestApplication,
    prisma: PrismaService,
    categoryId: string,
    client: { token: string; userId: string };
  const previous = process.env.COMMERCIAL_MODE;
  beforeAll(async () => {
    process.env.COMMERCIAL_MODE = 'DIRECT_PAYMENT';
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(async () => {
    await app?.close();
    if (previous === undefined) delete process.env.COMMERCIAL_MODE;
    else process.env.COMMERCIAL_MODE = previous;
  });
  beforeEach(async () => {
    await resetDb(app);
    categoryId = (await seedCategories(app)).plumbing.id;
    client = await loginAs(app, '+77040000101');
  });
  afterEach(() => jest.restoreAllMocks());
  const body = () => ({
    categoryId,
    ...ALMATY,
    description: 'Actual submitted pipe work',
    address: 'Actual address',
    district: 'District',
    clientRequestId: randomUUID(),
  });
  function synchronizeCreationTransactions() {
    // Synchronize before beginning interactive transactions: do not consume their
    // timeout budget or wait for a peer while holding the real owner row lock.
    let arrived = 0;
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    const run = prisma.$transaction.bind(prisma) as any;
    jest
      .spyOn(prisma, '$transaction')
      .mockImplementation(async (argument: any, options?: any) => {
        if (typeof argument === 'function') {
          arrived++;
          if (arrived === 2) release();
          await ready;
        }
        return run(argument, options);
      });
    return () => arrived;
  }
  const post = (value: any, token = client.token) =>
    request(app.getHttpServer())
      .post('/api/v1/orders/idempotent')
      .set('Authorization', `Bearer ${token}`)
      .send(value);
  it('rejects a missing key on the dedicated route without creating a legacy order', async () => {
    const { clientRequestId, ...legacy } = body();
    await post(legacy).expect(400);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.orderCreationRequest.count()).toBe(0);
  });
  it('replays a presented successful response before photo validation and rejects changed payload', async () => {
    const submitted = body();
    const first = await post(submitted).expect(201);
    const photos = jest
      .spyOn(app.get(PhotoReferenceGuard), 'assertAvailable')
      .mockRejectedValue(new Error('References expired after creation'));
    const replay = await post(submitted).expect(201);
    expect(replay.body).toEqual(first.body);
    expect(photos).not.toHaveBeenCalled();
    const changed = await post({
      ...submitted,
      address: 'Different address',
    }).expect(409);
    expect(changed.body.message).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
    expect(await prisma.order.count()).toBe(1);
    expect(await prisma.orderCreationRequest.count()).toBe(1);
  });
  it('serializes equal concurrent requests before active-order rejection into one exact identity', async () => {
    const submitted = body();
    const transactions = synchronizeCreationTransactions();
    const [a, b] = await Promise.all([post(submitted), post(submitted)]);
    expect(transactions()).toBe(2);
    expect([201, 202]).toContain(a.status);
    expect([201, 202]).toContain(b.status);
    expect(a.body.id).toBe(b.body.id);
    expect(await prisma.order.count()).toBe(1);
    expect(await prisma.orderCreationRequest.count()).toBe(1);
  });
  it('rejects a concurrent changed body for the same key, preserving the winning order', async () => {
    const submitted = body();
    const transactions = synchronizeCreationTransactions();
    const results = await Promise.all([
      post(submitted),
      post({ ...submitted, description: 'Changed task' }),
    ]);
    expect(
      results.filter((r) => r.status === 201 || r.status === 202),
    ).toHaveLength(1);
    expect(transactions()).toBe(2);
    expect(results.filter((r) => r.status === 409)).toHaveLength(1);
    expect(await prisma.order.count()).toBe(1);
  });
  it('isolates another owner using the same key and preserves different-key active-order protection', async () => {
    const submitted = body();
    const a = await post(submitted).expect(201);
    const other = await loginAs(app, '+77040000102');
    const b = await post(submitted, other.token).expect(201);
    expect(b.body.id).not.toBe(a.body.id);
    await post({ ...submitted, clientRequestId: randomUUID() }).expect(409);
    expect(await prisma.order.count()).toBe(2);
  });
  it('does not reserve a key for a rejected request before the order transaction', async () => {
    const submitted = body();
    await post({ ...submitted, description: '' }).expect(400);
    expect(await prisma.orderCreationRequest.count()).toBe(0);
    await post(submitted).expect(201);
    expect(await prisma.orderCreationRequest.count()).toBe(1);
  });
  it('keeps exact identity after a committed enqueue failure without repeating create/dispatch on recovery', async () => {
    const submitted = body();
    const queue = jest
      .spyOn(app.get(QueueService), 'send')
      .mockRejectedValueOnce(new Error('Queue unavailable after commit'));
    const first = await post(submitted).expect(202);
    expect(first.body.creationProcessing).toBe(true);
    expect(first.body.id).toBeTruthy();
    const replay = await post(submitted).expect(202);
    expect(replay.body.id).toBe(first.body.id);
    expect(replay.body.creationProcessing).toBe(true);
    expect(queue).toHaveBeenCalledTimes(1);
    expect(await prisma.order.count()).toBe(1);
    const record = await prisma.orderCreationRequest.findFirst();
    expect(record?.successfulResponse).toBeNull();
  });
});

describe('Paid/mock keyed create failure identity (PostGIS)', () => {
  let app: INestApplication, prisma: PrismaService;
  const previous = process.env.COMMERCIAL_MODE;
  beforeAll(async () => {
    process.env.COMMERCIAL_MODE = 'PAID_MOCK';
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(async () => {
    await app?.close();
    if (previous === undefined) delete process.env.COMMERCIAL_MODE;
    else process.env.COMMERCIAL_MODE = previous;
  });
  afterEach(() => jest.restoreAllMocks());
  it('returns exact committed-processing identity after hold failure and never performs a second hold on replay', async () => {
    await resetDb(app);
    const categoryId = (await seedCategories(app)).plumbing.id;
    const client = await loginAs(app, '+77040000201');
    await createActiveMaster(app, '+77040000202', categoryId, pointAtKm(2));
    const submitted = {
      categoryId,
      ...ALMATY,
      description: 'Actual paid/mock task',
      address: 'Actual address',
      district: 'District',
      clientRequestId: randomUUID(),
    };
    const hold = jest
      .spyOn(app.get(MockPaymentProvider), 'hold')
      .mockRejectedValueOnce(new Error('Mock hold failed after order commit'));
    const queue = jest.spyOn(app.get(QueueService), 'send');
    const post = () =>
      request(app.getHttpServer())
        .post('/api/v1/orders/idempotent')
        .set('Authorization', `Bearer ${client.token}`)
        .send(submitted);
    const first = await post().expect(202);
    expect(first.body).toMatchObject({
      status: 'CREATED',
      creationProcessing: true,
      commercialMode: 'PAID_MOCK',
    });
    expect(first.body.calloutPrice).toBeGreaterThan(0);
    const replay = await post().expect(202);
    expect(replay.body.id).toBe(first.body.id);
    expect(hold).toHaveBeenCalledTimes(1);
    expect(hold).toHaveBeenCalledWith(first.body.id, first.body.calloutPrice);
    expect(queue).not.toHaveBeenCalled();
    expect(await prisma.order.count()).toBe(1);
    expect(await prisma.orderCreationRequest.count()).toBe(1);
    expect(await prisma.paymentTransaction.count()).toBe(0);
  });
});
