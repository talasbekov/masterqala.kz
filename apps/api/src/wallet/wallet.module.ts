import { Module } from '@nestjs/common';
import { CommercialModeModule } from '../commercial-mode/commercial-mode.module';
import { PaymentsModule } from '../payments/payments.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { AdminWithdrawalsController } from './admin-withdrawals.controller';

@Module({
  imports: [CommercialModeModule, PaymentsModule, AuditLogModule],
  providers: [WalletService],
  controllers: [WalletController, AdminWithdrawalsController],
  exports: [WalletService],
})
export class WalletModule {}
