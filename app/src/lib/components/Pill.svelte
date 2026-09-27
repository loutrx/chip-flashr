<script lang="ts">
  import type { Snippet } from 'svelte';
  import StatusDot from './StatusDot.svelte';
  import type { Tone } from './tones';

  let { tone, breathe = false, children }: { tone: Tone; breathe?: boolean; children: Snippet } = $props();
</script>

<span class="pill">
  <StatusDot {tone} {breathe} />
  <span>{@render children()}</span>
</span>

<style>
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 34px;
    padding: 0 14px;
    border-radius: 999px;
    background: var(--cf-surface-2);
    border: 1px solid var(--cf-line);
    color: var(--cf-ink);
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
  }
</style>
