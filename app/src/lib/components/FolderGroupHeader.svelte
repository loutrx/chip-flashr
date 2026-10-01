<script lang="ts">
  import { t } from '../i18n/index.svelte';
  import type { WatchedFolder } from '../types';
  import Icon from './Icon.svelte';

  let { folder }: { folder: WatchedFolder } = $props();
</script>

<h2 class="folder">
  <Icon name="folder" size={16} />
  <span class="path">{folder.path}</span>
  <span>· {folder.kind === 'app' ? t().list.folderApp : t().list.folderWatched}</span>
</h2>

<style>
  .folder {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 4px;
    color: var(--cf-muted);
    font-size: 13px;
    font-weight: 400;
  }
  .path {
    font: 12.5px var(--cf-font-mono);
    color: var(--cf-ink);
  }
</style>
