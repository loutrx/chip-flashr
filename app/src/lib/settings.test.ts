import { describe, expect, it } from 'vitest';
import {
  browserStore,
  defaultSettings,
  loadSettings,
  saveSettings,
  SETTINGS_KEY,
  startupTheme,
  type KeyValueStore,
} from './settings';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const throwing: KeyValueStore = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

describe('defaultSettings', () => {
  it('follows the system language and theme', () => {
    expect(defaultSettings(['fr-FR'])).toEqual({ locale: 'fr', theme: 'system' });
    expect(defaultSettings(['en-GB'])).toEqual({ locale: 'en', theme: 'system' });
  });
});

describe('loadSettings', () => {
  it('returns what was saved', () => {
    const store = memoryStore({ [SETTINGS_KEY]: '{"locale":"en","theme":"dark"}' });
    expect(loadSettings(store, ['fr-FR'])).toEqual({ locale: 'en', theme: 'dark' });
  });

  it('uses the defaults when nothing is stored', () => {
    expect(loadSettings(memoryStore(), ['fr-FR'])).toEqual({ locale: 'fr', theme: 'system' });
  });

  it('uses the defaults when the stored value is not JSON', () => {
    const store = memoryStore({ [SETTINGS_KEY]: '{not json' });
    expect(loadSettings(store, ['fr-FR'])).toEqual({ locale: 'fr', theme: 'system' });
  });

  it('keeps each valid field and replaces the others', () => {
    const foreignLocale = memoryStore({ [SETTINGS_KEY]: '{"locale":"de","theme":"dark"}' });
    expect(loadSettings(foreignLocale, ['fr-FR'])).toEqual({ locale: 'fr', theme: 'dark' });
    const badTheme = memoryStore({ [SETTINGS_KEY]: '{"locale":"en","theme":42}' });
    expect(loadSettings(badTheme, ['fr-FR'])).toEqual({ locale: 'en', theme: 'system' });
    const notAnObject = memoryStore({ [SETTINGS_KEY]: '42' });
    expect(loadSettings(notAnObject, ['en-US'])).toEqual({ locale: 'en', theme: 'system' });
  });

  it('uses the defaults when the storage refuses access', () => {
    expect(loadSettings(throwing, ['fr-FR'])).toEqual({ locale: 'fr', theme: 'system' });
    expect(loadSettings(null, ['fr-FR'])).toEqual({ locale: 'fr', theme: 'system' });
  });
});

describe('saveSettings', () => {
  it('round-trips through the store', () => {
    const store = memoryStore();
    saveSettings(store, { locale: 'en', theme: 'light' });
    expect(JSON.parse(store.data[SETTINGS_KEY])).toEqual({ locale: 'en', theme: 'light' });
    expect(loadSettings(store, ['fr-FR'])).toEqual({ locale: 'en', theme: 'light' });
  });

  it('never throws when the storage is full or blocked', () => {
    expect(() => saveSettings(throwing, { locale: 'fr', theme: 'dark' })).not.toThrow();
    expect(() => saveSettings(null, { locale: 'fr', theme: 'dark' })).not.toThrow();
  });
});

describe('startupTheme', () => {
  it('uses the stored theme over the system one', () => {
    const store = memoryStore({ [SETTINGS_KEY]: '{"locale":"fr","theme":"dark"}' });
    expect(startupTheme(store, ['fr-FR'], false)).toBe('dark');
  });

  it('follows the system when the stored theme is "system"', () => {
    const store = memoryStore({ [SETTINGS_KEY]: '{"locale":"fr","theme":"system"}' });
    expect(startupTheme(store, ['fr-FR'], true)).toBe('dark');
  });

  it('falls back to the system theme when the storage is broken', () => {
    expect(startupTheme(throwing, ['fr-FR'], false)).toBe('light');
  });
});

describe('browserStore', () => {
  it('is the WebView localStorage', () => {
    expect(browserStore()).toBe(window.localStorage);
  });
});
