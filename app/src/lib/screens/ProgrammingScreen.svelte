<script lang="ts">
  import Button from '../components/Button.svelte';
  import Callout from '../components/Callout.svelte';
  import Card from '../components/Card.svelte';
  import FirmwareStrip from '../components/FirmwareStrip.svelte';
  import Icon from '../components/Icon.svelte';
  import ProgressBar from '../components/ProgressBar.svelte';
  import StepList from '../components/StepList.svelte';
  import { imageProgress, type FlashState } from '../flashState';
  import { formatDuration, formatPercent } from '../i18n/format';
  import { locale, t } from '../i18n/index.svelte';
  import type { FirmwareSummary, Target } from '../types';

  let {
    firmware,
    target,
    job,
    oncancel,
  }: {
    firmware: FirmwareSummary;
    target: Target | null;
    job: Extract<FlashState, { status: 'flashing' }>;
    oncancel: () => void;
  } = $props();

  const m = $derived(t());
  const family = $derived(
    target?.family ?? job.request.family ?? (firmware.family.kind === 'certain' ? firmware.family.family : null),
  );
  const detail = $derived(target ? m.pill.board(target.label, target.port) : '');
  const current = $derived(imageProgress(job));
</script>

<FirmwareStrip {firmware} {family} {detail} />

<Card padding={24} gap={20}>
  <div class="head">
    <div class="title">
      <span class="label">{m.progress.title}</span>
      <span class="percent">{formatPercent(job.percent, locale())}</span>
    </div>
    {#if job.remainingMs !== null}
      <span class="remaining">
        <Icon name="clock" size={16} />{m.progress.remaining(formatDuration(job.remainingMs, locale()))}
      </span>
    {/if}
  </div>
  <ProgressBar value={job.percent} label={m.progress.barLabel} />
</Card>

<Card padding={20} gap={12}>
  <StepList steps={job.steps} {current} />
</Card>

<Callout>{m.progress.keepPlugged}</Callout>

<div class="grow"></div>
<div class="cancel">
  <Button icon="x" onclick={oncancel}>{m.progress.cancel}</Button>
</div>

<style>
  .head {
    display: flex;
    align-items: flex-end;
    gap: 16px;
  }
  .title {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .label {
    font-size: 15px;
    font-weight: 600;
    color: var(--cf-muted);
  }
  .percent {
    font: 700 64px/0.95 var(--cf-font-display);
    letter-spacing: -0.04em;
  }
  .remaining {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    color: var(--cf-muted);
  }
  .grow {
    flex-grow: 1;
  }
  .cancel {
    display: flex;
    justify-content: flex-end;
  }
</style>
