import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { io, Socket } from 'socket.io-client';
import {
  createTestApp,
  resetDb,
  seedCategories,
  loginAs,
  createActiveMaster,
  createOrderViaApi,
  pointAtKm,
} from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { MatchingService } from '../src/orders/matching.service';
import { OrdersService } from '../src/orders/orders.service';

function connect(url: string, token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = io(url, { auth: { token }, transports: ['websocket'] });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

async function waitFor(check: () => Promise<boolean> | boolean, ms = 3000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('условие не наступило');
}

/**
 * Блокировка пользователя оператором должна снимать его со ВСЕХ плоскостей, а не
 * только с HTTP. Раньше JwtAuthGuard проверял isBlocked, а хендшейк Socket.IO и
 * подбор кандидатов — нет, поэтому заблокированный мастер продолжал получать
 * ленту заказов и оставался в диспетчеризации.
 */
describe('Заблокированный пользователь: realtime и матчинг (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let matching: MatchingService;
  let orders: OrdersService;
  let url: string;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let operator: { token: string; userId: string };

  beforeAll(async () => {
    app = await createTestApp({ listen: true });
    prisma = app.get(PrismaService);
    matching = app.get(MatchingService);
    orders = app.get(OrdersService);
    url = await app.getUrl();
  });
  afterAll(() => app.close());

  const openSockets: Socket[] = [];
  const track = async (token: string): Promise<Socket> => {
    const s = await connect(url, token);
    openSockets.push(s);
    return s;
  };

  beforeEach(async () => {
    await resetDb(app);
    plumbingId = (await seedCategories(app)).plumbing.id;
    client = await loginAs(app, '+77060000001');
    operator = await loginAs(app, '+77060000002', 'OPERATOR');
  });

  // Незакрытый сокет держит app.close() и вешает весь прогон.
  afterEach(() => {
    while (openSockets.length) openSockets.pop()?.disconnect();
  });

  const block = (userId: string) =>
    request(app.getHttpServer())
      .post(`/api/v1/admin/users/${userId}/block`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ reason: 'мошенничество' })
      .expect(201);

  it('хендшейк отклоняет токен, выданный до блокировки', async () => {
    const master = await createActiveMaster(app, '+77060000003', plumbingId, pointAtKm(1));

    // Токен выдан до блокировки и остаётся криптографически валидным.
    const before = await track(master.token);
    before.disconnect();

    await block(master.userId);

    await expect(connect(url, master.token)).rejects.toBeDefined();
  });

  it('блокировка рвёт уже открытое соединение', async () => {
    const master = await createActiveMaster(app, '+77060000004', plumbingId, pointAtKm(1));
    const socket = await track(master.token);
    expect(socket.connected).toBe(true);

    await block(master.userId);

    await waitFor(() => socket.disconnected);
  });

  it('заблокированный мастер исключён из кандидатов матчинга, свободный — нет', async () => {
    const blocked = await createActiveMaster(app, '+77060000005', plumbingId, pointAtKm(1));
    // Второй мастер нужен и по существу теста (отличить «заблокированный исключён»
    // от «никого не нашлось»), и технически: превью цены тоже не берёт
    // заблокированных, без него заявка не создаётся вовсе.
    const ok = await createActiveMaster(app, '+77060000008', plumbingId, pointAtKm(2));
    await block(blocked.userId);

    const order = await createOrderViaApi(app, client.token, plumbingId);
    await matching.handleWave({ orderId: order.id, wave: 1 });

    const got = (await prisma.orderOffer.findMany({ where: { orderId: order.id } })).map(
      (o) => o.masterUserId,
    );
    expect(got).not.toContain(blocked.userId);
    expect(got).toContain(ok.userId);
  });

  it('заблокированный мастер не попадает в список кандидатов оператора', async () => {
    const blocked = await createActiveMaster(app, '+77060000006', plumbingId, pointAtKm(1));
    const ok = await createActiveMaster(app, '+77060000009', plumbingId, pointAtKm(2));
    await block(blocked.userId);
    const order = await createOrderViaApi(app, client.token, plumbingId);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/orders/${order.id}/candidates`)
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);

    const ids = res.body.map((c: { masterUserId: string }) => c.masterUserId);
    expect(ids).not.toContain(blocked.userId);
    expect(ids).toContain(ok.userId);
  });

  it('ручное назначение заблокированного мастера отклоняется', async () => {
    const blocked = await createActiveMaster(app, '+77060000007', plumbingId, pointAtKm(1));
    await createActiveMaster(app, '+77060000010', plumbingId, pointAtKm(2));
    await block(blocked.userId);
    const order = await createOrderViaApi(app, client.token, plumbingId);

    await expect(orders.manualAssign(operator.userId, order.id, blocked.userId)).rejects.toThrow(
      /заблокирован/i,
    );
  });
});
