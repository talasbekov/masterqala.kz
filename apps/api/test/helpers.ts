import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

export async function resetDb(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.$executeRawUnsafe(
    'TRUNCATE "User","SmsCode","Category","MasterProfile","MasterCategory","MasterDocument","VerificationDecision" CASCADE',
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
