import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [StorageModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
