import { Channel, invoke } from '@tauri-apps/api/core';
import type { AppInfo, FlashReport, ProgressEvent, Target } from './types';

export const appInfo = () => invoke<AppInfo>('app_info');

export const listTargets = () => invoke<Target[]>('list_targets');

export const cancelFlash = () => invoke<boolean>('cancel_flash');

/** Program the demo plan on a target; progress arrives on `onProgress`. Rejects with a UserFacingError. */
export function flashDemo(targetId: string, onProgress: (event: ProgressEvent) => void): Promise<FlashReport> {
  const channel = new Channel<ProgressEvent>();
  channel.onmessage = onProgress;
  return invoke<FlashReport>('flash_demo', { targetId, onProgress: channel });
}
