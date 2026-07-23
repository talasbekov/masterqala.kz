import { User } from '@prisma/client';
import { CommercialModeService } from '../commercial-mode/commercial-mode.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PlannedOrdersCommercialService } from './planned-orders-commercial.service';
import { PlannedOrdersService } from './planned-orders.service';

function setup(leadCreditsEnabled: boolean) {
  const tx = {
    plannedOrder: { findUnique: jest.fn() },
    masterProfile: { findUnique: jest.fn() },
    plannedOrderBid: { count: jest.fn(), create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    plannedOrderBid: { findFirstOrThrow: jest.fn() },
  } as unknown as PrismaService;
  const gateway = { emitToUser: jest.fn() } as unknown as RealtimeGateway;
  const commercialMode = {
    leadCreditsEnabled: jest.fn().mockReturnValue(leadCreditsEnabled),
  } as unknown as CommercialModeService;
  const plannedOrders = {
    placeBid: jest.fn(),
    cancel: jest.fn(),
    findOrThrow: jest.fn(),
    gate: jest.fn(),
    emitPlannedStatus: jest.fn(),
  } as unknown as PlannedOrdersService;

  return {
    service: new PlannedOrdersCommercialService(prisma, gateway, commercialMode, plannedOrders),
    tx,
    prisma: prisma as unknown as {
      plannedOrderBid: { findFirstOrThrow: jest.Mock };
    },
    gateway: gateway as unknown as { emitToUser: jest.Mock },
    plannedOrders: plannedOrders as unknown as {
      placeBid: jest.Mock;
      cancel: jest.Mock;
      findOrThrow: jest.Mock;
      gate: jest.Mock;
      emitPlannedStatus: jest.Mock;
    },
  };
}

describe('PlannedOrdersCommercialService', () => {
  it('создаёт отклик в FREE_PILOT без обращения к lead-credit таблицам', async () => {
    const { service, tx, prisma, gateway, plannedOrders } = setup(false);
    const bid = { id: 'bid-1', plannedOrderId: 'planned-1', masterUserId: 'master-1' };
    tx.plannedOrder.findUnique.mockResolvedValue({ id: 'planned-1', clientId: 'client-1', status: 'PUBLISHED' });
    tx.masterProfile.findUnique.mockResolvedValue({ blockedUntil: null });
    tx.plannedOrderBid.count.mockResolvedValue(0);
    tx.plannedOrderBid.create.mockResolvedValue(bid);
    prisma.plannedOrderBid.findFirstOrThrow.mockResolvedValue(bid);

    await expect(
      service.placeBid('master-1', 'planned-1', { price: 15000, term: '1 день', comment: 'Готов выполнить' }),
    ).resolves.toEqual(bid);

    expect(plannedOrders.placeBid).not.toHaveBeenCalled();
    expect(tx.plannedOrderBid.create).toHaveBeenCalledWith({
      data: {
        plannedOrderId: 'planned-1',
        masterUserId: 'master-1',
        price: 15000,
        term: '1 день',
        comment: 'Готов выполнить',
      },
    });
    expect(gateway.emitToUser).toHaveBeenCalledWith('client-1', 'bid:new', {
      plannedOrderId: 'planned-1',
      bidsCount: 1,
    });
  });

  it('делегирует платный отклик существующему сервису', async () => {
    const { service, plannedOrders } = setup(true);
    const bid = { id: 'paid-bid' };
    plannedOrders.placeBid.mockResolvedValue(bid);

    await expect(service.placeBid('master-1', 'planned-1', { price: 10000, term: '2 дня' })).resolves.toBe(bid);
    expect(plannedOrders.placeBid).toHaveBeenCalledWith('master-1', 'planned-1', {
      price: 10000,
      term: '2 дня',
    });
  });

  it('отменяет выбранную клиентом заявку без REFUND-операции в FREE_PILOT', async () => {
    const { service, plannedOrders } = setup(false);
    const user = { id: 'client-1' } as User;
    const selected = {
      id: 'planned-1',
      clientId: user.id,
      masterId: 'master-1',
      status: 'MASTER_SELECTED',
    };
    const cancelled = { ...selected, status: 'CANCELLED_BY_CLIENT' };
    plannedOrders.findOrThrow.mockResolvedValueOnce(selected).mockResolvedValueOnce(cancelled);

    await expect(service.cancel(user, selected.id)).resolves.toEqual(cancelled);

    expect(plannedOrders.cancel).not.toHaveBeenCalled();
    expect(plannedOrders.gate).toHaveBeenCalledWith(
      selected.id,
      ['MASTER_SELECTED', 'CONFIRMED', 'IN_PROGRESS'],
      {
        status: 'CANCELLED_BY_CLIENT',
        cancelReason: 'Отменена клиентом после выбора мастера',
      },
    );
    expect(plannedOrders.emitPlannedStatus).toHaveBeenCalledWith(selected.id);
  });
});
