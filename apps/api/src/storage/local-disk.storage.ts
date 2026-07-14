import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { FileStorage } from './storage.interface';

@Injectable()
export class LocalDiskStorage implements FileStorage {
  private readonly dir = resolve(process.env.UPLOAD_DIR ?? './uploads');

  async save(buffer: Buffer, ext: string): Promise<string> {
    await mkdir(this.dir, { recursive: true });
    const relPath = `${randomUUID()}.${ext}`;
    await writeFile(join(this.dir, relPath), buffer);
    return relPath;
  }

  absolutePath(relPath: string): string {
    return join(this.dir, relPath);
  }
}
