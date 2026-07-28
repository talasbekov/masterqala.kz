import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SMS_SENDER, SmsSender } from './sms.interface';
import { ConsoleSmsSender } from './console-sms.sender';
import { HttpSmsSender } from './http-sms.sender';

@Module({
  providers: [
    {
      provide: SMS_SENDER,
      useFactory: (config: ConfigService): SmsSender => {
        const mode = config.get<string>('SMS_PROVIDER_MODE') ?? 'CONSOLE';
        return mode === 'HTTP' ? new HttpSmsSender(config) : new ConsoleSmsSender();
      },
      inject: [ConfigService],
    },
  ],
  exports: [SMS_SENDER],
})
export class SmsModule {}
