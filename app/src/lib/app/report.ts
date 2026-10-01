import type { FlashState } from '../flashState';
import {
  formatAddress,
  formatDate,
  formatDuration,
  formatPercent,
  formatSize,
  formatTime,
  formatVersion,
  stepLabel,
} from '../i18n/format';
import type { Messages } from '../i18n/fr';
import type { Locale } from '../i18n/locale';
import { linkText } from '../targets';
import type { AppInfo, FirmwareSummary, Target, WatchedFolder } from '../types';
import { firmwareTitle } from './firmware';

export interface ReportInput {
  info: AppInfo;
  firmware: FirmwareSummary;
  folder: WatchedFolder | null;
  target: Target | null;
  job: Extract<FlashState, { status: 'success' | 'failure' }>;
  now: Date;
}

/** Local time without a zone, the shape the date formatters read ("2026-10-01T09:05:00"). */
function localIso(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/** The folder's kind, never its path: the report may leave the company. */
function folderLabel(folder: WatchedFolder | null, m: Messages): string {
  return folder?.kind === 'app' ? m.status.appFolder : m.list.folderWatched;
}

function boardLines(target: Target | null, m: Messages, locale: Locale): string[] {
  if (target === null) return [m.report.noTarget];
  const link = linkText(target.link, m);
  const flash = target.flashSize === null ? null : m.board.flash(formatSize(target.flashSize, locale, m));
  return [m.report.target(target.label, target.port), flash === null ? link : `${link} · ${flash}`];
}

/** Plain text for the clipboard: version, date, firmware, board, timed steps, result and log. */
export function buildReport(input: ReportInput, m: Messages, locale: Locale): string {
  const { info, firmware, folder, target, job, now } = input;
  const iso = localIso(now);
  const lines = [m.report.heading, m.report.app(info.version), m.report.date(formatDate(iso, locale), formatTime(iso, locale))];
  if (info.scenario !== null) lines.push(m.report.simulated(info.scenario));

  const version = firmware.version === null ? null : formatVersion(firmware.version);
  lines.push('', m.report.firmware(firmwareTitle(firmware), version), m.report.file(firmware.fileName, folderLabel(folder, m)));
  for (const image of firmware.images) {
    lines.push(m.report.image(formatAddress(image.address), image.name, formatSize(image.size, locale, m)));
  }

  lines.push('', ...boardLines(target, m, locale), '');
  for (const step of job.steps) {
    if (step.durationMs !== null) lines.push(m.report.step(stepLabel(step, m), formatDuration(step.durationMs, locale)));
  }

  lines.push('');
  if (job.status === 'success') {
    lines.push(m.report.success);
  } else {
    lines.push(m.report.failure(m.errors[job.error.code].title));
    const { phase, percent } = job.error;
    if (phase !== null && percent !== null) {
      lines.push(m.failure.at(m.failure.stepNoun[phase.kind], formatPercent(percent, locale)));
    }
  }

  lines.push('', m.report.technical, ...(job.status === 'success' ? job.report.log : job.error.technical.split('\n')));
  return lines.join('\n');
}
