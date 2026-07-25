export interface FileStorage {
  save(buffer: Buffer, ext: string): Promise<string>;
  exists(relPath: string): Promise<boolean>;
  remove(relPath: string): Promise<void>;
  absolutePath(relPath: string): string;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');
