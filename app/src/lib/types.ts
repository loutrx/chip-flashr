// Mirrors the Rust wire format one to one: camelCase fields, kebab-case tags, null for None.

export type Family = 'esp32' | 'stm32' | 'nrf';

export type FolderKind = 'app' | 'watched';

export interface WatchedFolder {
  path: string;
  kind: FolderKind;
}

export type SourceKind = 'esp-idf-build' | 'arduino' | 'platform-io' | 'elf' | 'hex' | 'bin' | 'file-name';

export interface ImageEntry {
  address: number;
  name: string;
  size: number;
}

export type GuessReason = { kind: 'start-address'; address: number } | { kind: 'file-name' };

export type FamilyGuess =
  | { kind: 'certain'; family: Family }
  | { kind: 'suggested'; family: Family; reason: GuessReason }
  | { kind: 'unknown' };

export type CheckStatus = 'ok' | 'warning' | 'error';

export type CheckCode = 'manifest-read' | 'file-present' | 'file-missing' | 'nonstandard-name';

export interface Check {
  status: CheckStatus;
  code: CheckCode;
  params: Record<string, string>;
}

export interface Readme {
  fileName: string;
}

export interface FirmwareSummary {
  id: string;
  path: string;
  fileName: string;
  folder: number;
  source: SourceKind;
  name: string | null;
  version: string | null;
  variant: string | null;
  chip: string | null;
  family: FamilyGuess;
  toolchain: string | null;
  builtAt: string | null;
  sizeBytes: number;
  addressRanges: number;
  images: ImageEntry[];
  manifest: string | null;
  checks: Check[];
  readme: Readme | null;
}

export type Link = { kind: 'usb-jtag' } | { kind: 'usb-serial'; bridge: string } | { kind: 'probe'; name: string };

export interface Target {
  id: string;
  family: Family;
  label: string;
  chip: string | null;
  port: string;
  link: Link;
  flashSize: number | null;
}

export type LockKind = 'approtect';

export interface ToolStatus {
  name: string;
  installed: boolean;
}

export interface Download {
  title: string;
  publisher: string;
  versionHint: string;
  sizeHint: string | null;
  url: string;
}

export type DeviceIssue =
  | {
      kind: 'missing-driver';
      family: Family;
      vendor: string;
      name: string;
      vid: number;
      pid: number;
      download: Download;
      inf: string | null;
    }
  | {
      kind: 'missing-tool';
      family: Family;
      targetLabel: string;
      locked: LockKind | null;
      tools: ToolStatus[];
      download: Download;
      installCommand: string | null;
    };

export interface Snapshot {
  folders: WatchedFolder[];
  firmwares: FirmwareSummary[];
  targets: Target[];
  issues: DeviceIssue[];
}

export type Trigger = 'recheck' | 'add-folder' | 'open-file' | { afterMs: number };

export interface Transition {
  on: Trigger;
  to: number;
}

export interface Stage {
  snapshot: Snapshot;
  next: Transition[];
}

export interface Scenario {
  name: string;
  stages: Stage[];
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
  log: string[];
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
  /** Where the job was when it failed; null when it failed before any progress. */
  phase: Phase | null;
  percent: number | null;
}

export interface AppInfo {
  name: string;
  version: string;
  scenario: string | null;
  scenarioWarning: string | null;
}

export interface FlashRequest {
  firmwareId: string;
  targetId: string;
  /** The family the user confirmed for a firmware whose family is not certain. */
  family: Family | null;
}
