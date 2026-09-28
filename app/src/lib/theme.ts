export type ThemePreference = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];
export const DARK_QUERY = '(prefers-color-scheme: dark)';

/** The theme actually drawn: the user's choice, or the system's when they chose "system" (spec D1). */
export function resolveTheme(preference: ThemePreference, systemDark: boolean): Theme {
  if (preference === 'system') return systemDark ? 'dark' : 'light';
  return preference;
}

/** Switch every token at once: tokens.css keys on this attribute. */
export function applyTheme(root: HTMLElement, theme: Theme): void {
  root.dataset.theme = theme;
}
