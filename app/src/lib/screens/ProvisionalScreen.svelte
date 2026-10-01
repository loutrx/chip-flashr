<script lang="ts">
  import type { ProvisionalId } from '../app/screen';
  import Button from '../components/Button.svelte';
  import Card from '../components/Card.svelte';
  import { t } from '../i18n/index.svelte';

  // Each stand-in keeps the one way out its plan-3b screen will have, so none is a dead end.
  let {
    screen,
    onchange,
    onrecheck,
    onaddfolder,
    onopenfile,
  }: {
    screen: ProvisionalId;
    onchange?: () => void;
    onrecheck?: () => void;
    onaddfolder?: () => void;
    onopenfile?: () => void;
  } = $props();

  const m = $derived(t());
  const canChange = $derived((screen === 'waiting-board' || screen === 'incomplete') && onchange !== undefined);
  const canRecheck = $derived((screen === 'missing-driver' || screen === 'external-tool') && onrecheck !== undefined);
  const noFirmware = $derived(screen === 'no-firmware');
</script>

<Card padding={24} gap={8}>
  <h1>{m.provisional.title[screen]}</h1>
  <p>{m.provisional.body}</p>
  {#if canChange || canRecheck || (noFirmware && (onaddfolder || onopenfile))}
    <div class="actions">
      {#if canChange}
        <Button onclick={onchange}>{m.firmware.change}</Button>
      {/if}
      {#if canRecheck}
        <Button icon="refresh" onclick={onrecheck}>{m.provisional.recheck}</Button>
      {/if}
      {#if noFirmware && onaddfolder}
        <Button icon="plus" onclick={onaddfolder}>{m.list.addFolder}</Button>
      {/if}
      {#if noFirmware && onopenfile}
        <Button variant="ghost" icon="file" onclick={onopenfile}>{m.list.openFile}</Button>
      {/if}
    </div>
  {/if}
</Card>

<style>
  h1 {
    margin: 0;
    font: 700 26px/1.15 var(--cf-font-display);
    letter-spacing: -0.02em;
  }
  p {
    margin: 0;
    font-size: 15px;
    line-height: 1.5;
    color: var(--cf-muted);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 8px;
  }
</style>
