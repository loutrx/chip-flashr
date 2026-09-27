<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { onMount } from 'svelte';

  type AppInfo = { name: string; version: string };
  let info = $state<AppInfo | null>(null);

  onMount(async () => {
    info = await invoke<AppInfo>('app_info');
  });
</script>

<main>
  <h1>{info?.name ?? 'Chip Flashr'}</h1>
  <p>{info ? `v${info.version}` : 'Connexion au cœur Rust…'}</p>
</main>

<style>
  main {
    display: grid;
    place-content: center;
    height: 100%;
    text-align: center;
  }
  h1 {
    margin: 0;
    font-family: var(--cf-font-display);
    font-size: 32px;
  }
  p {
    color: var(--cf-muted);
  }
</style>
