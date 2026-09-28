import type { ErrorCode, FlashReport, Phase, ProgressEvent, UserFacingError } from './types';

export type FlashState =
  | { status: 'idle' }
  | { status: 'flashing'; percent: number; phase: Phase | null }
  | { status: 'success'; report: FlashReport }
  | { status: 'failure'; error: UserFacingError };

export type FlashAction =
  | { type: 'start' }
  | { type: 'progress'; event: ProgressEvent }
  | { type: 'success'; report: FlashReport }
  | { type: 'failure'; error: UserFacingError }
  | { type: 'reset' };

/** Whole-job percent, floored, within 0..100; 0 when there is nothing to write. */
export function percentOf(event: ProgressEvent): number {
  if (!(event.bytesTotal > 0)) return 0;
  const raw = Math.floor((event.bytesDone / event.bytesTotal) * 100);
  return Math.min(100, Math.max(0, raw));
}

export function flashReducer(state: FlashState, action: FlashAction): FlashState {
  switch (action.type) {
    case 'start':
      return state.status === 'flashing' ? state : { status: 'flashing', percent: 0, phase: null };
    case 'progress':
      // Late events (after cancel, failure or success) must not revive the progress screen.
      if (state.status !== 'flashing') return state;
      return {
        status: 'flashing',
        percent: Math.max(state.percent, percentOf(action.event)),
        phase: action.event.phase,
      };
    case 'success':
      return { status: 'success', report: action.report };
    case 'failure':
      return { status: 'failure', error: action.error };
    case 'reset':
      return { status: 'idle' };
  }
}

const KNOWN_CODES: ReadonlySet<string> = new Set<ErrorCode>([
  'cancelled',
  'target-not-found',
  'invalid-plan',
  'family-mismatch',
  'device-error',
  'already-running',
]);

/** Normalize whatever `invoke` rejected with into a UserFacingError. */
export function toUserFacingError(error: unknown): UserFacingError {
  if (typeof error === 'object' && error !== null && 'code' in error && 'technical' in error) {
    const { code, technical } = error as { code: unknown; technical: unknown };
    if (typeof code === 'string' && KNOWN_CODES.has(code) && typeof technical === 'string') {
      return { code: code as ErrorCode, technical };
    }
  }
  return { code: 'device-error', technical: typeof error === 'string' ? error : (JSON.stringify(error) ?? String(error)) };
}
