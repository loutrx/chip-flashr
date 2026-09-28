import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickBackend, tauriBackend } from './ipc';

afterEach(() => vi.unstubAllGlobals());

describe('pickBackend', () => {
  it('uses the simulated board when a dev build runs in a plain browser', async () => {
    const backend = pickBackend();
    expect(backend).not.toBe(tauriBackend);
    expect((await backend.listTargets()).map((target) => target.id)).toEqual(['mock:esp32', 'mock:stm32', 'mock:nrf']);
  });

  it('uses Tauri IPC inside the desktop app', () => {
    vi.stubGlobal('isTauri', true);
    expect(pickBackend()).toBe(tauriBackend);
  });
});
