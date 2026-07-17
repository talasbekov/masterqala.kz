import { Injectable } from '@nestjs/common';
import { Order, Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

@Injectable()
export class CompensationService {
  /** Начисление компенсации мастеру за выполненный вызов; идемпотентно за счёт unique(orderId) на Accrual. */
  async accrueCallout(tx: Tx, order: Order): Promise<void> {
    if (!order.masterId) return;
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
