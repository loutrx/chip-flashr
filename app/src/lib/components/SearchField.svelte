<script lang="ts">
  import Icon from './Icon.svelte';

  let {
    value,
    label,
    placeholder,
    oninput,
  }: { value: string; label: string; placeholder: string; oninput: (value: string) => void } = $props();
</script>

<label class="field">
  <Icon name="search" size={17} />
  <input
    type="search"
    aria-label={label}
    {placeholder}
    {value}
    oninput={(event) => oninput(event.currentTarget.value)}
  />
</label>

<style>
  .field {
    width: 260px;
    height: 42px;
    padding: 0 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-radius: var(--cf-radius-control);
    border: 1px solid var(--cf-line);
    background: var(--cf-surface-2);
    box-shadow: var(--cf-shadow-sunken);
    color: var(--cf-muted);
  }
  .field:focus-within {
    outline: 2px solid var(--cf-ink);
    outline-offset: 3px;
  }
  input {
    flex-grow: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--cf-ink);
    font: 14px var(--cf-font-ui);
  }
  input::placeholder {
    color: var(--cf-faint);
  }
</style>
