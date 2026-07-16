import { INestApplication } from '@nestjs/common';
import { createTestApp, resetDb, seedCategories, loginAs, ALMATY } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from '../src/payments/payment.interface';

describe('MockPaymentProvider (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let payments: PaymentProvider;
  let orderId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    payments = app.get(PAYMENT_PROVIDER);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    const { userId } = await loginAs(app, '+77010000001');
    const order = await prisma.order.create({
      data: {
        clientId: userId, categoryId: plumbing.id, description: 'т', address: 'а',
        calloutPrice: 3000, serviceFee: 1200,
      },
    });
    orderId = order.id;
  });

  it('hold пишет SUCCEEDED-транзакцию HOLD', async () => {
    const tx = await payments.hold(orderId, 1200);
    expect(tx).toMatchObject({ orderId, type: 'HOLD', amount: 1200, status: 'SUCCEEDED' });
    expect(tx.providerRef).toMatch(/^mock-/);
  });

  it('capture берёт сумму холда и идемпотентен', async () => {
    await payments.hold(orderId, 1200);
    const c1 = await payments.capture(orderId);
    const c2 = await payments.capture(orderId);
    expect(c1.amount).toBe(1200);
    expect(c2.id).toBe(c1.id);
    expect(await prisma.paymentTransaction.count({ where: { orderId, type: 'CAPTURE' } })).toBe(1);
  });

  it('void идемпотентен', async () => {
    await payments.hold(orderId, 1200);
    const v1 = await payments.void(orderId);
    const v2 = await payments.void(orderId);
    expect(v1.type).toBe('VOID');
    expect(v2.id).toBe(v1.id);
  });

  it('charge всегда успешен и не создаёт PaymentTransaction (не привязан к заявке)', async () => {
    const result = await payments.charge('purchase-1', 5000);
    expect(result.status).toBe('SUCCEEDED');
    expect(result.providerRef).toMatch(/^mock-/);
    expect(await prisma.paymentTransaction.count()).toBe(0);
  });
});
