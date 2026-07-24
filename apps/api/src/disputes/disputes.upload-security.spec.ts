import { DisputesService } from './disputes.service';

function pngFile(): Express.Multer.File {
  const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  return {
    fieldname: 'file',
    originalname: 'evidence.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: buffer.length,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: undefined as never,
  };
}

describe('DisputesService evidence upload security', () => {
  it('удаляет файл, если привязка доказательства в БД не удалась', async () => {
    const prisma = {
      dispute: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'dispute-1',
          orderId: 'order-1',
          plannedOrderId: null,
          status: 'OPEN',
        }),
        update: jest.fn().mockRejectedValue(new Error('database unavailable')),
      },
      order: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ clientId: 'user-1', masterId: 'master-1' }),
      },
    };
    const storage = {
      save: jest.fn().mockResolvedValue('uuid.png'),
      remove: jest.fn().mockResolvedValue(undefined),
      absolutePath: jest.fn(),
    };
    const service = new DisputesService(
      prisma as never,
      storage as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.addEvidence('user-1', 'dispute-1', pngFile())).rejects.toThrow('database unavailable');

    expect(storage.save).toHaveBeenCalledWith(expect.any(Buffer), 'png');
    expect(storage.remove).toHaveBeenCalledWith('uuid.png');
  });
});
