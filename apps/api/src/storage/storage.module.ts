import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClamAvScanner } from './clamav.scanner';
import { DisabledQuarantineScanner } from './disabled-quarantine.scanner';
import { FILE_STORAGE } from './storage.interface';
import { LocalDiskStorage } from './local-disk.storage';
import { PendingUploadsService } from './pending-uploads.service';
import { PhotoReferenceGuard } from './photo-reference.guard';
import { QUARANTINE_SCANNER } from './quarantine-scanner.interface';

@Module({
  providers: [
    { provide: FILE_STORAGE, useClass: LocalDiskStorage },
    {
      provide: QUARANTINE_SCANNER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        if (config.get<string>('FILE_SCAN_MODE') === 'CLAMAV') {
          return new ClamAvScanner(
            config.get<string>('CLAMAV_HOST')!,
            config.get<number>('CLAMAV_PORT')!,
            config.get<number>('CLAMAV_TIMEOUT_MS')!,
          );
        }
        return new DisabledQuarantineScanner();
      },
    },
    PhotoReferenceGuard,
    PendingUploadsService,
  ],
  exports: [FILE_STORAGE, PhotoReferenceGuard, PendingUploadsService],
})
export class StorageModule {}
