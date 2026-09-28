import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.svelte';
import { setLocale } from './lib/i18n/index.svelte';
import type { Backend } from './lib/ipc';
import { createPreviewBackend, type PreviewOptions } from './lib/preview/previewBackend';
import { SETTINGS_KEY } from './lib/settings';

function preview(options: Partial<PreviewOptions> = {}): Backend {
  return createPreviewBackend({ chunkDelayMs: 15, failAtPercent: null, ...options });
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

const programButton = () => screen.getByRole('button', { name: 'Programmer' });

beforeEach(() => {
  vi.useFakeTimers();
  storeSettings({ locale: 'fr', theme: 'light' });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
  setLocale('fr');
  document.documentElement.removeAttribute('data-theme');
});

describe('App', () => {
  it('lists the three families and names the selected board', async () => {
    await renderApp();
    expect(screen.getByRole('button', { name: /Espressif/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Carte simulée · ESP32-S3')).toBeInTheDocument();
    expect(screen.getByText('v0.1.0')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: /STMicroelectronics/ }));
    expect(screen.getByText('Carte simulée · STM32F411')).toBeInTheDocument();
  });

  it('programs the board and shows the success hero', async () => {
    await renderApp();
    await fireEvent.click(programButton());
    await settle(100);
    expect(screen.getByText('Programmation en cours')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    await settle(10_000);
    expect(screen.getByRole('heading', { name: 'Programmation réussie' })).toBeInTheDocument();
    expect(screen.getByText('Conforme')).toBeInTheDocument();
  });

  it('announces the flash and moves focus to the result', async () => {
    await renderApp();
    const live = screen.getByRole('status');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live.textContent).toBe('');
    await fireEvent.click(programButton());
    await settle(100);
    expect(live).toHaveTextContent('Programmation en cours');
    await settle(10_000);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Programmation réussie' }));
    expect(live.textContent).toBe('');
  });

  it('stops the job on Annuler and never reports success', async () => {
    await renderApp();
    await fireEvent.click(programButton());
    await settle(200);
    await fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    await settle(10_000);
    expect(screen.getByRole('heading', { name: 'Programmation annulée' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Programmation réussie' })).toBeNull();
  });

  it('shows a lost board as a failure with its technical details', async () => {
    await renderApp(preview({ failAtPercent: 41 }));
    await fireEvent.click(programButton());
    await settle(10_000);
    expect(screen.getByRole('heading', { name: 'La programmation a échoué' })).toBeInTheDocument();
    expect(screen.getByText('device error: simulated disconnect')).toBeInTheDocument();
  });

  it('starts a single job when Programmer is pressed twice', async () => {
    const backend = preview();
    const flashDemo = vi.spyOn(backend, 'flashDemo');
    await renderApp(backend);
    const button = programButton();
    button.click();
    button.click();
    await settle(10_000);
    expect(flashDemo).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Programmation réussie' })).toBeInTheDocument();
  });

  it('folds the instructions into a rail in Expert mode and back', async () => {
    await renderApp();
    expect(screen.getByRole('button', { name: 'Masquer les instructions' })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Expert' }));
    expect(screen.getByRole('heading', { name: 'Mode Expert' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Afficher les instructions' })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Simple' }));
    expect(screen.getByRole('button', { name: 'Masquer les instructions' })).toBeInTheDocument();
  });

  it('keeps the instructions folded on a redundant mode click', async () => {
    await renderApp();
    await fireEvent.click(screen.getByRole('button', { name: 'Masquer les instructions' }));
    expect(screen.getByRole('button', { name: 'Afficher les instructions' })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Simple' }));
    expect(screen.getByRole('button', { name: 'Afficher les instructions' })).toBeInTheDocument();
  });

  it('keeps the flash running while settings are open', async () => {
    await renderApp();
    await fireEvent.click(programButton());
    await settle(100);
    await fireEvent.click(screen.getByRole('button', { name: 'Réglages' }));
    expect(screen.getByRole('heading', { name: 'Réglages' })).toBeInTheDocument();
    await settle(10_000);
    await fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    expect(screen.getByRole('heading', { name: 'Programmation réussie' })).toBeInTheDocument();
  });

  it('keeps the flash running in Expert mode and shows its result back in Simple', async () => {
    await renderApp();
    await fireEvent.click(programButton());
    await settle(100);
    await fireEvent.click(screen.getByRole('button', { name: 'Expert' }));
    expect(screen.getByRole('heading', { name: 'Mode Expert' })).toBeInTheDocument();
    await settle(10_000);
    await fireEvent.click(screen.getByRole('button', { name: 'Simple' }));
    expect(screen.getByRole('heading', { name: 'Programmation réussie' })).toBeInTheDocument();
  });

  it('switches to English at once and remembers it', async () => {
    await renderApp();
    await fireEvent.click(screen.getByRole('button', { name: 'Réglages' }));
    await fireEvent.change(screen.getByRole('combobox', { name: 'Langue' }), { target: { value: 'en' } });
    await settle();
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText('Simulated board · ESP32-S3')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')).toEqual({ locale: 'en', theme: 'light' });
    await fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('complementary', { name: 'Instructions' })).toHaveTextContent('Thermostat update');
  });

  it('hides the instructions panel while Réglages is open and restores it on Retour', async () => {
    await renderApp();
    expect(screen.getByRole('complementary')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Réglages' }));
    expect(screen.queryByRole('complementary')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });

  it('follows the system theme while running', async () => {
    storeSettings({ locale: 'fr', theme: 'system' });
    const setSystemDark = stubSystemDark(false);
    await renderApp();
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
    await renderApp();
    expect(screen.getByText('Simulated board · ESP32-S3')).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('explains when the boards cannot be listed', async () => {
    const backend: Backend = {
      ...preview(),
      listTargets: () => Promise.reject({ code: 'device-error', technical: 'USB enumeration failed' }),
    };
    await renderApp(backend);
    expect(screen.getByText(/Impossible de lister les cartes/)).toHaveTextContent('USB enumeration failed');
    expect(programButton()).toBeDisabled();
    for (const name of [/Espressif/, /STMicroelectronics/, /Nordic/]) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
  });
});
