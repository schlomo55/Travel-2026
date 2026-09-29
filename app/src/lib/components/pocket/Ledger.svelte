<script lang="ts">
  /* "What's already committed" — every reservation with the price as it was
     quoted, grouped the way the trip spends (flights, travel, stays,
     experiences), and a footer that adds up only what could be read and
     says plainly what is still missing. The arithmetic is logic/booked.ts;
     this file only draws it.

     It waits behind one tap, closed by default: committed money answers a
     different question from "am I on budget?", which the tiles above it
     answer first. A row opens its booking's pass. */
  import type { Booking, Stop, Trip } from '../../model/types';
  import { buildBooked, type BookedItem } from '../../logic/booked';
  import { fmtMoneyWide, symbolFor } from '../../logic/money';
  import { fmtRange } from '../../logic/prices';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';
  import Md from '../ui/Md.svelte';

  let {
    trip,
    bookings,
    stops,
    editing = false,
    onopen,
    onedit,
  }: {
    trip: Trip;
    bookings: Booking[];
    stops: Stop[];
    editing?: boolean;
    onopen: (b: Booking) => void;
    onedit: (b: Booking) => void;
  } = $props();

  const homeSym = $derived(symbolFor(trip, trip.homeCurrency));
  const breakdown = $derived(
    buildBooked(trip, bookings, stops, {
      flights: S.money.flights,
      travel: S.money.travel,
      stays: S.money.stays,
      docs: S.money.fromDocs,
      experiences: S.money.experiences,
      alternatives: S.money.orInstead,
    }),
  );
  const rowCount = $derived(
    breakdown.groups.reduce((n, g) => n + g.items.length, 0) + (breakdown.alternatives?.items.length ?? 0),
  );
  const budgetMinor = $derived(trip.budgetTotalMinor ?? 0);
  const pct = $derived(budgetMinor > 0 ? Math.min(100, Math.round((breakdown.total.maxMinor / budgetMinor) * 100)) : 0);

  function toneOf(item: BookedItem): { label: string; cls: string } | null {
    if (!item.status) return null;
    if (item.status === 'booked') return { label: S.money.booked1, cls: 'ok' };
    if (item.status === 'pending') return { label: S.money.pending, cls: 'warn' };
    return { label: S.money.walkin, cls: '' };
  }

  /** The quoted text, only when it says something the total does not. */
  function quoteHint(item: BookedItem): string | null {
    if (!item.quoted || !item.range) return null;
    const bare = (s: string): string => s.replace(/[~≈\s]/g, '').replace(/([–—-])[^\d]*(?=\d)/g, '$1');
    return bare(item.quoted) === bare(fmtRange(item.range, homeSym)) ? null : item.quoted;
  }
</script>

{#snippet what(item: BookedItem)}
  {@const st = toneOf(item)}
  <span class="title"><Md text={item.title} /></span>
  <span class="sub">
    {item.sub}
    {#if st}<span class="chip {st.cls}">{st.label}</span>{/if}
  </span>
  {#if item.source}
    <span class="prov">{S.money.fromNote(item.title)}: “{item.source}”</span>
  {/if}
{/snippet}

{#snippet rowsOf(g: { items: BookedItem[] })}
  {#each g.items as item (item.id)}
    {@const hint = quoteHint(item)}
    <div class="row" class:doc={item.source !== null}>
      {#if item.booking}
        {@const b = item.booking}
        <button class="what" onclick={() => onopen(b)}>{@render what(item)}</button>
      {:else}
        <div class="what">{@render what(item)}</div>
      {/if}
      <span class="amt num">
        {#if item.range}
          <b>{fmtRange(item.range, homeSym)}</b>
          {#if hint}<small>{hint}</small>{/if}
        {:else}
          <em class="none">{S.money.noPrice}</em>
        {/if}
      </span>
      {#if editing && item.booking}
        {@const b = item.booking}
        <button class="editbtn" onclick={() => onedit(b)} aria-label={S.money.addPrice}><Icon name="edit" size={15} /></button>
      {/if}
    </div>
  {/each}
{/snippet}

{#if breakdown.groups.length}
  <details class="bk">
    <summary class="bkhead">
      <span class="bk-ic" aria-hidden="true"><Icon name="list" size={18} /></span>
      <span class="bk-text">
        <h2>{S.money.committedDisclosure(rowCount)}</h2>
        <p class="hint">{S.money.bookedHint}</p>
      </span>
      <span class="bk-chev" aria-hidden="true"><Icon name="chevron-down" size={18} /></span>
    </summary>

    {#each breakdown.groups as g (g.key)}
      <div class="glabel">
        <span>{g.label}</span>
        <span class="gcount">{g.items.length}</span>
        {#if g.unpriced}<span class="gmiss">{S.money.groupUnpriced(g.unpriced)}</span>{/if}
      </div>
      {@render rowsOf(g)}
    {/each}

    <!-- The half of an either/or move that will not happen: shown, because
         a fallback you cannot see is a fallback you will not take; never
         added up, because only one of the two journeys will be made. -->
    {#if breakdown.alternatives}
      <div class="glabel alt">
        <span>{breakdown.alternatives.label}</span>
        <span class="gcount">{breakdown.alternatives.items.length}</span>
      </div>
      {@render rowsOf(breakdown.alternatives)}
      <p class="althint">{S.money.orInsteadHint}</p>
    {/if}

    <div class="ledfoot">
      <div class="tot">
        <span class="caps">{S.money.countedSoFar}</span>
        <b class="num">{fmtRange(breakdown.total, homeSym)}</b>
      </div>
      {#if budgetMinor > 0}
        <div class="ofbudget">{S.money.ofBudget(fmtMoneyWide(budgetMinor, homeSym))}</div>
        <span class="meter"><i style="width:{pct}%"></i></span>
      {/if}
      <p class="honest">
        {breakdown.unpriced ? S.money.noPriceYet(breakdown.unpriced) : S.money.allPriced}
        {S.money.notSpent}
      </p>
    </div>
  </details>
{/if}

<style>
  .bk {
    margin-bottom: 14px;
    border-radius: var(--radius-tile);
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
    overflow: hidden;
  }
  /* the card clips: its summary's focus ring goes inside */
  .bkhead:focus-visible {
    outline-offset: -4px;
  }
  .bkhead {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    padding: 10px 14px;
    list-style: none;
    cursor: pointer;
  }
  .bkhead::-webkit-details-marker {
    display: none;
  }
  .bk-ic {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: var(--radius-chip-sm);
    color: var(--lilac-ink);
    background: var(--lilac-soft);
  }
  .bk-text {
    flex: 1;
    min-width: 0;
  }
  .bkhead h2 {
    margin: 0;
    font-size: var(--fs-row);
    font-weight: 600;
    letter-spacing: 0;
    text-transform: none;
    color: var(--ink);
  }
  .hint {
    margin: 2px 0 0;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .bk-chev {
    display: flex;
    color: var(--faint);
    transition: transform var(--motion) var(--ease-out);
  }
  .bk[open] .bk-chev {
    transform: rotate(180deg);
  }
  .glabel {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: var(--card-2);
    border-top: 1px solid var(--line);
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .gcount {
    color: var(--faint);
    letter-spacing: 0.06em;
  }
  .gmiss {
    margin-left: auto;
    font-size: var(--fs-chip);
    font-weight: 600;
    letter-spacing: 0;
    text-transform: none;
    color: var(--ink-2);
  }
  .glabel.alt {
    color: var(--warn-ink);
  }
  .althint {
    margin: 0;
    padding: 8px 14px 10px;
    font-size: var(--fs-caption);
    line-height: 1.45;
    color: var(--ink-2);
    border-bottom: 1px solid var(--line);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 14px 0 0;
    border-top: 1px solid var(--line);
  }
  .row.doc {
    background: var(--sunrise-soft);
  }
  .what {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    gap: 3px;
    min-height: 52px;
    padding: 10px 0 10px 14px;
    text-align: left;
    color: inherit;
    font: inherit;
    background: none;
    border: none;
  }
  button.what:active {
    background: var(--card-2);
  }
  .title {
    font-size: var(--fs-label);
    font-weight: 600;
    line-height: 1.3;
  }
  .sub {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 8px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .sub .chip {
    min-height: 22px;
    padding: 0 8px;
    font-size: var(--fs-caps);
  }
  .prov {
    font-size: var(--fs-caption);
    line-height: 1.35;
    color: var(--ink-2);
  }
  .amt {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1px;
    white-space: nowrap;
  }
  .amt b {
    font-size: var(--fs-code);
    font-weight: 600;
  }
  .amt small {
    font-size: var(--fs-caps);
    color: var(--ink-2);
  }
  .none {
    font-family: var(--font-ui);
    font-size: var(--fs-caption);
    font-style: normal;
    color: var(--ink-2);
  }
  .ledfoot {
    padding: 12px 14px 14px;
    border-top: 1px solid var(--line);
  }
  .tot {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    color: var(--ink-2);
  }
  .tot b {
    font-size: var(--fs-screen-title);
    font-weight: 500;
    color: var(--ink);
  }
  .ofbudget {
    margin-top: 2px;
    text-align: right;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .meter {
    display: block;
    height: 6px;
    margin-top: 8px;
    border-radius: 3px;
    background: var(--scene-track);
    overflow: hidden;
  }
  .meter i {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(90deg, var(--opal-3), var(--opal-2));
  }
  .honest {
    margin: 10px 0 0;
    font-size: var(--fs-caption);
    line-height: 1.5;
    color: var(--ink-2);
  }
</style>
