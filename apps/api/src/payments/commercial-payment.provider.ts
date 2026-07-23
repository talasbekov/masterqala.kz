import { Injectable } from '@nestjs/common';
import { PaymentStatus, PaymentTransaction, PaymentType } from '@prisma/client';
import { CommercialModeService } from '../commercial-mode/commercial-mode.service';
import { MockPaymentProvider } from './mock-payment.provider';
import { PaymentProvider } from './payment.interface';

@Injectable()
export class CommercialPaymentProvider implements PaymentProvider {
  constructor(
    private readonly commercialMode: CommercialModeService,
    private readonly paidProvider: MockPaymentProvider,
  ) {}

  hold(orderId: string, amount: number): Promise<PaymentTransaction> {
    if (this.commercialMode.paymentsEnabled()) return this.paidProvider.hold(orderId, amount);
    return Promise.resolve(this.virtualTransaction(orderId, 'HOLD', amount));
  }

  capture(orderId: string): Promise<PaymentTransaction> {
    if (this.commercialMode.paymentsEnabled()) return this.paidProvider.capture(orderId);
    return Promise.resolve(this.virtualTransaction(orderId, 'CAPTURE', 0));
  }

  void(orderId: string): Promise<PaymentTransaction> {
    if (this.commercialMode.paymentsEnabled()) return this.paidProvider.void(orderId);
    return Promise.resolve(this.virtualTransaction(orderId, 'VOID', 0));
  }

  charge(referenceId: string, amount: number): Promise<{ status: PaymentStatus; providerRef: string }> {
    if (this.commercialMode.paymentsEnabled()) return this.paidProvider.charge(referenceId, amount);
    return Promise.resolve({ status: 'FAILED', providerRef: 'free-pilot-disabled' });
  }

  payout(referenceId: string, amount: number): Promise<{ status: PaymentStatus; providerRef: string }> {
    if (this.commercialMode.payoutsEnabled()) return this.paidProvider.payout(referenceId, amount);
    return Promise.resolve({ status: 'FAILED', providerRef: 'free-pilot-disabled' });
  }

  refund(orderId: string, amount: number): Promise<{ status: PaymentStatus; providerRef: string }> {
    if (this.commercialMode.paymentsEnabled()) return this.paidProvider.refund(orderId, amount);
    return Promise.resolve({ status: 'SUCCEEDED', providerRef: 'free-pilot-noop' });
  }

  private virtualTransaction(orderId: string, type: PaymentType, amount: number): PaymentTransaction {
    return {
      id: `free-pilot-${type.toLowerCase()}-${orderId}`,
      orderId,
      type,
      amount,
      status: 'SUCCEEDED',
      providerRef: 'free-pilot-noop',
      createdAt: new Date(),
    };
  }
}
