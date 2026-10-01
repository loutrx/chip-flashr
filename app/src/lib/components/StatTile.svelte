<script lang="ts">
  let { label, value }: { label: string; value: string } = $props();
</script>

<div class="stat">
  <span class="label">{label}</span>
  <span class="value">{value}</span>
</div>

<style>
  .stat {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 16px;
    border-radius: 16px;
    background: var(--cf-surface-2);
    border: 1px solid var(--cf-line);
  }
  .label {
    font-size: 12px;
    font-weight: 600;
    color: var(--cf-faint);
  }
  .value {
    font: 700 20px var(--cf-font-display);
  }
</style>
