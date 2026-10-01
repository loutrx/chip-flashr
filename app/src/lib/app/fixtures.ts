import type { FirmwareSummary, ImageEntry, Snapshot, Target } from '../types';

/** The four images of the Thermostat v1.4.2 ESP-IDF build, as in the scenario files (1 186 202 bytes in all). */
export const THERMOSTAT_IMAGES: readonly ImageEntry[] = [
  { address: 0x0, name: 'bootloader.bin', size: 21 * 1024 },
  { address: 0x8000, name: 'partition-table.bin', size: 3 * 1024 },
  { address: 0xd000, name: 'ota_data_initial.bin', size: 8 * 1024 },
  { address: 0x1_0000, name: 'thermostat.bin', size: 1_153_434 },
];

/** A complete firmware summary; the size and range count follow `overrides.images` unless overridden too. */
export function firmware(overrides: Partial<FirmwareSummary> = {}): FirmwareSummary {
  const images = overrides.images ?? THERMOSTAT_IMAGES.map((image) => ({ ...image }));
  return {
    id: 'fw-thermostat-1.4.2',
    path: 'C:\\Livraison\\thermostat-1.4.2\\build',
    fileName: 'build',
    folder: 0,
    source: 'esp-idf-build',
    name: 'Thermostat',
    version: '1.4.2',
    variant: 'prod',
    chip: 'esp32s3',
    family: { kind: 'certain', family: 'esp32' },
    toolchain: 'ESP-IDF 5.3',
    builtAt: '2026-09-12T14:32:00',
    sizeBytes: images.reduce((sum, image) => sum + image.size, 0),
    addressRanges: images.length,
    images,
    manifest: 'flasher_args.json',
    checks: [
      {
        status: 'ok',
        code: 'manifest-read',
        params: { manifest: 'flasher_args.json', chip: 'esp32s3', count: String(images.length) },
      },
    ],
    readme: { fileName: 'LISEZMOI.md' },
    ...overrides,
  };
}

/** The simulated ESP32-S3 on COM4. */
export function target(overrides: Partial<Target> = {}): Target {
  return {
    id: 'mock:esp32',
    family: 'esp32',
    label: 'ESP32-S3',
    chip: 'esp32s3',
    port: 'COM4',
    link: { kind: 'usb-jtag' },
    flashSize: 8 * 1024 * 1024,
    ...overrides,
  };
}

/** The app folder and one watched folder, the Thermostat package and its board, no issue. */
export function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    folders: [
      { path: 'C:\\Livraison', kind: 'app' },
      { path: 'D:\\Firmwares', kind: 'watched' },
    ],
    firmwares: [firmware()],
    targets: [target()],
    issues: [],
    ...overrides,
  };
}
