import { createReadStream } from 'fs';
import { Socket } from 'net';
import { FileScanResult, QuarantineScanner, ScannerHealth } from './quarantine-scanner.interface';

export class ClamAvScanner implements QuarantineScanner {
  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly timeoutMs: number,
  ) {}

  async healthCheck(): Promise<ScannerHealth> {
    const startedAt = Date.now();
    const response = await this.command('zPING\0');
    if (response !== 'PONG') {
      throw new Error(`Unexpected ClamAV PING response: ${response || '<empty>'}`);
    }
    return { status: 'UP', mode: 'CLAMAV', latencyMs: Date.now() - startedAt };
  }

  async scan(absolutePath: string): Promise<FileScanResult> {
    return new Promise<FileScanResult>((resolve, reject) => {
      const socket = new Socket();
      let response = '';
      let settled = false;
      let stream: ReturnType<typeof createReadStream> | null = null;

      const finish = (error?: Error, result?: FileScanResult) => {
        if (settled) return;
        settled = true;
        stream?.destroy();
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
        stream = createReadStream(absolutePath, { highWaterMark: 64 * 1024 });
        stream.on('error', (error) => finish(error));
        stream.on('data', (chunk: Buffer) => {
          const length = Buffer.allocUnsafe(4);
          length.writeUInt32BE(chunk.length, 0);
          const headerWritable = socket.write(length);
          const chunkWritable = socket.write(chunk);
          if (!headerWritable || !chunkWritable) stream?.pause();
        });
        socket.on('drain', () => stream?.resume());
        stream.on('end', () => socket.end(Buffer.alloc(4)));
      });
    });
  }

  private command(command: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const socket = new Socket();
      let response = '';
      let settled = false;

      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        if (error) reject(error);
        else resolve(response.replace(/\0/g, '').trim());
      };

      socket.setTimeout(this.timeoutMs, () => finish(new Error('ClamAV health check timeout')));
      socket.on('error', (error) => finish(error));
      socket.on('data', (chunk) => {
        response += chunk.toString('utf8');
        if (response.includes('\0') || response.includes('\n')) finish();
      });
      socket.on('close', () => finish());
      socket.connect(this.port, this.host, () => socket.end(Buffer.from(command)));
    });
  }
}
