import { User } from '@prisma/client';
import { CommercialModeService } from '../commercial-mode/commercial-mode.service';
import { PhotoReferenceGuard } from '../storage/photo-reference.guard';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

const user = { id: 'client-1' } as User;

function setup(currentFreePilot: boolean) {
  const orders = {
    preview: jest.fn(),
    getById: jest.fn(),
    getActive: jest.fn(),
    listMine: jest.fn(),
  };
  const commercialMode = {
    isFreePilot: jest.fn().mockReturnValue(currentFreePilot),
  } as unknown as CommercialModeService;
  const photoReferences = {
    assertAvailable: jest.fn(),
  } as unknown as PhotoReferenceGuard;

  return {
    controller: new OrdersController(orders as unknown as OrdersService, commercialMode, photoReferences),
    orders,
  };
}

describe('OrdersController — представление коммерческого режима', () => {
  const freeOrder = {
    id: 'order-1',
    commercialMode: 'FREE_PILOT',
    calloutPrice: 2600,
    serviceFee: 1040,
    workPrice: 5000,
  };

  it('скрывает номинальные суммы FREE_PILOT-заявки после глобального перехода в paid', async () => {
    const { controller, orders } = setup(false);
    orders.getById.mockResolvedValue(freeOrder);

    await expect(controller.getById(user, freeOrder.id)).resolves.toEqual({
      ...freeOrder,
      nominalCalloutPrice: 2600,
      nominalServiceFee: 1040,
      calloutPrice: 0,
      serviceFee: 0,
      freePilot: true,
    });
    expect(freeOrder.calloutPrice).toBe(2600);
    expect(freeOrder.serviceFee).toBe(1040);
  });

  it('маскирует массив истории и вложенный active order по режиму каждой записи', async () => {
    const { controller, orders } = setup(false);
    orders.listMine.mockResolvedValue([freeOrder]);
    orders.getActive.mockResolvedValue({ order: freeOrder });

    const history = await controller.listMine(user);
    const active = await controller.getActive(user);

    expect(history[0]).toMatchObject({ calloutPrice: 0, serviceFee: 0, freePilot: true });
    expect(active.order).toMatchObject({ calloutPrice: 0, serviceFee: 0, freePilot: true });
  });

  it('не маскирует PAID_MOCK-заявку после переключения новых заявок в FREE_PILOT', async () => {
    const { controller, orders } = setup(true);
    const paidOrder = { ...freeOrder, id: 'paid-order', commercialMode: 'PAID_MOCK' };
    orders.getById.mockResolvedValue(paidOrder);

    await expect(controller.getById(user, paidOrder.id)).resolves.toEqual(paidOrder);
  });

  it('для preview без сохранённого режима использует текущую конфигурацию', async () => {
    const { controller, orders } = setup(true);
    orders.preview.mockResolvedValue({ available: true, calloutPrice: 2600, serviceFee: 1040 });

    await expect(controller.preview(user, {} as never)).resolves.toMatchObject({
      calloutPrice: 0,
      serviceFee: 0,
      freePilot: true,
      nominalCalloutPrice: 2600,
    });
  });
});
