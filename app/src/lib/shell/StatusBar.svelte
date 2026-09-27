<script lang="ts">
  import Icon from '../components/Icon.svelte';

  let { note, version }: { note: string; version: string | null } = $props();
</script>

<footer class="status">
  <Icon name="eye" size={14} />
  <span>{note}</span>
  <span class="spacer"></span>
  {#if version}
    <span class="version">v{version}</span>
  {/if}
</footer>

<style>
  .status {
    height: 32px;
    flex-shrink: 0;
    padding: 0 20px;
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--cf-surface);
    border-top: 1px solid var(--cf-line);
    font-size: 12px;
    color: var(--cf-faint);
  }
  .spacer {
    flex-grow: 1;
  }
  .version {
    font: 12px var(--cf-font-mono);
  }
</style>
