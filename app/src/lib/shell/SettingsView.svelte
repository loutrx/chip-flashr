<script lang="ts">
  import Card from '../components/Card.svelte';
  import Icon from '../components/Icon.svelte';
  import Select from '../components/Select.svelte';
  import { t } from '../i18n/index.svelte';
  import { LANGUAGE_NAMES, LOCALES, type Locale } from '../i18n/locale';
  import type { Settings } from '../settings';
  import type { ThemePreference } from '../theme';

  let {
    settings,
    version,
    onchange,
    onback,
  }: {
    settings: Settings;
    version: string | null;
    onchange: (settings: Settings) => void;
    onback: () => void;
  } = $props();

  const m = $derived(t().settings);
  const languages = LOCALES.map((locale) => ({ value: locale, label: LANGUAGE_NAMES[locale] }));
  const themes = $derived([
    { value: 'system' as const, label: m.themeSystem },
    { value: 'light' as const, label: m.themeLight },
    { value: 'dark' as const, label: m.themeDark },
  ]);
</script>

<section class="settings">
  <div class="header">
    <button type="button" class="back" onclick={onback}><Icon name="chevronLeft" size={15} />{m.back}</button>
    <h1>{m.title}</h1>
    <span class="spacer"></span>
    {#if version}
      <span class="about">{m.about(version)}</span>
    {/if}
  </div>
  <div class="grid">
    <Card gap={4}>
      <h2>{m.general}</h2>
      <div class="row">
        <label for="settings-language">{m.language}</label>
        <Select
          id="settings-language"
          options={languages}
          value={settings.locale}
          onchange={(locale: Locale) => onchange({ ...settings, locale })}
        />
      </div>
      <div class="row">
        <label for="settings-theme">{m.theme}</label>
        <Select
          id="settings-theme"
          options={themes}
          value={settings.theme}
          onchange={(theme: ThemePreference) => onchange({ ...settings, theme })}
        />
      </div>
    </Card>
  </div>
</section>

<style>
  .settings {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .back {
    padding: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: none;
    background: none;
    color: var(--cf-ink);
    font: 600 13px var(--cf-font-ui);
    text-decoration: underline;
    text-decoration-color: var(--cf-line);
    text-underline-offset: 4px;
    cursor: pointer;
  }
  h1 {
    margin: 0;
    font: 700 26px/1.15 var(--cf-font-display);
    letter-spacing: -0.02em;
  }
  .spacer {
    flex-grow: 1;
  }
  .about {
    font: 12px var(--cf-font-mono);
    color: var(--cf-faint);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    align-items: start;
  }
  h2 {
    margin: 0;
    font: 700 18px var(--cf-font-display);
  }
  .row {
    padding: 10px 0;
    display: flex;
    align-items: center;
    gap: 14px;
    border-bottom: 1px solid var(--cf-line);
  }
  .row:last-child {
    border-bottom: none;
  }
  label {
    flex-grow: 1;
    font-size: 14px;
    font-weight: 600;
  }
</style>
