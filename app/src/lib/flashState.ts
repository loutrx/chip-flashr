import type { ErrorCode, FlashReport, FlashRequest, ImageEntry, Phase, ProgressEvent, UserFacingError } from './types';

export type StepKind = 'connecting' | 'erasing' | 'writing' | 'verifying' | 'resetting';
export type StepStatus = 'pending' | 'active' | 'done';

export interface Step {
  kind: StepKind;
  /** The image a writing step writes; null for the other steps. */
  image: ImageEntry | null;
  /** 0-based image index and image count of a writing step, like `Phase.writing`. */
  index: number | null;
  count: number | null;
  status: StepStatus;
  startedAt: number | null;
  durationMs: number | null;
}

export type FlashState =
  | { status: 'idle' }
  | {
      status: 'flashing';
      request: FlashRequest;
      images: ImageEntry[];
      steps: Step[];
      percent: number;
      phase: Phase | null;
      bytesDone: number;
      bytesTotal: number;
      writeStartedAt: number | null;
      remainingMs: number | null;
    }
  | { status: 'success'; request: FlashRequest; images: ImageEntry[]; steps: Step[]; report: FlashReport }
  | { status: 'failure'; request: FlashRequest; images: ImageEntry[]; steps: Step[]; error: UserFacingError };

/** `at` is the UI's clock (`Date.now()`) when the action happened; durations are measured from it. */
export type FlashAction =
  | { type: 'start'; request: FlashRequest; images: ImageEntry[]; at: number }
  | { type: 'progress'; event: ProgressEvent; at: number }
  | { type: 'success'; report: FlashReport; at: number }
  | { type: 'failure'; error: UserFacingError; at: number }
  | { type: 'reset' };

/** Measured in the ESP32 field test (spec D9). */
export const THROUGHPUT_BYTES_PER_S = 150 * 1024;

const ESTIMATE_STEP_MS = 5_000;
const REMAINING_AFTER_MS = 1_000;
const REMAINING_MAX_RISE = 1.2;

/** Whole-job percent, floored, within 0..100; 0 when there is nothing to write. */
export function percentOf(event: ProgressEvent): number {
  if (!(event.bytesTotal > 0)) return 0;
  const raw = Math.floor((event.bytesDone / event.bytesTotal) * 100);
  return Math.min(100, Math.max(0, raw));
}

const sizeOf = (images: readonly ImageEntry[]): number => images.reduce((sum, image) => sum + image.size, 0);

function step(kind: StepKind, image: ImageEntry | null = null, index: number | null = null, count: number | null = null): Step {
  return { kind, image, index, count, status: 'pending', startedAt: null, durationMs: null };
}

export function initialSteps(images: ImageEntry[]): Step[] {
  return [
    step('connecting'),
    step('erasing'),
    ...images.map((image, index) => step('writing', image, index, images.length)),
    step('verifying'),
    step('resetting'),
  ];
}

/** "Environ 10 secondes": the size at the measured throughput, rounded up to 5 s, never under 5 s. */
export function estimateMs(totalBytes: number): number {
  const ms = (Math.max(0, totalBytes) / THROUGHPUT_BYTES_PER_S) * 1000;
  return Math.max(ESTIMATE_STEP_MS, Math.ceil(ms / ESTIMATE_STEP_MS) * ESTIMATE_STEP_MS);
}

/** Where a phase sits in `initialSteps`; null for a writing index the job has no image for. */
function stepPosition(phase: Phase, imageCount: number): number | null {
  switch (phase.kind) {
    case 'connecting':
      return 0;
    case 'erasing':
      return 1;
    case 'writing':
      return phase.index >= 0 && phase.index < imageCount ? 2 + phase.index : null;
    case 'verifying':
      return 2 + imageCount;
    case 'resetting':
      return 3 + imageCount;
  }
}

const elapsedSince = (started: Step, at: number): number | null =>
  started.startedAt === null ? null : at - started.startedAt;

const finish = (current: Step, at: number): Step =>
  current.status === 'done' ? current : { ...current, status: 'done', durationMs: elapsedSince(current, at) };

/** Earlier steps done, the step at `position` active; an event for an earlier step changes nothing. */
function advance(steps: Step[], position: number, at: number): Step[] {
  let furthest = -1;
  steps.forEach((current, index) => {
    if (current.status !== 'pending') furthest = index;
  });
  if (position <= furthest) return steps;
  return steps.map((current, index) => {
    if (index < position) return finish(current, at);
    if (index === position) return { ...current, status: 'active', startedAt: at };
    return current;
  });
}

/** Null before 1 s of writing; then from the measured throughput, rising at most 20 % per update. */
function remaining(
  previous: number | null,
  writeStartedAt: number | null,
  bytesDone: number,
  bytesTotal: number,
  at: number,
): number | null {
  if (writeStartedAt === null) return null;
  const left = Math.max(0, bytesTotal - bytesDone);
  if (left === 0) return 0;
  const elapsed = at - writeStartedAt;
  if (elapsed < REMAINING_AFTER_MS) return null;
  if (bytesDone <= 0) return previous;
  const raw = left / (bytesDone / elapsed);
  return Math.round(previous === null ? raw : Math.min(raw, previous * REMAINING_MAX_RISE));
}

/** The image being written and its own percentage, for the per-file bar of screen 05. */
export function imageProgress(state: FlashState): { index: number; percent: number } | null {
  const phase = state.status === 'flashing' ? state.phase : null;
  if (state.status !== 'flashing' || phase === null || phase.kind !== 'writing') return null;
  const image = state.images[phase.index];
  if (!image) return null;
  if (image.size <= 0) return { index: phase.index, percent: 100 };
  const before = sizeOf(state.images.slice(0, phase.index));
  const raw = Math.floor(((state.bytesDone - before) / image.size) * 100);
  return { index: phase.index, percent: Math.min(100, Math.max(0, raw)) };
}

export function flashReducer(state: FlashState, action: FlashAction): FlashState {
  switch (action.type) {
    case 'start': {
      if (state.status === 'flashing') return state;
      const steps = initialSteps(action.images);
      steps[0] = { ...steps[0], status: 'active', startedAt: action.at };
      return {
        status: 'flashing',
        request: action.request,
        images: action.images,
        steps,
        percent: 0,
        phase: null,
        bytesDone: 0,
        bytesTotal: sizeOf(action.images),
        writeStartedAt: null,
        remainingMs: null,
      };
    }
    case 'progress': {
      // Late events (after cancel, failure or success) must not revive the progress screen.
      if (state.status !== 'flashing') return state;
      const { event, at } = action;
      const bytesDone = Math.max(state.bytesDone, event.bytesDone);
      const writeStartedAt = state.writeStartedAt ?? (event.phase.kind === 'writing' ? at : null);
      const position = stepPosition(event.phase, state.images.length);
      return {
        ...state,
        steps: position === null ? state.steps : advance(state.steps, position, at),
        percent: Math.max(state.percent, percentOf(event)),
        phase: event.phase,
        bytesDone,
        bytesTotal: event.bytesTotal,
        writeStartedAt,
        remainingMs: remaining(state.remainingMs, writeStartedAt, bytesDone, event.bytesTotal, at),
      };
    }
    case 'success':
      if (state.status !== 'flashing') return state;
      return {
        status: 'success',
        request: state.request,
        images: state.images,
        steps: state.steps.map((current) => finish(current, action.at)),
        report: action.report,
      };
    case 'failure':
      if (state.status !== 'flashing') return state;
      return {
        status: 'failure',
        request: state.request,
        images: state.images,
        // The active step stays active: it is the one that failed.
        steps: state.steps.map((current) =>
          current.status === 'active' ? { ...current, durationMs: elapsedSince(current, action.at) } : current,
        ),
        error: action.error,
      };
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

const PHASE_KINDS: ReadonlySet<string> = new Set<Phase['kind']>([
  'connecting',
  'erasing',
  'writing',
  'verifying',
  'resetting',
]);

function phaseOrNull(value: unknown): Phase | null {
  if (typeof value !== 'object' || value === null || !('kind' in value)) return null;
  return typeof value.kind === 'string' && PHASE_KINDS.has(value.kind) ? (value as Phase) : null;
}

function percentOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100 ? value : null;
}

/** Normalize whatever `invoke` rejected with into a UserFacingError. */
export function toUserFacingError(error: unknown): UserFacingError {
  if (typeof error === 'object' && error !== null && 'code' in error && 'technical' in error) {
    const { code, technical } = error;
    if (typeof code === 'string' && KNOWN_CODES.has(code) && typeof technical === 'string') {
      return {
        code: code as ErrorCode,
        technical,
        phase: 'phase' in error ? phaseOrNull(error.phase) : null,
        percent: 'percent' in error ? percentOrNull(error.percent) : null,
      };
    }
  }
  return {
    code: 'device-error',
    technical: typeof error === 'string' ? error : (JSON.stringify(error) ?? String(error)),
    phase: null,
    percent: null,
  };
}
