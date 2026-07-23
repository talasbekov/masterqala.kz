import { Injectable } from '@nestjs/common';
import { Order, Prisma } from '@prisma/client';
import { CommercialModeService } from '../commercial-mode/commercial-mode.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class CompensationService {
  constructor(private readonly commercialMode: CommercialModeService) {}

  /** Начисление компенсации мастеру за выполненный вызов; идемпотентно за счёт unique(orderId) на Accrual. */
  async accrueCallout(tx: Tx, order: Order): Promise<void> {
    if (!this.commercialMode.payoutsEnabled() || !order.masterId) return;
    const amount = order.calloutPrice - order.serviceFee;
    const res = await tx.accrual.createMany({
      data: [
        {
          masterUserId: order.masterId,
          orderId: order.id,
          type: 'CALLOUT_COMPENSATION',
          amount,
        },
      ],
      skipDuplicates: true,
    });
    if (res.count > 0) {
      await tx.masterWalletAccount.upsert({
        where: { masterUserId: order.masterId },
        create: { masterUserId: order.masterId, balance: amount },
        update: { balance: { increment: amount } },
      });
    }
  }
}
