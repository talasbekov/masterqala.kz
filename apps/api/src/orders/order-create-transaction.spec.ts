import { OrdersService } from './orders.service';
import { creationPayloadHash } from './order-creation-request.service';
const dto = {
  categoryId: '377c3955-024c-4af2-b6d9-2ca1060c47ad',
  description: 'Actual task',
  address: 'Actual address',
  district: 'District',
  lat: 51.2,
  lng: 71.4,
  clientRequestId: '577c3955-024c-4af2-b6d9-2ca1060c47ad',
};
function setup(existing = true, commercialMode = 'DIRECT_PAYMENT') {
  const events: string[] = [];
  const order: any = {
    id: 'order-1',
    clientId: 'owner-a',
    status: 'CREATED',
    categoryId: dto.categoryId,
    priceProposedAt: null,
    commercialMode: 'DIRECT_PAYMENT',
    lifecycleVersion: 2,
    quoteVersion: 0,
    photos: [],
    calloutPrice: 0,
    serviceFee: 0,
  };
  let record: any = existing
    ? {
        ownerId: 'owner-a',
        requestKey: dto.clientRequestId,
        payloadHash: creationPayloadHash(dto),
        orderId: order.id,
        successfulResponse: null,
      }
    : null;
  const tx: any = {
    $queryRaw: jest.fn(async () => {
      events.push('owner-lock');
      return [{ id: 'owner-a' }];
    }),
    $executeRaw: jest.fn(async () => 1),
    orderCreationRequest: {
      findUnique: jest.fn(async () => {
        events.push('key-recheck');
        return record;
      }),
      create: jest.fn(async ({ data }: any) => {
        events.push('mapping-create');
        record = data;
        return data;
      }),
    },
    order: {
      count: jest.fn(async () => {
        events.push('active-check');
        return existing ? 1 : 0;
      }),
      create: jest.fn(async ({ data }: any) => {
        events.push('order-create');
        Object.assign(order, data);
        return order;
      }),
      findUnique: jest.fn(async () => order),
      updateMany: jest.fn(async ({ data }: any) => {
        Object.assign(order, data);
        return { count: 1 };
      }),
    },
    orderPhoto: { createMany: jest.fn(async () => ({ count: 0 })) },
  };
  const prisma: any = {
    ...tx,
    category: { findUnique: jest.fn(async () => ({ id: dto.categoryId })) },
    order: {
      ...tx.order,
      count: jest.fn(async () => {
        events.push('outside-active-check');
        return existing ? 1 : 0;
      }),
    },
    dispute: { findFirst: jest.fn(async () => null) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  const queue: any = { send: jest.fn() },
    payments: any = { hold: jest.fn() },
    reviews: any = { attachRating: async (value: any) => value },
    mode: any = { mode: () => commercialMode };
  const service = new (OrdersService as any)(
    prisma,
    { quote: async () => ({ calloutPrice: 2500, serviceFee: 1000 }) },
    queue,
    {},
    payments,
    {},
    {},
    {},
    {},
    reviews,
    {},
    mode,
    {},
  );
  return {
    service,
    prisma,
    tx,
    queue,
    payments,
    events,
    order,
    getRecord: () => record,
  };
}
describe('Keyed create transaction', () => {
  it('rechecks owner/key under the existing row lock before active-order rejection and skips post-commit side effects for replay', async () => {
    const f = setup();
    const result = await f.service.createWithRequest('owner-a', dto);
    expect(result).toMatchObject({ order: { id: 'order-1' }, replayed: true });
    expect(f.events).toEqual(['owner-lock', 'key-recheck']);
    expect(f.prisma.order.count).not.toHaveBeenCalled();
    expect(f.tx.order.count).not.toHaveBeenCalled();
    expect(f.queue.send).not.toHaveBeenCalled();
    expect(f.payments.hold).not.toHaveBeenCalled();
  });
  it('rejects an unequal body under the lock without creating a second order or side effect', async () => {
    const f = setup();
    await expect(
      f.service.createWithRequest('owner-a', { ...dto, lat: 52 }),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.tx.order.create).not.toHaveBeenCalled();
    expect(f.queue.send).not.toHaveBeenCalled();
    expect(f.events).toContain('key-recheck');
  });
  it('creates the order and exact owner/hash mapping in the same transaction, retaining normal dispatch', async () => {
    const f = setup(false);
    const result = await f.service.createWithRequest('owner-a', dto);
    expect(result).toMatchObject({
      order: { id: 'order-1', status: 'SEARCHING' },
      replayed: false,
    });
    expect(f.events).toEqual([
      'owner-lock',
      'key-recheck',
      'active-check',
      'order-create',
      'mapping-create',
    ]);
    expect(f.getRecord()).toMatchObject({
      ownerId: 'owner-a',
      requestKey: dto.clientRequestId,
      payloadHash: creationPayloadHash(dto),
      orderId: 'order-1',
    });
    expect(f.queue.send).toHaveBeenCalledTimes(1);
  });
});

it('a paid/mock hold failure preserves exact order identity and replay never repeats the hold or starts dispatch', async () => {
  const f = setup(false, 'PAID_MOCK');
  f.payments.hold.mockRejectedValueOnce(new Error('Mock hold failed'));
  await expect(f.service.createWithRequest('owner-a', dto)).rejects.toThrow(
    'Mock hold failed',
  );
  expect(f.getRecord()).toMatchObject({
    orderId: 'order-1',
    requestKey: dto.clientRequestId,
  });
  expect(f.order.status).toBe('CREATED');
  expect(f.payments.hold).toHaveBeenCalledWith('order-1', 2500);
  expect(f.queue.send).not.toHaveBeenCalled();
  expect(await f.service.createWithRequest('owner-a', dto)).toMatchObject({
    order: { id: 'order-1', status: 'CREATED' },
    replayed: true,
  });
  expect(f.payments.hold).toHaveBeenCalledTimes(1);
  expect(f.queue.send).not.toHaveBeenCalled();
  expect(f.tx.order.create).toHaveBeenCalledTimes(1);
});
