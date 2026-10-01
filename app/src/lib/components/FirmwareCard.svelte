<script lang="ts">
  import { firmwareTitle, tileMark } from '../app/firmware';
  import { chipName, formatDate, formatSize, formatTime, formatVersion } from '../i18n/format';
  import { locale, t } from '../i18n/index.svelte';
  import type { Family, FirmwareSummary } from '../types';
  import Card from './Card.svelte';
  import Icon from './Icon.svelte';
  import ImageChip from './ImageChip.svelte';
  import LinkButton from './LinkButton.svelte';
  import Tag from './Tag.svelte';

  /** Same in both languages: a typographic separator, not a word. */
  const SEPARATOR = ' · ';

  let {
    firmware,
    family,
    variant,
    available,
    onchange,
    ondetails,
  }: {
    firmware: FirmwareSummary;
    family: Family | null;
    variant: 'full' | 'minimal';
    available: number;
    onchange: () => void;
    ondetails?: () => void;
  } = $props();

  const m = $derived(t());
  const full = $derived(variant === 'full');
  const meta = $derived.by(() => {
    const parts = full
      ? [
          firmware.chip === null ? null : chipName(firmware.chip),
          firmware.toolchain,
          firmware.builtAt === null
            ? null
            : m.firmware.builtAt(formatDate(firmware.builtAt, locale()), formatTime(firmware.builtAt, locale())),
        ]
      : [
          firmware.version === null ? m.firmware.noVersionInfo : null,
          m.firmware.ranges(firmware.addressRanges),
          formatSize(firmware.sizeBytes, locale(), m),
        ];
    return parts.filter((part): part is string => part !== null).join(SEPARATOR);
  });
  const contents = $derived(full && (firmware.manifest !== null || firmware.images.length > 0));
</script>

<Card>
  <div class="head">
    <span class="tile">{tileMark(family, firmware)}</span>
    <div class="text">
      <div class="title">
        <span class="name">{firmwareTitle(firmware)}</span>
        <Tag mono>{firmware.version === null ? m.firmware.noVersion : formatVersion(firmware.version)}</Tag>
        {#if full && firmware.variant !== null}
          <Tag>{firmware.variant}</Tag>
        {/if}
      </div>
      {#if meta}
        <span class="meta">{meta}</span>
      {/if}
      <span class="file">{full ? firmware.fileName : firmware.path}</span>
    </div>
    <LinkButton chevron onclick={onchange}>
      {available > 1 ? m.firmware.changeCount(available) : m.firmware.change}
    </LinkButton>
  </div>
  {#if contents}
    <div class="contents">
      {#if firmware.manifest !== null}
        <div class="manifest">
          <Icon name="package" size={15} />
          <span class="manifest-text">{m.firmware.manifest(firmware.images.length)} <span class="mono">{firmware.manifest}</span></span>
          {#if ondetails}
            <LinkButton onclick={ondetails}>{m.firmware.details}</LinkButton>
          {/if}
        </div>
      {/if}
      {#if firmware.images.length > 0}
        <ul class="images">
          {#each firmware.images as image, i (i)}
            <li><ImageChip {image} /></li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</Card>

<style>
  .head {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }
  .tile {
    width: 58px;
    height: 58px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    background: var(--cf-surface-2);
    box-shadow: var(--cf-shadow-tile);
    color: var(--cf-ink);
    font: 500 15px var(--cf-font-mono);
  }
  .text {
    flex-grow: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .title {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .name {
    font: 700 28px/1.1 var(--cf-font-display);
    letter-spacing: -0.025em;
    overflow-wrap: anywhere;
  }
  .meta {
    font-size: 14px;
    color: var(--cf-muted);
  }
  .file {
    font: 12.5px var(--cf-font-mono);
    color: var(--cf-faint);
    overflow-wrap: anywhere;
  }
  .contents {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 14px;
    border-top: 1px solid var(--cf-line);
  }
  .manifest {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--cf-muted);
  }
  .manifest-text {
    flex-grow: 1;
    min-width: 0;
  }
  .mono {
    font: 12px var(--cf-font-mono);
  }
  .images {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
</style>
