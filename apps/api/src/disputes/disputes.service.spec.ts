import { Test } from '@nestjs/testing';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from '../payments/payment.interface';
import { FILE_STORAGE } from '../storage/storage.interface';
import { PersistentFileScansService } from '../storage/persistent-file-scans.service';
import { MasterPenaltyService } from '../common/master-penalty.service';
import { CompensationService } from '../common/compensation.service';
import { AuditLogService } from '../audit-log/audit-log.service';
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
        { provide: PersistentFileScansService, useValue: { enqueueDisputeEvidence: jest.fn() } },
        { provide: PAYMENT_PROVIDER, useValue: payments },
        { provide: MasterPenaltyService, useValue: { applyPenalty: jest.fn() } },
        { provide: CompensationService, useValue: { accrueCallout: jest.fn() } },
        { provide: AuditLogService, useValue: { write: jest.fn() } },
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

  it('does not accept direct-payment work on behalf of the client when resolving support',async()=>{
    prisma.dispute.findUnique.mockResolvedValue({id:'d3',orderId:'o3',plannedOrderId:null,status:'OPEN'});
    prisma.dispute.updateMany.mockResolvedValue({count:1});
    prisma.order.findUniqueOrThrow.mockResolvedValue({id:'o3',masterId:'m3',status:'DONE',commercialMode:'DIRECT_PAYMENT',lifecycleVersion:2,serviceFee:0});
    await service.resolve('op1','d3',{refundServiceFee:false,penalizeMaster:false,resolutionNote:'Support note'});
    expect(prisma.order.updateMany).not.toHaveBeenCalled();expect(payments.refund).not.toHaveBeenCalled();
  });
  it('rejects unapproved financial dispute actions for direct-payment orders',async()=>{
    prisma.dispute.updateMany.mockResolvedValue({count:1});
    prisma.dispute.findUnique.mockResolvedValue({id:'d3',orderId:'o3',plannedOrderId:null,status:'OPEN'});
    prisma.order.findUniqueOrThrow.mockResolvedValue({commercialMode:'DIRECT_PAYMENT',lifecycleVersion:2,serviceFee:0});
    await expect(service.resolve('op1','d3',{refundServiceFee:true,penalizeMaster:true,resolutionNote:'Refund'})).rejects.toMatchObject({status:409});
    expect(prisma.dispute.updateMany).not.toHaveBeenCalled();expect(payments.refund).not.toHaveBeenCalled();
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
