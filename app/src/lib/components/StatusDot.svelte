<script lang="ts">
  import type { Tone } from './tones';

  let { tone, size = 8, breathe = false }: { tone: Tone; size?: number; breathe?: boolean } = $props();
</script>

<span class="dot {tone}" class:breathe style:width="{size}px" style:height="{size}px"></span>

<style>
  .dot {
    display: inline-block;
    flex-shrink: 0;
    border-radius: 50%;
  }
  .ok {
    background: var(--cf-ok);
  }
  .warn {
    background: var(--cf-warn);
  }
  .err {
    background: var(--cf-err);
  }
  .idle {
    background: var(--cf-faint);
  }
  .busy {
    background: var(--cf-ink);
  }
  .breathe {
    animation: cf-breathe 2.2s ease-in-out infinite;
  }
</style>
