<script lang="ts" generics="T extends string">
  let {
    label,
    options,
    value,
    onchange,
  }: {
    label: string;
    options: readonly { value: T; label: string }[];
    value: T;
    onchange: (value: T) => void;
  } = $props();
</script>

<div class="track" role="group" aria-label={label}>
  {#each options as option (option.value)}
    <button
      type="button"
      class="segment"
      class:current={option.value === value}
      aria-pressed={option.value === value}
      onclick={() => onchange(option.value)}
    >
      {option.label}
    </button>
  {/each}
</div>

<style>
  .track {
    display: flex;
    gap: 2px;
    padding: 4px;
    border-radius: 12px;
    background: var(--cf-surface-3);
    box-shadow: var(--cf-shadow-sunken);
  }
  .segment {
    height: 30px;
    padding: 0 14px;
    border: none;
    border-radius: 9px;
    background: transparent;
    color: var(--cf-muted);
    font: 600 13px var(--cf-font-ui);
    cursor: pointer;
    transition:
      transform 0.18s cubic-bezier(0.3, 1.6, 0.5, 1),
      box-shadow 0.18s ease,
      background-color 0.15s ease;
  }
  .current {
    background: var(--cf-raised);
    color: var(--cf-ink);
    box-shadow: var(--cf-shadow-raised);
  }
  .current:hover {
    transform: translateY(-2px);
  }
</style>
