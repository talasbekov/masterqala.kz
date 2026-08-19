import { Module } from '@nestjs/common';
import { MastersService } from './masters.service';
import { MastersController } from './masters.controller';
import { StorageModule } from '../storage/storage.module';
import { ReviewsModule } from '../reviews/reviews.module';

@Module({
  imports: [StorageModule, ReviewsModule],
  providers: [MastersService],
  controllers: [MastersController],
  exports: [MastersService],
})
export class MastersModule {}
