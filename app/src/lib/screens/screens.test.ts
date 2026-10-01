import { fireEvent, render, screen, within } from '@testing-library/svelte';
import type { ComponentProps } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { firmware, snapshot, target, THERMOSTAT_IMAGES } from '../app/fixtures';
import { estimateMs } from '../flashState';
import { formatEstimate } from '../i18n/format';
import { fr } from '../i18n/fr';
import type { FirmwareSummary, Snapshot, Target } from '../types';
import ChooseChipScreen from './ChooseChipScreen.svelte';
import FirmwareListScreen from './FirmwareListScreen.svelte';
import HomeScreen from './HomeScreen.svelte';

// Fixtures with the mockup values ("Chip Flashr — Écrans", pages Main, Firmwares, ChoixPuce),
// built on app/fixtures.ts (Task 5): the Thermostat package, the ESP32-S3 on COM4, both folders.

/** 1 186 202 bytes: 7.7 s at 150 KiB/s, so the estimate rounds up to 10 s. */
const THERMOSTAT_BYTES = THERMOSTAT_IMAGES.reduce((sum, image) => sum + image.size, 0);

const THERMOSTAT: FirmwareSummary = firmware({
  id: 'thermostat-1.4.2',
  path: 'C:\\Livraison\\thermostat_v1.4.2_esp32s3_prod.zip',
  fileName: 'thermostat_v1.4.2_esp32s3_prod.zip',
});

/** What the fixture's Thermostat says that these single-file firmwares do not. */
const BARE = {
  variant: null,
  toolchain: null,
  manifest: null,
  checks: [],
  readme: null,
} satisfies Partial<FirmwareSummary>;

const CAPTEUR = firmware({
  ...BARE,
  id: 'capteur-porte-2.0.1',
  path: 'C:\\Livraison\\capteur-porte_v2.0.1_nrf52840.hex',
  fileName: 'capteur-porte_v2.0.1_nrf52840.hex',
  source: 'file-name',
  name: 'capteur-porte',
  version: '2.0.1',
  chip: 'nrf52840',
  family: { kind: 'certain', family: 'nrf' },
  builtAt: '2026-08-20T10:05:00',
  images: [{ address: 0x0, name: 'capteur-porte_v2.0.1_nrf52840.hex', size: 307_200 }],
});

const PASSERELLE = firmware({
  ...BARE,
  id: 'passerelle-0.9.0-rc2',
  path: 'D:\\Firmwares\\passerelle.elf',
  fileName: 'passerelle.elf',
  folder: 1,
  source: 'elf',
  name: 'Passerelle',
  version: '0.9.0-rc2',
  chip: 'stm32f411',
  family: { kind: 'certain', family: 'stm32' },
  builtAt: '2026-09-18T16:40:00',
  images: [{ address: 0x0800_0000, name: 'passerelle.elf', size: 460_800 }],
});

const HEX = firmware({
  ...BARE,
  id: 'firmware-hex',
  path: 'D:\\Firmwares\\firmware.hex',
  fileName: 'firmware.hex',
  folder: 1,
  source: 'hex',
  name: null,
  version: null,
  chip: null,
  family: { kind: 'suggested', family: 'stm32', reason: { kind: 'start-address', address: 0x0800_0000 } },
  builtAt: '2026-09-21T09:12:00',
  images: [{ address: 0x0800_0000, name: 'firmware.hex', size: 126_976 }],
});

const TARGET: Target = target();

const STLINK: Target = target({
  id: 'stm32-stlink',
  family: 'stm32',
  label: 'STM32F411',
  chip: 'stm32f411',
  port: 'ST-Link',
  link: { kind: 'probe', name: 'ST-Link V2' },
  flashSize: 512 * 1024,
});

const SNAPSHOT: Snapshot = snapshot({
  firmwares: [THERMOSTAT, CAPTEUR, PASSERELLE, HEX],
  targets: [TARGET],
});

/** The formatters emit U+00A0 / U+202F; the DOM matcher collapses them to plain spaces. */
const plain = (text: string) => text.replace(/[  ]/g, ' ');

/** The list row that shows `text`; rows are toggle buttons (FirmwareRow). */
function rowOf(text: string): HTMLElement {
  const row = screen.getByText(text).closest('button');
  if (!row) throw new Error(`no row shows ${text}`);
  return row;
}

describe('HomeScreen', () => {
  type Props = ComponentProps<typeof HomeScreen>;

  function renderHome(overrides: Partial<Props> = {}): Props {
    const props: Props = {
      snapshot: SNAPSHOT,
      firmware: THERMOSTAT,
      family: 'esp32',
      target: TARGET,
      onprogram: vi.fn(),
      onchange: vi.fn(),
      ondetails: vi.fn(),
      onrefresh: vi.fn(),
      ...overrides,
    };
    render(HomeScreen, { props });
    return props;
  }

  it('shows the firmware, the detected family, the board and the estimate', () => {
    renderHome();
    expect(screen.getByRole('heading', { name: fr.firmware.label })).toBeInTheDocument();
    expect(screen.getByText('Thermostat')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: fr.families.label })).toBeInTheDocument();
    expect(screen.getByText(fr.families.detected)).toBeInTheDocument();
    expect(screen.getByText(fr.board.connected('ESP32-S3'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Programmer' })).toBeEnabled();
    const estimate = formatEstimate(estimateMs(THERMOSTAT_BYTES), fr);
    expect(screen.getByText(plain(fr.home.estimate(estimate)))).toBeInTheDocument();
  });

  it('keeps a detected family read-only', () => {
    renderHome({ onfamily: vi.fn() });
    const esp = screen.getByRole('button', { name: /Espressif/ });
    expect(esp).toHaveAttribute('aria-pressed', 'true');
    expect(esp).toBeDisabled();
    expect(screen.getByRole('button', { name: /Nordic/ })).toBeDisabled();
  });

  it('wires Programmer, Changer, Détails and the board refresh', async () => {
    const props = renderHome();
    await fireEvent.click(screen.getByRole('button', { name: 'Programmer' }));
    await fireEvent.click(screen.getByRole('button', { name: /Changer/ }));
    await fireEvent.click(screen.getByRole('button', { name: fr.firmware.details }));
    await fireEvent.click(screen.getByRole('button', { name: fr.board.refresh }));
    expect(props.onprogram).toHaveBeenCalledOnce();
    expect(props.onchange).toHaveBeenCalledOnce();
    expect(props.ondetails).toHaveBeenCalledOnce();
    expect(props.onrefresh).toHaveBeenCalledOnce();
  });

  it('lets the user correct a family confirmed on 03', async () => {
    const onfamily = vi.fn();
    renderHome({ firmware: HEX, family: 'stm32', target: STLINK, onfamily });
    expect(screen.queryByText(fr.families.detected)).toBeNull();
    expect(screen.getByRole('button', { name: /STMicroelectronics/ })).toHaveAttribute('aria-pressed', 'true');
    await fireEvent.click(screen.getByRole('button', { name: /Nordic/ }));
    expect(onfamily).toHaveBeenCalledWith('nrf');
  });
});

describe('ChooseChipScreen', () => {
  type Props = ComponentProps<typeof ChooseChipScreen>;

  function renderChoose(overrides: Partial<Props> = {}): Props {
    const props: Props = { snapshot: SNAPSHOT, firmware: HEX, onfamily: vi.fn(), onchange: vi.fn(), ...overrides };
    render(ChooseChipScreen, { props });
    return props;
  }

  it('asks for the family, explains the suggestion and waits for it', () => {
    renderChoose();
    expect(screen.getByText('firmware.hex')).toBeInTheDocument();
    expect(screen.getByText(fr.families.toChoose)).toBeInTheDocument();
    const stm = screen.getByRole('button', { name: /STMicroelectronics/ });
    expect(stm).toHaveAttribute('aria-pressed', 'false');
    expect(within(stm).getByText(fr.families.suggested)).toBeInTheDocument();
    expect(
      screen.getByText(fr.families.reason.startAddress('0x08000000', 'STM32')),
    ).toBeInTheDocument();
    expect(screen.getByText(fr.board.waitingFamily)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Programmer' })).toBeDisabled();
    expect(screen.getByText(fr.home.chooseFirst)).toBeInTheDocument();
  });

  it('words a suggestion that comes from the file name', () => {
    renderChoose({
      firmware: { ...HEX, family: { kind: 'suggested', family: 'nrf', reason: { kind: 'file-name' } } },
    });
    expect(screen.getByText(fr.families.reason.fileName('nRF'))).toBeInTheDocument();
  });

  it('reports the chosen family and the way to the list', async () => {
    const props = renderChoose();
    await fireEvent.click(screen.getByRole('button', { name: /STMicroelectronics/ }));
    await fireEvent.click(screen.getByRole('button', { name: /Changer/ }));
    expect(props.onfamily).toHaveBeenCalledWith('stm32');
    expect(props.onchange).toHaveBeenCalledOnce();
  });
});

describe('FirmwareListScreen', () => {
  type Props = ComponentProps<typeof FirmwareListScreen>;

  function renderList(overrides: Partial<Props> = {}): Props {
    const props: Props = {
      snapshot: SNAPSHOT,
      selectedId: THERMOSTAT.id,
      onselect: vi.fn(),
      onaddfolder: vi.fn(),
      onopenfile: vi.fn(),
      ...overrides,
    };
    render(FirmwareListScreen, { props });
    return props;
  }

  const filters = () => within(screen.getByRole('group', { name: fr.list.filtersLabel }));

  it('titles the list and groups the rows by folder', () => {
    renderList();
    expect(screen.getByRole('heading', { level: 1, name: fr.list.title })).toBeInTheDocument();
    expect(screen.getByText(fr.list.summary(4, 2))).toBeInTheDocument();
    expect(screen.getByText('C:\\Livraison')).toBeInTheDocument();
    expect(screen.getByText('D:\\Firmwares')).toBeInTheDocument();
    expect(rowOf('Thermostat')).toHaveAttribute('aria-pressed', 'true');
    expect(rowOf('Passerelle')).toHaveAttribute('aria-pressed', 'false');
  });

  it('counts each filter and narrows the rows', async () => {
    renderList();
    expect(filters().getByRole('button', { name: /Tous/ })).toHaveAttribute('aria-pressed', 'true');
    await fireEvent.click(filters().getByRole('button', { name: /nRF/ }));
    expect(filters().getByRole('button', { name: /nRF/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('capteur-porte')).toBeInTheDocument();
    expect(screen.queryByText('Thermostat')).toBeNull();
    // A folder with no visible row loses its header.
    expect(screen.queryByText('D:\\Firmwares')).toBeNull();
    await fireEvent.click(filters().getByRole('button', { name: new RegExp(fr.list.unidentified) }));
    expect(screen.getByText('firmware.hex')).toBeInTheDocument();
    expect(screen.queryByText('capteur-porte')).toBeNull();
  });

  it('searches, and says when nothing matches', async () => {
    renderList();
    const search = screen.getByRole('searchbox', { name: fr.list.searchLabel });
    await fireEvent.input(search, { target: { value: 'Passe' } });
    expect(screen.getByText('Passerelle')).toBeInTheDocument();
    expect(screen.queryByText('Thermostat')).toBeNull();
    await fireEvent.input(search, { target: { value: 'zzz' } });
    expect(screen.getByText(fr.list.empty)).toBeInTheDocument();
  });

  it('reports the picked row and the two folder actions', async () => {
    const props = renderList();
    await fireEvent.click(rowOf('Passerelle'));
    await fireEvent.click(screen.getByRole('button', { name: fr.list.addFolder }));
    await fireEvent.click(screen.getByRole('button', { name: fr.list.openFile }));
    expect(props.onselect).toHaveBeenCalledWith(PASSERELLE.id);
    expect(props.onaddfolder).toHaveBeenCalledOnce();
    expect(props.onopenfile).toHaveBeenCalledOnce();
  });
});
