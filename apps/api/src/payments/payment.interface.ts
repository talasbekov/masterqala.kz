import { PaymentTransaction } from '@prisma/client';

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface PaymentProvider {
  hold(orderId: string, amount: number): Promise<PaymentTransaction>;
  capture(orderId: string): Promise<PaymentTransaction>;
  void(orderId: string): Promise<PaymentTransaction>;
}
