# Plan 2 · Design System & App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chip Flashr looks like its mockups. The window has the real top bar, instructions panel and status bar, and the clay components every later screen reuses. It runs in French and English, light and dark, and the plan-1 demo flow is rebuilt with those components on the simulated board, in Tauri or in a plain browser.

**Architecture:** Design tokens (CSS custom properties switched by `<html data-theme>`) and local fonts feed small Svelte 5 components in `app/src/lib/components`. The shell pieces live in `app/src/lib/shell`. `App.svelte` owns all state (settings, mode, view, flash job) so a running flash survives navigation. Every string comes from typed FR/EN dictionaries. A `Backend` interface hides whether the UI talks to Tauri or to a TypeScript copy of the simulated board (browser preview, dev only).

**Tech Stack:** Svelte 5 (runes) · TypeScript 6 · Vite 8 · Vitest 5 + jsdom + @testing-library/svelte · @fontsource-variable fonts · Tauri 2.11 (unchanged) · Rust (one label change in the mock).

**Spec:** [docs/superpowers/specs/2026-09-27-design-system-design.md](../specs/2026-09-27-design-system-design.md) (scope, decisions D1–D12, the clay token table, acceptance). Background: [plan 1 spec](../specs/2026-09-26-foundations-design.md), [ux-design.md](../../ux-design.md), the "Chip Flashr — Écrans" design artifact (pages `Main`, `Sombre`, `Expert`, `Reglages`, `Flash`, `Succes`, `Echec`), and the mockup images in `docs/assets/screens/`.

## Global Constraints

- Everything from plan 1 still holds: Rust edition 2024, `rust-version = "1.88"`, `cargo fmt` and `cargo clippy --workspace --all-targets -- -D warnings` clean; `@tauri-apps/api` and `@tauri-apps/cli` stay on `~2.11` and `typescript` on `^6` (see the plan-1 Task 4 commit message for why).
- `pnpm check` runs `svelte-check --fail-on-warnings`: no type error, no accessibility warning, no unused-CSS warning.
- Colours, shadows and radii only through the `--cf-*` tokens in `app/src/styles/tokens.css`; every value comes from the spec's token table or ux-design. No hex colour inside a component, except the logo's inset shadow and the result badge's glow, which the artifact defines only there.
- Fonts: `'Bricolage Grotesque Variable'`, `'Instrument Sans Variable'`, `'JetBrains Mono Variable'` from `@fontsource-variable` (OFL-1.1). No request to any font server; no other runtime dependency.
- Every visible string comes from `app/src/lib/i18n/fr.ts` and `en.ts`. The two dictionaries have exactly the same keys. Only the product name "Chip Flashr" and the language names ("Français", "English") are literal.
- Rust sends no user-facing sentence (plan-1 D2, spec D8): board labels are chip names.
- Accessibility: real `<button>` elements, `aria-pressed` on toggles, `aria-label` on icon-only buttons, a 2 px `--cf-ink` focus ring offset by 3 px, and no animation under `prefers-reduced-motion`.
- Version control with **GitButler** (`but`), conventional commits, implementation branch **`feat/design-system`** stacked on `docs/plan-2-design-system`. Never `git add` / `git commit`.
- Deferred on purpose: screens 01–14 content (plans 3 and 5), Markdown rendering (plan 4), watched folders (plan 4), config file (plans 4–5), other settings (plan 5).

## Review Focus

1. **Startup theme and live system change**: with the theme stored as `dark`, the first paint is already dark; with `system`, changing the OS appearance while the app runs switches the theme at once. (Task 1 `resolveTheme` tests, Task 8 `follows the system theme while running`.)
2. **Broken or foreign stored settings** (invalid JSON, `{"locale":"de"}`, `{"theme":42}`, storage that throws): the app starts with the defaults, keeps every valid field, and never crashes. (Task 3 `settings.test.ts`, Task 8 `starts with defaults when the stored settings are broken`.)
3. **Leaving the screen during a flash** (opening Réglages or switching to Expert): the job keeps running and its result is shown on return; it is never cancelled or reset by navigation. (Task 8 `keeps the flash running while settings are open`.)
4. **English mode shows no French**: board names, phases, errors and the instructions sample all follow the language, including text built from Rust data. (Task 2 dictionary parity test, Task 8 `switches to English at once and remembers it`.)
5. **Program pressed twice in a row** (double click, key repeat): exactly one flash job starts. (Task 8 `starts a single job when Programmer is pressed twice`.)

---

## File Structure

```text
app/
├── package.json, pnpm-lock.yaml        # + fonts, testing deps (Task 1)
├── tsconfig.json                       # + resolveJsonModule (Task 4)
├── vite.config.ts                      # jsdom + svelteTesting (Task 1)
└── src/
    ├── main.ts                         # fonts (Task 1), backend (Task 4), theme before mount (Task 8)
    ├── App.svelte                      # adapted (Tasks 2, 4), rewritten as the shell (Task 8)
    ├── App.test.ts                     # integration tests on the browser-preview backend (Task 8)
    ├── test-setup.ts                   # jest-dom matchers (Task 1)
    ├── styles/tokens.css, base.css     # light/dark tokens, motion (Task 1)
    └── lib/
        ├── theme.ts (+ .test.ts)       # resolveTheme, applyTheme (Task 1)
        ├── i18n/locale.ts, fr.ts, en.ts, index.svelte.ts, format.ts, i18n.test.ts   # (Task 2)
        ├── targets.ts (+ .test.ts)     # boardName (Task 2)
        ├── settings.ts (+ .test.ts)    # load/save/parse (Task 3)
        ├── ipc.ts (+ ipc.test.ts)      # Backend interface, tauriBackend, pickBackend (Task 4)
        ├── preview/previewBackend.ts (+ .test.ts)   # TS simulated board (Task 4)
        ├── components/                 # Icon, icons.ts, tones.ts, Button, IconButton, Card, Pill, StatusDot,
        │                               # Tag, SectionLabel, Callout, ProgressBar, Select, Console, ResultHero (Task 5)
        │                               # SegmentedControl, FamilySelector (Task 6), tests beside them
        ├── shell/                      # mode.ts, TopBar, InstructionsPanel, StatusBar, SettingsView,
        │                               # ExpertPlaceholder, shell.test.ts (Task 7)
        └── demo/DemoFlow.svelte        # Simple-mode demo content (Task 8)
crates/flashr-core/src/mock.rs          # neutral board labels (Task 2)
app/src-tauri/src/state.rs              # test follows the new label (Task 2)
README.md, docs/ux-design.md, docs/superpowers/plans/README.md   # (Task 9)
```

`app/src/lib/messages.ts` and `messages.test.ts` are deleted in Task 2: their content moves into the dictionaries.

---

### Task 1: Test tooling, design tokens, local fonts and theme switching

**Files:**
- Modify: `app/package.json` (dependencies), `app/vite.config.ts`, `app/src/main.ts` (font imports), `app/src/styles/tokens.css` (replace), `app/src/styles/base.css` (replace)
- Create: `app/src/test-setup.ts`, `app/src/lib/theme.ts`, `app/src/lib/theme.test.ts`

**Interfaces:**
- Consumes: plan-1 frontend (`App.svelte` keeps working on the new tokens).
- Produces:
  - `theme.ts`: `type ThemePreference = 'system' | 'light' | 'dark'`, `type Theme = 'light' | 'dark'`, `THEME_PREFERENCES: readonly ThemePreference[]`, `DARK_QUERY = '(prefers-color-scheme: dark)'`, `resolveTheme(preference, systemDark: boolean): Theme`, `applyTheme(root: HTMLElement, theme: Theme): void`.
  - CSS tokens `--cf-*` for both themes (names in the spec table plus the plan-1 colours), global keyframes `cf-breathe`, `cf-spin`, `cf-stripes`, `cf-pop`.
  - Vitest in jsdom with `@testing-library/svelte` and jest-dom matchers for every later task.

- [ ] **Step 1: Create the branch and install the dependencies**

```bash
but branch new feat/design-system --above docs/plan-2-design-system
cd app
pnpm add @fontsource-variable/bricolage-grotesque@^5 @fontsource-variable/instrument-sans@^5 @fontsource-variable/jetbrains-mono@^5
pnpm add -D @testing-library/svelte@^5 @testing-library/jest-dom@^7 jsdom
```

Expected: `package.json` gains the three fonts under `dependencies` and the three test packages under `devDependencies`; no peer-dependency warning. If `@testing-library/svelte` warns about a peer, install the major its `peerDependencies` names (`pnpm view @testing-library/svelte peerDependencies`).

`app/vite.config.ts` (replace):

```ts
/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vite';

// Tauri loads the dev server on a fixed port and prints its own logs.
export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: { target: 'es2022' },
  test: {
    // Components need a DOM; pure-logic tests don't mind (spec D12).
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
```

`app/src/test-setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 2: Check the existing tests still pass under jsdom**

Run (in `app/`): `pnpm test`
Expected: 13 tests PASS (the plan-1 `flashState` and `messages` tests), now in the jsdom environment.

- [ ] **Step 3: Write the failing theme tests**

`app/src/lib/theme.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import tokens from '../styles/tokens.css?raw';
import { applyTheme, resolveTheme } from './theme';

/** Body of the first CSS block whose selector list contains `selector`. */
function block(selector: string): string {
  const start = tokens.indexOf(selector);
  expect(start, `selector ${selector} missing from tokens.css`).toBeGreaterThanOrEqual(0);
  const open = tokens.indexOf('{', start);
  return tokens.slice(open + 1, tokens.indexOf('}', open));
}

const names = (css: string) => [...css.matchAll(/(--cf-[a-z0-9-]+)\s*:/g)].map((m) => m[1]).sort();

describe('resolveTheme', () => {
  it('follows the system only when the user chose "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('applyTheme', () => {
  it('sets data-theme on the root element', () => {
    const root = document.createElement('html');
    applyTheme(root, 'dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
    applyTheme(root, 'light');
    expect(root.getAttribute('data-theme')).toBe('light');
  });
});

describe('tokens.css', () => {
  it('defines every themed token for both themes', () => {
    const light = names(block(":root[data-theme='light']"));
    const dark = names(block(":root[data-theme='dark']"));
    expect(light.length).toBeGreaterThan(30);
    expect(dark).toEqual(light);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run (in `app/`): `pnpm vitest run theme`
Expected: FAIL: `Failed to resolve import "./theme"` (and the token test cannot run yet).

- [ ] **Step 5: Write `theme.ts`, the tokens and the base styles**

`app/src/lib/theme.ts`:

```ts
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
```

`app/src/styles/tokens.css` (replace the whole file; values from the spec's token table and ux-design):

```css
/* Theme-independent tokens. */
:root {
  --cf-radius-card: 18px;
  --cf-radius-control: 13px;

  --cf-font-display: 'Bricolage Grotesque Variable', 'Segoe UI', system-ui, sans-serif;
  --cf-font-ui: 'Instrument Sans Variable', 'Segoe UI', system-ui, sans-serif;
  --cf-font-mono: 'JetBrains Mono Variable', ui-monospace, 'Cascadia Mono', Menlo, monospace;
}

/* Light is also the default until main.ts sets data-theme. */
:root,
:root[data-theme='light'] {
  --cf-ground: #e3e1dc;
  --cf-surface: #fbf8f1;
  --cf-surface-2: #f2ede3;
  --cf-surface-3: #e6e0d4;
  --cf-line: #d8d1c3;
  --cf-ink: #1b1a18;
  --cf-muted: #57534c;
  --cf-faint: #67625a;
  --cf-primary: #262420;
  --cf-on-primary: #fbf8f1;
  --cf-selection: #eee4d0;
  --cf-ok: #2c7550;
  --cf-ok-weak: #e1efe3;
  --cf-warn: #945800;
  --cf-warn-weak: #f8ebd3;
  --cf-err: #b0281f;
  --cf-err-weak: #f8e3df;
  --cf-raised: #fbf8f1;
  --cf-raised-line: #e3dbcc;
  --cf-disabled: #dad5cb;
  --cf-on-disabled: #67625a;
  --cf-console: #1f1d1a;
  --cf-on-console: #e6dfd1;

  --cf-shadow-raised: 0 10px 18px -10px rgba(70, 55, 35, 0.45), 0 3px 0 0 #d5cbb8, inset 0 2px 0 #ffffff,
    inset 0 -3px 6px rgba(120, 100, 70, 0.13);
  --cf-shadow-raised-active: 0 2px 6px -4px rgba(70, 55, 35, 0.4), 0 1px 0 0 #d5cbb8,
    inset 0 3px 7px rgba(120, 100, 70, 0.25);
  --cf-shadow-primary: 0 12px 22px -10px rgba(27, 26, 24, 0.55), 0 4px 0 0 #0c0b0a,
    inset 0 2px 0 rgba(255, 255, 255, 0.16), inset 0 -4px 8px rgba(0, 0, 0, 0.38);
  --cf-shadow-primary-active: 0 4px 10px -6px rgba(27, 26, 24, 0.5), 0 1px 0 0 #0c0b0a,
    inset 0 3px 7px rgba(0, 0, 0, 0.5);
  --cf-shadow-sunken: inset 0 3px 9px rgba(110, 90, 60, 0.28), inset 0 -1px 0 rgba(255, 255, 255, 0.8);
  --cf-shadow-card: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 14px 28px -22px rgba(60, 48, 30, 0.45);
  --cf-shadow-tile: inset 0 2px 0 rgba(255, 255, 255, 0.7), inset 0 -3px 6px rgba(120, 100, 70, 0.12);
  --cf-shadow-tile-strong: inset 0 2px 0 rgba(255, 255, 255, 0.14), inset 0 -3px 6px rgba(0, 0, 0, 0.3);

  color-scheme: light;
}

:root[data-theme='dark'] {
  --cf-ground: #151412;
  --cf-surface: #1f1d1a;
  --cf-surface-2: #272420;
  --cf-surface-3: #312d28;
  --cf-line: #3a3530;
  --cf-ink: #f0eadd;
  --cf-muted: #b6aea1;
  --cf-faint: #a8a093;
  --cf-primary: #efe6d3;
  --cf-on-primary: #1b1a18;
  --cf-selection: #3a3329;
  --cf-ok: #6cc794;
  --cf-ok-weak: #1c2e22;
  --cf-warn: #e8ad55;
  --cf-warn-weak: #33280f;
  --cf-err: #f08a7e;
  --cf-err-weak: #3a1d19;
  --cf-raised: #2a2723;
  --cf-raised-line: #3a3530;
  --cf-disabled: #312d28;
  --cf-on-disabled: #a8a093;
  --cf-console: #151412;
  --cf-on-console: #e6dfd1;

  --cf-shadow-raised: 0 10px 18px -10px rgba(0, 0, 0, 0.8), 0 3px 0 0 #0e0d0c, inset 0 1px 0 rgba(255, 255, 255, 0.09),
    inset 0 -3px 6px rgba(0, 0, 0, 0.3);
  --cf-shadow-raised-active: 0 2px 6px -4px rgba(0, 0, 0, 0.7), 0 1px 0 0 #0e0d0c, inset 0 3px 7px rgba(0, 0, 0, 0.45);
  --cf-shadow-primary: 0 12px 22px -10px rgba(0, 0, 0, 0.75), 0 4px 0 0 #b3a68c,
    inset 0 2px 0 rgba(255, 255, 255, 0.75), inset 0 -4px 8px rgba(120, 100, 70, 0.28);
  --cf-shadow-primary-active: 0 4px 10px -6px rgba(0, 0, 0, 0.7), 0 1px 0 0 #b3a68c,
    inset 0 3px 7px rgba(120, 100, 70, 0.4);
  --cf-shadow-sunken: inset 0 3px 9px rgba(0, 0, 0, 0.45), inset 0 -1px 0 rgba(255, 255, 255, 0.05);
  --cf-shadow-card: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 14px 28px -22px rgba(0, 0, 0, 0.8);
  --cf-shadow-tile: inset 0 -3px 6px rgba(0, 0, 0, 0.3);
  --cf-shadow-tile-strong: inset 0 2px 0 rgba(255, 255, 255, 0.14), inset 0 -3px 6px rgba(0, 0, 0, 0.3);

  color-scheme: dark;
}
```

`app/src/styles/base.css` (replace):

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#app {
  margin: 0;
  height: 100%;
}

body {
  background: var(--cf-ground);
  color: var(--cf-ink);
  font-family: var(--cf-font-ui);
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
}

:focus-visible {
  outline: 2px solid var(--cf-ink);
  outline-offset: 3px;
}

/* Motion from the design artifact; components refer to these names. */
@keyframes cf-breathe {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.45;
    transform: scale(0.8);
  }
}

@keyframes cf-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes cf-stripes {
  to {
    background-position: 32px 0;
  }
}

@keyframes cf-pop {
  0% {
    transform: scale(0.55);
    opacity: 0;
  }
  60% {
    transform: scale(1.08);
    opacity: 1;
  }
  100% {
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

Add the fonts at the very top of `app/src/main.ts` (above the existing imports):

```ts
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/jetbrains-mono';
```

- [ ] **Step 6: Run the tests, the checks and the build**

Run (in `app/`): `pnpm test && pnpm check && pnpm build`
Expected: 16 tests PASS (13 + 3 theme), `svelte-check` reports 0 errors and 0 warnings, Vite builds.

Run (in `app/`): `ls dist/assets | grep -c 'woff2$' && ! grep -rq googleapis dist && echo "no remote font"`
Expected: a count of at least 3, then `no remote font`.

- [ ] **Step 7: Commit**

```bash
but commit -b feat/design-system -m "feat(ui): add design tokens, local fonts and theme switching

Light and dark tokens measured on the design artifact, switched by
<html data-theme>. Fonts bundled from @fontsource-variable (no network).
Vitest now runs in jsdom with @testing-library/svelte."
```

---

### Task 2: FR/EN dictionaries and neutral board names

**Files:**
- Create: `app/src/lib/i18n/locale.ts`, `app/src/lib/i18n/fr.ts`, `app/src/lib/i18n/en.ts`, `app/src/lib/i18n/index.svelte.ts`, `app/src/lib/i18n/format.ts`, `app/src/lib/i18n/i18n.test.ts`, `app/src/lib/targets.ts`, `app/src/lib/targets.test.ts`
- Delete: `app/src/lib/messages.ts`, `app/src/lib/messages.test.ts`
- Modify: `app/src/App.svelte` (imports only), `crates/flashr-core/src/mock.rs` (labels), `app/src-tauri/src/state.rs` (test)

**Interfaces:**
- Consumes: `ErrorCode`, `Phase`, `Target` from `app/src/lib/types.ts` (plan 1).
- Produces:
  - `locale.ts`: `type Locale = 'fr' | 'en'`, `LOCALES`, `LANGUAGE_NAMES: Record<Locale, string>`, `isLocale(value: unknown): value is Locale`, `detectLocale(languages: readonly string[]): Locale`.
  - `fr.ts`: `fr` dictionary, `type Messages = typeof fr`, `type StepWithCode = { text: string; code: string }`. `en.ts`: `en: Messages`.
  - `index.svelte.ts`: `locale(): Locale`, `setLocale(next: Locale): void`, `t(): Messages` (reactive in components).
  - `format.ts`: `phaseLabel(phase: Phase | null, m: Messages): string`, `formatSeconds(ms: number, locale: Locale): string`, `formatKib(bytes: number, locale: Locale, m: Messages): string`.
  - `targets.ts`: `boardName(target: Target, m: Messages): string`.
  - Rust: `MockBackend::target(family).label` is `"ESP32-S3" | "STM32F411" | "nRF52840"`.

- [ ] **Step 1: Write the failing dictionary and board-name tests**

`app/src/lib/i18n/i18n.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import type { ErrorCode } from '../types';
import { en } from './en';
import { formatKib, formatSeconds, phaseLabel } from './format';
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
});
```

`app/src/lib/targets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { en } from './i18n/en';
import { fr } from './i18n/fr';
import { boardName } from './targets';

describe('boardName', () => {
  it('names simulated boards in the UI language', () => {
    const target = { id: 'mock:esp32', family: 'esp32', label: 'ESP32-S3' } as const;
    expect(boardName(target, fr)).toBe('Carte simulée · ESP32-S3');
    expect(boardName(target, en)).toBe('Simulated board · ESP32-S3');
  });

  it('keeps the label of a real board as the backend reported it', () => {
    const target = { id: 'serial:COM4', family: 'esp32', label: 'ESP32-S3 · COM4' } as const;
    expect(boardName(target, fr)).toBe('ESP32-S3 · COM4');
  });
});
```

In `app/src-tauri/src/state.rs`, change the expected label in `finds_a_target_by_id_and_rejects_unknown_ids`:

```rust
        assert_eq!(state.find("mock:nrf").map(|(_, t)| t.label), Some("nRF52840".to_string()));
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (in `app/`): `pnpm vitest run i18n targets`
Expected: FAIL: `Failed to resolve import "./en"` / `"./targets"`.

Run (repo root): `cargo test -p chip-flashr finds_a_target`
Expected: FAIL: `left: Some("DK simulé · nRF52840")`, `right: Some("nRF52840")`.

- [ ] **Step 3: Write the dictionaries, the locale store and the formatters**

`app/src/lib/i18n/locale.ts`:

```ts
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
```

`app/src/lib/i18n/fr.ts` (the reference dictionary; the plan-1 error texts are unchanged):

```ts
import type { ErrorCode } from '../types';

type ErrorText = { title: string; explanation: string };

/** A list item that ends with a code chip, such as a connector name. */
export type StepWithCode = { text: string; code: string };

export const fr = {
  topbar: {
    modeGroup: 'Mode d’affichage',
    simple: 'Simple',
    expert: 'Expert',
    settings: 'Réglages',
    noBoard: 'Aucune carte',
  },
  families: {
    label: 'Type de puce',
    esp32: { name: 'ESP32', description: 'Espressif · S2, S3, C3, C6, H2' },
    stm32: { name: 'STM32', description: 'STMicroelectronics · sonde ou USB' },
    nrf: { name: 'nRF', description: 'Nordic · nRF51 à nRF91' },
  },
  board: {
    simulated: (chip: string) => `Carte simulée · ${chip}`,
    connected: (name: string) => `${name} connectée`,
    demoNote: 'Démo : aucune vraie carte n’est programmée.',
  },
  demo: {
    program: 'Programmer',
    hint: 'Environ 5 secondes sur la carte simulée.',
    listError: 'Impossible de lister les cartes.',
  },
  progress: {
    title: 'Programmation en cours',
    barLabel: 'Progression de la programmation',
    cancel: 'Annuler',
    keepPlugged: 'Ne débranchez pas la carte et ne fermez pas l’application.',
  },
  phase: {
    preparing: 'Préparation…',
    connecting: 'Connexion à la carte',
    erasing: 'Effacement des zones',
    writing: (index: number, count: number, label: string) => `Écriture ${index}/${count} · ${label}`,
    verifying: 'Vérification',
    resetting: 'Redémarrage de la carte',
  },
  success: {
    title: 'Programmation réussie',
    body: (board: string) => `${board} est programmée. Vous pouvez la débrancher.`,
    verification: 'Vérification',
    verified: 'Conforme',
    notVerified: 'Non vérifiée',
    duration: 'Durée',
    size: 'Écrit',
    again: 'Programmer une autre carte',
    home: 'Retour à l’accueil',
  },
  failure: {
    details: 'Détails techniques',
    retry: 'Réessayer',
    home: 'Retour à l’accueil',
  },
  errors: {
    cancelled: {
      title: 'Programmation annulée',
      explanation: 'Vous avez arrêté l’opération. Vous pouvez relancer quand vous voulez.',
    },
    'target-not-found': {
      title: 'Carte introuvable',
      explanation: 'La carte a été débranchée ou n’est plus détectée. Rebranchez-la puis réessayez.',
    },
    'invalid-plan': {
      title: 'Firmware invalide',
      explanation: 'Le firmware est incomplet ou ses zones se chevauchent. Demandez un nouveau paquet.',
    },
    'family-mismatch': {
      title: 'Mauvais type de puce',
      explanation: 'Ce firmware ne correspond pas à la carte branchée.',
    },
    'device-error': {
      title: 'La programmation a échoué',
      explanation: 'La carte a cessé de répondre. Elle n’est pas endommagée : vous pouvez relancer.',
    },
    'already-running': {
      title: 'Programmation déjà en cours',
      explanation: 'Attendez la fin de l’opération en cours.',
    },
  } satisfies Record<ErrorCode, ErrorText>,
  units: { kib: 'Ko' },
  instructions: {
    title: 'Instructions',
    live: 'Suivi en direct',
    hide: 'Masquer les instructions',
    show: 'Afficher les instructions',
    hidden: 'Instructions masquées',
    // Sample content until plan 4 renders the real README.
    sample: {
      file: 'LISEZMOI.md',
      heading: 'Mise à jour du thermostat',
      intro: 'Durée : environ 2 minutes. Aucune connaissance technique requise.',
      beforeTitle: 'Avant de commencer',
      before: [
        'Coupez l’alimentation secteur du boîtier.',
        'Utilisez un câble USB-C de données, pas un câble de charge seule.',
      ],
      stepsTitle: 'Étapes',
      steps: [
        'Retirez la trappe arrière (2 vis).',
        { text: 'Branchez le câble sur le connecteur', code: 'J3 · PROG' },
        'Cliquez sur Programmer.',
        'Attendez « Programmation réussie », puis débranchez.',
      ] as (string | StepWithCode)[],
      image: 'Image du README : connecteur J3',
      warning: 'Ne débranchez jamais le câble pendant la programmation.',
      helpTitle: 'Besoin d’aide ?',
      help: '[VOTRE CONTACT SUPPORT]',
    },
  },
  status: {
    demo: 'Démo · carte simulée',
  },
  settings: {
    title: 'Réglages',
    back: 'Retour',
    general: 'Général',
    language: 'Langue',
    theme: 'Thème',
    themeSystem: 'Comme le système',
    themeLight: 'Clair',
    themeDark: 'Sombre',
    about: (version: string) => `Chip Flashr v${version} · Apache-2.0`,
  },
  expert: {
    title: 'Mode Expert',
    body: 'Le mode Expert arrive dans une prochaine version : fichiers et adresses, table de partitions, journal.',
    back: 'Revenir au mode Simple',
  },
};

export type Messages = typeof fr;
```

`app/src/lib/i18n/en.ts` (typed as `Messages`, so a missing or extra key is a type error):

```ts
import type { Messages } from './fr';

export const en: Messages = {
  topbar: {
    modeGroup: 'Display mode',
    simple: 'Simple',
    expert: 'Expert',
    settings: 'Settings',
    noBoard: 'No board',
  },
  families: {
    label: 'Chip type',
    esp32: { name: 'ESP32', description: 'Espressif · S2, S3, C3, C6, H2' },
    stm32: { name: 'STM32', description: 'STMicroelectronics · probe or USB' },
    nrf: { name: 'nRF', description: 'Nordic · nRF51 to nRF91' },
  },
  board: {
    simulated: (chip) => `Simulated board · ${chip}`,
    connected: (name) => `${name} connected`,
    demoNote: 'Demo: no real board is programmed.',
  },
  demo: {
    program: 'Program',
    hint: 'About 5 seconds on the simulated board.',
    listError: 'Could not list the boards.',
  },
  progress: {
    title: 'Programming',
    barLabel: 'Programming progress',
    cancel: 'Cancel',
    keepPlugged: 'Do not unplug the board or close the app.',
  },
  phase: {
    preparing: 'Preparing…',
    connecting: 'Connecting to the board',
    erasing: 'Erasing',
    writing: (index, count, label) => `Writing ${index}/${count} · ${label}`,
    verifying: 'Verifying',
    resetting: 'Restarting the board',
  },
  success: {
    title: 'Programming complete',
    body: (board) => `${board} is programmed. You can unplug it.`,
    verification: 'Verification',
    verified: 'Passed',
    notVerified: 'Not verified',
    duration: 'Duration',
    size: 'Written',
    again: 'Program another board',
    home: 'Back to home',
  },
  failure: {
    details: 'Technical details',
    retry: 'Try again',
    home: 'Back to home',
  },
  errors: {
    cancelled: {
      title: 'Programming cancelled',
      explanation: 'You stopped the operation. You can start again whenever you like.',
    },
    'target-not-found': {
      title: 'Board not found',
      explanation: 'The board was unplugged or is no longer detected. Plug it back in and try again.',
    },
    'invalid-plan': {
      title: 'Invalid firmware',
      explanation: 'The firmware is incomplete or its regions overlap. Ask for a new package.',
    },
    'family-mismatch': {
      title: 'Wrong chip type',
      explanation: 'This firmware does not match the connected board.',
    },
    'device-error': {
      title: 'Programming failed',
      explanation: 'The board stopped responding. It is not damaged: you can try again.',
    },
    'already-running': {
      title: 'Programming already in progress',
      explanation: 'Wait for the current operation to finish.',
    },
  },
  units: { kib: 'KB' },
  instructions: {
    title: 'Instructions',
    live: 'Live',
    hide: 'Hide instructions',
    show: 'Show instructions',
    hidden: 'Instructions hidden',
    sample: {
      file: 'README.md',
      heading: 'Thermostat update',
      intro: 'Takes about 2 minutes. No technical knowledge needed.',
      beforeTitle: 'Before you start',
      before: ['Switch off the mains power to the unit.', 'Use a USB-C data cable, not a charge-only cable.'],
      stepsTitle: 'Steps',
      steps: [
        'Remove the back cover (2 screws).',
        { text: 'Plug the cable into connector', code: 'J3 · PROG' },
        'Click Program.',
        'Wait for “Programming complete”, then unplug.',
      ],
      image: 'README image: connector J3',
      warning: 'Never unplug the cable while programming.',
      helpTitle: 'Need help?',
      help: '[YOUR SUPPORT CONTACT]',
    },
  },
  status: {
    demo: 'Demo · simulated board',
  },
  settings: {
    title: 'Settings',
    back: 'Back',
    general: 'General',
    language: 'Language',
    theme: 'Theme',
    themeSystem: 'Same as system',
    themeLight: 'Light',
    themeDark: 'Dark',
    about: (version) => `Chip Flashr v${version} · Apache-2.0`,
  },
  expert: {
    title: 'Expert mode',
    body: 'Expert mode comes in a later version: files and addresses, partition table, log.',
    back: 'Back to Simple mode',
  },
};
```

`app/src/lib/i18n/index.svelte.ts`:

```ts
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
```

`app/src/lib/i18n/format.ts`:

```ts
import type { Phase } from '../types';
import type { Messages } from './fr';
import type { Locale } from './locale';

export function phaseLabel(phase: Phase | null, m: Messages): string {
  if (!phase) return m.phase.preparing;
  switch (phase.kind) {
    case 'connecting':
      return m.phase.connecting;
    case 'erasing':
      return m.phase.erasing;
    case 'writing':
      return m.phase.writing(phase.index + 1, phase.count, phase.label);
    case 'verifying':
      return m.phase.verifying;
    case 'resetting':
      return m.phase.resetting;
  }
}

/** "4,6 s" / "4.6 s", with a no-break space before the unit. */
export function formatSeconds(ms: number, locale: Locale): string {
  const seconds = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
    ms / 1000,
  );
  return `${seconds} s`;
}

/** Whole KiB with the language's grouping: "1 132 Ko" / "1,132 KB". */
export function formatKib(bytes: number, locale: Locale, m: Messages): string {
  return `${new Intl.NumberFormat(locale).format(Math.round(bytes / 1024))} ${m.units.kib}`;
}
```

`app/src/lib/targets.ts`:

```ts
import type { Messages } from './i18n/fr';
import type { Target } from './types';

/** Simulated boards (`mock:…`) are named as such in the UI language; real ones keep the backend's label (spec D8). */
export function boardName(target: Target, m: Messages): string {
  return target.id.startsWith('mock:') ? m.board.simulated(target.label) : target.label;
}
```

In `crates/flashr-core/src/mock.rs`, replace the label strings in `MockBackend::target`:

```rust
        let (id, label) = match family {
            Family::Esp32 => ("mock:esp32", "ESP32-S3"),
            Family::Stm32 => ("mock:stm32", "STM32F411"),
            Family::Nrf => ("mock:nrf", "nRF52840"),
        };
```

Delete the plan-1 message module, now replaced by the dictionaries:

```bash
rm app/src/lib/messages.ts app/src/lib/messages.test.ts
```

In `app/src/App.svelte` (still the plan-1 screen, replaced in Task 8), swap the import:

```ts
  import { errorMessages, phaseLabel } from './lib/messages';
```

for:

```ts
  import { phaseLabel } from './lib/i18n/format';
  import { t } from './lib/i18n/index.svelte';
```

and, in its markup, replace `errorMessages[flash.error.code]` with `t().errors[flash.error.code]` (two places) and `phaseLabel(flash.phase)` with `phaseLabel(flash.phase, t())`.

- [ ] **Step 4: Run the tests, checks and lint**

Run (in `app/`): `pnpm test && pnpm check`
Expected: 24 tests PASS (16 − 3 removed `messages` tests + 9 in `i18n.test.ts` + 2 in `targets.test.ts`), 0 errors and 0 warnings.

Run (repo root): `cargo fmt && cargo test --workspace && cargo clippy --workspace --all-targets -- -D warnings`
Expected: 38 tests PASS, clippy clean.

- [ ] **Step 5: Commit**

```bash
but commit -b feat/design-system -m "feat(ui): add typed FR/EN dictionaries and neutral board names

fr.ts is the reference; en.ts must match its keys. Plan-1 error texts
and phase labels move there. The Rust mock now reports chip names and
the UI adds \"simulated board\" in the right language."
```

---

### Task 3: Settings kept across restarts

**Files:**
- Create: `app/src/lib/settings.ts`, `app/src/lib/settings.test.ts`

**Interfaces:**
- Consumes: `Locale`, `detectLocale`, `isLocale` (Task 2), `ThemePreference`, `THEME_PREFERENCES` (Task 1).
- Produces: `interface Settings { locale: Locale; theme: ThemePreference }`, `SETTINGS_KEY = 'chip-flashr.settings.v1'`, `interface KeyValueStore { getItem; setItem }`, `defaultSettings(languages)`, `parseSettings(raw, fallback)`, `loadSettings(store, languages)`, `saveSettings(store, settings)`, `browserStore(): KeyValueStore | null`.

- [ ] **Step 1: Write the failing tests**

`app/src/lib/settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  browserStore,
  defaultSettings,
  loadSettings,
  saveSettings,
  SETTINGS_KEY,
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

describe('browserStore', () => {
  it('is the WebView localStorage', () => {
    expect(browserStore()).toBe(window.localStorage);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (in `app/`): `pnpm vitest run settings`
Expected: FAIL: `Failed to resolve import "./settings"`.

- [ ] **Step 3: Implement `settings.ts`**

`app/src/lib/settings.ts`:

```ts
import { detectLocale, isLocale, type Locale } from './i18n/locale';
import { THEME_PREFERENCES, type ThemePreference } from './theme';

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

/** `localStorage`, or null where the WebView refuses access to it. */
export function browserStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the tests and checks**

Run (in `app/`): `pnpm test && pnpm check`
Expected: 33 tests PASS (24 + 9), 0 errors and 0 warnings.

- [ ] **Step 5: Commit**

```bash
but commit -b feat/design-system -m "feat(ui): keep language and theme across restarts

Stored in the WebView localStorage behind loadSettings/saveSettings;
broken, foreign or unreadable data falls back field by field to the
defaults. Plan 5 swaps these two functions for the config file."
```

---
### Task 4: Backend seam and the browser preview

**Files:**
- Modify: `app/src/lib/ipc.ts` (replace), `app/src/App.svelte` (take a `backend` prop), `app/src/main.ts` (pass it), `app/tsconfig.json` (`resolveJsonModule`)
- Create: `app/src/lib/preview/previewBackend.ts`, `app/src/lib/preview/previewBackend.test.ts`, `app/src/lib/ipc.test.ts`

**Interfaces:**
- Consumes: `AppInfo`, `Family`, `FlashReport`, `Phase`, `ProgressEvent`, `Target`, `UserFacingError`, `ErrorCode` from `types.ts`; the Tauri commands from plan 1.
- Produces:
  - `ipc.ts`: `interface Backend { appInfo(); listTargets(); flashDemo(targetId, onProgress); cancelFlash() }` (same shapes as plan 1's functions), `tauriBackend: Backend`, `pickBackend(): Backend`.
  - `previewBackend.ts`: `interface PreviewOptions { chunkDelayMs: number; failAtPercent: number | null }`, `PREVIEW_DEFAULTS = { chunkDelayMs: 15, failAtPercent: null }`, `createPreviewBackend(options): Backend`, `previewOptionsFromSearch(search: string): PreviewOptions`.
  - `App.svelte` takes `{ backend: Backend }`; `main.ts` mounts it with `pickBackend()`.

- [ ] **Step 1: Write the failing tests**

`app/src/lib/preview/previewBackend.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import packageJson from '../../../package.json';
import type { ProgressEvent } from '../types';
import { createPreviewBackend, previewOptionsFromSearch } from './previewBackend';

const fast = { chunkDelayMs: 1, failAtPercent: null };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function recorder() {
  const events: ProgressEvent[] = [];
  return { events, onProgress: (event: ProgressEvent) => events.push(event) };
}

const kinds = (events: ProgressEvent[]) => events.map((event) => event.phase.kind);

describe('createPreviewBackend', () => {
  it('lists the three simulated boards with their chip names', async () => {
    expect(await createPreviewBackend(fast).listTargets()).toEqual([
      { id: 'mock:esp32', family: 'esp32', label: 'ESP32-S3' },
      { id: 'mock:stm32', family: 'stm32', label: 'STM32F411' },
      { id: 'mock:nrf', family: 'nrf', label: 'nRF52840' },
    ]);
  });

  it('reports the app version like the desktop app', async () => {
    expect(await createPreviewBackend(fast).appInfo()).toEqual({ name: 'Chip Flashr', version: packageJson.version });
  });

  it('follows the progress contract and ends at the total', async () => {
    const { events, onProgress } = recorder();
    const job = createPreviewBackend(fast).flashDemo('mock:nrf', onProgress);
    const outcome = expect(job).resolves.toMatchObject({ bytesWritten: 300 * 1024, verified: true });
    await vi.runAllTimersAsync();
    await outcome;
    expect(kinds(events)).toEqual(['connecting', 'erasing', ...Array(75).fill('writing'), 'verifying', 'resetting']);
    const done = events.map((event) => event.bytesDone);
    expect(done.every((value, i) => i === 0 || done[i - 1] <= value)).toBe(true);
    expect(events.at(-1)?.bytesDone).toBe(300 * 1024);
  });

  it('stops within one chunk when cancelled and never reports success', async () => {
    const backend = createPreviewBackend(fast);
    const { events, onProgress } = recorder();
    const job = backend.flashDemo('mock:esp32', onProgress);
    const outcome = expect(job).rejects.toEqual({ code: 'cancelled', technical: 'cancelled by the user' });
    await vi.advanceTimersByTimeAsync(10);
    const before = events.length;
    expect(await backend.cancelFlash()).toBe(true);
    await vi.runAllTimersAsync();
    await outcome;
    expect(events.length - before).toBeLessThanOrEqual(1);
    expect(kinds(events)).not.toContain('resetting');
  });

  it('fails like a lost board at the requested percentage', async () => {
    const { events, onProgress } = recorder();
    const job = createPreviewBackend({ chunkDelayMs: 1, failAtPercent: 50 }).flashDemo('mock:esp32', onProgress);
    const outcome = expect(job).rejects.toEqual({ code: 'device-error', technical: 'device error: simulated disconnect' });
    await vi.runAllTimersAsync();
    await outcome;
    const last = events.at(-1)!;
    expect(last.bytesDone * 100).toBeLessThan(50 * last.bytesTotal);
  });

  it('refuses a second job while one runs, and frees the slot after a failure', async () => {
    const backend = createPreviewBackend({ chunkDelayMs: 1, failAtPercent: 10 });
    const first = expect(backend.flashDemo('mock:nrf', () => {})).rejects.toMatchObject({ code: 'device-error' });
    await expect(backend.flashDemo('mock:stm32', () => {})).rejects.toMatchObject({ code: 'already-running' });
    await vi.runAllTimersAsync();
    await first;
    const again = expect(backend.flashDemo('mock:nrf', () => {})).rejects.toMatchObject({ code: 'device-error' });
    await vi.runAllTimersAsync();
    await again;
  });

  it('rejects an unknown board without any progress', async () => {
    const { events, onProgress } = recorder();
    await expect(createPreviewBackend(fast).flashDemo('serial:COM9', onProgress)).rejects.toEqual({
      code: 'target-not-found',
      technical: 'unknown target `serial:COM9`',
    });
    expect(events).toEqual([]);
  });

  it('has nothing to cancel when idle', async () => {
    expect(await createPreviewBackend(fast).cancelFlash()).toBe(false);
  });
});

describe('previewOptionsFromSearch', () => {
  it('reads a failure percentage from ?failAt=', () => {
    expect(previewOptionsFromSearch('?failAt=41')).toEqual({ chunkDelayMs: 15, failAtPercent: 41 });
    expect(previewOptionsFromSearch('?failAt=0').failAtPercent).toBe(0);
  });

  it('ignores anything that is not a whole percentage', () => {
    for (const search of ['', '?failAt=', '?failAt=150', '?failAt=abc', '?failAt=4.5', '?failAt=-1']) {
      expect(previewOptionsFromSearch(search).failAtPercent, search).toBeNull();
    }
  });
});
```

`app/src/lib/ipc.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickBackend, tauriBackend } from './ipc';

afterEach(() => vi.unstubAllGlobals());

describe('pickBackend', () => {
  it('uses the simulated board when a dev build runs in a plain browser', async () => {
    const backend = pickBackend();
    expect(backend).not.toBe(tauriBackend);
    expect((await backend.listTargets()).map((target) => target.id)).toEqual(['mock:esp32', 'mock:stm32', 'mock:nrf']);
  });

  it('uses Tauri IPC inside the desktop app', () => {
    vi.stubGlobal('isTauri', true);
    expect(pickBackend()).toBe(tauriBackend);
  });
});
```

In `app/tsconfig.json`, add `"resolveJsonModule": true` to `compilerOptions` (the preview reads the version from `package.json`).

- [ ] **Step 2: Run the tests to verify they fail**

Run (in `app/`): `pnpm vitest run preview ipc`
Expected: FAIL: `Failed to resolve import "./previewBackend"`, and `pickBackend` / `tauriBackend` are not exported by `./ipc`.

- [ ] **Step 3: Implement the seam and the preview**

`app/src/lib/ipc.ts` (replace):

```ts
import { Channel, invoke, isTauri } from '@tauri-apps/api/core';
import { createPreviewBackend, previewOptionsFromSearch } from './preview/previewBackend';
import type { AppInfo, FlashReport, ProgressEvent, Target } from './types';

/** What the UI needs from the Rust core: Tauri IPC in the app, a TypeScript copy in the browser preview. */
export interface Backend {
  appInfo(): Promise<AppInfo>;
  listTargets(): Promise<Target[]>;
  /** Program the demo plan on a target; progress arrives on `onProgress`. Rejects with a UserFacingError. */
  flashDemo(targetId: string, onProgress: (event: ProgressEvent) => void): Promise<FlashReport>;
  /** False when nothing is running. */
  cancelFlash(): Promise<boolean>;
}

export const tauriBackend: Backend = {
  appInfo: () => invoke<AppInfo>('app_info'),
  listTargets: () => invoke<Target[]>('list_targets'),
  cancelFlash: () => invoke<boolean>('cancel_flash'),
  flashDemo(targetId, onProgress) {
    const channel = new Channel<ProgressEvent>();
    channel.onmessage = onProgress;
    return invoke<FlashReport>('flash_demo', { targetId, onProgress: channel });
  },
};

/** Tauri IPC inside the app; in a development build opened in a plain browser, the simulated board (spec D9). */
export function pickBackend(): Backend {
  if (!isTauri() && import.meta.env.DEV) {
    return createPreviewBackend(previewOptionsFromSearch(window.location.search));
  }
  return tauriBackend;
}
```

`app/src/lib/preview/previewBackend.ts`:

```ts
import packageJson from '../../../package.json';
import type { Backend } from '../ipc';
import type { ErrorCode, Family, Phase, UserFacingError } from '../types';

export interface PreviewOptions {
  /** Pause per 4 KiB chunk, like the Rust mock's `chunk_delay`. */
  chunkDelayMs: number;
  /** Fail like a lost board once this share is written, like `CHIP_FLASHR_MOCK_FAIL_AT`. */
  failAtPercent: number | null;
}

export const PREVIEW_DEFAULTS: PreviewOptions = { chunkDelayMs: 15, failAtPercent: null };

const CHUNK = 4096;
const KIB = 1024;

type Region = { address: number; label: string; size: number };

/** The same boards and demo plans as the Rust mock (crates/flashr-core/src/mock.rs). */
const BOARDS: Record<Family, { chip: string; regions: Region[] }> = {
  esp32: {
    chip: 'ESP32-S3',
    regions: [
      { address: 0x0, label: 'bootloader.bin', size: 21 * KIB },
      { address: 0x8000, label: 'partition-table.bin', size: 3 * KIB },
      { address: 0xd000, label: 'ota_data_initial.bin', size: 8 * KIB },
      { address: 0x1_0000, label: 'thermostat.bin', size: 1100 * KIB },
    ],
  },
  stm32: { chip: 'STM32F411', regions: [{ address: 0x0800_0000, label: 'passerelle.bin', size: 450 * KIB }] },
  nrf: { chip: 'nRF52840', regions: [{ address: 0x0, label: 'capteur-porte.hex', size: 300 * KIB }] },
};

const FAMILIES: readonly Family[] = ['esp32', 'stm32', 'nrf'];

const failure = (code: ErrorCode, technical: string): UserFacingError => ({ code, technical });

/** `?failAt=41` makes the board fail at 41 %; anything that is not a whole 0–100 is ignored. */
export function previewOptionsFromSearch(search: string): PreviewOptions {
  const raw = new URLSearchParams(search).get('failAt')?.trim() ?? '';
  const value = Number(raw);
  const valid = raw !== '' && Number.isInteger(value) && value >= 0 && value <= 100;
  return { ...PREVIEW_DEFAULTS, failAtPercent: valid ? value : null };
}

/** A TypeScript copy of the simulated board, for `pnpm dev` in a plain browser (spec D9). */
export function createPreviewBackend(options: PreviewOptions): Backend {
  let running = false;
  let cancelRequested = false;

  // Checked before every pause, like the Rust mock: a cancel acts within one chunk.
  async function pause(): Promise<void> {
    if (cancelRequested) throw failure('cancelled', 'cancelled by the user');
    await new Promise<void>((resolve) => setTimeout(resolve, options.chunkDelayMs));
  }

  return {
    appInfo: async () => ({ name: 'Chip Flashr', version: packageJson.version }),
    listTargets: async () => FAMILIES.map((family) => ({ id: `mock:${family}`, family, label: BOARDS[family].chip })),
    cancelFlash: async () => {
      if (!running) return false;
      cancelRequested = true;
      return true;
    },
    async flashDemo(targetId, onProgress) {
      const family = FAMILIES.find((candidate) => `mock:${candidate}` === targetId);
      if (!family) throw failure('target-not-found', `unknown target \`${targetId}\``);
      if (running) throw failure('already-running', 'a flash job is already running');
      running = true;
      cancelRequested = false;
      const started = Date.now();
      try {
        const regions = BOARDS[family].regions;
        const total = regions.reduce((sum, region) => sum + region.size, 0);
        const emit = (phase: Phase, bytesDone: number) => onProgress({ phase, bytesDone, bytesTotal: total });

        emit({ kind: 'connecting' }, 0);
        await pause();
        emit({ kind: 'erasing' }, 0);
        await pause();

        let done = 0;
        for (const [index, region] of regions.entries()) {
          for (let offset = 0; offset < region.size; offset += CHUNK) {
            await pause();
            done += Math.min(CHUNK, region.size - offset);
            if (options.failAtPercent !== null && done * 100 >= options.failAtPercent * total) {
              throw failure('device-error', 'device error: simulated disconnect');
            }
            const phase: Phase = { kind: 'writing', index, count: regions.length, label: region.label, address: region.address };
            emit(phase, done);
          }
        }

        emit({ kind: 'verifying' }, done);
        await pause();
        emit({ kind: 'resetting' }, done);
        return { bytesWritten: done, durationMs: Date.now() - started, verified: true };
      } finally {
        running = false;
        cancelRequested = false;
      }
    },
  };
}
```

Adapt the plan-1 `app/src/App.svelte` (replaced in Task 8) to receive the backend. Replace:

```ts
  import { appInfo, cancelFlash, flashDemo, listTargets } from './lib/ipc';
```

with:

```ts
  import type { Backend } from './lib/ipc';
```

add, right after the imports:

```ts
  let { backend }: { backend: Backend } = $props();
```

then replace `await appInfo()` with `await backend.appInfo()`, `await listTargets()` with `await backend.listTargets()`, `await flashDemo(` with `await backend.flashDemo(`, and `onclick={() => cancelFlash()}` with `onclick={() => backend.cancelFlash()}`.

In `app/src/main.ts`, import the picker and pass it to the app. Add below the `App` import:

```ts
import { pickBackend } from './lib/ipc';
```

and replace `export default mount(App, { target });` with:

```ts
export default mount(App, { target, props: { backend: pickBackend() } });
```

- [ ] **Step 4: Run the tests and checks, then try the preview**

Run (in `app/`): `pnpm test && pnpm check && pnpm build`
Expected: 45 tests PASS (33 + 10 preview + 2 ipc), 0 errors and 0 warnings, Vite builds.

Run (in `app/`): `! grep -rq 'simulated disconnect' dist && echo "preview not shipped"`
Expected: `preview not shipped` (the release bundle drops the preview code).

Run (in `app/`): `pnpm dev`, open `http://localhost:5173/` in a browser.
Expected: the plan-1 demo screen lists three boards (`ESP32-S3`, `STM32F411`, `nRF52840`); Programmer runs to "Programmation réussie" in about 5 s. With `http://localhost:5173/?failAt=41` it stops near 40 % with "La programmation a échoué". Stop the server.

- [ ] **Step 5: Commit**

```bash
but commit -b feat/design-system -m "feat(ui): add a backend seam and a browser preview

App receives a Backend: Tauri IPC in the desktop app, or in a dev build
opened in a plain browser, a TypeScript copy of the simulated board
(same plans, chunking, cancel and ?failAt= failure). Dropped from
release bundles."
```

---

### Task 5: Icons and clay primitives

**Files:**
- Create in `app/src/lib/components/`: `icons.ts`, `tones.ts`, `Icon.svelte`, `Button.svelte`, `IconButton.svelte`, `Card.svelte`, `StatusDot.svelte`, `Pill.svelte`, `Tag.svelte`, `SectionLabel.svelte`, `Callout.svelte`, `ProgressBar.svelte`, `Select.svelte`, `Console.svelte`, `ResultHero.svelte`, `components.test.ts`

**Interfaces:**
- Consumes: the tokens and keyframes from Task 1.
- Produces (props; every `children` is a Svelte `Snippet`):
  - `ICONS` (29 entries) and `type IconName`; `Icon { name: IconName; size?: number = 18; strokeWidth?: number = 1.75 }` renders `<svg data-icon={name} aria-hidden="true">`.
  - `type Tone = 'ok' | 'warn' | 'err' | 'idle'` (`tones.ts`).
  - `Button { variant?: 'primary' | 'secondary' | 'ghost' = 'secondary'; size?: 'md' | 'lg' = 'md'; icon?: IconName; wide?: boolean; disabled?: boolean; onclick?: () => void; children }`.
  - `IconButton { icon: IconName; label: string; small?: boolean; onclick?: () => void }` (38 px, 34 px when `small`).
  - `Card { padding?: number = 20; gap?: number = 14; children }`.
  - `StatusDot { tone: Tone; size?: number = 8; breathe?: boolean }`, `Pill { tone: Tone; breathe?: boolean; children }`, `Tag { mono?: boolean; children }`, `SectionLabel { children }` (an `<h2>`).
  - `Callout { tone?: 'warning' | 'info' = 'warning'; children }`.
  - `ProgressBar { value: number; label: string; size?: 'lg' | 'sm' = 'lg' }` (role `progressbar`, value clamped to a whole 0–100).
  - `Select<T extends string> { id: string; options: readonly { value: T; label: string }[]; value: T; onchange: (value: T) => void }`.
  - `Console { lines: readonly string[] }`, `ResultHero { tone: 'success' | 'failure' | 'neutral'; title: string; children }` (an `<h1>` title).

- [ ] **Step 1: Write the failing tests**

`app/src/lib/components/components.test.ts`:

```ts
import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import Button from './Button.svelte';
import Console from './Console.svelte';
import Icon from './Icon.svelte';
import IconButton from './IconButton.svelte';
import { ICONS, type IconName } from './icons';
import Pill from './Pill.svelte';
import ProgressBar from './ProgressBar.svelte';
import ResultHero from './ResultHero.svelte';
import Select from './Select.svelte';

const text = (content: string) => createRawSnippet(() => ({ render: () => `<span>${content}</span>` }));

describe('Icon', () => {
  it('draws every design icon, hidden from screen readers', () => {
    const names = Object.keys(ICONS) as IconName[];
    expect(names).toHaveLength(29);
    for (const name of names) {
      const { container, unmount } = render(Icon, { name });
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg?.children).toHaveLength(ICONS[name].length);
      unmount();
    }
  });
});

describe('Button', () => {
  it('calls onclick and is named by its label', async () => {
    const onclick = vi.fn();
    render(Button, { variant: 'primary', size: 'lg', icon: 'zap', onclick, children: text('Programmer') });
    await fireEvent.click(screen.getByRole('button', { name: 'Programmer' }));
    expect(onclick).toHaveBeenCalledOnce();
  });

  it('does nothing when disabled', async () => {
    const onclick = vi.fn();
    render(Button, { disabled: true, onclick, children: text('Programmer') });
    const button = screen.getByRole('button', { name: 'Programmer' });
    expect(button).toBeDisabled();
    await fireEvent.click(button);
    expect(onclick).not.toHaveBeenCalled();
  });
});

describe('IconButton', () => {
  it('is named by its label', async () => {
    const onclick = vi.fn();
    render(IconButton, { icon: 'sliders', label: 'Réglages', onclick });
    await fireEvent.click(screen.getByRole('button', { name: 'Réglages' }));
    expect(onclick).toHaveBeenCalledOnce();
  });
});

describe('Pill', () => {
  it('shows its text next to a status dot', () => {
    const { container } = render(Pill, { tone: 'ok', breathe: true, children: text('Carte simulée · ESP32-S3') });
    expect(screen.getByText('Carte simulée · ESP32-S3')).toBeInTheDocument();
    expect(container.querySelector('.dot.ok.breathe')).not.toBeNull();
  });
});

describe('ProgressBar', () => {
  it('exposes a whole percentage clamped to 0–100', async () => {
    const { rerender } = render(ProgressBar, { value: 42.4, label: 'Progression' });
    const bar = screen.getByRole('progressbar', { name: 'Progression' });
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect((bar.firstElementChild as HTMLElement).style.width).toBe('42%');
    await rerender({ value: 150, label: 'Progression' });
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    await rerender({ value: -5, label: 'Progression' });
    expect(bar).toHaveAttribute('aria-valuenow', '0');
  });
});

describe('Select', () => {
  it('shows the current value and reports a new choice', async () => {
    const onchange = vi.fn();
    const options = [
      { value: 'fr', label: 'Français' },
      { value: 'en', label: 'English' },
    ];
    render(Select, { id: 'language', options, value: 'fr', onchange });
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('fr');
    await fireEvent.change(select, { target: { value: 'en' } });
    expect(onchange).toHaveBeenCalledWith('en');
  });
});

describe('Console', () => {
  it('prints one line per entry', () => {
    const { container } = render(Console, { lines: ['write block 212/512', 'error: timed out'] });
    expect(container.querySelectorAll('.console > div')).toHaveLength(2);
    expect(screen.getByText('error: timed out')).toBeInTheDocument();
  });
});

describe('ResultHero', () => {
  it('titles the result and explains it', () => {
    render(ResultHero, { tone: 'success', title: 'Programmation réussie', children: text('Vous pouvez débrancher.') });
    expect(screen.getByRole('heading', { level: 1, name: 'Programmation réussie' })).toBeInTheDocument();
    expect(screen.getByText('Vous pouvez débrancher.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (in `app/`): `pnpm vitest run components`
Expected: FAIL: `Failed to resolve import "./Button.svelte"` (and the other components).

- [ ] **Step 3: Write the icons and the components**

`app/src/lib/components/icons.ts` (the 29 icons drawn in the design artifact, same paths):

```ts
/** One SVG element of an icon, on a 24 × 24 grid. */
export type Shape =
  | readonly ['path', string]
  | readonly ['circle', number, number, number]
  | readonly ['rect', number, number, number, number, number];

export const ICONS = {
  chip: [
    ['rect', 6, 6, 12, 12, 2],
    ['path', 'M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4'],
  ],
  sliders: [
    ['path', 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12'],
    ['circle', 16, 6, 2],
    ['circle', 10, 12, 2],
    ['circle', 18, 18, 2],
  ],
  chevronRight: [['path', 'm9 6 6 6-6 6']],
  chevronLeft: [['path', 'm15 6-6 6 6 6']],
  refresh: [
    ['path', 'M20 12a8 8 0 1 1-2.34-5.66L20 8.5'],
    ['path', 'M20 3.5v5h-5'],
  ],
  zap: [['path', 'M13 2 4 14h7l-1 8 9-12h-7z']],
  book: [
    ['path', 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z'],
    ['path', 'M4 21V5M8 7h7M8 11h5'],
  ],
  panelRight: [
    ['rect', 3, 4, 18, 16, 2],
    ['path', 'M15 4v16'],
  ],
  file: [
    ['path', 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z'],
    ['path', 'M14 3v5h5'],
  ],
  warning: [
    ['path', 'M12 3.5 2.5 20h19z'],
    ['path', 'M12 10v4.5M12 17.2v.3'],
  ],
  eye: [
    ['path', 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z'],
    ['circle', 12, 12, 3],
  ],
  info: [
    ['circle', 12, 12, 9],
    ['path', 'M12 11v5.5M12 7.7v.3'],
  ],
  plug: [['path', 'M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5']],
  folder: [
    ['path', 'M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z'],
  ],
  check: [['path', 'M20 6 9 17l-5-5']],
  package: [
    ['path', 'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z'],
    ['path', 'M3 7.5 12 12l9-4.5M12 12v9'],
  ],
  download: [['path', 'M12 4v11M7 10l5 5 5-5M5 20h14']],
  upload: [['path', 'M12 16V5M7 10l5-5 5 5M5 20h14']],
  externalLink: [
    ['path', 'M14 4h6v6M20 4l-9 9'],
    ['path', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
  ],
  circleCheck: [
    ['circle', 12, 12, 9],
    ['path', 'm8 12 3 3 5-6'],
  ],
  circleX: [
    ['circle', 12, 12, 9],
    ['path', 'm9 9 6 6M15 9l-6 6'],
  ],
  plus: [['path', 'M12 5v14M5 12h14']],
  trash: [['path', 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3']],
  terminal: [
    ['rect', 3, 4, 18, 16, 2],
    ['path', 'm7 9 3 3-3 3M13 15h4'],
  ],
  search: [
    ['circle', 11, 11, 7],
    ['path', 'm20 20-4-4'],
  ],
  clock: [
    ['circle', 12, 12, 9],
    ['path', 'M12 7v5l3 2'],
  ],
  x: [['path', 'M6 6l12 12M18 6 6 18']],
  lock: [
    ['rect', 5, 11, 14, 10, 1.5],
    ['path', 'M8 11V7a4 4 0 0 1 8 0v4'],
  ],
  copy: [
    ['rect', 8, 8, 12, 12, 1.5],
    ['path', 'M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3'],
  ],
} satisfies Record<string, readonly Shape[]>;

export type IconName = keyof typeof ICONS;
```

`app/src/lib/components/tones.ts`:

```ts
/** Status colours. Always paired with text: colour is never the only signal (ux-design). */
export type Tone = 'ok' | 'warn' | 'err' | 'idle';
```

`app/src/lib/components/Icon.svelte`:

```svelte
<script lang="ts">
  import { ICONS, type IconName } from './icons';

  let { name, size = 18, strokeWidth = 1.75 }: { name: IconName; size?: number; strokeWidth?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  data-icon={name}
>
  {#each ICONS[name] as shape, i (i)}
    {#if shape[0] === 'path'}
      <path d={shape[1]} />
    {:else if shape[0] === 'circle'}
      <circle cx={shape[1]} cy={shape[2]} r={shape[3]} />
    {:else}
      <rect x={shape[1]} y={shape[2]} width={shape[3]} height={shape[4]} rx={shape[5]} />
    {/if}
  {/each}
</svg>

<style>
  svg {
    flex-shrink: 0;
  }
</style>
```

`app/src/lib/components/Button.svelte` (clay button: lifts on hover, sinks on press):

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  let {
    variant = 'secondary',
    size = 'md',
    icon,
    wide = false,
    disabled = false,
    onclick,
    children,
  }: {
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'md' | 'lg';
    icon?: IconName;
    wide?: boolean;
    disabled?: boolean;
    onclick?: () => void;
    children: Snippet;
  } = $props();
</script>

<button type="button" class="button {variant} {size}" class:wide {disabled} {onclick}>
  {#if icon}
    <Icon name={icon} size={size === 'lg' ? 22 : 17} strokeWidth={size === 'lg' ? 2 : 1.75} />
  {/if}
  {@render children()}
</button>

<style>
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    white-space: nowrap;
    cursor: pointer;
    transition:
      transform 0.18s cubic-bezier(0.3, 1.6, 0.5, 1),
      box-shadow 0.18s ease,
      background-color 0.18s ease;
  }
  .md {
    height: 42px;
    padding: 0 18px;
    border-radius: 13px;
    font: 600 14px/1 var(--cf-font-ui);
  }
  .lg {
    height: 64px;
    padding: 0 26px;
    border-radius: 18px;
    font: 700 19px/1 var(--cf-font-display);
    letter-spacing: -0.01em;
  }
  .wide {
    width: 100%;
  }
  .primary {
    border: 1px solid var(--cf-primary);
    background: var(--cf-primary);
    color: var(--cf-on-primary);
    box-shadow: var(--cf-shadow-primary);
  }
  .secondary {
    border: 1px solid var(--cf-raised-line);
    background: var(--cf-raised);
    color: var(--cf-ink);
    box-shadow: var(--cf-shadow-raised);
  }
  .ghost {
    border: 1px solid transparent;
    background: transparent;
    color: var(--cf-ink);
  }
  .primary:hover:enabled,
  .secondary:hover:enabled {
    transform: translateY(-2px);
  }
  .primary:active:enabled {
    transform: translateY(3px);
    box-shadow: var(--cf-shadow-primary-active);
  }
  .secondary:active:enabled {
    transform: translateY(2px);
    box-shadow: var(--cf-shadow-raised-active);
  }
  .ghost:hover:enabled {
    background: var(--cf-surface-3);
  }
  .button:disabled {
    border-color: var(--cf-disabled);
    background: var(--cf-disabled);
    color: var(--cf-on-disabled);
    box-shadow: none;
    cursor: not-allowed;
  }
</style>
```

`app/src/lib/components/IconButton.svelte`:

```svelte
<script lang="ts">
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  let {
    icon,
    label,
    small = false,
    onclick,
  }: { icon: IconName; label: string; small?: boolean; onclick?: () => void } = $props();
</script>

<button type="button" class="icon-button" class:small aria-label={label} title={label} {onclick}>
  <Icon name={icon} size={18} />
</button>

<style>
  .icon-button {
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    border: 1px solid var(--cf-raised-line);
    background: var(--cf-raised);
    color: var(--cf-muted);
    box-shadow: var(--cf-shadow-raised);
    cursor: pointer;
    transition:
      transform 0.18s cubic-bezier(0.3, 1.6, 0.5, 1),
      box-shadow 0.18s ease;
  }
  .icon-button:hover {
    transform: translateY(-2px);
  }
  .icon-button:active {
    transform: translateY(2px);
    box-shadow: var(--cf-shadow-raised-active);
  }
  .small {
    width: 34px;
    height: 34px;
  }
</style>
```

`app/src/lib/components/Card.svelte`:

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  let { padding = 20, gap = 14, children }: { padding?: number; gap?: number; children: Snippet } = $props();
</script>

<div class="card" style:padding="{padding}px" style:gap="{gap}px">
  {@render children()}
</div>

<style>
  .card {
    display: flex;
    flex-direction: column;
    background: var(--cf-surface);
    border: 1px solid var(--cf-line);
    border-radius: var(--cf-radius-card);
    box-shadow: var(--cf-shadow-card);
  }
</style>
```

`app/src/lib/components/StatusDot.svelte`:

```svelte
<script lang="ts">
  import type { Tone } from './tones';

  let { tone, size = 8, breathe = false }: { tone: Tone; size?: number; breathe?: boolean } = $props();
</script>

<span class="dot {tone}" class:breathe style:width="{size}px" style:height="{size}px"></span>

<style>
  .dot {
    display: inline-block;
    flex-shrink: 0;
    border-radius: 50%;
  }
  .ok {
    background: var(--cf-ok);
  }
  .warn {
    background: var(--cf-warn);
  }
  .err {
    background: var(--cf-err);
  }
  .idle {
    background: var(--cf-faint);
  }
  .breathe {
    animation: cf-breathe 2.2s ease-in-out infinite;
  }
</style>
```

`app/src/lib/components/Pill.svelte`:

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  import StatusDot from './StatusDot.svelte';
  import type { Tone } from './tones';

  let { tone, breathe = false, children }: { tone: Tone; breathe?: boolean; children: Snippet } = $props();
</script>

<span class="pill">
  <StatusDot {tone} {breathe} />
  <span>{@render children()}</span>
</span>

<style>
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 34px;
    padding: 0 14px;
    border-radius: 999px;
    background: var(--cf-surface-2);
    border: 1px solid var(--cf-line);
    color: var(--cf-ink);
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
  }
</style>
```

`app/src/lib/components/Tag.svelte`:

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  let { mono = false, children }: { mono?: boolean; children: Snippet } = $props();
</script>

<span class="tag" class:mono>{@render children()}</span>

<style>
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 9px;
    border-radius: 999px;
    background: var(--cf-surface-2);
    border: 1px solid var(--cf-line);
    color: var(--cf-muted);
    font: 500 12px var(--cf-font-ui);
    white-space: nowrap;
  }
  .mono {
    font-family: var(--cf-font-mono);
  }
</style>
```

`app/src/lib/components/SectionLabel.svelte`:

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<h2 class="section-label">{@render children()}</h2>

<style>
  .section-label {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--cf-faint);
  }
</style>
```

`app/src/lib/components/Callout.svelte`:

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  let { tone = 'warning', children }: { tone?: 'warning' | 'info'; children: Snippet } = $props();
</script>

<div class="callout {tone}">
  <span class="icon"><Icon name={tone === 'warning' ? 'warning' : 'info'} size={17} /></span>
  <span>{@render children()}</span>
</div>

<style>
  .callout {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 12px 14px;
    border-radius: 14px;
    color: var(--cf-ink);
    font-size: 14px;
    line-height: 1.5;
  }
  .icon {
    display: flex;
    padding-top: 1px;
  }
  .warning {
    background: var(--cf-warn-weak);
  }
  .warning .icon {
    color: var(--cf-warn);
  }
  .info {
    background: var(--cf-surface-2);
  }
  .info .icon {
    color: var(--cf-muted);
  }
</style>
```

`app/src/lib/components/ProgressBar.svelte` (the striped bar; the white stripe is the artifact's `rgba(255,255,255,.14)`):

```svelte
<script lang="ts">
  let { value, label, size = 'lg' }: { value: number; label: string; size?: 'lg' | 'sm' } = $props();

  const percent = $derived(Math.min(100, Math.max(0, Math.round(value))));
</script>

<div
  class="track {size}"
  role="progressbar"
  aria-label={label}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={percent}
>
  <div class="fill" style:width="{percent}%"></div>
</div>

<style>
  .track {
    border-radius: 999px;
    background: var(--cf-surface-3);
    box-shadow: var(--cf-shadow-sunken);
    overflow: hidden;
  }
  .lg {
    height: 14px;
  }
  .sm {
    height: 6px;
  }
  .fill {
    height: 100%;
    border-radius: 999px;
    background-color: var(--cf-primary);
    background-image: repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.14) 0 8px, transparent 8px 16px);
    background-size: 32px 100%;
    animation: cf-stripes 0.9s linear infinite;
    transition: width 0.15s linear;
  }
</style>
```

`app/src/lib/components/Select.svelte`:

```svelte
<script lang="ts" generics="T extends string">
  let {
    id,
    options,
    value,
    onchange,
  }: {
    id: string;
    options: readonly { value: T; label: string }[];
    value: T;
    onchange: (value: T) => void;
  } = $props();
</script>

<select {id} class="select" {value} onchange={(event) => onchange(event.currentTarget.value as T)}>
  {#each options as option (option.value)}
    <option value={option.value}>{option.label}</option>
  {/each}
</select>

<style>
  .select {
    height: 38px;
    min-width: 210px;
    padding: 0 12px;
    border-radius: 12px;
    border: 1px solid var(--cf-line);
    background: var(--cf-surface-2);
    box-shadow: var(--cf-shadow-sunken);
    color: var(--cf-ink);
    font: 13px var(--cf-font-ui);
  }
</style>
```

`app/src/lib/components/Console.svelte`:

```svelte
<script lang="ts">
  let { lines }: { lines: readonly string[] } = $props();
</script>

<div class="console">
  {#each lines as line, i (i)}
    <div>{line}</div>
  {/each}
</div>

<style>
  .console {
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--cf-console);
    color: var(--cf-on-console);
    font: 12.5px/1.6 var(--cf-font-mono);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
```

`app/src/lib/components/ResultHero.svelte` (the badge glow uses the tone colour, as in the artifact):

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  let {
    tone,
    title,
    children,
  }: { tone: 'success' | 'failure' | 'neutral'; title: string; children: Snippet } = $props();
</script>

<div class="hero">
  <div class="badge {tone}">
    <Icon name={tone === 'success' ? 'circleCheck' : 'circleX'} size={48} strokeWidth={1.9} />
  </div>
  <h1>{title}</h1>
  <p>{@render children()}</p>
</div>

<style>
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 12px 0 4px;
    text-align: center;
  }
  .badge {
    --glow: var(--cf-faint);
    width: 96px;
    height: 96px;
    border-radius: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow:
      inset 0 2px 0 rgba(255, 255, 255, 0.6),
      inset 0 -4px 10px rgba(0, 0, 0, 0.08),
      0 16px 30px -18px var(--glow);
    animation: cf-pop 0.6s cubic-bezier(0.3, 1.6, 0.5, 1) both;
  }
  .success {
    --glow: var(--cf-ok);
    background: var(--cf-ok-weak);
    color: var(--cf-ok);
  }
  .failure {
    --glow: var(--cf-err);
    background: var(--cf-err-weak);
    color: var(--cf-err);
  }
  .neutral {
    background: var(--cf-surface-2);
    color: var(--cf-muted);
  }
  h1 {
    margin: 0;
    font: 700 34px/1.15 var(--cf-font-display);
    letter-spacing: -0.02em;
  }
  p {
    margin: 0;
    max-width: 520px;
    font-size: 16px;
    line-height: 1.5;
    color: var(--cf-muted);
  }
</style>
```

- [ ] **Step 4: Run the tests and checks**

Run (in `app/`): `pnpm test && pnpm check`
Expected: 54 tests PASS (45 + 9), 0 errors and 0 warnings (no unused-CSS warning: every selector matches markup).

- [ ] **Step 5: Commit**

```bash
but commit -b feat/design-system -m "feat(ui): add design icons and clay primitives

The 29 icons from the mockups, and Button, IconButton, Card, Pill,
StatusDot, Tag, SectionLabel, Callout, ProgressBar, Select, Console and
ResultHero, styled only through the tokens."
```

---

### Task 6: Segmented control and chip family selector

**Files:**
- Create: `app/src/lib/components/SegmentedControl.svelte`, `app/src/lib/components/FamilySelector.svelte`, `app/src/lib/components/controls.test.ts`

**Interfaces:**
- Consumes: `Icon` (Task 5), `t()` (Task 2), `Family` from `types.ts`.
- Produces:
  - `SegmentedControl<T extends string> { label: string; options: readonly { value: T; label: string }[]; value: T; onchange: (value: T) => void }`: a `role="group"` of buttons with `aria-pressed`.
  - `FamilySelector { value: Family | null; disabled?: boolean; onchange: (family: Family) => void }`: three cards ESP32 · STM32 · nRF (ADR 0005), names and descriptions from `t().families`; the selected card looks pressed in and carries a check.

- [ ] **Step 1: Write the failing tests**

`app/src/lib/components/controls.test.ts`:

```ts
import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n/index.svelte';
import FamilySelector from './FamilySelector.svelte';
import SegmentedControl from './SegmentedControl.svelte';

afterEach(() => setLocale('fr'));

describe('SegmentedControl', () => {
  const options = [
    { value: 'simple', label: 'Simple' },
    { value: 'expert', label: 'Expert' },
  ] as const;

  it('marks the current option as pressed', () => {
    render(SegmentedControl, { label: 'Mode d’affichage', options, value: 'simple', onchange: vi.fn() });
    expect(screen.getByRole('group', { name: 'Mode d’affichage' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simple' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Expert' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the option the user picks', async () => {
    const onchange = vi.fn();
    render(SegmentedControl, { label: 'Mode', options, value: 'simple', onchange });
    await fireEvent.click(screen.getByRole('button', { name: 'Expert' }));
    expect(onchange).toHaveBeenCalledWith('expert');
  });
});

describe('FamilySelector', () => {
  it('shows the three families with their description', () => {
    render(FamilySelector, { value: 'esp32', onchange: vi.fn() });
    expect(screen.getByRole('group', { name: 'Type de puce' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.getByText('STMicroelectronics · sonde ou USB')).toBeInTheDocument();
  });

  it('shows the selected family pressed in, with a check', () => {
    const { container } = render(FamilySelector, { value: 'esp32', onchange: vi.fn() });
    expect(screen.getByRole('button', { name: /Espressif/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Nordic/ })).toHaveAttribute('aria-pressed', 'false');
    expect(container.querySelectorAll('[data-icon="check"]')).toHaveLength(1);
  });

  it('reports the family the user picks', async () => {
    const onchange = vi.fn();
    render(FamilySelector, { value: 'esp32', onchange });
    await fireEvent.click(screen.getByRole('button', { name: /STMicroelectronics/ }));
    expect(onchange).toHaveBeenCalledWith('stm32');
  });

  it('selects nothing when no family is known yet, and can be disabled', () => {
    render(FamilySelector, { value: null, disabled: true, onchange: vi.fn() });
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAttribute('aria-pressed', 'false');
      expect(button).toBeDisabled();
    }
  });

  it('follows the UI language', () => {
    setLocale('en');
    render(FamilySelector, { value: 'nrf', onchange: vi.fn() });
    expect(screen.getByRole('group', { name: 'Chip type' })).toBeInTheDocument();
    expect(screen.getByText('Nordic · nRF51 to nRF91')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (in `app/`): `pnpm vitest run controls`
Expected: FAIL: `Failed to resolve import "./FamilySelector.svelte"` and `"./SegmentedControl.svelte"`.

- [ ] **Step 3: Write the two controls**

`app/src/lib/components/SegmentedControl.svelte` (the sunken track with a raised current option, as in the top bar):

```svelte
<script lang="ts" generics="T extends string">
  let {
    label,
    options,
    value,
    onchange,
  }: {
    label: string;
    options: readonly { value: T; label: string }[];
    value: T;
    onchange: (value: T) => void;
  } = $props();
</script>

<div class="track" role="group" aria-label={label}>
  {#each options as option (option.value)}
    <button
      type="button"
      class="segment"
      class:current={option.value === value}
      aria-pressed={option.value === value}
      onclick={() => onchange(option.value)}
    >
      {option.label}
    </button>
  {/each}
</div>

<style>
  .track {
    display: flex;
    gap: 2px;
    padding: 4px;
    border-radius: 12px;
    background: var(--cf-surface-3);
    box-shadow: var(--cf-shadow-sunken);
  }
  .segment {
    height: 30px;
    padding: 0 14px;
    border: none;
    border-radius: 9px;
    background: transparent;
    color: var(--cf-muted);
    font: 600 13px var(--cf-font-ui);
    cursor: pointer;
    transition:
      transform 0.18s cubic-bezier(0.3, 1.6, 0.5, 1),
      box-shadow 0.18s ease,
      background-color 0.15s ease;
  }
  .current {
    background: var(--cf-raised);
    color: var(--cf-ink);
    box-shadow: var(--cf-shadow-raised);
  }
  .current:hover {
    transform: translateY(-2px);
  }
</style>
```

`app/src/lib/components/FamilySelector.svelte` (values from the `Main` and `Sombre` artifact pages):

```svelte
<script lang="ts">
  import { t } from '../i18n/index.svelte';
  import type { Family } from '../types';
  import Icon from './Icon.svelte';

  const FAMILIES: readonly Family[] = ['esp32', 'stm32', 'nrf'];
  /** The short mark drawn in each card's tile, as in the mockups. */
  const TILES: Record<Family, string> = { esp32: 'ESP', stm32: 'STM', nrf: 'nRF' };

  let {
    value,
    disabled = false,
    onchange,
  }: { value: Family | null; disabled?: boolean; onchange: (family: Family) => void } = $props();
</script>

<div class="families" role="group" aria-label={t().families.label}>
  {#each FAMILIES as family (family)}
    {@const selected = family === value}
    <button
      type="button"
      class="family"
      class:selected
      aria-pressed={selected}
      {disabled}
      onclick={() => onchange(family)}
    >
      <span class="tile">{TILES[family]}</span>
      <span class="text">
        <span class="name">{t().families[family].name}</span>
        <span class="description">{t().families[family].description}</span>
      </span>
      {#if selected}
        <span class="check"><Icon name="check" size={14} strokeWidth={2.5} /></span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .families {
    display: flex;
    gap: 12px;
  }
  .family {
    flex: 1 1 0;
    min-width: 0;
    height: 76px;
    padding: 0 15px;
    display: flex;
    align-items: center;
    gap: 12px;
    text-align: left;
    border-radius: 18px;
    border: 1px solid var(--cf-raised-line);
    background: var(--cf-raised);
    box-shadow: var(--cf-shadow-raised);
    color: var(--cf-ink);
    font-family: var(--cf-font-ui);
    cursor: pointer;
    transition:
      transform 0.18s cubic-bezier(0.3, 1.6, 0.5, 1),
      box-shadow 0.18s ease,
      background-color 0.18s ease;
  }
  .family:hover:enabled:not(.selected) {
    transform: translateY(-2px);
  }
  .family:active:enabled:not(.selected) {
    transform: translateY(2px);
    box-shadow: var(--cf-shadow-raised-active);
  }
  .family:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
  .selected {
    padding: 0 14px;
    border: 2px solid var(--cf-ink);
    background: var(--cf-selection);
    box-shadow: var(--cf-shadow-sunken);
  }
  .tile {
    width: 42px;
    height: 42px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    background: var(--cf-surface-2);
    box-shadow: var(--cf-shadow-tile);
    color: var(--cf-ink);
    font: 500 12px var(--cf-font-mono);
  }
  .selected .tile {
    background: var(--cf-primary);
    color: var(--cf-on-primary);
    box-shadow: var(--cf-shadow-tile-strong);
  }
  .text {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .name {
    font: 700 17px/1.2 var(--cf-font-display);
    letter-spacing: -0.01em;
  }
  .description {
    font-size: 12px;
    color: var(--cf-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .check {
    margin-left: auto;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--cf-primary);
    color: var(--cf-on-primary);
    animation: cf-pop 0.6s cubic-bezier(0.3, 1.6, 0.5, 1) both;
  }
</style>
```

- [ ] **Step 4: Run the tests and checks**

Run (in `app/`): `pnpm test && pnpm check`
Expected: 61 tests PASS (54 + 7), 0 errors and 0 warnings.

- [ ] **Step 5: Commit**

```bash
but commit -b feat/design-system -m "feat(ui): add segmented control and chip family selector

Sunken track with a raised current option; three family cards where the
selected one looks pressed in and carries a check (ADR 0005)."
```

---

### Task 7: App shell pieces

**Files:**
- Create in `app/src/lib/shell/`: `mode.ts`, `TopBar.svelte`, `InstructionsPanel.svelte`, `StatusBar.svelte`, `SettingsView.svelte`, `ExpertPlaceholder.svelte`, `shell.test.ts`

**Interfaces:**
- Consumes: components (Tasks 5–6), `t()` and `LANGUAGE_NAMES`/`LOCALES` (Task 2), `Settings` (Task 3), `ThemePreference` (Task 1).
- Produces:
  - `mode.ts`: `type Mode = 'simple' | 'expert'`.
  - `TopBar { board: string | null; tone: Tone; mode: Mode; onmode: (mode: Mode) => void; onsettings: () => void }`.
  - `InstructionsPanel { open: boolean; ontoggle: () => void }`: 400 px panel with the sample instructions, or the 48 px rail.
  - `StatusBar { note: string; version: string | null }`.
  - `SettingsView { settings: Settings; version: string | null; onchange: (settings: Settings) => void; onback: () => void }`.
  - `ExpertPlaceholder { onsimple: () => void }`.

- [ ] **Step 1: Write the failing tests**

`app/src/lib/shell/shell.test.ts`:

```ts
import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n/index.svelte';
import ExpertPlaceholder from './ExpertPlaceholder.svelte';
import InstructionsPanel from './InstructionsPanel.svelte';
import SettingsView from './SettingsView.svelte';
import StatusBar from './StatusBar.svelte';
import TopBar from './TopBar.svelte';

afterEach(() => setLocale('fr'));

describe('TopBar', () => {
  const base = { tone: 'ok', mode: 'simple', onmode: vi.fn(), onsettings: vi.fn() } as const;

  it('shows the product, the board and the mode switch', () => {
    render(TopBar, { ...base, board: 'Carte simulée · ESP32-S3' });
    expect(screen.getByText('Chip Flashr')).toBeInTheDocument();
    expect(screen.getByText('Carte simulée · ESP32-S3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simple' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('says when no board is known', () => {
    render(TopBar, { ...base, board: null, tone: 'idle' });
    expect(screen.getByText('Aucune carte')).toBeInTheDocument();
  });

  it('reports the mode switch and the settings button', async () => {
    const onmode = vi.fn();
    const onsettings = vi.fn();
    render(TopBar, { ...base, board: null, onmode, onsettings });
    await fireEvent.click(screen.getByRole('button', { name: 'Expert' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Réglages' }));
    expect(onmode).toHaveBeenCalledWith('expert');
    expect(onsettings).toHaveBeenCalledOnce();
  });
});

describe('InstructionsPanel', () => {
  it('shows the sample instructions when open', async () => {
    const ontoggle = vi.fn();
    render(InstructionsPanel, { open: true, ontoggle });
    expect(screen.getByRole('complementary', { name: 'Instructions' })).toHaveTextContent('Mise à jour du thermostat');
    expect(screen.getByText('J3 · PROG')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Masquer les instructions' }));
    expect(ontoggle).toHaveBeenCalledOnce();
  });

  it('folds into a rail when closed', async () => {
    const ontoggle = vi.fn();
    render(InstructionsPanel, { open: false, ontoggle });
    expect(screen.getByRole('complementary', { name: 'Instructions masquées' })).toBeInTheDocument();
    expect(screen.queryByText('Mise à jour du thermostat')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Afficher les instructions' }));
    expect(ontoggle).toHaveBeenCalledOnce();
  });
});

describe('SettingsView', () => {
  const settings = { locale: 'fr', theme: 'system' } as const;

  it('shows the current language and theme', () => {
    render(SettingsView, { settings, version: '0.1.0', onchange: vi.fn(), onback: vi.fn() });
    expect(screen.getByRole('heading', { name: 'Réglages' })).toBeInTheDocument();
    expect((screen.getByRole('combobox', { name: 'Langue' }) as HTMLSelectElement).value).toBe('fr');
    expect((screen.getByRole('combobox', { name: 'Thème' }) as HTMLSelectElement).value).toBe('system');
    expect(screen.getByText('Chip Flashr v0.1.0 · Apache-2.0')).toBeInTheDocument();
  });

  it('reports a new choice and the way back', async () => {
    const onchange = vi.fn();
    const onback = vi.fn();
    render(SettingsView, { settings, version: null, onchange, onback });
    await fireEvent.change(screen.getByRole('combobox', { name: 'Thème' }), { target: { value: 'dark' } });
    expect(onchange).toHaveBeenCalledWith({ locale: 'fr', theme: 'dark' });
    await fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    expect(onback).toHaveBeenCalledOnce();
  });

  it('follows the UI language', () => {
    setLocale('en');
    render(SettingsView, { settings, version: null, onchange: vi.fn(), onback: vi.fn() });
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Same as system' })).toBeInTheDocument();
  });
});

describe('StatusBar', () => {
  it('shows the note and the version', () => {
    render(StatusBar, { note: 'Démo · carte simulée', version: '0.1.0' });
    expect(screen.getByText('Démo · carte simulée')).toBeInTheDocument();
    expect(screen.getByText('v0.1.0')).toBeInTheDocument();
  });
});

describe('ExpertPlaceholder', () => {
  it('offers the way back to Simple mode', async () => {
    const onsimple = vi.fn();
    render(ExpertPlaceholder, { onsimple });
    expect(screen.getByRole('heading', { name: 'Mode Expert' })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Revenir au mode Simple' }));
    expect(onsimple).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (in `app/`): `pnpm vitest run shell`
Expected: FAIL: `Failed to resolve import "./TopBar.svelte"` (and the other shell components).

- [ ] **Step 3: Write the shell pieces**

`app/src/lib/shell/mode.ts`:

```ts
/** Simple: one decision per screen. Expert: every detail (screen 12, plan 5). */
export type Mode = 'simple' | 'expert';
```

`app/src/lib/shell/TopBar.svelte` (60 px bar of the `Main` page; the logo's inset shadow is the artifact's own value):

```svelte
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
```

`app/src/lib/shell/InstructionsPanel.svelte` (the aside of the `Main` page, and the rail of the `Expert` page):

```svelte
<script lang="ts">
  import Callout from '../components/Callout.svelte';
  import Icon from '../components/Icon.svelte';
  import IconButton from '../components/IconButton.svelte';
  import StatusDot from '../components/StatusDot.svelte';
  import { t } from '../i18n/index.svelte';

  let { open, ontoggle }: { open: boolean; ontoggle: () => void } = $props();

  const m = $derived(t().instructions);
  const sample = $derived(m.sample);
</script>

{#if open}
  <aside class="panel" aria-label={m.title}>
    <div class="head">
      <span class="head-icon"><Icon name="book" size={17} /></span>
      <span class="title">{m.title}</span>
      <span class="file">{sample.file}</span>
      <span class="spacer"></span>
      <span class="live"><StatusDot tone="ok" size={6} breathe />{m.live}</span>
      <IconButton icon="panelRight" label={m.hide} small onclick={ontoggle} />
    </div>
    <div class="body">
      <h1>{sample.heading}</h1>
      <p class="intro">{sample.intro}</p>
      <h2>{sample.beforeTitle}</h2>
      <ul>
        {#each sample.before as item, i (i)}
          <li>{item}</li>
        {/each}
      </ul>
      <h2>{sample.stepsTitle}</h2>
      <ol>
        {#each sample.steps as step, i (i)}
          <li>
            {#if typeof step === 'string'}
              {step}
            {:else}
              {step.text} <code>{step.code}</code>.
            {/if}
          </li>
        {/each}
      </ol>
      <div class="image"><Icon name="file" size={16} />{sample.image}</div>
      <Callout tone="warning">{sample.warning}</Callout>
      <h2>{sample.helpTitle}</h2>
      <p>{sample.help}</p>
    </div>
  </aside>
{:else}
  <aside class="rail" aria-label={m.hidden}>
    <IconButton icon="book" label={m.show} small onclick={ontoggle} />
    <span class="rail-label">{m.title}</span>
  </aside>
{/if}

<style>
  .panel {
    width: 400px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--cf-surface);
    border-left: 1px solid var(--cf-line);
  }
  .head {
    height: 56px;
    flex-shrink: 0;
    padding: 0 12px 0 20px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-bottom: 1px solid var(--cf-line);
  }
  .head-icon {
    display: flex;
    color: var(--cf-muted);
  }
  .title {
    font-size: 14px;
    font-weight: 600;
  }
  .file {
    font: 12px var(--cf-font-mono);
    color: var(--cf-faint);
  }
  .spacer {
    flex-grow: 1;
  }
  .live {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--cf-faint);
  }
  .body {
    flex-grow: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 24px 24px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  h1 {
    margin: 0;
    font: 700 22px/1.2 var(--cf-font-display);
    letter-spacing: -0.02em;
  }
  h2 {
    margin: 8px 0 0;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--cf-faint);
  }
  p,
  li {
    margin: 0;
    font-size: 14px;
    line-height: 1.55;
  }
  .intro {
    color: var(--cf-muted);
  }
  ul,
  ol {
    margin: 0;
    padding-left: 22px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  code {
    padding: 1px 6px;
    border-radius: 6px;
    background: var(--cf-surface-3);
    font: 12.5px var(--cf-font-mono);
  }
  .image {
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: 14px;
    border: 1.5px dashed var(--cf-line);
    background: var(--cf-surface-2);
    font-size: 13px;
    color: var(--cf-faint);
  }
  .rail {
    width: 48px;
    flex-shrink: 0;
    padding-top: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    background: var(--cf-surface);
    border-left: 1px solid var(--cf-line);
  }
  .rail-label {
    writing-mode: vertical-rl;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--cf-faint);
  }
</style>
```

`app/src/lib/shell/StatusBar.svelte`:

```svelte
<script lang="ts">
  import Icon from '../components/Icon.svelte';

  let { note, version }: { note: string; version: string | null } = $props();
</script>

<footer class="status">
  <Icon name="eye" size={14} />
  <span>{note}</span>
  <span class="spacer"></span>
  {#if version}
    <span class="version">v{version}</span>
  {/if}
</footer>

<style>
  .status {
    height: 32px;
    flex-shrink: 0;
    padding: 0 20px;
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--cf-surface);
    border-top: 1px solid var(--cf-line);
    font-size: 12px;
    color: var(--cf-faint);
  }
  .spacer {
    flex-grow: 1;
  }
  .version {
    font: 12px var(--cf-font-mono);
  }
</style>
```

`app/src/lib/shell/SettingsView.svelte` (screen 14 reduced to its "Général" card, spec in-scope 8):

```svelte
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
```

`app/src/lib/shell/ExpertPlaceholder.svelte`:

```svelte
<script lang="ts">
  import Button from '../components/Button.svelte';
  import Card from '../components/Card.svelte';
  import { t } from '../i18n/index.svelte';

  let { onsimple }: { onsimple: () => void } = $props();

  const m = $derived(t().expert);
</script>

<Card padding={24} gap={12}>
  <h1>{m.title}</h1>
  <p>{m.body}</p>
  <div>
    <Button icon="chevronLeft" onclick={onsimple}>{m.back}</Button>
  </div>
</Card>

<style>
  h1 {
    margin: 0;
    font: 700 26px/1.15 var(--cf-font-display);
    letter-spacing: -0.02em;
  }
  p {
    margin: 0;
    font-size: 15px;
    line-height: 1.5;
    color: var(--cf-muted);
  }
</style>
```

- [ ] **Step 4: Run the tests and checks**

Run (in `app/`): `pnpm test && pnpm check`
Expected: 71 tests PASS (61 + 10), 0 errors and 0 warnings.

- [ ] **Step 5: Commit**

```bash
but commit -b feat/design-system -m "feat(ui): add top bar, instructions panel, status bar and settings

Shell pieces from the Main, Expert and Reglages artifact pages. The
panel folds into a 48 px rail; settings hold language and theme only."
```

---

### Task 8: The app shell assembled, and the demo flow rebuilt

**Files:**
- Create: `app/src/lib/demo/DemoFlow.svelte`, `app/src/App.test.ts`
- Modify: `app/src/App.svelte` (replace), `app/src/main.ts` (replace)

**Interfaces:**
- Consumes: everything from Tasks 1–7; `flashReducer`, `toUserFacingError`, `FlashState`, `FlashAction` from plan 1's `flashState.ts`.
- Produces:
  - `App { backend: Backend }`: owns settings (loaded from `localStorage`, applied to `<html lang>` and `data-theme`, following the system theme live), mode, view (`main | settings`), instructions panel state, targets, selection and the flash job (spec D10, D11).
  - `DemoFlow { selected: Target | null; flash: FlashState; startupError: UserFacingError | null; onfamily; onprogram; oncancel; onreset }`: the Simple-mode content (home, progress, success, failure).
  - `main.ts`: fonts, tokens, stored theme applied before the first paint, `mount(App, { props: { backend: pickBackend() } })`.

- [ ] **Step 1: Write the failing integration tests**

They drive the real `App` on the browser-preview backend with fake timers, so every path of the demo runs in milliseconds.

`app/src/App.test.ts`:

```ts
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.svelte';
import { setLocale } from './lib/i18n/index.svelte';
import type { Backend } from './lib/ipc';
import { createPreviewBackend, type PreviewOptions } from './lib/preview/previewBackend';
import { SETTINGS_KEY } from './lib/settings';

function preview(options: Partial<PreviewOptions> = {}): Backend {
  return createPreviewBackend({ chunkDelayMs: 15, failAtPercent: null, ...options });
}

/** Run fake timers for `ms`, then let Svelte update the DOM. */
async function settle(ms = 0): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await tick();
}

async function renderApp(backend: Backend = preview()): Promise<void> {
  render(App, { backend });
  await settle();
}

function storeSettings(value: unknown): void {
  localStorage.setItem(SETTINGS_KEY, typeof value === 'string' ? value : JSON.stringify(value));
}

/** A controllable `prefers-color-scheme: dark` query (jsdom has no matchMedia). */
function stubSystemDark(initial: boolean): (dark: boolean) => void {
  type Listener = (event: MediaQueryListEvent) => void;
  const listeners = new Set<Listener>();
  const query = {
    matches: initial,
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
  };
  vi.stubGlobal('matchMedia', () => query);
  return (dark) => {
    query.matches = dark;
    for (const listener of listeners) listener({ matches: dark } as MediaQueryListEvent);
  };
}

const programButton = () => screen.getByRole('button', { name: 'Programmer' });

beforeEach(() => {
  vi.useFakeTimers();
  storeSettings({ locale: 'fr', theme: 'light' });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
  setLocale('fr');
  document.documentElement.removeAttribute('data-theme');
});

describe('App', () => {
  it('lists the three families and names the selected board', async () => {
    await renderApp();
    expect(screen.getByRole('button', { name: /Espressif/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Carte simulée · ESP32-S3')).toBeInTheDocument();
    expect(screen.getByText('v0.1.0')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: /STMicroelectronics/ }));
    expect(screen.getByText('Carte simulée · STM32F411')).toBeInTheDocument();
  });

  it('programs the board and shows the success hero', async () => {
    await renderApp();
    await fireEvent.click(programButton());
    await settle(100);
    expect(screen.getByText('Programmation en cours')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    await settle(10_000);
    expect(screen.getByRole('heading', { name: 'Programmation réussie' })).toBeInTheDocument();
    expect(screen.getByText('Conforme')).toBeInTheDocument();
  });

  it('stops the job on Annuler and never reports success', async () => {
    await renderApp();
    await fireEvent.click(programButton());
    await settle(200);
    await fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    await settle(10_000);
    expect(screen.getByRole('heading', { name: 'Programmation annulée' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Programmation réussie' })).toBeNull();
  });

  it('shows a lost board as a failure with its technical details', async () => {
    await renderApp(preview({ failAtPercent: 41 }));
    await fireEvent.click(programButton());
    await settle(10_000);
    expect(screen.getByRole('heading', { name: 'La programmation a échoué' })).toBeInTheDocument();
    expect(screen.getByText('device error: simulated disconnect')).toBeInTheDocument();
  });

  it('starts a single job when Programmer is pressed twice', async () => {
    const backend = preview();
    const flashDemo = vi.spyOn(backend, 'flashDemo');
    await renderApp(backend);
    const button = programButton();
    button.click();
    button.click();
    await settle(10_000);
    expect(flashDemo).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Programmation réussie' })).toBeInTheDocument();
  });

  it('folds the instructions into a rail in Expert mode and back', async () => {
    await renderApp();
    expect(screen.getByRole('button', { name: 'Masquer les instructions' })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Expert' }));
    expect(screen.getByRole('heading', { name: 'Mode Expert' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Afficher les instructions' })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Simple' }));
    expect(screen.getByRole('button', { name: 'Masquer les instructions' })).toBeInTheDocument();
  });

  it('keeps the flash running while settings are open', async () => {
    await renderApp();
    await fireEvent.click(programButton());
    await settle(100);
    await fireEvent.click(screen.getByRole('button', { name: 'Réglages' }));
    expect(screen.getByRole('heading', { name: 'Réglages' })).toBeInTheDocument();
    await settle(10_000);
    await fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    expect(screen.getByRole('heading', { name: 'Programmation réussie' })).toBeInTheDocument();
  });

  it('switches to English at once and remembers it', async () => {
    await renderApp();
    await fireEvent.click(screen.getByRole('button', { name: 'Réglages' }));
    await fireEvent.change(screen.getByRole('combobox', { name: 'Langue' }), { target: { value: 'en' } });
    await settle();
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText('Simulated board · ESP32-S3')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Instructions' })).toHaveTextContent('Thermostat update');
    expect(document.documentElement.lang).toBe('en');
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')).toEqual({ locale: 'en', theme: 'light' });
  });

  it('follows the system theme while running', async () => {
    storeSettings({ locale: 'fr', theme: 'system' });
    const setSystemDark = stubSystemDark(false);
    await renderApp();
    expect(document.documentElement.dataset.theme).toBe('light');
    setSystemDark(true);
    await settle();
    expect(document.documentElement.dataset.theme).toBe('dark');
    await fireEvent.click(screen.getByRole('button', { name: 'Réglages' }));
    await fireEvent.change(screen.getByRole('combobox', { name: 'Thème' }), { target: { value: 'light' } });
    await settle();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('starts with defaults when the stored settings are broken', async () => {
    // jsdom reports navigator.languages = ['en-US'], so the defaults are English and "system".
    storeSettings('{not json');
    await renderApp();
    expect(screen.getByText('Simulated board · ESP32-S3')).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('explains when the boards cannot be listed', async () => {
    const backend: Backend = {
      ...preview(),
      listTargets: () => Promise.reject({ code: 'device-error', technical: 'USB enumeration failed' }),
    };
    await renderApp(backend);
    expect(screen.getByText(/Impossible de lister les cartes/)).toHaveTextContent('USB enumeration failed');
    expect(programButton()).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (in `app/`): `pnpm vitest run App`
Expected: FAIL: `Unable to find an accessible element with the role "button" and name /Espressif/` (the plan-1 screen has no family selector), and the other tests fail the same way.

- [ ] **Step 3: Write the demo flow, the shell and the entry point**

`app/src/lib/demo/DemoFlow.svelte` (home, progress, success and failure, from the `Main`, `Flash`, `Succes` and `Echec` artifact pages):

```svelte
<script lang="ts">
  import Button from '../components/Button.svelte';
  import Callout from '../components/Callout.svelte';
  import Card from '../components/Card.svelte';
  import Console from '../components/Console.svelte';
  import FamilySelector from '../components/FamilySelector.svelte';
  import Icon from '../components/Icon.svelte';
  import ProgressBar from '../components/ProgressBar.svelte';
  import ResultHero from '../components/ResultHero.svelte';
  import SectionLabel from '../components/SectionLabel.svelte';
  import StatusDot from '../components/StatusDot.svelte';
  import type { FlashState } from '../flashState';
  import { formatKib, formatSeconds, phaseLabel } from '../i18n/format';
  import { locale, t } from '../i18n/index.svelte';
  import { boardName } from '../targets';
  import type { Family, Target, UserFacingError } from '../types';

  let {
    selected,
    flash,
    startupError,
    onfamily,
    onprogram,
    oncancel,
    onreset,
  }: {
    selected: Target | null;
    flash: FlashState;
    startupError: UserFacingError | null;
    onfamily: (family: Family) => void;
    onprogram: () => void;
    oncancel: () => void;
    onreset: () => void;
  } = $props();

  const m = $derived(t());
  const board = $derived(selected ? boardName(selected, m) : '');
</script>

{#if flash.status === 'flashing'}
  <Card padding={24} gap={20}>
    <div class="progress-title">
      <span class="progress-label">{m.progress.title}</span>
      <span class="percent">{flash.percent} %</span>
    </div>
    <ProgressBar value={flash.percent} label={m.progress.barLabel} />
    <div class="progress-foot">
      <span class="phase">{phaseLabel(flash.phase, m)}</span>
      <Button icon="x" onclick={oncancel}>{m.progress.cancel}</Button>
    </div>
  </Card>
  <Callout>{m.progress.keepPlugged}</Callout>
{:else if flash.status === 'success'}
  <ResultHero tone="success" title={m.success.title}>{m.success.body(board)}</ResultHero>
  <div class="stats">
    <div class="stat">
      <span class="stat-label">{m.success.verification}</span>
      <span class="stat-value">{flash.report.verified ? m.success.verified : m.success.notVerified}</span>
    </div>
    <div class="stat">
      <span class="stat-label">{m.success.duration}</span>
      <span class="stat-value">{formatSeconds(flash.report.durationMs, locale())}</span>
    </div>
    <div class="stat">
      <span class="stat-label">{m.success.size}</span>
      <span class="stat-value">{formatKib(flash.report.bytesWritten, locale(), m)}</span>
    </div>
  </div>
  <div class="grow"></div>
  <div class="actions">
    <Button variant="primary" size="lg" wide icon="refresh" onclick={onprogram}>{m.success.again}</Button>
    <div class="more"><Button variant="ghost" icon="chevronLeft" onclick={onreset}>{m.success.home}</Button></div>
  </div>
{:else if flash.status === 'failure'}
  {@const error = m.errors[flash.error.code]}
  <ResultHero tone={flash.error.code === 'cancelled' ? 'neutral' : 'failure'} title={error.title}>
    {error.explanation}
  </ResultHero>
  <details class="details">
    <summary>{m.failure.details}</summary>
    <div class="details-body"><Console lines={[flash.error.technical]} /></div>
  </details>
  <div class="grow"></div>
  <div class="actions">
    <Button variant="primary" size="lg" wide icon="refresh" onclick={onprogram}>{m.failure.retry}</Button>
    <div class="more"><Button variant="ghost" icon="chevronLeft" onclick={onreset}>{m.failure.home}</Button></div>
  </div>
{:else}
  <SectionLabel>{m.families.label}</SectionLabel>
  <FamilySelector value={selected?.family ?? null} onchange={onfamily} />
  {#if startupError}
    <Callout>{m.demo.listError} {startupError.technical}</Callout>
  {:else if selected}
    <div class="board">
      <span class="board-icon"><Icon name="plug" size={20} /></span>
      <span class="board-text">
        <span class="board-name"><StatusDot tone="ok" breathe />{m.board.connected(board)}</span>
        <span class="board-note">{m.board.demoNote}</span>
      </span>
    </div>
  {/if}
  <div class="grow"></div>
  <div class="actions">
    <Button variant="primary" size="lg" wide icon="zap" disabled={!selected} onclick={onprogram}>
      {m.demo.program}
    </Button>
    <p class="hint">{m.demo.hint}</p>
  </div>
{/if}

<style>
  .progress-title {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .progress-label {
    font-size: 15px;
    font-weight: 600;
    color: var(--cf-muted);
  }
  .percent {
    font: 700 64px/0.95 var(--cf-font-display);
    letter-spacing: -0.04em;
  }
  .progress-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .phase {
    font-size: 15px;
    font-weight: 600;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
  .stat {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    border-radius: 16px;
    background: var(--cf-surface-2);
    border: 1px solid var(--cf-line);
  }
  .stat-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--cf-faint);
  }
  .stat-value {
    font: 700 20px var(--cf-font-display);
  }
  .grow {
    flex-grow: 1;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .more {
    display: flex;
    justify-content: center;
  }
  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--cf-muted);
    text-align: center;
  }
  .details {
    border: 1px solid var(--cf-line);
    border-radius: 16px;
    background: var(--cf-surface);
  }
  summary {
    padding: 12px 16px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .details-body {
    margin: 0 14px 14px;
  }
  .board {
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 14px;
    border-radius: 18px;
    background: var(--cf-surface);
    border: 1px solid var(--cf-line);
    box-shadow: var(--cf-shadow-card);
  }
  .board-icon {
    width: 42px;
    height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 13px;
    background: var(--cf-ok-weak);
    color: var(--cf-ok);
  }
  .board-text {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .board-name {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
  }
  .board-note {
    font-size: 13px;
    color: var(--cf-muted);
  }
</style>
```

`app/src/App.svelte` (replace the whole file):

```svelte
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
  import type { AppInfo, Family, Target, UserFacingError } from './lib/types';

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
  let targets = $state<Target[]>([]);
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
    void load();
    return () => media?.removeEventListener('change', follow);
  });

  async function load() {
    try {
      info = await backend.appInfo();
      targets = await backend.listTargets();
      selectedId = targets[0]?.id ?? null;
    } catch (error) {
      startupError = toUserFacingError(error);
    }
  }

  function dispatch(action: FlashAction) {
    flash = flashReducer(flash, action);
  }

  async function program() {
    // The state changes synchronously on start, so a second press in the same instant stops here.
    if (!selected || flash.status === 'flashing') return;
    const target = selected;
    dispatch({ type: 'start' });
    try {
      const report = await backend.flashDemo(target.id, (event) => dispatch({ type: 'progress', event }));
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
    mode = next;
    view = 'main';
    instructionsOpen = next === 'simple';
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
    <InstructionsPanel open={instructionsOpen} ontoggle={() => (instructionsOpen = !instructionsOpen)} />
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
```

`app/src/main.ts` (replace the whole file):

```ts
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/jetbrains-mono';
import { mount } from 'svelte';
import App from './App.svelte';
import { pickBackend } from './lib/ipc';
import { browserStore, loadSettings } from './lib/settings';
import { applyTheme, DARK_QUERY, resolveTheme } from './lib/theme';
import './styles/tokens.css';
import './styles/base.css';

// Apply the stored theme before the first paint, so a dark setting never flashes light.
const settings = loadSettings(browserStore(), navigator.languages);
const systemDark = typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
applyTheme(document.documentElement, resolveTheme(settings.theme, systemDark));

const target = document.getElementById('app');
if (!target) throw new Error('#app element missing from index.html');

export default mount(App, { target, props: { backend: pickBackend() } });
```

- [ ] **Step 4: Run every check**

Run (in `app/`): `pnpm test && pnpm check && pnpm build`
Expected: 82 tests PASS (71 + 11), 0 errors and 0 warnings, Vite builds.

Run (repo root): `cargo fmt --all -- --check && cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace`
Expected: clean, 38 tests PASS.

- [ ] **Step 5: Commit**

```bash
but commit -b feat/design-system -m "feat(ui): assemble the app shell and rebuild the demo flow

App owns settings, mode, view and the flash job, so a flash survives
navigation. The demo runs on the family selector, progress card and
result heroes. Theme follows the system live; FR/EN apply at once."
```

---

### Task 9: Visual check against the mockups, and docs

**Files:**
- Modify: `README.md` (Development section), `docs/ux-design.md` (Visual language), `docs/superpowers/plans/README.md` (plan 2 status)
- Modify if a check fails: the component that differs (amend the fix into the commit that created it)

**Interfaces:**
- Consumes: the whole app from Task 8.
- Produces: screenshots compared with the mockups, and docs that point to the tokens and the preview.

- [ ] **Step 1: Compare the browser preview with the mockups**

Run (in `app/`): `pnpm dev` (leave it running), then open `http://localhost:5173/` in a browser whose viewport is 1200 × 760. Take a screenshot of each state below and compare it with the mockup image named in brackets (in `docs/assets/screens/`; they are drawn at 1600 px wide for a 1200 px window, so scale by 0.75).

1. Light, French, home [`01-home.jpg`]: top bar 60 px with the dark logo tile, the board pill (breathing green dot), the sunken Simple/Expert switch with Simple raised, the 38 px settings button. Family cards 76 px; ESP32 pressed in (cream fill, 2 px dark border, dark tile, round check). Programmer 64 px, dark, with the lip under it. Instructions panel 400 px, 56 px header with "Suivi en direct", the sample text, dashed image placeholder and the amber warning. Status bar 32 px with `v0.1.0` in monospace.
2. Programmer, mid-flash [`05-flashing.jpg`]: 64 px percentage, 14 px striped bar moving, phase label, Annuler as a raised button.
3. Success [`06-success.jpg`]: 96 px green badge popping in, 34 px title, three stat boxes, "Programmer une autre carte" 64 px, ghost "Retour à l'accueil".
4. `http://localhost:5173/?failAt=41`, Programmer [`07-failure.jpg`]: red badge, "La programmation a échoué", "Détails techniques" opens a dark console with `device error: simulated disconnect`.
5. Expert [`12-expert-mode.jpg`, right edge]: the panel becomes the 48 px rail with the book button and the vertical "Instructions".
6. Réglages [`14-settings.jpg`]: "Retour" link, 26 px title, the "Général" card with sunken selects.
7. Thème → Sombre, back to home [`15-dark-theme.jpg`]: dark ground and surfaces, cream Programmer with its light lip, selected family with a light border and cream tile.
8. Langue → English: every visible string is English (board "Simulated board · ESP32-S3", panel "Thermostat update"). Reload the page: still English and dark.

Also check, in the browser console:

```js
[document.fonts.check('700 18px "Bricolage Grotesque Variable"'), document.fonts.check('14px "Instrument Sans Variable"'), document.fonts.check('12px "JetBrains Mono Variable"')]
```

Expected: `[true, true, true]`. The network log shows no request to any host other than `localhost`.

Expected overall: each listed element matches the mockup in size, colour and font. When one does not, fix the component (tokens only), re-run `pnpm test && pnpm check`, and amend the fix into the commit that created that component (`but amend -t <commit> <file-id>`). Stop the dev server.

With reduced motion turned on in the OS (or emulated in the browser), repeat step 2: the bar no longer moves and the dots no longer breathe.

- [ ] **Step 2: Check the desktop app**

Run (in `app/`): `pnpm tauri dev`
Expected: the same screens as step 1 in the 1200 × 760 window, on the Rust mock. Close it, then run `CHIP_FLASHR_MOCK_FAIL_AT=41 pnpm tauri dev` (PowerShell: `$env:CHIP_FLASHR_MOCK_FAIL_AT=41; pnpm tauri dev`): Programmer stops near 40 % with the failure hero.

- [ ] **Step 3: Update the docs**

In `README.md`, after the paragraph that starts "The app currently runs on a **simulated backend**", add:

```markdown
To work on the UI without the desktop shell, run `pnpm dev` in `app/` and open http://localhost:5173 in any browser: a development build runs on a TypeScript copy of the simulated board. Add `?failAt=41` to the URL to see the failure path.
```

In `docs/ux-design.md`, in "Visual language", after the **Accessibility** bullet, add:

```markdown
- **Exact values:** every colour, shadow and radius, in light and dark, lives in `app/src/styles/tokens.css`. They were measured on the design artifact; see the [plan 2 spec](superpowers/specs/2026-09-27-design-system-design.md#clay-tokens-measured-on-the-artifact).
```

In `docs/superpowers/plans/README.md`, change plan 2's status from `Ready` to `Done`.

- [ ] **Step 4: Run what CI runs**

Run (repo root): `cargo fmt --all -- --check && cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace`
Run (in `app/`): `pnpm install --frozen-lockfile && pnpm check && pnpm test && pnpm build && pnpm tauri build --no-bundle`
Expected: everything passes; `target/release/chip-flashr` opens the new shell without the dev server.

- [ ] **Step 5: Commit**

```bash
but commit -b feat/design-system -m "docs: document the browser preview and where the tokens live

README explains pnpm dev in a browser and ?failAt=; ux-design points to
tokens.css and the measured values; plan 2 marked done."
```

---

## Done when

- `cargo test --workspace` (38 tests) and `pnpm -C app test` (82 tests) pass; fmt, clippy (`-D warnings`) and svelte-check (no warnings) are clean; `pnpm tauri build --no-bundle` builds.
- In a browser (`pnpm dev`) and in the app (`pnpm tauri dev`), the shell matches the mockups in light and dark (Task 9, step 1); French and English switch at once and survive a restart; program, cancel and failure paths work; Expert folds the instructions into the rail.
- No request leaves the machine at runtime: fonts are bundled.
- CI is green on `ubuntu-22.04`, `macos-latest` and `windows-latest` once the branch is pushed (pushing and opening the PR only happens when asked).
