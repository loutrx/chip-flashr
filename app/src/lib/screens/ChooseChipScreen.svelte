<script lang="ts">
  import BoardCard from '../components/BoardCard.svelte';
  import Button from '../components/Button.svelte';
  import Callout from '../components/Callout.svelte';
  import FamilySelector from '../components/FamilySelector.svelte';
  import FirmwareCard from '../components/FirmwareCard.svelte';
  import SectionLabel from '../components/SectionLabel.svelte';
  import { t } from '../i18n/index.svelte';
  import type { Family, FamilyGuess, FirmwareSummary, Snapshot } from '../types';

  let {
    snapshot,
    firmware,
    onfamily,
    onchange,
  }: {
    snapshot: Snapshot;
    firmware: FirmwareSummary;
    onfamily: (family: Family) => void;
    onchange: () => void;
  } = $props();

  const m = $derived(t());
  const suggested = $derived(firmware.family.kind === 'suggested' ? firmware.family.family : null);
  const reason = $derived(reasonText(firmware.family));

  /** A start address as the artifact writes it: eight hex digits, "0x08000000". */
  function fullAddress(address: number): string {
    return `0x${address.toString(16).toUpperCase().padStart(8, '0')}`;
  }

  /** Why a family is suggested, in words; nothing to say for an unknown guess. */
  function reasonText(guess: FamilyGuess): string | null {
    if (guess.kind !== 'suggested') return null;
    const name = m.families[guess.family].name;
    return guess.reason.kind === 'start-address'
      ? m.families.reason.startAddress(fullAddress(guess.reason.address), name)
      : m.families.reason.fileName(name);
  }
</script>

<SectionLabel>{m.firmware.label}</SectionLabel>
<FirmwareCard {firmware} family={null} variant="minimal" available={snapshot.firmwares.length} {onchange} />

<div class="family">
  <div class="family-head">
    <SectionLabel>{m.families.label}</SectionLabel>
    <span class="to-choose">{m.families.toChoose}</span>
  </div>
  <FamilySelector value={null} ambiguous {suggested} onchange={onfamily} />
</div>

{#if reason}
  <Callout tone="warning" icon="info">{reason}</Callout>
{/if}

<BoardCard state="waiting" target={null} />

<div class="grow"></div>
<div class="actions">
  <Button variant="primary" size="lg" wide icon="zap" disabled>{m.home.program}</Button>
  <p class="hint">{m.home.chooseFirst}</p>
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
  .to-choose {
    font-size: 12px;
    font-weight: 600;
    color: var(--cf-warn);
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
