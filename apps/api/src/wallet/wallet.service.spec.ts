import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CommercialModeService } from '../commercial-mode/commercial-mode.service';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from '../payments/payment.interface';
import { AuditLogService } from '../audit-log/audit-log.service';
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
  let auditLog: { write: jest.Mock };

  beforeEach(async () => {
    prisma = {
      masterWalletAccount: { updateMany: jest.fn(), update: jest.fn() },
      withdrawalRequest: { create: jest.fn(), update: jest.fn(), findUniqueOrThrow: jest.fn() },
      masterProfile: { findUnique: jest.fn(), update: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    payments = { payout: jest.fn() };
    auditLog = { write: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: prisma },
        { provide: PAYMENT_PROVIDER, useValue: payments },
        { provide: CommercialModeService, useValue: { payoutsEnabled: () => true } },
        { provide: AuditLogService, useValue: auditLog },
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

  it('при исключении провайдера — переводит в ERROR с текстом ошибки, баланс не трогает', async () => {
    prisma.masterProfile.findUnique.mockResolvedValue({ payoutPhone: '+77011112233' });
    prisma.masterWalletAccount.updateMany.mockResolvedValue({ count: 1 });
    prisma.withdrawalRequest.create.mockResolvedValue({ id: 'w1', masterUserId: 'm1', amount: 7000, status: 'PENDING' });
    payments.payout.mockRejectedValue(new Error('ECONNRESET: провайдер недоступен'));
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await expect(service.request('m1', 7000)).rejects.toThrow(ServiceUnavailableException);

    // ERROR — намеренно не PENDING: заявка не должна тихо висеть без следа,
    // оператор обязан увидеть её как требующую ручной сверки.
    expect(prisma.withdrawalRequest.update).toHaveBeenCalledWith({
      where: { id: 'w1' },
      data: { status: 'ERROR', errorMessage: 'ECONNRESET: провайдер недоступен' },
    });
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
        { provide: AuditLogService, useValue: { write: jest.fn() } },
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

describe('WalletService — ручная сверка ERROR', () => {
  let service: WalletService;
  let prisma: {
    withdrawalRequest: { findUnique: jest.Mock; update: jest.Mock; findUniqueOrThrow: jest.Mock };
    masterWalletAccount: { update: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditLog: { write: jest.Mock };

  beforeEach(async () => {
    prisma = {
      withdrawalRequest: { findUnique: jest.fn(), update: jest.fn(), findUniqueOrThrow: jest.fn() },
      masterWalletAccount: { update: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    auditLog = { write: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: prisma },
        { provide: PAYMENT_PROVIDER, useValue: { payout: jest.fn() } },
        { provide: CommercialModeService, useValue: { payoutsEnabled: () => true } },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();
    service = moduleRef.get(WalletService);
  });

  it('outcome=PAID: помечает PAID, баланс не трогает (уже списан), пишет аудит', async () => {
    prisma.withdrawalRequest.findUnique.mockResolvedValue({
      id: 'w1',
      masterUserId: 'm1',
      amount: 7000,
      status: 'ERROR',
      providerRef: null,
    });
    prisma.withdrawalRequest.findUniqueOrThrow.mockResolvedValue({ id: 'w1', status: 'PAID' });

    await service.resolveError('op1', 'w1', { outcome: 'PAID', reference: 'kaspi-stmt-42', note: 'сверено по выписке' });

    expect(prisma.withdrawalRequest.update).toHaveBeenCalledWith({
      where: { id: 'w1' },
      data: { status: 'PAID', paidAt: expect.any(Date), providerRef: 'kaspi-stmt-42' },
    });
    expect(prisma.masterWalletAccount.update).not.toHaveBeenCalled();
    expect(auditLog.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'OPERATOR',
        actorId: 'op1',
        action: 'WITHDRAWAL_RESOLVED_PAID',
        targetType: 'WITHDRAWAL',
        targetId: 'w1',
        comment: 'сверено по выписке',
      }),
      prisma,
    );
  });

  it('outcome=FAILED: помечает FAILED и возвращает сумму на баланс', async () => {
    prisma.withdrawalRequest.findUnique.mockResolvedValue({
      id: 'w1',
      masterUserId: 'm1',
      amount: 7000,
      status: 'ERROR',
      providerRef: null,
    });
    prisma.withdrawalRequest.findUniqueOrThrow.mockResolvedValue({ id: 'w1', status: 'FAILED' });

    await service.resolveError('op1', 'w1', { outcome: 'FAILED', note: 'платёж не найден в выписке' });

    expect(prisma.withdrawalRequest.update).toHaveBeenCalledWith({ where: { id: 'w1' }, data: { status: 'FAILED' } });
    expect(prisma.masterWalletAccount.update).toHaveBeenCalledWith({
      where: { masterUserId: 'm1' },
      data: { balance: { increment: 7000 } },
    });
  });

  it('заявка не в ERROR — 409, ничего не меняет', async () => {
    prisma.withdrawalRequest.findUnique.mockResolvedValue({ id: 'w1', status: 'PAID' });

    await expect(
      service.resolveError('op1', 'w1', { outcome: 'PAID', note: 'x' }),
    ).rejects.toThrow(ConflictException);

    expect(prisma.withdrawalRequest.update).not.toHaveBeenCalled();
    expect(prisma.masterWalletAccount.update).not.toHaveBeenCalled();
  });

  it('заявка не найдена — 404', async () => {
    prisma.withdrawalRequest.findUnique.mockResolvedValue(null);

    await expect(
      service.resolveError('op1', 'missing', { outcome: 'PAID', note: 'x' }),
    ).rejects.toThrow(NotFoundException);
  });
});
