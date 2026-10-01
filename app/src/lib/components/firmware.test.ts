import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { firmware, target, THERMOSTAT_IMAGES } from '../app/fixtures';
import type { ProvisionalId } from '../app/screen';
import { en } from '../i18n/en';
import { chipName, formatAddress, formatDate, formatSize, formatTime } from '../i18n/format';
import { fr } from '../i18n/fr';
import { setLocale } from '../i18n/index.svelte';
import ProvisionalScreen from '../screens/ProvisionalScreen.svelte';
import type { FirmwareSummary, Target } from '../types';
import BoardCard from './BoardCard.svelte';
import CauseList from './CauseList.svelte';
import FirmwareCard from './FirmwareCard.svelte';
import FirmwareStrip from './FirmwareStrip.svelte';
import ImageChip from './ImageChip.svelte';
import StatTile from './StatTile.svelte';
import StatusBubble from './StatusBubble.svelte';

afterEach(() => setLocale('fr'));

/** formatSize joins the number and the unit with a no-break space, which Testing Library's matcher folds into a plain one. */
const size = (bytes: number) => formatSize(bytes, 'fr', fr).replace(/[  ]/g, ' ');

/** The fixture's build date. */
const BUILT = '2026-09-12T14:32:00';

/** The fixture's Thermostat package, delivered as a zip in the app folder (screen 01). */
const thermostat: FirmwareSummary = firmware({
  path: 'C:\\Livraison\\thermostat_v1.4.2_esp32s3_prod.zip',
  fileName: 'thermostat_v1.4.2_esp32s3_prod.zip',
});
const APP_IMAGE = THERMOSTAT_IMAGES[3];

/** The lone hex of the ambiguous-hex scenario (screen 03): no metadata, a suggested family. */
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
  family: { kind: 'suggested', family: 'stm32', reason: { kind: 'start-address', address: 0x0800_0000 } },
  toolchain: null,
  builtAt: '2026-09-21T09:10:00',
  images: [{ address: 0x0800_0000, name: 'firmware.hex', size: 126_976 }],
  manifest: null,
  checks: [],
  readme: null,
});

/** The fixture's ESP32-S3 on COM4, USB-JTAG, 8 MiB of flash. */
const esp: Target = target();

describe('FirmwareCard', () => {
  const full = { firmware: thermostat, family: 'esp32', variant: 'full', available: 6 } as const;

  it('full: shows the name, the tags, the meta line and the file name', () => {
    render(FirmwareCard, { ...full, onchange: vi.fn() });
    expect(screen.getByText('ESP')).toBeInTheDocument();
    expect(screen.getByText('Thermostat')).toBeInTheDocument();
    expect(screen.getByText('v1.4.2')).toBeInTheDocument();
    expect(screen.getByText('prod')).toBeInTheDocument();
    const builtAt = fr.firmware.builtAt(formatDate(BUILT, 'fr'), formatTime(BUILT, 'fr'));
    expect(screen.getByText(`${chipName('esp32s3')} · ESP-IDF 5.3 · ${builtAt}`)).toBeInTheDocument();
    expect(screen.getByText('thermostat_v1.4.2_esp32s3_prod.zip')).toBeInTheDocument();
  });

  it('full: the change link counts the firmwares, and says only "change" when there is one', async () => {
    const onchange = vi.fn();
    const { rerender } = render(FirmwareCard, { ...full, onchange });
    await fireEvent.click(screen.getByRole('button', { name: fr.firmware.changeCount(6) }));
    expect(onchange).toHaveBeenCalledOnce();
    await rerender({ ...full, available: 1, onchange });
    expect(screen.getByRole('button', { name: fr.firmware.change })).toBeInTheDocument();
  });

  it('full: names the manifest, opens the details and draws one chip per image', async () => {
    const ondetails = vi.fn();
    render(FirmwareCard, { ...full, onchange: vi.fn(), ondetails });
    expect(screen.getByText(fr.firmware.manifest(4))).toBeInTheDocument();
    expect(screen.getByText('flasher_args.json')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: fr.firmware.details }));
    expect(ondetails).toHaveBeenCalledOnce();
    const chips = screen.getAllByRole('listitem');
    expect(chips).toHaveLength(4);
    expect(within(chips[3]).getByText(formatAddress(APP_IMAGE.address))).toBeInTheDocument();
    expect(within(chips[3]).getByText(APP_IMAGE.name)).toBeInTheDocument();
    expect(within(chips[3]).getByText(size(APP_IMAGE.size))).toBeInTheDocument();
  });

  it('minimal: file name, no-version tag, ranges and size, the whole path, no manifest', () => {
    render(FirmwareCard, { firmware: hex, family: null, variant: 'minimal', available: 1, onchange: vi.fn() });
    expect(screen.getByText('HEX')).toBeInTheDocument();
    expect(screen.getByText('firmware.hex')).toBeInTheDocument();
    expect(screen.getByText(fr.firmware.noVersion)).toBeInTheDocument();
    const meta = [fr.firmware.noVersionInfo, fr.firmware.ranges(1), size(126_976)].join(' · ');
    expect(screen.getByText(meta)).toBeInTheDocument();
    expect(screen.getByText('D:\\Firmwares\\firmware.hex')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('button', { name: fr.firmware.details })).toBeNull();
    expect(screen.getByRole('button', { name: fr.firmware.change })).toBeInTheDocument();
  });

  it('follows the language', () => {
    setLocale('en');
    render(FirmwareCard, { ...full, onchange: vi.fn(), ondetails: vi.fn() });
    expect(screen.getByRole('button', { name: en.firmware.changeCount(6) })).toBeInTheDocument();
    expect(screen.getByText(en.firmware.manifest(4))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.firmware.details })).toBeInTheDocument();
  });
});

describe('ImageChip', () => {
  it('shows the address, the file name and the size', () => {
    render(ImageChip, { image: { address: 0x8000, name: 'partition-table.bin', size: 3_072 } });
    expect(screen.getByText(formatAddress(0x8000))).toBeInTheDocument();
    expect(screen.getByText('partition-table.bin')).toBeInTheDocument();
    expect(screen.getByText(size(3_072))).toBeInTheDocument();
  });
});

describe('FirmwareStrip', () => {
  it('shows the tile, the name, the version and the detail, with a change link only when asked', async () => {
    const onchange = vi.fn();
    const { rerender } = render(FirmwareStrip, { firmware: thermostat, family: 'esp32', detail: 'ESP32-S3 · COM4' });
    expect(screen.getByText('ESP')).toBeInTheDocument();
    expect(screen.getByText('Thermostat')).toBeInTheDocument();
    expect(screen.getByText('v1.4.2')).toBeInTheDocument();
    expect(screen.getByText('ESP32-S3 · COM4')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    await rerender({ firmware: thermostat, family: 'esp32', detail: 'ESP32-S3', onchange });
    await fireEvent.click(screen.getByRole('button', { name: fr.firmware.change }));
    expect(onchange).toHaveBeenCalledOnce();
  });

  it('draws no version tag when the firmware has none', () => {
    const { container } = render(FirmwareStrip, {
      firmware: { ...thermostat, version: null },
      family: 'esp32',
      detail: 'ESP32-S3',
    });
    expect(container.querySelector('.tag')).toBeNull();
  });
});

describe('BoardCard', () => {
  it('connected: names the board, its port, link and flash, and refreshes on demand', async () => {
    const onrefresh = vi.fn();
    const { container } = render(BoardCard, { props: { state: 'connected', target: esp, onrefresh } });
    expect(screen.getByText(fr.board.connected('ESP32-S3'))).toBeInTheDocument();
    const flash = fr.board.flash(size(8 * 1024 * 1024));
    expect(screen.getByText(fr.board.connection('COM4', fr.board.link.usbJtag, flash))).toBeInTheDocument();
    expect(container.querySelector('.dot.ok.breathe')).not.toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: fr.board.refresh }));
    expect(onrefresh).toHaveBeenCalledOnce();
  });

  it('connected: words every kind of link, and leaves out an unknown flash size', async () => {
    const serial: Target = { ...esp, link: { kind: 'usb-serial', bridge: 'CP2102N' }, flashSize: null };
    const { unmount } = render(BoardCard, { props: { state: 'connected', target: serial } });
    expect(screen.getByText(fr.board.connection('COM4', fr.board.link.usbSerial('CP2102N'), null))).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    const probe: Target = { ...serial, port: 'SWD', link: { kind: 'probe', name: 'ST-Link V3' } };
    unmount();
    render(BoardCard, { props: { state: 'connected', target: probe } });
    expect(screen.getByText(fr.board.connection('SWD', fr.board.link.probe('ST-Link V3'), null))).toBeInTheDocument();
  });

  it('waiting: says it waits for the chip family, with an idle dot and no refresh', () => {
    const { container } = render(BoardCard, { props: { state: 'waiting', target: null, onrefresh: vi.fn() } });
    expect(screen.getByText(fr.board.waitingFamily)).toBeInTheDocument();
    expect(screen.getByText(fr.board.waitingFamilyNote)).toBeInTheDocument();
    expect(container.querySelector('.dot.idle')).not.toBeNull();
    expect(container.querySelector('.dot.breathe')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('StatusBubble', () => {
  it.each([
    ['ok', 'check'],
    ['error', 'x'],
    ['warning', 'warning'],
    ['active', 'refresh'],
  ] as const)('%s draws the %s mark and is named by its label', (status, icon) => {
    render(StatusBubble, { status, label: 'Étape' });
    const bubble = screen.getByRole('img', { name: 'Étape' });
    expect(bubble.querySelector(`svg[data-icon="${icon}"]`)).not.toBeNull();
  });

  it('pending is an empty ring', () => {
    render(StatusBubble, { status: 'pending', label: 'À venir' });
    const bubble = screen.getByRole('img', { name: 'À venir' });
    expect(bubble.querySelector('svg')).toBeNull();
    expect(bubble).toHaveClass('pending');
  });

  it('is 28 px by default and tinted at 26 px', async () => {
    const { rerender } = render(StatusBubble, { status: 'ok', label: 'OK' });
    const bubble = screen.getByRole('img', { name: 'OK' });
    expect(bubble.style.width).toBe('28px');
    expect(bubble).not.toHaveClass('tinted');
    await rerender({ status: 'ok', label: 'OK', size: 26 });
    expect(bubble.style.width).toBe('26px');
    expect(bubble).toHaveClass('tinted');
  });
});

describe('StatTile', () => {
  it('shows its label and its value', () => {
    render(StatTile, { label: 'Durée', value: '23 s' });
    expect(screen.getByText('Durée')).toBeInTheDocument();
    expect(screen.getByText('23 s')).toBeInTheDocument();
  });
});

describe('CauseList', () => {
  it('is a titled list of causes, each with its detail', () => {
    const causes = [
      { title: 'Le câble a bougé.', detail: 'Rebranchez-le fermement.' },
      { title: 'L’alimentation est insuffisante.', detail: 'Évitez les hubs USB non alimentés.' },
    ];
    render(CauseList, { title: 'Causes probables', causes });
    expect(screen.getByRole('heading', { level: 2, name: 'Causes probables' })).toBeInTheDocument();
    const items = within(screen.getByRole('list', { name: 'Causes probables' })).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[1]).getByText('L’alimentation est insuffisante.')).toBeInTheDocument();
    expect(within(items[1]).getByText('Évitez les hubs USB non alimentés.')).toBeInTheDocument();
  });
});

describe('ProvisionalScreen', () => {
  it('titles each problem screen and says it comes with plan 3b', () => {
    const ids: ProvisionalId[] = ['waiting-board', 'missing-driver', 'external-tool', 'no-firmware', 'incomplete'];
    for (const id of ids) {
      const { unmount } = render(ProvisionalScreen, { screen: id });
      expect(screen.getByRole('heading', { level: 1, name: fr.provisional.title[id] })).toBeInTheDocument();
      expect(screen.getByText(fr.provisional.body)).toBeInTheDocument();
      unmount();
    }
  });

  it('offers to change the firmware while the board or a package file is missing', async () => {
    for (const id of ['waiting-board', 'incomplete'] as const) {
      const onchange = vi.fn();
      const { unmount } = render(ProvisionalScreen, { screen: id, onchange, onrecheck: vi.fn() });
      await fireEvent.click(screen.getByRole('button', { name: fr.firmware.change }));
      expect(onchange, id).toHaveBeenCalledOnce();
      expect(screen.queryByRole('button', { name: fr.provisional.recheck })).toBeNull();
      unmount();
    }
  });

  it('checks again for a missing driver or tool', async () => {
    for (const id of ['missing-driver', 'external-tool'] as const) {
      const onrecheck = vi.fn();
      const { unmount } = render(ProvisionalScreen, { screen: id, onrecheck, onchange: vi.fn() });
      await fireEvent.click(screen.getByRole('button', { name: fr.provisional.recheck }));
      expect(onrecheck, id).toHaveBeenCalledOnce();
      expect(screen.queryByRole('button', { name: fr.firmware.change })).toBeNull();
      unmount();
    }
  });

  it('adds a folder or opens a file when no firmware was found', async () => {
    const onaddfolder = vi.fn();
    const onopenfile = vi.fn();
    render(ProvisionalScreen, { screen: 'no-firmware', onaddfolder, onopenfile, onchange: vi.fn(), onrecheck: vi.fn() });
    await fireEvent.click(screen.getByRole('button', { name: fr.list.addFolder }));
    await fireEvent.click(screen.getByRole('button', { name: fr.list.openFile }));
    expect(onaddfolder).toHaveBeenCalledOnce();
    expect(onopenfile).toHaveBeenCalledOnce();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('draws no button without a handler, and follows the language', () => {
    const { unmount } = render(ProvisionalScreen, { screen: 'missing-driver' });
    expect(screen.queryByRole('button')).toBeNull();
    unmount();
    setLocale('en');
    render(ProvisionalScreen, { screen: 'external-tool', onrecheck: vi.fn() });
    expect(screen.getByRole('button', { name: en.provisional.recheck })).toBeInTheDocument();
  });
});
