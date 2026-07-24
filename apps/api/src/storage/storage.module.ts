import { Module } from '@nestjs/common';
import { FILE_STORAGE } from './storage.interface';
import { LocalDiskStorage } from './local-disk.storage';
import { PhotoReferenceGuard } from './photo-reference.guard';

@Module({
  providers: [{ provide: FILE_STORAGE, useClass: LocalDiskStorage }, PhotoReferenceGuard],
  exports: [FILE_STORAGE, PhotoReferenceGuard],
})
export class StorageModule {}
