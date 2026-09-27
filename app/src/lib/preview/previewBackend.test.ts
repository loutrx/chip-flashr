import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import packageJson from '../../../package.json';
import type { ProgressEvent } from '../types';
import { createPreviewBackend, previewOptionsFromSearch } from './previewBackend';

const fast = { chunkDelayMs: 1, failAtPercent: null };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function recorder() {
  const events: ProgressEvent[] = [];
  return { events, onProgress: (event: ProgressEvent) => events.push(event) };
}

const kinds = (events: ProgressEvent[]) => events.map((event) => event.phase.kind);

describe('createPreviewBackend', () => {
  it('lists the three simulated boards with their chip names', async () => {
    expect(await createPreviewBackend(fast).listTargets()).toEqual([
      { id: 'mock:esp32', family: 'esp32', label: 'ESP32-S3' },
      { id: 'mock:stm32', family: 'stm32', label: 'STM32F411' },
      { id: 'mock:nrf', family: 'nrf', label: 'nRF52840' },
    ]);
  });

  it('reports the app version like the desktop app', async () => {
    expect(await createPreviewBackend(fast).appInfo()).toEqual({ name: 'Chip Flashr', version: packageJson.version });
  });

  it('follows the progress contract and ends at the total', async () => {
    const { events, onProgress } = recorder();
    const job = createPreviewBackend(fast).flashDemo('mock:nrf', onProgress);
    const outcome = expect(job).resolves.toMatchObject({ bytesWritten: 300 * 1024, verified: true });
    await vi.runAllTimersAsync();
    await outcome;
    expect(kinds(events)).toEqual(['connecting', 'erasing', ...Array(75).fill('writing'), 'verifying', 'resetting']);
    const done = events.map((event) => event.bytesDone);
    expect(done.every((value, i) => i === 0 || done[i - 1] <= value)).toBe(true);
    expect(events.at(-1)?.bytesDone).toBe(300 * 1024);
  });

  it('stops within one chunk when cancelled and never reports success', async () => {
    const backend = createPreviewBackend(fast);
    const { events, onProgress } = recorder();
    const job = backend.flashDemo('mock:esp32', onProgress);
    const outcome = expect(job).rejects.toEqual({ code: 'cancelled', technical: 'cancelled by the user' });
    await vi.advanceTimersByTimeAsync(10);
    const before = events.length;
    expect(await backend.cancelFlash()).toBe(true);
    await vi.runAllTimersAsync();
    await outcome;
    expect(events.length - before).toBeLessThanOrEqual(1);
    expect(kinds(events)).not.toContain('resetting');
  });

  it('fails like a lost board at the requested percentage', async () => {
    const { events, onProgress } = recorder();
    const job = createPreviewBackend({ chunkDelayMs: 1, failAtPercent: 50 }).flashDemo('mock:esp32', onProgress);
    const outcome = expect(job).rejects.toEqual({ code: 'device-error', technical: 'device error: simulated disconnect' });
    await vi.runAllTimersAsync();
    await outcome;
    const last = events.at(-1)!;
    expect(last.bytesDone * 100).toBeLessThan(50 * last.bytesTotal);
  });

  it('refuses a second job while one runs, and frees the slot after a failure', async () => {
    const backend = createPreviewBackend({ chunkDelayMs: 1, failAtPercent: 10 });
    const first = expect(backend.flashDemo('mock:nrf', () => {})).rejects.toMatchObject({ code: 'device-error' });
    await expect(backend.flashDemo('mock:stm32', () => {})).rejects.toMatchObject({ code: 'already-running' });
    await vi.runAllTimersAsync();
    await first;
    const again = expect(backend.flashDemo('mock:nrf', () => {})).rejects.toMatchObject({ code: 'device-error' });
    await vi.runAllTimersAsync();
    await again;
  });

  it('rejects an unknown board without any progress', async () => {
    const { events, onProgress } = recorder();
    await expect(createPreviewBackend(fast).flashDemo('serial:COM9', onProgress)).rejects.toEqual({
      code: 'target-not-found',
      technical: 'unknown target `serial:COM9`',
    });
    expect(events).toEqual([]);
  });

  it('has nothing to cancel when idle', async () => {
    expect(await createPreviewBackend(fast).cancelFlash()).toBe(false);
  });
});

describe('previewOptionsFromSearch', () => {
  it('reads a failure percentage from ?failAt=', () => {
    expect(previewOptionsFromSearch('?failAt=41')).toEqual({ chunkDelayMs: 15, failAtPercent: 41 });
    expect(previewOptionsFromSearch('?failAt=0').failAtPercent).toBe(0);
  });

  it('ignores anything that is not a whole percentage', () => {
    for (const search of ['', '?failAt=', '?failAt=150', '?failAt=abc', '?failAt=4.5', '?failAt=-1']) {
      expect(previewOptionsFromSearch(search).failAtPercent, search).toBeNull();
    }
  });
});
