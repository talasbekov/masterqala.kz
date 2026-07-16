import { Injectable, ConflictException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PaymentStatus, PaymentTransaction, PaymentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentProvider } from './payment.interface';

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  constructor(private readonly prisma: PrismaService) {}

  async hold(orderId: string, amount: number): Promise<PaymentTransaction> {
    return this.prisma.paymentTransaction.create({
      data: { orderId, type: 'HOLD', amount, status: 'SUCCEEDED', providerRef: `mock-${randomUUID()}` },
    });
  }

  async capture(orderId: string): Promise<PaymentTransaction> {
    return this.settle(orderId, 'CAPTURE');
  }

  async void(orderId: string): Promise<PaymentTransaction> {
    return this.settle(orderId, 'VOID');
  }

  private async settle(orderId: string, type: PaymentType): Promise<PaymentTransaction> {
    const existing = await this.prisma.paymentTransaction.findFirst({
      where: { orderId, type },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return existing;
    const hold = await this.prisma.paymentTransaction.findFirst({
      where: { orderId, type: 'HOLD', status: 'SUCCEEDED' },
      orderBy: { createdAt: 'desc' },
    });
    if (!hold) throw new ConflictException('Нет холда по заявке');
    return this.prisma.paymentTransaction.create({
      data: { orderId, type, amount: hold.amount, status: 'SUCCEEDED', providerRef: `mock-${randomUUID()}` },
    });
  }

  async charge(referenceId: string, amount: number): Promise<{ status: PaymentStatus; providerRef: string }> {
    void referenceId;
    void amount;
    return { status: 'SUCCEEDED', providerRef: `mock-${randomUUID()}` };
  }
}
