export type Family = 'esp32' | 'stm32' | 'nrf';

export interface Target {
  id: string;
  family: Family;
  label: string;
}

export type Phase =
  | { kind: 'connecting' }
  | { kind: 'erasing' }
  | { kind: 'writing'; index: number; count: number; label: string; address: number }
  | { kind: 'verifying' }
  | { kind: 'resetting' };

export interface ProgressEvent {
  phase: Phase;
  bytesDone: number;
  bytesTotal: number;
}

export interface FlashReport {
  bytesWritten: number;
  durationMs: number;
  verified: boolean;
}

export type ErrorCode =
  | 'cancelled'
  | 'target-not-found'
  | 'invalid-plan'
  | 'family-mismatch'
  | 'device-error'
  | 'already-running';

export interface UserFacingError {
  code: ErrorCode;
  technical: string;
}

export interface AppInfo {
  name: string;
  version: string;
}
