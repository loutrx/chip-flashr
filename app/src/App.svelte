<script lang="ts">
  import { onMount } from 'svelte';
  import DemoFlow from './lib/demo/DemoFlow.svelte';
  import { flashReducer, toUserFacingError, type FlashAction, type FlashState } from './lib/flashState';
  import { setLocale, t } from './lib/i18n/index.svelte';
  import type { Backend } from './lib/ipc';
  import { browserStore, loadSettings, saveSettings, type Settings } from './lib/settings';
  import ExpertPlaceholder from './lib/shell/ExpertPlaceholder.svelte';
  import InstructionsPanel from './lib/shell/InstructionsPanel.svelte';
  import type { Mode } from './lib/shell/mode';
  import SettingsView from './lib/shell/SettingsView.svelte';
  import StatusBar from './lib/shell/StatusBar.svelte';
  import TopBar from './lib/shell/TopBar.svelte';
  import { boardName } from './lib/targets';
  import { applyTheme, DARK_QUERY, resolveTheme } from './lib/theme';
  import type { AppInfo, Family, FirmwareSummary, FlashRequest, Snapshot, UserFacingError } from './lib/types';

  let { backend }: { backend: Backend } = $props();

  const store = browserStore();
  const media = typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null;
  const initial = loadSettings(store, navigator.languages);
  // Set before the first render so no string flashes in the other language.
  setLocale(initial.locale);

  let settings = $state<Settings>(initial);
  let systemDark = $state(media?.matches ?? false);
  let mode = $state<Mode>('simple');
  let view = $state<'main' | 'settings'>('main');
  let instructionsOpen = $state(true);
  let info = $state<AppInfo | null>(null);
  let snapshot = $state<Snapshot | null>(null);
  const targets = $derived(snapshot?.targets ?? []);
  let selectedId = $state<string | null>(null);
  let startupError = $state<UserFacingError | null>(null);
  let flash = $state<FlashState>({ status: 'idle' });

  const selected = $derived(targets.find((target) => target.id === selectedId) ?? null);
  const board = $derived(selected ? boardName(selected, t()) : null);
  const tone = $derived(
    flash.status === 'failure' && flash.error.code !== 'cancelled' ? 'err' : selected ? 'ok' : 'idle',
  );

  $effect(() => {
    setLocale(settings.locale);
    document.documentElement.lang = settings.locale;
  });

  $effect(() => {
    applyTheme(document.documentElement, resolveTheme(settings.theme, systemDark));
  });

  onMount(() => {
    const follow = (event: MediaQueryListEvent) => {
      systemDark = event.matches;
    };
    media?.addEventListener('change', follow);
    const stopSnapshots = backend.onSnapshot((next) => {
      snapshot = next;
    });
    void load();
    return () => {
      media?.removeEventListener('change', follow);
      stopSnapshots();
    };
  });

  async function load() {
    try {
      info = await backend.appInfo();
      const first = await backend.snapshot();
      snapshot = first;
      selectedId = first.targets[0]?.id ?? null;
    } catch (error) {
      startupError = toUserFacingError(error);
    }
  }

  function dispatch(action: FlashAction) {
    flash = flashReducer(flash, action);
  }

  /** The demo screen has no firmware picker: it programs the first firmware of the board's family. */
  function firmwareFor(family: Family): FirmwareSummary | null {
    return (
      snapshot?.firmwares.find(
        (firmware) => firmware.family.kind !== 'unknown' && firmware.family.family === family,
      ) ?? null
    );
  }

  async function program() {
    // The state changes synchronously on start, so a second press in the same instant stops here.
    if (!selected || flash.status === 'flashing') return;
    const target = selected;
    const firmware = firmwareFor(target.family);
    if (!firmware) return;
    const request: FlashRequest = { firmwareId: firmware.id, targetId: target.id, family: target.family };
    dispatch({ type: 'start' });
    try {
      const report = await backend.flash(request, (event) => dispatch({ type: 'progress', event }));
      dispatch({ type: 'success', report });
    } catch (error) {
      dispatch({ type: 'failure', error: toUserFacingError(error) });
    }
  }

  function cancel() {
    // A refused cancel only means the job has already ended; its result arrives through program().
    backend.cancelFlash().catch(() => undefined);
  }

  function selectFamily(family: Family) {
    const target = targets.find((candidate) => candidate.family === family);
    if (target) selectedId = target.id;
  }

  function setMode(next: Mode) {
    if (next !== mode) instructionsOpen = next === 'simple';
    mode = next;
    view = 'main';
  }

  function updateSettings(next: Settings) {
    settings = next;
    saveSettings(store, next);
  }
</script>

<div class="window">
  <TopBar {board} {tone} {mode} onmode={setMode} onsettings={() => (view = 'settings')} />
  <div class="middle">
    <main class="content">
      {#if view === 'settings'}
        <SettingsView
          {settings}
          version={info?.version ?? null}
          onchange={updateSettings}
          onback={() => (view = 'main')}
        />
      {:else if mode === 'expert'}
        <ExpertPlaceholder onsimple={() => setMode('simple')} />
      {:else}
        <DemoFlow
          {selected}
          {flash}
          {startupError}
          onfamily={selectFamily}
          onprogram={program}
          oncancel={cancel}
          onreset={() => dispatch({ type: 'reset' })}
        />
      {/if}
    </main>
    {#if view !== 'settings'}
      <InstructionsPanel open={instructionsOpen} ontoggle={() => (instructionsOpen = !instructionsOpen)} />
    {/if}
  </div>
  <StatusBar note={t().status.demo} version={info?.version ?? null} />
</div>

<style>
  .window {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .middle {
    flex-grow: 1;
    min-height: 0;
    display: flex;
  }
  .content {
    flex-grow: 1;
    min-width: 0;
    padding: 26px 32px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    overflow-y: auto;
  }
</style>
