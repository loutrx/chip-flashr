import { afterEach, describe, expect, it } from 'vitest';
import type { ProvisionalId } from '../app/screen';
import type { Step, StepKind } from '../flashState';
import type { ErrorCode, SourceKind } from '../types';
import { en } from './en';
import {
  chipName,
  formatAddress,
  formatDate,
  formatDuration,
  formatEstimate,
  formatPercent,
  formatSize,
  formatTime,
  formatVersion,
  stepLabel,
} from './format';
import { fr } from './fr';
import { locale, setLocale, t } from './index.svelte';
import { detectLocale } from './locale';

/** Every leaf as "path:kind"; arrays also record their length. */
function shape(value: unknown, path = ''): string[] {
  if (typeof value === 'string') return [`${path}:string`];
  if (typeof value === 'function') return [`${path}:function/${value.length}`];
  if (Array.isArray(value)) {
    return [`${path}:array/${value.length}`, ...value.flatMap((item, i) => shape(item, `${path}[${i}]`))];
  }
  return Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([key, item]) => shape(item, path ? `${path}.${key}` : key));
}

function leafStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(leafStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(leafStrings);
  return [];
}

/** The keys of an exhaustive record: the compiler rejects the literal if a member is missing. */
function members<K extends string>(record: Record<K, true>): K[] {
  return Object.keys(record) as K[];
}

const CODES = members<ErrorCode>({
  cancelled: true,
  'target-not-found': true,
  'invalid-plan': true,
  'family-mismatch': true,
  'device-error': true,
  'already-running': true,
});
const SOURCES = members<SourceKind>({
  'esp-idf-build': true,
  arduino: true,
  'platform-io': true,
  elf: true,
  hex: true,
  bin: true,
  'file-name': true,
});
const PROVISIONAL = members<ProvisionalId>({
  'waiting-board': true,
  'missing-driver': true,
  'external-tool': true,
  'no-firmware': true,
  incomplete: true,
});
const STEPS = members<StepKind>({ connecting: true, erasing: true, writing: true, verifying: true, resetting: true });

const MIB = 1024 * 1024;

afterEach(() => setLocale('fr'));

describe('dictionaries', () => {
  it('English has exactly the same keys and kinds as French', () => {
    expect(shape(en)).toEqual(shape(fr));
  });

  it('has no empty message', () => {
    for (const text of [...leafStrings(fr), ...leafStrings(en)]) {
      expect(text.trim()).not.toBe('');
    }
  });

  it('shows no French in English', () => {
    for (const text of leafStrings(en)) {
      expect(text).not.toMatch(/[éèêàâçùûôî’]/);
    }
  });

  it('has a title, an explanation and causes for every error code', () => {
    expect(Object.keys(fr.errors).sort()).toEqual([...CODES].sort());
    for (const code of CODES) {
      expect(en.errors[code].title).not.toBe(fr.errors[code].title);
      expect(fr.errors[code].explanation(null).trim()).not.toBe('');
      expect(en.errors[code].explanation(null)).not.toBe(fr.errors[code].explanation(null));
      expect(en.errors[code].causes).toHaveLength(fr.errors[code].causes.length);
    }
    expect(fr.errors['device-error'].causes).toEqual([
      { title: 'Le câble a bougé ou est défectueux.', detail: 'Rebranchez-le fermement, ou essayez un autre câble.' },
      { title: 'L’alimentation est insuffisante.', detail: 'Évitez les hubs USB non alimentés.' },
    ]);
    expect(fr.errors.cancelled.causes).toEqual([]);
  });

  it('names every source kind, provisional screen and step in both languages', () => {
    for (const source of SOURCES) {
      expect(en.firmware.source[source]).not.toBe(fr.firmware.source[source]);
    }
    for (const screen of PROVISIONAL) {
      expect(en.provisional.title[screen]).not.toBe(fr.provisional.title[screen]);
    }
    for (const step of STEPS) {
      expect(en.failure.stepNoun[step]).not.toBe(fr.failure.stepNoun[step]);
    }
    expect(Object.keys(fr.firmware.source).sort()).toEqual([...SOURCES].sort());
    expect(Object.keys(fr.provisional.title).sort()).toEqual([...PROVISIONAL].sort());
    expect(Object.keys(fr.failure.stepNoun).sort()).toEqual([...STEPS].sort());
    expect(fr.provisional.recheck).toBe('Revérifier');
    expect(en.provisional.recheck).toBe('Check again');
  });
});

describe('sentences built from data', () => {
  it('elides the article before a vowel in the success sentence', () => {
    expect(fr.success.body('Thermostat v1.4.2', 'ESP32-S3', 'COM4')).toBe(
      'Thermostat v1.4.2 est installé sur l’ESP32-S3 (COM4). Vous pouvez débrancher la carte.',
    );
    expect(fr.success.body('Passerelle v0.9.0-rc2', 'STM32F411', 'COM5')).toBe(
      'Passerelle v0.9.0-rc2 est installé sur le STM32F411 (COM5). Vous pouvez débrancher la carte.',
    );
    expect(fr.success.body('capteur-porte v2.0.1', 'nRF52840', 'COM7')).toContain('sur le nRF52840 (COM7)');
    expect(en.success.body('Thermostat v1.4.2', 'ESP32-S3', 'COM4')).toBe(
      'Thermostat v1.4.2 is installed on the ESP32-S3 (COM4). You can unplug the board.',
    );
  });

  it('says where a failure happened, or leaves it out', () => {
    const at = fr.failure.at(fr.failure.stepNoun.writing, formatPercent(41, 'fr'));
    expect(fr.errors['device-error'].explanation(at)).toBe(
      `La carte a cessé de répondre pendant l’écriture, à ${formatPercent(41, 'fr')}. Elle n’est pas endommagée : vous pouvez relancer.`,
    );
    expect(fr.errors['device-error'].explanation(null)).toBe(
      'La carte a cessé de répondre. Elle n’est pas endommagée : vous pouvez relancer.',
    );
    const atEn = en.failure.at(en.failure.stepNoun.writing, formatPercent(41, 'en'));
    expect(en.errors['device-error'].explanation(atEn)).toBe(
      'The board stopped responding while writing, at 41%. It is not damaged: you can try again.',
    );
  });

  it('describes the board connection, with or without a flash size', () => {
    const flash = fr.board.flash(formatSize(8 * MIB, 'fr', fr));
    expect(fr.board.connection('COM4', fr.board.link.usbJtag, flash)).toBe(
      'Port COM4 · USB-JTAG intégré · flash 8\u00a0Mo',
    );
    expect(fr.board.connection('COM5', fr.board.link.probe('ST-Link'), null)).toBe('Port COM5 · sonde ST-Link');
    expect(en.board.connection('COM4', en.board.link.usbSerial('CP2102'), null)).toBe('Port COM4 · USB serial CP2102');
  });

  it('counts in the right grammatical number', () => {
    expect(fr.list.summary(6, 2)).toBe('6 trouvés dans 2 dossiers · la liste se met à jour toute seule');
    expect(fr.list.summary(1, 1)).toBe('1 trouvé dans 1 dossier · la liste se met à jour toute seule');
    expect(en.list.summary(1, 2)).toBe('1 found in 2 folders · the list updates by itself');
    expect(fr.firmware.changeCount(6)).toBe('Changer · 6 disponibles');
    expect(fr.firmware.ranges(1)).toBe('1 plage d’adresses');
    expect(en.firmware.ranges(3)).toBe('3 address ranges');
    expect(fr.firmware.manifest(4)).toBe('4 fichiers · adresses lues dans');
    expect(en.firmware.manifest(1)).toBe('1 file · addresses read from');
  });

  it('words the guess reason with the address and the family', () => {
    expect(fr.families.reason.startAddress(formatAddress(0x0800_0000), 'STM32')).toBe(
      'Les adresses commencent à 0x8000000, ce qui correspond d’habitude à un STM32. Confirmez le type de puce pour continuer.',
    );
    expect(en.families.reason.fileName('nRF')).toBe('The file name suggests an nRF. Confirm the chip type to continue.');
  });
});

describe('locale', () => {
  it('picks French only when the first system language is French', () => {
    expect(detectLocale(['fr-FR', 'en-US'])).toBe('fr');
    expect(detectLocale(['FR-ca'])).toBe('fr');
    expect(detectLocale(['en-US', 'fr-FR'])).toBe('en');
    expect(detectLocale(['de-DE'])).toBe('en');
    expect(detectLocale([])).toBe('en');
  });

  it('switches the messages returned by t()', () => {
    setLocale('en');
    expect(locale()).toBe('en');
    expect(t().settings.title).toBe('Settings');
    setLocale('fr');
    expect(t().settings.title).toBe('Réglages');
  });
});

describe('number formats', () => {
  it('shows a percentage in the language’s style', () => {
    expect(formatPercent(44, 'fr')).toBe(new Intl.NumberFormat('fr', { style: 'percent' }).format(0.44));
    expect(formatPercent(44, 'en')).toBe('44%');
  });
});

describe('chipName', () => {
  it('writes chip ids the way their makers do', () => {
    expect(chipName('esp32s3')).toBe('ESP32-S3');
    expect(chipName('esp32c3')).toBe('ESP32-C3');
    expect(chipName('esp32')).toBe('ESP32');
    expect(chipName('stm32f411')).toBe('STM32F411');
    expect(chipName('nrf52840')).toBe('nRF52840');
  });
});

describe('formatAddress', () => {
  it('writes upper-case hex digits after a lower-case 0x', () => {
    expect(formatAddress(0)).toBe('0x0');
    expect(formatAddress(0x8000)).toBe('0x8000');
    expect(formatAddress(0xd000)).toBe('0xD000');
    expect(formatAddress(0x10000)).toBe('0x10000');
  });
});

describe('formatSize', () => {
  it('shows whole KiB below 1 MiB', () => {
    expect(formatSize(21_504, 'fr', fr)).toBe('21\u00a0Ko');
    expect(formatSize(3_072, 'fr', fr)).toBe('3\u00a0Ko');
    expect(formatSize(126_976, 'en', en)).toBe('124\u00a0KB');
  });

  it('shows MiB with at most one decimal from 1 MiB', () => {
    expect(formatSize(1_186_202, 'fr', fr)).toBe('1,1\u00a0Mo');
    expect(formatSize(1_186_202, 'en', en)).toBe('1.1\u00a0MB');
    expect(formatSize(8 * MIB, 'fr', fr)).toBe('8\u00a0Mo');
  });

  it('switches to MiB rather than showing 1024 KiB', () => {
    expect(formatSize(1_048_064, 'fr', fr)).toBe('1\u00a0Mo');
  });
});

describe('formatDuration', () => {
  it('keeps one decimal below 10 s, whole seconds above', () => {
    expect(formatDuration(800, 'fr')).toBe('0,8\u00a0s');
    expect(formatDuration(2_100, 'fr')).toBe('2,1\u00a0s');
    expect(formatDuration(800, 'en')).toBe('0.8\u00a0s');
    expect(formatDuration(23_400, 'fr')).toBe('23\u00a0s');
  });

  it('drops a zero decimal and rounds 9.96 s up to whole seconds', () => {
    expect(formatDuration(2_000, 'fr')).toBe('2\u00a0s');
    expect(formatDuration(9_960, 'fr')).toBe('10\u00a0s');
  });
});

describe('formatEstimate', () => {
  it('spells out seconds, then minutes', () => {
    expect(formatEstimate(25_000, fr)).toBe('25 secondes');
    expect(formatEstimate(25_000, en)).toBe('25 seconds');
    expect(formatEstimate(60_000, fr)).toBe('1 minute');
    expect(formatEstimate(150_000, en)).toBe('3 minutes');
  });
});

describe('formatVersion', () => {
  it('adds the leading v once', () => {
    expect(formatVersion('1.4.2')).toBe('v1.4.2');
    expect(formatVersion('v0.9.0-rc2')).toBe('v0.9.0-rc2');
    expect(formatVersion('V2.0.1')).toBe('V2.0.1');
  });
});

describe('stepLabel', () => {
  const step = (kind: StepKind, extra: Partial<Step> = {}): Step => ({
    kind,
    image: null,
    index: null,
    count: null,
    status: 'pending',
    startedAt: null,
    durationMs: null,
    ...extra,
  });

  it('names each step, numbering files from 1', () => {
    expect(stepLabel(step('connecting'), fr)).toBe(fr.steps.connecting);
    expect(stepLabel(step('erasing'), fr)).toBe(fr.steps.erasing);
    expect(stepLabel(step('verifying'), en)).toBe(en.steps.verifying);
    expect(stepLabel(step('resetting'), fr)).toBe(fr.steps.resetting);
    const image = { address: 0x1_0000, name: 'thermostat.bin', size: 1_153_434 };
    expect(stepLabel(step('writing', { image, index: 3, count: 4 }), fr)).toBe('Écriture 4/4 · thermostat.bin');
    expect(stepLabel(step('writing', { image, index: 0, count: 2 }), en)).toBe('Writing 1/2 · thermostat.bin');
  });
});

describe('formatDate and formatTime', () => {
  const builtAt = '2026-09-12T14:32:00';

  it('writes the date in the language’s order', () => {
    expect(formatDate(builtAt, 'fr')).toBe('12/09/2026');
    expect(formatDate(builtAt, 'en')).toBe('09/12/2026');
  });

  it('writes the time on 24 hours in French and 12 hours in English', () => {
    expect(formatTime(builtAt, 'fr')).toBe('14:32');
    expect(formatTime(builtAt, 'en')).toBe('2:32\u00a0PM');
    expect(formatTime('2026-09-12T00:05:00', 'en')).toBe('12:05\u00a0AM');
    expect(formatTime('2026-09-12T09:05:00', 'fr')).toBe('09:05');
  });

  it('returns the value unchanged when it is not a local ISO date-time', () => {
    expect(formatDate('yesterday', 'fr')).toBe('yesterday');
    expect(formatTime('2026-09-12', 'en')).toBe('2026-09-12');
  });
});
