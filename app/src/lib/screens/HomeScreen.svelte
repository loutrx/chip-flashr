<script lang="ts">
  import BoardCard from '../components/BoardCard.svelte';
  import Button from '../components/Button.svelte';
  import FamilySelector from '../components/FamilySelector.svelte';
  import FirmwareCard from '../components/FirmwareCard.svelte';
  import Icon from '../components/Icon.svelte';
  import SectionLabel from '../components/SectionLabel.svelte';
  import { estimateMs } from '../flashState';
  import { formatEstimate } from '../i18n/format';
  import { t } from '../i18n/index.svelte';
  import type { Family, FirmwareSummary, Snapshot, Target } from '../types';

  let {
    snapshot,
    firmware,
    family,
    target,
    onprogram,
    onchange,
    ondetails,
    onrefresh,
    onfamily,
  }: {
    snapshot: Snapshot;
    firmware: FirmwareSummary;
    family: Family;
    target: Target;
    onprogram: () => void;
    onchange: () => void;
    ondetails: () => void;
    onrefresh: () => void;
    /** Only for a family the user confirmed on 03; a detected family is never offered for change. */
    onfamily?: (family: Family) => void;
  } = $props();

  const m = $derived(t());
  const certain = $derived(firmware.family.kind === 'certain');
  // What the board receives: the images, or the file itself when the firmware lists none.
  const bytes = $derived(
    firmware.images.length > 0 ? firmware.images.reduce((sum, image) => sum + image.size, 0) : firmware.sizeBytes,
  );
  const estimate = $derived(formatEstimate(estimateMs(bytes), m));
</script>

<SectionLabel>{m.firmware.label}</SectionLabel>
<FirmwareCard {firmware} {family} variant="full" available={snapshot.firmwares.length} {onchange} {ondetails} />

<div class="family">
  <div class="family-head">
    <SectionLabel>{m.families.label}</SectionLabel>
    {#if certain}
      <span class="detected"><span class="mark"><Icon name="check" size={14} strokeWidth={2.2} /></span>{m.families.detected}</span>
    {/if}
  </div>
  <FamilySelector value={family} disabled={certain || !onfamily} onchange={(next) => onfamily?.(next)} />
</div>

<BoardCard state="connected" {target} {onrefresh} />

<div class="grow"></div>
<div class="actions">
  <Button variant="primary" size="lg" wide icon="zap" onclick={onprogram}>{m.home.program}</Button>
  <p class="hint">{m.home.estimate(estimate)}</p>
</div>

<style>
  .family {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .family-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .detected {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--cf-ink);
  }
  .mark {
    display: inline-flex;
    color: var(--cf-ok);
  }
  .grow {
    flex-grow: 1;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--cf-muted);
    text-align: center;
  }
</style>
