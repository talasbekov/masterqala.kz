import { Injectable } from '@nestjs/common';
import { AuditActorType, AuditTargetType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogEntry {
  actorType: AuditActorType;
  actorId?: string | null;
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  comment?: string | null;
}

type TxOrPrisma = Prisma.TransactionClient | PrismaService;

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async write(entry: AuditLogEntry, client: TxOrPrisma = this.prisma): Promise<void> {
    await client.auditLog.create({ data: entry });
  }

  async list(page = 1, pageSize = 30) {
    page = Math.max(1, page);
    const skip = (page - 1) * pageSize;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { actor: { select: { name: true, phone: true } } },
      }),
      this.prisma.auditLog.count(),
    ]);
    return { rows, total, page, pageSize };
  }
}
