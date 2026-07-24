import { FileScanResult, QuarantineScanner } from './quarantine-scanner.interface';

export class DisabledQuarantineScanner implements QuarantineScanner {
  async scan(): Promise<FileScanResult> {
    return { status: 'CLEAN' };
  }
}
