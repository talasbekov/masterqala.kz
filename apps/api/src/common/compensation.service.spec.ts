import { Order, Prisma } from '@prisma/client';
import { CompensationService } from './compensation.service';

function order(commercialMode: 'FREE_PILOT' | 'PAID_MOCK'): Order {
  return {
    id: 'order-1',
    masterId: 'master-1',
    commercialMode,
    calloutPrice: 2600,
    serviceFee: 1040,
  } as Order;
}

function tx() {
  return {
    accrual: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    masterWalletAccount: { upsert: jest.fn().mockResolvedValue({}) },
  } as unknown as Prisma.TransactionClient;
}

describe('CompensationService', () => {
  const service = new CompensationService();

  it('не создаёт начисление для FREE_PILOT-заявки', async () => {
    const client = tx();

    await service.accrueCallout(client, order('FREE_PILOT'));

    expect(client.accrual.createMany).not.toHaveBeenCalled();
    expect(client.masterWalletAccount.upsert).not.toHaveBeenCalled();
  });

  it('начисляет компенсацию для PAID_MOCK-заявки', async () => {
    const client = tx();

    await service.accrueCallout(client, order('PAID_MOCK'));

    expect(client.accrual.createMany).toHaveBeenCalledWith({
      data: [
        {
          masterUserId: 'master-1',
          orderId: 'order-1',
          type: 'CALLOUT_COMPENSATION',
          amount: 1560,
        },
      ],
      skipDuplicates: true,
    });
    expect(client.masterWalletAccount.upsert).toHaveBeenCalled();
  });
});
