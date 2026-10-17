import { Module } from '@nestjs/common';
import { MasterHistoryController } from './master-history.controller';
import { MasterHistoryService } from './master-history.service';

@Module({ controllers: [MasterHistoryController], providers: [MasterHistoryService] })
export class MasterHistoryModule {}
