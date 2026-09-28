<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  let {
    tone,
    title,
    children,
  }: { tone: 'success' | 'failure' | 'neutral'; title: string; children: Snippet } = $props();

  let heading: HTMLHeadingElement;

  // The control that led here is usually gone: take the focus, so the keyboard stays in place
  // and a screen reader reads the result.
  onMount(() => heading.focus());
</script>

<div class="hero">
  <div class="badge {tone}">
    <Icon name={tone === 'success' ? 'circleCheck' : 'circleX'} size={48} strokeWidth={1.9} />
  </div>
  <h1 tabindex="-1" bind:this={heading}>{title}</h1>
  <p>{@render children()}</p>
</div>

<style>
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 12px 0 4px;
    text-align: center;
  }
  .badge {
    --glow: var(--cf-faint);
    width: 96px;
    height: 96px;
    border-radius: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow:
      inset 0 2px 0 rgba(255, 255, 255, 0.6),
      inset 0 -4px 10px rgba(0, 0, 0, 0.08),
      0 16px 30px -18px var(--glow);
    animation: cf-pop 0.6s cubic-bezier(0.3, 1.6, 0.5, 1) both;
  }
  .success {
    --glow: var(--cf-ok);
    background: var(--cf-ok-weak);
    color: var(--cf-ok);
  }
  .failure {
    --glow: var(--cf-err);
    background: var(--cf-err-weak);
    color: var(--cf-err);
  }
  .neutral {
    background: var(--cf-surface-2);
    color: var(--cf-muted);
  }
  h1 {
    margin: 0;
    font: 700 34px/1.15 var(--cf-font-display);
    letter-spacing: -0.02em;
  }
  p {
    margin: 0;
    max-width: 520px;
    font-size: 16px;
    line-height: 1.5;
    color: var(--cf-muted);
  }
</style>
