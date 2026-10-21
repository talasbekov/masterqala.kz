import { BadRequestException, HttpException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { randomInt } from 'crypto';
import { AccessTokenService } from '../src/auth/access-token.service';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_SENDER, SmsSender } from '../src/sms/sms.interface';
import { assertIsolatedApiDatabase } from './database-safety';

jest.setTimeout(30_000);

/**
 * Real PostgreSQL integration regressions, not an in-memory concurrency model.
 * Run only against the migrated disposable PostGIS test target:
 * ALLOW_ISOLATED_API_TESTS=1 pnpm --filter api test:e2e -- auth-otp-atomic
 * No AppModule, HTTP listener, queue or live SMS provider is started.
 */
describe('Ordinary phone OTP atomicity (isolated PostgreSQL)', () => {
  let moduleRef: TestingModule | undefined;
  let prisma: PrismaService;
  let observer: PrismaService;
  let locker: PrismaService;
  let auth: AuthService;
  let tokens: AccessTokenService;
  let jwt: JwtService;
  let issueSpy: jest.SpyInstance;
  let conflictingUpsert: { phone: string; userId: string } | undefined;
  const phones = new Set<string>();
  const pending = new Set<Promise<unknown>>();
  const sms: jest.Mocked<SmsSender> = { send: jest.fn() };

  function assertTarget() {
    assertIsolatedApiDatabase(
      process.env.DATABASE_URL,
      process.env.ALLOW_ISOLATED_API_TESTS,
      process.env.NODE_ENV,
    );
  }

  async function assertConnectedTarget(client: PrismaService) {
    assertTarget();
    const identity = await client.$queryRaw<{ name: string; schema: string }[]>`
      SELECT current_database() AS name, current_schema() AS schema
    `;
    if (
      identity.length !== 1 ||
      identity[0].name !== 'masterqala_test' ||
      identity[0].schema !== 'public'
    ) {
      throw new Error(
        'Refusing OTP fixtures outside the isolated API test target',
      );
    }
  }

  beforeAll(async () => {
    // Guard BEFORE Nest or any manually constructed Prisma client can connect.
    assertTarget();
    moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'isolated-otp-test-secret-with-at-least-32-characters',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      providers: [
        PrismaService,
        AuthService,
        AccessTokenService,
        { provide: SMS_SENDER, useValue: sms },
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    auth = moduleRef.get(AuthService);
    tokens = moduleRef.get(AccessTokenService);
    jwt = moduleRef.get(JwtService);

    // An actual unique-key violation on a fixture-specific User insert. No DB
    // delegates are mocked and no table-wide constraints or triggers are added.
    prisma.$use(async (params, next) => {
      if (
        conflictingUpsert &&
        params.model === 'User' &&
        params.action === 'upsert' &&
        params.args?.where?.phone === conflictingUpsert.phone
      ) {
        const args = params.args as Prisma.UserUpsertArgs;
        params.args = {
          ...args,
          create: { ...args.create, id: conflictingUpsert.userId },
        };
      }
      return next(params);
    });

    // Separate clients keep the observer and held-lock transaction independent
    // from the connections used by the two concurrent AuthService calls.
    assertTarget();
    observer = new PrismaService();
    locker = new PrismaService();
    await moduleRef.init();
    await Promise.all([observer.$connect(), locker.$connect()]);
    await Promise.all(
      [prisma, observer, locker].map((client) => assertConnectedTarget(client)),
    );
  }, 30_000);

  beforeEach(() => {
    conflictingUpsert = undefined;
    sms.send.mockReset().mockResolvedValue(undefined);
    // A pass-through spy: real AccessTokenService and real JWT signing remain.
    issueSpy = jest.spyOn(tokens, 'issue');
  });

  afterEach(async () => {
    await Promise.allSettled([...pending]);
    conflictingUpsert = undefined;
    jest.restoreAllMocks();
    if (!prisma || phones.size === 0) return;
    await assertConnectedTarget(prisma);
    const ownedPhones = [...phones];
    // Never TRUNCATE or delete fixtures owned by another suite.
    await prisma.$transaction([
      prisma.masterProfile.deleteMany({
        where: { user: { phone: { in: ownedPhones } } },
      }),
      prisma.smsCode.deleteMany({ where: { phone: { in: ownedPhones } } }),
      prisma.user.deleteMany({ where: { phone: { in: ownedPhones } } }),
    ]);
    phones.clear();
  });

  afterAll(async () => {
    await Promise.all([
      observer?.$disconnect(),
      locker?.$disconnect(),
      moduleRef?.close(),
    ]);
  });

  async function newPhone(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const phone = `+7709${randomInt(0, 10_000_000).toString().padStart(7, '0')}`;
      if (phones.has(phone)) continue;
      const existing = await Promise.all([
        prisma.user.count({ where: { phone } }),
        prisma.smsCode.count({ where: { phone } }),
      ]);
      if (existing.some(Boolean)) continue;
      phones.add(phone);
      return phone;
    }
    throw new Error('Could not allocate an unused isolated OTP fixture phone');
  }

  const localFormat = (phone: string) =>
    `8 (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10)}`;

  const seedCode = (
    phone: string,
    overrides: Partial<Prisma.SmsCodeCreateInput> = {},
  ) =>
    prisma.smsCode.create({
      data: {
        phone,
        code: '123456',
        createdAt: new Date(Date.now() - 2_000),
        expiresAt: new Date(Date.now() + 5 * 60_000),
        ...overrides,
      },
    });

  const latestCode = (phone: string) =>
    prisma.smsCode.findFirstOrThrow({
      where: { phone },
      orderBy: { generation: 'desc' },
    });

  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  // Attach rejection handlers immediately, including if a barrier assertion fails.
  function settled<T>(operation: Promise<T>): Promise<PromiseSettledResult<T>> {
    const result = operation.then(
      (value): PromiseFulfilledResult<T> => ({ status: 'fulfilled', value }),
      (reason: unknown): PromiseRejectedResult => ({
        status: 'rejected',
        reason,
      }),
    );
    pending.add(result);
    void result.then(() => pending.delete(result));
    return result;
  }

  async function withPhoneLock<T>(
    phone: string,
    run: (pid: number, release: () => void) => Promise<T>,
  ): Promise<T> {
    const ready = deferred<number>();
    const release = deferred<void>();
    const holding = locker.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${phone}))`;
        const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`
          SELECT pg_backend_pid() AS pid
        `;
        ready.resolve(pid);
        await release.promise;
      },
      { timeout: 20_000 },
    );
    // If connection/lock acquisition fails, do not leave ready hanging forever.
    void holding.catch(ready.reject);
    try {
      return await run(await ready.promise, () => release.resolve());
    } finally {
      release.resolve();
      await holding;
      await Promise.allSettled([...pending]);
    }
  }

  async function waitForLockWaiters(holderPid: number, count: number) {
    const deadline = Date.now() + 3_000;
    do {
      const waiters = await observer.$queryRaw<{ pid: number }[]>`
        SELECT waiter.pid
        FROM pg_locks AS waiter
        JOIN pg_locks AS holder
          ON waiter.locktype = holder.locktype
         AND waiter.database IS NOT DISTINCT FROM holder.database
         AND waiter.classid = holder.classid
         AND waiter.objid = holder.objid
         AND waiter.objsubid = holder.objsubid
        WHERE holder.pid = ${holderPid}
          AND holder.locktype = 'advisory'
          AND holder.granted
          AND NOT waiter.granted
      `;
      if (waiters.length === count) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    } while (Date.now() < deadline);
    throw new Error(`Expected ${count} real PostgreSQL phone-lock waiters`);
  }

  function expectBadCode(result: PromiseSettledResult<unknown>) {
    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') throw new Error('Expected rejected OTP');
    expect(result.reason).toBeInstanceOf(BadRequestException);
    expect((result.reason as BadRequestException).getStatus()).toBe(400);
  }

  it('allows exactly one concurrent consumption across normalized phone formats', async () => {
    const phone = await newPhone();
    const code = await seedCode(phone);
    const results = await withPhoneLock(phone, async (pid, release) => {
      const a = settled(auth.verifyCode(phone, code.code));
      const b = settled(auth.verifyCode(localFormat(phone), code.code));
      await waitForLockWaiters(pid, 2);
      expect((await latestCode(phone)).usedAt).toBeNull();
      expect(issueSpy).not.toHaveBeenCalled();
      release();
      return Promise.all([a, b]);
    });

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expectBadCode(results.find((result) => result.status === 'rejected')!);
    expect(issueSpy).toHaveBeenCalledTimes(1);
    expect((await latestCode(phone)).usedAt).not.toBeNull();
    expect(await prisma.user.count({ where: { phone } })).toBe(1);
    const success = results.find((result) => result.status === 'fulfilled');
    if (success?.status !== 'fulfilled')
      throw new Error('Missing successful OTP');
    expect((await tokens.authenticate(success.value.accessToken)).id).toBe(
      success.value.user.id,
    );
  });

  it('rejects a code that expires while verification waits for the phone lock', async () => {
    const phone = await newPhone();
    const code = await seedCode(phone);
    await withPhoneLock(phone, async (pid, release) => {
      const verify = settled(auth.verifyCode(phone, code.code));
      await waitForLockWaiters(pid, 1);
      // Expire this fixture after verify has joined the real lock queue. Use the
      // database clock, not a long sleep or a process-clock/fake-timer change.
      await observer.$executeRaw`
        UPDATE "SmsCode"
        SET "expiresAt" = date_trunc('milliseconds', clock_timestamp() AT TIME ZONE 'UTC')
        WHERE id = ${code.id}
      `;
      expect((await latestCode(phone)).usedAt).toBeNull();
      expect(issueSpy).not.toHaveBeenCalled();
      release();
      expectBadCode(await verify);
    });
    const expired = await latestCode(phone);
    expect(expired.usedAt).toBeNull();
    expect(expired.attempts).toBe(0);
    expect(issueSpy).not.toHaveBeenCalled();
    expect(await prisma.user.count({ where: { phone } })).toBe(0);
  });

  it('commits both rejected attempts under contention, then enforces five attempts', async () => {
    const phone = await newPhone();
    await seedCode(phone);
    const results = await withPhoneLock(phone, async (pid, release) => {
      const a = settled(auth.verifyCode(phone, '000000'));
      const b = settled(auth.verifyCode(localFormat(phone), '000000'));
      await waitForLockWaiters(pid, 2);
      release();
      return Promise.all([a, b]);
    });
    results.forEach(expectBadCode);
    expect((await latestCode(phone)).attempts).toBe(2);
    for (let attempt = 0; attempt < 3; attempt++) {
      await expect(auth.verifyCode(phone, '000000')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
    expect((await latestCode(phone)).attempts).toBe(5);
    await expect(auth.verifyCode(phone, '123456')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect((await latestCode(phone)).attempts).toBe(5);
    expect(issueSpy).not.toHaveBeenCalled();
    expect(await prisma.user.count({ where: { phone } })).toBe(0);
  });

  it('does not exceed the remaining attempt budget when two wrong codes race', async () => {
    const phone = await newPhone();
    await seedCode(phone, { attempts: 4 });
    await withPhoneLock(phone, async (pid, release) => {
      const a = settled(auth.verifyCode(phone, '000000'));
      const b = settled(auth.verifyCode(phone, '000000'));
      await waitForLockWaiters(pid, 2);
      release();
      (await Promise.all([a, b])).forEach(expectBadCode);
    });
    expect((await latestCode(phone)).attempts).toBe(5);
    expect(issueSpy).not.toHaveBeenCalled();
  });

  it('a queued newer request supersedes an old verification before it can consume', async () => {
    const phone = await newPhone();
    // requestCode only generates 100000..999999, so collision is impossible.
    const old = await seedCode(phone, { code: '012345' });
    await withPhoneLock(phone, async (pid, release) => {
      const request = settled(auth.requestCode(localFormat(phone)));
      await waitForLockWaiters(pid, 1);
      const verify = settled(auth.verifyCode(phone, old.code));
      await waitForLockWaiters(pid, 2);
      expect(sms.send).not.toHaveBeenCalled();
      release();
      expect((await request).status).toBe('fulfilled');
      expectBadCode(await verify);
    });
    const current = await latestCode(phone);
    expect(current.id).not.toBe(old.id);
    expect(current.attempts).toBe(1);
    expect(await prisma.user.count({ where: { phone } })).toBe(0);
    expect(sms.send).toHaveBeenCalledWith(
      phone,
      `Ваш код подтверждения: ${current.code}`,
    );
    await auth.verifyCode(phone, current.code);
    await expect(auth.verifyCode(phone, old.code)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(auth.verifyCode(phone, current.code)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(issueSpy).toHaveBeenCalledTimes(1);
  });

  it('allows verification queued first, then leaves the later request usable', async () => {
    const phone = await newPhone();
    const old = await seedCode(phone, { code: '012345' });
    const firstLogin = await withPhoneLock(phone, async (pid, release) => {
      const verify = settled(auth.verifyCode(localFormat(phone), old.code));
      await waitForLockWaiters(pid, 1);
      const request = settled(auth.requestCode(phone));
      await waitForLockWaiters(pid, 2);
      release();
      const result = await verify;
      expect((await request).status).toBe('fulfilled');
      if (result.status !== 'fulfilled') throw result.reason;
      return result.value;
    });
    expect(
      (await prisma.smsCode.findUniqueOrThrow({ where: { id: old.id } }))
        .usedAt,
    ).not.toBeNull();
    const current = await latestCode(phone);
    expect(current.id).not.toBe(old.id);
    expect(current.usedAt).toBeNull();
    const secondLogin = await auth.verifyCode(phone, current.code);
    expect(secondLogin.user.id).toBe(firstLogin.user.id);
    expect(await prisma.user.count({ where: { phone } })).toBe(1);
  });

  it.each(['used', 'expired', 'exhausted'] as const)(
    'does not revive an older live code when the newest generation is %s',
    async (state) => {
      const phone = await newPhone();
      const old = await seedCode(phone, { code: '012345' });
      await seedCode(phone, {
        code: '654321',
        usedAt: state === 'used' ? new Date() : null,
        expiresAt: new Date(
          Date.now() + (state === 'expired' ? -1_000 : 60_000),
        ),
        attempts: state === 'exhausted' ? 5 : 0,
      });
      await expect(auth.verifyCode(phone, old.code)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      const unchanged = await prisma.smsCode.findUniqueOrThrow({
        where: { id: old.id },
      });
      expect(unchanged.usedAt).toBeNull();
      expect(unchanged.attempts).toBe(0);
      expect(issueSpy).not.toHaveBeenCalled();
      expect(await prisma.user.count({ where: { phone } })).toBe(0);
    },
  );

  it.each(['equal', 'reversed'] as const)(
    'selects issuance generation, not %s creation timestamps',
    async (timestamps) => {
      const phone = await newPhone();
      const timestamp = new Date(Date.now() - 2_000);
      const old = await seedCode(phone, {
        code: '012345',
        createdAt: timestamp,
      });
      const current = await seedCode(phone, {
        code: '654321',
        createdAt:
          timestamps === 'equal'
            ? timestamp
            : new Date(timestamp.getTime() - 1_000),
      });
      expect(current.generation > old.generation).toBe(true);
      await expect(auth.verifyCode(phone, old.code)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await auth.verifyCode(phone, current.code);
      await expect(auth.verifyCode(phone, old.code)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(issueSpy).toHaveBeenCalledTimes(1);
    },
  );

  it('rolls consumption back after a real database failure in the User upsert', async () => {
    const phone = await newPhone();
    const collision = await prisma.user.create({
      data: { phone: await newPhone(), name: 'Unrelated isolated OTP fixture' },
    });
    const code = await seedCode(phone);
    conflictingUpsert = { phone, userId: collision.id };
    try {
      await expect(auth.verifyCode(phone, code.code)).rejects.toMatchObject({
        code: 'P2002',
      });
    } finally {
      conflictingUpsert = undefined;
    }
    const unchanged = await latestCode(phone);
    expect(unchanged.usedAt).toBeNull();
    expect(unchanged.attempts).toBe(0);
    expect(await prisma.user.count({ where: { phone } })).toBe(0);
    expect(issueSpy).not.toHaveBeenCalled();
    expect(
      await prisma.user.findUniqueOrThrow({ where: { id: collision.id } }),
    ).toEqual(collision);
    await auth.verifyCode(phone, code.code);
    expect((await latestCode(phone)).usedAt).not.toBeNull();
  });

  it('signs only after the consumed code and User are visible on another connection', async () => {
    const phone = await newPhone();
    const code = await seedCode(phone);
    const realIssue = AccessTokenService.prototype.issue.bind(tokens);
    issueSpy.mockImplementation(
      async (user: Parameters<AccessTokenService['issue']>[0]) => {
        const persistedCode = await observer.smsCode.findUniqueOrThrow({
          where: { id: code.id },
        });
        const persistedUser = await observer.user.findUnique({
          where: { id: user.id },
        });
        expect(persistedCode.usedAt).not.toBeNull();
        expect(persistedUser?.phone).toBe(phone);
        return realIssue(user);
      },
    );
    const result = await auth.verifyCode(phone, code.code);
    expect((await jwt.verifyAsync(result.accessToken)).sub).toBe(
      result.user.id,
    );
  });

  it('keeps a committed consumption when token signing fails', async () => {
    const phone = await newPhone();
    const code = await seedCode(phone);
    issueSpy.mockRejectedValueOnce(new Error('Isolated signing failure'));
    await expect(auth.verifyCode(phone, code.code)).rejects.toThrow(
      'Isolated signing failure',
    );
    expect((await latestCode(phone)).usedAt).not.toBeNull();
    expect(await prisma.user.count({ where: { phone } })).toBe(1);
    await expect(auth.verifyCode(phone, code.code)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each(['CLIENT', 'OPERATOR'] as const)(
    'preserves the existing %s identity, authVersion and MasterProfile',
    async (role) => {
      const phone = await newPhone();
      const user = await prisma.user.create({
        data: {
          phone,
          name: 'Existing OTP fixture',
          role,
          authVersion: 3,
        },
      });
      const profile = await prisma.masterProfile.create({
        data: {
          userId: user.id,
          fullName: 'Existing master fixture',
          iin: '000000000000',
          district: 'Test district',
          experienceYears: 7,
          status: 'ACTIVE',
        },
      });
      await auth.requestCode(localFormat(phone));
      const code = await latestCode(phone);
      const result = await auth.verifyCode(localFormat(phone), code.code);
      expect(result.user).toEqual({
        id: user.id,
        phone,
        name: user.name,
        role,
      });
      expect(await jwt.verifyAsync(result.accessToken)).toMatchObject({
        sub: user.id,
        role,
        authVersion: 3,
      });
      expect(
        await prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
      ).toEqual(user);
      expect(
        await prisma.masterProfile.findUniqueOrThrow({
          where: { userId: user.id },
        }),
      ).toEqual(profile);
      expect(await prisma.user.count({ where: { phone } })).toBe(1);
    },
  );

  it('retains the five-minute TTL and three-sends-in-ten-minutes policy', async () => {
    const phone = await newPhone();
    await seedCode(phone, { createdAt: new Date(Date.now() - 11 * 60_000) });
    for (let attempt = 0; attempt < 3; attempt++) {
      await auth.requestCode(localFormat(phone));
    }
    const current = await latestCode(phone);
    expect(current.code).toMatch(/^[1-9]\d{5}$/);
    const ttl = current.expiresAt.getTime() - current.createdAt.getTime();
    expect(ttl).toBeGreaterThan(4.9 * 60_000);
    expect(ttl).toBeLessThan(5.1 * 60_000);
    const result = await settled(auth.requestCode(phone));
    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') throw new Error('Expected send limit');
    expect(result.reason).toBeInstanceOf(HttpException);
    expect((result.reason as HttpException).getStatus()).toBe(429);
    expect(await prisma.smsCode.count({ where: { phone } })).toBe(4);
    expect(sms.send).toHaveBeenCalledTimes(3);
  });
});
