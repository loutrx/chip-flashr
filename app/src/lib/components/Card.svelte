<script lang="ts">
  import type { Snippet } from 'svelte';

  let { padding = 20, gap = 14, children }: { padding?: number; gap?: number; children: Snippet } = $props();
</script>

<div class="card" style:padding="{padding}px" style:gap="{gap}px">
  {@render children()}
</div>

<style>
  .card {
    display: flex;
    flex-direction: column;
    background: var(--cf-surface);
    border: 1px solid var(--cf-line);
    border-radius: var(--cf-radius-card);
    box-shadow: var(--cf-shadow-card);
  }
</style>
