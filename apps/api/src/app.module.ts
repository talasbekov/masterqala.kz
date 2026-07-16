import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MastersModule } from './masters/masters.module';
import { AdminModule } from './admin/admin.module';
import { PaymentsModule } from './payments/payments.module';
import { RoutingModule } from './routing/routing.module';
import { PricingModule } from './pricing/pricing.module';
import { QueueModule } from './queue/queue.module';
import { RealtimeModule } from './realtime/realtime.module';
import { LeadCreditsModule } from './lead-credits/lead-credits.module';
import { OrdersModule } from './orders/orders.module';
import { PlannedOrdersModule } from './planned-orders/planned-orders.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    QueueModule,
    AuthModule,
    UsersModule,
    MastersModule,
    AdminModule,
    PaymentsModule,
    RoutingModule,
    PricingModule,
    RealtimeModule,
    LeadCreditsModule,
    OrdersModule,
    PlannedOrdersModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
