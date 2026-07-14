import { BadRequestException, HttpException, Inject, Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SMS_SENDER, SmsSender } from '../sms/sms.interface';
import { normalizePhone } from '../common/phone';

const CODE_TTL_MS = 5 * 60_000;
const SEND_WINDOW_MS = 10 * 60_000;
const MAX_SENDS_PER_WINDOW = 3;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
  ) {}

  async requestCode(rawPhone: string): Promise<void> {
    const phone = normalizePhone(rawPhone);
    if (!phone) throw new BadRequestException('Неверный формат номера');

    const windowStart = new Date(Date.now() - SEND_WINDOW_MS);
    const recent = await this.prisma.smsCode.count({
      where: { phone, createdAt: { gte: windowStart } },
    });
    if (recent >= MAX_SENDS_PER_WINDOW) {
      throw new HttpException('Слишком много запросов кода, попробуйте позже', 429);
    }

    const code = randomInt(100000, 1000000).toString();
    await this.prisma.smsCode.create({
      data: { phone, code, expiresAt: new Date(Date.now() + CODE_TTL_MS) },
    });
    await this.sms.send(phone, `Ваш код подтверждения: ${code}`);
  }
}
