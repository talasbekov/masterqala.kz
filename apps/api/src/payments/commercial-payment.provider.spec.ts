import { PaymentTransaction } from '@prisma/client';
import { CommercialModeService } from '../commercial-mode/commercial-mode.service';
import { PrismaService } from '../prisma/prisma.service';
import { CommercialPaymentProvider } from './commercial-payment.provider';
import { MockPaymentProvider } from './mock-payment.provider';

function setup(orderMode: 'FREE_PILOT' | 'PAID_MOCK', globalEnabled = true) {
  const prisma = {
    order: {
      findUnique: jest.fn().mockResolvedValue({ commercialMode: orderMode }),
    },
  } as unknown as PrismaService;
  const commercialMode = {
    paymentsEnabled: jest.fn().mockReturnValue(globalEnabled),
    payoutsEnabled: jest.fn().mockReturnValue(globalEnabled),
  } as unknown as CommercialModeService;
  const transaction = { id: 'paid-transaction' } as PaymentTransaction;
  const paidProvider = {
    hold: jest.fn().mockResolvedValue(transaction),
    capture: jest.fn().mockResolvedValue(transaction),
    void: jest.fn().mockResolvedValue(transaction),
    charge: jest.fn().mockResolvedValue({ status: 'SUCCEEDED', providerRef: 'paid' }),
    payout: jest.fn().mockResolvedValue({ status: 'SUCCEEDED', providerRef: 'paid' }),
    refund: jest.fn().mockResolvedValue({ status: 'SUCCEEDED', providerRef: 'paid' }),
  } as unknown as MockPaymentProvider;
  return {
    provider: new CommercialPaymentProvider(prisma, commercialMode, paidProvider),
    paidProvider,
    transaction,
  };
}

describe('CommercialPaymentProvider', () => {
  it('не вызывает платный провайдер для FREE_PILOT-заявки даже после глобального переключения в paid', async () => {
    const { provider, paidProvider } = setup('FREE_PILOT', true);

    const hold = await provider.hold('order-1', 2500);
    const capture = await provider.capture('order-1');
    const refund = await provider.refund('order-1', 1000);

    expect(hold).toMatchObject({
      orderId: 'order-1',
      type: 'HOLD',
      amount: 2500,
      providerRef: 'free-pilot-noop',
    });
    expect(capture).toMatchObject({ type: 'CAPTURE', providerRef: 'free-pilot-noop' });
    expect(refund).toEqual({ status: 'SUCCEEDED', providerRef: 'free-pilot-noop' });
    expect(paidProvider.hold).not.toHaveBeenCalled();
    expect(paidProvider.capture).not.toHaveBeenCalled();
    expect(paidProvider.refund).not.toHaveBeenCalled();
  });

  it('продолжает платную обработку PAID_MOCK-заявки независимо от режима новых заявок', async () => {
    const { provider, paidProvider, transaction } = setup('PAID_MOCK', false);

    await expect(provider.hold('order-2', 3000)).resolves.toBe(transaction);
    await expect(provider.capture('order-2')).resolves.toBe(transaction);
    expect(paidProvider.hold).toHaveBeenCalledWith('order-2', 3000);
    expect(paidProvider.capture).toHaveBeenCalledWith('order-2');
  });

  it('покупки и выводы без привязки к заявке используют текущий глобальный режим', async () => {
    const enabled = setup('PAID_MOCK', true);
    const disabled = setup('PAID_MOCK', false);

    await expect(enabled.provider.payout('withdrawal-1', 2000)).resolves.toEqual({
      status: 'SUCCEEDED',
      providerRef: 'paid',
    });
    await expect(disabled.provider.charge('purchase-1', 1000)).resolves.toEqual({
      status: 'FAILED',
      providerRef: 'free-pilot-disabled',
    });
  });
});
