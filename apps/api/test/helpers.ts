import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

export const TEST_PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

export async function createTestApp(opts: { listen?: boolean } = {}): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  if (opts.listen) {
    await app.listen(0);
  } else {
    await app.init();
  }
  return app;
}

export async function resetDb(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.$executeRawUnsafe(
    'TRUNCATE "SecurityAuditEvent","DisputeEvidence","PendingUpload","User","SmsCode","Category","MasterProfile","MasterCategory","MasterDocument","VerificationDecision","Order","OrderOffer","MasterPresence","PaymentTransaction","Accrual","PlannedOrder","PlannedOrderBid","LeadCreditAccount","LeadCreditTransaction","LeadCreditPurchase","MasterWalletAccount","WithdrawalRequest","Dispute","MasterCancellation","OrderPhoto","PlannedOrderPhoto","Address" CASCADE',
  );
}

export async function seedCategories(app: INestApplication) {
  const prisma = app.get(PrismaService);
  const plumbing = await prisma.category.create({ data: { slug: 'plumbing', name: 'Сантехника' } });
  const electrics = await prisma.category.create({ data: { slug: 'electrics', name: 'Электрика' } });
  return { plumbing, electrics };
}

export async function loginAs(
  app: INestApplication,
  phone: string,
  role: UserRole = 'CLIENT',
): Promise<{ token: string; userId: string }> {
  const prisma = app.get(PrismaService);
  await request(app.getHttpServer()).post('/api/v1/auth/request-code').send({ phone }).expect(204);
  const code = await prisma.smsCode.findFirstOrThrow({ where: { phone }, orderBy: { createdAt: 'desc' } });
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/verify-code')
    .send({ phone, code: code.code })
    .expect(200);
  if (role !== 'CLIENT') {
    await prisma.user.update({ where: { id: res.body.user.id }, data: { role } });
  }
  return { token: res.body.accessToken, userId: res.body.user.id };
}

export const ALMATY = { lat: 43.2389, lng: 76.8897 };

/** Точка в km километрах к северу от ALMATY (1° широты ≈ 110.6 км). */
export function pointAtKm(km: number) {
  return { lat: ALMATY.lat + km / 110.6, lng: ALMATY.lng };
}

export async function setMasterOnline(
  app: INestApplication,
  userId: string,
  point: { lat: number; lng: number } = ALMATY,
) {
  const prisma = app.get(PrismaService);
  await prisma.masterPresence.upsert({
    where: { masterUserId: userId },
    create: { masterUserId: userId, isOnline: true },
    update: { isOnline: true, lastSeenAt: new Date() },
  });
  await prisma.$executeRaw`UPDATE "MasterPresence" SET location = ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography WHERE "masterUserId" = ${userId}`;
}

export async function setMasterOffline(app: INestApplication, userId: string) {
  const prisma = app.get(PrismaService);
  await prisma.masterPresence.updateMany({ where: { masterUserId: userId }, data: { isOnline: false } });
}

export async function createActiveMaster(
  app: INestApplication,
  phone: string,
  categoryId: string,
  point: { lat: number; lng: number } = ALMATY,
): Promise<{ token: string; userId: string }> {
  const { token, userId } = await loginAs(app, phone);
  const prisma = app.get(PrismaService);
  await prisma.masterProfile.create({
    data: {
      userId,
      fullName: `Мастер ${phone}`,
      iin: '850101300123',
      district: 'Алмалинский',
      experienceYears: 5,
      status: 'ACTIVE',
      categories: { create: [{ categoryId }] },
    },
  });
  await setMasterOnline(app, userId, point);
  return { token, userId };
}

export async function uploadPngViaApi(app: INestApplication, token: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/v1/uploads')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', TEST_PNG_BYTES, { filename: 'photo.png', contentType: 'image/png' })
    .expect(201);

  return response.body.path as string;
}

export async function createOrderViaApi(
  app: INestApplication,
  clientToken: string,
  categoryId: string,
  point: { lat: number; lng: number } = ALMATY,
) {
  const res = await request(app.getHttpServer())
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${clientToken}`)
    .send({ categoryId, description: 'Прорвало трубу', address: 'ул. Абая, 1', district: 'Есильский район', ...point })
    .expect(201);
  return res.body;
}

export async function grantLeadCredits(app: INestApplication, masterUserId: string, amount: number): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.leadCreditAccount.upsert({
    where: { masterUserId },
    create: { masterUserId, balance: amount },
    update: { balance: { increment: amount } },
  });
}

export async function createPlannedOrderViaApi(
  app: INestApplication,
  clientToken: string,
  categoryId: string,
  overrides: Partial<{
    description: string;
    address: string;
    district: string;
    slotStart: string;
    slotEnd: string;
    budget: number;
    photoPaths: string[];
  }> = {},
) {
  const slotStart = overrides.slotStart ?? new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const slotEnd = overrides.slotEnd ?? new Date(new Date(slotStart).getTime() + 2 * 3600 * 1000).toISOString();
  const res = await request(app.getHttpServer())
    .post('/api/v1/planned-orders')
    .set('Authorization', `Bearer ${clientToken}`)
    .send({
      categoryId,
      description: overrides.description ?? 'Установить новый смеситель',
      address: overrides.address ?? 'ул. Абая, 1',
      district: overrides.district ?? 'Алмалинский',
      slotStart,
      slotEnd,
      budget: overrides.budget,
      photoPaths: overrides.photoPaths,
    })
    .expect(201);
  return res.body;
}
