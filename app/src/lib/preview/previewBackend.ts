import packageJson from '../../../package.json';
import type { Backend } from '../ipc';
import type { ErrorCode, Family, Phase, UserFacingError } from '../types';

export interface PreviewOptions {
  /** Pause per 4 KiB chunk, like the Rust mock's `chunk_delay`. */
  chunkDelayMs: number;
  /** Fail like a lost board once this share is written, like `CHIP_FLASHR_MOCK_FAIL_AT`. */
  failAtPercent: number | null;
}

export const PREVIEW_DEFAULTS: PreviewOptions = { chunkDelayMs: 15, failAtPercent: null };

const CHUNK = 4096;
const KIB = 1024;

type Region = { address: number; label: string; size: number };

/** The same boards and demo plans as the Rust mock (crates/flashr-core/src/mock.rs). */
const BOARDS: Record<Family, { chip: string; regions: Region[] }> = {
  esp32: {
    chip: 'ESP32-S3',
    regions: [
      { address: 0x0, label: 'bootloader.bin', size: 21 * KIB },
      { address: 0x8000, label: 'partition-table.bin', size: 3 * KIB },
      { address: 0xd000, label: 'ota_data_initial.bin', size: 8 * KIB },
      { address: 0x1_0000, label: 'thermostat.bin', size: 1100 * KIB },
    ],
  },
  stm32: { chip: 'STM32F411', regions: [{ address: 0x0800_0000, label: 'passerelle.bin', size: 450 * KIB }] },
  nrf: { chip: 'nRF52840', regions: [{ address: 0x0, label: 'capteur-porte.hex', size: 300 * KIB }] },
};

const FAMILIES: readonly Family[] = ['esp32', 'stm32', 'nrf'];

const failure = (code: ErrorCode, technical: string): UserFacingError => ({ code, technical });

/** `?failAt=41` makes the board fail at 41 %; anything that is not a whole 0–100 is ignored. */
export function previewOptionsFromSearch(search: string): PreviewOptions {
  const raw = new URLSearchParams(search).get('failAt')?.trim() ?? '';
  const value = Number(raw);
  const valid = raw !== '' && Number.isInteger(value) && value >= 0 && value <= 100;
  return { ...PREVIEW_DEFAULTS, failAtPercent: valid ? value : null };
}

/** A TypeScript copy of the simulated board, for `pnpm dev` in a plain browser (spec D9). */
export function createPreviewBackend(options: PreviewOptions): Backend {
  let running = false;
  let cancelRequested = false;

  // Checked before every pause, like the Rust mock: a cancel acts within one chunk.
  async function pause(): Promise<void> {
    if (cancelRequested) throw failure('cancelled', 'cancelled by the user');
    await new Promise<void>((resolve) => setTimeout(resolve, options.chunkDelayMs));
  }

  return {
    appInfo: async () => ({ name: 'Chip Flashr', version: packageJson.version }),
    listTargets: async () => FAMILIES.map((family) => ({ id: `mock:${family}`, family, label: BOARDS[family].chip })),
    cancelFlash: async () => {
      if (!running) return false;
      cancelRequested = true;
      return true;
    },
    async flashDemo(targetId, onProgress) {
      const family = FAMILIES.find((candidate) => `mock:${candidate}` === targetId);
      if (!family) throw failure('target-not-found', `unknown target \`${targetId}\``);
      if (running) throw failure('already-running', 'a flash job is already running');
      running = true;
      cancelRequested = false;
      const started = Date.now();
      try {
        const regions = BOARDS[family].regions;
        const total = regions.reduce((sum, region) => sum + region.size, 0);
        const emit = (phase: Phase, bytesDone: number) => onProgress({ phase, bytesDone, bytesTotal: total });

        emit({ kind: 'connecting' }, 0);
        await pause();
        emit({ kind: 'erasing' }, 0);
        await pause();

        let done = 0;
        for (const [index, region] of regions.entries()) {
          for (let offset = 0; offset < region.size; offset += CHUNK) {
            await pause();
            done += Math.min(CHUNK, region.size - offset);
            if (options.failAtPercent !== null && done * 100 >= options.failAtPercent * total) {
              throw failure('device-error', 'device error: simulated disconnect');
            }
            const phase: Phase = { kind: 'writing', index, count: regions.length, label: region.label, address: region.address };
            emit(phase, done);
          }
        }

        emit({ kind: 'verifying' }, done);
        await pause();
        emit({ kind: 'resetting' }, done);
        return { bytesWritten: done, durationMs: Date.now() - started, verified: true };
      } finally {
        running = false;
        cancelRequested = false;
      }
    },
  };
}
