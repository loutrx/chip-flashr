<script lang="ts">
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  let {
    icon,
    label,
    small = false,
    onclick,
  }: { icon: IconName; label: string; small?: boolean; onclick?: () => void } = $props();
</script>

<button type="button" class="icon-button" class:small aria-label={label} title={label} {onclick}>
  <Icon name={icon} size={18} />
</button>

<style>
  .icon-button {
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    border: 1px solid var(--cf-raised-line);
    background: var(--cf-raised);
    color: var(--cf-muted);
    box-shadow: var(--cf-shadow-raised);
    cursor: pointer;
    transition:
      transform 0.18s cubic-bezier(0.3, 1.6, 0.5, 1),
      box-shadow 0.18s ease;
  }
  .icon-button:hover {
    transform: translateY(-2px);
  }
  .icon-button:active {
    transform: translateY(2px);
    box-shadow: var(--cf-shadow-raised-active);
  }
  .small {
    width: 34px;
    height: 34px;
  }
</style>
