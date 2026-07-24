import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join, resolve, sep } from 'path';
import { FileStorage } from './storage.interface';

const SAFE_EXTENSION = /^[a-z0-9]{1,10}$/;

@Injectable()
export class LocalDiskStorage implements FileStorage {
  private readonly dir = resolve(process.env.UPLOAD_DIR ?? './uploads');

  async save(buffer: Buffer, ext: string): Promise<string> {
    if (!SAFE_EXTENSION.test(ext)) {
      throw new BadRequestException('Недопустимое расширение файла');
    }

    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    const relPath = `${randomUUID()}.${ext}`;
    await writeFile(join(this.dir, relPath), buffer, { flag: 'wx', mode: 0o600 });
    return relPath;
  }

  async remove(relPath: string): Promise<void> {
    const absolutePath = this.absolutePath(relPath);
    try {
      await unlink(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  absolutePath(relPath: string): string {
    const abs = resolve(this.dir, relPath);
    if (!relPath || abs === this.dir || !abs.startsWith(this.dir + sep)) {
      throw new BadRequestException('Недопустимый путь файла');
    }
    return abs;
  }
}
