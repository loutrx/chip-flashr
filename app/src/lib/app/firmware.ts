import type { Family, FirmwareSummary } from '../types';

export type FirmwareFilter = 'all' | Family | 'unidentified';

const FILTERS: readonly FirmwareFilter[] = ['all', 'esp32', 'stm32', 'nrf', 'unidentified'];
const MARKS: Record<Family, string> = { esp32: 'ESP', stm32: 'STM', nrf: 'nRF' };

export function firmwareTitle(firmware: FirmwareSummary): string {
  return firmware.name ?? firmware.fileName;
}

/** The letters on the firmware tile: the family, else the file format for a .hex, else "?". */
export function tileMark(family: Family | null, firmware?: FirmwareSummary): string {
  if (family !== null) return MARKS[family];
  return firmware?.source === 'hex' ? 'HEX' : '?';
}

function certainFamily(firmware: FirmwareSummary): Family | null {
  return firmware.family.kind === 'certain' ? firmware.family.family : null;
}

/** A family chip lists certain families only; "unidentified" lists the suggested and unknown ones. */
function matchesFilter(firmware: FirmwareSummary, filter: FirmwareFilter): boolean {
  if (filter === 'all') return true;
  const family = certainFamily(firmware);
  return filter === 'unidentified' ? family === null : family === filter;
}

const compact = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Case-insensitive; "ESP32-S3" also finds chip "esp32s3" once both keep only letters and digits. */
function matchesQuery(firmware: FirmwareSummary, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  const compactNeedle = compact(needle);
  const fields = [firmwareTitle(firmware), firmware.fileName, firmware.version, firmware.chip].filter(
    (field): field is string => field !== null,
  );
  return fields.some(
    (field) => field.toLowerCase().includes(needle) || (compactNeedle !== '' && compact(field).includes(compactNeedle)),
  );
}

export function filterFirmwares(list: FirmwareSummary[], filter: FirmwareFilter, query: string): FirmwareSummary[] {
  return list.filter((firmware) => matchesFilter(firmware, filter) && matchesQuery(firmware, query));
}

/** How many firmwares each filter chip would show, before any search. */
export function filterCounts(list: FirmwareSummary[]): Record<FirmwareFilter, number> {
  const counts: Record<FirmwareFilter, number> = { all: 0, esp32: 0, stm32: 0, nrf: 0, unidentified: 0 };
  for (const filter of FILTERS) counts[filter] = list.filter((firmware) => matchesFilter(firmware, filter)).length;
  return counts;
}
