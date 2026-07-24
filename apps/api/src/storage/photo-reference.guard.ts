import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { FILE_STORAGE, FileStorage } from './storage.interface';
import { isCanonicalStoredPhotoPath } from './upload-security';

@Injectable()
export class PhotoReferenceGuard {
  constructor(@Inject(FILE_STORAGE) private readonly storage: FileStorage) {}

  async assertAvailable(paths?: readonly string[]): Promise<void> {
    if (!paths?.length) return;

    for (const path of paths) {
      if (!isCanonicalStoredPhotoPath(path)) {
        throw new BadRequestException('Некорректная ссылка на фото');
      }
      if (!(await this.storage.exists(path))) {
        throw new BadRequestException('Загруженное фото не найдено');
      }
    }
  }
}
