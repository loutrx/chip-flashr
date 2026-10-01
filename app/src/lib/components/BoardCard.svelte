<script lang="ts">
  import { formatSize } from '../i18n/format';
  import { locale, t } from '../i18n/index.svelte';
  import { linkText } from '../targets';
  import type { Target } from '../types';
  import Icon from './Icon.svelte';
  import IconButton from './IconButton.svelte';
  import StatusDot from './StatusDot.svelte';

  let {
    state,
    target,
    onrefresh,
  }: { state: 'connected' | 'waiting'; target: Target | null; onrefresh?: () => void } = $props();

  const m = $derived(t());
  const board = $derived(state === 'connected' ? target : null);
  const connection = $derived(
    board === null
      ? null
      : m.board.connection(
          board.port,
          linkText(board.link, m),
          board.flashSize === null ? null : m.board.flash(formatSize(board.flashSize, locale(), m)),
        ),
  );
</script>

<div class="board" class:connected={board !== null}>
  <span class="tile"><Icon name="plug" size={20} /></span>
  <div class="text">
    {#if board}
      <span class="title"><StatusDot tone="ok" breathe />{m.board.connected(board.label)}</span>
      <span class="note">{connection}</span>
    {:else}
      <span class="title"><StatusDot tone="idle" />{m.board.waitingFamily}</span>
      <span class="note">{m.board.waitingFamilyNote}</span>
    {/if}
  </div>
  {#if board && onrefresh}
    <IconButton icon="refresh" label={m.board.refresh} onclick={onrefresh} />
  {/if}
</div>

<style>
  .board {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    border-radius: var(--cf-radius-card);
    background: var(--cf-surface);
    border: 1px solid var(--cf-line);
    box-shadow: var(--cf-shadow-card);
  }
  .tile {
    width: 42px;
    height: 42px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--cf-radius-control);
    background: var(--cf-surface-2);
    color: var(--cf-faint);
  }
  .connected .tile {
    background: var(--cf-ok-weak);
    color: var(--cf-ok);
  }
  .text {
    flex-grow: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
  }
  .note {
    font-size: 13px;
    color: var(--cf-muted);
  }
</style>
