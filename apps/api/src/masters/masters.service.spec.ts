import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PersistentFileScansService } from '../storage/persistent-file-scans.service';
import { FILE_STORAGE } from '../storage/storage.interface';
import { ReviewsService } from '../reviews/reviews.service';
import { MastersService } from './masters.service';

describe('MastersService.getMyStats', () => {
  let service: MastersService;
  let prisma: { order: { count: jest.Mock }; plannedOrder: { count: jest.Mock }; accrual: { aggregate: jest.Mock } };
  let reviews: { getMasterRatingSummary: jest.Mock };

  beforeEach(async () => {
    prisma = {
      order: { count: jest.fn() },
      plannedOrder: { count: jest.fn() },
      accrual: { aggregate: jest.fn() },
    };
    reviews = { getMasterRatingSummary: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MastersService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: PersistentFileScansService, useValue: {} },
        { provide: FILE_STORAGE, useValue: {} },
        { provide: ReviewsService, useValue: reviews },
      ],
    }).compile();
    service = moduleRef.get(MastersService);
  });

  it('суммирует завершённые срочные и плановые заявки, заработок и рейтинг', async () => {
    prisma.order.count.mockResolvedValue(7);
    prisma.plannedOrder.count.mockResolvedValue(3);
    prisma.accrual.aggregate.mockResolvedValue({ _sum: { amount: 42000 } });
    reviews.getMasterRatingSummary.mockResolvedValue({ rating: 4.8, reviewCount: 12 });

    const stats = await service.getMyStats('m1');

    expect(stats).toEqual({ completedCount: 10, earnings: 42000, rating: 4.8, reviewCount: 12 });
    expect(prisma.order.count).toHaveBeenCalledWith({ where: { masterId: 'm1', status: 'CLOSED' } });
    expect(prisma.plannedOrder.count).toHaveBeenCalledWith({ where: { masterId: 'm1', status: 'CLOSED' } });
    expect(prisma.accrual.aggregate).toHaveBeenCalledWith({ where: { masterUserId: 'm1' }, _sum: { amount: true } });
    expect(reviews.getMasterRatingSummary).toHaveBeenCalledWith('m1');
  });

  it('заработок 0, если начислений ещё не было', async () => {
    prisma.order.count.mockResolvedValue(0);
    prisma.plannedOrder.count.mockResolvedValue(0);
    prisma.accrual.aggregate.mockResolvedValue({ _sum: { amount: null } });
    reviews.getMasterRatingSummary.mockResolvedValue({ rating: null, reviewCount: 0 });

    const stats = await service.getMyStats('m1');

    expect(stats).toEqual({ completedCount: 0, earnings: 0, rating: null, reviewCount: 0 });
  });
});
