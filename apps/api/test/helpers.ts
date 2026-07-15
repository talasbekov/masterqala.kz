import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

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
    'TRUNCATE "User","SmsCode","Category","MasterProfile","MasterCategory","MasterDocument","VerificationDecision","Order","OrderOffer","MasterPresence","PaymentTransaction","Accrual" CASCADE',
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

export async function createOrderViaApi(
  app: INestApplication,
  clientToken: string,
  categoryId: string,
  point: { lat: number; lng: number } = ALMATY,
) {
  const res = await request(app.getHttpServer())
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${clientToken}`)
    .send({ categoryId, description: 'Прорвало трубу', address: 'ул. Абая, 1', ...point })
    .expect(201);
  return res.body;
}
