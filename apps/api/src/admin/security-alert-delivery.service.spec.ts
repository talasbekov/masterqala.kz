import { createHmac } from 'crypto';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { SecurityAlertDeliveryService } from './security-alert-delivery.service';

async function startWebhook(statusCode = 204) {
  let body = '';
  let headers: Record<string, string | string[] | undefined> = {};
  const server = createServer((request, response) => {
    headers = request.headers;
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      response.statusCode = statusCode;
      response.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    server,
    url: `http://127.0.0.1:${port}/security`,
    read: () => ({ body, headers }),
  };
}

const alert = {
  id: 'alert-1',
  ruleKey: 'MALWARE_DETECTED',
  severity: 'CRITICAL',
  title: 'Обнаружен заражённый файл',
  resourceType: 'PENDING_UPLOAD',
  resourceId: 'upload-1',
  status: 'OPEN',
  occurrenceCount: 1,
  firstSeenAt: new Date('2026-07-25T10:00:00.000Z'),
  lastSeenAt: new Date('2026-07-25T10:00:00.000Z'),
  acknowledgeBy: new Date('2026-07-25T10:15:00.000Z'),
  resolveBy: new Date('2026-07-25T12:00:00.000Z'),
  escalationLevel: 0,
};

describe('SecurityAlertDeliveryService', () => {
  function setup(url: string, maxAttempts = 3) {
    const prisma: any = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    prisma.$transaction = jest.fn(async (callback: (tx: any) => unknown) => callback(prisma));
    const config = {
      get: jest.fn((key: string) => ({
        SECURITY_ALERT_WEBHOOK_URL: url,
        SECURITY_ALERT_WEBHOOK_SECRET: 'webhook-test-secret-with-at-least-32-chars',
        SECURITY_ALERT_WEBHOOK_TIMEOUT_MS: 2000,
        SECURITY_ALERT_DELIVERY_MAX_ATTEMPTS: maxAttempts,
      }[key])),
    };
    const queue = {
      register: jest.fn(),
      registerCron: jest.fn(),
      send: jest.fn().mockResolvedValue(undefined),
      healthCheck: jest.fn().mockReturnValue({ status: 'DISABLED' }),
    };
    return {
      service: new SecurityAlertDeliveryService(prisma, config as never, queue as never),
      prisma,
      queue,
    };
  }

  afterEach(() => jest.restoreAllMocks());

  it('регистрирует delivery worker и два sweep job', () => {
    const { service, queue } = setup('http://127.0.0.1:1/hook');
    service.onModuleInit();

    expect(queue.register).toHaveBeenCalledWith('security-alert-delivery', expect.any(Function));
    expect(queue.registerCron).toHaveBeenCalledWith('security-alert-delivery-sweep', '* * * * *', expect.any(Function));
    expect(queue.registerCron).toHaveBeenCalledWith('security-alert-sla-sweep', '* * * * *', expect.any(Function));
  });

  it('отправляет минимальный payload с корректной HMAC подписью', async () => {
    const webhook = await startWebhook();
    const { service, prisma } = setup(webhook.url);
    prisma.$queryRaw
      .mockResolvedValueOnce([{ id: 'delivery-1', alertId: 'alert-1', reason: 'INITIAL', attemptCount: 1 }])
      .mockResolvedValueOnce([alert]);

    try {
      await service.deliver('delivery-1');
      await new Promise((resolve) => setImmediate(resolve));
      const received = webhook.read();
      const expected = createHmac('sha256', 'webhook-test-secret-with-at-least-32-chars')
        .update(received.body)
        .digest('hex');

      expect(received.headers['x-masterqala-event']).toBe('security.alert');
      expect(received.headers['x-masterqala-delivery']).toBe('delivery-1');
      expect(received.headers['x-masterqala-signature']).toBe(`sha256=${expected}`);
      expect(JSON.parse(received.body)).toMatchObject({
        event: 'security.alert',
        deliveryId: 'delivery-1',
        reason: 'INITIAL',
        alert: {
          id: 'alert-1',
          ruleKey: 'MALWARE_DETECTED',
          severity: 'CRITICAL',
          resourceType: 'PENDING_UPLOAD',
          resourceId: 'upload-1',
        },
      });
      expect(received.body).not.toContain('phone');
      expect(received.body).not.toContain('scanError');
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    } finally {
      await new Promise<void>((resolve) => (webhook.server as Server).close(() => resolve()));
    }
  });

  it('после последней HTTP ошибки переводит delivery в EXHAUSTED и пишет audit', async () => {
    const webhook = await startWebhook(503);
    const { service, prisma } = setup(webhook.url, 3);
    prisma.$queryRaw
      .mockResolvedValueOnce([{ id: 'delivery-1', alertId: 'alert-1', reason: 'INITIAL', attemptCount: 3 }])
      .mockResolvedValueOnce([alert]);

    try {
      await service.deliver('delivery-1');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    } finally {
      await new Promise<void>((resolve) => (webhook.server as Server).close(() => resolve()));
    }
  });

  it('не делает запросы, когда webhook отключён', async () => {
    const prisma = { $queryRaw: jest.fn(), $executeRaw: jest.fn() };
    const config = { get: jest.fn(() => undefined) };
    const queue = { register: jest.fn(), registerCron: jest.fn(), send: jest.fn(), healthCheck: jest.fn() };
    const service = new SecurityAlertDeliveryService(prisma as never, config as never, queue as never);

    await service.dispatchPending();
    await service.deliver('delivery-1');

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
