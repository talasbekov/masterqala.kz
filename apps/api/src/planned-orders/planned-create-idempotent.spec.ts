import { BadRequestException, ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as dtoTypes from './dto';
import { PlannedOrdersController } from './planned-orders.controller';
import { PlannedOrdersService } from './planned-orders.service';
import { JOBS } from '../queue/queue.constants';

const owner = { id: 'owner-1', role: 'CLIENT' } as any;
const request = () => ({
  clientRequestId: '577c3955-024c-4af2-b6d9-2ca1060c47ad',
  categoryId: 'fb52ac59-567d-47ab-8ad1-41637c08eb3f',
  description: 'Fix the sink',
  address: 'Street 10',
  district: 'Centre',
  slotStart: new Date(Date.now() + 86400000).toISOString(),
  slotEnd: new Date(Date.now() + 90000000).toISOString(),
  photoPaths: ['577c3955-024c-4af2-b6d9-2ca1060c47ad.jpg'],
});

// Transactional in-memory boundary: serializes only when production acquires
// its User row lock, and commits or rolls back all written rows together.
function fixture() {
  let orders: any[] = [];
  let records: any[] = [];
  let photos: any[] = [];
  let lock = Promise.resolve();
  let sequence = 0;
  const reads = (getRecords: () => any[]) => ({
    findUnique: async ({ where }: any) =>
      getRecords().find(
        (r) =>
          r.ownerId === where.ownerId_requestKey.ownerId &&
          r.requestKey === where.ownerId_requestKey.requestKey,
      ) ?? null,
    findMany: async () =>
      getRecords()
        .filter((r) => !r.expiryScheduledAt)
        .map((r) => ({
          ...r,
          order: orders.find((o) => o.id === r.orderId),
        })),
    update: async ({ where, data }: any) => {
      const row = getRecords().find((r) => r.orderId === where.orderId);
      if (!row) throw new Error('missing creation identity');
      Object.assign(row, data);
      return row;
    },
  });
  const prisma: any = {
    category: { findUnique: async () => ({ id: request().categoryId }) },
    plannedOrderCreationRequest: reads(() => records),
    plannedOrder: {
      findUnique: async ({ where }: any) =>
        orders.find((r) => r.id === where.id) ?? null,
    },
    dispute: { findFirst: async () => null },
    $transaction: async (fn: any) => {
      let release: (() => void) | undefined;
      let localOrders = orders.slice(),
        localRecords = records.slice(),
        localPhotos = photos.slice();
      const tx: any = {
        $queryRaw: async () => {
          const preceding = lock;
          lock = new Promise<void>((resolve) => {
            release = resolve;
          });
          await preceding;
          localOrders = orders.slice();
          localRecords = records.slice();
          localPhotos = photos.slice();
          return [{ id: owner.id }];
        },
        category: prisma.category,
        plannedOrderCreationRequest: {
          ...reads(() => localRecords),
          create: async ({ data }: any) => {
            localRecords.push({ expiryScheduledAt: null, ...data });
            return data;
          },
        },
        plannedOrder: {
          create: async ({ data }: any) => {
            const row = {
              id: `planned-${++sequence}`,
              bids: [],
              master: null,
              selectedAt: null,
              ...data,
            };
            localOrders.push(row);
            return row;
          },
        },
        plannedOrderPhoto: {
          createMany: async ({ data }: any) => {
            localPhotos.push(...data);
          },
        },
      };
      try {
        const result = await fn(tx);
        orders = localOrders;
        records = localRecords;
        photos = localPhotos;
        return result;
      } finally {
        release?.();
      }
    },
  };
  let queueDown = false;
  const jobs: any[] = [];
  const handlers = new Map<string, () => Promise<void>>();
  let queueDisabled = false;
  const queue: any = {
    register: () => undefined,
    registerCron: (name: string, _cron: string, handler: () => Promise<void>) =>
      handlers.set(name, handler),
    healthCheck: () => ({ status: queueDisabled ? 'DISABLED' : 'UP' }),
    send: async (...args: any[]) => {
      if (queueDown) throw new Error('queue unavailable');
      jobs.push(args);
    },
  };
  let unavailablePhotos = false;
  const photoReferences: any = {
    assertAvailable: async () => {
      if (unavailablePhotos || photos.length)
        throw new BadRequestException('already attached or expired');
    },
  };
  const service = new PlannedOrdersService(
    prisma,
    queue,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    { attachRating: async (value: any) => value } as any,
  );
  const controller = new PlannedOrdersController(
    service,
    {} as any,
    photoReferences,
  );
  const create = (dto = request(), user = owner) =>
    (controller as any).createIdempotent(user, dto);
  return {
    create,
    service,
    controller,
    jobs,
    get orders() {
      return orders;
    },
    get records() {
      return records;
    },
    get photos() {
      return photos;
    },
    set queueDown(value: boolean) {
      queueDown = value;
    },
    set unavailablePhotos(value: boolean) {
      unavailablePhotos = value;
    },
    set queueDisabled(value: boolean) {
      queueDisabled = value;
    },
    handlers,
  };
}

describe('planned idempotent creation', () => {
  it('creates one LEGACY order for concurrent retries and returns its real identity', async () => {
    const f = fixture(),
      dto = request();
    const results = await Promise.all([
      f.create(dto),
      f.create(dto),
      f.create(dto),
    ]);
    expect(results.map((r) => r.id)).toEqual([
      'planned-1',
      'planned-1',
      'planned-1',
    ]);
    expect(f.orders).toHaveLength(1);
    expect(f.orders[0].lifecycleModel).toBe('LEGACY');
    expect(f.photos).toHaveLength(1);
    expect(f.records).toHaveLength(1);
  });

  it('replays after lost response, expired slot and attached photos without creating again', async () => {
    const f = fixture(),
      dto = request();
    const first = await f.create(dto);
    jest.useFakeTimers().setSystemTime(new Date(dto.slotEnd).getTime() + 1000);
    try {
      f.unavailablePhotos = true;
      const replay = await f.create(dto);
      expect(replay.id).toBe(first.id);
      expect(f.orders).toHaveLength(1);
      expect(f.jobs).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('conflicts on a different payload for the same owner and key', async () => {
    const f = fixture(),
      dto = request();
    await f.create(dto);
    await expect(f.create({ ...dto, budget: 2000 } as any)).rejects.toThrow(
      ConflictException,
    );
    expect(f.orders).toHaveLength(1);
  });

  it('normalizes equivalent timestamp instants and omitted optional values', async () => {
    const f = fixture(),
      dto = { ...request(), photoPaths: [] };
    const first = await f.create(dto);
    const replay = await f.create({
      ...dto,
      entrance: null,
      budget: null,
      slotStart: dto.slotStart.replace('Z', '+00:00'),
      photoPaths: undefined,
    } as any);
    expect(replay.id).toBe(first.id);
  });

  it('isolates the same request key by authenticated owner', async () => {
    const f = fixture(),
      dto = { ...request(), photoPaths: [] };
    const first = await f.create(dto);
    const second = await f.create(dto, { ...owner, id: 'owner-2' });
    expect(first.id).not.toBe(second.id);
    expect(second.clientId).toBe('owner-2');
    expect(f.orders).toHaveLength(2);
  });

  it('returns the committed order during queue outage and retries expiry on replay', async () => {
    const f = fixture(),
      dto = request();
    f.queueDown = true;
    const first = await f.create(dto);
    expect(f.records[0].expiryScheduledAt).toBeNull();
    f.queueDown = false;
    const replay = await f.create(dto);
    expect(replay.id).toBe(first.id);
    expect(f.orders).toHaveLength(1);
    expect(f.jobs[0].slice(0, 2)).toEqual([
      JOBS.PLANNED_EXPIRY,
      { plannedOrderId: first.id },
    ]);
    expect(f.records[0].expiryScheduledAt).toBeInstanceOf(Date);
  });

  it('does not persist a request when initial photo validation fails', async () => {
    const f = fixture();
    f.unavailablePhotos = true;
    await expect(f.create()).rejects.toThrow(BadRequestException);
    expect(f.orders).toHaveLength(0);
    expect(f.records).toHaveLength(0);
  });

  it('recovers pending expiry after queue outage without any client replay', async () => {
    const f = fixture();
    f.service.onModuleInit();
    f.queueDown = true;
    const created = await f.create();
    f.queueDown = false;
    const recover = f.handlers.get('planned-creation-expiry-recovery');
    expect(recover).toBeDefined();
    await recover!();
    expect(f.jobs).toHaveLength(1);
    expect(f.jobs[0][1]).toEqual({ plannedOrderId: created.id });
    expect(f.records[0].expiryScheduledAt).toBeInstanceOf(Date);
  });

  it('keeps expiry pending when the queue is disabled instead of recording a no-op as delivery', async () => {
    const f = fixture();
    f.queueDisabled = true;
    await f.create();
    expect(f.records[0].expiryScheduledAt).toBeNull();
    expect(f.jobs).toHaveLength(0);
  });

  it('replays current status with the normal client contact redaction', async () => {
    const f = fixture(),
      dto = request();
    await f.create(dto);
    Object.assign(f.orders[0], {
      status: 'MASTER_SELECTED',
      master: { id: 'master', name: 'Master', phone: 'private' },
    });
    const replay = await f.create(dto);
    expect(replay.status).toBe('MASTER_SELECTED');
    expect(replay.master.phone).toBe('');
  });

  it('still rejects a new request with a past slot', async () => {
    const f = fixture();
    await expect(
      f.create({ ...request(), slotStart: new Date(0).toISOString() }),
    ).rejects.toThrow(BadRequestException);
    expect(f.orders).toHaveLength(0);
  });

  it('preserves ordinary POST creation without a request key', async () => {
    const f = fixture();
    const { clientRequestId, ...dto } = request();
    const result = await f.controller.create(owner, dto);
    expect(result.id).toBe('planned-1');
    expect(f.records).toHaveLength(0);
  });

  it('requires a UUID clientRequestId in the dedicated DTO', async () => {
    const Dto = (dtoTypes as any).CreateIdempotentPlannedOrderDto;
    expect(Dto).toBeDefined();
    expect(await validate(plainToInstance(Dto, request()))).toEqual([]);
    for (const clientRequestId of [undefined, null, '', 'bad-key']) {
      const errors = await validate(
        plainToInstance(Dto, { ...request(), clientRequestId }),
      );
      expect(errors.map((error) => error.property)).toContain(
        'clientRequestId',
      );
    }
  });
});
