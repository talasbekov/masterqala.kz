import { SecurityDependencyMonitorService } from './security-dependency-monitor.service';

type Deps = Record<'database' | 'queue' | 'scanner', { status: string }>;

describe('SecurityDependencyMonitorService', () => {
  function setup(dependencies: Deps) {
    const health = {
      readiness: jest.fn().mockImplementation(async () => ({ dependencies })),
    };
    const prisma = { $executeRaw: jest.fn().mockResolvedValue(1) };
    const queue = { registerCron: jest.fn() };
    const service = new SecurityDependencyMonitorService(
      health as never,
      prisma as never,
      queue as never,
    );
    return { service, health, prisma, queue, dependencies };
  }

  function insertedSql(prisma: { $executeRaw: jest.Mock }): string[] {
    return prisma.$executeRaw.mock.calls.map((call) => (call[0] as string[]).join(''));
  }

  it('регистрирует ежеминутный sweep', () => {
    const { service, queue } = setup({
      database: { status: 'UP' },
      queue: { status: 'UP' },
      scanner: { status: 'UP' },
    });

    service.onModuleInit();

    expect(queue.registerCron).toHaveBeenCalledWith(
      'security-dependency-sweep',
      '* * * * *',
      expect.any(Function),
    );
  });

  it('пишет SECURITY_DEPENDENCY_DOWN один раз на переход UP→DOWN', async () => {
    const { service, prisma } = setup({
      database: { status: 'UP' },
      queue: { status: 'UP' },
      scanner: { status: 'DOWN' },
    });

    await service.sweep();
    await service.sweep();

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(insertedSql(prisma)[0]).toContain('SECURITY_DEPENDENCY_DOWN');
  });

  it('после восстановления новая деградация даёт новое событие', async () => {
    const { service, prisma, dependencies } = setup({
      database: { status: 'UP' },
      queue: { status: 'UP' },
      scanner: { status: 'DOWN' },
    });

    await service.sweep();
    dependencies.scanner.status = 'UP';
    await service.sweep();
    dependencies.scanner.status = 'DOWN';
    await service.sweep();

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it('DISABLED вне production не считается деградацией', async () => {
    const { service, prisma } = setup({
      database: { status: 'UP' },
      queue: { status: 'DISABLED' },
      scanner: { status: 'DISABLED' },
    });

    await service.sweep();

    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('ошибка записи события не роняет sweep', async () => {
    const { service, prisma } = setup({
      database: { status: 'DOWN' },
      queue: { status: 'UP' },
      scanner: { status: 'UP' },
    });
    prisma.$executeRaw.mockRejectedValue(new Error('db unavailable'));

    await expect(service.sweep()).resolves.toBeUndefined();
  });
});
