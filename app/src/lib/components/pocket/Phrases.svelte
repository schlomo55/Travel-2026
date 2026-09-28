<script lang="ts">
  /* PHRASES — the trip's own sentences in Chinese, each one tap from full
     screen for someone else to read, and one tap from the clipboard. They
     are the trip file's words, shown as they are. */
  import type { ShowCard } from '../../model/types';
  import { copyText } from '../../state/toast.svelte';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';
  import EmptyState from '../ui/EmptyState.svelte';

  let {
    cards,
    editing,
    onopen,
    onedit,
    onadd,
  }: {
    cards: ShowCard[];
    editing: boolean;
    onopen: (list: ShowCard[], index: number) => void;
    onedit: (c: ShowCard) => void;
    onadd: () => void;
  } = $props();

  const phrases = $derived(cards.filter((c) => c.kind === 'phrase').sort((a, b) => a.order - b.order));
</script>

{#if phrases.length === 0}
  <EmptyState glyph="speech" title={S.pocket.noPhrases} body={S.pocket.noPhrasesBody} actionLabel={S.edit.add('a phrase')} onaction={onadd} />
{:else}
  <ul class="zhlist">
    {#each phrases as p, i (p.id)}
      <li>
        <button class="txt" onclick={() => onopen(phrases, i)} aria-label={S.pocket.phraseAria(p.meaning)}>
          <span class="zh" lang="zh">{p.native}</span>
          <span class="en">{p.meaning}</span>
        </button>
        <button class="rowbtn" onclick={() => copyText(p.native)} aria-label={S.info.copy}><Icon name="copy" size={17} /></button>
        {#if editing}
          <button class="editbtn" onclick={() => onedit(p)} aria-label={S.pass.edit}><Icon name="edit" size={15} /></button>
        {/if}
      </li>
    {/each}
  </ul>
{/if}
{#if editing}
  <button class="addbtn" onclick={onadd}>{S.edit.add('a phrase')}</button>
{/if}

<style>
  .zhlist {
    list-style: none;
    margin: 0 0 12px;
    padding: 4px 6px 4px 14px;
    border-radius: var(--radius-card);
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
  }
  .zhlist li {
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid var(--line);
  }
  .zhlist li:last-child {
    border-bottom: none;
  }
  .txt {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-height: 64px;
    padding: 10px 0;
    text-align: left;
    color: var(--ink);
    background: none;
    border: none;
  }
  .zh {
    font-family: var(--font-zh);
    font-size: 20px;
    font-weight: 700;
    line-height: 1.35;
  }
  .en {
    font-size: var(--fs-caption);
    line-height: 1.4;
    color: var(--ink-2);
  }
  .rowbtn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: var(--radius-button-sm);
    border: 1px solid var(--line);
    background: var(--card-2);
    color: var(--ink);
  }
</style>
