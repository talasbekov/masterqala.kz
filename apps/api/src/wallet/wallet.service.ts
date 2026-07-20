import { Inject, Injectable, Logger, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from '../payments/payment.interface';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
  ) {}

  async getBalance(masterUserId: string): Promise<number> {
    const acc = await this.prisma.masterWalletAccount.findUnique({ where: { masterUserId } });
    return acc?.balance ?? 0;
  }

  listMine(masterUserId: string) {
    return this.prisma.withdrawalRequest.findMany({
      where: { masterUserId },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async request(masterUserId: string, amount: number) {
    const withdrawal = await this.prisma.$transaction(async (tx) => {
      const spent = await tx.masterWalletAccount.updateMany({
        where: { masterUserId, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      if (spent.count === 0) throw new UnprocessableEntityException('Недостаточно средств на балансе');
      return tx.withdrawalRequest.create({ data: { masterUserId, amount, status: 'PENDING' } });
    });

    // Исход неизвестен при исключении провайдера (таймаут/недоступность) — деньги могли
    // реально уйти. Баланс/статус здесь намеренно НЕ трогаем (остаются как после TX1:
    // списан/PENDING), чтобы не рисковать двойной выплатой при повторном запросе —
    // только громкий лог для ручной сверки оператором по выписке Kaspi.
    let result: Awaited<ReturnType<PaymentProvider['payout']>>;
    try {
      result = await this.payments.payout(withdrawal.id, amount);
    } catch (e) {
      this.logger.error(
        `payout() упал для withdrawalId=${withdrawal.id} masterUserId=${masterUserId} amount=${amount}: ${(e as Error).message}`,
      );
      throw new ServiceUnavailableException('Не удалось обработать выплату, обратитесь в поддержку');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.withdrawalRequest.update({
        where: { id: withdrawal.id },
        data: {
          status: result.status === 'SUCCEEDED' ? 'PAID' : 'FAILED',
          providerRef: result.providerRef,
          paidAt: result.status === 'SUCCEEDED' ? new Date() : null,
        },
      });
      if (result.status !== 'SUCCEEDED') {
        await tx.masterWalletAccount.update({
          where: { masterUserId },
          data: { balance: { increment: amount } },
        });
      }
      return tx.withdrawalRequest.findUniqueOrThrow({ where: { id: withdrawal.id } });
    });
  }
}
