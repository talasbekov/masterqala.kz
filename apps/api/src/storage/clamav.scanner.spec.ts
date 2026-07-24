import { mkdtemp, rm, writeFile } from 'fs/promises';
import { AddressInfo, createServer, Server } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { ClamAvScanner } from './clamav.scanner';

async function startFakeClamAv(response: string): Promise<{ server: Server; port: number }> {
  const server = createServer((socket) => {
    let buffer = Buffer.alloc(0);
    let commandRead = false;

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (!commandRead) {
        const terminator = buffer.indexOf(0);
        if (terminator < 0) return;
        expect(buffer.subarray(0, terminator).toString('utf8')).toBe('zINSTREAM');
        buffer = buffer.subarray(terminator + 1);
        commandRead = true;
      }

      while (buffer.length >= 4) {
        const length = buffer.readUInt32BE(0);
        if (length === 0) {
          socket.end(`${response}\0`);
          return;
        }
        if (buffer.length < length + 4) return;
        buffer = buffer.subarray(length + 4);
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, port: (server.address() as AddressInfo).port };
}

describe('ClamAvScanner', () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'masterqala-clamav-'));
    file = join(dir, 'photo.png');
    await writeFile(file, Buffer.from('safe test payload'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('передаёт файл через INSTREAM и принимает OK', async () => {
    const { server, port } = await startFakeClamAv('stream: OK');
    try {
      await expect(new ClamAvScanner('127.0.0.1', port, 2000).scan(file)).resolves.toEqual({ status: 'CLEAN' });
    } finally {
      server.close();
    }
  });

  it('возвращает malware signature для FOUND', async () => {
    const { server, port } = await startFakeClamAv('stream: Eicar-Signature FOUND');
    try {
      await expect(new ClamAvScanner('127.0.0.1', port, 2000).scan(file)).resolves.toEqual({
        status: 'INFECTED',
        signature: 'Eicar-Signature',
      });
    } finally {
      server.close();
    }
  });

  it('fail-closed отклоняет неизвестный ответ scanner', async () => {
    const { server, port } = await startFakeClamAv('stream: ERROR');
    try {
      await expect(new ClamAvScanner('127.0.0.1', port, 2000).scan(file)).rejects.toThrow(
        'Unexpected ClamAV response',
      );
    } finally {
      server.close();
    }
  });
});
