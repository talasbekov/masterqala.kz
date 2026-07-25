import { Module } from '@nestjs/common';
import { ReviewsModule } from '../reviews/reviews.module';
import { AdminMastersService } from './admin-masters.service';
import { AdminMastersController } from './admin-masters.controller';

@Module({
  imports: [ReviewsModule],
  providers: [AdminMastersService],
  controllers: [AdminMastersController],
})
export class AdminMastersModule {}
