<script lang="ts">
  import { firmwareTitle, tileMark } from '../app/firmware';
  import { chipName, formatDate, formatVersion } from '../i18n/format';
  import { locale, t } from '../i18n/index.svelte';
  import type { FirmwareSummary } from '../types';
  import Tag from './Tag.svelte';

  let {
    firmware,
    selected,
    onselect,
  }: { firmware: FirmwareSummary; selected: boolean; onselect: () => void } = $props();

  const m = $derived(t());
  const family = $derived(firmware.family.kind === 'certain' ? firmware.family.family : null);
</script>

<button type="button" class="row" class:selected aria-pressed={selected} onclick={onselect}>
  <span class="tile">{tileMark(family)}</span>
  <span class="title">
    <span class="name">{firmwareTitle(firmware)}</span>
    {#if firmware.version !== null}
      <Tag mono>{formatVersion(firmware.version)}</Tag>
    {/if}
    {#if firmware.variant !== null}
      <Tag>{firmware.variant}</Tag>
    {/if}
  </span>
  <span class="cell">
    {#if family === null}
      <Tag tone="warn">{m.list.needsFamily}</Tag>
    {:else}
      {firmware.chip === null ? m.families[family].name : chipName(firmware.chip)}
    {/if}
  </span>
  <span class="cell">{m.firmware.source[firmware.source]}</span>
  <span class="date">{firmware.builtAt === null ? '' : formatDate(firmware.builtAt, locale())}</span>
</button>

<style>
  .row {
    width: 100%;
    min-height: 60px;
    padding: 12px 14px;
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr) 170px 140px 90px;
    align-items: center;
    gap: 14px;
    text-align: left;
    border-radius: 16px;
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
  .row:hover:not(.selected) {
    transform: translateY(-2px);
  }
  .row:active:not(.selected) {
    transform: translateY(2px);
    box-shadow: var(--cf-shadow-raised-active);
  }
  .selected {
    padding: 11px 13px;
    border: 2px solid var(--cf-ink);
    background: var(--cf-selection);
    box-shadow: var(--cf-shadow-sunken);
  }
  .tile {
    width: 36px;
    height: 36px;
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
  .title {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .name {
    min-width: 0;
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cell {
    font-size: 13px;
    color: var(--cf-muted);
  }
  .date {
    font-size: 13px;
    color: var(--cf-faint);
    text-align: right;
  }
</style>
