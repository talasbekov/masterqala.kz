import { Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from '../payments/payment.interface';

@Injectable()
export class WalletService {
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

    const result = await this.payments.payout(withdrawal.id, amount);

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
