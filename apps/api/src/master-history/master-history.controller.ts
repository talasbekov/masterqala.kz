import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MasterHistoryService } from './master-history.service';

@Controller('master/orders')
@UseGuards(JwtAuthGuard)
export class MasterHistoryController {
  constructor(private readonly history: MasterHistoryService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@CurrentUser() user: User, @Query() query: Record<string, unknown>) {
    return this.history.list(user.id, query);
  }
}
