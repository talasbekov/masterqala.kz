import { User } from '@prisma/client';
import { CommercialModeService } from '../commercial-mode/commercial-mode.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

const user = { id: 'client-1' } as User;

function setup(freePilot: boolean) {
  const orders = {
    getById: jest.fn(),
    getActive: jest.fn(),
    listMine: jest.fn(),
  };
  const commercialMode = {
    isFreePilot: jest.fn().mockReturnValue(freePilot),
  } as unknown as CommercialModeService;

  return {
    controller: new OrdersController(orders as unknown as OrdersService, commercialMode),
    orders,
  };
}

describe('OrdersController — представление бесплатного пилота', () => {
  const storedOrder = {
    id: 'order-1',
    calloutPrice: 2600,
    serviceFee: 1040,
    workPrice: 5000,
  };

  it('скрывает номинальные суммы в детальной заявке, не изменяя исходный объект', async () => {
    const { controller, orders } = setup(true);
    orders.getById.mockResolvedValue(storedOrder);

    await expect(controller.getById(user, storedOrder.id)).resolves.toEqual({
      ...storedOrder,
      nominalCalloutPrice: 2600,
      nominalServiceFee: 1040,
      calloutPrice: 0,
      serviceFee: 0,
      freePilot: true,
    });
    expect(storedOrder.calloutPrice).toBe(2600);
    expect(storedOrder.serviceFee).toBe(1040);
  });

  it('маскирует массив истории и вложенный active order', async () => {
    const { controller, orders } = setup(true);
    orders.listMine.mockResolvedValue([storedOrder]);
    orders.getActive.mockResolvedValue({ order: storedOrder });

    const history = await controller.listMine(user);
    const active = await controller.getActive(user);

    expect(history[0]).toMatchObject({ calloutPrice: 0, serviceFee: 0, freePilot: true });
    expect(active.order).toMatchObject({ calloutPrice: 0, serviceFee: 0, freePilot: true });
  });

  it('не меняет ответы в платном режиме', async () => {
    const { controller, orders } = setup(false);
    orders.getById.mockResolvedValue(storedOrder);

    await expect(controller.getById(user, storedOrder.id)).resolves.toBe(storedOrder);
  });
});
