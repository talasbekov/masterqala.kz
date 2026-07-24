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
  function setup(insertError?: Error) {
    const prisma = {
      dispute: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'dispute-1',
          orderId: 'order-1',
          plannedOrderId: null,
          status: 'OPEN',
          evidenceDocIds: ['uuid.png'],
        }),
      },
      order: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ clientId: 'user-1', masterId: 'master-1' }),
      },
      $executeRaw: insertError
        ? jest.fn().mockRejectedValueOnce(insertError)
        : jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: 'evidence-1',
          disputeId: 'dispute-1',
          path: 'uuid.png',
          mimeType: 'image/png',
          sizeBytes: 9,
          scanStatus: 'CLEAN',
          scannedAt: new Date('2026-07-24T08:00:00.000Z'),
        },
      ]),
    };
    const storage = {
      save: jest.fn().mockResolvedValue('uuid.png'),
      remove: jest.fn().mockResolvedValue(undefined),
      absolutePath: jest.fn(),
    };
    const fileScans = { enqueueDisputeEvidence: jest.fn().mockResolvedValue(undefined) };
    return {
      service: new DisputesService(
        prisma as never,
        storage as never,
        fileScans as never,
        {} as never,
        {} as never,
        {} as never,
      ),
      prisma,
      storage,
      fileScans,
    };
  }

  it('создаёт quarantine metadata и сохраняет совместимый ответ спора', async () => {
    const { service, storage, fileScans } = setup();

    const result = await service.addEvidence('user-1', 'dispute-1', pngFile());

    expect(storage.save).toHaveBeenCalledWith(expect.any(Buffer), 'png');
    expect(fileScans.enqueueDisputeEvidence).toHaveBeenCalledWith(expect.any(String));
    expect(result.id).toBe('dispute-1');
    expect(result.evidenceId).toBe('evidence-1');
    expect(result.evidenceDocIds).toEqual(['uuid.png']);
    expect(result.scanStatus).toBe('CLEAN');
    expect(result.statusPath).toContain('/disputes/dispute-1/evidence/');
  });

  it('удаляет файл, если создание quarantine metadata в БД не удалось', async () => {
    const { service, storage } = setup(new Error('database unavailable'));

    await expect(service.addEvidence('user-1', 'dispute-1', pngFile())).rejects.toThrow('database unavailable');

    expect(storage.save).toHaveBeenCalledWith(expect.any(Buffer), 'png');
    expect(storage.remove).toHaveBeenCalledWith('uuid.png');
  });
});
