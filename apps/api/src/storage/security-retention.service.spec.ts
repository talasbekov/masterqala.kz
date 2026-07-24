import { SecurityRetentionService } from './security-retention.service';

describe('SecurityRetentionService', () => {
  function setup() {
    const prisma = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'SECURITY_AUDIT_RETENTION_DAYS') return 365;
        if (key === 'FILE_QUARANTINE_RETENTION_DAYS') return 30;
        if (key === 'CONSUMED_UPLOAD_METADATA_RETENTION_DAYS') return 30;
        if (key === 'UPLOAD_SCAN_MAX_ATTEMPTS') return 3;
        return undefined;
      }),
    };
    const queue = { registerCron: jest.fn() };
    const storage = { remove: jest.fn().mockResolvedValue(undefined) };
    return {
      service: new SecurityRetentionService(
        prisma as never,
        config as never,
        queue as never,
        storage as never,
      ),
      prisma,
      queue,
      storage,
    };
  }

  it('регистрирует ежедневную retention job', () => {
    const { service, queue } = setup();

    service.onModuleInit();

    expect(queue.registerCron).toHaveBeenCalledWith('security-retention', '43 3 * * *', expect.any(Function));
  });

  it('удаляет terminal binaries, чистит metadata и старый audit', async () => {
    const { service, prisma, storage } = setup();
    prisma.$queryRaw
      .mockResolvedValueOnce([{ id: 'upload-1', path: 'upload.png' }])
      .mockResolvedValueOnce([
        { kind: 'MASTER_DOCUMENT', id: 'document-1', path: 'document.pdf' },
        { kind: 'DISPUTE_EVIDENCE', id: 'evidence-1', path: 'evidence.png' },
      ]);

    await service.runRetention(25);

    expect(storage.remove).toHaveBeenCalledWith('upload.png');
    expect(storage.remove).toHaveBeenCalledWith('document.pdf');
    expect(storage.remove).toHaveBeenCalledWith('evidence.png');
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('не останавливает остальные записи при ошибке удаления одного файла', async () => {
    const { service, prisma, storage } = setup();
    prisma.$queryRaw
      .mockResolvedValueOnce([
        { id: 'upload-1', path: 'broken.png' },
        { id: 'upload-2', path: 'healthy.png' },
      ])
      .mockResolvedValueOnce([]);
    storage.remove
      .mockRejectedValueOnce(new Error('disk unavailable'))
      .mockResolvedValueOnce(undefined);

    await service.runRetention(25);

    expect(storage.remove).toHaveBeenCalledWith('broken.png');
    expect(storage.remove).toHaveBeenCalledWith('healthy.png');
  });
});
