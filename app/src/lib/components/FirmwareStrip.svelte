<script lang="ts">
  import { firmwareTitle, tileMark } from '../app/firmware';
  import { formatVersion } from '../i18n/format';
  import { t } from '../i18n/index.svelte';
  import type { Family, FirmwareSummary } from '../types';
  import LinkButton from './LinkButton.svelte';
  import Tag from './Tag.svelte';

  let {
    firmware,
    family,
    detail,
    onchange,
  }: { firmware: FirmwareSummary; family: Family | null; detail: string; onchange?: () => void } = $props();
</script>

<div class="strip">
  <span class="tile">{tileMark(family, firmware)}</span>
  <span class="name">{firmwareTitle(firmware)}</span>
  {#if firmware.version !== null}
    <Tag mono>{formatVersion(firmware.version)}</Tag>
  {/if}
  <span class="detail">{detail}</span>
  <span class="grow"></span>
  {#if onchange}
    <LinkButton chevron onclick={onchange}>{t().firmware.change}</LinkButton>
  {/if}
</div>

<style>
  .strip {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: var(--cf-radius-card);
    background: var(--cf-surface);
    border: 1px solid var(--cf-line);
    box-shadow: var(--cf-shadow-card);
  }
  .tile {
    width: 38px;
    height: 38px;
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
  .name {
    min-width: 0;
    font: 700 18px var(--cf-font-display);
    letter-spacing: -0.015em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .detail {
    font-size: 13px;
    color: var(--cf-muted);
    white-space: nowrap;
  }
  .grow {
    flex-grow: 1;
  }
</style>
