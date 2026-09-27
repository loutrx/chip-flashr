<script lang="ts">
  import type { Snippet } from 'svelte';

  let { mono = false, children }: { mono?: boolean; children: Snippet } = $props();
</script>

<span class="tag" class:mono>{@render children()}</span>

<style>
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 9px;
    border-radius: 999px;
    background: var(--cf-surface-2);
    border: 1px solid var(--cf-line);
    color: var(--cf-muted);
    font: 500 12px var(--cf-font-ui);
    white-space: nowrap;
  }
  .mono {
    font-family: var(--cf-font-mono);
  }
</style>
