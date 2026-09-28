import { detectLocale, isLocale, type Locale } from './i18n/locale';
import { resolveTheme, THEME_PREFERENCES, type Theme, type ThemePreference } from './theme';

export interface Settings {
  locale: Locale;
  theme: ThemePreference;
}

/** Versioned, so a later format can ignore this one instead of misreading it (spec D7). */
export const SETTINGS_KEY = 'chip-flashr.settings.v1';

/** The part of `Storage` we use, so tests can pass a fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function defaultSettings(languages: readonly string[]): Settings {
  return { locale: detectLocale(languages), theme: 'system' };
}

function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/** Keep every stored field that is valid; take the rest from `fallback`. */
export function parseSettings(raw: string | null, fallback: Settings): Settings {
  if (raw === null) return fallback;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (typeof value !== 'object' || value === null) return fallback;
  const { locale, theme } = value as Record<string, unknown>;
  return {
    locale: isLocale(locale) ? locale : fallback.locale,
    theme: isThemePreference(theme) ? theme : fallback.theme,
  };
}

export function loadSettings(store: KeyValueStore | null, languages: readonly string[]): Settings {
  const fallback = defaultSettings(languages);
  if (!store) return fallback;
  try {
    return parseSettings(store.getItem(SETTINGS_KEY), fallback);
  } catch {
    return fallback;
  }
}

/** Best effort: with a blocked or full storage, the choice lasts for this session only. */
export function saveSettings(store: KeyValueStore | null, settings: Settings): void {
  if (!store) return;
  try {
    store.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Keep the in-memory value; nothing useful to tell the user.
  }
}

/**
 * The theme to apply before the first paint, so a dark setting never flashes light.
 * Synchronous on purpose: main.ts calls it before mounting the app.
 */
export function startupTheme(store: KeyValueStore | null, languages: readonly string[], systemDark: boolean): Theme {
  return resolveTheme(loadSettings(store, languages).theme, systemDark);
}

/** `localStorage`, or null where the WebView refuses access to it. */
export function browserStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
