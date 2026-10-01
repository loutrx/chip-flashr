import { render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { Step, StepKind, StepStatus } from '../flashState';
import { en } from '../i18n/en';
import { formatAddress, formatDuration } from '../i18n/format';
import { fr } from '../i18n/fr';
import { setLocale } from '../i18n/index.svelte';
import type { ImageEntry } from '../types';
import StepList from './StepList.svelte';

afterEach(() => setLocale('fr'));

const bootloader: ImageEntry = { address: 0x0, name: 'bootloader.bin', size: 21_504 };
const app: ImageEntry = { address: 0x10000, name: 'thermostat.bin', size: 1_153_434 };

function step(kind: StepKind, status: StepStatus, extra: Partial<Step> = {}): Step {
  return { kind, image: null, index: null, count: null, status, startedAt: null, durationMs: null, ...extra };
}

// The formatters put U+00A0 before units; the DOM matcher normalises it to a plain space.
const plain = (text: string): string => text.replace(/ /g, ' ');

const steps: Step[] = [
  step('connecting', 'done', { startedAt: 0, durationMs: 800 }),
  step('erasing', 'done', { startedAt: 800, durationMs: 2_100 }),
  step('writing', 'done', { image: bootloader, index: 0, count: 2, startedAt: 2_900, durationMs: 1_500 }),
  step('writing', 'active', { image: app, index: 1, count: 2, startedAt: 4_400 }),
  step('verifying', 'pending'),
  step('resetting', 'pending'),
];

describe('StepList', () => {
  it('lists every step in order, each with a named status bubble', () => {
    render(StepList, { props: { steps, current: null } });
    const list = screen.getByRole('list', { name: fr.progress.stepsLabel });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(6);
    expect(within(items[0]).getByText(fr.steps.connecting)).toBeInTheDocument();
    expect(within(items[2]).getByText(fr.steps.writing(1, 2, 'bootloader.bin'))).toBeInTheDocument();
    expect(within(items[3]).getByText(fr.steps.writing(2, 2, 'thermostat.bin'))).toBeInTheDocument();
    expect(within(items[5]).getByText(fr.steps.resetting)).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: fr.steps.done })).toHaveLength(3);
    expect(within(items[3]).getByRole('img', { name: fr.steps.active })).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: fr.steps.pending })).toHaveLength(2);
  });

  it('shows the duration of done steps and the address of the active write', () => {
    const { container } = render(StepList, { props: { steps, current: null } });
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByText(plain(formatDuration(800, 'fr')))).toBeInTheDocument();
    expect(within(items[1]).getByText(plain(formatDuration(2_100, 'fr')))).toBeInTheDocument();
    expect(within(items[3]).getByText(formatAddress(0x10000))).toBeInTheDocument();
    const metas = container.querySelectorAll('.meta');
    expect(metas[4].textContent).toBe('');
    expect(metas[5].textContent).toBe('');
  });

  it('draws the per-file bar under the image being written', () => {
    render(StepList, { props: { steps, current: { index: 1, percent: 48 } } });
    const bars = screen.getAllByRole('progressbar');
    expect(bars).toHaveLength(1);
    const bar = screen.getByRole('progressbar', { name: fr.progress.fileBarLabel('thermostat.bin') });
    expect(bar).toHaveAttribute('aria-valuenow', '48');
    expect(within(screen.getAllByRole('listitem')[3]).getByRole('progressbar')).toBe(bar);
  });

  it('draws no per-file bar without a current image, or for another image', async () => {
    const { rerender } = render(StepList, { props: { steps, current: null } });
    expect(screen.queryByRole('progressbar')).toBeNull();
    await rerender({ steps, current: { index: 0, percent: 100 } });
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('marks the active and pending rows', () => {
    render(StepList, { props: { steps, current: null } });
    const items = screen.getAllByRole('listitem');
    expect(items[3]).toHaveClass('active');
    expect(items[4]).toHaveClass('pending');
    expect(items[0]).toHaveClass('done');
  });

  it('follows the language', () => {
    setLocale('en');
    render(StepList, { props: { steps, current: { index: 1, percent: 48 } } });
    expect(screen.getByRole('list', { name: en.progress.stepsLabel })).toBeInTheDocument();
    expect(screen.getByText(en.steps.verifying)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: en.progress.fileBarLabel('thermostat.bin') })).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: en.steps.done })).toHaveLength(3);
  });
});
