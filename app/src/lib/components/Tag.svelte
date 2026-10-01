<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    mono = false,
    tone = 'neutral',
    children,
  }: { mono?: boolean; tone?: 'neutral' | 'warn'; children: Snippet } = $props();
</script>

<span class="tag {tone}" class:mono>{@render children()}</span>

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
  .warn {
    background: var(--cf-warn-weak);
    border-color: var(--cf-warn-weak);
    color: var(--cf-warn);
  }
  .mono {
    font-family: var(--cf-font-mono);
  }
</style>
