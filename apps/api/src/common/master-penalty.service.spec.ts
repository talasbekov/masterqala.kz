import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { MasterPenaltyService } from './master-penalty.service';

describe('MasterPenaltyService — скользящее окно 30 дней', () => {
  let service: MasterPenaltyService;
  let countMock: jest.Mock;
  let updateManyProfileMock: jest.Mock;

  function makeTx(cancellationsInWindow: number) {
    countMock = jest.fn().mockResolvedValue(cancellationsInWindow);
    updateManyProfileMock = jest.fn().mockResolvedValue({ count: 1 });
    return {
      leadCreditAccount: { upsert: jest.fn().mockResolvedValue({}) },
      leadCreditTransaction: { create: jest.fn().mockResolvedValue({}) },
      masterProfile: { updateMany: updateManyProfileMock },
      masterCancellation: { create: jest.fn().mockResolvedValue({}), count: countMock },
    } as any;
  }

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [MasterPenaltyService, { provide: PrismaService, useValue: {} }],
    }).compile();
    service = moduleRef.get(MasterPenaltyService);
  });

  it('2-я отмена в окне не блокирует', async () => {
    const tx = makeTx(2);
    await service.penalizeForCancellation(tx, 'master-1', 'URGENT', 'order-1');
    const blockCall = updateManyProfileMock.mock.calls.find((c) => 'blockedUntil' in c[0].data);
    expect(blockCall).toBeUndefined();
  });

  it('3-я отмена в окне блокирует на 7 дней', async () => {
    const tx = makeTx(3);
    await service.penalizeForCancellation(tx, 'master-1', 'URGENT', 'order-1');
    const blockCall = updateManyProfileMock.mock.calls.find((c) => 'blockedUntil' in c[0].data);
    expect(blockCall).toBeDefined();
    const blockedUntil: Date = blockCall![0].data.blockedUntil;
    const expectedMs = Date.now() + 7 * 24 * 3600 * 1000;
    expect(Math.abs(blockedUntil.getTime() - expectedMs)).toBeLessThan(5000);
  });

  it('applyPenalty не создаёт запись MasterCancellation и не блокирует', async () => {
    const tx = makeTx(0);
    await service.applyPenalty(tx, 'master-1');
    expect(tx.masterCancellation.create).not.toHaveBeenCalled();
    expect(updateManyProfileMock.mock.calls.some((c) => 'blockedUntil' in c[0].data)).toBe(false);
  });
});
