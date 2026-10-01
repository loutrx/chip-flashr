import { Channel, invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { createPreviewBackend, previewOptionsFromSearch } from './preview/previewBackend';
import type { AppInfo, FlashReport, FlashRequest, ProgressEvent, Snapshot } from './types';

/** What the UI needs from the Rust core: Tauri IPC in the app, a TypeScript copy in the browser preview. */
export interface Backend {
  appInfo(): Promise<AppInfo>;
  snapshot(): Promise<Snapshot>;
  /** Called with every later snapshot. Returns an unsubscribe function. */
  onSnapshot(listener: (snapshot: Snapshot) => void): () => void;
  /** Rejects with a UserFacingError. */
  flash(request: FlashRequest, onProgress: (event: ProgressEvent) => void): Promise<FlashReport>;
  /** False when nothing is running. */
  cancelFlash(): Promise<boolean>;
  recheck(): Promise<void>;
  addFolder(): Promise<void>;
  openFile(): Promise<void>;
}

const SNAPSHOT_EVENT = 'snapshot-changed';

/**
 * The latest `listen` registration. `snapshot()` waits for it, so an event emitted between the
 * initial snapshot and the registration cannot be lost: the app subscribes first, then asks.
 */
let listening: Promise<unknown> = Promise.resolve();

export const tauriBackend: Backend = {
  appInfo: () => invoke<AppInfo>('app_info'),
  snapshot: async () => {
    await listening.catch(() => undefined);
    return invoke<Snapshot>('snapshot');
  },
  onSnapshot(listener) {
    // `listen` resolves later; an unsubscribe that comes first must still win.
    let stopped = false;
    let unlisten: (() => void) | null = null;
    const registration = listen<Snapshot>(SNAPSHOT_EVENT, (event) => {
      if (!stopped) listener(event.payload);
    });
    listening = registration;
    registration
      .then((stop) => {
        if (stopped) stop();
        else unlisten = stop;
      })
      .catch((error: unknown) => console.error(`cannot listen to ${SNAPSHOT_EVENT}`, error));
    return () => {
      stopped = true;
      unlisten?.();
      unlisten = null;
    };
  },
  flash(request, onProgress) {
    const channel = new Channel<ProgressEvent>();
    channel.onmessage = onProgress;
    return invoke<FlashReport>('flash', {
      firmwareId: request.firmwareId,
      targetId: request.targetId,
      family: request.family,
      onProgress: channel,
    });
  },
  cancelFlash: () => invoke<boolean>('cancel_flash'),
  recheck: () => invoke<void>('recheck'),
  addFolder: () => invoke<void>('add_folder'),
  openFile: () => invoke<void>('open_file'),
};

/** Tauri IPC inside the app; in a development build opened in a plain browser, the simulated world. */
export function pickBackend(): Backend {
  if (!isTauri() && import.meta.env.DEV) {
    return createPreviewBackend(previewOptionsFromSearch(window.location.search));
  }
  return tauriBackend;
}
