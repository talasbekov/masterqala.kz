import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { MastersService } from './masters.service';
import { SubmitApplicationDto } from './dto';

@Controller()
export class MastersController {
  constructor(
    private readonly masters: MastersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('categories')
  listCategories() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  @Post('masters/application')
  @UseGuards(JwtAuthGuard)
  submit(@CurrentUser() user: User, @Body() dto: SubmitApplicationDto) {
    return this.masters.submitApplication(user.id, dto);
  }

  @Get('masters/application')
  @UseGuards(JwtAuthGuard)
  getOwn(@CurrentUser() user: User) {
    return this.masters.getOwnApplication(user.id);
  }
}
