import { describe, expect, it } from 'vitest';
import { flashReducer, type FlashAction, type FlashState } from '../flashState';
import { en } from '../i18n/en';
import { formatAddress, formatDate, formatDuration, formatPercent, formatSize, formatTime, formatVersion } from '../i18n/format';
import { fr } from '../i18n/fr';
import type { AppInfo, FlashReport, ProgressEvent, UserFacingError } from '../types';
import { firmware, snapshot, target } from './fixtures';
import { buildReport, type ReportInput } from './report';

type Finished = Extract<FlashState, { status: 'success' | 'failure' }>;

const INFO: AppInfo = { name: 'Chip Flashr', version: '0.1.0', scenario: 'default', scenarioWarning: null };
const FIRMWARE = firmware();
const [APP_FOLDER, WATCHED_FOLDER] = snapshot().folders;
const BOARD = target();
const NOW = new Date(2026, 9, 1, 9, 5, 0);
const NOW_ISO = '2026-10-01T09:05:00';
const LOG = ['connect ESP32-S3', 'write 0x0 bootloader.bin 21504 B', 'verify ok', 'reset'];
const TOTAL = FIRMWARE.sizeBytes;

const event = (phase: ProgressEvent['phase'], bytesDone: number): ProgressEvent => ({ phase, bytesDone, bytesTotal: TOTAL });

type Progress = Extract<FlashAction, { type: 'progress' }>;
type End = Extract<FlashAction, { type: 'success' | 'failure' }>;

/** Connect 300 ms, erase 100 ms, 1 s per image, verify 200 ms, reset 50 ms; events after `end` never arrive. */
function timedJob(end: End): Finished {
  const events: Progress[] = [
    { type: 'progress', event: event({ kind: 'connecting' }, 0), at: 0 },
    { type: 'progress', event: event({ kind: 'erasing' }, 0), at: 300 },
  ];
  let written = 0;
  FIRMWARE.images.forEach((image, index) => {
    written += image.size;
    const phase = { kind: 'writing' as const, index, count: FIRMWARE.images.length, label: image.name, address: image.address };
    events.push({ type: 'progress', event: event(phase, written), at: 400 + index * 1000 });
  });
  events.push(
    { type: 'progress', event: event({ kind: 'verifying' }, TOTAL), at: 4400 },
    { type: 'progress', event: event({ kind: 'resetting' }, TOTAL), at: 4600 },
  );
  const actions: FlashAction[] = [
    { type: 'start', request: { firmwareId: FIRMWARE.id, targetId: BOARD.id, family: null }, images: FIRMWARE.images, at: 0 },
    ...events.filter((progress) => progress.at < end.at),
    end,
  ];
  const state = actions.reduce(flashReducer, { status: 'idle' } as FlashState);
  if (state.status !== 'success' && state.status !== 'failure') throw new Error(`unexpected ${state.status}`);
  return state;
}

const REPORT: FlashReport = { bytesWritten: TOTAL, durationMs: 4650, verified: true, log: LOG };
/** What the mock returns on this package with `fail_at = 41`: block 111 of thermostat.bin's 282, last event at 40 %. */
const ERROR: UserFacingError = {
  code: 'device-error',
  technical: 'device error: write block 111/282 @ 0x0007e000\nerror: simulated disconnect',
  phase: { kind: 'writing', index: 3, count: 4, label: 'thermostat.bin', address: 0x10000 },
  percent: 40,
};

function input(overrides: Partial<ReportInput> = {}): ReportInput {
  return {
    info: INFO,
    firmware: FIRMWARE,
    folder: APP_FOLDER,
    target: BOARD,
    job: timedJob({ type: 'success', report: REPORT, at: 4650 }),
    now: NOW,
    ...overrides,
  };
}

const failed = () => timedJob({ type: 'failure', error: ERROR, at: 4000 });

describe('buildReport', () => {
  it('lists the app, firmware, images, board, timed steps, result and log', () => {
    expect(buildReport(input(), fr, 'fr').split('\n')).toEqual([
      fr.report.heading,
      fr.report.app('0.1.0'),
      fr.report.date(formatDate(NOW_ISO, 'fr'), formatTime(NOW_ISO, 'fr')),
      fr.report.simulated('default'),
      '',
      fr.report.firmware('Thermostat', formatVersion('1.4.2')),
      fr.report.file('build', fr.status.appFolder),
      ...FIRMWARE.images.map((image) =>
        fr.report.image(formatAddress(image.address), image.name, formatSize(image.size, 'fr', fr)),
      ),
      '',
      fr.report.target('ESP32-S3', 'COM4'),
      `${fr.board.link.usbJtag} · ${fr.board.flash(formatSize(8 * 1024 * 1024, 'fr', fr))}`,
      '',
      fr.report.step(fr.steps.connecting, formatDuration(300, 'fr')),
      fr.report.step(fr.steps.erasing, formatDuration(100, 'fr')),
      ...FIRMWARE.images.map((image, index) =>
        fr.report.step(fr.steps.writing(index + 1, 4, image.name), formatDuration(1000, 'fr')),
      ),
      fr.report.step(fr.steps.verifying, formatDuration(200, 'fr')),
      fr.report.step(fr.steps.resetting, formatDuration(50, 'fr')),
      '',
      fr.report.success,
      '',
      fr.report.technical,
      ...LOG,
    ]);
  });

  it('never contains a folder or firmware path', () => {
    const cases: ReportInput[] = [
      input(),
      input({ folder: WATCHED_FOLDER, firmware: firmware({ path: 'D:\\Firmwares\\thermostat\\build', folder: 1 }) }),
      input({ job: failed() }),
      input({ folder: null }),
    ];
    for (const [m, locale] of [
      [fr, 'fr'],
      [en, 'en'],
    ] as const) {
      for (const each of cases) {
        const text = buildReport(each, m, locale);
        for (const fragment of ['C:\\Livraison', 'D:\\Firmwares', '\\build', each.firmware.path]) {
          expect(text, `${locale}: ${fragment}`).not.toContain(fragment);
        }
      }
    }
  });

  it('names a watched folder by its kind', () => {
    const text = buildReport(input({ folder: WATCHED_FOLDER }), fr, 'fr');
    expect(text).toContain(fr.report.file('build', fr.list.folderWatched));
    expect(buildReport(input({ folder: null }), fr, 'fr')).toContain(fr.report.file('build', fr.list.folderWatched));
  });

  it('renders in English with the English words', () => {
    const text = buildReport(input(), en, 'en');
    expect(text.startsWith(`${en.report.heading}\n`)).toBe(true);
    expect(text).toContain(en.report.date(formatDate(NOW_ISO, 'en'), formatTime(NOW_ISO, 'en')));
    expect(text).toContain(en.report.step(en.steps.connecting, formatDuration(300, 'en')));
    expect(text).toContain(en.report.success);
    expect(text).not.toContain(fr.report.heading);
    expect(text).not.toContain(fr.report.success);
  });

  it('tells where a failure stopped and keeps the technical lines', () => {
    const lines = buildReport(input({ job: failed() }), fr, 'fr').split('\n');
    expect(lines).toContain(fr.report.failure(fr.errors['device-error'].title));
    expect(lines).toContain(fr.failure.at(fr.failure.stepNoun.writing, formatPercent(40, 'fr')));
    expect(lines).toContain(fr.report.step(fr.steps.writing(4, 4, 'thermostat.bin'), formatDuration(600, 'fr')));
    expect(lines.slice(-3)).toEqual([
      fr.report.technical,
      'device error: write block 111/282 @ 0x0007e000',
      'error: simulated disconnect',
    ]);
    expect(lines).not.toContain(fr.report.success);
  });

  it('says when no board was seen, and leaves out the scenario of a real backend', () => {
    const text = buildReport(input({ target: null, info: { ...INFO, scenario: null } }), fr, 'fr');
    expect(text).toContain(fr.report.noTarget);
    expect(text).not.toContain(fr.report.simulated('default'));
  });
});
