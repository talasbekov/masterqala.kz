import { PendingUploadsService } from './pending-uploads.service';

const validated = {
  kind: 'png' as const,
  extension: 'png',
  mimeType: 'image/png',
  originalName: 'photo.png',
  sizeBytes: 9,
};

describe('PendingUploadsService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-24T06:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function setup() {
    const prisma = {
      pendingUpload: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'upload-1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const config = { get: jest.fn().mockReturnValue(12) };
    const queue = { registerCron: jest.fn() };
    const storage = {
      save: jest.fn().mockResolvedValue('123e4567-e89b-42d3-a456-426614174000.png'),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    return {
      service: new PendingUploadsService(prisma as never, config as never, queue as never, storage as never),
      prisma,
      config,
      queue,
      storage,
    };
  }

  it('регистрирует upload за пользователем с TTL из конфигурации', async () => {
    const { service, prisma, storage } = setup();

    await expect(service.register('user-1', Buffer.from('png'), validated)).resolves.toEqual({
      path: '123e4567-e89b-42d3-a456-426614174000.png',
      mimeType: 'image/png',
      sizeBytes: 9,
      expiresAt: new Date('2026-07-24T18:00:00.000Z'),
    });
    expect(storage.save).toHaveBeenCalledWith(expect.any(Buffer), 'png');
    expect(prisma.pendingUpload.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        path: '123e4567-e89b-42d3-a456-426614174000.png',
        mimeType: 'image/png',
        sizeBytes: 9,
        expiresAt: new Date('2026-07-24T18:00:00.000Z'),
      },
    });
  });

  it('удаляет файл, если регистрация в БД не удалась', async () => {
    const { service, prisma, storage } = setup();
    prisma.pendingUpload.create.mockRejectedValue(new Error('database unavailable'));

    await expect(service.register('user-1', Buffer.from('png'), validated)).rejects.toThrow('database unavailable');
    expect(storage.remove).toHaveBeenCalledWith('123e4567-e89b-42d3-a456-426614174000.png');
  });

  it('удаляет только истёкшие непривязанные uploads', async () => {
    const { service, prisma, storage } = setup();
    prisma.pendingUpload.findMany.mockResolvedValue([
      { id: 'upload-1', path: '123e4567-e89b-42d3-a456-426614174000.png' },
    ]);

    await service.cleanupExpired(25);

    expect(prisma.pendingUpload.findMany).toHaveBeenCalledWith({
      where: { consumedAt: null, expiresAt: { lte: new Date('2026-07-24T06:00:00.000Z') } },
      orderBy: { expiresAt: 'asc' },
      take: 25,
      select: { id: true, path: true },
    });
    expect(storage.remove).toHaveBeenCalledWith('123e4567-e89b-42d3-a456-426614174000.png');
    expect(prisma.pendingUpload.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'upload-1',
        consumedAt: null,
        expiresAt: { lte: new Date('2026-07-24T06:00:00.000Z') },
      },
    });
  });

  it('регистрирует ежечасный cleanup с фиксированным смещением', () => {
    const { service, queue } = setup();

    service.onModuleInit();

    expect(queue.registerCron).toHaveBeenCalledWith('pending-upload-cleanup', '17 * * * *', expect.any(Function));
  });
});
