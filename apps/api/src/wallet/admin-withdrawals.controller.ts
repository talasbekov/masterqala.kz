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
      master: { phone: r.master.phone.slice(-4) },
    }));
  }
}
