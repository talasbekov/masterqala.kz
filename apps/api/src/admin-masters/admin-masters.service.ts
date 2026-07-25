import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewsService } from '../reviews/reviews.service';

@Injectable()
export class AdminMastersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewsService,
  ) {}

  async list(categorySlug?: string, district?: string) {
    const profiles = await this.prisma.masterProfile.findMany({
      where: {
        status: 'ACTIVE',
        district: district ?? undefined,
        categories: categorySlug ? { some: { category: { slug: categorySlug } } } : undefined,
      },
      include: {
        user: {
          select: { id: true, name: true, _count: { select: { masterOrders: true, masterPlannedOrders: true } }, presence: { select: { isOnline: true } } },
        },
        categories: { include: { category: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const base = profiles.map((p) => {
      let status: string;
      // priorityPenaltyUntil сознательно не показываем: волна рассылается всем
      // кандидатам одновременно, порядок кандидатов ни на что не влияет — значит
      // понижения приоритета фактически не существует, и статус вводил бы
      // оператора в заблуждение. Действующие санкции — списание кредитов и
      // blockedUntil. См. docs/STATUS.md.
      if (p.blockedUntil && p.blockedUntil > now) {
        status = `блокирован до ${p.blockedUntil.toISOString()}`;
      } else {
        status = p.user.presence?.isOnline ? 'активен · онлайн' : 'активен · офлайн';
      }
      return {
        id: p.id,
        categories: p.categories.map((c) => c.category.name),
        orders: p.user._count.masterOrders + p.user._count.masterPlannedOrders,
        status,
        master: { id: p.userId, name: p.user.name ?? p.fullName },
      };
    });

    const enriched = await this.reviews.attachRatingToAll(base);
    return enriched.map(({ master, ...rest }: any) => ({
      ...rest,
      name: master.name,
      rating: master.rating ?? null,
      reviewCount: master.reviewCount ?? 0,
    }));
  }
}
