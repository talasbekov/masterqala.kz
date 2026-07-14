import { Module } from '@nestjs/common';
import { SmsModule } from '../sms/sms.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [SmsModule],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
