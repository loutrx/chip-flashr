import { afterEach, describe, expect, it } from 'vitest';
import type { ErrorCode } from '../types';
import { en } from './en';
import { formatKib, formatPercent, formatSeconds, phaseLabel } from './format';
import { fr } from './fr';
import { locale, setLocale, t } from './index.svelte';
import { detectLocale } from './locale';

/** Every leaf as "path:kind"; arrays also record their length. */
function shape(value: unknown, path = ''): string[] {
  if (typeof value === 'string') return [`${path}:string`];
  if (typeof value === 'function') return [`${path}:function/${value.length}`];
  if (Array.isArray(value)) {
    return [`${path}:array/${value.length}`, ...value.flatMap((item, i) => shape(item, `${path}[${i}]`))];
  }
  return Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([key, item]) => shape(item, path ? `${path}.${key}` : key));
}

function leafStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(leafStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(leafStrings);
  return [];
}

const CODES: ErrorCode[] = [
  'cancelled',
  'target-not-found',
  'invalid-plan',
  'family-mismatch',
  'device-error',
  'already-running',
];

afterEach(() => setLocale('fr'));

describe('dictionaries', () => {
  it('English has exactly the same keys and kinds as French', () => {
    expect(shape(en)).toEqual(shape(fr));
  });

  it('has no empty message', () => {
    for (const text of [...leafStrings(fr), ...leafStrings(en)]) {
      expect(text.trim()).not.toBe('');
    }
  });

  it('has a title and an explanation for every error code', () => {
    expect(Object.keys(fr.errors).sort()).toEqual([...CODES].sort());
    for (const code of CODES) {
      expect(en.errors[code].title).not.toBe(fr.errors[code].title);
    }
  });
});

describe('locale', () => {
  it('picks French only when the first system language is French', () => {
    expect(detectLocale(['fr-FR', 'en-US'])).toBe('fr');
    expect(detectLocale(['FR-ca'])).toBe('fr');
    expect(detectLocale(['en-US', 'fr-FR'])).toBe('en');
    expect(detectLocale(['de-DE'])).toBe('en');
    expect(detectLocale([])).toBe('en');
  });

  it('switches the messages returned by t()', () => {
    setLocale('en');
    expect(locale()).toBe('en');
    expect(t().settings.title).toBe('Settings');
    setLocale('fr');
    expect(t().settings.title).toBe('Réglages');
  });
});

describe('phaseLabel', () => {
  const writing = { kind: 'writing', index: 3, count: 4, label: 'thermostat.bin', address: 0x10000 } as const;

  it('numbers files from 1 and names them, in both languages', () => {
    expect(phaseLabel(writing, fr)).toBe('Écriture 4/4 · thermostat.bin');
    expect(phaseLabel(writing, en)).toBe('Writing 4/4 · thermostat.bin');
  });

  it('has a label for every other phase and for no phase yet', () => {
    expect(phaseLabel(null, fr)).toBe('Préparation…');
    expect(phaseLabel({ kind: 'connecting' }, fr)).toBe('Connexion à la carte');
    expect(phaseLabel({ kind: 'erasing' }, fr)).toBe('Effacement des zones');
    expect(phaseLabel({ kind: 'verifying' }, fr)).toBe('Vérification');
    expect(phaseLabel({ kind: 'resetting' }, en)).toBe('Restarting the board');
  });
});

describe('number formats', () => {
  it('shows seconds with one decimal in the language’s style', () => {
    expect(formatSeconds(4630, 'fr')).toBe('4,6 s');
    expect(formatSeconds(4630, 'en')).toBe('4.6 s');
  });

  it('shows sizes in KiB with the language’s unit and grouping', () => {
    expect(formatKib(1_159_168, 'fr', fr)).toBe('1 132 Ko');
    expect(formatKib(1_159_168, 'en', en)).toBe('1,132 KB');
  });

  it('shows a percentage in the language’s style', () => {
    expect(formatPercent(44, 'fr')).toBe(new Intl.NumberFormat('fr', { style: 'percent' }).format(0.44));
    expect(formatPercent(44, 'en')).toBe('44%');
  });
});
