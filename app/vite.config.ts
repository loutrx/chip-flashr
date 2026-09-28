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
    // Vitest mocks every `.css` import (even `?raw`) to an empty string unless
    // matched here; theme.test.ts reads tokens.css?raw and needs the real text.
    // Scoped to tokens.css so every other `.css` import stays mocked.
    css: { include: [/tokens\.css/] },
  },
});
