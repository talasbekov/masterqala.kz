import { MastersService } from './masters.service';

function jpegFile(originalname = 'passport.jpg'): Express.Multer.File {
  const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
  return {
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: buffer.length,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: undefined as never,
  };
}

function pdfFile(): Express.Multer.File {
  const buffer = Buffer.from('%PDF-1.7\n');
  return {
    fieldname: 'file',
    originalname: 'qualification.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: buffer.length,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: undefined as never,
  };
}

describe('MastersService upload security', () => {
  function setup(options: { cdrMode?: 'BYPASS' | 'REQUIRED'; createError?: Error } = {}) {
    const prisma = {
      masterProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: 'profile-1', status: 'PENDING_REVIEW' }),
      },
      masterDocument: {
        create: options.createError
          ? jest.fn().mockRejectedValue(options.createError)
          : jest.fn().mockResolvedValue({ id: 'document-1' }),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: 'document-1',
          type: 'ID_CARD',
          filePath: 'uuid.jpg',
          originalName: '_passport.exe.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 5,
          scanStatus: 'CLEAN',
          scannedAt: new Date('2026-07-24T08:00:00.000Z'),
          cdrStatus: 'NOT_REQUIRED',
        },
      ]),
    };
    const config = { get: jest.fn().mockReturnValue(options.cdrMode ?? 'BYPASS') };
    const fileScans = { enqueueMasterDocument: jest.fn().mockResolvedValue(undefined) };
    const storage = {
      save: jest.fn().mockResolvedValue('uuid.jpg'),
      remove: jest.fn().mockResolvedValue(undefined),
      absolutePath: jest.fn(),
    };
    return {
      service: new MastersService(prisma as never, config as never, fileScans as never, storage as never),
      prisma,
      config,
      fileScans,
      storage,
    };
  }

  it('сохраняет канонические метаданные и ставит документ на проверку', async () => {
    const { service, prisma, storage, fileScans } = setup();

    await service.uploadDocument('user-1', 'ID_CARD', jpegFile('../passport\u202e.exe.jpg'));

    expect(storage.save).toHaveBeenCalledWith(expect.any(Buffer), 'jpg');
    expect(prisma.masterDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        filePath: 'uuid.jpg',
        originalName: '_passport.exe.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 5,
      }),
      select: { id: true },
    });
    expect(fileScans.enqueueMasterDocument).toHaveBeenCalledWith('document-1');
  });

  it('удаляет уже записанный файл, если создание записи БД упало', async () => {
    const { service, storage } = setup({ createError: new Error('database unavailable') });

    await expect(service.uploadDocument('user-1', 'ID_CARD', jpegFile())).rejects.toThrow('database unavailable');
    expect(storage.remove).toHaveBeenCalledWith('uuid.jpg');
  });

  it('не пишет PDF на диск, когда обязательный CDR ещё не подключён', async () => {
    const { service, prisma, storage, fileScans } = setup({ cdrMode: 'REQUIRED' });

    await expect(service.uploadDocument('user-1', 'QUALIFICATION', pdfFile())).rejects.toThrow(
      'обязательная CDR-обработка ещё не подключена',
    );
    expect(storage.save).not.toHaveBeenCalled();
    expect(prisma.masterDocument.create).not.toHaveBeenCalled();
    expect(fileScans.enqueueMasterDocument).not.toHaveBeenCalled();
  });
});
