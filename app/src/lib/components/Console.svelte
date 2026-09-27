<script lang="ts">
  let { lines }: { lines: readonly string[] } = $props();
</script>

<div class="console">
  {#each lines as line, i (i)}
    <div>{line}</div>
  {/each}
</div>

<style>
  .console {
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--cf-console);
    color: var(--cf-on-console);
    font: 12.5px/1.6 var(--cf-font-mono);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
