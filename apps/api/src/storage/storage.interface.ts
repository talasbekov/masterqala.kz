export interface FileStorage {
  save(buffer: Buffer, ext: string): Promise<string>;
  absolutePath(relPath: string): string;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');
