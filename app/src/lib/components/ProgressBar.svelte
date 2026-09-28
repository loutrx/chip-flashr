<script lang="ts">
  let { value, label, size = 'lg' }: { value: number; label: string; size?: 'lg' | 'sm' } = $props();

  const percent = $derived(Math.min(100, Math.max(0, Math.round(value))));
</script>

<div
  class="track {size}"
  role="progressbar"
  aria-label={label}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={percent}
>
  <div class="fill" style:width="{percent}%"></div>
</div>

<style>
  .track {
    border-radius: 999px;
    background: var(--cf-surface-3);
    box-shadow: var(--cf-shadow-sunken);
    overflow: hidden;
  }
  .lg {
    height: 14px;
  }
  .sm {
    height: 6px;
  }
  .fill {
    height: 100%;
    border-radius: 999px;
    background-color: var(--cf-primary);
    background-image: repeating-linear-gradient(135deg, var(--cf-stripe) 0 8px, transparent 8px 16px);
    background-size: 32px 100%;
    animation: cf-stripes 0.9s linear infinite;
    transition: width 0.15s linear;
  }
</style>
