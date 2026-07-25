export type FileScanResult =
  | { status: 'CLEAN' }
  | { status: 'INFECTED'; signature?: string };

export type ScannerHealth =
  | { status: 'UP'; mode: 'CLAMAV'; latencyMs: number }
  | { status: 'DISABLED'; mode: 'DISABLED'; latencyMs: 0 };

export interface QuarantineScanner {
  scan(absolutePath: string): Promise<FileScanResult>;
  healthCheck(): Promise<ScannerHealth>;
}

export const QUARANTINE_SCANNER = Symbol('QUARANTINE_SCANNER');
