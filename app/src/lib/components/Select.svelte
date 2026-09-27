<script lang="ts" generics="T extends string">
  import Icon from './Icon.svelte';

  let {
    id,
    options,
    value,
    onchange,
  }: {
    id: string;
    options: readonly { value: T; label: string }[];
    value: T;
    onchange: (value: T) => void;
  } = $props();
</script>

<span class="wrap">
  <select {id} class="select" {value} onchange={(event) => onchange(event.currentTarget.value as T)}>
    {#each options as option (option.value)}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
  <span class="arrow" aria-hidden="true"><Icon name="chevronRight" size={14} /></span>
</span>

<style>
  .wrap {
    position: relative;
    display: inline-flex;
  }
  .select {
    height: 38px;
    min-width: 210px;
    padding: 0 34px 0 12px;
    appearance: none;
    -webkit-appearance: none;
    border-radius: 12px;
    border: 1px solid var(--cf-line);
    background: var(--cf-surface-2);
    box-shadow: var(--cf-shadow-sunken);
    color: var(--cf-ink);
    font: 13px var(--cf-font-ui);
  }
  .arrow {
    position: absolute;
    top: 50%;
    right: 12px;
    transform: translateY(-50%) rotate(90deg);
    display: flex;
    pointer-events: none;
    color: var(--cf-muted);
  }
</style>
