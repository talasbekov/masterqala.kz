import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CommercialModeService } from '../commercial-mode/commercial-mode.service';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from '../payments/payment.interface';
import { normalizePhone } from '../common/phone';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
    private readonly commercialMode: CommercialModeService,
  ) {}

  async getBalance(masterUserId: string): Promise<number> {
    if (!this.commercialMode.payoutsEnabled()) return 0;
    const acc = await this.prisma.masterWalletAccount.findUnique({ where: { masterUserId } });
    return acc?.balance ?? 0;
  }

  async listMine(masterUserId: string) {
    if (!this.commercialMode.payoutsEnabled()) return [];
    return this.prisma.withdrawalRequest.findMany({
      where: { masterUserId },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async getPayoutAccount(masterUserId: string): Promise<{ payoutPhone: string | null }> {
    const profile = await this.prisma.masterProfile.findUnique({
      where: { userId: masterUserId },
      select: { payoutPhone: true },
    });
    return { payoutPhone: profile?.payoutPhone ?? null };
  }

  async setPayoutAccount(masterUserId: string, rawPhone: string): Promise<{ payoutPhone: string }> {
    const payoutPhone = normalizePhone(rawPhone);
    if (!payoutPhone) throw new BadRequestException('Некорректный номер телефона');

    const profile = await this.prisma.masterProfile.findUnique({ where: { userId: masterUserId } });
    if (!profile) throw new ForbiddenException('Реквизиты вывода доступны только мастерам');

    await this.prisma.masterProfile.update({ where: { userId: masterUserId }, data: { payoutPhone } });
    return { payoutPhone };
  }

  async request(masterUserId: string, amount: number) {
    if (!this.commercialMode.payoutsEnabled()) {
      throw new ForbiddenException('Вывод средств недоступен в бесплатном пилоте');
    }

    // §3.12 шаг 2: заявка на вывод требует подтверждённых реквизитов —
    // без них payout() провайдеру физически некуда платить.
    const profile = await this.prisma.masterProfile.findUnique({
      where: { userId: masterUserId },
      select: { payoutPhone: true },
    });
    if (!profile?.payoutPhone) {
      throw new ConflictException(
        'Не указаны реквизиты вывода — укажите Kaspi-номер в настройках кошелька',
      );
    }
    const payoutPhone = profile.payoutPhone;

    const withdrawal = await this.prisma.$transaction(async (tx) => {
      const spent = await tx.masterWalletAccount.updateMany({
        where: { masterUserId, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      if (spent.count === 0) throw new UnprocessableEntityException('Недостаточно средств на балансе');
      // Снимок текущего payoutPhone — история выплат не должна переписываться
      // задним числом, если мастер сменит реквизиты после отправки заявки.
      return tx.withdrawalRequest.create({ data: { masterUserId, amount, status: 'PENDING', payoutPhone } });
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
