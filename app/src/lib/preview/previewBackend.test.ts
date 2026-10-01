import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import packageJson from '../../../package.json';
import { firmware, snapshot, target } from '../app/fixtures';
import { percentOf } from '../flashState';
import type { FlashRequest, ImageEntry, ProgressEvent, Scenario, Snapshot, Stage } from '../types';
import { createPreviewBackend, createPreviewBackendOn, previewOptionsFromSearch, type PreviewOptions } from './previewBackend';
import { SCENARIOS } from './scenarios';

const fast: PreviewOptions = { chunkDelayMs: 1, failAtPercent: null, scenario: null };
const CHUNK = 4096;
const IMAGES: ImageEntry[] = [
  { address: 0x0, name: 'boot.bin', size: 3 * CHUNK },
  { address: 0x1_0000, name: 'app.bin', size: 5 * CHUNK },
];
const BOARD = target();
const SMALL = firmware({ id: 'fw-small', images: IMAGES });
const REQUEST: FlashRequest = { firmwareId: 'fw-small', targetId: BOARD.id, family: null };

const stage = (snap: Snapshot, next: Stage['next'] = []): Stage => ({ snapshot: snap, next });
const scenarioOf = (...stages: Stage[]): Scenario => ({ name: 'test', stages });
/** Snapshots told apart by their number of firmwares. */
const numbered = (count: number): Snapshot =>
  snapshot({ firmwares: Array.from({ length: count }, (_, i) => firmware({ id: `fw-${i}` })) });

function onSmallBoard(options: Partial<PreviewOptions> = {}, firmwares = [SMALL]) {
  return createPreviewBackendOn(scenarioOf(stage(snapshot({ firmwares, targets: [BOARD] }))), null, { ...fast, ...options });
}

function recorder() {
  const events: ProgressEvent[] = [];
  return { events, onProgress: (event: ProgressEvent) => events.push(event) };
}

function collect() {
  const seen: Snapshot[] = [];
  return { seen, listener: (next: Snapshot) => seen.push(next) };
}

const kinds = (events: ProgressEvent[]) => events.map((event) => event.phase.kind);

/** The rejection of `job`; the test fails if it resolves. */
function rejectionOf(job: Promise<unknown>): Promise<unknown> {
  return job.then(
    () => {
      throw new Error('expected the job to fail');
    },
    (error: unknown) => error,
  );
}

function afterMsOf(source: Stage): { delay: number; to: number } | null {
  for (const transition of source.next) {
    if (typeof transition.on === 'object') return { delay: transition.on.afterMs, to: transition.to };
  }
  return null;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('scenarios in the preview', () => {
  it('serves the first stage of each scenario and names it', async () => {
    for (const [name, scenario] of Object.entries(SCENARIOS)) {
      const backend = createPreviewBackend({ ...fast, scenario: name });
      expect(await backend.snapshot(), name).toEqual(scenario.stages[0].snapshot);
      expect(await backend.appInfo()).toEqual({
        name: 'Chip Flashr',
        version: packageJson.version,
        scenario: name,
        scenarioWarning: null,
      });
    }
  });

  it('runs the default scenario and names an unknown one', async () => {
    const backend = createPreviewBackend({ ...fast, scenario: 'nope' });
    expect(await backend.snapshot()).toEqual(SCENARIOS.default.stages[0].snapshot);
    expect(await backend.appInfo()).toMatchObject({ scenario: 'default', scenarioWarning: 'nope' });
  });

  it('hands out copies of the snapshot', async () => {
    const backend = createPreviewBackend(fast);
    (await backend.snapshot()).firmwares.length = 0;
    expect(await backend.snapshot()).toEqual(SCENARIOS.default.stages[0].snapshot);
  });
});

describe('stage delays', () => {
  it('moves on after the delay and tells every listener', async () => {
    const backend = createPreviewBackendOn(
      scenarioOf(stage(numbered(1), [{ on: { afterMs: 4000 }, to: 1 }]), stage(numbered(2))),
      null,
      fast,
    );
    const first = collect();
    const second = collect();
    backend.onSnapshot(first.listener);
    backend.onSnapshot(second.listener);
    await vi.advanceTimersByTimeAsync(3999);
    expect(first.seen).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(first.seen).toEqual([numbered(2)]);
    expect(second.seen).toEqual([numbered(2)]);
    expect(await backend.snapshot()).toEqual(numbered(2));
  });

  it('starts the next stage’s delay once the stage changes', async () => {
    const backend = createPreviewBackendOn(
      scenarioOf(
        stage(numbered(1), [{ on: { afterMs: 1000 }, to: 1 }]),
        stage(numbered(2), [{ on: { afterMs: 2000 }, to: 2 }]),
        stage(numbered(3)),
      ),
      null,
      fast,
    );
    const { seen, listener } = collect();
    backend.onSnapshot(listener);
    await vi.advanceTimersByTimeAsync(1000);
    expect(seen).toEqual([numbered(2)]);
    await vi.advanceTimersByTimeAsync(1999);
    expect(seen).toEqual([numbered(2)]);
    await vi.advanceTimersByTimeAsync(1);
    expect(seen).toEqual([numbered(2), numbered(3)]);
  });

  it('drops the pending delay when a trigger moves the stage first', async () => {
    const backend = createPreviewBackendOn(
      scenarioOf(
        stage(numbered(1), [
          { on: { afterMs: 1000 }, to: 1 },
          { on: 'recheck', to: 2 },
        ]),
        stage(numbered(2)),
        stage(numbered(3)),
      ),
      null,
      fast,
    );
    const { seen, listener } = collect();
    backend.onSnapshot(listener);
    await backend.recheck();
    await vi.advanceTimersByTimeAsync(5000);
    expect(seen).toEqual([numbered(3)]);
    expect(await backend.snapshot()).toEqual(numbered(3));
  });

  it('stops calling a listener once it unsubscribes', async () => {
    const backend = createPreviewBackendOn(
      scenarioOf(stage(numbered(1), [{ on: { afterMs: 100 }, to: 1 }]), stage(numbered(2))),
      null,
      fast,
    );
    const gone = collect();
    const kept = collect();
    const unsubscribe = backend.onSnapshot(gone.listener);
    backend.onSnapshot(kept.listener);
    unsubscribe();
    await vi.advanceTimersByTimeAsync(100);
    expect(gone.seen).toEqual([]);
    expect(kept.seen).toEqual([numbered(2)]);
  });

  it('brings the board of the shared waiting-board scenario after its delay', async () => {
    const scenario = SCENARIOS['waiting-board'];
    const { delay, to } = afterMsOf(scenario.stages[0])!;
    const backend = createPreviewBackend({ ...fast, scenario: 'waiting-board' });
    const { seen, listener } = collect();
    backend.onSnapshot(listener);
    await vi.advanceTimersByTimeAsync(delay - 1);
    expect(seen).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(seen).toEqual([scenario.stages[to].snapshot]);
    expect(seen[0].targets.length).toBeGreaterThan(0);
  });
});

describe('triggers', () => {
  it('follows recheck in the shared driver-missing scenario', async () => {
    const scenario = SCENARIOS['driver-missing'];
    const recheck = scenario.stages[0].next.find((transition) => transition.on === 'recheck')!;
    const backend = createPreviewBackend({ ...fast, scenario: 'driver-missing' });
    const { seen, listener } = collect();
    backend.onSnapshot(listener);
    await backend.recheck();
    expect(seen).toEqual([scenario.stages[recheck.to].snapshot]);
    expect(seen[0].issues).toEqual([]);
  });

  it('finds firmwares on add-folder in the shared no-firmware scenario', async () => {
    const backend = createPreviewBackend({ ...fast, scenario: 'no-firmware' });
    expect((await backend.snapshot()).firmwares).toEqual([]);
    await backend.addFolder();
    expect((await backend.snapshot()).firmwares.length).toBeGreaterThan(0);
  });

  it('ignores a trigger the stage does not have', async () => {
    const backend = onSmallBoard();
    const { seen, listener } = collect();
    backend.onSnapshot(listener);
    await backend.recheck();
    await backend.addFolder();
    await backend.openFile();
    expect(seen).toEqual([]);
  });
});

describe('flash', () => {
  it('writes every image in 4 KiB blocks and logs each phase like the Rust mock', async () => {
    const { events, onProgress } = recorder();
    const job = onSmallBoard().flash(REQUEST, onProgress);
    await vi.runAllTimersAsync();
    expect(await job).toEqual({
      bytesWritten: 8 * CHUNK,
      durationMs: expect.any(Number),
      verified: true,
      log: ['connect ESP32-S3', 'write 0x0 boot.bin 12288 B', 'write 0x10000 app.bin 20480 B', 'verify ok', 'reset'],
    });
    expect(kinds(events)).toEqual(['connecting', 'erasing', ...Array(8).fill('writing'), 'verifying', 'resetting']);
    const labels = events.flatMap((event) => (event.phase.kind === 'writing' ? [event.phase.label] : []));
    expect(labels).toEqual([...Array(3).fill('boot.bin'), ...Array(5).fill('app.bin')]);
    const done = events.map((event) => event.bytesDone);
    expect(done.every((value, i) => i === 0 || done[i - 1] <= value)).toBe(true);
    expect(events.at(-1)?.bytesDone).toBe(8 * CHUNK);
  });

  it('fails like a lost board at the requested percentage, with the last phase and percent', async () => {
    const { events, onProgress } = recorder();
    const error = rejectionOf(onSmallBoard({ failAtPercent: 50 }).flash(REQUEST, onProgress));
    await vi.runAllTimersAsync();
    expect(await error).toEqual({
      code: 'device-error',
      technical: 'device error: write block 1/5 @ 0x00010000\nerror: simulated disconnect',
      phase: { kind: 'writing', index: 0, count: 2, label: 'boot.bin', address: 0 },
      percent: 37,
    });
    expect(events.at(-1)?.bytesDone).toBe(3 * CHUNK);
  });

  it('stops within one block when cancelled and never reports success', async () => {
    const backend = onSmallBoard();
    const { events, onProgress } = recorder();
    const error = rejectionOf(backend.flash(REQUEST, onProgress));
    await vi.advanceTimersByTimeAsync(4);
    const before = events.length;
    expect(await backend.cancelFlash()).toBe(true);
    await vi.runAllTimersAsync();
    const last = events.at(-1)!;
    expect(await error).toEqual({
      code: 'cancelled',
      technical: 'cancelled by the user',
      phase: last.phase,
      percent: percentOf(last),
    });
    expect(events.length - before).toBeLessThanOrEqual(1);
    expect(kinds(events)).not.toContain('resetting');
  });

  it('refuses a firmware for another family before any progress', async () => {
    const nrf = firmware({ id: 'fw-nrf', family: { kind: 'certain', family: 'nrf' }, images: IMAGES });
    const { events, onProgress } = recorder();
    await expect(onSmallBoard({}, [nrf]).flash({ ...REQUEST, firmwareId: 'fw-nrf' }, onProgress)).rejects.toEqual({
      code: 'family-mismatch',
      technical: 'plan is for Nrf but the target is Esp32',
      phase: null,
      percent: null,
    });
    expect(events).toEqual([]);
  });

  it('uses the confirmed family of a firmware whose family is only suggested', async () => {
    const hex = firmware({
      id: 'fw-hex',
      family: { kind: 'suggested', family: 'stm32', reason: { kind: 'start-address', address: 0x0800_0000 } },
      images: IMAGES,
    });
    const backend = onSmallBoard({}, [hex]);
    await expect(backend.flash({ ...REQUEST, firmwareId: 'fw-hex' }, () => {})).rejects.toEqual({
      code: 'invalid-plan',
      technical: 'no chip family for firmware `fw-hex`',
      phase: null,
      percent: null,
    });
    const job = backend.flash({ ...REQUEST, firmwareId: 'fw-hex', family: 'esp32' }, () => {});
    await vi.runAllTimersAsync();
    await expect(job).resolves.toMatchObject({ verified: true });
  });

  it('rejects an unknown firmware or board without any progress', async () => {
    const backend = onSmallBoard();
    const { events, onProgress } = recorder();
    await expect(backend.flash({ ...REQUEST, firmwareId: 'nope' }, onProgress)).rejects.toEqual({
      code: 'invalid-plan',
      technical: 'unknown firmware `nope`',
      phase: null,
      percent: null,
    });
    await expect(backend.flash({ ...REQUEST, targetId: 'serial:COM9' }, onProgress)).rejects.toEqual({
      code: 'target-not-found',
      technical: 'unknown target `serial:COM9`',
      phase: null,
      percent: null,
    });
    expect(events).toEqual([]);
  });

  it('refuses a second job while one runs, and frees the slot after a failure', async () => {
    const backend = onSmallBoard({ failAtPercent: 10 });
    const first = rejectionOf(backend.flash(REQUEST, () => {}));
    await expect(backend.flash(REQUEST, () => {})).rejects.toMatchObject({ code: 'already-running' });
    await vi.runAllTimersAsync();
    expect(await first).toMatchObject({ code: 'device-error' });
    const again = rejectionOf(backend.flash(REQUEST, () => {}));
    await vi.runAllTimersAsync();
    expect(await again).toMatchObject({ code: 'device-error' });
  });

  it('has nothing to cancel when idle', async () => {
    expect(await onSmallBoard().cancelFlash()).toBe(false);
  });
});

describe('previewOptionsFromSearch', () => {
  it('reads a failure percentage from ?failAt=', () => {
    expect(previewOptionsFromSearch('?failAt=41')).toEqual({ chunkDelayMs: 15, failAtPercent: 41, scenario: null });
    expect(previewOptionsFromSearch('?failAt=0').failAtPercent).toBe(0);
  });

  it('ignores anything that is not a whole percentage', () => {
    for (const search of ['', '?failAt=', '?failAt=150', '?failAt=abc', '?failAt=4.5', '?failAt=-1']) {
      expect(previewOptionsFromSearch(search).failAtPercent, search).toBeNull();
    }
  });

  it('reads the scenario name from ?scenario=, combined with ?failAt=', () => {
    expect(previewOptionsFromSearch('?scenario=nordic-locked&failAt=41')).toEqual({
      chunkDelayMs: 15,
      failAtPercent: 41,
      scenario: 'nordic-locked',
    });
    expect(previewOptionsFromSearch('?scenario=').scenario).toBeNull();
    expect(previewOptionsFromSearch('?scenario=nope').scenario).toBe('nope');
  });
});
