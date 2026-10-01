import { describe, expect, it } from 'vitest';
import type { FlashState } from '../flashState';
import type { DeviceIssue, Download, FirmwareSummary, Snapshot } from '../types';
import { firmware, snapshot, target } from './fixtures';
import {
  currentFirmware,
  currentIssue,
  currentTarget,
  familyOf,
  INITIAL_CHOICES,
  isInvalid,
  screenOf,
  type Choices,
  type ScreenId,
} from './screen';

/** screenOf reads only the job's status, so the other fields don't matter here. */
const job = (status: FlashState['status']): FlashState => ({ status }) as FlashState;
const choices = (overrides: Partial<Choices> = {}): Choices => ({ ...INITIAL_CHOICES, ...overrides });

const thermostat = firmware();
const sonde = firmware({ id: 'fw-sonde-air', name: 'sonde_air', version: '1.0.0', chip: 'esp32c3', source: 'arduino' });
const hex = firmware({
  id: 'fw-hex',
  name: null,
  version: null,
  fileName: 'firmware.hex',
  source: 'hex',
  chip: null,
  family: { kind: 'suggested', family: 'stm32', reason: { kind: 'start-address', address: 0x0800_0000 } },
  images: [{ address: 0x0800_0000, name: 'firmware.hex', size: 124 * 1024 }],
});
const unknown = firmware({ id: 'fw-unknown', name: null, fileName: 'image.bin', source: 'bin', chip: null, family: { kind: 'unknown' } });
const broken = firmware({
  id: 'fw-broken',
  version: '1.5.0-beta',
  checks: [{ status: 'error', code: 'file-missing', params: { file: 'partition-table.bin', address: '0x8000', dir: 'partition_table/' } }],
});
const esp = target();
const stlink = target({
  id: 'mock:stm32',
  family: 'stm32',
  label: 'STM32F411',
  chip: 'stm32f411',
  port: 'ST-Link',
  link: { kind: 'probe', name: 'ST-Link V2' },
  flashSize: 512 * 1024,
});
const nrf = target({ id: 'mock:nrf', family: 'nrf', label: 'nRF52840', chip: 'nrf52840', port: 'J-Link', link: { kind: 'probe', name: 'J-Link' } });

const download: Download = { title: 'CP210x', publisher: 'Silicon Labs', versionHint: '11.3', sizeHint: null, url: 'https://www.silabs.com/' };
const driver: DeviceIssue = {
  kind: 'missing-driver',
  family: 'esp32',
  vendor: 'Silicon Labs',
  name: 'CP210x',
  vid: 0x10c4,
  pid: 0xea60,
  download,
  inf: null,
};
const tool: DeviceIssue = {
  kind: 'missing-tool',
  family: 'nrf',
  targetLabel: 'nRF52840',
  locked: 'approtect',
  tools: [
    { name: 'J-Link', installed: true },
    { name: 'nRF Util', installed: false },
  ],
  download,
  installCommand: null,
};

const world = (firmwares: FirmwareSummary[], targets = [esp], issues: DeviceIssue[] = []): Snapshot =>
  snapshot({ firmwares, targets, issues });

type Row = [name: string, snap: Snapshot | null, picked: Partial<Choices>, status: FlashState['status'], expected: ScreenId];

// One row per arrow of the state flow, then the edge cases of the spec's Testing section.
const rows: Row[] = [
  ['no snapshot yet → loading', null, {}, 'idle', 'loading'],
  ['no firmware → 10', world([]), {}, 'idle', 'no-firmware'],
  ['10, add-folder finds one firmware → 01', world([thermostat]), {}, 'idle', 'home'],
  ['10, add-folder finds several → 02', world([thermostat, sonde]), {}, 'idle', 'firmware-list'],
  ['several firmwares, none picked → 02', world([thermostat, sonde, hex]), {}, 'idle', 'firmware-list'],
  ['02, pick a certain firmware → 01', world([thermostat, sonde]), { firmwareId: thermostat.id }, 'idle', 'home'],
  ['02, pick a suggested firmware → 03', world([thermostat, hex]), { firmwareId: hex.id }, 'idle', 'choose-chip'],
  ['02, pick an unknown firmware → 03', world([thermostat, unknown]), { firmwareId: unknown.id }, 'idle', 'choose-chip'],
  ['02, pick an invalid firmware → 11', world([thermostat, broken]), { firmwareId: broken.id }, 'idle', 'incomplete'],
  ['01, Changer → 02', world([thermostat, sonde]), { firmwareId: thermostat.id, browsing: true }, 'idle', 'firmware-list'],
  ['01 with a single firmware, Changer → 02', world([thermostat]), { browsing: true }, 'idle', 'firmware-list'],
  ['01, Programmer → 05', world([thermostat]), {}, 'flashing', 'programming'],
  ['01, board unplugged → 04', world([thermostat], []), {}, 'idle', 'waiting-board'],
  ['01, missing driver seen → 08', world([thermostat], [], [driver]), {}, 'idle', 'missing-driver'],
  ['03, family confirmed, board there → 01', world([hex], [stlink]), { families: { [hex.id]: 'stm32' } }, 'idle', 'home'],
  ['03, family confirmed, no board → 04', world([hex], []), { families: { [hex.id]: 'stm32' } }, 'idle', 'waiting-board'],
  ['03, family confirmed, tool missing → 09', world([unknown], [nrf], [tool]), { families: { [unknown.id]: 'nrf' } }, 'idle', 'external-tool'],
  ['03, Changer → 02', world([hex]), { browsing: true }, 'idle', 'firmware-list'],
  ['04, board arrives → 01', world([thermostat], [esp]), {}, 'idle', 'home'],
  ['08, recheck clears the driver issue → 01', world([thermostat], [esp]), {}, 'idle', 'home'],
  ['09, recheck clears the tool issue → 01', world([unknown], [nrf]), { families: { [unknown.id]: 'nrf' } }, 'idle', 'home'],
  ['05, success → 06', world([thermostat]), {}, 'success', 'success'],
  ['05, failure → 07', world([thermostat]), {}, 'failure', 'failure'],
  ['07, Réessayer → 05', world([thermostat]), {}, 'flashing', 'programming'],
  ['07, Retour à l’accueil → 01', world([thermostat]), {}, 'idle', 'home'],
  ['06, another board, board still plugged → 01', world([thermostat]), { boardsThisSession: 1 }, 'idle', 'home'],
  ['06, another board, board unplugged → 04', world([thermostat], []), { boardsThisSession: 1 }, 'idle', 'waiting-board'],
  ['11, Changer → 02', world([broken]), { browsing: true }, 'idle', 'firmware-list'],
  ['board unplugged on 03 stays on 03', world([hex], []), {}, 'idle', 'choose-chip'],
  ['11, firmware replaced under the same id → 01', world([firmware({ id: broken.id })]), { firmwareId: broken.id }, 'idle', 'home'],
  ['11, the only firmware replaced by another one → 01', world([thermostat]), { firmwareId: broken.id }, 'idle', 'home'],
  ['picked firmware disappears, several left → 02', world([sonde, hex]), { firmwareId: thermostat.id }, 'idle', 'firmware-list'],
  ['picked firmware disappears, one left → 01', world([sonde]), { firmwareId: thermostat.id }, 'idle', 'home'],
  ['the job wins while the board is gone', world([thermostat], []), { browsing: true }, 'flashing', 'programming'],
  ['a result stays shown while the list would open', world([thermostat, sonde]), {}, 'failure', 'failure'],
  ['a board of another family only → 04', world([thermostat], [stlink]), {}, 'idle', 'waiting-board'],
  ['an issue for another family is ignored', world([hex], [stlink], [driver]), { families: { [hex.id]: 'stm32' } }, 'idle', 'home'],
  ['an invalid firmware wins over a missing board', world([broken], []), {}, 'idle', 'incomplete'],
  ['a missing driver wins over a missing board', world([thermostat], [], [driver]), {}, 'idle', 'missing-driver'],
];

describe('screenOf', () => {
  it.each(rows)('%s', (_name, snap, picked, status, expected) => {
    expect(screenOf(snap, choices(picked), job(status))).toBe(expected);
  });
});

describe('currentFirmware', () => {
  it('is the picked firmware while the snapshot has it', () => {
    expect(currentFirmware(world([thermostat, sonde]), choices({ firmwareId: sonde.id }))).toBe(sonde);
  });

  it('is the only firmware when nothing valid is picked', () => {
    expect(currentFirmware(world([sonde]), choices())).toBe(sonde);
    expect(currentFirmware(world([sonde]), choices({ firmwareId: 'gone' }))).toBe(sonde);
  });

  it('is none with several firmwares and no valid pick, or with none at all', () => {
    expect(currentFirmware(world([thermostat, sonde]), choices({ firmwareId: 'gone' }))).toBeNull();
    expect(currentFirmware(world([]), choices())).toBeNull();
  });
});

describe('familyOf', () => {
  it('takes a certain family as it is, whatever was confirmed', () => {
    expect(familyOf(thermostat, choices({ families: { [thermostat.id]: 'nrf' } }))).toBe('esp32');
  });

  it('takes the confirmed family otherwise', () => {
    expect(familyOf(hex, choices())).toBeNull();
    expect(familyOf(hex, choices({ families: { [hex.id]: 'esp32' } }))).toBe('esp32');
    expect(familyOf(firmware({ id: 'constructor', family: { kind: 'unknown' } }), choices())).toBeNull();
  });
});

describe('isInvalid', () => {
  it('is true only with an error check', () => {
    expect(isInvalid(broken)).toBe(true);
    expect(isInvalid(thermostat)).toBe(false);
    expect(isInvalid(firmware({ checks: [{ status: 'warning', code: 'nonstandard-name', params: {} }] }))).toBe(false);
  });
});

describe('currentTarget and currentIssue', () => {
  it('take the first target and issue of the family', () => {
    const second = target({ id: 'mock:esp32-2', port: 'COM5' });
    const snap = world([thermostat], [stlink, esp, second], [tool, driver]);
    expect(currentTarget(snap, 'esp32')).toBe(esp);
    expect(currentTarget(snap, 'nrf')).toBeNull();
    expect(currentTarget(snap, null)).toBeNull();
    expect(currentIssue(snap, 'esp32')).toBe(driver);
    expect(currentIssue(snap, 'stm32')).toBeNull();
    expect(currentIssue(snap, null)).toBeNull();
  });
});
