export type FileScanResult =
  | { status: 'CLEAN' }
  | { status: 'INFECTED'; signature?: string };

export interface QuarantineScanner {
  scan(absolutePath: string): Promise<FileScanResult>;
}

export const QUARANTINE_SCANNER = Symbol('QUARANTINE_SCANNER');
