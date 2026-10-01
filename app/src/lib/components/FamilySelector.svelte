<script lang="ts">
  import { t } from '../i18n/index.svelte';
  import type { Family } from '../types';
  import Icon from './Icon.svelte';
  import Tag from './Tag.svelte';

  const FAMILIES: readonly Family[] = ['esp32', 'stm32', 'nrf'];
  /** The short mark drawn in each card's tile, as in the mockups. */
  const TILES: Record<Family, string> = { esp32: 'ESP', stm32: 'STM', nrf: 'nRF' };

  let {
    value,
    disabled = false,
    ambiguous = false,
    suggested = null,
    onchange,
  }: {
    value: Family | null;
    disabled?: boolean;
    /** The firmware does not say its family: every card asks to be considered until one is picked. */
    ambiguous?: boolean;
    suggested?: Family | null;
    onchange: (family: Family) => void;
  } = $props();

  const asking = $derived(ambiguous && value === null);
</script>

<div class="families" role="group" aria-label={t().families.label}>
  {#each FAMILIES as family (family)}
    {@const selected = family === value}
    <button
      type="button"
      class="family"
      class:selected
      class:ambiguous={asking}
      aria-pressed={selected}
      {disabled}
      onclick={() => onchange(family)}
    >
      <span class="tile">{TILES[family]}</span>
      <span class="text">
        <span class="name">{t().families[family].name}</span>
        <span class="description">{t().families[family].description}</span>
      </span>
      {#if selected}
        <span class="check"><Icon name="check" size={14} strokeWidth={2.5} /></span>
      {:else if family === suggested}
        <span class="suggested"><Tag tone="warn">{t().families.suggested}</Tag></span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .families {
    display: flex;
    gap: 12px;
  }
  .family {
    /* Lets the check leave the text's row when the card is too narrow (see .check below). */
    container-type: inline-size;
    position: relative;
    flex: 1 1 0;
    min-width: 0;
    height: 76px;
    padding: 0 15px;
    display: flex;
    align-items: center;
    gap: 12px;
    text-align: left;
    border-radius: var(--cf-radius-card);
    border: 1px solid var(--cf-raised-line);
    background: var(--cf-raised);
    box-shadow: var(--cf-shadow-raised);
    color: var(--cf-ink);
    font-family: var(--cf-font-ui);
    cursor: pointer;
    transition:
      transform 0.18s cubic-bezier(0.3, 1.6, 0.5, 1),
      box-shadow 0.18s ease,
      background-color 0.18s ease;
  }
  .family:hover:enabled:not(.selected) {
    transform: translateY(-2px);
  }
  .family:active:enabled:not(.selected) {
    transform: translateY(2px);
    box-shadow: var(--cf-shadow-raised-active);
  }
  /* A detected family is read-only but stays at full strength, as in the Main page. */
  .family:disabled {
    cursor: default;
  }
  /* The 2 px border takes 1 px of padding so the content does not move (ChoixPuce page). */
  .ambiguous {
    padding: 0 14px;
    border: 2px solid var(--cf-warn);
  }
  .selected {
    padding: 0 14px;
    border: 2px solid var(--cf-ink);
    background: var(--cf-selection);
    box-shadow: var(--cf-shadow-sunken);
  }
  .tile {
    width: 42px;
    height: 42px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    background: var(--cf-surface-2);
    box-shadow: var(--cf-shadow-tile);
    color: var(--cf-ink);
    font: 500 12px var(--cf-font-mono);
  }
  .selected .tile {
    background: var(--cf-primary);
    color: var(--cf-on-primary);
    box-shadow: var(--cf-shadow-tile-strong);
  }
  .text {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .name {
    font: 700 17px/1.2 var(--cf-font-display);
    letter-spacing: -0.01em;
    white-space: nowrap;
  }
  .description {
    font-size: 12px;
    color: var(--cf-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .check {
    margin-left: auto;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--cf-primary);
    color: var(--cf-on-primary);
    animation: cf-pop 0.6s cubic-bezier(0.3, 1.6, 0.5, 1) both;
  }
  .suggested {
    margin-left: auto;
    flex-shrink: 0;
    display: flex;
  }
  /*
   * Tile, name and check need about 150 px of content: below that (the panel open near the
   * 960 px minimum window width), the check and the tag sit on the card's top edge, clear of the name.
   */
  @container (max-width: 160px) {
    .check {
      position: absolute;
      top: -9px;
      right: -9px;
      box-shadow: 0 0 0 3px var(--cf-ground);
    }
    .suggested {
      position: absolute;
      top: -12px;
      right: 10px;
    }
  }
</style>
