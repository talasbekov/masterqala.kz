import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrderDto, CreateIdempotentOrderDto } from './dto';
import {
  creationPayloadHash,
  OrderCreationRequestService,
} from './order-creation-request.service';
const dto = {
  categoryId: '377c3955-024c-4af2-b6d9-2ca1060c47ad',
  description: 'Actual submitted task',
  address: 'Actual address',
  district: 'District',
  lat: 51.2,
  lng: 71.4,
  photoPaths: ['377c3955-024c-4af2-b6d9-2ca1060c47ad.jpg'],
} as CreateOrderDto;
describe('Current-order request identity', () => {
  it('rejects invalid request keys while retaining optional-key compatibility', async () => {
    expect(await validate(plainToInstance(CreateOrderDto, dto))).toEqual([]);
    const errors = await validate(
      plainToInstance(CreateOrderDto, {
        ...dto,
        clientRequestId: 'not-a-uuid',
      }),
    );
    expect(errors.some((error) => error.property === 'clientRequestId')).toBe(
      true,
    );
  });
  it('hashes only a canonical submitted payload, excluding key/prices/tokens and normalizing omitted options', () => {
    const hash = creationPayloadHash(dto);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      creationPayloadHash({
        ...dto,
        clientRequestId: 'other-key',
        token: 'never-hash',
        calloutPrice: 2500,
      } as any),
    ).toBe(hash);
    expect(
      creationPayloadHash({ ...dto, entrance: undefined, floor: undefined }),
    ).toBe(hash);
    for (const change of [
      { description: 'Changed' },
      { lat: 52 },
      { photoPaths: ['377c3955-024c-4af2-b6d9-2ca1060c47ae.jpg'] },
      { address: 'Changed street' },
    ])
      expect(creationPayloadHash({ ...dto, ...change })).not.toBe(hash);
  });
});

describe('Owned creation request records', () => {
  const request = {
    ...dto,
    clientRequestId: '577c3955-024c-4af2-b6d9-2ca1060c47ad',
  };
  const record = {
    ownerId: 'owner-a',
    requestKey: request.clientRequestId,
    payloadHash: creationPayloadHash(dto),
    orderId: 'order-a',
    successfulResponse: null,
  };
  it('looks up exactly owner/key and rejects changed submitted payload', async () => {
    const findUnique = jest.fn(async ({ where }: any) =>
      where.ownerId_requestKey.ownerId === 'owner-a' ? record : null,
    );
    const service = new OrderCreationRequestService({
      orderCreationRequest: { findUnique },
    } as any);
    expect(await service.lookup('owner-a', request)).toEqual(record);
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        ownerId_requestKey: {
          ownerId: 'owner-a',
          requestKey: request.clientRequestId,
        },
      },
    });
    expect(await service.lookup('owner-b', request)).toBeNull();
    await expect(
      service.lookup('owner-a', { ...request, address: 'Changed address' }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('stores a JSON HTTP response only for the matching committed request, keeping the first snapshot', async () => {
    let snapshot: any = null;
    const prisma: any = {
      orderCreationRequest: {
        updateMany: jest.fn(async ({ data }: any) => {
          if (snapshot) return { count: 0 };
          snapshot = data.successfulResponse;
          return { count: 1 };
        }),
        findUnique: jest.fn(async () => ({
          ...record,
          successfulResponse: snapshot,
        })),
      },
    };
    const service = new OrderCreationRequestService(prisma);
    const presented = {
      id: 'order-a',
      commercialMode: 'FREE_PILOT',
      calloutPrice: 0,
      serviceFee: 0,
      createdAt: new Date('2026-10-13T00:00:00Z'),
    };
    expect(
      await service.rememberResponse('owner-a', request, presented),
    ).toEqual({ ...presented, createdAt: '2026-10-13T00:00:00.000Z' });
    expect(
      await service.rememberResponse('owner-a', request, {
        ...presented,
        status: 'Different later state',
      }),
    ).toEqual(snapshot);
    expect(
      prisma.orderCreationRequest.updateMany.mock.calls[0][0].where,
    ).toMatchObject({
      ownerId: 'owner-a',
      requestKey: request.clientRequestId,
      payloadHash: record.payloadHash,
    });
  });
});

it('adds an isolated owner/key table with no rewrite of legacy orders', () => {
  const root = join(__dirname, '../..');
  const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8');
  expect(schema).toContain('model OrderCreationRequest {');
  const migration = join(
    root,
    'prisma/migrations/20261013000400_order_creation_request/migration.sql',
  );
  expect(existsSync(migration)).toBe(true);
  const sql = readFileSync(migration, 'utf8');
  expect(sql).toMatch(/UNIQUE INDEX .*\("ownerId", "requestKey"\)/);
  expect(sql).not.toMatch(/UPDATE "Order"|DELETE FROM/);
});

it('the dedicated keyed DTO requires a UUID and never inherits optional-key validation', async () => {
  const errors = await validate(plainToInstance(CreateIdempotentOrderDto, dto));
  expect(errors.some((error) => error.property === 'clientRequestId')).toBe(
    true,
  );
  expect(
    await validate(
      plainToInstance(CreateIdempotentOrderDto, {
        ...dto,
        clientRequestId: '577c3955-024c-4af2-b6d9-2ca1060c47ad',
      }),
    ),
  ).toEqual([]);
});
