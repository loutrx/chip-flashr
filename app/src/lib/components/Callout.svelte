<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  let { tone = 'warning', children }: { tone?: 'warning' | 'info'; children: Snippet } = $props();
</script>

<div class="callout {tone}">
  <span class="icon"><Icon name={tone === 'warning' ? 'warning' : 'info'} size={17} /></span>
  <span>{@render children()}</span>
</div>

<style>
  .callout {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 12px 14px;
    border-radius: 14px;
    color: var(--cf-ink);
    font-size: 14px;
    line-height: 1.5;
  }
  .icon {
    display: flex;
    padding-top: 1px;
  }
  .warning {
    background: var(--cf-warn-weak);
  }
  .warning .icon {
    color: var(--cf-warn);
  }
  .info {
    background: var(--cf-surface-2);
  }
  .info .icon {
    color: var(--cf-muted);
  }
</style>
