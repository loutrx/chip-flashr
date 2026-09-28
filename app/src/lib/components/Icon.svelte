<script lang="ts">
  import { ICONS, type IconName } from './icons';

  let { name, size = 18, strokeWidth = 1.75 }: { name: IconName; size?: number; strokeWidth?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  data-icon={name}
>
  {#each ICONS[name] as shape, i (i)}
    {#if shape[0] === 'path'}
      <path d={shape[1]} />
    {:else if shape[0] === 'circle'}
      <circle cx={shape[1]} cy={shape[2]} r={shape[3]} />
    {:else}
      <rect x={shape[1]} y={shape[2]} width={shape[3]} height={shape[4]} rx={shape[5]} />
    {/if}
  {/each}
</svg>

<style>
  svg {
    flex-shrink: 0;
  }
</style>
