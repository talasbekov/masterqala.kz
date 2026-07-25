import { Module } from '@nestjs/common';
import { CommercialModeModule } from '../commercial-mode/commercial-mode.module';
import { PAYMENT_PROVIDER } from './payment.interface';
import { MockPaymentProvider } from './mock-payment.provider';
import { CommercialPaymentProvider } from './commercial-payment.provider';

@Module({
  imports: [CommercialModeModule],
  providers: [
    MockPaymentProvider,
    CommercialPaymentProvider,
    { provide: PAYMENT_PROVIDER, useExisting: CommercialPaymentProvider },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentsModule {}
