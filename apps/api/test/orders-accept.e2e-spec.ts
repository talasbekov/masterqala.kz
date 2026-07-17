import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi, pointAtKm } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { MatchingService } from '../src/orders/matching.service';

function accept(app: INestApplication, token: string, orderId: string) {
  return request(app.getHttpServer())
    .post(`/api/v1/orders/${orderId}/accept`)
    .set('Authorization', `Bearer ${token}`);
}

describe('Принятие заявки (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let matching: MatchingService;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let m1: { token: string; userId: string };
  let m2: { token: string; userId: string };
  let orderId: string;

  beforeAll(async () => {
    // listen: true — нужен реально забинденный порт, иначе supertest вызывает
    // app.listen(0) неявно на каждый request() и параллельные вызовы в
    // Promise.all сериализуются (второй ждёт, пока первый добиндится),
    // из-за чего гонка перестаёт быть настоящей на уровне БД.
    app = await createTestApp({ listen: true });
    prisma = app.get(PrismaService);
    matching = app.get(MatchingService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
    client = await loginAs(app, '+77060000001');
    m1 = await createActiveMaster(app, '+77060000002', plumbingId, pointAtKm(1));
    m2 = await createActiveMaster(app, '+77060000003', plumbingId, pointAtKm(2));
    const order = await createOrderViaApi(app, client.token, plumbingId);
    orderId = order.id;
    await matching.handleWave({ orderId, wave: 1 });
  });

  it('гонка: двое принимают одновременно → 1×200(201) и 1×409, офферы ACCEPTED/LOST, CAPTURE один', async () => {
    // Барьер синхронизации только для теста. Локальная тестовая БД настолько
    // быстрая, что вся транзакция accept() (guard + чтение оффера + гейт +
    // обновления) у первого запроса успевает полностью закоммититься раньше,
    // чем второй запрос вообще дойдёт до своей транзакции — проверено вручную
    // трассировкой с временными console.log внутри accept(): TX COMMITTED
    // первого вызова раньше TX BEGIN второго на 8-20мс. Из-за этого голый
    // Promise.all на двух HTTP-вызовах не гарантирует, что оба запроса реально
    // одновременно видят PENDING-офферы и одновременно бьются за гейт —
    // первый может успеть проиграть/выиграть в одиночку до того, как второй
    // вообще стартует, и тест "проходит" не благодаря атомарности гейта, а
    // благодаря порядку выполнения.
    //
    // Чтобы гонка была настоящей, перехватываем PrismaService.$transaction:
    // каждый вызов accept() должен дойти внутри переданного колбэка до конца
    // чтения PENDING-оффера (offer:findFirst) — та же точка, что и в проде —
    // и там ждать, пока оба конкурента не доберутся до неё. Только после этого
    // оба продолжают в исходном коде без изменений: дальше настоящий гейт
    // (tx.order.updateMany where status='SEARCHING') решает победителя сам,
    // под настоящей блокировкой Postgres — мы НЕ патчим сам updateMany и не
    // подсказываем, кто выиграет.
    let checkedIn = 0;
    let releaseAll: () => void;
    const bothArrived = new Promise<void>((resolve) => { releaseAll = resolve; });
    const original = prisma.$transaction.bind(prisma);
    const spy = jest.spyOn(prisma, '$transaction').mockImplementation(async (fn: any, ...rest: any[]) => {
      const wrapped = async (tx: any) => {
        const origFindFirst = tx.orderOffer.findFirst.bind(tx.orderOffer);
        let intercepted = false;
        tx.orderOffer.findFirst = async (...findArgs: any[]) => {
          const result = await origFindFirst(...findArgs);
          // Перехватываем только первый findFirst в транзакции — это чтение
          // PENDING-оффера в accept(). Оба вызова должны "прибыть" сюда, уже
          // получив свой результат чтения, прежде чем кто-либо пойдёт дальше
          // к гейту — так оба гарантированно проходят проверку оффера и упираются
          // именно в updateMany, а не расходятся по времени раньше.
          if (!intercepted) {
            intercepted = true;
            checkedIn += 1;
            if (checkedIn >= 2) releaseAll();
            await bothArrived;
          }
          return result;
        };
        return fn(tx);
      };
      return (original as any)(wrapped, ...rest);
    });

    const [r1, r2] = await Promise.all([accept(app, m1.token, orderId), accept(app, m2.token, orderId)]);
    spy.mockRestore();

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order!.status).toBe('ACCEPTED');
    expect([m1.userId, m2.userId]).toContain(order!.masterId);

    const outcomes = (await prisma.orderOffer.findMany({ where: { orderId } })).map((o) => o.outcome).sort();
    expect(outcomes).toEqual(['ACCEPTED', 'LOST']);

    expect(await prisma.paymentTransaction.count({ where: { orderId, type: 'CAPTURE' } })).toBe(1);
  });

  it('мастер без оффера не может принять (403)', async () => {
    const stranger = await createActiveMaster(app, '+77060000004', plumbingId, pointAtKm(20));
    await accept(app, stranger.token, orderId).expect(403);
  });

  it('занятый мастер не может принять вторую (409)', async () => {
    await accept(app, m1.token, orderId).expect(201);
    const client2 = await loginAs(app, '+77060000005');
    const order2 = await createOrderViaApi(app, client2.token, plumbingId);
    await matching.handleWave({ orderId: order2.id, wave: 1 });
    await accept(app, m1.token, order2.id).expect(409);
  });
});
