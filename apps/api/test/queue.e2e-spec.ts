import { ConfigService } from '@nestjs/config';
import { QueueService } from '../src/queue/queue.service';

describe('QueueService (e2e, реальный pg-boss)', () => {
  const config = new ConfigService({
    DATABASE_URL: 'postgresql://masterqala:masterqala@localhost:5433/masterqala_test',
    PGBOSS_DISABLED: '0',
  });

  it('доставляет джобу зарегистрированному хендлеру', async () => {
    const queue = new QueueService(config);
    const got: any[] = [];
    queue.register('stage2-selftest', async (data) => {
      got.push(data);
    });
    await queue.onApplicationBootstrap();
    await queue.send('stage2-selftest', { ping: 1 });
    const deadline = Date.now() + 15000;
    while (got.length === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 500));
    }
    await queue.onApplicationShutdown();
    expect(got).toEqual([{ ping: 1 }]);
  }, 30000);

  it('send — no-op при PGBOSS_DISABLED=1', async () => {
    const disabled = new QueueService(new ConfigService({ PGBOSS_DISABLED: '1' }));
    await disabled.onApplicationBootstrap();
    await expect(disabled.send('stage2-selftest', {})).resolves.toBeUndefined();
    await disabled.onApplicationShutdown();
  });
});
