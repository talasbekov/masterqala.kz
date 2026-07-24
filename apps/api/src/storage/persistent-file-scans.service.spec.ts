import { PersistentFileScansService } from './persistent-file-scans.service';

describe('PersistentFileScansService', () => {
  function setup(scanResult: { status: 'CLEAN' } | { status: 'INFECTED'; signature?: string } = { status: 'CLEAN' }) {
    const prisma = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'FILE_SCAN_MODE') return 'DISABLED';
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
      exists: jest.fn().mockResolvedValue(true),
      absolutePath: jest.fn((path: string) => `/secure/${path}`),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const scanner = { scan: jest.fn().mockResolvedValue(scanResult) };
    return {
      service: new PersistentFileScansService(
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

  it('регистрирует две очереди и общий retry sweep', () => {
    const { service, queue } = setup();

    service.onModuleInit();

    expect(queue.register).toHaveBeenCalledTimes(2);
    expect(queue.registerCron).toHaveBeenCalledWith('persistent-file-scan-sweep', '*/5 * * * *', expect.any(Function));
  });

  it('атомарно claim-ит и помечает документ CLEAN', async () => {
    const { service, prisma, storage, scanner } = setup();
    prisma.$queryRaw.mockResolvedValueOnce([{ id: 'document-1', path: 'document.png' }]);

    await service.scanMasterDocument('document-1');

    expect(storage.exists).toHaveBeenCalledWith('document.png');
    expect(scanner.scan).toHaveBeenCalledWith('/secure/document.png');
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('помечает evidence INFECTED и удаляет файл', async () => {
    const { service, prisma, storage } = setup({ status: 'INFECTED', signature: 'Eicar-Test-Signature' });
    prisma.$queryRaw.mockResolvedValueOnce([{ id: 'evidence-1', path: 'evidence.png' }]);

    await service.scanDisputeEvidence('evidence-1');

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(storage.remove).toHaveBeenCalledWith('evidence.png');
  });

  it('переводит запись в SCAN_FAILED при ошибке scanner', async () => {
    const { service, prisma, scanner } = setup();
    prisma.$queryRaw.mockResolvedValueOnce([{ id: 'document-1', path: 'document.png' }]);
    scanner.scan.mockRejectedValueOnce(new Error('clamd unavailable'));

    await expect(service.scanMasterDocument('document-1')).rejects.toThrow('clamd unavailable');

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
