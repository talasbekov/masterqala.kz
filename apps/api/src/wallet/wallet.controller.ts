import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { WalletService } from './wallet.service';
import { CreateWithdrawalDto } from './dto';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('balance')
  async balance(@CurrentUser() user: User) {
    return { balance: await this.wallet.getBalance(user.id) };
  }

  @Get('withdrawals')
  listMine(@CurrentUser() user: User) {
    return this.wallet.listMine(user.id);
  }

  @Post('withdrawals')
  request(@CurrentUser() user: User, @Body() dto: CreateWithdrawalDto) {
    return this.wallet.request(user.id, dto.amount);
  }
}
