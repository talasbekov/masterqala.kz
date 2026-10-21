import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AccessTokenService } from './access-token.service';

const secret = 'test-only-secret-with-at-least-32-characters';
describe('AccessTokenService compatibility boundary', () => {
  const jwt = new JwtService({ secret, signOptions: { expiresIn: '30d' } });
  let user: any;
  let findUnique: jest.Mock;
  let service: AccessTokenService;
  beforeEach(() => {
    user = { id: 'user-1', role: 'CLIENT', authVersion: 0, isBlocked: false };
    findUnique = jest.fn(async () => user);
    service = new AccessTokenService(jwt, {
      user: { findUnique },
    } as unknown as PrismaService);
  });
  const sign = (claims: object) =>
    jwt.signAsync({ sub: 'user-1', role: 'CLIENT', ...claims });
  it('issues versioned tokens and returns the authoritative DB user', async () => {
    const token = await service.issue(user);
    expect(jwt.verify(token)).toMatchObject({
      sub: user.id,
      role: 'CLIENT',
      authVersion: 0,
    });
    expect(await service.authenticate(token)).toBe(user);
  });
  it.each(['CLIENT', 'OPERATOR'])(
    'preserves legacy %s login at version zero',
    async (role) => {
      user.role = role;
      expect(await service.authenticate(await sign({ role }))).toBe(user);
    },
  );
  it('does not confer a changed DB role on an old token', async () => {
    const token = await service.issue(user);
    user.role = 'OPERATOR';
    await expect(service.authenticate(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.authenticate(await sign({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
  it('rejects stale and legacy tokens after version changes', async () => {
    const token = await service.issue(user);
    user.authVersion = 1;
    await expect(service.authenticate(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.authenticate(await sign({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(await service.authenticate(await service.issue(user))).toBe(user);
  });
  it.each([null, -1, 0.5, '0', 9007199254740992])(
    'rejects invalid authVersion %p',
    async (authVersion) => {
      await expect(
        service.authenticate(await sign({ authVersion })),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );
  it.each([{ sub: '' }, { role: 'ADMIN' }, { role: null }, { authVersion: 1 }])(
    'rejects invalid claims %p',
    async (claims) => {
      await expect(
        service.authenticate(await sign(claims)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );
  it('rejects invalid signature and expired tokens before querying DB', async () => {
    await expect(service.authenticate('invalid')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      service.authenticate(
        new JwtService({ secret }).sign({
          sub: 'user-1',
          role: 'CLIENT',
          exp: 1,
        }),
      ),
    ).rejects.toBeDefined();
    expect(findUnique).not.toHaveBeenCalled();
  });
  it('rejects signed tokens without expiry instead of creating unbounded legacy access', async () => {
    const token = new JwtService({ secret }).sign({
      sub: 'user-1',
      role: 'CLIENT',
    });
    await expect(service.authenticate(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
  it.each([undefined, null, -1, 0.5])(
    'does not issue invalid or accidental legacy versions %p',
    async (authVersion) => {
      await expect(
        service.issue({ ...user, authVersion }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );
  it('preserves blocked and missing-user rejection', async () => {
    user.isBlocked = true;
    await expect(service.authenticate(await sign({}))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    user = null;
    await expect(service.authenticate(await sign({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
