import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';
import { AccessTokenService } from './access-token.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PresenceService } from '../realtime/presence.service';
import { SMS_SENDER } from '../sms/sms.interface';

@Module({ providers: [JwtAuthGuard] })
class GuardConsumerModule {}

describe('authentication module dependency wiring', () => {
  it('exports one shared token service to other HTTP modules and realtime without database or SMS', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              JWT_SECRET: 'test-only-secret-with-at-least-32-characters',
            }),
          ],
        }),
        PrismaModule,
        AuthModule,
        GuardConsumerModule,
        RealtimeModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(PresenceService)
      .useValue({})
      .overrideProvider(SMS_SENDER)
      .useValue({ send: jest.fn() })
      .compile();
    expect(module.get(AuthService)).toBeInstanceOf(AuthService);
    expect(module.get(AccessTokenService)).toBeInstanceOf(AccessTokenService);
    expect(module.get(JwtAuthGuard)).toBeInstanceOf(JwtAuthGuard);
    expect(module.get(RealtimeGateway)).toBeInstanceOf(RealtimeGateway);
    await module.close();
  });
});
