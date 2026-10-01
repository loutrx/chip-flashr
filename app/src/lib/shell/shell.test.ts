import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n/index.svelte';
import ExpertPlaceholder from './ExpertPlaceholder.svelte';
import InstructionsPanel from './InstructionsPanel.svelte';
import SettingsView from './SettingsView.svelte';
import StatusBar from './StatusBar.svelte';
import TopBar from './TopBar.svelte';

afterEach(() => setLocale('fr'));

describe('TopBar', () => {
  const base = { tone: 'ok', mode: 'simple', onmode: vi.fn(), onsettings: vi.fn() } as const;

  it('shows the product, the board and the mode switch', () => {
    render(TopBar, { ...base, board: 'Carte simulée · ESP32-S3' });
    expect(screen.getByText('Chip Flashr')).toBeInTheDocument();
    expect(screen.getByText('Carte simulée · ESP32-S3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simple' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('says when no board is known', () => {
    render(TopBar, { ...base, board: null, tone: 'idle' });
    expect(screen.getByText('Aucune carte')).toBeInTheDocument();
  });

  it('reports the mode switch and the settings button', async () => {
    const onmode = vi.fn();
    const onsettings = vi.fn();
    render(TopBar, { ...base, board: null, onmode, onsettings });
    await fireEvent.click(screen.getByRole('button', { name: 'Expert' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Réglages' }));
    expect(onmode).toHaveBeenCalledWith('expert');
    expect(onsettings).toHaveBeenCalledOnce();
  });
});

describe('InstructionsPanel', () => {
  it('shows the sample instructions when open', async () => {
    const ontoggle = vi.fn();
    render(InstructionsPanel, { open: true, empty: false, ontoggle });
    const panel = screen.getByRole('complementary', { name: 'Instructions' });
    expect(panel).toHaveTextContent('Mise à jour du thermostat');
    expect(panel).toHaveTextContent('LISEZMOI.md');
    expect(panel).toHaveTextContent('Suivi en direct');
    expect(screen.getByText('J3 · PROG')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Masquer les instructions' }));
    expect(ontoggle).toHaveBeenCalledOnce();
  });

  it('says there are no instructions when the firmware has no README', async () => {
    const ontoggle = vi.fn();
    render(InstructionsPanel, { open: true, empty: true, ontoggle });
    const panel = screen.getByRole('complementary', { name: 'Instructions' });
    expect(screen.getByRole('heading', { name: 'Aucune instruction pour ce firmware' })).toBeInTheDocument();
    expect(panel).toHaveTextContent('à côté de l’application ou dans le zip');
    expect(panel).not.toHaveTextContent('Suivi en direct');
    expect(panel).not.toHaveTextContent('Mise à jour du thermostat');
    expect(screen.queryByText('LISEZMOI.md')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Masquer les instructions' }));
    expect(ontoggle).toHaveBeenCalledOnce();
  });

  it('folds into a rail when closed', async () => {
    const ontoggle = vi.fn();
    render(InstructionsPanel, { open: false, empty: false, ontoggle });
    expect(screen.getByRole('complementary', { name: 'Instructions masquées' })).toBeInTheDocument();
    expect(screen.queryByText('Mise à jour du thermostat')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Afficher les instructions' }));
    expect(ontoggle).toHaveBeenCalledOnce();
  });

  it('follows the UI language in the empty state', () => {
    setLocale('en');
    render(InstructionsPanel, { open: true, empty: true, ontoggle: vi.fn() });
    expect(screen.getByRole('heading', { name: 'No instructions for this firmware' })).toBeInTheDocument();
  });
});

describe('SettingsView', () => {
  const settings = { locale: 'fr', theme: 'system' } as const;

  it('shows the current language and theme', () => {
    render(SettingsView, { settings, version: '0.1.0', onchange: vi.fn(), onback: vi.fn() });
    expect(screen.getByRole('heading', { name: 'Réglages' })).toBeInTheDocument();
    expect((screen.getByRole('combobox', { name: 'Langue' }) as HTMLSelectElement).value).toBe('fr');
    expect((screen.getByRole('combobox', { name: 'Thème' }) as HTMLSelectElement).value).toBe('system');
    expect(screen.getByText('Chip Flashr v0.1.0 · Apache-2.0')).toBeInTheDocument();
  });

  it('reports a new choice and the way back', async () => {
    const onchange = vi.fn();
    const onback = vi.fn();
    render(SettingsView, { settings, version: null, onchange, onback });
    await fireEvent.change(screen.getByRole('combobox', { name: 'Thème' }), { target: { value: 'dark' } });
    expect(onchange).toHaveBeenCalledWith({ locale: 'fr', theme: 'dark' });
    await fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    expect(onback).toHaveBeenCalledOnce();
  });

  it('follows the UI language', () => {
    setLocale('en');
    render(SettingsView, { settings, version: null, onchange: vi.fn(), onback: vi.fn() });
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Same as system' })).toBeInTheDocument();
  });
});

describe('StatusBar', () => {
  it('shows the note and the version', () => {
    const { container } = render(StatusBar, { note: 'Surveillance : C:\\Livraison', version: '0.1.0' });
    expect(screen.getByText('Surveillance : C:\\Livraison')).toBeInTheDocument();
    expect(screen.getByText('v0.1.0')).toBeInTheDocument();
    expect(container.querySelector('.warning')).toBeNull();
  });

  it('shows a warning just before the version', () => {
    const warning = 'Scénario inconnu : demo';
    const { container } = render(StatusBar, { note: 'Simulation · scénario default', warning, version: '0.1.0' });
    const shown = container.querySelector('.warning') as HTMLElement;
    expect(shown).toHaveTextContent(warning);
    expect(shown.querySelector('[data-icon="warning"]')).not.toBeNull();
    expect(shown.nextElementSibling).toHaveTextContent('v0.1.0');
  });
});

describe('ExpertPlaceholder', () => {
  it('offers the way back to Simple mode', async () => {
    const onsimple = vi.fn();
    render(ExpertPlaceholder, { onsimple });
    expect(screen.getByRole('heading', { name: 'Mode Expert' })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Revenir au mode Simple' }));
    expect(onsimple).toHaveBeenCalledOnce();
  });
});
