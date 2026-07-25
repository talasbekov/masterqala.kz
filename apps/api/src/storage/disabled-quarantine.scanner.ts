import { FileScanResult, QuarantineScanner, ScannerHealth } from './quarantine-scanner.interface';

export class DisabledQuarantineScanner implements QuarantineScanner {
  async scan(): Promise<FileScanResult> {
    return { status: 'CLEAN' };
  }

  async healthCheck(): Promise<ScannerHealth> {
    return { status: 'DISABLED', mode: 'DISABLED', latencyMs: 0 };
  }
}
