import { BadRequestException, HttpException, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SMS_SENDER, SmsSender } from '../sms/sms.interface';
import { normalizePhone } from '../common/phone';

const CODE_TTL_MS = 5 * 60_000;
const SEND_WINDOW_MS = 10 * 60_000;
const MAX_SENDS_PER_WINDOW = 3;
const MAX_VERIFY_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
    private readonly jwt: JwtService,
  ) {}

  async requestCode(rawPhone: string): Promise<void> {
    const phone = normalizePhone(rawPhone);
    if (!phone) throw new BadRequestException('Неверный формат номера');

    const code = randomInt(100000, 1000000).toString();

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${phone}))`;
      const windowStart = new Date(Date.now() - SEND_WINDOW_MS);
      const recent = await tx.smsCode.count({
        where: { phone, createdAt: { gte: windowStart } },
      });
      if (recent >= MAX_SENDS_PER_WINDOW) {
        throw new HttpException('Слишком много запросов кода, попробуйте позже', 429);
      }
      await tx.smsCode.create({
        data: { phone, code, expiresAt: new Date(Date.now() + CODE_TTL_MS) },
      });
    });
    await this.sms.send(phone, `Ваш код подтверждения: ${code}`);
  }

  async verifyCode(rawPhone: string, code: string) {
    const phone = normalizePhone(rawPhone);
    if (!phone) throw new BadRequestException('Неверный формат номера');

    const record = await this.prisma.smsCode.findFirst({
      where: { phone, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record || record.attempts >= MAX_VERIFY_ATTEMPTS) {
      throw new BadRequestException('Код не найден или истёк');
    }
    if (record.code !== code) {
      await this.prisma.smsCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Неверный код');
    }
    await this.prisma.smsCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });

    const user = await this.prisma.user.upsert({ where: { phone }, create: { phone }, update: {} });
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return {
      accessToken,
      user: { id: user.id, phone: user.phone, name: user.name, role: user.role },
    };
  }
}
