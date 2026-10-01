import { describe, expect, it } from 'vitest';
import { filterCounts, filterFirmwares, firmwareTitle, tileMark } from './firmware';
import { firmware } from './fixtures';

const thermostat = firmware();
const thermostatOld = firmware({ id: 'fw-thermostat-1.3.0', version: '1.3.0', variant: null });
const capteur = firmware({
  id: 'fw-capteur-porte',
  name: 'capteur-porte',
  version: '2.0.1',
  chip: 'nrf52840',
  source: 'file-name',
  family: { kind: 'certain', family: 'nrf' },
});
const passerelle = firmware({
  id: 'fw-passerelle',
  name: 'Passerelle',
  version: '0.9.0-rc2',
  chip: 'stm32f411',
  source: 'elf',
  fileName: 'passerelle.elf',
  family: { kind: 'certain', family: 'stm32' },
});
const sonde = firmware({ id: 'fw-sonde-air', name: 'sonde_air', version: '1.0.0', chip: 'esp32c3', source: 'arduino' });
const hex = firmware({
  id: 'fw-hex',
  name: null,
  version: null,
  chip: null,
  fileName: 'firmware.hex',
  source: 'hex',
  family: { kind: 'suggested', family: 'stm32', reason: { kind: 'start-address', address: 0x0800_0000 } },
});
const list = [thermostat, thermostatOld, capteur, passerelle, sonde, hex];
const ids = (found: { id: string }[]) => found.map((item) => item.id);

describe('firmwareTitle', () => {
  it('is the name, or the file name when there is none', () => {
    expect(firmwareTitle(thermostat)).toBe('Thermostat');
    expect(firmwareTitle(hex)).toBe('firmware.hex');
  });
});

describe('tileMark', () => {
  it('marks each family', () => {
    expect(tileMark('esp32')).toBe('ESP');
    expect(tileMark('stm32')).toBe('STM');
    expect(tileMark('nrf')).toBe('nRF');
  });

  it('marks a firmware of unknown family by its format', () => {
    expect(tileMark(null, hex)).toBe('HEX');
    expect(tileMark(null, firmware({ source: 'bin' }))).toBe('?');
    expect(tileMark(null)).toBe('?');
  });
});

describe('filterFirmwares', () => {
  it('keeps everything, in order, for "all" and an empty query', () => {
    expect(ids(filterFirmwares(list, 'all', ''))).toEqual(ids(list));
    expect(ids(filterFirmwares(list, 'all', '   '))).toEqual(ids(list));
  });

  it('keeps a certain family only under its chip, and the rest under "unidentified"', () => {
    expect(ids(filterFirmwares(list, 'esp32', ''))).toEqual([thermostat.id, thermostatOld.id, sonde.id]);
    expect(ids(filterFirmwares(list, 'stm32', ''))).toEqual([passerelle.id]);
    expect(ids(filterFirmwares(list, 'nrf', ''))).toEqual([capteur.id]);
    expect(ids(filterFirmwares(list, 'unidentified', ''))).toEqual([hex.id]);
  });

  it('searches title, file name, version and chip, ignoring case and punctuation', () => {
    expect(ids(filterFirmwares(list, 'all', 'THERMO'))).toEqual([thermostat.id, thermostatOld.id]);
    expect(ids(filterFirmwares(list, 'all', '1.3'))).toEqual([thermostatOld.id]);
    expect(ids(filterFirmwares(list, 'all', '.hex'))).toEqual([hex.id]);
    expect(ids(filterFirmwares(list, 'all', 'ESP32-C3'))).toEqual([sonde.id]);
    expect(ids(filterFirmwares(list, 'all', 'nRF52840'))).toEqual([capteur.id]);
    expect(ids(filterFirmwares(list, 'all', 'zigbee'))).toEqual([]);
  });

  it('combines the filter and the query', () => {
    expect(ids(filterFirmwares(list, 'esp32', 'sonde'))).toEqual([sonde.id]);
    expect(ids(filterFirmwares(list, 'nrf', 'thermo'))).toEqual([]);
  });
});

describe('filterCounts', () => {
  it('counts every filter on the whole list', () => {
    expect(filterCounts(list)).toEqual({ all: 6, esp32: 3, stm32: 1, nrf: 1, unidentified: 1 });
    expect(filterCounts([])).toEqual({ all: 0, esp32: 0, stm32: 0, nrf: 0, unidentified: 0 });
  });
});
