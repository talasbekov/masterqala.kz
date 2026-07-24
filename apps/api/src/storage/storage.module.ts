import { Module } from '@nestjs/common';
import { FILE_STORAGE } from './storage.interface';
import { LocalDiskStorage } from './local-disk.storage';
import { PendingUploadsService } from './pending-uploads.service';
import { PhotoReferenceGuard } from './photo-reference.guard';

@Module({
  providers: [
    { provide: FILE_STORAGE, useClass: LocalDiskStorage },
    PhotoReferenceGuard,
    PendingUploadsService,
  ],
  exports: [FILE_STORAGE, PhotoReferenceGuard, PendingUploadsService],
})
export class StorageModule {}
