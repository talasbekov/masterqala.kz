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

describe('MastersService upload security', () => {
  it('сохраняет только канонические и очищенные метаданные', async () => {
    const prisma = {
      masterProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: 'profile-1', status: 'PENDING_REVIEW' }),
      },
      masterDocument: {
        create: jest.fn().mockResolvedValue({ id: 'document-1' }),
      },
    };
    const storage = {
      save: jest.fn().mockResolvedValue('uuid.jpg'),
      remove: jest.fn(),
      absolutePath: jest.fn(),
    };
    const service = new MastersService(prisma as never, storage as never);

    await service.uploadDocument('user-1', 'ID_CARD', jpegFile('../passport\u202e.exe.jpg'));

    expect(storage.save).toHaveBeenCalledWith(expect.any(Buffer), 'jpg');
    expect(prisma.masterDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        filePath: 'uuid.jpg',
        originalName: '_passport.exe.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 5,
      }),
    });
  });

  it('удаляет уже записанный файл, если создание записи БД упало', async () => {
    const prisma = {
      masterProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: 'profile-1', status: 'PENDING_REVIEW' }),
      },
      masterDocument: {
        create: jest.fn().mockRejectedValue(new Error('database unavailable')),
      },
    };
    const storage = {
      save: jest.fn().mockResolvedValue('uuid.jpg'),
      remove: jest.fn().mockResolvedValue(undefined),
      absolutePath: jest.fn(),
    };
    const service = new MastersService(prisma as never, storage as never);

    await expect(service.uploadDocument('user-1', 'ID_CARD', jpegFile())).rejects.toThrow('database unavailable');
    expect(storage.remove).toHaveBeenCalledWith('uuid.jpg');
  });
});
