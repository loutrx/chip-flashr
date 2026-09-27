import { en } from './en';
import { fr, type Messages } from './fr';
import type { Locale } from './locale';

const dictionaries: Record<Locale, Messages> = { fr, en };

let current = $state<Locale>('fr');

export function locale(): Locale {
  return current;
}

export function setLocale(next: Locale): void {
  current = next;
}

/** Messages in the current language. Reading it in a component re-renders on a language change. */
export function t(): Messages {
  return dictionaries[current];
}
