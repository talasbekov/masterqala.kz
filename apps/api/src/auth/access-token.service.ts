import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** No version-changing writer is enabled in this foundation. */
@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async issue(
    user: Pick<User, 'id' | 'role' | 'authVersion'>,
  ): Promise<string> {
    if (
      !user ||
      typeof user.id !== 'string' ||
      !user.id ||
      !['CLIENT', 'OPERATOR'].includes(user.role) ||
      !Number.isSafeInteger(user.authVersion) ||
      user.authVersion < 0
    ) {
      throw new UnauthorizedException('Недействительная сессия');
    }
    return this.jwt.signAsync({
      sub: user.id,
      role: user.role,
      authVersion: user.authVersion,
    });
  }

  async authenticate(token: string): Promise<User> {
    let payload: Record<string, unknown>;
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Недействительный токен');
    }
    if (
      !payload ||
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      !['CLIENT', 'OPERATOR'].includes(payload.role as string) ||
      typeof payload.exp !== 'number' ||
      !Number.isFinite(payload.exp)
    )
      throw new UnauthorizedException('Недействительный токен');

    const legacy = !Object.prototype.hasOwnProperty.call(
      payload,
      'authVersion',
    );
    if (
      !legacy &&
      (!Number.isSafeInteger(payload.authVersion) ||
        (payload.authVersion as number) < 0)
    ) {
      throw new UnauthorizedException('Недействительный токен');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) throw new UnauthorizedException('Пользователь не найден');
    if (user.isBlocked) throw new ForbiddenException('Аккаунт заблокирован');
    // DB remains authoritative, but a previously issued token cannot acquire a changed role.
    // Legacy tokens expire normally and are accepted only before any version change.
    if (
      user.role !== payload.role ||
      user.authVersion !== (legacy ? 0 : payload.authVersion)
    ) {
      throw new UnauthorizedException('Требуется повторный вход');
    }
    return user;
  }
}
