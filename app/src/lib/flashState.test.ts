import { describe, expect, it } from 'vitest';
import { flashReducer, percentOf, toUserFacingError, type FlashState } from './flashState';
import type { ProgressEvent } from './types';

const writing = (done: number, total: number): ProgressEvent => ({
  phase: { kind: 'writing', index: 0, count: 1, label: 'app.bin', address: 0x10000 },
  bytesDone: done,
  bytesTotal: total,
});

describe('percentOf', () => {
  it('is 0 when there is nothing to write', () => {
    expect(percentOf(writing(0, 0))).toBe(0);
  });
  it('floors and clamps to 0..100', () => {
    expect(percentOf(writing(1, 3))).toBe(33);
    expect(percentOf(writing(300, 200))).toBe(100);
    expect(percentOf(writing(-5, 200))).toBe(0);
  });
});

describe('flashReducer', () => {
  const idle: FlashState = { status: 'idle' };

  it('starts at 0 %', () => {
    expect(flashReducer(idle, { type: 'start' })).toEqual({ status: 'flashing', percent: 0, phase: null });
  });

  it('follows progress and keeps the phase', () => {
    const s = flashReducer(flashReducer(idle, { type: 'start' }), { type: 'progress', event: writing(50, 100) });
    expect(s).toEqual({ status: 'flashing', percent: 50, phase: writing(50, 100).phase });
  });

  it('never goes backwards', () => {
    let s = flashReducer(idle, { type: 'start' });
    s = flashReducer(s, { type: 'progress', event: writing(80, 100) });
    s = flashReducer(s, { type: 'progress', event: writing(20, 100) });
    expect(s.status === 'flashing' && s.percent).toBe(80);
  });

  it('ignores a second start while flashing', () => {
    const flashing = flashReducer(flashReducer(idle, { type: 'start' }), { type: 'progress', event: writing(40, 100) });
    expect(flashReducer(flashing, { type: 'start' })).toBe(flashing);
  });

  it('ignores progress after failure', () => {
    const failed = flashReducer(flashReducer(idle, { type: 'start' }), {
      type: 'failure',
      error: { code: 'device-error', technical: 'timeout', phase: null, percent: null },
    });
    expect(flashReducer(failed, { type: 'progress', event: writing(99, 100) })).toBe(failed);
  });

  it('goes back to idle on reset', () => {
    const done = flashReducer(idle, {
      type: 'success',
      report: { bytesWritten: 1, durationMs: 2, verified: true, log: [] },
    });
    expect(flashReducer(done, { type: 'reset' })).toEqual(idle);
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
