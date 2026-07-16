import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from '../payments/payment.interface';
import { WalletService } from './wallet.service';

describe('WalletService — ветка FAILED', () => {
  let service: WalletService;
  let prisma: {
    masterWalletAccount: { updateMany: jest.Mock; update: jest.Mock };
    withdrawalRequest: { create: jest.Mock; update: jest.Mock; findUniqueOrThrow: jest.Mock };
    $transaction: jest.Mock;
  };
  let payments: jest.Mocked<Pick<PaymentProvider, 'payout'>>;

  beforeEach(async () => {
    prisma = {
      masterWalletAccount: { updateMany: jest.fn(), update: jest.fn() },
      withdrawalRequest: { create: jest.fn(), update: jest.fn(), findUniqueOrThrow: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    payments = { payout: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: prisma },
        { provide: PAYMENT_PROVIDER, useValue: payments },
      ],
    }).compile();
    service = moduleRef.get(WalletService);
  });

  it('при FAILED от провайдера возвращает сумму на баланс и помечает FAILED', async () => {
    prisma.masterWalletAccount.updateMany.mockResolvedValue({ count: 1 });
    prisma.withdrawalRequest.create.mockResolvedValue({ id: 'w1', masterUserId: 'm1', amount: 7000, status: 'PENDING' });
    payments.payout.mockResolvedValue({ status: 'FAILED', providerRef: 'mock-fail-1' });
    prisma.withdrawalRequest.findUniqueOrThrow.mockResolvedValue({ id: 'w1', status: 'FAILED' });

    await service.request('m1', 7000);

    expect(prisma.withdrawalRequest.update).toHaveBeenCalledWith({
      where: { id: 'w1' },
      data: { status: 'FAILED', providerRef: 'mock-fail-1', paidAt: null },
    });
    expect(prisma.masterWalletAccount.update).toHaveBeenCalledWith({
      where: { masterUserId: 'm1' },
      data: { balance: { increment: 7000 } },
    });
  });
});
