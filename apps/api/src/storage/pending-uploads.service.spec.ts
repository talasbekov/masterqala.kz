import { PendingUploadsService } from './pending-uploads.service';

const validated = {
  kind: 'png' as const,
  extension: 'png',
  mimeType: 'image/png',
  originalName: 'photo.png',
  sizeBytes: 9,
};
const path = '123e4567-e89b-42d3-a456-426614174000.png';
const statusRow = {
  id: 'upload-1',
  path,
  mimeType: 'image/png',
  sizeBytes: 9,
  expiresAt: new Date('2026-07-24T18:00:00.000Z'),
  scanStatus: 'PENDING_SCAN',
  scannedAt: null,
};

describe('PendingUploadsService quarantine lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-24T06:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function setup(mode: 'DISABLED' | 'CLAMAV' = 'CLAMAV') {
    const prisma = {
      pendingUpload: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'upload-1', ...data })),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'UPLOAD_TTL_HOURS') return 12;
        if (key === 'FILE_SCAN_MODE') return mode;
        if (key === 'UPLOAD_SCAN_MAX_ATTEMPTS') return 3;
        return undefined;
      }),
    };
    const queue = {
      register: jest.fn(),
      registerCron: jest.fn(),
      send: jest.fn().mockResolvedValue(undefined),
    };
    const storage = {
      save: jest.fn().mockResolvedValue(path),
      remove: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(true),
      absolutePath: jest.fn().mockReturnValue(`/uploads/${path}`),
    };
    const scanner = { scan: jest.fn().mockResolvedValue({ status: 'CLEAN' }) };
    return {
      service: new PendingUploadsService(
        prisma as never,
        config as never,
        queue as never,
        storage as never,
        scanner as never,
      ),
      prisma,
      queue,
      storage,
      scanner,
    };
  }

  it('регистрирует CLAMAV upload как pending и ставит scan job', async () => {
    const { service, prisma, queue } = setup('CLAMAV');
    prisma.$queryRaw.mockResolvedValue([statusRow]);

    await expect(service.register('user-1', Buffer.from('png'), validated)).resolves.toEqual({
      path,
      mimeType: 'image/png',
      sizeBytes: 9,
      expiresAt: new Date('2026-07-24T18:00:00.000Z'),
      scanStatus: 'PENDING_SCAN',
      scannedAt: null,
    });
    expect(queue.send).toHaveBeenCalledWith('pending-upload-scan', { pendingUploadId: 'upload-1' });
  });

  it('в test/development синхронно переводит upload в CLEAN', async () => {
    const { service, prisma, scanner, queue } = setup('DISABLED');
    prisma.$queryRaw
      .mockResolvedValueOnce([{ id: 'upload-1', path }])
      .mockResolvedValueOnce([{ ...statusRow, scanStatus: 'CLEAN', scannedAt: new Date() }]);

    await service.register('user-1', Buffer.from('png'), validated);

    expect(scanner.scan).toHaveBeenCalledWith(`/uploads/${path}`);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(queue.send).not.toHaveBeenCalled();
  });

  it('помечает заражённый файл и удаляет его из quarantine storage', async () => {
    const { service, prisma, scanner, storage } = setup();
    prisma.$queryRaw.mockResolvedValue([{ id: 'upload-1', path }]);
    scanner.scan.mockResolvedValue({ status: 'INFECTED', signature: 'Eicar-Signature' });

    await service.scanUpload('upload-1');

    expect(storage.remove).toHaveBeenCalledWith(path);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('оставляет scanner error в fail-closed статусе и пробрасывает ошибку', async () => {
    const { service, prisma, scanner, storage } = setup();
    prisma.$queryRaw.mockResolvedValue([{ id: 'upload-1', path }]);
    scanner.scan.mockRejectedValue(new Error('clamd unavailable'));

    await expect(service.scanUpload('upload-1')).rejects.toThrow('clamd unavailable');
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('удаляет orphan, если регистрация в БД не удалась', async () => {
    const { service, prisma, storage } = setup();
    prisma.pendingUpload.create.mockRejectedValue(new Error('database unavailable'));
    prisma.pendingUpload.count.mockResolvedValue(0);

    await expect(service.register('user-1', Buffer.from('png'), validated)).rejects.toThrow('database unavailable');
    expect(storage.remove).toHaveBeenCalledWith(path);
  });

  it('возвращает pending/failed uploads в scan queue', async () => {
    const { service, prisma, queue } = setup('CLAMAV');
    prisma.$queryRaw.mockResolvedValue([{ id: 'upload-1' }, { id: 'upload-2' }]);

    await service.scanPending(25);

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(queue.send).toHaveBeenNthCalledWith(1, 'pending-upload-scan', { pendingUploadId: 'upload-1' });
    expect(queue.send).toHaveBeenNthCalledWith(2, 'pending-upload-scan', { pendingUploadId: 'upload-2' });
  });

  it('удаляет только истёкшие непривязанные uploads', async () => {
    const { service, prisma, storage } = setup();
    prisma.pendingUpload.findMany.mockResolvedValue([{ id: 'upload-1', path }]);

    await service.cleanupExpired(25);

    expect(storage.remove).toHaveBeenCalledWith(path);
    expect(prisma.pendingUpload.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'upload-1',
        consumedAt: null,
        expiresAt: { lte: new Date('2026-07-24T06:00:00.000Z') },
      },
    });
  });

  it('регистрирует scan worker, retry sweep и cleanup cron', () => {
    const { service, queue } = setup();

    service.onModuleInit();

    expect(queue.register).toHaveBeenCalledWith('pending-upload-scan', expect.any(Function));
    expect(queue.registerCron).toHaveBeenCalledWith('pending-upload-scan-sweep', '*/5 * * * *', expect.any(Function));
    expect(queue.registerCron).toHaveBeenCalledWith('pending-upload-cleanup', '17 * * * *', expect.any(Function));
  });
});
