import { JwtService } from '@nestjs/jwt';
import { Server } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceService } from './presence.service';
import { RealtimeGateway } from './realtime.gateway';

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function setup(commercialMode: 'FREE_PILOT' | 'PAID_MOCK') {
  const prisma = {
    order: {
      findUnique: jest.fn().mockResolvedValue({
        commercialMode,
        calloutPrice: 2600,
        serviceFee: 1040,
      }),
    },
  } as unknown as PrismaService;
  const gateway = new RealtimeGateway(
    {} as JwtService,
    {} as PresenceService,
    prisma,
  );
  const emit = jest.fn();
  const to = jest.fn().mockReturnValue({ emit });
  gateway.server = { to } as unknown as Server;

  return {
    gateway,
    prisma: prisma as unknown as { order: { findUnique: jest.Mock } },
    emit,
    to,
  };
}

describe('RealtimeGateway.emitToUser — order:status', () => {
  it('маскирует суммы FREE_PILOT и одинаково отправляет клиенту и мастеру', async () => {
    const { gateway, prisma, emit, to } = setup('FREE_PILOT');
    const payload = {
      orderId: 'order-1',
      status: 'AWAITING_PRICE_CONFIRM',
      calloutPrice: 2600,
      workPrice: 5000,
    };

    gateway.emitToUser('client-1', 'order:status', payload);
    gateway.emitToUser('master-1', 'order:status', payload);
    await flushPromises();

    expect(prisma.order.findUnique).toHaveBeenCalledTimes(1);
    expect(to).toHaveBeenNthCalledWith(1, 'user:client-1');
    expect(to).toHaveBeenNthCalledWith(2, 'user:master-1');
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenNthCalledWith(1, 'order:status', {
      ...payload,
      commercialMode: 'FREE_PILOT',
      calloutPrice: 0,
      serviceFee: 0,
      freePilot: true,
    });
    expect(emit).toHaveBeenNthCalledWith(2, 'order:status', {
      ...payload,
      commercialMode: 'FREE_PILOT',
      calloutPrice: 0,
      serviceFee: 0,
      freePilot: true,
    });
  });

  it('сохраняет фактические суммы PAID_MOCK-заявки', async () => {
    const { gateway, emit } = setup('PAID_MOCK');
    const payload = { orderId: 'order-2', status: 'ACCEPTED', calloutPrice: 1 };

    gateway.emitToUser('client-1', 'order:status', payload);
    await flushPromises();

    expect(emit).toHaveBeenCalledWith('order:status', {
      ...payload,
      commercialMode: 'PAID_MOCK',
      calloutPrice: 2600,
      serviceFee: 1040,
      freePilot: false,
    });
  });

  it('не обращается к БД для остальных событий', () => {
    const { gateway, prisma, emit } = setup('FREE_PILOT');
    const payload = { orderId: 'order-1', lat: 51.1, lng: 71.4 };

    gateway.emitToUser('client-1', 'master:location', payload);

    expect(prisma.order.findUnique).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith('master:location', payload);
  });
});
