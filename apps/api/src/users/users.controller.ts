import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpdateMeDto } from './dto';

function toDto(user: User, masterProfile?: { blockedUntil: Date | null; status: string } | null) {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    defaultAddress: user.defaultAddress,
    role: user.role,
    masterProfile: masterProfile ? { blockedUntil: masterProfile.blockedUntil, status: masterProfile.status } : null,
  };
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  async me(@CurrentUser() user: User) {
    const masterProfile = await this.prisma.masterProfile.findUnique({
      where: { userId: user.id },
      select: { blockedUntil: true, status: true },
    });
    return toDto(user, masterProfile);
  }

  @Patch('me')
  async update(@CurrentUser() user: User, @Body() dto: UpdateMeDto) {
    const updated = await this.prisma.user.update({ where: { id: user.id }, data: dto });
    return toDto(updated);
  }
}
