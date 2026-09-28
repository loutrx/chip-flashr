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
    white-space: nowrap;
  }
  .image {
    height: 100px;
    flex-shrink: 0;
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
