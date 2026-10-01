<script lang="ts">
  import Icon from './Icon.svelte';

  let {
    status,
    label,
    size = 28,
  }: { status: 'ok' | 'error' | 'warning' | 'active' | 'pending'; label: string; size?: 26 | 28 } = $props();

  // 28 px is the step-list bubble (solid), 26 px the check-row bubble (tinted), as in the artifact.
  const tinted = $derived(size === 26);
  const iconSize = $derived(tinted ? 14 : 15);
</script>

<span
  class="bubble {status}"
  class:tinted
  role="img"
  aria-label={label}
  style:width="{size}px"
  style:height="{size}px"
>
  {#if status === 'ok'}
    <Icon name="check" size={iconSize} strokeWidth={tinted ? 2.4 : 2.6} />
  {:else if status === 'error'}
    <Icon name="x" size={iconSize} strokeWidth={2.4} />
  {:else if status === 'warning'}
    <Icon name="warning" size={iconSize} strokeWidth={2.4} />
  {:else if status === 'active'}
    <span class="spinner"><Icon name="refresh" size={iconSize} strokeWidth={2.2} /></span>
  {/if}
</span>

<style>
  .bubble {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border-radius: 50%;
    color: var(--cf-on-primary);
  }
  .ok {
    background: var(--cf-ok);
  }
  .error {
    background: var(--cf-err);
  }
  .warning {
    background: var(--cf-warn);
  }
  .active {
    background: var(--cf-primary);
  }
  .pending {
    border: 2px dashed var(--cf-line);
  }
  .tinted.ok {
    background: var(--cf-ok-weak);
    color: var(--cf-ok);
  }
  .tinted.error {
    background: var(--cf-err-weak);
    color: var(--cf-err);
  }
  .tinted.warning {
    background: var(--cf-warn-weak);
    color: var(--cf-warn);
  }
  .spinner {
    display: flex;
    animation: cf-spin 1.4s linear infinite;
  }
</style>
