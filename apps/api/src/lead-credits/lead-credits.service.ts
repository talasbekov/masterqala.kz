import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { CommercialModeService } from '../commercial-mode/commercial-mode.service';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from '../payments/payment.interface';
import { LEAD_CREDIT_PACKAGES } from './lead-credits.config';

@Injectable()
export class LeadCreditsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
    private readonly commercialMode: CommercialModeService,
  ) {}

  async getBalance(masterUserId: string): Promise<number> {
    if (!this.commercialMode.leadCreditsEnabled()) return 0;
    const acc = await this.prisma.leadCreditAccount.findUnique({ where: { masterUserId } });
    return acc?.balance ?? 0;
  }

  async purchase(masterUserId: string, packageId: string): Promise<{ masterUserId: string; balance: number }> {
    if (!this.commercialMode.leadCreditsEnabled()) {
      throw new ForbiddenException('Покупка lead-кредитов недоступна в бесплатном пилоте');
    }

    const pkg = LEAD_CREDIT_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) throw new BadRequestException('Неизвестный пакет кредитов');

    const purchase = await this.prisma.leadCreditPurchase.create({
      data: { masterUserId, credits: pkg.credits, priceTenge: pkg.priceTenge, status: 'PENDING', providerRef: '' },
    });
    const result = await this.payments.charge(purchase.id, pkg.priceTenge);

    return this.prisma.$transaction(async (tx) => {
      await tx.leadCreditPurchase.update({
        where: { id: purchase.id },
        data: { status: result.status, providerRef: result.providerRef },
      });
      if (result.status === 'SUCCEEDED') {
        await tx.leadCreditAccount.upsert({
          where: { masterUserId },
          create: { masterUserId, balance: pkg.credits },
          update: { balance: { increment: pkg.credits } },
        });
        await tx.leadCreditTransaction.create({
          data: { masterUserId, type: 'PURCHASE', amount: pkg.credits, purchaseId: purchase.id },
        });
      }
      const acc = await tx.leadCreditAccount.findUnique({ where: { masterUserId } });
      return { masterUserId, balance: acc?.balance ?? 0 };
    });
  }
}
