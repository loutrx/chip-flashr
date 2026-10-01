<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  let {
    chevron = false,
    onclick,
    children,
  }: { chevron?: boolean; onclick: () => void; children: Snippet } = $props();
</script>

<button type="button" class="link" {onclick}>
  {@render children()}
  {#if chevron}
    <Icon name="chevronRight" size={15} />
  {/if}
</button>

<style>
  .link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0;
    border: none;
    background: none;
    color: var(--cf-ink);
    font: 600 13px var(--cf-font-ui);
    text-decoration: underline;
    text-decoration-color: var(--cf-line);
    text-underline-offset: 4px;
    white-space: nowrap;
    cursor: pointer;
  }
  .link:hover {
    color: var(--cf-muted);
  }
</style>
