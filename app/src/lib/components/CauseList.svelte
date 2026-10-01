<script lang="ts">
  import Card from './Card.svelte';

  let { title, causes }: { title: string; causes: readonly { title: string; detail: string }[] } = $props();

  const id = $props.id();
</script>

<Card gap={12}>
  <h2 class="heading" id="{id}-title">{title}</h2>
  <ul class="causes" aria-labelledby="{id}-title">
    {#each causes as cause, i (i)}
      <li class="cause">
        <span class="title">{cause.title}</span>
        <span class="detail">{cause.detail}</span>
      </li>
    {/each}
  </ul>
</Card>

<style>
  .heading {
    margin: 0;
    font: 700 17px var(--cf-font-display);
  }
  .causes {
    margin: 0;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .cause {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 14px;
  }
  .title {
    font-weight: 600;
  }
  .detail {
    color: var(--cf-muted);
  }
</style>
