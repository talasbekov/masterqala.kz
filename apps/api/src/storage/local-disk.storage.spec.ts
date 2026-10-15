import { mkdtemp, readFile, rm, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { LocalDiskStorage } from './local-disk.storage';
import fs = require('fs/promises');

describe('LocalDiskStorage', () => {
  let directory: string;
  let previousUploadDir: string | undefined;

  beforeEach(async () => {
    previousUploadDir = process.env.UPLOAD_DIR;
    directory = await mkdtemp(join(tmpdir(), 'masterqala-upload-'));
    process.env.UPLOAD_DIR = directory;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = previousUploadDir;
    await rm(directory, { recursive: true, force: true });
  });

  it('сохраняет файл под UUID-именем, проверяет наличие и удаляет его', async () => {
    // Spy calls through to the real filesystem: Windows cannot report POSIX
    // permission bits, but must still request private, exclusive file creation.
    const write = jest.spyOn(fs, 'writeFile');
    const storage = new LocalDiskStorage();
    const content = Buffer.from('safe-content');

    const relPath = await storage.save(content, 'jpg');
    const absolutePath = storage.absolutePath(relPath);

    expect(relPath).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    expect(await readFile(absolutePath)).toEqual(content);
    expect(write).toHaveBeenCalledWith(absolutePath, content, { flag: 'wx', mode: 0o600 });
    await expect(storage.exists(relPath)).resolves.toBe(true);

    await storage.remove(relPath);
    await expect(storage.exists(relPath)).resolves.toBe(false);
    await expect(stat(absolutePath)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(storage.remove(relPath)).resolves.toBeUndefined();
  });

  (process.platform === 'win32' ? it.skip : it)('создаёт файл с фактическими POSIX-правами 0600', async () => {
    const storage = new LocalDiskStorage();
    const relPath = await storage.save(Buffer.from('private-content'), 'jpg');
    expect((await stat(storage.absolutePath(relPath))).mode & 0o777).toBe(0o600);
  });

  it('отклоняет небезопасное расширение и path traversal', async () => {
    const storage = new LocalDiskStorage();

    await expect(storage.save(Buffer.from('x'), '../js')).rejects.toThrow('Недопустимое расширение');
    expect(() => storage.absolutePath('../secret.txt')).toThrow('Недопустимый путь');
    expect(() => storage.absolutePath('')).toThrow('Недопустимый путь');
  });
});
