import { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceService } from '../realtime/presence.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AccessTokenService } from './access-token.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from './auth.service';

describe('versioned access-token wiring', () => {
  const jwt = new JwtService({
    secret: 'test-only-secret-with-at-least-32-characters',
    signOptions: { expiresIn: '30d' },
  });
  const user = {
    id: 'user-1',
    role: 'CLIENT' as const,
    authVersion: 0,
    isBlocked: false,
    phone: '+77011112233',
    name: null,
  };
  let dbUser: typeof user;
  let prisma: PrismaService;
  let tokens: AccessTokenService;
  beforeEach(() => {
    dbUser = { ...user };
    prisma = {
      $transaction: jest.fn(async (fn) => fn(prisma)),
      $executeRaw: jest.fn(),
      $queryRaw: jest.fn(async () => [{ now: new Date() }]),
      user: {
        findUnique: jest.fn(async () => dbUser),
        upsert: jest.fn(async () => dbUser),
      },
      smsCode: {
        findFirst: jest.fn(async () => ({
          id: 'code-1',
          code: '123456',
          generation: 1n,
          expiresAt: new Date(Date.now() + 300_000),
          usedAt: null,
          attempts: 0,
        })),
        update: jest.fn(),
      },
    } as unknown as PrismaService;
    tokens = new AccessTokenService(jwt, prisma);
  });
  it('phone login uses centralized versioned issuance', async () => {
    const auth = new AuthService(prisma, { send: jest.fn() }, tokens);
    const result = await auth.verifyCode(user.phone, '123456');
    expect(jwt.verify(result.accessToken)).toMatchObject({
      sub: user.id,
      role: 'CLIENT',
      authVersion: 0,
    });
  });
  it('HTTP sets authoritative req.user and rejects old version', async () => {
    const request = {
      headers: { authorization: `Bearer ${await tokens.issue(user)}` },
      user: undefined,
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;
    const guard = new JwtAuthGuard(tokens);
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(request.user).toBe(dbUser);
    dbUser.authVersion = 1;
    await expect(guard.canActivate(ctx)).rejects.toThrow();
  });
  it.each([false, true])(
    'handshake shares version check (stale=%p)',
    async (stale) => {
      let middleware: (
        socket: Socket,
        next: (err?: Error) => void,
      ) => Promise<void>;
      const server = {
        use: jest.fn((fn) => {
          middleware = fn;
        }),
        on: jest.fn(),
      };
      new RealtimeGateway(tokens, {} as PresenceService, prisma).afterInit(
        server as unknown as Server,
      );
      const token = await tokens.issue(user);
      if (stale) dbUser.authVersion = 1;
      const socket = {
        handshake: { auth: { token } },
        data: {},
        join: jest.fn(),
      };
      const next = jest.fn();
      await middleware!(socket as unknown as Socket, next);
      if (stale) {
        expect(next).toHaveBeenCalledWith(expect.any(Error));
        expect(socket.join).not.toHaveBeenCalled();
      } else {
        expect(next).toHaveBeenCalledWith();
        expect(socket.join).toHaveBeenCalledWith('user:user-1');
        expect(socket.data).toEqual({ userId: 'user-1' });
      }
    },
  );
});
