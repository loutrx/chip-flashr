<script lang="ts">
  let {
    options,
    value,
    label,
    onchange,
  }: {
    options: readonly { value: string; label: string; count: number }[];
    value: string;
    label: string;
    onchange: (value: string) => void;
  } = $props();
</script>

<div class="chips" role="group" aria-label={label}>
  {#each options as option (option.value)}
    {@const selected = option.value === value}
    <button type="button" class="chip" class:selected aria-pressed={selected} onclick={() => onchange(option.value)}>
      {option.label} <span class="count">{option.count}</span>
    </button>
  {/each}
</div>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip {
    height: 34px;
    padding: 0 14px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 999px;
    border: 1px solid var(--cf-raised-line);
    background: var(--cf-raised);
    box-shadow: var(--cf-shadow-raised);
    color: var(--cf-ink);
    font: 600 13px var(--cf-font-ui);
    cursor: pointer;
    transition:
      transform 0.18s cubic-bezier(0.3, 1.6, 0.5, 1),
      box-shadow 0.18s ease,
      background-color 0.18s ease;
  }
  .chip:hover {
    transform: translateY(-2px);
  }
  .chip:active:not(.selected) {
    transform: translateY(2px);
    box-shadow: var(--cf-shadow-raised-active);
  }
  .selected {
    border-color: var(--cf-primary);
    background: var(--cf-primary);
    color: var(--cf-on-primary);
    box-shadow: var(--cf-shadow-primary);
  }
  .count {
    opacity: 0.7;
    font-weight: 500;
  }
</style>
