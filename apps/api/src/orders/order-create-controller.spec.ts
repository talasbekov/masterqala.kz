import { OrdersController } from './orders.controller';
import {
  OrderCreationRequestService,
  creationPayloadHash,
} from './order-creation-request.service';
const dto = {
  categoryId: '377c3955-024c-4af2-b6d9-2ca1060c47ad',
  description: 'Actual task',
  address: 'Actual address',
  district: 'District',
  lat: 51.2,
  lng: 71.4,
  clientRequestId: '577c3955-024c-4af2-b6d9-2ca1060c47ad',
};
const user: any = { id: 'owner-a', role: 'CLIENT' };
const raw = {
  id: 'order-a',
  clientId: 'owner-a',
  commercialMode: 'FREE_PILOT',
  calloutPrice: 2500,
  serviceFee: 1000,
  status: 'SEARCHING',
};
function setup(record: any = null) {
  const prisma: any = {
    orderCreationRequest: {
      findUnique: jest.fn(async () => record),
      updateMany: jest.fn(async ({ data }: any) => {
        record.successfulResponse = data.successfulResponse;
        return { count: 1 };
      }),
    },
  };
  const requests = new OrderCreationRequestService(prisma);
  const orders: any = {
    create: jest.fn(async () => raw),
    createWithRequest: jest.fn(async () => {
      record = {
        ownerId: user.id,
        requestKey: dto.clientRequestId,
        payloadHash: creationPayloadHash(dto),
        orderId: raw.id,
        successfulResponse: null,
      };
      return { order: raw, replayed: false };
    }),
    getById: jest.fn(async () => raw),
  };
  const photos: any = { assertAvailable: jest.fn(async () => {}) },
    mode: any = { isFreePilot: () => true };
  const response: any = { status: jest.fn(), setHeader: jest.fn() };
  const controller = new OrdersController(orders, mode, photos, requests);
  return {
    controller,
    orders,
    photos,
    response,
    prisma,
    getRecord: () => record,
  };
}
describe('Presented request replay coordinator', () => {
  it('returns the cached presented HTTP response before rechecking expired photo references', async () => {
    const snapshot = {
      id: 'order-a',
      commercialMode: 'FREE_PILOT',
      calloutPrice: 0,
      serviceFee: 0,
      freePilot: true,
    };
    const f = setup({
      ownerId: user.id,
      requestKey: dto.clientRequestId,
      payloadHash: creationPayloadHash(dto),
      orderId: 'order-a',
      successfulResponse: snapshot,
    });
    f.photos.assertAvailable.mockRejectedValue(new Error('Expired'));
    expect(await f.controller.create(user, dto, f.response)).toEqual(snapshot);
    expect(f.photos.assertAvailable).not.toHaveBeenCalled();
    expect(f.orders.createWithRequest).not.toHaveBeenCalled();
    expect(f.response.setHeader).toHaveBeenCalledWith(
      'Idempotency-Replayed',
      'true',
    );
  });
  it('stores only the presented response after a fresh successful keyed creation', async () => {
    const f = setup();
    const result = await f.controller.create(user, dto, f.response);
    expect(result).toMatchObject({
      id: 'order-a',
      calloutPrice: 0,
      serviceFee: 0,
      nominalCalloutPrice: 2500,
      freePilot: true,
    });
    expect(f.getRecord()?.successfulResponse).toEqual(result);
    expect(f.orders.createWithRequest).toHaveBeenCalledWith(user.id, dto);
    expect(f.orders.create).not.toHaveBeenCalled();
  });
  it('represents missing snapshot as committed processing, not failure, without repeating create or photo validation', async () => {
    const f = setup({
      ownerId: user.id,
      requestKey: dto.clientRequestId,
      payloadHash: creationPayloadHash(dto),
      orderId: 'order-a',
      successfulResponse: null,
    });
    const result = await f.controller.create(user, dto, f.response);
    expect(result).toMatchObject({
      id: 'order-a',
      creationProcessing: true,
      calloutPrice: 0,
    });
    expect(f.response.status).toHaveBeenCalledWith(202);
    expect(f.orders.createWithRequest).not.toHaveBeenCalled();
    expect(f.photos.assertAvailable).not.toHaveBeenCalled();
    expect(f.prisma.orderCreationRequest.updateMany).not.toHaveBeenCalled();
  });
  it('recovers exact committed identity after a post-commit exception; pre-commit validation failure stays a rejection', async () => {
    const f = setup();
    // Install a committed identity before injecting its post-commit failure.
    const record = {
      ownerId: user.id,
      requestKey: dto.clientRequestId,
      payloadHash: creationPayloadHash(dto),
      orderId: 'order-a',
      successfulResponse: null,
    };
    f.orders.createWithRequest.mockImplementation(async () => {
      f.prisma.orderCreationRequest.findUnique.mockResolvedValue(record);
      throw Error('Queue failed after commit');
    });
    expect(await f.controller.create(user, dto, f.response)).toMatchObject({
      id: 'order-a',
      creationProcessing: true,
    });
    expect(f.response.status).toHaveBeenCalledWith(202);
    const rejected = setup();
    rejected.photos.assertAvailable.mockRejectedValue(
      new Error('Photo rejected before create'),
    );
    await expect(
      rejected.controller.create(user, dto, rejected.response),
    ).rejects.toThrow('Photo rejected before create');
    expect(rejected.orders.createWithRequest).not.toHaveBeenCalled();
  });
  it('retains the old no-key photo/create path without any request-table reads', async () => {
    const f = setup();
    const { clientRequestId, ...legacy } = dto;
    expect(await f.controller.create(user, legacy, f.response)).toMatchObject({
      id: 'order-a',
    });
    expect(f.photos.assertAvailable).toHaveBeenCalledTimes(1);
    expect(f.orders.create).toHaveBeenCalledWith(user.id, legacy);
    expect(f.prisma.orderCreationRequest.findUnique).not.toHaveBeenCalled();
  });
});

it('dedicated keyed endpoint rejects a missing key instead of entering the legacy create path', async () => {
  const f = setup();
  const { clientRequestId, ...legacy } = dto;
  await expect(
    f.controller.createIdempotent(user, legacy as any, f.response),
  ).rejects.toMatchObject({ status: 400 });
  expect(f.orders.create).not.toHaveBeenCalled();
  expect(f.photos.assertAvailable).not.toHaveBeenCalled();
});
