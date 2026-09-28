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
