import { Module } from '@nestjs/common';
import { MastersService } from './masters.service';
import { MastersController } from './masters.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  providers: [MastersService],
  controllers: [MastersController],
  exports: [MastersService],
})
export class MastersModule {}
