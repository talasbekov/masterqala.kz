import { Module } from '@nestjs/common';
import { PAYMENT_PROVIDER } from './payment.interface';
import { MockPaymentProvider } from './mock-payment.provider';
import { CommercialPaymentProvider } from './commercial-payment.provider';

@Module({
  providers: [
    MockPaymentProvider,
    CommercialPaymentProvider,
    { provide: PAYMENT_PROVIDER, useExisting: CommercialPaymentProvider },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentsModule {}
