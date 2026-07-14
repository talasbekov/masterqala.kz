import { Module } from '@nestjs/common';
import { SMS_SENDER } from './sms.interface';
import { ConsoleSmsSender } from './console-sms.sender';

@Module({
  providers: [{ provide: SMS_SENDER, useClass: ConsoleSmsSender }],
  exports: [SMS_SENDER],
})
export class SmsModule {}
