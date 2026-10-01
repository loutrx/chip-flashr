import { describe, expect, it } from 'vitest';
import { target } from './app/fixtures';
import type { ScreenId } from './app/screen';
import { en } from './i18n/en';
import { fr } from './i18n/fr';
import { boardName, linkText, pillText, type PillState } from './targets';
import type { DeviceIssue, Download, Target } from './types';

/** The fixture's simulated ESP32-S3 on COM4, USB-JTAG, 8 MiB of flash. */
const esp: Target = target();

const download: Download = {
  title: 'nRF Util',
  publisher: 'Nordic Semiconductor',
  versionHint: '7.x',
  sizeHint: null,
  url: 'https://www.nordicsemi.com/Products/Development-tools/nRF-Util',
};

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

const locked: DeviceIssue = {
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

const ok: PillState = { tone: 'ok', text: 'ESP32-S3 · COM4', breathe: true };
const noBoard: PillState = { tone: 'idle', text: 'Aucune carte', breathe: false };

/** The spec's pill table, one row per screen. */
const TABLE = {
  loading: [null, null, { tone: 'idle', text: null, breathe: false }],
  home: [esp, null, ok],
  'firmware-list': [esp, null, ok],
  incomplete: [esp, null, ok],
  success: [esp, null, ok],
  'choose-chip': [null, null, noBoard],
  'waiting-board': [null, null, noBoard],
  'no-firmware': [null, null, noBoard],
  programming: [esp, null, { tone: 'busy', text: 'ESP32-S3 · programmation…', breathe: true }],
  failure: [esp, null, { tone: 'err', text: 'ESP32-S3 · erreur', breathe: false }],
  'missing-driver': [null, driver, { tone: 'warn', text: 'Pilote manquant', breathe: false }],
  'external-tool': [null, locked, { tone: 'warn', text: 'nRF52840 · verrouillée', breathe: false }],
} satisfies Record<ScreenId, readonly [Target | null, DeviceIssue | null, PillState]>;

describe('boardName', () => {
  it('names simulated boards in the UI language', () => {
    expect(boardName(esp, fr)).toBe('Carte simulée · ESP32-S3');
    expect(boardName(esp, en)).toBe('Simulated board · ESP32-S3');
  });

  it('keeps the label of a real board as the backend reported it', () => {
    expect(boardName({ ...esp, id: 'serial:COM4' }, fr)).toBe('ESP32-S3');
  });
});

describe('linkText', () => {
  it('words each kind of link in the UI language', () => {
    expect(linkText({ kind: 'usb-jtag' }, fr)).toBe(fr.board.link.usbJtag);
    expect(linkText({ kind: 'usb-serial', bridge: 'CP2102N' }, fr)).toBe(fr.board.link.usbSerial('CP2102N'));
    expect(linkText({ kind: 'probe', name: 'ST-Link' }, fr)).toBe('sonde ST-Link');
    expect(linkText({ kind: 'usb-serial', bridge: 'CP2102' }, en)).toBe('USB serial CP2102');
  });
});

describe('pillText', () => {
  it('follows the spec table on every screen', () => {
    for (const [screen, [target, issue, expected]] of Object.entries(TABLE)) {
      expect(pillText(screen as ScreenId, target, issue, fr), screen).toEqual(expected);
    }
  });

  it('says no board when a screen that names the board has none', () => {
    expect(pillText('firmware-list', null, null, fr)).toEqual(noBoard);
    expect(pillText('programming', null, null, fr)).toEqual(noBoard);
    expect(pillText('failure', null, null, fr)).toEqual(noBoard);
  });

  it('names a missing tool on a chip that is not locked', () => {
    const unlocked: DeviceIssue = { ...locked, locked: null };
    expect(pillText('external-tool', null, unlocked, fr)).toEqual({
      tone: 'warn',
      text: 'nRF52840 · outil manquant',
      breathe: false,
    });
  });

  it('follows the UI language', () => {
    expect(pillText('home', esp, null, en).text).toBe('ESP32-S3 · COM4');
    expect(pillText('programming', esp, null, en).text).toBe('ESP32-S3 · programming…');
    expect(pillText('choose-chip', null, null, en).text).toBe('No board');
    expect(pillText('missing-driver', null, driver, en).text).toBe('Missing driver');
  });
});
