import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MastersModule } from './masters/masters.module';
import { UploadsModule } from './uploads/uploads.module';
import { AdminModule } from './admin/admin.module';
import { PaymentsModule } from './payments/payments.module';
import { RoutingModule } from './routing/routing.module';
import { PricingModule } from './pricing/pricing.module';
import { QueueModule } from './queue/queue.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { RealtimeModule } from './realtime/realtime.module';
import { LeadCreditsModule } from './lead-credits/lead-credits.module';
import { OrdersModule } from './orders/orders.module';
import { PlannedOrdersModule } from './planned-orders/planned-orders.module';
import { WalletModule } from './wallet/wallet.module';
import { DisputesModule } from './disputes/disputes.module';
import { AddressesModule } from './addresses/addresses.module';
import { ReviewsModule } from './reviews/reviews.module';
import { CommercialModeModule } from './commercial-mode/commercial-mode.module';
import { HealthModule } from './health.module';
import { validateEnvironment } from './config/environment';
import { AdminUsersModule } from './admin-users/admin-users.module';
import { AdminMastersModule } from './admin-masters/admin-masters.module';
import { AdminOrdersModule } from './admin-orders/admin-orders.module';
import { AdminMetricsModule } from './admin-metrics/admin-metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    CommercialModeModule,
    PrismaModule,
    CommonModule,
    QueueModule,
    HealthModule,
    AuditLogModule,
    AuthModule,
    UsersModule,
    MastersModule,
    UploadsModule,
    AdminModule,
    AdminUsersModule,
    AdminMastersModule,
    AdminOrdersModule,
    AdminMetricsModule,
    PaymentsModule,
    RoutingModule,
    PricingModule,
    RealtimeModule,
    LeadCreditsModule,
    OrdersModule,
    PlannedOrdersModule,
    WalletModule,
    DisputesModule,
    AddressesModule,
    ReviewsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
