import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

/** `chargeCredits: false` — для FREE_PILOT-заявок: пилот не создаёт финансовых операций. */
export type PenaltyOptions = { chargeCredits?: boolean };

const PENALTY_CREDITS = 2;
const PRIORITY_PENALTY_MS = 24 * 3600 * 1000;
const CANCELLATION_WINDOW_MS = 30 * 24 * 3600 * 1000;
const CANCELLATION_BLOCK_THRESHOLD = 3;
const BLOCK_DURATION_MS = 7 * 24 * 3600 * 1000;

@Injectable()
export class MasterPenaltyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ядро: −2 кредита + отметка о понижении приоритета. Не знает про отмены/окно блокировки.
   *
   * ВНИМАНИЕ: `priorityPenaltyUntil` сейчас никем не читается. Приоритета внутри волны
   * не существует — она рассылается всем кандидатам одновременно, поэтому порядок
   * подбора ненаблюдаем. Поле пишется как след наказания на будущее; реально действуют
   * списание кредитов и `blockedUntil`. Подробности — docs/STATUS.md.
   */
  async applyPenalty(tx: Tx, masterUserId: string, options?: PenaltyOptions): Promise<void> {
    if (options?.chargeCredits ?? true) {
      await tx.leadCreditAccount.upsert({
        where: { masterUserId },
        create: { masterUserId, balance: -PENALTY_CREDITS },
        update: { balance: { decrement: PENALTY_CREDITS } },
      });
      await tx.leadCreditTransaction.create({
        data: { masterUserId, type: 'PENALTY', amount: -PENALTY_CREDITS },
      });
    }
    await tx.masterProfile.updateMany({
      where: { userId: masterUserId },
      data: { priorityPenaltyUntil: new Date(Date.now() + PRIORITY_PENALTY_MS) },
    });
  }

  /**
   * Отмена мастером: штраф + запись в окно блокировки + проверка 3-й за 30 дней.
   * Учёт отмен и блокировка действуют во всех режимах; кредиты не списываются
   * только при `chargeCredits: false` (FREE_PILOT-заявка).
   */
  async penalizeForCancellation(
    tx: Tx,
    masterUserId: string,
    orderType: 'URGENT' | 'PLANNED',
    orderId: string,
    options?: PenaltyOptions,
  ): Promise<void> {
    await this.applyPenalty(tx, masterUserId, options);
    await tx.masterCancellation.create({ data: { masterUserId, orderType, orderId } });

    const since = new Date(Date.now() - CANCELLATION_WINDOW_MS);
    const count = await tx.masterCancellation.count({
      where: { masterUserId, createdAt: { gte: since } },
    });
    if (count >= CANCELLATION_BLOCK_THRESHOLD) {
      await tx.masterProfile.updateMany({
        where: { userId: masterUserId },
        data: { blockedUntil: new Date(Date.now() + BLOCK_DURATION_MS) },
      });
    }
  }
}
