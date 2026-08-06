<script lang="ts">
  /* "What we booked, and what each one costs" — the top of the Money screen.
     Every row is one reservation with the price as it was quoted; the footer
     adds up only what could be read and says plainly what is still missing.
     The math lives in lib/logic/booked.ts; this file only paints it. */
  import type { Booking, Stop, Trip } from '../../model/types';
  import { buildBooked, type BookedItem } from '../../logic/booked';
  import { fmtMoneyWide, symbolFor } from '../../logic/money';
  import { fmtRange } from '../../logic/prices';
  import { S } from '../../i18n/strings';
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
    onopen?: (b: Booking) => void;
    onedit?: (b: Booking) => void;
  } = $props();

  const homeSym = $derived(symbolFor(trip, trip.homeCurrency));
  const breakdown = $derived(
    buildBooked(trip, bookings, stops, {
      flights: S.money.flights,
      travel: S.money.travel,
      stays: S.money.stays,
      docs: S.money.fromDocs,
      experiences: S.money.experiences,
    }),
  );
  const budgetMinor = $derived(trip.budgetTotalMinor ?? 0);
  const pct = $derived(
    budgetMinor > 0 ? Math.min(100, Math.round((breakdown.total.maxMinor / budgetMinor) * 100)) : 0,
  );

  function stampOf(item: BookedItem): { label: string; cls: string } | null {
    if (!item.status) return null;
    if (item.status === 'booked') return { label: S.money.booked1, cls: 'ok' };
    if (item.status === 'pending') return { label: S.money.pending, cls: 'warn' };
    return { label: S.money.walkin, cls: '' };
  }

  /** The quoted text, but only when it says something the total does not —
      '~$376' next to '$376' is noise; '$17–40/n' next to '$34 – $80' is not. */
  function quoteHint(item: BookedItem): string | null {
    if (!item.quoted || !item.range) return null;
    /* '$20 – $30' and '$20–30' are the same quote; '€100' and '$100' are not. */
    const bare = (s: string): string => s.replace(/[~≈\s]/g, '').replace(/([–—-])[^\d]*(?=\d)/g, '$1');
    return bare(item.quoted) === bare(fmtRange(item.range, homeSym)) ? null : item.quoted;
  }
</script>

{#snippet what(item: BookedItem)}
  {@const stamp = stampOf(item)}
  <span class="title"><Md text={item.title} /></span>
  <span class="sub">
    {item.sub}
    {#if stamp}<span class="chip {stamp.cls}">{stamp.label}</span>{/if}
  </span>
  {#if item.source}
    <span class="prov">{S.money.fromNote(item.title)}: “{item.source}”</span>
  {/if}
{/snippet}

{#if breakdown.groups.length}
  <section class="bk">
    <header class="bkhead">
      <h3>{S.money.booked}</h3>
      <p class="hint">{S.money.bookedHint}</p>
    </header>

    {#each breakdown.groups as g (g.key)}
      <div class="glabel">
        <span>{g.label}</span>
        <span class="gcount">{g.items.length}</span>
        {#if g.unpriced}<span class="gmiss">{S.money.groupUnpriced(g.unpriced)}</span>{/if}
      </div>

      {#each g.items as item (item.id)}
        {@const hint = quoteHint(item)}
        <div class="row" class:doc={item.source !== null}>
          {#if item.booking && onopen}
            {@const b = item.booking}
            <button class="what" onclick={() => onopen(b)}>{@render what(item)}</button>
          {:else}
            <div class="what">{@render what(item)}</div>
          {/if}

          <span class="amt">
            {#if item.range}
              <b>{fmtRange(item.range, homeSym)}</b>
              {#if hint}<small>{hint}</small>{/if}
            {:else}
              <em class="none">{S.money.noPrice}</em>
            {/if}
          </span>

          {#if editing && item.booking && onedit}
            <button class="editbtn" onclick={() => onedit(item.booking as Booking)} aria-label={S.money.addPrice}>✎</button>
          {/if}
        </div>
      {/each}
    {/each}

    <div class="foot">
      <div class="tot">
        <span class="klabel">{S.money.countedSoFar}</span>
        <b>{fmtRange(breakdown.total, homeSym)}</b>
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
  </section>
{/if}

<style>
  .bk {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
    padding: 13px 0 0;
    margin-bottom: 14px;
  }
  .bkhead {
    padding: 0 13px 10px;
  }
  .bkhead h3 {
    margin: 0;
    font-size: 12px;
    letter-spacing: 1.6px;
    text-transform: uppercase;
    color: var(--ink-2);
    font-weight: 800;
  }
  .hint {
    margin: 3px 0 0;
    font-size: 12px;
    color: var(--faint);
  }
  .glabel {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--paper-2);
    padding: 6px 13px;
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    color: var(--ink-2);
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
  }
  .gcount {
    color: var(--faint);
    font-weight: 700;
  }
  .gmiss {
    margin-left: auto;
    color: var(--faint);
    font-weight: 600;
    letter-spacing: 0.6px;
    text-transform: none;
    font-size: 10.5px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 13px 0 0;
    border-bottom: 1px solid var(--line);
  }
  .row.doc {
    background: var(--accent-soft);
  }
  .what {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-items: flex-start;
    text-align: left;
    background: none;
    border: none;
    color: inherit;
    font: inherit;
    padding: 10px 0 10px 13px;
    min-height: 44px;
    justify-content: center;
  }
  .what:active {
    background: var(--card-2);
  }
  .title {
    font-size: 13.5px;
    font-weight: 650;
    line-height: 1.25;
  }
  .sub {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
    font-size: 11.5px;
    color: var(--faint);
  }
  .prov {
    font-size: 11px;
    color: var(--ink-2);
    line-height: 1.35;
  }
  .chip {
    font-size: 9.5px;
    padding: 1px 7px;
    letter-spacing: 0.6px;
  }
  .amt {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }
  .amt b {
    font-size: 14px;
    font-weight: 700;
  }
  .amt small {
    font-size: 10.5px;
    color: var(--faint);
  }
  .none {
    font-size: 11.5px;
    color: var(--faint);
    font-style: normal;
  }
  .foot {
    padding: 11px 13px 13px;
  }
  .tot {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
  }
  .tot b {
    font-size: 18px;
    font-weight: 750;
    font-variant-numeric: tabular-nums;
  }
  .ofbudget {
    font-size: 12px;
    color: var(--ink-2);
    text-align: right;
    margin-top: 1px;
  }
  .meter {
    display: block;
    height: 5px;
    border-radius: 3px;
    background: var(--paper-2);
    margin-top: 7px;
    overflow: hidden;
  }
  .meter i {
    display: block;
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
  }
  .honest {
    margin: 8px 0 0;
    font-size: 11.5px;
    line-height: 1.45;
    color: var(--faint);
  }
</style>
