import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { tick, type ComponentProps } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { firmware, snapshot, target, THERMOSTAT_IMAGES } from '../app/fixtures';
import { estimateMs, flashReducer, type FlashAction, type FlashState } from '../flashState';
import { formatDuration, formatEstimate, formatPercent, formatVersion } from '../i18n/format';
import { fr } from '../i18n/fr';
import type {
  FirmwareSummary,
  FlashReport,
  FlashRequest,
  Phase,
  Snapshot,
  Target,
  UserFacingError,
} from '../types';
import ChooseChipScreen from './ChooseChipScreen.svelte';
import FailureScreen from './FailureScreen.svelte';
import FirmwareListScreen from './FirmwareListScreen.svelte';
import HomeScreen from './HomeScreen.svelte';
import ProgrammingScreen from './ProgrammingScreen.svelte';
import SuccessScreen from './SuccessScreen.svelte';

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

const REQUEST: FlashRequest = { firmwareId: THERMOSTAT.id, targetId: TARGET.id, family: null };
const WRITING: Phase = { kind: 'writing', index: 3, count: 4, label: 'thermostat.bin', address: 0x10000 };

/** Runs `actions` through the real reducer, so the fixtures have the steps the app would have. */
function jobAfter<S extends FlashState['status']>(status: S, actions: FlashAction[]): Extract<FlashState, { status: S }> {
  const state = actions.reduce(flashReducer, { status: 'idle' } as FlashState);
  if (state.status !== status) throw new Error(`expected a ${status} job, got ${state.status}`);
  return state as Extract<FlashState, { status: S }>;
}

const progressTo = (phase: Phase, share: number, at: number): FlashAction => ({
  type: 'progress',
  event: { phase, bytesDone: Math.round(THERMOSTAT_BYTES * share), bytesTotal: THERMOSTAT_BYTES },
  at,
});

/** Writing thermostat.bin at 62 %, as on the `Flash` artifact page. */
const RUNNING: FlashAction[] = [
  { type: 'start', request: REQUEST, images: [...THERMOSTAT_IMAGES], at: 0 },
  progressTo({ kind: 'connecting' }, 0, 0),
  progressTo({ kind: 'erasing' }, 0, 800),
  progressTo(WRITING, 0.4, 2_900),
  progressTo(WRITING, 0.62, 4_400),
];

const REPORT: FlashReport = {
  bytesWritten: THERMOSTAT_BYTES,
  durationMs: 23_000,
  verified: true,
  log: ['connect ESP32-S3', 'verify ok', 'reset'],
};

const LOST: UserFacingError = {
  code: 'device-error',
  technical: 'write block 212/512 @ 0x0003A000\nerror: timed out waiting for response (3000 ms)',
  phase: WRITING,
  percent: 41,
};

afterEach(() => {
  vi.useRealTimers();
});

/** Matches an element's own text after `plain` normalisation. */
const byPlainText = (text: string) => (content: string) => plain(content) === plain(text);

describe('ProgrammingScreen', () => {
  type Props = ComponentProps<typeof ProgrammingScreen>;

  function renderProgramming(overrides: Partial<Props> = {}): Props {
    const props: Props = {
      firmware: THERMOSTAT,
      target: TARGET,
      job: jobAfter('flashing', RUNNING),
      oncancel: vi.fn(),
      ...overrides,
    };
    render(ProgrammingScreen, { props });
    return props;
  }

  it('shows the board, the percent, the bar and the steps', () => {
    const props = renderProgramming();
    expect(screen.getByText('Thermostat')).toBeInTheDocument();
    expect(screen.getByText(fr.pill.board('ESP32-S3', 'COM4'))).toBeInTheDocument();
    expect(screen.getByText(fr.progress.title)).toBeInTheDocument();
    expect(screen.getByText(byPlainText(formatPercent(props.job.percent, 'fr')))).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: fr.progress.barLabel })).toBeInTheDocument();
    expect(screen.getByText(fr.steps.connecting)).toBeInTheDocument();
    expect(screen.getByText(fr.steps.verifying)).toBeInTheDocument();
    expect(screen.getByText(fr.progress.keepPlugged)).toBeInTheDocument();
  });

  it('shows the remaining time only once the job has one', () => {
    const job = jobAfter('flashing', RUNNING);
    const { unmount } = render(ProgrammingScreen, {
      props: { firmware: THERMOSTAT, target: TARGET, job: { ...job, remainingMs: 8_200 }, oncancel: vi.fn() },
    });
    const remaining = fr.progress.remaining(formatDuration(8_200, 'fr'));
    expect(screen.getByText(byPlainText(remaining))).toBeInTheDocument();
    unmount();
    renderProgramming({ job: { ...job, remainingMs: null } });
    expect(screen.queryByText(byPlainText(remaining))).toBeNull();
  });

  it('cancels from the button at the bottom', async () => {
    const props = renderProgramming();
    await fireEvent.click(screen.getByRole('button', { name: fr.progress.cancel }));
    expect(props.oncancel).toHaveBeenCalledOnce();
  });
});

describe('SuccessScreen', () => {
  type Props = ComponentProps<typeof SuccessScreen>;

  function renderSuccess(overrides: Partial<Props> = {}): Props {
    const props: Props = {
      firmware: THERMOSTAT,
      target: TARGET,
      job: jobAfter('success', [...RUNNING, { type: 'success', report: REPORT, at: 23_000 }]),
      boardsThisSession: 3,
      onagain: vi.fn(),
      onreport: vi.fn(async () => undefined),
      onhome: vi.fn(),
      ...overrides,
    };
    render(SuccessScreen, { props });
    return props;
  }

  /** The value shown in the stat tile labelled `label` (StatTile renders label and value side by side). */
  const tileOf = (label: string) => screen.getByText(label).parentElement;

  it('names the firmware, the chip and the port, with the three stats', () => {
    renderSuccess();
    expect(screen.getByRole('heading', { name: fr.success.title })).toBeInTheDocument();
    const body = fr.success.body(`Thermostat ${formatVersion('1.4.2')}`, 'ESP32-S3', 'COM4');
    expect(screen.getByText(byPlainText(body))).toBeInTheDocument();
    expect(tileOf(fr.success.verification)).toHaveTextContent(fr.success.verified);
    expect(tileOf(fr.success.duration)).toHaveTextContent(plain(formatDuration(23_000, 'fr')));
    expect(tileOf(fr.success.sessionBoards)).toHaveTextContent('3');
  });

  it('offers another board and the way home', async () => {
    const props = renderSuccess();
    await fireEvent.click(screen.getByRole('button', { name: fr.success.again }));
    await fireEvent.click(screen.getByRole('button', { name: fr.success.home }));
    expect(props.onagain).toHaveBeenCalledOnce();
    expect(props.onhome).toHaveBeenCalledOnce();
  });

  it('says "Copié" for two seconds once the report is copied', async () => {
    vi.useFakeTimers();
    const props = renderSuccess();
    await fireEvent.click(screen.getByRole('button', { name: fr.success.report }));
    await vi.advanceTimersByTimeAsync(0);
    await tick();
    expect(props.onreport).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: fr.success.copied })).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(2_000);
    await tick();
    expect(screen.getByRole('button', { name: fr.success.report })).toBeInTheDocument();
  });

  it('never claims a copy the clipboard refused', async () => {
    renderSuccess({ onreport: vi.fn(() => Promise.reject(new Error('denied'))) });
    await fireEvent.click(screen.getByRole('button', { name: fr.success.report }));
    await tick();
    expect(screen.queryByRole('button', { name: fr.success.copied })).toBeNull();
  });
});

describe('FailureScreen', () => {
  type Props = ComponentProps<typeof FailureScreen>;

  function failed(error: UserFacingError) {
    return jobAfter('failure', [...RUNNING, { type: 'failure', error, at: 5_000 }]);
  }

  function renderFailure(overrides: Partial<Props> = {}): Props {
    const props: Props = {
      firmware: THERMOSTAT,
      job: failed(LOST),
      onretry: vi.fn(),
      onexport: vi.fn(async () => undefined),
      onhome: vi.fn(),
      ...overrides,
    };
    render(FailureScreen, { props });
    return props;
  }

  it('says where it stopped, the probable causes and the technical lines', () => {
    const { container } = render(FailureScreen, {
      props: { firmware: THERMOSTAT, job: failed(LOST), onretry: vi.fn(), onexport: vi.fn(), onhome: vi.fn() },
    });
    const text = fr.errors['device-error'];
    expect(screen.getByRole('heading', { name: text.title })).toBeInTheDocument();
    const at = fr.failure.at(fr.failure.stepNoun.writing, formatPercent(41, 'fr'));
    expect(screen.getByText(byPlainText(text.explanation(at)))).toBeInTheDocument();
    expect(text.causes.length).toBeGreaterThan(0);
    expect(screen.getByText(fr.failure.causesTitle)).toBeInTheDocument();
    for (const cause of text.causes) expect(screen.getByText(cause.title)).toBeInTheDocument();
    expect(container.querySelector('details')).toHaveAttribute('open');
    expect(screen.getByText(fr.failure.details)).toBeInTheDocument();
    expect(screen.getByText('write block 212/512 @ 0x0003A000')).toBeInTheDocument();
    expect(screen.getByText('error: timed out waiting for response (3000 ms)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: fr.failure.home })).toBeInTheDocument();
  });

  it('explains without a step when the error has no phase', () => {
    renderFailure({ job: failed({ ...LOST, phase: null, percent: null }) });
    expect(screen.getByText(fr.errors['device-error'].explanation(null))).toBeInTheDocument();
  });

  it('retries, and exports the report with the same "Copié" feedback', async () => {
    vi.useFakeTimers();
    const props = renderFailure();
    await fireEvent.click(screen.getByRole('button', { name: fr.failure.retry }));
    expect(props.onretry).toHaveBeenCalledOnce();
    await fireEvent.click(screen.getByRole('button', { name: fr.failure.export }));
    await vi.advanceTimersByTimeAsync(0);
    await tick();
    expect(props.onexport).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: fr.failure.copied })).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(2_000);
    await tick();
    expect(screen.getByRole('button', { name: fr.failure.export })).toBeInTheDocument();
  });

  it('shows a cancel as neutral, and goes home from any failure', async () => {
    const props = renderFailure({
      job: failed({ code: 'cancelled', technical: 'cancelled by the user', phase: WRITING, percent: 30 }),
    });
    const text = fr.errors.cancelled;
    expect(screen.getByRole('heading', { name: text.title })).toBeInTheDocument();
    expect(screen.queryByText(fr.failure.causesTitle) !== null).toBe(text.causes.length > 0);
    await fireEvent.click(screen.getByRole('button', { name: fr.failure.home }));
    expect(props.onhome).toHaveBeenCalledOnce();
  });
});
