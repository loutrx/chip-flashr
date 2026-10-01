<script lang="ts">
  import Button from '../components/Button.svelte';
  import FilterChips from '../components/FilterChips.svelte';
  import FirmwareRow from '../components/FirmwareRow.svelte';
  import FolderGroupHeader from '../components/FolderGroupHeader.svelte';
  import SearchField from '../components/SearchField.svelte';
  import { filterCounts, filterFirmwares, type FirmwareFilter } from '../app/firmware';
  import { t } from '../i18n/index.svelte';
  import type { Snapshot } from '../types';

  let {
    snapshot,
    selectedId,
    onselect,
    onaddfolder,
    onopenfile,
  }: {
    snapshot: Snapshot;
    selectedId: string | null;
    onselect: (id: string) => void;
    onaddfolder: () => void;
    onopenfile: () => void;
  } = $props();

  const FILTERS: readonly FirmwareFilter[] = ['all', 'esp32', 'stm32', 'nrf', 'unidentified'];

  const m = $derived(t());
  let query = $state('');
  let filter = $state<FirmwareFilter>('all');

  const counts = $derived(filterCounts(snapshot.firmwares));
  const options = $derived(FILTERS.map((value) => ({ value, label: filterLabel(value), count: counts[value] })));
  const visible = $derived(filterFirmwares(snapshot.firmwares, filter, query));
  // Folder order is the snapshot's (app folder first); a folder with no visible row is left out.
  const groups = $derived(
    snapshot.folders
      .map((folder, index) => ({ folder, index, firmwares: visible.filter((item) => item.folder === index) }))
      .filter((group) => group.firmwares.length > 0),
  );

  function filterLabel(value: FirmwareFilter): string {
    if (value === 'all') return m.list.all;
    if (value === 'unidentified') return m.list.unidentified;
    return m.families[value].name;
  }

  function pickFilter(value: string) {
    const next = FILTERS.find((candidate) => candidate === value);
    if (next) filter = next;
  }
</script>

<div class="head">
  <div class="heading">
    <h1>{m.list.title}</h1>
    <span class="summary">{m.list.summary(snapshot.firmwares.length, snapshot.folders.length)}</span>
  </div>
  <SearchField
    value={query}
    label={m.list.searchLabel}
    placeholder={m.list.search}
    oninput={(value) => (query = value)}
  />
</div>

<FilterChips {options} value={filter} label={m.list.filtersLabel} onchange={pickFilter} />

{#each groups as group (group.index)}
  <div class="group">
    <FolderGroupHeader folder={group.folder} />
    {#each group.firmwares as item (item.id)}
      <FirmwareRow firmware={item} selected={item.id === selectedId} onselect={() => onselect(item.id)} />
    {/each}
  </div>
{:else}
  <p class="empty">{m.list.empty}</p>
{/each}

<div class="grow"></div>
<div class="footer">
  <Button icon="plus" onclick={onaddfolder}>{m.list.addFolder}</Button>
  <Button variant="ghost" icon="file" onclick={onopenfile}>{m.list.openFile}</Button>
</div>

<style>
  .head {
    display: flex;
    align-items: flex-end;
    gap: 16px;
  }
  .heading {
    flex-grow: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  h1 {
    margin: 0;
    font: 700 26px/1.15 var(--cf-font-display);
    letter-spacing: -0.02em;
  }
  .summary {
    font-size: 14px;
    color: var(--cf-muted);
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .empty {
    margin: 0;
    font-size: 14px;
    color: var(--cf-muted);
  }
  .grow {
    flex-grow: 1;
  }
  .footer {
    display: flex;
    gap: 10px;
  }
</style>
