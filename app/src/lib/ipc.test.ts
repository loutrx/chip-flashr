import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pickBackend, tauriBackend } from './ipc';
import { SCENARIOS } from './preview/scenarios';
import type { ProgressEvent, Snapshot } from './types';

const { invoke, listen } = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn() }));

vi.mock('@tauri-apps/api/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tauri-apps/api/core')>();
  /** The real channel needs the desktop runtime; this one only keeps the handler. */
  class Channel<T> {
    onmessage: (message: T) => void = () => {};
  }
  return { ...actual, invoke, Channel };
});
vi.mock('@tauri-apps/api/event', () => ({ listen }));

type SnapshotHandler = (event: { payload: Snapshot }) => void;

beforeEach(() => {
  invoke.mockReset();
  listen.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('tauriBackend', () => {
  it('calls the Rust commands by name', async () => {
    invoke.mockResolvedValue(undefined);
    await tauriBackend.appInfo();
    await tauriBackend.snapshot();
    await tauriBackend.cancelFlash();
    await tauriBackend.recheck();
    await tauriBackend.addFolder();
    await tauriBackend.openFile();
    expect(invoke.mock.calls.map((call) => call[0])).toEqual([
      'app_info',
      'snapshot',
      'cancel_flash',
      'recheck',
      'add_folder',
      'open_file',
    ]);
  });

  it('passes the flash request and relays progress from the channel', async () => {
    invoke.mockResolvedValue({ bytesWritten: 1, durationMs: 2, verified: true, log: [] });
    const received: ProgressEvent[] = [];
    const report = await tauriBackend.flash({ firmwareId: 'fw-1', targetId: 'mock:esp32', family: null }, (event) =>
      received.push(event),
    );
    expect(report.log).toEqual([]);
    const [command, args] = invoke.mock.calls[0];
    expect(command).toBe('flash');
    expect(args).toMatchObject({ firmwareId: 'fw-1', targetId: 'mock:esp32', family: null });
    const event: ProgressEvent = { phase: { kind: 'connecting' }, bytesDone: 0, bytesTotal: 10 };
    args.onProgress.onmessage(event);
    expect(received).toEqual([event]);
  });

  it('forwards snapshot-changed until unsubscribed, even before listen resolves', async () => {
    let handler: SnapshotHandler = () => {};
    let resolveListen: (unlisten: () => void) => void = () => {};
    listen.mockImplementation((_name: string, callback: SnapshotHandler) => {
      handler = callback;
      return new Promise<() => void>((resolve) => {
        resolveListen = resolve;
      });
    });
    const seen: Snapshot[] = [];
    const unsubscribe = tauriBackend.onSnapshot((next) => seen.push(next));
    expect(listen.mock.calls[0][0]).toBe('snapshot-changed');
    const first = SCENARIOS.default.stages[0].snapshot;
    handler({ payload: first });
    expect(seen).toEqual([first]);
    unsubscribe();
    handler({ payload: first });
    expect(seen).toEqual([first]);
    const unlisten = vi.fn();
    resolveListen(unlisten);
    await vi.waitFor(() => expect(unlisten).toHaveBeenCalledTimes(1));
  });

  it('stops listening at once when unsubscribed after listen resolved', async () => {
    const unlisten = vi.fn();
    listen.mockResolvedValue(unlisten);
    const unsubscribe = tauriBackend.onSnapshot(() => {});
    await vi.waitFor(() => expect(listen).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    unsubscribe();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it('asks for the snapshot only once the snapshot-changed listener is registered', async () => {
    let resolveListen: (unlisten: () => void) => void = () => {};
    listen.mockImplementation(
      () =>
        new Promise<() => void>((resolve) => {
          resolveListen = resolve;
        }),
    );
    const first = SCENARIOS.default.stages[0].snapshot;
    invoke.mockResolvedValue(first);
    const unsubscribe = tauriBackend.onSnapshot(() => {});
    const pending = tauriBackend.snapshot();
    await Promise.resolve();
    await Promise.resolve();
    expect(invoke).not.toHaveBeenCalled();
    resolveListen(() => {});
    expect(await pending).toEqual(first);
    expect(invoke.mock.calls.map((call) => call[0])).toEqual(['snapshot']);
    unsubscribe();
  });
});

describe('pickBackend', () => {
  it('uses the simulated world when a dev build runs in a plain browser', async () => {
    const backend = pickBackend();
    expect(backend).not.toBe(tauriBackend);
    expect(await backend.snapshot()).toEqual(SCENARIOS.default.stages[0].snapshot);
  });

  it('uses Tauri IPC inside the desktop app', () => {
    vi.stubGlobal('isTauri', true);
    expect(pickBackend()).toBe(tauriBackend);
  });
});
