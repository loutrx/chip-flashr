import type { Phase } from '../types';
import type { Messages } from './fr';
import type { Locale } from './locale';

export function phaseLabel(phase: Phase | null, m: Messages): string {
  if (!phase) return m.phase.preparing;
  switch (phase.kind) {
    case 'connecting':
      return m.phase.connecting;
    case 'erasing':
      return m.phase.erasing;
    case 'writing':
      return m.phase.writing(phase.index + 1, phase.count, phase.label);
    case 'verifying':
      return m.phase.verifying;
    case 'resetting':
      return m.phase.resetting;
  }
}

/** "4,6 s" / "4.6 s", with a no-break space before the unit. */
export function formatSeconds(ms: number, locale: Locale): string {
  const seconds = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
    ms / 1000,
  );
  return `${seconds} s`;
}

/** Whole KiB with the language's grouping: "1 132 Ko" / "1,132 KB". */
export function formatKib(bytes: number, locale: Locale, m: Messages): string {
  return `${new Intl.NumberFormat(locale).format(Math.round(bytes / 1024))} ${m.units.kib}`;
}

/** Whole percent in the language's style: "44 %" (narrow no-break space) / "44%". */
export function formatPercent(percent: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(percent / 100);
}
