import { CommercialModeService } from '../commercial-mode/commercial-mode.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { MatchingService } from './matching.service';
import { OrdersService } from './orders.service';

function setup(freePilot: boolean) {
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
        wave: 0,
        searchAttempt: 1,
        description: 'Течёт кран',
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
  const commercialMode = {
    isFreePilot: jest.fn().mockReturnValue(freePilot),
  } as unknown as CommercialModeService;

  return {
    service: new MatchingService(prisma, queue, gateway, orders, commercialMode),
    gateway: gateway as unknown as { emitToUser: jest.Mock },
  };
}

describe('MatchingService — коммерческий режим оффера', () => {
  it('в FREE_PILOT отправляет нулевую компенсацию и явный признак пилота', async () => {
    const { service, gateway } = setup(true);

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

  it('в платном режиме сохраняет рассчитанную компенсацию', async () => {
    const { service, gateway } = setup(false);

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
});
