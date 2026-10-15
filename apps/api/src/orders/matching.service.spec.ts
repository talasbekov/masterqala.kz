import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { MatchingService } from './matching.service';
import { SequentialMatchingService } from './sequential-matching.service';
import { OrdersService } from './orders.service';

function setup(commercialMode: 'FREE_PILOT' | 'PAID_MOCK' | 'DIRECT_PAYMENT') {
  const tx = {
    order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    orderOffer: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = {
    order: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'order-1',
        clientId: 'client-1',
        categoryId: 'category-1',
        category: { name: 'Сантехник' },
        status: 'SEARCHING',
        commercialMode,
        dispatchMode: commercialMode === 'DIRECT_PAYMENT' ? 'SEQUENTIAL' : 'WAVE',
        wave: 0,
        searchAttempt: 1,
        description: 'Течёт кран',
        address: 'Астана, ул. Тестовая, 1',
        entrance: '2',
        floor: '7',
        apartment: '42',
        addressComment: 'Домофон 123',
        district: 'Есиль',
        calloutPrice: 2600,
        serviceFee: 1040,
      }),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'master-1', meters: 1200 }]),
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  } as unknown as PrismaService;
  const queue = {
    register: jest.fn(),
    send: jest.fn().mockResolvedValue(undefined),
  } as unknown as QueueService;
  const gateway = { emitToUser: jest.fn() } as unknown as RealtimeGateway;
  const orders = { emitOrderStatus: jest.fn().mockResolvedValue(undefined) } as unknown as OrdersService;

  Object.assign(tx, {
    $queryRaw: jest.fn().mockImplementation(() => prisma.$queryRaw``),
    order: { ...tx.order, findUnique: jest.fn().mockImplementation(() => prisma.order.findUnique({where:{id:'order-1'}})), update: jest.fn() },
    orderOffer: {...tx.orderOffer, findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({data}) => ({...data,id:'offer-1'}))},
  });
  return {
    service: new MatchingService(prisma, queue, gateway, orders, new SequentialMatchingService(prisma, queue, gateway)),
    prisma,
    gateway: gateway as unknown as { emitToUser: jest.Mock },
  };
}

describe('MatchingService — коммерческий режим оффера', () => {
  it('для FREE_PILOT-заявки отправляет нулевую компенсацию независимо от текущего env', async () => {
    const { service, gateway } = setup('FREE_PILOT');

    await service.handleWave({ orderId: 'order-1', wave: 1 });

    expect(gateway.emitToUser).toHaveBeenCalledWith(
      'master-1',
      'offer:new',
      expect.objectContaining({
        orderId: 'order-1',
        compensation: 0,
        freePilot: true,
      }),
    );
  });

  it('для PAID_MOCK-заявки сохраняет рассчитанную компенсацию', async () => {
    const { service, gateway } = setup('PAID_MOCK');

    await service.handleWave({ orderId: 'order-1', wave: 1 });

    expect(gateway.emitToUser).toHaveBeenCalledWith(
      'master-1',
      'offer:new',
      expect.objectContaining({
        compensation: 1560,
        freePilot: false,
      }),
    );
  });

  it('не раскрывает точный адрес и детали доступа до принятия заявки', async () => {
    const { service, gateway } = setup('FREE_PILOT');

    await service.handleWave({ orderId: 'order-1', wave: 1 });

    const payload = gateway.emitToUser.mock.calls[0][2] as Record<string, unknown>;
    expect(payload).toEqual(
      expect.objectContaining({
        district: 'Есиль',
        description: 'Течёт кран',
        distanceKm: expect.any(Number),
      }),
    );
    expect(payload).not.toHaveProperty('address');
    expect(payload).not.toHaveProperty('entrance');
    expect(payload).not.toHaveProperty('floor');
    expect(payload).not.toHaveProperty('apartment');
    expect(payload).not.toHaveProperty('addressComment');
  });
});

describe('MatchingService direct dispatch contract', () => {
  it('sends one nearest-master offer with a 30-second server deadline', async () => {
    const {service,gateway,prisma}=setup('DIRECT_PAYMENT');
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{id:'master-1',meters:1200},{id:'master-2',meters:2200}]);
    const started=Date.now();
    await service.handleWave({orderId:'order-1',wave:1});
    const offers=gateway.emitToUser.mock.calls.filter(call=>call[1]==='offer:new');
    expect(offers).toHaveLength(1);
    expect(offers[0][0]).toBe('master-1');
    expect(new Date(offers[0][2].deadline).getTime()-started).toBeLessThan(31000);
    expect(offers[0][2]).toMatchObject({commercialMode:'DIRECT_PAYMENT',directPayment:true});
  });
});
