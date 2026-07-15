import { INestApplication } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';
import { createTestApp, resetDb, seedCategories, createActiveMaster, ALMATY } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { PresenceService } from '../src/realtime/presence.service';

function connect(url: string, token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = io(url, { auth: { token }, transports: ['websocket'] });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

async function waitFor(check: () => Promise<boolean>, ms = 3000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('условие не наступило');
}

describe('Realtime presence (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let url: string;

  beforeAll(async () => {
    app = await createTestApp({ listen: true });
    prisma = app.get(PrismaService);
    url = await app.getUrl();
  });
  afterAll(() => app.close());
  beforeEach(() => resetDb(app));

  it('presence:online создаёт запись с гео, presence:offline гасит', async () => {
    const { plumbing } = await seedCategories(app);
    const master = await createActiveMaster(app, '+77030000001', plumbing.id);
    await prisma.masterPresence.deleteMany({});
    const socket = await connect(url, master.token);
    socket.emit('presence:online', { lat: ALMATY.lat, lng: ALMATY.lng });
    await waitFor(async () =>
      (await prisma.masterPresence.findUnique({ where: { masterUserId: master.userId } }))?.isOnline === true,
    );
    socket.emit('presence:offline');
    await waitFor(async () =>
      (await prisma.masterPresence.findUnique({ where: { masterUserId: master.userId } }))?.isOnline === false,
    );
    socket.disconnect();
  });

  it('без валидного JWT соединение отклоняется', async () => {
    await expect(connect(url, 'garbage')).rejects.toBeDefined();
  });

  it('sweepOffline гасит устаревшие (lastSeenAt > 2 мин)', async () => {
    const { plumbing } = await seedCategories(app);
    const master = await createActiveMaster(app, '+77030000002', plumbing.id);
    await prisma.masterPresence.update({
      where: { masterUserId: master.userId },
      data: { lastSeenAt: new Date(Date.now() - 3 * 60 * 1000) },
    });
    await app.get(PresenceService).sweepOffline();
    const row = await prisma.masterPresence.findUnique({ where: { masterUserId: master.userId } });
    expect(row!.isOnline).toBe(false);
  });
});
