import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi, pointAtKm } from './helpers';
import { MatchingService } from '../src/orders/matching.service';

function connect(url: string, token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = io(url, { auth: { token }, transports: ['websocket'] });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

function once<T>(socket: Socket, event: string, ms = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`нет события ${event}`)), ms);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe('Realtime события заявки (e2e)', () => {
  let app: INestApplication;
  let url: string;

  beforeAll(async () => {
    app = await createTestApp({ listen: true });
    url = await app.getUrl();
  });
  afterAll(() => app.close());
  beforeEach(() => resetDb(app));

  it('мастер получает offer:new, клиент — order:status при принятии', async () => {
    const { plumbing } = await seedCategories(app);
    const client = await loginAs(app, '+77100000001');
    const master = await createActiveMaster(app, '+77100000002', plumbing.id, pointAtKm(1));

    const masterSocket = await connect(url, master.token);
    const clientSocket = await connect(url, client.token);

    const order = await createOrderViaApi(app, client.token, plumbing.id);
    const offerPromise = once<any>(masterSocket, 'offer:new');
    // handleWave тоже шлёт клиенту order:status (SEARCHING, «расширяем радиус») —
    // ловим и гасим это раннее событие, чтобы не спутать его с order:status после accept.
    const searchingStatusPromise = once<any>(clientSocket, 'order:status');
    await app.get(MatchingService).handleWave({ orderId: order.id, wave: 1 });
    const offer = await offerPromise;
    expect(offer).toMatchObject({ orderId: order.id, category: 'Сантехника', wave: 1, district: 'Есильский район' });
    expect(offer.address).toBeUndefined();
    expect(offer.compensation).toBe(order.calloutPrice - order.serviceFee);
    expect(offer.deadline).toBeDefined();
    const searchingStatus = await searchingStatusPromise;
    expect(searchingStatus).toMatchObject({ orderId: order.id, status: 'SEARCHING' });

    const statusPromise = once<any>(clientSocket, 'order:status');
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/accept`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(201);
    const status = await statusPromise;
    expect(status).toMatchObject({ orderId: order.id, status: 'ACCEPTED' });
    expect(status.master.id).toBe(master.userId);

    masterSocket.disconnect();
    clientSocket.disconnect();
  });

  it('geo:update от мастера с активной заявкой релеит master:location клиенту', async () => {
    const { plumbing } = await seedCategories(app);
    const client = await loginAs(app, '+77100000003');
    const master = await createActiveMaster(app, '+77100000004', plumbing.id, pointAtKm(1));

    const masterSocket = await connect(url, master.token);
    const clientSocket = await connect(url, client.token);

    const order = await createOrderViaApi(app, client.token, plumbing.id);
    await app.get(MatchingService).handleWave({ orderId: order.id, wave: 1 });
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/accept`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(201);

    const locatedPromise = once<any>(clientSocket, 'master:location');
    masterSocket.emit('geo:update', { lat: pointAtKm(0.5).lat, lng: pointAtKm(0.5).lng });
    const located = await locatedPromise;
    expect(located).toMatchObject({ orderId: order.id, lat: expect.any(Number), lng: expect.any(Number), etaMinutes: expect.any(Number) });

    masterSocket.disconnect();
    clientSocket.disconnect();
  });
});
