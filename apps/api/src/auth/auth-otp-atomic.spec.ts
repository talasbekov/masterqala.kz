import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessTokenService } from './access-token.service';
import { AuthService } from './auth.service';

type Code = {
  id: string;
  generation: bigint;
  phone: string;
  code: string;
  attempts: number;
  usedAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
};
const phone = '+77011112233';
const row = (generation: bigint, overrides: Partial<Code> = {}): Code => ({
  id: String(generation),
  generation,
  phone,
  code: '123456',
  attempts: 0,
  usedAt: null,
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 300_000),
  ...overrides,
});

// This harness checks transaction composition/rollback, not PostgreSQL concurrency.
function fixture(initial: Code[]) {
  let records = initial;
  const events: string[] = [];
  const user = {
    id: 'existing-user',
    phone,
    name: null,
    role: 'CLIENT',
    authVersion: 0,
    isBlocked: false,
  };
  let failUpsert = false;
  const client = (scope: string, getRows: () => Code[]) => ({
    $executeRaw: jest.fn(async () => {
      events.push(`${scope}:lock`);
    }),
    $queryRaw: jest.fn(async () => [{ now: new Date() }]),
    smsCode: {
      findFirst: jest.fn(async ({ where, orderBy }) => {
        events.push(`${scope}:read`);
        const list = getRows().filter(
          (r) =>
            r.phone === where.phone &&
            (where.usedAt !== null || r.usedAt === null) &&
            (!where.expiresAt || r.expiresAt > where.expiresAt.gt),
        );
        const key = orderBy.generation ? 'generation' : 'createdAt';
        return list.sort((a, b) => (a[key] > b[key] ? -1 : 1))[0] ?? null;
      }),
      update: jest.fn(async ({ where, data }) => {
        events.push(`${scope}:consume-or-attempt`);
        const record = getRows().find((r) => r.id === where.id)!;
        if (data.attempts) record.attempts += data.attempts.increment;
        if (data.usedAt) record.usedAt = data.usedAt;
        return record;
      }),
    },
    user: {
      upsert: jest.fn(async () => {
        events.push(`${scope}:user`);
        if (failUpsert) throw new Error('database upsert failure');
        return user;
      }),
    },
  });
  const root = client('outside', () => records);
  const prisma = {
    ...root,
    $transaction: jest.fn(async (fn) => {
      events.push('begin');
      const draft = structuredClone(records);
      try {
        const result = await fn(client('tx', () => draft));
        records = draft;
        events.push('commit');
        return result;
      } catch (error) {
        events.push('rollback');
        throw error;
      }
    }),
  };
  const issue = jest.fn(async () => {
    events.push('issue');
    return 'test-token';
  });
  const auth = new AuthService(
    prisma as unknown as PrismaService,
    { send: jest.fn() },
    { issue } as unknown as AccessTokenService,
  );
  return {
    auth,
    events,
    user,
    issue,
    records: () => records,
    transaction: prisma.$transaction,
    failUpsert: () => {
      failUpsert = true;
    },
  };
}

describe('ordinary OTP transaction contract (database-free)', () => {
  it('locks phone before reading, consumes and resolves User inside transaction, then issues after commit', async () => {
    const f = fixture([row(1n)]);
    const result = await f.auth.verifyCode(phone, '123456');
    expect(result.user.id).toBe('existing-user');
    expect(f.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'ReadCommitted',
    });
    expect(f.events).toEqual([
      'begin',
      'tx:lock',
      'tx:read',
      'tx:consume-or-attempt',
      'tx:user',
      'commit',
      'issue',
    ]);
  });
  it.each(['used', 'expired', 'exhausted'])(
    'never revives an older code after the latest generation is %s',
    async (state) => {
      const newest = row(2n, {
        code: '654321',
        createdAt: new Date(Date.now() + 1000),
      });
      if (state === 'used') newest.usedAt = new Date();
      if (state === 'expired') newest.expiresAt = new Date(0);
      if (state === 'exhausted') newest.attempts = 5;
      const f = fixture([row(1n), newest]);
      await expect(f.auth.verifyCode(phone, '123456')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(f.records()[0].usedAt).toBeNull();
      expect(f.issue).not.toHaveBeenCalled();
    },
  );
  it('uses issuance generation despite reversed timestamps', async () => {
    const f = fixture([
      row(1n, { createdAt: new Date(Date.now() + 1000), code: '111111' }),
      row(2n, { createdAt: new Date(0), code: '222222' }),
    ]);
    await expect(f.auth.verifyCode(phone, '222222')).resolves.toMatchObject({
      accessToken: 'test-token',
    });
    expect(f.records().find((r) => r.generation === 1n)!.usedAt).toBeNull();
    expect(f.records().find((r) => r.generation === 2n)!.usedAt).not.toBeNull();
  });
  it('commits a wrong attempt before rejecting and stops at existing five-attempt cap', async () => {
    const f = fixture([row(1n)]);
    for (let i = 0; i < 6; i++)
      await expect(f.auth.verifyCode(phone, '000000')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    expect(f.records()[0].attempts).toBe(5);
    expect(f.events).toContain('commit');
    expect(f.events).not.toContain('rollback');
    expect(f.issue).not.toHaveBeenCalled();
  });
  it('rolls back code consumption when User resolution fails', async () => {
    const f = fixture([row(1n)]);
    f.failUpsert();
    await expect(f.auth.verifyCode(phone, '123456')).rejects.toThrow(
      'database upsert failure',
    );
    expect(f.records()[0].usedAt).toBeNull();
    expect(f.issue).not.toHaveBeenCalled();
  });
  it('preserves blocked-user rejection and code consumption without token issuance', async () => {
    const f = fixture([row(1n)]);
    f.user.isBlocked = true;
    await expect(f.auth.verifyCode(phone, '123456')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(f.records()[0].usedAt).not.toBeNull();
    expect(f.events).toContain('commit');
    expect(f.issue).not.toHaveBeenCalled();
  });
});

describe('ordinary OTP issuance timing (database-free)', () => {
  it('uses post-lock DB wall clock, unchanged budgets, and sends only after commit', async () => {
    const now = new Date('2026-10-21T18:00:00.000Z');
    const events: string[] = [];
    const count = jest.fn(async () => 0);
    const create = jest.fn(async () => ({}));
    const tx = {
      $executeRaw: jest.fn(async () => {
        events.push('lock');
      }),
      $queryRaw: jest.fn(async () => {
        events.push('clock');
        return [{ now }];
      }),
      smsCode: { count, create },
    };
    const transaction = jest.fn(async (fn) => {
      const result = await fn(tx);
      events.push('commit');
      return result;
    });
    const send = jest.fn(async () => {
      events.push('send');
    });
    const auth = new AuthService(
      { $transaction: transaction } as unknown as PrismaService,
      { send },
      {} as AccessTokenService,
    );
    await auth.requestCode(phone);
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'ReadCommitted',
    });
    expect(events).toEqual(['lock', 'clock', 'commit', 'send']);
    expect(count).toHaveBeenCalledWith({
      where: { phone, createdAt: { gte: new Date(now.getTime() - 600_000) } },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        phone,
        code: expect.stringMatching(/^\d{6}$/),
        createdAt: now,
        expiresAt: new Date(now.getTime() + 300_000),
      },
    });
  });
});
