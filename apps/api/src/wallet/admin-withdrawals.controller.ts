import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { User, WithdrawalRequest } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from './wallet.service';
import { ResolveWithdrawalDto } from './dto';

const WITHDRAWAL_WITH_MASTER_PHONE = { include: { master: { select: { phone: true } } } } as const;

@Controller('admin/withdrawals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR')
export class AdminWithdrawalsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  // Реквизиты выплаты (Kaspi-номер) — снимок на момент заявки, отдельно от
  // логин-телефона мастера. У заявок до этой фичи payoutPhone нет — показываем
  // как есть, не выдумываем задним числом. И list(), и resolve() обязаны
  // проходить через эту маску — иначе полный номер утечёт в ответ на resolve,
  // хотя list() его прячет (ровно так уже случалось: resolveError() у
  // WalletService возвращает сырую строку из Prisma).
  private mask(row: WithdrawalRequest & { master: { phone: string } }) {
    return {
      ...row,
      payoutPhone: row.payoutPhone ? row.payoutPhone.slice(-4) : null,
      master: { phone: row.master.phone.slice(-4) },
    };
  }

  @Get()
  async list() {
    const rows = await this.prisma.withdrawalRequest.findMany({
      orderBy: { requestedAt: 'desc' },
      ...WITHDRAWAL_WITH_MASTER_PHONE,
    });
    return rows.map((r) => this.mask(r));
  }

  @Post(':id/resolve')
  async resolve(@CurrentUser() operator: User, @Param('id') id: string, @Body() dto: ResolveWithdrawalDto) {
    await this.wallet.resolveError(operator.id, id, dto);
    const updated = await this.prisma.withdrawalRequest.findUniqueOrThrow({
      where: { id },
      ...WITHDRAWAL_WITH_MASTER_PHONE,
    });
    return this.mask(updated);
  }
}
