import { PaymentTransaction } from '@prisma/client';
import { CommercialModeService } from '../commercial-mode/commercial-mode.service';
import { CommercialPaymentProvider } from './commercial-payment.provider';
import { MockPaymentProvider } from './mock-payment.provider';

function setup(enabled: boolean) {
  const commercialMode = {
    paymentsEnabled: jest.fn().mockReturnValue(enabled),
    payoutsEnabled: jest.fn().mockReturnValue(enabled),
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
    provider: new CommercialPaymentProvider(commercialMode, paidProvider),
    paidProvider,
    transaction,
  };
}

describe('CommercialPaymentProvider', () => {
  it('не вызывает платный провайдер и не создаёт реальную транзакцию в FREE_PILOT', async () => {
    const { provider, paidProvider } = setup(false);

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

  it('делегирует операции платному провайдеру в PAID_MOCK/PAID_LIVE', async () => {
    const { provider, paidProvider, transaction } = setup(true);

    await expect(provider.hold('order-2', 3000)).resolves.toBe(transaction);
    await expect(provider.payout('withdrawal-1', 2000)).resolves.toEqual({
      status: 'SUCCEEDED',
      providerRef: 'paid',
    });
    expect(paidProvider.hold).toHaveBeenCalledWith('order-2', 3000);
    expect(paidProvider.payout).toHaveBeenCalledWith('withdrawal-1', 2000);
  });
});
