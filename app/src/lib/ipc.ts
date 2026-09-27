import { Channel, invoke, isTauri } from '@tauri-apps/api/core';
import { createPreviewBackend, previewOptionsFromSearch } from './preview/previewBackend';
import type { AppInfo, FlashReport, ProgressEvent, Target } from './types';

/** What the UI needs from the Rust core: Tauri IPC in the app, a TypeScript copy in the browser preview. */
export interface Backend {
  appInfo(): Promise<AppInfo>;
  listTargets(): Promise<Target[]>;
  /** Program the demo plan on a target; progress arrives on `onProgress`. Rejects with a UserFacingError. */
  flashDemo(targetId: string, onProgress: (event: ProgressEvent) => void): Promise<FlashReport>;
  /** False when nothing is running. */
  cancelFlash(): Promise<boolean>;
}

export const tauriBackend: Backend = {
  appInfo: () => invoke<AppInfo>('app_info'),
  listTargets: () => invoke<Target[]>('list_targets'),
  cancelFlash: () => invoke<boolean>('cancel_flash'),
  flashDemo(targetId, onProgress) {
    const channel = new Channel<ProgressEvent>();
    channel.onmessage = onProgress;
    return invoke<FlashReport>('flash_demo', { targetId, onProgress: channel });
  },
};

/** Tauri IPC inside the app; in a development build opened in a plain browser, the simulated board (spec D9). */
export function pickBackend(): Backend {
  if (!isTauri() && import.meta.env.DEV) {
    return createPreviewBackend(previewOptionsFromSearch(window.location.search));
  }
  return tauriBackend;
}
