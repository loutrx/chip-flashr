import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { firmware } from '../app/fixtures';
import { chipName, formatDate } from '../i18n/format';
import { fr } from '../i18n/fr';
import { setLocale } from '../i18n/index.svelte';
import type { FirmwareSummary } from '../types';
import FilterChips from './FilterChips.svelte';
import FirmwareRow from './FirmwareRow.svelte';
import FolderGroupHeader from './FolderGroupHeader.svelte';
import SearchField from './SearchField.svelte';

afterEach(() => setLocale('fr'));

/** The fixture's build date. */
const BUILT = '2026-09-12T14:32:00';

/** The fixture's Thermostat package, delivered as a zip in the app folder. */
const thermostat: FirmwareSummary = firmware({
  path: 'C:\\Livraison\\thermostat_v1.4.2_esp32s3_prod.zip',
  fileName: 'thermostat_v1.4.2_esp32s3_prod.zip',
});

/** A bare hex in the watched folder, with no guess at all. */
const hex: FirmwareSummary = firmware({
  id: 'firmware-hex',
  path: 'D:\\Firmwares\\firmware.hex',
  fileName: 'firmware.hex',
  folder: 1,
  source: 'hex',
  name: null,
  version: null,
  variant: null,
  chip: null,
  family: { kind: 'unknown' },
  toolchain: null,
  builtAt: '2026-09-21T09:10:00',
  images: [{ address: 0x0800_0000, name: 'firmware.hex', size: 126_976 }],
  manifest: null,
  checks: [],
  readme: null,
});

describe('FirmwareRow', () => {
  it('shows a known firmware in its columns and reports a pick', async () => {
    const onselect = vi.fn();
    render(FirmwareRow, { firmware: thermostat, selected: true, onselect });
    const row = screen.getByRole('button', { name: /Thermostat/ });
    expect(row).toHaveAttribute('aria-pressed', 'true');
    expect(within(row).getByText('ESP')).toBeInTheDocument();
    expect(within(row).getByText('v1.4.2')).toBeInTheDocument();
    expect(within(row).getByText('prod')).toBeInTheDocument();
    expect(within(row).getByText(chipName('esp32s3'))).toBeInTheDocument();
    expect(within(row).getByText(fr.firmware.source['esp-idf-build'])).toBeInTheDocument();
    expect(within(row).getByText(formatDate(BUILT, 'fr'))).toBeInTheDocument();
    await fireEvent.click(row);
    expect(onselect).toHaveBeenCalledOnce();
  });

  it('asks for the chip family when it is not certain', () => {
    render(FirmwareRow, { firmware: hex, selected: false, onselect: vi.fn() });
    const row = screen.getByRole('button', { name: /firmware\.hex/ });
    expect(row).toHaveAttribute('aria-pressed', 'false');
    expect(within(row).getByText('?')).toBeInTheDocument();
    expect(within(row).getByText(fr.list.needsFamily)).toBeInTheDocument();
    expect(within(row).getByText(fr.firmware.source.hex)).toBeInTheDocument();
  });

  it('a suggested family still needs confirming', () => {
    const suggested: FirmwareSummary = {
      ...hex,
      family: { kind: 'suggested', family: 'stm32', reason: { kind: 'start-address', address: 0x0800_0000 } },
    };
    render(FirmwareRow, { firmware: suggested, selected: false, onselect: vi.fn() });
    expect(screen.getByText(fr.list.needsFamily)).toBeInTheDocument();
  });

  it('names the family when the chip is unknown, and leaves the date empty when there is none', () => {
    const { container } = render(FirmwareRow, {
      firmware: { ...thermostat, chip: null, builtAt: null },
      selected: false,
      onselect: vi.fn(),
    });
    expect(screen.getByText(fr.families.esp32.name)).toBeInTheDocument();
    expect(container.querySelector('.date')?.textContent).toBe('');
  });
});

describe('FolderGroupHeader', () => {
  it('heads the application folder', () => {
    render(FolderGroupHeader, { folder: { path: 'C:\\Livraison', kind: 'app' } });
    const heading = screen.getByRole('heading', { level: 2 });
    expect(within(heading).getByText('C:\\Livraison')).toBeInTheDocument();
    expect(heading).toHaveTextContent(fr.list.folderApp);
  });

  it('heads a watched folder', () => {
    render(FolderGroupHeader, { folder: { path: 'D:\\Firmwares', kind: 'watched' } });
    const heading = screen.getByRole('heading', { level: 2 });
    expect(within(heading).getByText('D:\\Firmwares')).toBeInTheDocument();
    expect(heading).toHaveTextContent(fr.list.folderWatched);
  });
});

describe('FilterChips', () => {
  const options = [
    { value: 'all', label: fr.list.all, count: 6 },
    { value: 'esp32', label: 'ESP32', count: 3 },
    { value: 'unidentified', label: fr.list.unidentified, count: 1 },
  ];

  it('is a named group that marks the current filter', () => {
    render(FilterChips, { options, value: 'all', label: fr.list.filtersLabel, onchange: vi.fn() });
    const group = screen.getByRole('group', { name: fr.list.filtersLabel });
    expect(within(group).getAllByRole('button')).toHaveLength(3);
    expect(screen.getByRole('button', { name: `${fr.list.all} 6` })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'ESP32 3' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the filter the user picks', async () => {
    const onchange = vi.fn();
    render(FilterChips, { options, value: 'all', label: fr.list.filtersLabel, onchange });
    await fireEvent.click(screen.getByRole('button', { name: `${fr.list.unidentified} 1` }));
    expect(onchange).toHaveBeenCalledWith('unidentified');
  });
});

describe('SearchField', () => {
  it('shows the query and reports each change', async () => {
    const oninput = vi.fn();
    render(SearchField, { value: 'thermo', label: fr.list.searchLabel, placeholder: fr.list.search, oninput });
    const input = screen.getByRole('searchbox', { name: fr.list.searchLabel });
    expect(input).toHaveValue('thermo');
    expect(input).toHaveAttribute('placeholder', fr.list.search);
    await fireEvent.input(input, { target: { value: 'sonde' } });
    expect(oninput).toHaveBeenCalledWith('sonde');
  });
});
