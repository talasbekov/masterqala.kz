import { QueueService } from './queue.service';

describe('QueueService health', () => {
  function config(disabled: boolean) {
    return {
      get: jest.fn((key: string) => {
        if (key === 'PGBOSS_DISABLED') return disabled ? '1' : '0';
        if (key === 'DATABASE_URL') return 'postgresql://unused';
        return undefined;
      }),
    };
  }

  it('явно сообщает DISABLED для hermetic test mode', () => {
    const service = new QueueService(config(true) as never);
    service.register('job-a', async () => undefined);
    service.registerCron('job-b', '* * * * *', async () => undefined);

    expect(service.healthCheck()).toEqual({
      status: 'DISABLED',
      enabled: false,
      startedAt: null,
      registeredHandlers: 2,
      scheduledJobs: 1,
      lastErrorAt: null,
      lastError: null,
    });
  });

  it('до bootstrap сообщает DOWN, а не ложный UP', () => {
    const service = new QueueService(config(false) as never);

    expect(service.healthCheck()).toMatchObject({
      status: 'DOWN',
      enabled: true,
      startedAt: null,
      registeredHandlers: 0,
      scheduledJobs: 0,
    });
  });
});
