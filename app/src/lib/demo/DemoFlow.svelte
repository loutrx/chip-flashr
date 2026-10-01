<script lang="ts">
  import Button from '../components/Button.svelte';
  import Callout from '../components/Callout.svelte';
  import Card from '../components/Card.svelte';
  import Console from '../components/Console.svelte';
  import FamilySelector from '../components/FamilySelector.svelte';
  import Icon from '../components/Icon.svelte';
  import ProgressBar from '../components/ProgressBar.svelte';
  import ResultHero from '../components/ResultHero.svelte';
  import SectionLabel from '../components/SectionLabel.svelte';
  import StatusDot from '../components/StatusDot.svelte';
  import type { FlashState } from '../flashState';
  import { formatKib, formatPercent, formatSeconds, phaseLabel } from '../i18n/format';
  import { locale, t } from '../i18n/index.svelte';
  import { boardName } from '../targets';
  import type { Family, Target, UserFacingError } from '../types';

  let {
    selected,
    flash,
    startupError,
    onfamily,
    onprogram,
    oncancel,
    onreset,
  }: {
    selected: Target | null;
    flash: FlashState;
    startupError: UserFacingError | null;
    onfamily: (family: Family) => void;
    onprogram: () => void;
    oncancel: () => void;
    onreset: () => void;
  } = $props();

  const m = $derived(t());
  const board = $derived(selected ? boardName(selected, m) : '');
</script>

<!-- Persistent, so its text change is announced. The result hero takes the focus instead. -->
<div class="visually-hidden" role="status" aria-live="polite">
  {#if flash.status === 'flashing'}{m.progress.title}. {m.progress.keepPlugged}{/if}
</div>

{#if flash.status === 'flashing'}
  <Card padding={24} gap={20}>
    <div class="progress-title">
      <span class="progress-label">{m.progress.title}</span>
      <span class="percent">{formatPercent(flash.percent, locale())}</span>
    </div>
    <ProgressBar value={flash.percent} label={m.progress.barLabel} />
    <div class="progress-foot">
      <span class="phase">{phaseLabel(flash.phase, m)}</span>
      <Button icon="x" onclick={oncancel}>{m.progress.cancel}</Button>
    </div>
  </Card>
  <Callout>{m.progress.keepPlugged}</Callout>
{:else if flash.status === 'success'}
  <ResultHero tone="success" title={m.success.title}>
    {m.success.body(board, selected?.label ?? '', selected?.port ?? '')}
  </ResultHero>
  <div class="stats">
    <div class="stat">
      <span class="stat-label">{m.success.verification}</span>
      <span class="stat-value">{flash.report.verified ? m.success.verified : m.success.notVerified}</span>
    </div>
    <div class="stat">
      <span class="stat-label">{m.success.duration}</span>
      <span class="stat-value">{formatSeconds(flash.report.durationMs, locale())}</span>
    </div>
    <div class="stat">
      <span class="stat-label">{m.success.size}</span>
      <span class="stat-value">{formatKib(flash.report.bytesWritten, locale(), m)}</span>
    </div>
  </div>
  <div class="grow"></div>
  <div class="actions">
    <Button variant="primary" size="lg" wide icon="refresh" onclick={onprogram}>{m.success.again}</Button>
    <div class="more"><Button variant="ghost" icon="chevronLeft" onclick={onreset}>{m.success.home}</Button></div>
  </div>
{:else if flash.status === 'failure'}
  {@const error = m.errors[flash.error.code]}
  <ResultHero tone={flash.error.code === 'cancelled' ? 'neutral' : 'failure'} title={error.title}>
    {error.explanation(null)}
  </ResultHero>
  <details class="details">
    <summary>{m.failure.details}</summary>
    <div class="details-body"><Console lines={[flash.error.technical]} /></div>
  </details>
  <div class="grow"></div>
  <div class="actions">
    <Button variant="primary" size="lg" wide icon="refresh" onclick={onprogram}>{m.failure.retry}</Button>
    <div class="more"><Button variant="ghost" icon="chevronLeft" onclick={onreset}>{m.failure.home}</Button></div>
  </div>
{:else}
  <div class="family-block">
    <SectionLabel>{m.families.label}</SectionLabel>
    <FamilySelector value={selected?.family ?? null} disabled={startupError !== null} onchange={onfamily} />
  </div>
  {#if startupError}
    <Callout>{m.demo.listError} {startupError.technical}</Callout>
  {:else if selected}
    <div class="board">
      <span class="board-icon"><Icon name="plug" size={20} /></span>
      <span class="board-text">
        <span class="board-name"><StatusDot tone="ok" breathe />{m.board.connected(board)}</span>
        <span class="board-note">{m.board.demoNote}</span>
      </span>
    </div>
  {/if}
  <div class="grow"></div>
  <div class="actions">
    <Button variant="primary" size="lg" wide icon="zap" disabled={!selected} onclick={onprogram}>
      {m.demo.program}
    </Button>
    <p class="hint">{m.demo.hint}</p>
  </div>
{/if}

<style>
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    border: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .family-block {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .progress-title {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .progress-label {
    font-size: 15px;
    font-weight: 600;
    color: var(--cf-muted);
  }
  .percent {
    font: 700 64px/0.95 var(--cf-font-display);
    letter-spacing: -0.04em;
  }
  .progress-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .phase {
    font-size: 15px;
    font-weight: 600;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
  .stat {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    border-radius: 16px;
    background: var(--cf-surface-2);
    border: 1px solid var(--cf-line);
  }
  .stat-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--cf-faint);
  }
  .stat-value {
    font: 700 20px var(--cf-font-display);
  }
  .grow {
    flex-grow: 1;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .more {
    display: flex;
    justify-content: center;
  }
  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--cf-muted);
    text-align: center;
  }
  .details {
    border: 1px solid var(--cf-line);
    border-radius: 16px;
    background: var(--cf-surface);
  }
  summary {
    padding: 12px 16px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .details-body {
    margin: 0 14px 14px;
  }
  .board {
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 14px;
    border-radius: var(--cf-radius-card);
    background: var(--cf-surface);
    border: 1px solid var(--cf-line);
    box-shadow: var(--cf-shadow-card);
  }
  .board-icon {
    width: 42px;
    height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--cf-radius-control);
    background: var(--cf-ok-weak);
    color: var(--cf-ok);
  }
  .board-text {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .board-name {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
  }
  .board-note {
    font-size: 13px;
    color: var(--cf-muted);
  }
</style>
