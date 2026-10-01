import type { Step } from '../flashState';
import type { Phase } from '../types';
import type { Messages } from './fr';
import type { Locale } from './locale';

const KIB = 1024;
const MIB = 1024 * 1024;

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
  return `${seconds}\u00a0s`;
}

/** Whole KiB with the language's grouping: "1 132 Ko" / "1,132 KB". */
export function formatKib(bytes: number, locale: Locale, m: Messages): string {
  return `${new Intl.NumberFormat(locale).format(Math.round(bytes / KIB))}\u00a0${m.units.kib}`;
}

/** Whole percent in the language's style: "44 %" (narrow no-break space) / "44%". */
export function formatPercent(percent: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(percent / 100);
}

/** Chip ids as their makers write them: "esp32s3" → "ESP32-S3", "stm32f411" → "STM32F411", "nrf52840" → "nRF52840". */
export function chipName(chip: string): string {
  const id = chip.toLowerCase();
  if (id.startsWith('esp32')) {
    const variant = id.slice('esp32'.length);
    return variant ? `ESP32-${variant.toUpperCase()}` : 'ESP32';
  }
  if (id.startsWith('nrf')) return `nRF${id.slice('nrf'.length).toUpperCase()}`;
  return id.toUpperCase();
}

/** "0x0", "0xD000", "0x10000": upper-case digits after a lower-case 0x. */
export function formatAddress(address: number): string {
  return `0x${address.toString(16).toUpperCase()}`;
}

/** Whole KiB below 1 MiB ("21 Ko"), MiB with at most one decimal above ("1,1 Mo", "8 Mo"). */
export function formatSize(bytes: number, locale: Locale, m: Messages): string {
  const kib = Math.round(bytes / KIB);
  if (kib < 1024) return `${new Intl.NumberFormat(locale).format(kib)}\u00a0${m.units.kib}`;
  const mib = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / MIB);
  return `${mib}\u00a0${m.units.mib}`;
}

/** At most one decimal below 10 s ("0,8 s", "2 s"), whole seconds above ("23 s"). */
export function formatDuration(ms: number, locale: Locale): string {
  const tenths = Math.round(ms / 100);
  const seconds = tenths < 100 ? tenths / 10 : Math.round(ms / 1000);
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(seconds)}\u00a0s`;
}

/** An estimate spelled out, as in "Environ 25 secondes": seconds below a minute, whole minutes above. */
export function formatEstimate(ms: number, m: Messages): string {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? m.units.seconds(seconds) : m.units.minutes(Math.round(seconds / 60));
}

/** Versions arrive without the leading "v" ("1.4.2"); one already written "v0.9.0-rc2" or "V2" is kept. */
export function formatVersion(version: string): string {
  return /^v/i.test(version) ? version : `v${version}`;
}

/** `builtAt` is local time with no zone ("2026-09-12T14:32:00"), so it is read as text, never through Date. */
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})/;

/** "12/09/2026" in French, "09/12/2026" in English. */
export function formatDate(iso: string, locale: Locale): string {
  const match = LOCAL_DATE.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  return locale === 'fr' ? `${day}/${month}/${year}` : `${month}/${day}/${year}`;
}

/** "14:32" in French, "2:32 PM" in English (no-break space before AM/PM). */
export function formatTime(iso: string, locale: Locale): string {
  const match = LOCAL_TIME.exec(iso);
  if (!match) return iso;
  const [, hh, mm] = match;
  if (locale === 'fr') return `${hh}:${mm}`;
  const hours = Number(hh);
  return `${hours % 12 || 12}:${mm}\u00a0${hours < 12 ? 'AM' : 'PM'}`;
}

/** One step of the job as the step list and the report name it; a writing step counts files from 1. */
export function stepLabel(step: Step, m: Messages): string {
  switch (step.kind) {
    case 'connecting':
      return m.steps.connecting;
    case 'erasing':
      return m.steps.erasing;
    case 'writing':
      return m.steps.writing((step.index ?? 0) + 1, step.count ?? 1, step.image?.name ?? '');
    case 'verifying':
      return m.steps.verifying;
    case 'resetting':
      return m.steps.resetting;
  }
}
