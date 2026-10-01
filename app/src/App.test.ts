import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.svelte';
import { en } from './lib/i18n/en';
import { fr } from './lib/i18n/fr';
import { setLocale } from './lib/i18n/index.svelte';
import type { Backend } from './lib/ipc';
import { createPreviewBackend, type PreviewOptions } from './lib/preview/previewBackend';
import { SCENARIOS } from './lib/preview/scenarios';
import { SETTINGS_KEY } from './lib/settings';

/** Long enough for any scenario firmware at 15 ms per 4 KiB chunk. */
const FLASH_MS = 20_000;

function preview(options: Partial<PreviewOptions> = {}): Backend {
  return createPreviewBackend({ chunkDelayMs: 15, failAtPercent: null, scenario: null, ...options });
}

/** Run fake timers for `ms`, then let Svelte update the DOM. */
async function settle(ms = 0): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await tick();
}

async function renderApp(backend: Backend = preview()): Promise<void> {
  render(App, { backend });
  await settle();
}

function storeSettings(value: unknown): void {
  localStorage.setItem(SETTINGS_KEY, typeof value === 'string' ? value : JSON.stringify(value));
}

/** A controllable `prefers-color-scheme: dark` query (jsdom has no matchMedia). */
function stubSystemDark(initial: boolean): (dark: boolean) => void {
  type Listener = (event: MediaQueryListEvent) => void;
  const listeners = new Set<Listener>();
  const query = {
    matches: initial,
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
  };
  vi.stubGlobal('matchMedia', () => query);
  return (dark) => {
    query.matches = dark;
    for (const listener of listeners) listener({ matches: dark } as MediaQueryListEvent);
  };
}

/** jsdom has no clipboard. */
function stubClipboard() {
  const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return writeText;
}

/** The first timed transition of a scenario stage, in ms. */
function delayOf(scenario: string, stage = 0): number {
  for (const transition of SCENARIOS[scenario].stages[stage].next) {
    if (typeof transition.on === 'object') return transition.on.afterMs;
  }
  throw new Error(`${scenario} stage ${stage} has no timed transition`);
}

/** The Thermostat v1.4.2 row of screen 02 (the default scenario has two Thermostat versions). */
function thermostatRow(): HTMLElement {
  const row = screen.getAllByRole('button', { name: /Thermostat/ }).find((b) => b.textContent?.includes('1.4.2'));
  if (!row) throw new Error('no Thermostat 1.4.2 row');
  return row;
}

/** The text of the "Cartes cette session" stat tile. */
const sessionTile = () => screen.getByText(fr.success.sessionBoards).parentElement?.textContent ?? '';
const programButton = () => screen.getByRole('button', { name: 'Programmer' });
const successHeading = () => screen.getByRole('heading', { name: fr.success.title });

beforeEach(() => {
  vi.useFakeTimers();
  storeSettings({ locale: 'fr', theme: 'light' });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'clipboard');
  localStorage.clear();
  setLocale('fr');
  document.documentElement.removeAttribute('data-theme');
});

describe('App: scenarios', () => {
  it('default: picks a firmware in the list, programs two boards and counts them', async () => {
    await renderApp(preview({ scenario: 'default' }));
    expect(screen.getByRole('heading', { level: 1, name: fr.list.title })).toBeInTheDocument();
    // Hidden mode on 02.
    expect(screen.queryByRole('complementary')).toBeNull();

    await fireEvent.click(thermostatRow());
    expect(screen.getByText(fr.families.detected)).toBeInTheDocument();
    expect(screen.getByRole('complementary')).toBeInTheDocument();

    await fireEvent.click(programButton());
    await settle(100);
    expect(screen.getByText(fr.progress.title)).toBeInTheDocument();
    await settle(FLASH_MS);
    expect(successHeading()).toBeInTheDocument();
    expect(sessionTile()).toContain('1');

    await fireEvent.click(screen.getByRole('button', { name: fr.success.again }));
    // The board is still there, so the app is back on 01, never straight on 05.
    expect(programButton()).toBeEnabled();
    await fireEvent.click(programButton());
    await settle(FLASH_MS);
    expect(sessionTile()).toContain('2');
  });

  it('default: shows the watched folders in the status bar', async () => {
    await renderApp(preview({ scenario: 'default' }));
    const status = screen.getByRole('contentinfo');
    for (const folder of SCENARIOS.default.stages[0].snapshot.folders) {
      expect(status).toHaveTextContent(folder.path);
    }
    expect(status).toHaveTextContent(fr.status.appFolder);
  });

  it('single: opens straight on the home screen', async () => {
    await renderApp(preview({ scenario: 'single' }));
    expect(screen.getByText(fr.families.detected)).toBeInTheDocument();
    expect(programButton()).toBeEnabled();
  });

  it('ambiguous-hex: asks for the chip, waits for the probe, then is ready', async () => {
    await renderApp(preview({ scenario: 'ambiguous-hex' }));
    expect(screen.getByText(fr.families.toChoose)).toBeInTheDocument();
    expect(programButton()).toBeDisabled();
    await fireEvent.click(screen.getByRole('button', { name: /STMicroelectronics/ }));
    expect(screen.getByText(fr.provisional.title['waiting-board'])).toBeInTheDocument();
    await settle(delayOf('ambiguous-hex'));
    expect(programButton()).toBeEnabled();
    expect(screen.getByRole('button', { name: /STMicroelectronics/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('waiting-board: waits, then the board arrives on its own', async () => {
    await renderApp(preview({ scenario: 'waiting-board' }));
    expect(screen.getByText(fr.provisional.title['waiting-board'])).toBeInTheDocument();
    await settle(delayOf('waiting-board'));
    expect(programButton()).toBeEnabled();
  });

  it.each([
    ['driver-missing', 'missing-driver'],
    ['nordic-locked', 'external-tool'],
    ['incomplete', 'incomplete'],
    ['no-firmware', 'no-firmware'],
  ] as const)('%s: shows the provisional %s screen', async (scenario, id) => {
    await renderApp(preview({ scenario }));
    expect(screen.getByText(fr.provisional.title[id])).toBeInTheDocument();
  });

  it('no-firmware: hides the instructions panel', async () => {
    await renderApp(preview({ scenario: 'no-firmware' }));
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  // The provisional screens are not dead ends: each keeps the way out its plan-3b screen will have.
  it.each(['driver-missing', 'nordic-locked'] as const)('%s: Revérifier finds the board and opens 01', async (scenario) => {
    await renderApp(preview({ scenario }));
    await fireEvent.click(screen.getByRole('button', { name: fr.provisional.recheck }));
    await settle();
    expect(screen.getByText(fr.families.detected)).toBeInTheDocument();
    expect(programButton()).toBeEnabled();
  });

  it('no-firmware: a watched folder added brings its one firmware, and 01 opens', async () => {
    await renderApp(preview({ scenario: 'no-firmware' }));
    await fireEvent.click(screen.getByRole('button', { name: fr.list.addFolder }));
    await settle();
    expect(screen.getByText(fr.families.detected)).toBeInTheDocument();
    expect(programButton()).toBeEnabled();
  });

  it('default: a firmware whose board is not plugged waits for it, and Changer reopens the list', async () => {
    await renderApp(preview({ scenario: 'default' }));
    await fireEvent.click(screen.getByRole('button', { name: /Passerelle/ }));
    expect(screen.getByRole('heading', { level: 1, name: fr.provisional.title['waiting-board'] })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: fr.firmware.change }));
    expect(screen.getByRole('heading', { level: 1, name: fr.list.title })).toBeInTheDocument();
  });

  it('unknown scenario: falls back and says so in the status bar', async () => {
    await renderApp(preview({ scenario: 'nope' }));
    expect(screen.getByRole('heading', { level: 1, name: fr.list.title })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toHaveTextContent('nope');
  });
});

describe('App: the flash job', () => {
  it('shows a lost board at its step and percent, and retries the same job', async () => {
    const backend = preview({ scenario: 'single', failAtPercent: 41 });
    const flash = vi.spyOn(backend, 'flash');
    await renderApp(backend);
    await fireEvent.click(programButton());
    await settle(FLASH_MS);
    expect(screen.getByRole('heading', { name: fr.errors['device-error'].title })).toBeInTheDocument();
    // The percent is the last one emitted before the failure: 40 or 41.
    expect(screen.getByText(/à 4\d\s%/)).toBeInTheDocument();
    expect(screen.getByText('error: simulated disconnect')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: fr.failure.retry }));
    await settle(100);
    expect(screen.getByText(fr.progress.title)).toBeInTheDocument();
    expect(flash).toHaveBeenCalledTimes(2);
    expect(flash.mock.calls[1][0]).toEqual(flash.mock.calls[0][0]);
  });

  it('stops the job on Annuler, shows it as neutral and goes home', async () => {
    await renderApp(preview({ scenario: 'single' }));
    await fireEvent.click(programButton());
    await settle(200);
    await fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    await settle(FLASH_MS);
    expect(screen.getByRole('heading', { name: fr.errors.cancelled.title })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: fr.success.title })).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: fr.failure.home }));
    expect(programButton()).toBeEnabled();
  });

  it('starts a single job when Programmer is pressed twice', async () => {
    const backend = preview({ scenario: 'single' });
    const flash = vi.spyOn(backend, 'flash');
    await renderApp(backend);
    const button = programButton();
    button.click();
    button.click();
    await settle(FLASH_MS);
    expect(flash).toHaveBeenCalledTimes(1);
    expect(successHeading()).toBeInTheDocument();
  });

  it('announces the flash and moves focus to the result', async () => {
    await renderApp(preview({ scenario: 'single' }));
    const live = screen.getByRole('status');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live.textContent).toBe('');
    await fireEvent.click(programButton());
    await settle(100);
    expect(live).toHaveTextContent(fr.progress.title);
    await settle(FLASH_MS);
    expect(document.activeElement).toBe(successHeading());
    expect(live.textContent).toBe('');
  });

  it('copies a report with no folder path, and says Copié for 2 s', async () => {
    const writeText = stubClipboard();
    await renderApp(preview({ scenario: 'default' }));
    await fireEvent.click(thermostatRow());
    await fireEvent.click(programButton());
    await settle(FLASH_MS);
    await fireEvent.click(screen.getByRole('button', { name: fr.success.report }));
    await settle();
    expect(writeText).toHaveBeenCalledOnce();
    const report = writeText.mock.calls[0][0];
    expect(report).toContain('Thermostat');
    for (const folder of SCENARIOS.default.stages[0].snapshot.folders) expect(report).not.toContain(folder.path);
    expect(screen.getByRole('button', { name: fr.success.copied })).toBeInTheDocument();
    await settle(2_000);
    expect(screen.getByRole('button', { name: fr.success.report })).toBeInTheDocument();
  });

  it('keeps the flash running while settings are open', async () => {
    await renderApp(preview({ scenario: 'single' }));
    await fireEvent.click(programButton());
    await settle(100);
    await fireEvent.click(screen.getByRole('button', { name: 'Réglages' }));
    expect(screen.getByRole('heading', { name: 'Réglages' })).toBeInTheDocument();
    await settle(FLASH_MS);
    await fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    expect(successHeading()).toBeInTheDocument();
  });

  it('keeps the flash running in Expert mode and shows its result back in Simple', async () => {
    await renderApp(preview({ scenario: 'single' }));
    await fireEvent.click(programButton());
    await settle(100);
    await fireEvent.click(screen.getByRole('button', { name: 'Expert' }));
    expect(screen.getByRole('heading', { name: 'Mode Expert' })).toBeInTheDocument();
    await settle(FLASH_MS);
    await fireEvent.click(screen.getByRole('button', { name: 'Simple' }));
    expect(successHeading()).toBeInTheDocument();
  });
});

describe('App: shell', () => {
  it('opens Expert mode from Détails', async () => {
    await renderApp(preview({ scenario: 'single' }));
    await fireEvent.click(screen.getByRole('button', { name: fr.firmware.details }));
    expect(screen.getByRole('heading', { name: 'Mode Expert' })).toBeInTheDocument();
  });

  it('shows the empty instructions state when the firmware has no README', async () => {
    await renderApp(preview({ scenario: 'single' }));
    const firmware = SCENARIOS.single.stages[0].snapshot.firmwares[0];
    expect(screen.queryByText(fr.instructions.empty.title) !== null).toBe(firmware.readme === null);
  });

  it('folds the instructions into a rail in Expert mode and back', async () => {
    await renderApp(preview({ scenario: 'single' }));
    expect(screen.getByRole('button', { name: 'Masquer les instructions' })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Expert' }));
    expect(screen.getByRole('heading', { name: 'Mode Expert' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Afficher les instructions' })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Simple' }));
    expect(screen.getByRole('button', { name: 'Masquer les instructions' })).toBeInTheDocument();
  });

  it('keeps the instructions folded on a redundant mode click', async () => {
    await renderApp(preview({ scenario: 'single' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Masquer les instructions' }));
    expect(screen.getByRole('button', { name: 'Afficher les instructions' })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Simple' }));
    expect(screen.getByRole('button', { name: 'Afficher les instructions' })).toBeInTheDocument();
  });

  it('hides the instructions panel while Réglages is open and restores it on Retour', async () => {
    await renderApp(preview({ scenario: 'single' }));
    expect(screen.getByRole('complementary')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Réglages' }));
    expect(screen.queryByRole('complementary')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });

  it('switches to English at once and remembers it', async () => {
    await renderApp(preview({ scenario: 'single' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Réglages' }));
    await fireEvent.change(screen.getByRole('combobox', { name: 'Langue' }), { target: { value: 'en' } });
    await settle();
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')).toEqual({ locale: 'en', theme: 'light' });
    await fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: en.home.program })).toBeInTheDocument();
  });

  it('shows no French on the English home screen', async () => {
    storeSettings({ locale: 'en', theme: 'light' });
    await renderApp(preview({ scenario: 'single' }));
    expect(screen.getByRole('button', { name: en.home.program })).toBeInTheDocument();
    expect(screen.getByText(en.families.detected)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(
      /Programmer|Détecté|connectée|Firmware à programmer|Type de puce|Environ|Surveillance|dossier de l’application/,
    );
  });

  it('follows the system theme while running', async () => {
    storeSettings({ locale: 'fr', theme: 'system' });
    const setSystemDark = stubSystemDark(false);
    await renderApp(preview({ scenario: 'single' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    setSystemDark(true);
    await settle();
    expect(document.documentElement.dataset.theme).toBe('dark');
    await fireEvent.click(screen.getByRole('button', { name: 'Réglages' }));
    await fireEvent.change(screen.getByRole('combobox', { name: 'Thème' }), { target: { value: 'light' } });
    await settle();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('starts with defaults when the stored settings are broken', async () => {
    // jsdom reports navigator.languages = ['en-US'], so the defaults are English and "system".
    storeSettings('{not json');
    await renderApp(preview({ scenario: 'single' }));
    expect(screen.getByRole('button', { name: en.home.program })).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
