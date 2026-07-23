import { Test } from '@nestjs/testing';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from '../payments/payment.interface';
import { FILE_STORAGE } from '../storage/storage.interface';
import { MasterPenaltyService } from '../common/master-penalty.service';
import { CompensationService } from '../common/compensation.service';
import { DisputesService } from './disputes.service';

describe('DisputesService.resolve — коммерческий режим возврата', () => {
  let service: DisputesService;
  let prisma: {
    dispute: { findUnique: jest.Mock; updateMany: jest.Mock };
    order: { findUniqueOrThrow: jest.Mock; updateMany: jest.Mock };
    plannedOrder: { findUniqueOrThrow: jest.Mock; updateMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let payments: jest.Mocked<Pick<PaymentProvider, 'refund'>>;

  beforeEach(async () => {
    prisma = {
      dispute: { findUnique: jest.fn(), updateMany: jest.fn() },
      order: { findUniqueOrThrow: jest.fn(), updateMany: jest.fn() },
      plannedOrder: { findUniqueOrThrow: jest.fn(), updateMany: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    payments = { refund: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DisputesService,
        { provide: PrismaService, useValue: prisma },
        { provide: FILE_STORAGE, useValue: {} },
        { provide: PAYMENT_PROVIDER, useValue: payments },
        { provide: MasterPenaltyService, useValue: { applyPenalty: jest.fn() } },
        { provide: CompensationService, useValue: { accrueCallout: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(DisputesService);
  });

  it('если refund() платной заявки падает — пробрасывает безопасную ошибку после сохранения резолюции', async () => {
    prisma.dispute.findUnique.mockResolvedValue({ id: 'd1', orderId: 'o1', plannedOrderId: null, status: 'OPEN' });
    prisma.dispute.updateMany.mockResolvedValue({ count: 1 });
    prisma.order.findUniqueOrThrow.mockResolvedValue({
      id: 'o1',
      masterId: null,
      status: 'CLOSED',
      commercialMode: 'PAID_MOCK',
      serviceFee: 1200,
    });
    payments.refund.mockRejectedValue(new Error('провайдер недоступен'));
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await expect(
      service.resolve('op1', 'd1', { refundServiceFee: true, penalizeMaster: false, resolutionNote: 'тест' }),
    ).rejects.toThrow(ServiceUnavailableException);

    expect(payments.refund).toHaveBeenCalledWith('o1', 1200);
    expect(prisma.dispute.updateMany).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('d1'));
    errorSpy.mockRestore();
  });

  it('для FREE_PILOT сохраняет refundServiceFee=false и не вызывает провайдер', async () => {
    prisma.dispute.findUnique
      .mockResolvedValueOnce({ id: 'd2', orderId: 'o2', plannedOrderId: null, status: 'OPEN' })
      .mockResolvedValueOnce({ id: 'd2', orderId: 'o2', plannedOrderId: null, status: 'RESOLVED', refundServiceFee: false });
    prisma.dispute.updateMany.mockResolvedValue({ count: 1 });
    prisma.order.findUniqueOrThrow.mockResolvedValue({
      id: 'o2',
      masterId: null,
      status: 'CLOSED',
      commercialMode: 'FREE_PILOT',
      serviceFee: 1200,
    });

    await expect(
      service.resolve('op1', 'd2', { refundServiceFee: true, penalizeMaster: false, resolutionNote: 'пилот' }),
    ).resolves.toMatchObject({ refundServiceFee: false });

    expect(prisma.dispute.updateMany).toHaveBeenCalledWith({
      where: { id: 'd2', status: 'OPEN' },
      data: expect.objectContaining({ refundServiceFee: false }),
    });
    expect(payments.refund).not.toHaveBeenCalled();
  });
});
