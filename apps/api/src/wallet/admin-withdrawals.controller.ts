import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin/withdrawals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR')
export class AdminWithdrawalsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const rows = await this.prisma.withdrawalRequest.findMany({
      orderBy: { requestedAt: 'desc' },
      include: { master: { select: { phone: true } } },
    });
    return rows.map((r) => ({
      ...r,
      // Реквизиты выплаты (Kaspi-номер) — снимок на момент заявки, отдельно
      // от логин-телефона мастера. У заявок до этой фичи payoutPhone нет —
      // показываем как есть, не выдумываем задним числом.
      payoutPhone: r.payoutPhone ? r.payoutPhone.slice(-4) : null,
      master: { phone: r.master.phone.slice(-4) },
    }));
  }
}
