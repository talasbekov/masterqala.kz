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
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
