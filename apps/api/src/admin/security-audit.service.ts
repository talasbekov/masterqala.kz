import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityAuditQueryDto } from './security-audit.dto';

type SecurityAuditRow = {
  id: string;
  action: string;
  severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
  outcome: 'SUCCESS' | 'REJECTED' | 'ERROR' | 'DELETED';
  resourceType: string;
  resourceId: string;
  actorUserId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

@Injectable()
export class SecurityAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: SecurityAuditQueryDto) {
    const action = query.action ?? null;
    const severity = query.severity ?? null;
    const resourceType = query.resourceType ?? null;
    const resourceId = query.resourceId ?? null;
    const before = query.before ? new Date(query.before) : null;
    const beforeId = query.beforeId ?? null;
    const limit = query.limit ?? 50;

    const rows = await this.prisma.$queryRaw<SecurityAuditRow[]>`
      SELECT
        "id", "action", "severity", "outcome", "resourceType", "resourceId",
        "actorUserId", "metadata", "createdAt"
      FROM "SecurityAuditEvent"
      WHERE (${action}::text IS NULL OR "action" = ${action})
        AND (${severity}::text IS NULL OR "severity" = ${severity})
        AND (${resourceType}::text IS NULL OR "resourceType" = ${resourceType})
        AND (${resourceId}::text IS NULL OR "resourceId" = ${resourceId})
        AND (
          ${before}::timestamp IS NULL
          OR "createdAt" < ${before}
          OR (
            "createdAt" = ${before}
            AND (${beforeId}::text IS NULL OR "id" < ${beforeId})
          )
        )
      ORDER BY "createdAt" DESC, "id" DESC
      LIMIT ${limit}
    `;

    const last = rows.at(-1);
    return {
      items: rows,
      nextCursor: rows.length === limit && last
        ? { before: last.createdAt.toISOString(), beforeId: last.id }
        : null,
    };
  }
}
