import type { FlashState } from '../flashState';
import type { DeviceIssue, Family, FirmwareSummary, Snapshot, Target } from '../types';

/** Screens 04, 08, 09, 10 and 11: reachable now, built in plan 3b. */
export type ProvisionalId = 'waiting-board' | 'missing-driver' | 'external-tool' | 'no-firmware' | 'incomplete';

export type ScreenId =
  | 'loading'
  | 'home'
  | 'firmware-list'
  | 'choose-chip'
  | 'programming'
  | 'success'
  | 'failure'
  | ProvisionalId;

/** What the user decided. The facts come from the snapshot, never from here. */
export interface Choices {
  /** Picked on 02. */
  firmwareId: string | null;
  /** Confirmed on 03, per firmware id. */
  families: Record<string, Family>;
  /** "Changer" opened the list. */
  browsing: boolean;
  boardsThisSession: number;
}

export const INITIAL_CHOICES: Choices = { firmwareId: null, families: {}, browsing: false, boardsThisSession: 0 };

/** The picked firmware while the snapshot still has it, else the only one, else none. */
export function currentFirmware(snapshot: Snapshot, choices: Choices): FirmwareSummary | null {
  const picked =
    choices.firmwareId === null ? undefined : snapshot.firmwares.find((firmware) => firmware.id === choices.firmwareId);
  if (picked) return picked;
  return snapshot.firmwares.length === 1 ? snapshot.firmwares[0] : null;
}

/** A certain family, else the one the user confirmed on 03. */
export function familyOf(firmware: FirmwareSummary, choices: Choices): Family | null {
  if (firmware.family.kind === 'certain') return firmware.family.family;
  return Object.hasOwn(choices.families, firmware.id) ? choices.families[firmware.id] : null;
}

export function isInvalid(firmware: FirmwareSummary): boolean {
  return firmware.checks.some((check) => check.status === 'error');
}

/** The first board of the family; choosing between several boards is the next design pass. */
export function currentTarget(snapshot: Snapshot, family: Family | null): Target | null {
  if (family === null) return null;
  return snapshot.targets.find((target) => target.family === family) ?? null;
}

export function currentIssue(snapshot: Snapshot, family: Family | null): DeviceIssue | null {
  if (family === null) return null;
  return snapshot.issues.find((issue) => issue.family === family) ?? null;
}

/** The spec's "Choosing the screen" table: the first rule that applies. */
export function screenOf(snapshot: Snapshot | null, choices: Choices, job: FlashState): ScreenId {
  if (snapshot === null) return 'loading';
  if (job.status === 'flashing') return 'programming';
  if (job.status === 'success') return 'success';
  if (job.status === 'failure') return 'failure';
  if (snapshot.firmwares.length === 0) return 'no-firmware';
  const firmware = currentFirmware(snapshot, choices);
  if (choices.browsing || firmware === null) return 'firmware-list';
  if (isInvalid(firmware)) return 'incomplete';
  const family = familyOf(firmware, choices);
  if (family === null) return 'choose-chip';
  const issue = currentIssue(snapshot, family);
  if (issue) return issue.kind === 'missing-driver' ? 'missing-driver' : 'external-tool';
  if (currentTarget(snapshot, family) === null) return 'waiting-board';
  return 'home';
}
