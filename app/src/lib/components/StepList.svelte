<script lang="ts">
  import type { Step } from '../flashState';
  import { formatAddress, formatDuration, stepLabel } from '../i18n/format';
  import { locale, t } from '../i18n/index.svelte';
  import ProgressBar from './ProgressBar.svelte';
  import StatusBubble from './StatusBubble.svelte';

  let {
    steps,
    current,
  }: { steps: readonly Step[]; current: { index: number; percent: number } | null } = $props();

  const BUBBLE = { done: 'ok', active: 'active', pending: 'pending' } as const;

  function meta(step: Step): string {
    if (step.status === 'done' && step.durationMs !== null) return formatDuration(step.durationMs, locale());
    if (step.status === 'active' && step.kind === 'writing' && step.image !== null) {
      return formatAddress(step.image.address);
    }
    return '';
  }

  function writesCurrent(step: Step, index: number): boolean {
    return step.status === 'active' && step.kind === 'writing' && step.index === index;
  }
</script>

<ol class="steps" aria-label={t().progress.stepsLabel}>
  {#each steps as step, i (i)}
    <li class={step.status}>
      <div class="row">
        <StatusBubble status={BUBBLE[step.status]} label={t().steps[step.status]} />
        <span class="label">{stepLabel(step, t())}</span>
        <span class="meta">{meta(step)}</span>
      </div>
      {#if current !== null && step.image !== null && writesCurrent(step, current.index)}
        <div class="file">
          <ProgressBar value={current.percent} label={t().progress.fileBarLabel(step.image.name)} size="sm" />
        </div>
      {/if}
    </li>
  {/each}
</ol>

<style>
  .steps {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  li {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .row {
    min-height: 30px;
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .label {
    flex-grow: 1;
    min-width: 0;
    font-size: 15px;
    font-weight: 500;
    color: var(--cf-ink);
  }
  .active .label {
    font-weight: 700;
  }
  .pending .label {
    color: var(--cf-faint);
  }
  .meta {
    font: 13px var(--cf-font-mono);
    color: var(--cf-faint);
  }
  .file {
    padding-left: 42px;
  }
</style>
