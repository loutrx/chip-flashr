<script lang="ts">
  import { onDestroy } from 'svelte';
  import Button from '../components/Button.svelte';
  import CauseList from '../components/CauseList.svelte';
  import Console from '../components/Console.svelte';
  import ResultHero from '../components/ResultHero.svelte';
  import type { FlashState } from '../flashState';
  import { formatPercent } from '../i18n/format';
  import { locale, t } from '../i18n/index.svelte';
  import type { FirmwareSummary } from '../types';
  import { copiedFeedback } from './copied.svelte';

  let {
    job,
    onretry,
    onexport,
    onhome,
  }: {
    firmware: FirmwareSummary;
    job: Extract<FlashState, { status: 'failure' }>;
    onretry: () => void;
    onexport: () => Promise<void>;
    onhome: () => void;
  } = $props();

  const m = $derived(t());
  const error = $derived(job.error);
  const text = $derived(m.errors[error.code]);
  const cancelled = $derived(error.code === 'cancelled');
  // "pendant l’écriture, à 41 %" only when the backend said where it stopped.
  const at = $derived(
    error.phase && error.percent !== null
      ? m.failure.at(m.failure.stepNoun[error.phase.kind], formatPercent(error.percent, locale()))
      : null,
  );
  const lines = $derived(error.technical.split('\n'));
  const feedback = copiedFeedback();
  onDestroy(feedback.dispose);
</script>

<ResultHero tone={cancelled ? 'neutral' : 'failure'} title={text.title}>{text.explanation(at)}</ResultHero>

{#if text.causes.length > 0}
  <CauseList title={m.failure.causesTitle} causes={text.causes} />
{/if}

<details class="details" open>
  <summary>{m.failure.details}</summary>
  <div class="details-body"><Console {lines} /></div>
</details>

<div class="grow"></div>
<div class="actions">
  <div class="row">
    <Button variant="primary" size="lg" wide icon="refresh" onclick={onretry}>{m.failure.retry}</Button>
    <Button size="lg" icon="download" onclick={() => void feedback.run(onexport)}>
      {feedback.copied ? m.failure.copied : m.failure.export}
    </Button>
  </div>
  <div class="more">
    <Button variant="ghost" icon="chevronLeft" onclick={onhome}>{m.failure.home}</Button>
  </div>
</div>

<style>
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
  .grow {
    flex-grow: 1;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .row {
    display: flex;
    gap: 12px;
  }
  .more {
    display: flex;
    justify-content: center;
  }
</style>
