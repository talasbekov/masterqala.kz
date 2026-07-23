import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommercialModeController } from './commercial-mode.controller';
import { CommercialModeService } from './commercial-mode.service';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [CommercialModeController],
  providers: [CommercialModeService],
  exports: [CommercialModeService],
})
export class CommercialModeModule {}
