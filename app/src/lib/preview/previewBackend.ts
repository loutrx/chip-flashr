import packageJson from '../../../package.json';
import { percentOf, toUserFacingError } from '../flashState';
import type { Backend } from '../ipc';
import type {
  ErrorCode,
  Family,
  FirmwareSummary,
  FlashReport,
  ImageEntry,
  Phase,
  ProgressEvent,
  Scenario,
  Snapshot,
  Target,
  UserFacingError,
} from '../types';
import { resolveScenario } from './scenarios';
import { createSimulatedWorld } from './simulatedWorld';

export interface PreviewOptions {
  /** Pause per 4 KiB block, like the Rust mock's `chunk_delay`. */
  chunkDelayMs: number;
  /** Fail like a lost board once this share is written, like `CHIP_FLASHR_MOCK_FAIL_AT`. */
  failAtPercent: number | null;
  /** Scenario name, like `CHIP_FLASHR_SCENARIO`; null runs the default one. */
  scenario: string | null;
}

export const PREVIEW_DEFAULTS: PreviewOptions = { chunkDelayMs: 15, failAtPercent: null, scenario: null };

const CHUNK = 4096;
const ADDRESS_SPACE = 2 ** 32;

/** Rust's `{:?}` of a family, so the technical text matches the desktop app. */
const FAMILY_DEBUG: Record<Family, string> = { esp32: 'Esp32', stm32: 'Stm32', nrf: 'Nrf' };

const failure = (code: ErrorCode, technical: string): UserFacingError => ({ code, technical, phase: null, percent: null });

/** Rust `{:#x}`. */
const hex = (value: number): string => `0x${value.toString(16)}`;
/** Rust `{:#010x}`. */
const hex8 = (value: number): string => `0x${value.toString(16).padStart(8, '0')}`;

/** `?failAt=41` makes the board fail at 41 %, `?scenario=driver-missing` picks the scenario. */
export function previewOptionsFromSearch(search: string): PreviewOptions {
  const params = new URLSearchParams(search);
  const rawFail = params.get('failAt')?.trim() ?? '';
  const value = Number(rawFail);
  const validFail = rawFail !== '' && Number.isInteger(value) && value >= 0 && value <= 100;
  const scenario = params.get('scenario')?.trim() ?? '';
  return { ...PREVIEW_DEFAULTS, failAtPercent: validFail ? value : null, scenario: scenario === '' ? null : scenario };
}

/** The messages of `FlashPlan::validate`, or null for a plan the mock accepts. */
function planError(images: readonly ImageEntry[]): string | null {
  if (images.length === 0) return 'the plan has no region to write';
  for (const image of images) {
    if (image.size === 0) return `region \`${image.name}\` is empty`;
    if (image.address + image.size > ADDRESS_SPACE) return `region \`${image.name}\` ends past the 32-bit address space`;
  }
  const sorted = [...images].sort((a, b) => a.address - b.address);
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    if (previous.address + previous.size > sorted[i].address) {
      return `regions \`${previous.name}\` and \`${sorted[i].name}\` overlap`;
    }
  }
  return null;
}

/** A certain family is a fact; otherwise the one the user confirmed. */
function planFamily(firmware: FirmwareSummary, requested: Family | null): Family | null {
  return firmware.family.kind === 'certain' ? firmware.family.family : requested;
}

/** The browser preview on the shared scenario files, for `pnpm dev` in a plain browser. */
export function createPreviewBackend(options: PreviewOptions): Backend {
  const { scenario, warning } = resolveScenario(options.scenario);
  return createPreviewBackendOn(scenario, warning, options);
}

/** The same preview on a given scenario; `warning` is what `appInfo` reports as `scenarioWarning`. */
export function createPreviewBackendOn(scenario: Scenario, warning: string | null, options: PreviewOptions): Backend {
  const world = createSimulatedWorld(scenario);
  const listeners = new Set<(snapshot: Snapshot) => void>();
  let delayTimer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let cancelRequested = false;

  // One timer at most, for the current stage; a stage change replaces it.
  function scheduleDelay(): void {
    if (delayTimer !== null) clearTimeout(delayTimer);
    delayTimer = null;
    const delay = world.pendingDelay();
    if (delay === null) return;
    const generation = world.generation();
    delayTimer = setTimeout(() => {
      delayTimer = null;
      if (world.elapse(generation)) stageChanged();
    }, delay);
  }

  function stageChanged(): void {
    for (const listener of [...listeners]) listener(world.snapshot());
    scheduleDelay();
  }

  async function trigger(name: 'recheck' | 'add-folder' | 'open-file'): Promise<void> {
    if (world.trigger(name)) stageChanged();
  }

  // Checked before every pause, like the Rust mock: a cancel acts within one block.
  async function pause(): Promise<void> {
    if (cancelRequested) throw failure('cancelled', 'cancelled by the user');
    await new Promise<void>((resolve) => setTimeout(resolve, options.chunkDelayMs));
  }

  /** `MockBackend::flash` on the plan `plan_for` builds: one region per image. */
  async function write(
    target: Target,
    family: Family,
    images: readonly ImageEntry[],
    emit: (event: ProgressEvent) => void,
  ): Promise<FlashReport> {
    const invalid = planError(images);
    if (invalid !== null) throw failure('invalid-plan', `invalid plan: ${invalid}`);
    if (family !== target.family) {
      throw failure(
        'family-mismatch',
        `plan is for ${FAMILY_DEBUG[family]} but the target is ${FAMILY_DEBUG[target.family]}`,
      );
    }
    const started = Date.now();
    const total = images.reduce((sum, image) => sum + image.size, 0);
    const report = (phase: Phase, bytesDone: number) => emit({ phase, bytesDone, bytesTotal: total });
    const log = [`connect ${target.label}`];

    report({ kind: 'connecting' }, 0);
    await pause();
    report({ kind: 'erasing' }, 0);
    await pause();

    let done = 0;
    for (const [index, image] of images.entries()) {
      const blocks = Math.ceil(image.size / CHUNK);
      for (let block = 0; block < blocks; block += 1) {
        await pause();
        done += Math.min(CHUNK, image.size - block * CHUNK);
        if (options.failAtPercent !== null && done * 100 >= options.failAtPercent * total) {
          throw failure(
            'device-error',
            `device error: write block ${block + 1}/${blocks} @ ${hex8(image.address + block * CHUNK)}\nerror: simulated disconnect`,
          );
        }
        report({ kind: 'writing', index, count: images.length, label: image.name, address: image.address }, done);
      }
      log.push(`write ${hex(image.address)} ${image.name} ${image.size} B`);
    }

    report({ kind: 'verifying' }, done);
    log.push('verify ok');
    await pause();
    report({ kind: 'resetting' }, done);
    log.push('reset');
    return { bytesWritten: done, durationMs: Date.now() - started, verified: true, log };
  }

  scheduleDelay();

  return {
    appInfo: async () => ({
      name: 'Chip Flashr',
      version: packageJson.version,
      scenario: world.scenarioName(),
      scenarioWarning: warning,
    }),
    snapshot: async () => world.snapshot(),
    onSnapshot(listener) {
      // Wrapped, so the same function subscribed twice is two subscriptions.
      const entry = (next: Snapshot) => listener(next);
      listeners.add(entry);
      return () => {
        listeners.delete(entry);
      };
    },
    recheck: () => trigger('recheck'),
    addFolder: () => trigger('add-folder'),
    openFile: () => trigger('open-file'),
    cancelFlash: async () => {
      if (!running) return false;
      cancelRequested = true;
      return true;
    },
    async flash(request, onProgress) {
      const current = world.snapshot();
      const firmware = current.firmwares.find((candidate) => candidate.id === request.firmwareId);
      if (!firmware) throw failure('invalid-plan', `unknown firmware \`${request.firmwareId}\``);
      const target = current.targets.find((candidate) => candidate.id === request.targetId);
      if (!target) throw failure('target-not-found', `unknown target \`${request.targetId}\``);
      const family = planFamily(firmware, request.family);
      if (family === null) throw failure('invalid-plan', `no chip family for firmware \`${firmware.id}\``);
      if (running) throw failure('already-running', 'a flash job is already running');
      running = true;
      cancelRequested = false;
      // Like run_flash_job: an error after some progress carries the last phase and percent.
      const seen: { last: ProgressEvent | null } = { last: null };
      try {
        return await write(target, family, firmware.images, (event) => {
          seen.last = event;
          onProgress(event);
        });
      } catch (error) {
        const userError = toUserFacingError(error);
        throw seen.last === null ? userError : { ...userError, phase: seen.last.phase, percent: percentOf(seen.last) };
      } finally {
        running = false;
        cancelRequested = false;
      }
    },
  };
}
