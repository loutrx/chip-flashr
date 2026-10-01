import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import Button from './Button.svelte';
import Callout from './Callout.svelte';
import Console from './Console.svelte';
import Icon from './Icon.svelte';
import IconButton from './IconButton.svelte';
import { ICONS, type IconName } from './icons';
import Pill from './Pill.svelte';
import ProgressBar from './ProgressBar.svelte';
import ResultHero from './ResultHero.svelte';
import Select from './Select.svelte';
import StatusDot from './StatusDot.svelte';
import Tag from './Tag.svelte';

const text = (content: string) => createRawSnippet(() => ({ render: () => `<span>${content}</span>` }));

describe('Icon', () => {
  it('draws every design icon, hidden from screen readers', () => {
    const names = Object.keys(ICONS) as IconName[];
    expect(names).toHaveLength(29);
    for (const name of names) {
      const { container, unmount } = render(Icon, { name });
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg?.children).toHaveLength(ICONS[name].length);
      unmount();
    }
  });
});

describe('Button', () => {
  it('calls onclick and is named by its label', async () => {
    const onclick = vi.fn();
    render(Button, { variant: 'primary', size: 'lg', icon: 'zap', onclick, children: text('Programmer') });
    await fireEvent.click(screen.getByRole('button', { name: 'Programmer' }));
    expect(onclick).toHaveBeenCalledOnce();
  });

  it('does nothing when disabled', async () => {
    const onclick = vi.fn();
    render(Button, { disabled: true, onclick, children: text('Programmer') });
    const button = screen.getByRole('button', { name: 'Programmer' });
    expect(button).toBeDisabled();
    await fireEvent.click(button);
    expect(onclick).not.toHaveBeenCalled();
  });
});

describe('IconButton', () => {
  it('is named by its label', async () => {
    const onclick = vi.fn();
    render(IconButton, { icon: 'sliders', label: 'Réglages', onclick });
    await fireEvent.click(screen.getByRole('button', { name: 'Réglages' }));
    expect(onclick).toHaveBeenCalledOnce();
  });
});

describe('StatusDot', () => {
  it('draws one dot per tone, busy included', () => {
    for (const tone of ['ok', 'warn', 'err', 'idle', 'busy'] as const) {
      const { container, unmount } = render(StatusDot, { tone });
      expect(container.querySelector(`.dot.${tone}`)).not.toBeNull();
      unmount();
    }
  });

  it('breathes only when asked', () => {
    const { container } = render(StatusDot, { tone: 'busy', breathe: true, size: 6 });
    const dot = container.querySelector('.dot') as HTMLElement;
    expect(dot).toHaveClass('breathe');
    expect(dot.style.width).toBe('6px');
  });
});

describe('Pill', () => {
  it('shows its text next to a status dot', () => {
    const { container } = render(Pill, { tone: 'ok', breathe: true, children: text('Carte simulée · ESP32-S3') });
    expect(screen.getByText('Carte simulée · ESP32-S3')).toBeInTheDocument();
    expect(container.querySelector('.dot.ok.breathe')).not.toBeNull();
  });

  it('shows the busy ink dot while programming', () => {
    const { container } = render(Pill, { tone: 'busy', breathe: true, children: text('ESP32-S3 · programmation…') });
    expect(screen.getByText('ESP32-S3 · programmation…')).toBeInTheDocument();
    expect(container.querySelector('.dot.busy.breathe')).not.toBeNull();
  });
});

describe('Tag', () => {
  it('is neutral by default', () => {
    const { container } = render(Tag, { children: text('prod') });
    expect(screen.getByText('prod')).toBeInTheDocument();
    expect(container.querySelector('.tag')).not.toHaveClass('warn');
  });

  it('takes the warn tone', () => {
    const { container } = render(Tag, { tone: 'warn', children: text('Suggéré') });
    expect(container.querySelector('.tag.warn')).toHaveTextContent('Suggéré');
  });
});

describe('Callout', () => {
  it('shows the icon of its tone', () => {
    const { container, unmount } = render(Callout, { tone: 'warning', children: text('Attention') });
    expect(container.querySelector('.callout.warning [data-icon="warning"]')).not.toBeNull();
    unmount();
    const info = render(Callout, { tone: 'info', children: text('Note') });
    expect(info.container.querySelector('.callout.info [data-icon="info"]')).not.toBeNull();
  });

  it('takes an icon independent of its tone', () => {
    const { container } = render(Callout, { tone: 'warning', icon: 'info', children: text('Confirmez') });
    expect(container.querySelector('.callout.warning [data-icon="info"]')).not.toBeNull();
    expect(container.querySelector('[data-icon="warning"]')).toBeNull();
    expect(screen.getByText('Confirmez')).toBeInTheDocument();
  });
});

describe('ProgressBar', () => {
  it('exposes a whole percentage clamped to 0–100', async () => {
    const { rerender } = render(ProgressBar, { value: 42.4, label: 'Progression' });
    const bar = screen.getByRole('progressbar', { name: 'Progression' });
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect((bar.firstElementChild as HTMLElement).style.width).toBe('42%');
    await rerender({ value: 150, label: 'Progression' });
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    await rerender({ value: -5, label: 'Progression' });
    expect(bar).toHaveAttribute('aria-valuenow', '0');
  });
});

describe('Select', () => {
  it('shows the current value and reports a new choice', async () => {
    const onchange = vi.fn();
    const options = [
      { value: 'fr', label: 'Français' },
      { value: 'en', label: 'English' },
    ];
    render(Select, { id: 'language', options, value: 'fr', onchange });
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('fr');
    await fireEvent.change(select, { target: { value: 'en' } });
    expect(onchange).toHaveBeenCalledWith('en');
  });
});

describe('Console', () => {
  it('prints one line per entry', () => {
    const { container } = render(Console, { lines: ['write block 212/512', 'error: timed out'] });
    expect(container.querySelectorAll('.console > div')).toHaveLength(2);
    expect(screen.getByText('error: timed out')).toBeInTheDocument();
  });
});

describe('ResultHero', () => {
  it('titles the result and explains it', () => {
    render(ResultHero, { tone: 'success', title: 'Programmation réussie', children: text('Vous pouvez débrancher.') });
    expect(screen.getByRole('heading', { level: 1, name: 'Programmation réussie' })).toBeInTheDocument();
    expect(screen.getByText('Vous pouvez débrancher.')).toBeInTheDocument();
  });
});
