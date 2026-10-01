import { describe, expect, it } from 'vitest';
import {
  estimateMs,
  flashReducer,
  imageProgress,
  initialSteps,
  percentOf,
  THROUGHPUT_BYTES_PER_S,
  toUserFacingError,
  type FlashAction,
  type FlashState,
  type Step,
  type StepKind,
} from './flashState';
import type { FlashReport, FlashRequest, ImageEntry, Phase, ProgressEvent, UserFacingError } from './types';

const CHUNK = 4096;
const IMAGES: ImageEntry[] = [
  { address: 0x0, name: 'boot.bin', size: 3 * CHUNK },
  { address: 0x1_0000, name: 'app.bin', size: 5 * CHUNK },
];
const TOTAL = 8 * CHUNK;
const REQUEST: FlashRequest = { firmwareId: 'fw-small', targetId: 'mock:esp32', family: null };
const REPORT: FlashReport = { bytesWritten: TOTAL, durationMs: 3250, verified: true, log: ['verify ok', 'reset'] };
const ERROR: UserFacingError = { code: 'device-error', technical: 'timeout', phase: null, percent: null };
const idle: FlashState = { status: 'idle' };

const event = (phase: Phase, bytesDone: number): ProgressEvent => ({ phase, bytesDone, bytesTotal: TOTAL });
const writing = (index: number, bytesDone: number): ProgressEvent =>
  event({ kind: 'writing', index, count: 2, label: IMAGES[index].name, address: IMAGES[index].address }, bytesDone);
const start = (at = 0): FlashAction => ({ type: 'start', request: REQUEST, images: IMAGES, at });
const progress = (source: ProgressEvent, at: number): FlashAction => ({ type: 'progress', event: source, at });
const run = (actions: FlashAction[], from: FlashState = idle): FlashState => actions.reduce(flashReducer, from);

function flashing(state: FlashState) {
  if (state.status !== 'flashing') throw new Error(`expected a running job, got ${state.status}`);
  return state;
}

const timeline = (steps: Step[]) => steps.map((step) => [step.status, step.durationMs]);

function pending(kind: StepKind, image: ImageEntry | null = null, index: number | null = null): Step {
  return { kind, image, index, count: index === null ? null : 2, status: 'pending', startedAt: null, durationMs: null };
}

describe('percentOf', () => {
  it('is 0 when there is nothing to write', () => {
    expect(percentOf({ ...writing(0, 0), bytesTotal: 0 })).toBe(0);
  });
  it('floors and clamps to 0..100', () => {
    expect(percentOf({ ...writing(0, 1), bytesTotal: 3 })).toBe(33);
    expect(percentOf({ ...writing(0, 300), bytesTotal: 200 })).toBe(100);
    expect(percentOf({ ...writing(0, -5), bytesTotal: 200 })).toBe(0);
  });
});

describe('initialSteps', () => {
  it('connects, erases, writes each image, verifies and resets', () => {
    expect(initialSteps(IMAGES)).toEqual([
      pending('connecting'),
      pending('erasing'),
      pending('writing', IMAGES[0], 0),
      pending('writing', IMAGES[1], 1),
      pending('verifying'),
      pending('resetting'),
    ]);
  });
});

describe('estimateMs', () => {
  it('uses the measured 150 KB/s, rounded up to 5 s', () => {
    expect(THROUGHPUT_BYTES_PER_S).toBe(153_600);
    expect(estimateMs(1_186_202)).toBe(10_000); // the Thermostat package
    expect(estimateMs(5 * THROUGHPUT_BYTES_PER_S)).toBe(5_000);
    expect(estimateMs(5 * THROUGHPUT_BYTES_PER_S + 1)).toBe(10_000);
  });
  it('never says less than 5 s', () => {
    expect(estimateMs(0)).toBe(5_000);
    expect(estimateMs(1)).toBe(5_000);
  });
});

describe('flashReducer', () => {
  it('starts with the connection step active', () => {
    expect(flashReducer(idle, start(1000))).toEqual({
      status: 'flashing',
      request: REQUEST,
      images: IMAGES,
      steps: [{ ...pending('connecting'), status: 'active', startedAt: 1000 }, ...initialSteps(IMAGES).slice(1)],
      percent: 0,
      phase: null,
      bytesDone: 0,
      bytesTotal: TOTAL,
      writeStartedAt: null,
      remainingMs: null,
    });
  });

  it('ignores a second start while flashing', () => {
    const state = run([start(), progress(writing(0, CHUNK), 100)]);
    expect(flashReducer(state, start(200))).toBe(state);
  });

  it('starts a fresh job from a failure (Réessayer)', () => {
    const failed = run([start(), progress(writing(0, CHUNK), 100), { type: 'failure', error: ERROR, at: 200 }]);
    expect(flashReducer(failed, start(300))).toEqual(flashReducer(idle, start(300)));
  });

  it('times every step from the event timestamps', () => {
    const verifying = run([
      start(1000),
      progress(event({ kind: 'connecting' }, 0), 1000),
      progress(event({ kind: 'erasing' }, 0), 1300),
      progress(writing(0, CHUNK), 1500),
      progress(writing(0, 3 * CHUNK), 2000),
      progress(writing(1, 4 * CHUNK), 2500),
      progress(event({ kind: 'verifying' }, TOTAL), 3000),
    ]);
    expect(timeline(flashing(verifying).steps)).toEqual([
      ['done', 300],
      ['done', 200],
      ['done', 1000],
      ['done', 500],
      ['active', null],
      ['pending', null],
    ]);
    const done = run([progress(event({ kind: 'resetting' }, TOTAL), 3200), { type: 'success', report: REPORT, at: 3250 }], verifying);
    expect(done).toMatchObject({ status: 'success', request: REQUEST, images: IMAGES, report: REPORT });
    expect(done.status === 'success' && timeline(done.steps)).toEqual([
      ['done', 300],
      ['done', 200],
      ['done', 1000],
      ['done', 500],
      ['done', 200],
      ['done', 50],
    ]);
  });

  it('marks a skipped step done without a duration', () => {
    const state = run([start(0), progress(writing(0, CHUNK), 100)]);
    expect(timeline(flashing(state).steps).slice(0, 3)).toEqual([
      ['done', 100],
      ['done', null],
      ['active', null],
    ]);
  });

  it('never moves a step backwards on a late event', () => {
    const state = run([start(0), progress(writing(1, 4 * CHUNK), 100)]);
    const late = flashReducer(state, progress(event({ kind: 'erasing' }, 0), 150));
    expect(flashing(late).steps).toEqual(flashing(state).steps);
  });

  it('never lowers the percentage', () => {
    const state = run([start(), progress(writing(1, 6 * CHUNK), 100), progress(writing(0, CHUNK), 200)]);
    expect(flashing(state).percent).toBe(75);
    expect(flashing(state).bytesDone).toBe(6 * CHUNK);
  });

  it('shows the remaining time after 1 s of writing, rising at most 20 % per update', () => {
    let state = run([
      start(0),
      progress(event({ kind: 'connecting' }, 0), 0),
      progress(event({ kind: 'erasing' }, 0), 100),
      progress(writing(0, CHUNK), 200),
    ]);
    expect(flashing(state)).toMatchObject({ writeStartedAt: 200, remainingMs: null });
    state = flashReducer(state, progress(writing(0, 2 * CHUNK), 700));
    expect(flashing(state).remainingMs).toBeNull();
    // 12 288 B in 1 s; 20 480 B left.
    state = flashReducer(state, progress(writing(0, 3 * CHUNK), 1200));
    expect(flashing(state).remainingMs).toBe(1667);
    // Slower: 3 s by the measure, capped at 1667 × 1.2.
    state = flashReducer(state, progress(writing(1, 4 * CHUNK), 3200));
    expect(flashing(state).remainingMs).toBe(2000);
    // Faster again: going down is never capped.
    state = flashReducer(state, progress(writing(1, 7 * CHUNK), 3700));
    expect(flashing(state).remainingMs).toBe(500);
    state = flashReducer(state, progress(event({ kind: 'verifying' }, TOTAL), 3800));
    expect(flashing(state).remainingMs).toBe(0);
  });

  it('keeps the failed step active, with its duration until the failure', () => {
    const failed = run([
      start(0),
      progress(event({ kind: 'erasing' }, 0), 100),
      progress(writing(0, CHUNK), 300),
      { type: 'failure', error: ERROR, at: 800 },
    ]);
    expect(failed).toMatchObject({ status: 'failure', request: REQUEST, images: IMAGES, error: ERROR });
    expect(failed.status === 'failure' && timeline(failed.steps)).toEqual([
      ['done', 100],
      ['done', 200],
      ['active', 500],
      ['pending', null],
      ['pending', null],
      ['pending', null],
    ]);
  });

  it('ignores progress once the job has ended', () => {
    const failed = run([start(), { type: 'failure', error: ERROR, at: 100 }]);
    expect(flashReducer(failed, progress(writing(1, 7 * CHUNK), 200))).toBe(failed);
    const succeeded = run([start(), { type: 'success', report: REPORT, at: 100 }]);
    expect(flashReducer(succeeded, progress(writing(1, 7 * CHUNK), 200))).toBe(succeeded);
  });

  it('ignores a second result once the job has ended', () => {
    const failed = run([start(), { type: 'failure', error: ERROR, at: 100 }]);
    expect(flashReducer(failed, { type: 'success', report: REPORT, at: 200 })).toBe(failed);
    const succeeded = run([start(), { type: 'success', report: REPORT, at: 100 }]);
    expect(flashReducer(succeeded, { type: 'failure', error: ERROR, at: 200 })).toBe(succeeded);
  });

  it('ignores a result with no job running', () => {
    expect(flashReducer(idle, { type: 'success', report: REPORT, at: 0 })).toBe(idle);
    expect(flashReducer(idle, { type: 'failure', error: ERROR, at: 0 })).toBe(idle);
  });

  it('goes back to idle on reset', () => {
    expect(flashReducer(run([start(), { type: 'success', report: REPORT, at: 1 }]), { type: 'reset' })).toEqual(idle);
  });
});

describe('imageProgress', () => {
  it('follows the image being written', () => {
    expect(imageProgress(run([start(), progress(writing(0, 2 * CHUNK), 100)]))).toEqual({ index: 0, percent: 66 });
    expect(imageProgress(run([start(), progress(writing(1, 4 * CHUNK), 100)]))).toEqual({ index: 1, percent: 20 });
  });

  it('is null outside the writing steps', () => {
    expect(imageProgress(idle)).toBeNull();
    expect(imageProgress(run([start()]))).toBeNull();
    expect(imageProgress(run([start(), progress(event({ kind: 'verifying' }, TOTAL), 100)]))).toBeNull();
  });
});

describe('toUserFacingError', () => {
  it('keeps a structured error from Rust', () => {
    expect(toUserFacingError({ code: 'cancelled', technical: 'cancelled by the user' })).toEqual({
      code: 'cancelled',
      technical: 'cancelled by the user',
      phase: null,
      percent: null,
    });
  });
  it('keeps the phase and percent the job had reached', () => {
    const phase = { kind: 'writing', index: 3, count: 4, label: 'thermostat.bin', address: 0x10000 };
    expect(toUserFacingError({ code: 'device-error', technical: 'x', phase, percent: 41 })).toEqual({
      code: 'device-error',
      technical: 'x',
      phase,
      percent: 41,
    });
    expect(toUserFacingError({ code: 'device-error', technical: 'x', phase: { kind: 'nope' }, percent: 410 })).toMatchObject({
      phase: null,
      percent: null,
    });
  });
  it('wraps anything else as a device error', () => {
    expect(toUserFacingError('IPC broken')).toEqual({ code: 'device-error', technical: 'IPC broken', phase: null, percent: null });
    expect(toUserFacingError({ code: 'not-a-real-code', technical: 'x' }).code).toBe('device-error');
  });
});
