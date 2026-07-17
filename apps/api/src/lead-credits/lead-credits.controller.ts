import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { LeadCreditsService } from './lead-credits.service';
import { LEAD_CREDIT_PACKAGES } from './lead-credits.config';
import { PurchaseLeadCreditsDto } from './dto';

@Controller('lead-credits')
@UseGuards(JwtAuthGuard)
export class LeadCreditsController {
  constructor(private readonly leadCredits: LeadCreditsService) {}

  @Get('balance')
  async balance(@CurrentUser() user: User) {
    return { balance: await this.leadCredits.getBalance(user.id) };
  }

  @Get('packages')
  packages() {
    return LEAD_CREDIT_PACKAGES;
  }

  @Post('purchase')
  purchase(@CurrentUser() user: User, @Body() dto: PurchaseLeadCreditsDto) {
    return this.leadCredits.purchase(user.id, dto.package);
  }
}
