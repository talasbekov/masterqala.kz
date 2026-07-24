import { createReadStream } from 'fs';
import { Socket } from 'net';
import { FileScanResult, QuarantineScanner } from './quarantine-scanner.interface';

export class ClamAvScanner implements QuarantineScanner {
  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly timeoutMs: number,
  ) {}

  async scan(absolutePath: string): Promise<FileScanResult> {
    return new Promise<FileScanResult>((resolve, reject) => {
      const socket = new Socket();
      let response = '';
      let settled = false;

      const finish = (error?: Error, result?: FileScanResult) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        if (error) reject(error);
        else resolve(result!);
      };

      socket.setTimeout(this.timeoutMs, () => finish(new Error('ClamAV scan timeout')));
      socket.on('error', (error) => finish(error));
      socket.on('data', (chunk) => {
        response += chunk.toString('utf8');
      });
      socket.on('close', () => {
        if (settled) return;
        const normalized = response.replace(/\0/g, '').trim();
        if (normalized.endsWith('OK')) {
          finish(undefined, { status: 'CLEAN' });
          return;
        }
        const found = normalized.match(/:\s*(.+)\s+FOUND$/);
        if (found) {
          finish(undefined, { status: 'INFECTED', signature: found[1].trim() });
          return;
        }
        finish(new Error(`Unexpected ClamAV response: ${normalized || '<empty>'}`));
      });

      socket.connect(this.port, this.host, () => {
        socket.write(Buffer.from('zINSTREAM\0'));
        const stream = createReadStream(absolutePath, { highWaterMark: 64 * 1024 });
        stream.on('error', (error) => finish(error));
        stream.on('data', (chunk: Buffer) => {
          const length = Buffer.allocUnsafe(4);
          length.writeUInt32BE(chunk.length, 0);
          const headerWritable = socket.write(length);
          const chunkWritable = socket.write(chunk);
          if (!headerWritable || !chunkWritable) stream.pause();
        });
        socket.on('drain', () => stream.resume());
        stream.on('end', () => socket.end(Buffer.alloc(4)));
      });
    });
  }
}
