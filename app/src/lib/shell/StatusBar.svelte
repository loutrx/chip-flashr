<script lang="ts">
  import Icon from '../components/Icon.svelte';

  let {
    note,
    warning = null,
    version,
  }: { note: string; warning?: string | null; version: string | null } = $props();
</script>

<footer class="status">
  <Icon name="eye" size={14} />
  <span>{note}</span>
  <span class="spacer"></span>
  {#if warning}
    <span class="warning"><Icon name="warning" size={14} />{warning}</span>
  {/if}
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
  .warning {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--cf-warn);
  }
  .version {
    font: 12px var(--cf-font-mono);
  }
</style>
