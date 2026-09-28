<script lang="ts">
  /* GOOD TO KNOW — the trip file's own info cards (the 20 kg rule, airport
     traps, trains, money, the internet), each as it was written. A card the
     trip file marks critical wears the crit edge; nothing else is ranked. */
  import type { InfoCard } from '../../model/types';
  import { router } from '../../state/router.svelte';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Md from '../ui/Md.svelte';

  let {
    cards,
    editing,
    onedit,
    onadd,
  }: {
    cards: InfoCard[];
    editing: boolean;
    onedit: (c: InfoCard) => void;
    onadd: () => void;
  } = $props();

  const sorted = $derived([...cards].sort((a, b) => a.order - b.order));

  /* Find may name one card to land on. */
  $effect(() => {
    const id = router.pendingAnchor;
    if (!id || !id.startsWith('info-')) return;
    router.pendingAnchor = null;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 120);
    return () => clearTimeout(t);
  });
</script>

{#if sorted.length === 0}
  <EmptyState glyph="info" title={S.empty.info.title} body={S.empty.info.body} actionLabel={S.edit.add('an info card')} onaction={onadd} />
{/if}
<div class="icards">
  {#each sorted as g (g.id)}
    <article class="ic" class:crit={g.severity === 'crit'} id="info-{g.id}">
      <header class="ic-head">
        <span class="ic-mark" aria-hidden="true"><Icon name={g.severity === 'crit' ? 'alert' : 'info'} size={17} /></span>
        <h2 class="ic-title"><Md text={g.heading} /></h2>
        {#if editing}
          <button class="editbtn" onclick={() => onedit(g)} aria-label={S.pass.edit}><Icon name="edit" size={15} /></button>
        {/if}
      </header>
      <ul class="ic-items">
        {#each g.items as it, i (i)}<Md text={it} as="li" />{/each}
      </ul>
    </article>
  {/each}
</div>
{#if editing}
  <button class="addbtn" onclick={onadd}>{S.edit.add('an info card')}</button>
{/if}

<style>
  .icards {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 12px;
  }
  .ic {
    padding: 16px 18px;
    border-radius: var(--radius-tile);
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
    scroll-margin-top: 16px;
  }
  .ic.crit {
    border-color: var(--crit-line);
    background:
      linear-gradient(180deg, var(--crit-soft), transparent 50%),
      var(--card);
  }
  .ic-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }
  .ic-mark {
    flex-shrink: 0;
    display: flex;
    color: var(--lilac);
  }
  .ic.crit .ic-mark {
    color: var(--crit-ink);
  }
  .ic-title {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: var(--fs-row);
    font-weight: 600;
    line-height: 1.3;
  }
  .ic-items {
    margin: 0;
    padding-left: 18px;
    font-size: var(--fs-caption);
    line-height: 1.6;
    color: var(--ink-2);
  }
  .ic-items :global(li) {
    margin-bottom: 6px;
  }
  .ic-items :global(b) {
    color: var(--ink);
  }
</style>
