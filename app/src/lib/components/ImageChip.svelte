<script lang="ts">
  import { formatAddress, formatSize } from '../i18n/format';
  import { locale, t } from '../i18n/index.svelte';
  import type { ImageEntry } from '../types';

  let { image }: { image: ImageEntry } = $props();
</script>

<span class="chip">
  <span class="address">{formatAddress(image.address)}</span>
  <span class="name">{image.name}</span>
  <span class="size">{formatSize(image.size, locale(), t())}</span>
</span>

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 30px;
    padding: 0 11px;
    border-radius: 999px;
    background: var(--cf-surface-2);
    border: 1px solid var(--cf-line);
    font-size: 12.5px;
    white-space: nowrap;
  }
  .address {
    font: 12px var(--cf-font-mono);
    color: var(--cf-ink);
  }
  .name {
    color: var(--cf-muted);
  }
  .size {
    color: var(--cf-faint);
  }
</style>
