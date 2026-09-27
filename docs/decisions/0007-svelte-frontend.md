# 0007 · Svelte 5 + Vite + TypeScript for the frontend

- Status: Accepted
- Date: 2026-09-26

## Context

[ADR 0001](0001-rust-and-tauri.md) chose Tauri 2 with "a light web frontend, framework chosen in M1". The UI has about 15 screens driven by one state machine, a Markdown panel, and the clay look (soft shadows, press/hover transitions, small animations). Bundle size and start-up time matter (< 15 MB, < 1 s). The UI never touches hardware: it renders view models and sends intents.

## Options considered

| Option | For | Against |
|---|---|---|
| **Svelte 5 (runes) + Vite** | Compiles away: tiny runtime and bundle; components with scoped CSS suit the clay styling; runes make the state machine explicit; first-class in Tauri's templates | Smaller ecosystem than React |
| React + Vite | Largest ecosystem | Heavier runtime; more boilerplate for simple reactive state |
| Solid + Vite | Very fast, small | Smaller community, fewer maintainers familiar with it |
| Vanilla TS | Zero dependencies | 15 screens by hand means rebuilding a component model |
| SvelteKit | Routing, conventions | SSR/routing machinery the desktop app doesn't need; needs the static adapter |

## Decision

Use **Svelte 5 with runes, Vite and TypeScript** (strict), managed with **pnpm**. The Tauri CLI is a **dev dependency** (`pnpm tauri …`), so contributors need no global install. Unit tests use **Vitest**, and state logic lives in plain TypeScript modules (reducers) so it is testable without a DOM.

## Consequences

- ✅ Small bundle and fast start-up, in line with the size target.
- ✅ Scoped component CSS carries the design tokens and clay styles naturally.
- ✅ Pure reducers (flash state, later the app state machine) are unit-tested with Vitest.
- ⚠️ Svelte 5 runes are recent: examples online often show Svelte 4 syntax. Stick to runes (`$state`, `$derived`, `$props`).
- ⚠️ Vite and `@sveltejs/vite-plugin-svelte` majors must match. Upgrade them together.
