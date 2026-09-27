<script lang="ts">
  import { onMount } from 'svelte';
  import { flashReducer, toUserFacingError, type FlashAction, type FlashState } from './lib/flashState';
  import { appInfo, cancelFlash, flashDemo, listTargets } from './lib/ipc';
  import { errorMessages, phaseLabel } from './lib/messages';
  import type { AppInfo, Target } from './lib/types';

  let info = $state<AppInfo | null>(null);
  let targets = $state<Target[]>([]);
  let selectedId = $state<string | null>(null);
  let flash = $state<FlashState>({ status: 'idle' });

  const selected = $derived(targets.find((t) => t.id === selectedId) ?? null);
  const busy = $derived(flash.status === 'flashing');

  function dispatch(action: FlashAction) {
    flash = flashReducer(flash, action);
  }

  onMount(async () => {
    info = await appInfo();
    targets = await listTargets();
    selectedId = targets[0]?.id ?? null;
  });

  async function program() {
    if (!selected || busy) return;
    dispatch({ type: 'start' });
    try {
      const report = await flashDemo(selected.id, (event) => dispatch({ type: 'progress', event }));
      dispatch({ type: 'success', report });
    } catch (error) {
      dispatch({ type: 'failure', error: toUserFacingError(error) });
    }
  }
</script>

<div class="window">
  <header class="topbar">
    <span class="brand">Chip Flashr</span>
    <span class="badge">Démo · carte simulée</span>
    <span class="spacer"></span>
    <span class="pill"><span class="dot" class:on={selected !== null}></span>{selected?.label ?? 'Aucune carte'}</span>
  </header>

  <main class="content">
    <section class="card">
      <h2>Carte à programmer</h2>
      <div class="targets" role="radiogroup" aria-label="Carte à programmer">
        {#each targets as target (target.id)}
          <label class="target">
            <input type="radio" name="target" value={target.id} bind:group={selectedId} disabled={busy} />
            {target.label}
          </label>
        {/each}
      </div>
    </section>

    {#if flash.status === 'flashing'}
      <section class="card">
        <p class="percent">{flash.percent} %</p>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={flash.percent}>
          <div class="fill" style:width="{flash.percent}%"></div>
        </div>
        <div class="row">
          <span class="phase">{phaseLabel(flash.phase)}</span>
          <button type="button" class="secondary" onclick={() => cancelFlash()}>Annuler</button>
        </div>
      </section>
    {:else if flash.status === 'success'}
      <section class="card ok">
        <h2>Programmation réussie</h2>
        <p>
          {Math.round(flash.report.bytesWritten / 1024)} Ko écrits en 
          {(flash.report.durationMs / 1000).toFixed(1)} s{flash.report.verified ? ' · vérifié' : ''}.
        </p>
      </section>
    {:else if flash.status === 'failure'}
      <section class="card err">
        <h2>{errorMessages[flash.error.code].title}</h2>
        <p>{errorMessages[flash.error.code].explanation}</p>
        <details>
          <summary>Détails techniques</summary>
          <code>{flash.error.technical}</code>
        </details>
      </section>
    {/if}

    <button type="button" class="primary" onclick={program} disabled={!selected || busy}>
      {flash.status === 'success' || flash.status === 'failure' ? 'Programmer à nouveau' : 'Programmer'}
    </button>
  </main>

  <footer class="status">{info ? `${info.name} v${info.version}` : ''}</footer>
</div>

<style>
  .window {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .topbar {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 60px;
    padding: 0 20px;
    background: var(--cf-surface);
    border-bottom: 1px solid var(--cf-line);
  }
  .brand {
    font-family: var(--cf-font-display);
    font-size: 18px;
    font-weight: 700;
  }
  .badge {
    padding: 2px 10px;
    border-radius: 999px;
    background: var(--cf-warn-weak);
    color: var(--cf-warn);
    font-size: 12px;
    font-weight: 600;
  }
  .spacer {
    flex-grow: 1;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 34px;
    padding: 0 14px;
    border-radius: 999px;
    background: var(--cf-surface-2);
    border: 1px solid var(--cf-line);
    font-size: 13px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--cf-faint);
  }
  .dot.on {
    background: var(--cf-ok);
  }
  .content {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 720px;
    width: 100%;
    margin: 0 auto;
    padding: 28px 32px;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px;
    border-radius: var(--cf-radius-card);
    background: var(--cf-surface);
    border: 1px solid var(--cf-line);
  }
  .card.ok {
    background: var(--cf-ok-weak);
  }
  .card.err {
    background: var(--cf-err-weak);
  }
  h2 {
    margin: 0;
    font-family: var(--cf-font-display);
    font-size: 18px;
  }
  p {
    margin: 0;
  }
  .targets {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .target {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
  }
  .percent {
    font-family: var(--cf-font-display);
    font-size: 48px;
    font-weight: 700;
    line-height: 1;
  }
  .bar {
    height: 12px;
    border-radius: 999px;
    background: var(--cf-surface-3);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--cf-primary);
    transition: width 0.15s linear;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .phase {
    color: var(--cf-muted);
  }
  button {
    min-height: 44px;
    padding: 0 18px;
    border-radius: var(--cf-radius-control);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .primary {
    height: 64px;
    border: none;
    background: var(--cf-primary);
    color: var(--cf-on-primary);
    font-family: var(--cf-font-display);
    font-size: 19px;
  }
  .primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .secondary {
    border: 1px solid var(--cf-line);
    background: var(--cf-surface);
    color: var(--cf-ink);
  }
  code {
    font-family: var(--cf-font-mono);
    font-size: 12px;
  }
  .status {
    height: 32px;
    display: flex;
    align-items: center;
    padding: 0 20px;
    background: var(--cf-surface);
    border-top: 1px solid var(--cf-line);
    color: var(--cf-faint);
    font-family: var(--cf-font-mono);
    font-size: 12px;
  }
</style>
