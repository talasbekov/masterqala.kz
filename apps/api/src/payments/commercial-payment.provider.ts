import { Injectable } from '@nestjs/common';
import { PaymentStatus, PaymentTransaction, PaymentType } from '@prisma/client';
import { CommercialModeService } from '../commercial-mode/commercial-mode.service';
import { PrismaService } from '../prisma/prisma.service';
import { MockPaymentProvider } from './mock-payment.provider';
import { PaymentProvider } from './payment.interface';

@Injectable()
export class CommercialPaymentProvider implements PaymentProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commercialMode: CommercialModeService,
    private readonly paidProvider: MockPaymentProvider,
  ) {}

  async hold(orderId: string, amount: number): Promise<PaymentTransaction> {
    if (await this.orderPaymentsEnabled(orderId)) return this.paidProvider.hold(orderId, amount);
    return this.virtualTransaction(orderId, 'HOLD', amount);
  }

  async capture(orderId: string): Promise<PaymentTransaction> {
    if (await this.orderPaymentsEnabled(orderId)) return this.paidProvider.capture(orderId);
    return this.virtualTransaction(orderId, 'CAPTURE', 0);
  }

  async void(orderId: string): Promise<PaymentTransaction> {
    if (await this.orderPaymentsEnabled(orderId)) return this.paidProvider.void(orderId);
    return this.virtualTransaction(orderId, 'VOID', 0);
  }

  charge(referenceId: string, amount: number): Promise<{ status: PaymentStatus; providerRef: string }> {
    if (this.commercialMode.paymentsEnabled()) return this.paidProvider.charge(referenceId, amount);
    return Promise.resolve({ status: 'FAILED', providerRef: 'free-pilot-disabled' });
  }

  payout(referenceId: string, amount: number): Promise<{ status: PaymentStatus; providerRef: string }> {
    if (this.commercialMode.payoutsEnabled()) return this.paidProvider.payout(referenceId, amount);
    return Promise.resolve({ status: 'FAILED', providerRef: 'free-pilot-disabled' });
  }

  async refund(orderId: string, amount: number): Promise<{ status: PaymentStatus; providerRef: string }> {
    if (await this.orderPaymentsEnabled(orderId)) return this.paidProvider.refund(orderId, amount);
    return { status: 'SUCCEEDED', providerRef: 'free-pilot-noop' };
  }

  private async orderPaymentsEnabled(orderId: string): Promise<boolean> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { commercialMode: true },
    });
    // Fallback нужен только для совместимости со старыми/неполными тестовыми данными.
    return order ? order.commercialMode !== 'FREE_PILOT' : this.commercialMode.paymentsEnabled();
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
