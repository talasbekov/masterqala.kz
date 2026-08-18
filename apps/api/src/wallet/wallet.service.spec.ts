import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { CommercialModeService } from '../commercial-mode/commercial-mode.service';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from '../payments/payment.interface';
import { WalletService } from './wallet.service';

describe('WalletService — ветка FAILED', () => {
  let service: WalletService;
  let prisma: {
    masterWalletAccount: { updateMany: jest.Mock; update: jest.Mock };
    withdrawalRequest: { create: jest.Mock; update: jest.Mock; findUniqueOrThrow: jest.Mock };
    masterProfile: { findUnique: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };
  let payments: jest.Mocked<Pick<PaymentProvider, 'payout'>>;

  beforeEach(async () => {
    prisma = {
      masterWalletAccount: { updateMany: jest.fn(), update: jest.fn() },
      withdrawalRequest: { create: jest.fn(), update: jest.fn(), findUniqueOrThrow: jest.fn() },
      masterProfile: { findUnique: jest.fn(), update: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    payments = { payout: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: prisma },
        { provide: PAYMENT_PROVIDER, useValue: payments },
        { provide: CommercialModeService, useValue: { payoutsEnabled: () => true } },
      ],
    }).compile();
    service = moduleRef.get(WalletService);
  });

  it('при FAILED от провайдера возвращает сумму на баланс и помечает FAILED', async () => {
    prisma.masterProfile.findUnique.mockResolvedValue({ payoutPhone: '+77011112233' });
    prisma.masterWalletAccount.updateMany.mockResolvedValue({ count: 1 });
    prisma.withdrawalRequest.create.mockResolvedValue({ id: 'w1', masterUserId: 'm1', amount: 7000, status: 'PENDING' });
    payments.payout.mockResolvedValue({ status: 'FAILED', providerRef: 'mock-fail-1' });
    prisma.withdrawalRequest.findUniqueOrThrow.mockResolvedValue({ id: 'w1', status: 'FAILED' });

    await service.request('m1', 7000);

    expect(prisma.withdrawalRequest.create).toHaveBeenCalledWith({
      data: { masterUserId: 'm1', amount: 7000, status: 'PENDING', payoutPhone: '+77011112233' },
    });
    expect(prisma.withdrawalRequest.update).toHaveBeenCalledWith({
      where: { id: 'w1' },
      data: { status: 'FAILED', providerRef: 'mock-fail-1', paidAt: null },
    });
    expect(prisma.masterWalletAccount.update).toHaveBeenCalledWith({
      where: { masterUserId: 'm1' },
      data: { balance: { increment: 7000 } },
    });
  });

  it('при исключении провайдера — баланс и статус не трогает, пробрасывает безопасную ошибку', async () => {
    prisma.masterProfile.findUnique.mockResolvedValue({ payoutPhone: '+77011112233' });
    prisma.masterWalletAccount.updateMany.mockResolvedValue({ count: 1 });
    prisma.withdrawalRequest.create.mockResolvedValue({ id: 'w1', masterUserId: 'm1', amount: 7000, status: 'PENDING' });
    payments.payout.mockRejectedValue(new Error('ECONNRESET: провайдер недоступен'));
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await expect(service.request('m1', 7000)).rejects.toThrow(ServiceUnavailableException);

    expect(prisma.withdrawalRequest.update).not.toHaveBeenCalled();
    expect(prisma.masterWalletAccount.update).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('w1'));
    errorSpy.mockRestore();
  });

  it('отклоняет заявку без реквизитов вывода — до провайдера дело не доходит', async () => {
    prisma.masterProfile.findUnique.mockResolvedValue({ payoutPhone: null });

    await expect(service.request('m1', 7000)).rejects.toThrow(ConflictException);

    expect(prisma.masterWalletAccount.updateMany).not.toHaveBeenCalled();
    expect(payments.payout).not.toHaveBeenCalled();
  });
});

describe('WalletService — реквизиты вывода', () => {
  let service: WalletService;
  let prisma: {
    masterProfile: { findUnique: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      masterProfile: { findUnique: jest.fn(), update: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: prisma },
        { provide: PAYMENT_PROVIDER, useValue: { payout: jest.fn() } },
        { provide: CommercialModeService, useValue: { payoutsEnabled: () => true } },
      ],
    }).compile();
    service = moduleRef.get(WalletService);
  });

  it('нормализует номер и сохраняет в MasterProfile', async () => {
    prisma.masterProfile.findUnique.mockResolvedValue({ id: 'p1', userId: 'm1' });

    const result = await service.setPayoutAccount('m1', '8 (701) 111-22-33');

    expect(result).toEqual({ payoutPhone: '+77011112233' });
    expect(prisma.masterProfile.update).toHaveBeenCalledWith({
      where: { userId: 'm1' },
      data: { payoutPhone: '+77011112233' },
    });
  });

  it('отклоняет некорректный номер', async () => {
    await expect(service.setPayoutAccount('m1', 'не телефон')).rejects.toThrow(BadRequestException);
    expect(prisma.masterProfile.update).not.toHaveBeenCalled();
  });

  it('отклоняет установку реквизитов у пользователя без профиля мастера', async () => {
    prisma.masterProfile.findUnique.mockResolvedValue(null);

    await expect(service.setPayoutAccount('c1', '+77011112233')).rejects.toThrow(ForbiddenException);
    expect(prisma.masterProfile.update).not.toHaveBeenCalled();
  });

  it('getPayoutAccount возвращает null для мастера без реквизитов', async () => {
    prisma.masterProfile.findUnique.mockResolvedValue({ payoutPhone: null });

    await expect(service.getPayoutAccount('m1')).resolves.toEqual({ payoutPhone: null });
  });
});
