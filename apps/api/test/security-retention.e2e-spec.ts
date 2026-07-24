import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { FILE_STORAGE, FileStorage } from '../src/storage/storage.interface';
import { SecurityRetentionService } from '../src/storage/security-retention.service';
import { createTestApp, resetDb, TEST_PNG_BYTES } from './helpers';

describe('Security retention policy (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: FileStorage;
  let retention: SecurityRetentionService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    storage = app.get(FILE_STORAGE);
    retention = app.get(SecurityRetentionService);
  });

  beforeEach(async () => {
    await resetDb(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('сохраняет order binary, удаляет terminal binaries и чистит старый audit', async () => {
    const user = await prisma.user.create({ data: { phone: '+77073330001' } });
    const category = await prisma.category.create({ data: { slug: 'retention', name: 'Retention' } });
    const profile = await prisma.masterProfile.create({
      data: {
        userId: user.id,
        fullName: 'Retention Master',
        iin: '900101300123',
        district: 'Алмалинский',
        experienceYears: 5,
        categories: { create: [{ categoryId: category.id }] },
      },
    });
    const oldDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);

    const consumedPath = await storage.save(TEST_PNG_BYTES, 'png');
    const consumedId = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "PendingUpload" (
        "id", "userId", "path", "mimeType", "sizeBytes", "expiresAt", "consumedAt",
        "createdAt", "scanStatus", "scanAttempts", "scannedAt"
      ) VALUES (
        ${consumedId}, ${user.id}, ${consumedPath}, 'image/png', ${TEST_PNG_BYTES.length},
        ${oldDate}, ${oldDate}, ${oldDate}, 'CLEAN', 1, ${oldDate}
      )
    `;

    const infectedPath = await storage.save(TEST_PNG_BYTES, 'png');
    const infectedId = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "PendingUpload" (
        "id", "userId", "path", "mimeType", "sizeBytes", "expiresAt",
        "createdAt", "scanStatus", "scanAttempts", "scannedAt", "scanError"
      ) VALUES (
        ${infectedId}, ${user.id}, ${infectedPath}, 'image/png', ${TEST_PNG_BYTES.length},
        ${oldDate}, ${oldDate}, 'INFECTED', 1, ${oldDate}, 'Eicar-Test-Signature'
      )
    `;

    const documentPath = await storage.save(TEST_PNG_BYTES, 'png');
    const document = await prisma.masterDocument.create({
      data: {
        masterProfileId: profile.id,
        type: 'ID_CARD',
        filePath: documentPath,
        originalName: 'failed.png',
        mimeType: 'image/png',
        sizeBytes: TEST_PNG_BYTES.length,
      },
    });
    await prisma.$executeRaw`
      UPDATE "MasterDocument"
      SET "scanStatus" = 'SCAN_FAILED',
          "scanAttempts" = 3,
          "scannedAt" = ${oldDate},
          "scanError" = 'clamd unavailable',
          "createdAt" = ${oldDate}
      WHERE "id" = ${document.id}
    `;

    const oldAuditId = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "SecurityAuditEvent" (
        "id", "action", "severity", "outcome", "resourceType", "resourceId", "createdAt"
      ) VALUES (
        ${oldAuditId}, 'OLD_EVENT', 'INFO', 'SUCCESS', 'SYSTEM', 'old', ${oldDate}
      )
    `;

    await retention.runRetention(100);

    const consumedCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS "count" FROM "PendingUpload" WHERE "id" = ${consumedId}
    `;
    expect(Number(consumedCount[0].count)).toBe(0);
    expect(await storage.exists(consumedPath)).toBe(true);

    const infectedCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS "count" FROM "PendingUpload" WHERE "id" = ${infectedId}
    `;
    expect(Number(infectedCount[0].count)).toBe(0);
    expect(await storage.exists(infectedPath)).toBe(false);

    const documentRows = await prisma.$queryRaw<Array<{ purgedAt: Date | null; scanError: string | null }>>`
      SELECT "purgedAt", "scanError" FROM "MasterDocument" WHERE "id" = ${document.id}
    `;
    expect(documentRows[0].purgedAt).toBeInstanceOf(Date);
    expect(documentRows[0].scanError).toBeNull();
    expect(await storage.exists(documentPath)).toBe(false);

    const oldAuditCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS "count" FROM "SecurityAuditEvent" WHERE "id" = ${oldAuditId}
    `;
    expect(Number(oldAuditCount[0].count)).toBe(0);

    const summary = await prisma.$queryRaw<Array<{ metadata: { deletedCount: number } }>>`
      SELECT "metadata" FROM "SecurityAuditEvent"
      WHERE "action" = 'SECURITY_AUDIT_RETENTION_PURGE'
      ORDER BY "createdAt" DESC LIMIT 1
    `;
    expect(summary[0].metadata.deletedCount).toBeGreaterThan(0);
  });
});
