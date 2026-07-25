import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceService } from './presence.service';
import { RealtimeGateway } from './realtime.gateway';

function setup() {
  const presence = {
    setOnline: jest.fn().mockResolvedValue(undefined),
    updateGeo: jest.fn().mockResolvedValue(undefined),
    setOffline: jest.fn().mockResolvedValue(undefined),
  } as unknown as PresenceService;
  const prisma = {
    order: { findFirst: jest.fn().mockResolvedValue(null) },
  } as unknown as PrismaService;
  const gateway = new RealtimeGateway({} as JwtService, presence, prisma);
  const socket = { data: { userId: 'master-1' } } as unknown as Socket;

  return {
    gateway,
    socket,
    presence: presence as unknown as {
      setOnline: jest.Mock;
      updateGeo: jest.Mock;
    },
    prisma: prisma as unknown as { order: { findFirst: jest.Mock } },
  };
}

describe('Realtime geo security', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    { lat: Number.NaN, lng: 71.4 },
    { lat: 91, lng: 71.4 },
    { lat: -91, lng: 71.4 },
    { lat: 51.1, lng: 181 },
    { lat: 51.1, lng: -181 },
  ])('игнорирует некорректные координаты %#', async (body) => {
    const { gateway, socket, presence, prisma } = setup();

    await gateway.onOnline(socket, body);
    await gateway.onGeo(socket, body);

    expect(presence.setOnline).not.toHaveBeenCalled();
    expect(presence.updateGeo).not.toHaveBeenCalled();
    expect(prisma.order.findFirst).not.toHaveBeenCalled();
  });

  it('принимает граничные координаты', async () => {
    const { gateway, socket, presence } = setup();

    await gateway.onOnline(socket, { lat: 90, lng: 180 });

    expect(presence.setOnline).toHaveBeenCalledWith('master-1', 90, 180);
  });

  it('игнорирует повторное geo:update раньше одной секунды', async () => {
    const { gateway, socket, presence, prisma } = setup();
    jest.spyOn(Date, 'now').mockReturnValue(10_000);

    await gateway.onGeo(socket, { lat: 51.1, lng: 71.4 });
    await gateway.onGeo(socket, { lat: 51.2, lng: 71.5 });

    expect(presence.updateGeo).toHaveBeenCalledTimes(1);
    expect(presence.updateGeo).toHaveBeenCalledWith('master-1', 51.1, 71.4);
    expect(prisma.order.findFirst).toHaveBeenCalledTimes(1);
  });

  it('разрешает следующее обновление после интервала', async () => {
    const { gateway, socket, presence, prisma } = setup();
    const now = jest.spyOn(Date, 'now').mockReturnValue(10_000);

    await gateway.onGeo(socket, { lat: 51.1, lng: 71.4 });
    now.mockReturnValue(11_000);
    await gateway.onGeo(socket, { lat: 51.2, lng: 71.5 });

    expect(presence.updateGeo).toHaveBeenCalledTimes(2);
    expect(prisma.order.findFirst).toHaveBeenCalledTimes(2);
  });

  it('ведёт независимый лимит для разных socket-соединений', async () => {
    const { gateway, presence } = setup();
    jest.spyOn(Date, 'now').mockReturnValue(10_000);
    const first = { data: { userId: 'master-1' } } as unknown as Socket;
    const second = { data: { userId: 'master-1' } } as unknown as Socket;

    await gateway.onGeo(first, { lat: 51.1, lng: 71.4 });
    await gateway.onGeo(second, { lat: 51.2, lng: 71.5 });

    expect(presence.updateGeo).toHaveBeenCalledTimes(2);
  });
});
