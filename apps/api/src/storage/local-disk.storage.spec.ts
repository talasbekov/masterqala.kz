import { BadRequestException } from '@nestjs/common';
import { LocalDiskStorage } from './local-disk.storage';

describe('LocalDiskStorage.absolutePath', () => {
  const storage = new LocalDiskStorage();

  it('возвращает путь внутри каталога загрузок', () => {
    expect(storage.absolutePath('abc.png')).toContain('abc.png');
  });

  it('отклоняет выход за пределы каталога', () => {
    expect(() => storage.absolutePath('../../etc/passwd')).toThrow(BadRequestException);
  });
});
