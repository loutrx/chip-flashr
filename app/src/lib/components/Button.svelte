<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  let {
    variant = 'secondary',
    size = 'md',
    icon,
    wide = false,
    disabled = false,
    onclick,
    children,
  }: {
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'md' | 'lg';
    icon?: IconName;
    wide?: boolean;
    disabled?: boolean;
    onclick?: () => void;
    children: Snippet;
  } = $props();
</script>

<button type="button" class="button {variant} {size}" class:wide {disabled} onclick={disabled ? undefined : onclick}>
  {#if icon}
    <Icon name={icon} size={size === 'lg' ? 22 : 17} strokeWidth={size === 'lg' ? 2 : 1.75} />
  {/if}
  {@render children()}
</button>

<style>
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    white-space: nowrap;
    cursor: pointer;
    transition:
      transform 0.18s cubic-bezier(0.3, 1.6, 0.5, 1),
      box-shadow 0.18s ease,
      background-color 0.18s ease;
  }
  .md {
    height: 42px;
    padding: 0 18px;
    border-radius: var(--cf-radius-control);
    font: 600 14px/1 var(--cf-font-ui);
  }
  .lg {
    height: 64px;
    padding: 0 26px;
    border-radius: var(--cf-radius-card);
    font: 700 19px/1 var(--cf-font-display);
    letter-spacing: -0.01em;
  }
  .wide {
    width: 100%;
  }
  .primary {
    border: 1px solid var(--cf-primary);
    background: var(--cf-primary);
    color: var(--cf-on-primary);
    box-shadow: var(--cf-shadow-primary);
  }
  .secondary {
    border: 1px solid var(--cf-raised-line);
    background: var(--cf-raised);
    color: var(--cf-ink);
    box-shadow: var(--cf-shadow-raised);
  }
  .ghost {
    border: 1px solid transparent;
    background: transparent;
    color: var(--cf-ink);
  }
  .primary:hover:enabled,
  .secondary:hover:enabled {
    transform: translateY(-2px);
  }
  .primary:active:enabled {
    transform: translateY(3px);
    box-shadow: var(--cf-shadow-primary-active);
  }
  .secondary:active:enabled {
    transform: translateY(2px);
    box-shadow: var(--cf-shadow-raised-active);
  }
  .ghost:hover:enabled {
    background: var(--cf-surface-3);
  }
  .button:disabled {
    border-color: var(--cf-disabled);
    background: var(--cf-disabled);
    color: var(--cf-on-disabled);
    box-shadow: none;
    cursor: not-allowed;
  }
</style>
