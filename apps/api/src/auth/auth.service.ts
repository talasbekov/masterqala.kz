import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { AccessTokenService } from './access-token.service';
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
    private readonly tokens: AccessTokenService,
  ) {}

  async requestCode(rawPhone: string): Promise<void> {
    const phone = normalizePhone(rawPhone);
    if (!phone) throw new BadRequestException('Неверный формат номера');

    const code = randomInt(100000, 1000000).toString();

    await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${phone}))`;
        const [{ now }] = await tx.$queryRaw<
          { now: Date }[]
        >`SELECT clock_timestamp() AS now`;
        const windowStart = new Date(now.getTime() - SEND_WINDOW_MS);
        const recent = await tx.smsCode.count({
          where: { phone, createdAt: { gte: windowStart } },
        });
        if (recent >= MAX_SENDS_PER_WINDOW) {
          throw new HttpException(
            'Слишком много запросов кода, попробуйте позже',
            429,
          );
        }
        await tx.smsCode.create({
          data: {
            phone,
            code,
            createdAt: now,
            expiresAt: new Date(now.getTime() + CODE_TTL_MS),
          },
        });
      },
      { isolationLevel: 'ReadCommitted' },
    );
    await this.sms.send(phone, `Ваш код подтверждения: ${code}`);
  }

  async verifyCode(rawPhone: string, code: string) {
    const phone = normalizePhone(rawPhone);
    if (!phone) throw new BadRequestException('Неверный формат номера');

    const outcome = await this.prisma.$transaction(
      async (tx) => {
        // Match requestCode's lock, before taking any generation/state snapshot.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${phone}))`;
        const [{ now }] = await tx.$queryRaw<
          { now: Date }[]
        >`SELECT clock_timestamp() AS now`;
        const record = await tx.smsCode.findFirst({
          where: { phone },
          orderBy: { generation: 'desc' },
        });
        if (
          !record ||
          record.usedAt ||
          record.expiresAt <= now ||
          record.attempts >= MAX_VERIFY_ATTEMPTS
        ) {
          return { kind: 'unavailable' as const };
        }
        if (record.code !== code) {
          await tx.smsCode.update({
            where: { id: record.id },
            data: { attempts: { increment: 1 } },
          });
          // Throwing here would roll back the attempt and allow unlimited guesses.
          return { kind: 'wrong' as const };
        }
        await tx.smsCode.update({
          where: { id: record.id },
          data: { usedAt: now },
        });
        const user = await tx.user.upsert({
          where: { phone },
          create: { phone },
          update: {},
        });
        return { kind: 'verified' as const, user };
      },
      { isolationLevel: 'ReadCommitted' },
    );

    if (outcome.kind === 'unavailable')
      throw new BadRequestException('Код не найден или истёк');
    if (outcome.kind === 'wrong') throw new BadRequestException('Неверный код');
    const user = outcome.user;
    if (user.isBlocked) throw new ForbiddenException('Аккаунт заблокирован');
    const accessToken = await this.tokens.issue(user);
    return {
      accessToken,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
      },
    };
  }
}
