import { Module } from '@nestjs/common';
import { CommercialModeModule } from '../commercial-mode/commercial-mode.module';
import { PaymentsModule } from '../payments/payments.module';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { AdminWithdrawalsController } from './admin-withdrawals.controller';

@Module({
  imports: [CommercialModeModule, PaymentsModule],
  providers: [WalletService],
  controllers: [WalletController, AdminWithdrawalsController],
  exports: [WalletService],
})
export class WalletModule {}
