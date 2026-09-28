<script lang="ts">
  /* SHOW THE DRIVER — every place card: the Chinese a driver reads, on white
     (for other eyes), the English line beside it, one button that opens the
     place in a map, and one that copies the Chinese. A tap on the card opens
     it full screen. A card the trip file still marks pending is drawn as a
     placeholder and cannot be opened for a driver: a half-known destination
     is not something to hold up in a taxi.

     "Maps in China" rides here because it is advice about these buttons,
     and it is shown only to a trip that goes to the mainland — telling a
     trip to Portugal to install 高德地图 would be an invented fact. */
  import type { ShowCard, Stop } from '../../model/types';
  import { isHongKongOrMacau, outOfChina } from '../../logic/geo';
  import { splitWarning } from '../../logic/pass';
  import { copyText } from '../../state/toast.svelte';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import MapButtons from '../ui/MapButtons.svelte';
  import Md from '../ui/Md.svelte';

  let {
    cards,
    stops,
    editing,
    onopen,
    onedit,
    onadd,
  }: {
    cards: ShowCard[];
    stops: Stop[];
    editing: boolean;
    /** Open the full-screen card at this index of the openable list. */
    onopen: (list: ShowCard[], index: number) => void;
    onedit: (c: ShowCard) => void;
    onadd: () => void;
  } = $props();

  const places = $derived(cards.filter((c) => c.kind === 'place').sort((a, b) => a.order - b.order));
  const openable = $derived(places.filter((c) => !c.pending));
  const goesToMainland = $derived(
    [...cards, ...stops].some(
      (x) => !!x.coord && !outOfChina(x.coord.lat, x.coord.lng) && !isHongKongOrMacau({ coord: x.coord }),
    ),
  );
</script>

{#if places.length === 0}
  <EmptyState glyph="car" title={S.pocket.noDriverCards} body={S.pocket.noDriverCardsBody} actionLabel={S.edit.add('a card to show')} onaction={onadd} />
{:else}
  <p class="dl-hint"><Md text={S.info.driverVerify} /></p>
  <ul class="zhlist">
    {#each places as p (p.id)}
      {@const parts = splitWarning(p.meaning)}
      <li class:warned={!!parts.warning}>
        <button
          class="txt"
          onclick={() => onopen(openable, openable.findIndex((c) => c.id === p.id))}
          disabled={p.pending}
          aria-label={S.pocket.driverChip(p.meaning)}
        >
          <span class="zh" class:pend={p.pending} lang="zh">{p.native}</span>
          <span class="en">{parts.main}{#if p.verify}<span class="vfy"> · {S.plan.verify}</span>{/if}</span>
          {#if parts.warning}<span class="warnline"><Icon name="alert" size={13} stroke={2} />{parts.warning}</span>{/if}
          {#if p.note}<span class="note"><Md text={p.note} /></span>{/if}
        </button>
        <div class="acts">
          <MapButtons coord={p.coord} name={p.meaning} query={p.mapQuery} address={p.address} city={p.mapCity} url={p.mapUrl} compact />
          {#if !p.pending}
            <button class="rowbtn" onclick={() => copyText(p.native)} aria-label={S.info.copy}><Icon name="copy" size={17} /></button>
          {/if}
          {#if editing}
            <button class="editbtn" onclick={() => onedit(p)} aria-label={S.pass.edit}><Icon name="edit" size={15} /></button>
          {/if}
        </div>
      </li>
    {/each}
  </ul>

  {#if goesToMainland}
    <section class="hint">
      <h2 class="caps">{S.maps.hintTitle}</h2>
      <ul>
        <Md text={S.maps.hint1} as="li" />
        <Md text={S.maps.hint2} as="li" />
        <Md text={S.maps.hint3} as="li" />
        <Md text={S.maps.hint4} as="li" />
      </ul>
    </section>
  {/if}
{/if}
{#if editing}
  <button class="addbtn" onclick={onadd}>{S.edit.add('a card to show')}</button>
{/if}

<style>
  .dl-hint {
    margin: 4px 4px 12px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .dl-hint :global(i) {
    font-style: normal;
    font-weight: 700;
    color: var(--warn-ink);
  }
  .zhlist {
    list-style: none;
    margin: 0 0 12px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .zhlist li {
    display: flex;
    align-items: stretch;
    gap: 8px;
  }
  /* the card is white = for other eyes, in both themes */
  .txt {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 64px;
    padding: 12px 14px;
    text-align: left;
    color: var(--paper-chip-ink);
    background: var(--paper-chip);
    border: none;
    border-radius: var(--radius-inner);
    box-shadow:
      var(--paper-chip-lift),
      var(--paper-chip-edge);
  }
  .txt:disabled {
    opacity: 0.7;
  }
  .zh {
    font-family: var(--font-zh);
    font-size: 20px;
    font-weight: 700;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }
  .zh.pend {
    font-size: var(--fs-caption);
    font-weight: 500;
    color: var(--counter-crit);
  }
  .en {
    font-size: var(--fs-caption);
    line-height: 1.4;
    color: var(--paper-chip-ink-2);
  }
  .vfy {
    font-weight: 700;
    color: var(--counter-warn);
  }
  .warnline {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: var(--fs-caption);
    font-weight: 600;
    line-height: 1.4;
    color: var(--counter-crit);
  }
  li.warned .txt {
    box-shadow:
      var(--paper-chip-lift),
      0 0 0 2px var(--counter-crit);
  }
  .note {
    font-size: var(--fs-caption);
    line-height: 1.4;
    color: var(--paper-chip-ink-2);
  }
  .acts {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }
  .rowbtn {
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
  .hint {
    margin-top: 6px;
    padding: 14px 16px;
    border-radius: var(--radius-tile);
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
  }
  .hint h2 {
    margin: 0 0 6px;
    color: var(--ink);
  }
  .hint ul {
    margin: 0;
    padding-left: 18px;
    font-size: var(--fs-caption);
    line-height: 1.55;
    color: var(--ink-2);
  }
  .hint :global(li) {
    margin-bottom: 6px;
  }
  .hint :global(b) {
    color: var(--ink);
  }
</style>
