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
    render(InstructionsPanel, { open: true, ontoggle });
    expect(screen.getByRole('complementary', { name: 'Instructions' })).toHaveTextContent('Mise à jour du thermostat');
    expect(screen.getByText('J3 · PROG')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Masquer les instructions' }));
    expect(ontoggle).toHaveBeenCalledOnce();
  });

  it('folds into a rail when closed', async () => {
    const ontoggle = vi.fn();
    render(InstructionsPanel, { open: false, ontoggle });
    expect(screen.getByRole('complementary', { name: 'Instructions masquées' })).toBeInTheDocument();
    expect(screen.queryByText('Mise à jour du thermostat')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Afficher les instructions' }));
    expect(ontoggle).toHaveBeenCalledOnce();
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
    render(StatusBar, { note: 'Démo · carte simulée', version: '0.1.0' });
    expect(screen.getByText('Démo · carte simulée')).toBeInTheDocument();
    expect(screen.getByText('v0.1.0')).toBeInTheDocument();
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
