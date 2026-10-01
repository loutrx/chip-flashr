<script lang="ts">
  import { onDestroy } from 'svelte';
  import Button from '../components/Button.svelte';
  import ResultHero from '../components/ResultHero.svelte';
  import StatTile from '../components/StatTile.svelte';
  import { firmwareTitle } from '../app/firmware';
  import type { FlashState } from '../flashState';
  import { chipName, formatDuration, formatVersion } from '../i18n/format';
  import { locale, t } from '../i18n/index.svelte';
  import type { FirmwareSummary, Target } from '../types';
  import { copiedFeedback } from './copied.svelte';

  let {
    firmware,
    target,
    job,
    boardsThisSession,
    onagain,
    onreport,
    onhome,
  }: {
    firmware: FirmwareSummary;
    target: Target | null;
    job: Extract<FlashState, { status: 'success' }>;
    boardsThisSession: number;
    onagain: () => void;
    onreport: () => Promise<void>;
    onhome: () => void;
  } = $props();

  const m = $derived(t());
  const name = $derived(
    firmware.version ? `${firmwareTitle(firmware)} ${formatVersion(firmware.version)}` : firmwareTitle(firmware),
  );
  const chip = $derived(target?.label ?? (firmware.chip ? chipName(firmware.chip) : ''));
  const feedback = copiedFeedback();
  onDestroy(feedback.dispose);
</script>

<ResultHero tone="success" title={m.success.title}>{m.success.body(name, chip, target?.port ?? '')}</ResultHero>

<div class="stats">
  <StatTile
    label={m.success.verification}
    value={job.report.verified ? m.success.verified : m.success.notVerified}
  />
  <StatTile label={m.success.duration} value={formatDuration(job.report.durationMs, locale())} />
  <StatTile label={m.success.sessionBoards} value={String(boardsThisSession)} />
</div>

<div class="grow"></div>
<div class="actions">
  <Button variant="primary" size="lg" wide icon="refresh" onclick={onagain}>{m.success.again}</Button>
  <div class="more">
    <Button variant="ghost" icon="file" onclick={() => void feedback.run(onreport)}>
      {feedback.copied ? m.success.copied : m.success.report}
    </Button>
    <Button variant="ghost" icon="chevronLeft" onclick={onhome}>{m.success.home}</Button>
  </div>
</div>

<style>
  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
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
    gap: 10px;
  }
</style>
