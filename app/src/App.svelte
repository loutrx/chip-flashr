<script lang="ts">
  import { onMount } from 'svelte';
  import { buildReport } from './lib/app/report';
  import {
    currentFirmware,
    currentIssue,
    currentTarget,
    familyOf,
    INITIAL_CHOICES,
    screenOf,
    type Choices,
    type ProvisionalId,
    type ScreenId,
  } from './lib/app/screen';
  import { flashReducer, toUserFacingError, type FlashAction, type FlashState } from './lib/flashState';
  import { locale, setLocale, t } from './lib/i18n/index.svelte';
  import type { Backend } from './lib/ipc';
  import Console from './lib/components/Console.svelte';
  import ResultHero from './lib/components/ResultHero.svelte';
  import ChooseChipScreen from './lib/screens/ChooseChipScreen.svelte';
  import FailureScreen from './lib/screens/FailureScreen.svelte';
  import FirmwareListScreen from './lib/screens/FirmwareListScreen.svelte';
  import HomeScreen from './lib/screens/HomeScreen.svelte';
  import ProgrammingScreen from './lib/screens/ProgrammingScreen.svelte';
  import ProvisionalScreen from './lib/screens/ProvisionalScreen.svelte';
  import SuccessScreen from './lib/screens/SuccessScreen.svelte';
  import { browserStore, loadSettings, saveSettings, type Settings } from './lib/settings';
  import ExpertPlaceholder from './lib/shell/ExpertPlaceholder.svelte';
  import InstructionsPanel from './lib/shell/InstructionsPanel.svelte';
  import type { Mode } from './lib/shell/mode';
  import SettingsView from './lib/shell/SettingsView.svelte';
  import StatusBar from './lib/shell/StatusBar.svelte';
  import TopBar from './lib/shell/TopBar.svelte';
  import { pillText } from './lib/targets';
  import { applyTheme, DARK_QUERY, resolveTheme } from './lib/theme';
  import type { AppInfo, UserFacingError, Family, FirmwareSummary, FlashRequest, ImageEntry, Snapshot, Target } from './lib/types';

  let { backend }: { backend: Backend } = $props();

  const PROVISIONAL: readonly ProvisionalId[] = [
    'waiting-board',
    'missing-driver',
    'external-tool',
    'no-firmware',
    'incomplete',
  ];
  /** Screens where the instructions panel is hidden, not folded (spec "Screens"). */
  const NO_INSTRUCTIONS: readonly ScreenId[] = ['firmware-list', 'no-firmware'];

  function isProvisional(id: ScreenId): id is ProvisionalId {
    return PROVISIONAL.some((candidate) => candidate === id);
  }

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
  let info = $state.raw<AppInfo | null>(null);
  let snapshot = $state.raw<Snapshot | null>(null);
  let startupError = $state.raw<UserFacingError | null>(null);
  let choices = $state.raw<Choices>({ ...INITIAL_CHOICES, families: {} });
  let job = $state.raw<FlashState>({ status: 'idle' });
  // What the job was started with: 05–07 keep showing it whatever the snapshot says afterwards.
  let jobFirmware = $state.raw<FirmwareSummary | null>(null);
  let jobTarget = $state.raw<Target | null>(null);

  const firmware = $derived(snapshot ? currentFirmware(snapshot, choices) : null);
  const family = $derived(firmware ? familyOf(firmware, choices) : null);
  const target = $derived(snapshot ? currentTarget(snapshot, family) : null);
  const issue = $derived(snapshot ? currentIssue(snapshot, family) : null);
  const screenId = $derived(screenOf(snapshot, choices, job));

  const pillTarget = $derived(job.status !== 'idle' ? jobTarget : (target ?? snapshot?.targets[0] ?? null));
  const pill = $derived(pillText(screenId, pillTarget, issue, t()));
  const shownFirmware = $derived(job.status !== 'idle' ? jobFirmware : firmware);
  const showInstructions = $derived(view !== 'settings' && !(mode === 'simple' && NO_INSTRUCTIONS.includes(screenId)));

  const note = $derived.by(() => {
    const m = t();
    const folders = snapshot?.folders ?? [];
    if (folders.length > 0) {
      const paths = folders.map((folder) => (folder.kind === 'app' ? `${folder.path} (${m.status.appFolder})` : folder.path));
      return m.status.watching(paths.join(' · '));
    }
    return info?.scenario ? m.status.simulated(info.scenario) : '';
  });
  const warning = $derived(info?.scenarioWarning ? t().status.unknownScenario(info.scenarioWarning) : null);

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

    // Subscribe before asking, so no change is lost between the two.
    let pushed = false;
    const unsubscribe = backend.onSnapshot((next) => {
      pushed = true;
      snapshot = next;
    });
    void (async () => {
      const [nextInfo, first] = await Promise.allSettled([backend.appInfo(), backend.snapshot()]);
      if (nextInfo.status === 'fulfilled') info = nextInfo.value;
      // A pushed snapshot is newer than the one this request returned.
      if (first.status === 'fulfilled') {
        if (!pushed) snapshot = first.value;
      } else if (!pushed) {
        startupError = toUserFacingError(first.reason);
      }
    })();

    return () => {
      unsubscribe();
      media?.removeEventListener('change', follow);
    };
  });

  function dispatch(action: FlashAction) {
    job = flashReducer(job, action);
  }

  function program() {
    if (!firmware || !target || !family) return;
    // The family travels only when the user confirmed it; a certain guess is the backend's own.
    const request: FlashRequest = {
      firmwareId: firmware.id,
      targetId: target.id,
      family: firmware.family.kind === 'certain' ? null : family,
    };
    void run(request, firmware.images, firmware, target);
  }

  function retry() {
    if (job.status !== 'failure' || !jobFirmware) return;
    void run(job.request, job.images, jobFirmware, jobTarget);
  }

  async function run(request: FlashRequest, images: ImageEntry[], what: FirmwareSummary, where: Target | null) {
    // The state changes synchronously on start, so a second press in the same instant stops here.
    if (job.status === 'flashing') return;
    jobFirmware = what;
    jobTarget = where;
    dispatch({ type: 'start', request, images, at: Date.now() });
    try {
      const report = await backend.flash(request, (event) => dispatch({ type: 'progress', event, at: Date.now() }));
      dispatch({ type: 'success', report, at: Date.now() });
      // Counted once, and only if this result was not ignored as late.
      if (job.status === 'success') choices = { ...choices, boardsThisSession: choices.boardsThisSession + 1 };
    } catch (error) {
      dispatch({ type: 'failure', error: toUserFacingError(error), at: Date.now() });
    }
  }

  function cancel() {
    // A refused cancel only means the job has already ended; its result arrives through run().
    backend.cancelFlash().catch(() => undefined);
  }

  function clearJob() {
    dispatch({ type: 'reset' });
    jobFirmware = null;
    jobTarget = null;
  }

  /** "Programmer une autre carte": the screen is derived again, so a board that isn't there shows 04. */
  function another() {
    clearJob();
  }

  function home() {
    clearJob();
    choices = { ...choices, browsing: false };
  }

  function browse() {
    choices = { ...choices, browsing: true };
  }

  function selectFirmware(id: string) {
    choices = { ...choices, firmwareId: id, browsing: false };
  }

  function chooseFamily(next: Family) {
    if (!firmware) return;
    choices = { ...choices, families: { ...choices.families, [firmware.id]: next } };
  }

  async function copyReport() {
    if ((job.status !== 'success' && job.status !== 'failure') || !jobFirmware || !info) {
      throw new Error('no finished job to report');
    }
    const folder = snapshot?.folders[jobFirmware.folder] ?? null;
    const report = buildReport(
      { info, firmware: jobFirmware, folder, target: jobTarget, job, now: new Date() },
      t(),
      locale(),
    );
    await navigator.clipboard.writeText(report);
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
  <TopBar board={pill.text} tone={pill.tone} breathe={pill.breathe} {mode} onmode={setMode} onsettings={() => (view = 'settings')} />
  <div class="middle">
    <main class="content">
      <!-- Persistent, so its text change is announced. The result hero takes the focus instead. -->
      <div class="visually-hidden" role="status" aria-live="polite">
        {#if job.status === 'flashing'}{t().progress.title}. {t().progress.keepPlugged}{/if}
      </div>

      {#if view === 'settings'}
        <SettingsView
          {settings}
          version={info?.version ?? null}
          onchange={updateSettings}
          onback={() => (view = 'main')}
        />
      {:else if mode === 'expert'}
        <ExpertPlaceholder onsimple={() => setMode('simple')} />
      {:else if snapshot === null && startupError}
        <ResultHero tone="failure" title={t().startup.title}>{t().startup.body}</ResultHero>
        <Console lines={startupError.technical.split('\n')} />
      {:else if screenId === 'programming' && job.status === 'flashing' && jobFirmware}
        <ProgrammingScreen firmware={jobFirmware} target={jobTarget} {job} oncancel={cancel} />
      {:else if screenId === 'success' && job.status === 'success' && jobFirmware}
        <SuccessScreen
          firmware={jobFirmware}
          target={jobTarget}
          {job}
          boardsThisSession={choices.boardsThisSession}
          onagain={another}
          onreport={copyReport}
          onhome={home}
        />
      {:else if screenId === 'failure' && job.status === 'failure' && jobFirmware}
        <FailureScreen firmware={jobFirmware} {job} onretry={retry} onexport={copyReport} onhome={home} />
      {:else if screenId === 'firmware-list' && snapshot}
        <FirmwareListScreen
          {snapshot}
          selectedId={firmware?.id ?? null}
          onselect={selectFirmware}
          onaddfolder={() => void backend.addFolder()}
          onopenfile={() => void backend.openFile()}
        />
      {:else if screenId === 'choose-chip' && snapshot && firmware}
        <ChooseChipScreen {snapshot} {firmware} onfamily={chooseFamily} onchange={browse} />
      {:else if screenId === 'home' && snapshot && firmware && family && target}
        <HomeScreen
          {snapshot}
          {firmware}
          {family}
          {target}
          onprogram={program}
          onchange={browse}
          ondetails={() => setMode('expert')}
          onrefresh={() => void backend.recheck()}
          onfamily={chooseFamily}
        />
      {:else if isProvisional(screenId)}
        <ProvisionalScreen
          screen={screenId}
          onchange={browse}
          onrecheck={() => void backend.recheck()}
          onaddfolder={() => void backend.addFolder()}
          onopenfile={() => void backend.openFile()}
        />
      {/if}
    </main>
    {#if showInstructions}
      <InstructionsPanel
        open={instructionsOpen}
        empty={!shownFirmware?.readme}
        ontoggle={() => (instructionsOpen = !instructionsOpen)}
      />
    {/if}
  </div>
  <StatusBar {note} {warning} version={info?.version ?? null} />
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
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    border: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
