import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createTestApp, resetDb } from '../../test/helpers';

// Loading these test utilities must never initialize the application or a real database.
jest.mock('../app.module', () => ({ AppModule: class AppModule {} }));

const apiDatabase =
  'postgresql://fixture:fixture@localhost:5433/masterqala_test';
const queueDatabase =
  'postgresql://fixture:fixture@localhost:5434/masterqala_urgent_queue_ci';
const originalEnv = { ...process.env };

function runApiSetup(): void {
  jest.isolateModules(() => require('../../test/setup-env'));
}

function fakeApp(database = 'masterqala_test', schema = 'public') {
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ name: database, schema }]),
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
  };
  const get = jest.fn().mockReturnValue(prisma);
  return { app: { get } as unknown as INestApplication, get, prisma };
}

describe('destructive API test database boundary', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = apiDatabase;
    process.env.ALLOW_ISOLATED_API_TESTS = '1';
    delete process.env.ALLOW_ISOLATED_QUEUE_TESTS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it.each([
    apiDatabase,
    apiDatabase.replace('postgresql:', 'postgres:'),
    apiDatabase.replace('localhost', '127.0.0.1'),
  ])('allows the explicitly opted-in dedicated API target %s', (url) => {
    process.env.DATABASE_URL = url;
    expect(runApiSetup).not.toThrow();
    expect(process.env.PGBOSS_DISABLED).toBe('1');
  });

  it.each([
    undefined,
    '',
    'not-a-url',
    apiDatabase.replace('postgresql:', 'https:'),
    apiDatabase.replace('localhost', 'production.example'),
    apiDatabase.replace('localhost', 'localhost.production.example'),
    apiDatabase.replace('5433', '5432'),
    apiDatabase.replace('masterqala_test', 'masterqala'),
    apiDatabase.replace('masterqala_test', 'another_test'),
    `${apiDatabase}?schema=public`,
    `${apiDatabase}?host=production.example`,
    `${apiDatabase}#ignored`,
    queueDatabase,
  ])(
    'rejects unsafe or unspecified API database URLs before setup: %s',
    (url) => {
      if (url === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = url;
      process.env.PGBOSS_DISABLED = 'unchanged';
      expect(runApiSetup).toThrow();
      expect(process.env.PGBOSS_DISABLED).toBe('unchanged');
    },
  );

  it.each([undefined, '', '0', 'true'])(
    'requires exact API destructive opt-in: %s',
    (value) => {
      if (value === undefined) delete process.env.ALLOW_ISOLATED_API_TESTS;
      else process.env.ALLOW_ISOLATED_API_TESTS = value;
      expect(runApiSetup).toThrow(/ALLOW_ISOLATED_API_TESTS/);
    },
  );

  it.each([undefined, 'development', 'production'])(
    'requires NODE_ENV=test: %s',
    (value) => {
      if (value === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = value;
      expect(runApiSetup).toThrow(/NODE_ENV=test/);
    },
  );

  it('rejects unsafe targets before application construction even without setupFiles', async () => {
    process.env.DATABASE_URL = apiDatabase.replace(
      'localhost',
      'production.example',
    );
    const construct = jest
      .spyOn(Test, 'createTestingModule')
      .mockImplementation(() => {
        throw new Error('Application construction should not be reached');
      });
    await expect(createTestApp()).rejects.toThrow(/dedicated/);
    expect(construct).not.toHaveBeenCalled();
  });

  it('rechecks the target before resetDb touches Prisma', async () => {
    const { app, get, prisma } = fakeApp();
    process.env.DATABASE_URL = apiDatabase.replace(
      'masterqala_test',
      'masterqala',
    );
    await expect(resetDb(app)).rejects.toThrow(/dedicated/);
    expect(get).not.toHaveBeenCalled();
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('rechecks opt-in before resetDb touches Prisma', async () => {
    const { app, get } = fakeApp();
    delete process.env.ALLOW_ISOLATED_API_TESTS;
    await expect(resetDb(app)).rejects.toThrow(/ALLOW_ISOLATED_API_TESTS/);
    expect(get).not.toHaveBeenCalled();
  });

  it.each([
    ['masterqala', 'public'],
    ['masterqala_urgent_queue_ci', 'public'],
    ['masterqala_test', 'shared'],
  ])(
    'rejects mismatched connected database/schema %s/%s before TRUNCATE',
    async (database, schema) => {
      const { app, prisma } = fakeApp(database, schema);
      await expect(resetDb(app)).rejects.toThrow(/connected/);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
    },
  );

  it('fails closed when the connected database identity is unavailable', async () => {
    const { app, prisma } = fakeApp();
    prisma.$queryRaw.mockResolvedValue([]);
    await expect(resetDb(app)).rejects.toThrow(/connected/);
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('checks the connected test database before issuing the destructive SQL', async () => {
    const { app, prisma } = fakeApp();
    await resetDb(app);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringMatching(/^TRUNCATE /),
    );
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.$executeRawUnsafe.mock.invocationCallOrder[0],
    );
  });

  it('preserves the dedicated queue reset path only with the queue opt-in', async () => {
    process.env.DATABASE_URL = queueDatabase;
    delete process.env.ALLOW_ISOLATED_API_TESTS;
    process.env.ALLOW_ISOLATED_QUEUE_TESTS = '1';
    const { app, prisma } = fakeApp('masterqala_urgent_queue_ci');
    await resetDb(app);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
  });

  it('does not let the API opt-in authorize queue database cleanup', async () => {
    process.env.DATABASE_URL = queueDatabase;
    const { app, get } = fakeApp('masterqala_urgent_queue_ci');
    await expect(resetDb(app)).rejects.toThrow(/opt-in/);
    expect(get).not.toHaveBeenCalled();
  });

  it('does not let the queue opt-in authorize API database cleanup', async () => {
    delete process.env.ALLOW_ISOLATED_API_TESTS;
    process.env.ALLOW_ISOLATED_QUEUE_TESTS = '1';
    const { app, get } = fakeApp();
    await expect(resetDb(app)).rejects.toThrow(/ALLOW_ISOLATED_API_TESTS/);
    expect(get).not.toHaveBeenCalled();
  });

  it('does not disclose database credentials in guard errors', () => {
    process.env.DATABASE_URL =
      'postgresql://sensitive-user:secret-password@production.example:5433/masterqala';
    let error: unknown;
    try {
      runApiSetup();
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).not.toMatch(
      /sensitive-user|secret-password|production\.example/,
    );
  });
});
