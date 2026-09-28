import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n/index.svelte';
import FamilySelector from './FamilySelector.svelte';
import SegmentedControl from './SegmentedControl.svelte';

afterEach(() => setLocale('fr'));

describe('SegmentedControl', () => {
  const options = [
    { value: 'simple', label: 'Simple' },
    { value: 'expert', label: 'Expert' },
  ] as const;

  it('marks the current option as pressed', () => {
    render(SegmentedControl, { label: 'Mode d’affichage', options, value: 'simple', onchange: vi.fn() });
    expect(screen.getByRole('group', { name: 'Mode d’affichage' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simple' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Expert' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the option the user picks', async () => {
    const onchange = vi.fn();
    render(SegmentedControl, { label: 'Mode', options, value: 'simple', onchange });
    await fireEvent.click(screen.getByRole('button', { name: 'Expert' }));
    expect(onchange).toHaveBeenCalledWith('expert');
  });
});

describe('FamilySelector', () => {
  it('shows the three families with their description', () => {
    render(FamilySelector, { value: 'esp32', onchange: vi.fn() });
    expect(screen.getByRole('group', { name: 'Type de puce' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.getByText('STMicroelectronics · sonde ou USB')).toBeInTheDocument();
  });

  it('shows the selected family pressed in, with a check', () => {
    const { container } = render(FamilySelector, { value: 'esp32', onchange: vi.fn() });
    expect(screen.getByRole('button', { name: /Espressif/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Nordic/ })).toHaveAttribute('aria-pressed', 'false');
    expect(container.querySelectorAll('[data-icon="check"]')).toHaveLength(1);
  });

  it('reports the family the user picks', async () => {
    const onchange = vi.fn();
    render(FamilySelector, { value: 'esp32', onchange });
    await fireEvent.click(screen.getByRole('button', { name: /STMicroelectronics/ }));
    expect(onchange).toHaveBeenCalledWith('stm32');
  });

  it('selects nothing when no family is known yet, and can be disabled', () => {
    render(FamilySelector, { value: null, disabled: true, onchange: vi.fn() });
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAttribute('aria-pressed', 'false');
      expect(button).toBeDisabled();
    }
  });

  it('follows the UI language', () => {
    setLocale('en');
    render(FamilySelector, { value: 'nrf', onchange: vi.fn() });
    expect(screen.getByRole('group', { name: 'Chip type' })).toBeInTheDocument();
    expect(screen.getByText('Nordic · nRF51 to nRF91')).toBeInTheDocument();
  });
});
