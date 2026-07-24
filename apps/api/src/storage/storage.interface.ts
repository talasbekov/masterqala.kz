export interface FileStorage {
  save(buffer: Buffer, ext: string): Promise<string>;
  remove(relPath: string): Promise<void>;
  absolutePath(relPath: string): string;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');
