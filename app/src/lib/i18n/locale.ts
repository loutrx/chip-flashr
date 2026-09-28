export type Locale = 'fr' | 'en';

export const LOCALES: readonly Locale[] = ['fr', 'en'];

/** Each language named in itself, as language pickers do. */
export const LANGUAGE_NAMES: Record<Locale, string> = { fr: 'Français', en: 'English' };

export function isLocale(value: unknown): value is Locale {
  return value === 'fr' || value === 'en';
}

/** French when the preferred system language is French, English otherwise (spec D6). */
export function detectLocale(languages: readonly string[]): Locale {
  return languages[0]?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}
