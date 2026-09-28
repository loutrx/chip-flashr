<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import IconButton from '../components/IconButton.svelte';
  import Pill from '../components/Pill.svelte';
  import SegmentedControl from '../components/SegmentedControl.svelte';
  import type { Tone } from '../components/tones';
  import { t } from '../i18n/index.svelte';
  import type { Mode } from './mode';

  let {
    board,
    tone,
    mode,
    onmode,
    onsettings,
  }: {
    board: string | null;
    tone: Tone;
    mode: Mode;
    onmode: (mode: Mode) => void;
    onsettings: () => void;
  } = $props();

  const modes = $derived([
    { value: 'simple' as const, label: t().topbar.simple },
    { value: 'expert' as const, label: t().topbar.expert },
  ]);
</script>

<header class="topbar">
  <div class="brand">
    <span class="logo"><Icon name="chip" size={18} strokeWidth={1.9} /></span>
    <span class="name">Chip Flashr</span>
  </div>
  <span class="spacer"></span>
  <Pill {tone} breathe={tone === 'ok'}>{board ?? t().topbar.noBoard}</Pill>
  <SegmentedControl label={t().topbar.modeGroup} options={modes} value={mode} onchange={onmode} />
  <IconButton icon="sliders" label={t().topbar.settings} onclick={onsettings} />
</header>

<style>
  .topbar {
    height: 60px;
    flex-shrink: 0;
    padding: 0 20px;
    display: flex;
    align-items: center;
    gap: 14px;
    background: var(--cf-surface);
    border-bottom: 1px solid var(--cf-line);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .logo {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    background: var(--cf-primary);
    color: var(--cf-on-primary);
    box-shadow:
      inset 0 2px 0 rgba(255, 255, 255, 0.18),
      inset 0 -3px 5px rgba(0, 0, 0, 0.35);
  }
  .name {
    font: 700 18px var(--cf-font-display);
    letter-spacing: -0.02em;
  }
  .spacer {
    flex-grow: 1;
  }
</style>
