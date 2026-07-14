import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpdateMeDto } from './dto';

function toDto(user: User) {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    defaultAddress: user.defaultAddress,
    role: user.role,
  };
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  me(@CurrentUser() user: User) {
    return toDto(user);
  }

  @Patch('me')
  async update(@CurrentUser() user: User, @Body() dto: UpdateMeDto) {
    const updated = await this.prisma.user.update({ where: { id: user.id }, data: dto });
    return toDto(updated);
  }
}
