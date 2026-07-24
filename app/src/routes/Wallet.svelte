<script lang="ts">
  import type { Booking, Trip, WalletCard } from '../lib/model/types';
  import { compareIso } from '../lib/logic/dates';
  import BookingCard from '../lib/components/cards/BookingCard.svelte';
  import WalletCardView from '../lib/components/cards/WalletCardView.svelte';
  import { S } from '../lib/i18n/strings';

  let { trip, bookings, cards }: { trip: Trip; bookings: Booking[]; cards: WalletCard[] } = $props();

  type View = 'travel' | 'stays' | 'docs';
  let view = $state<View>('travel');

  const travel = $derived(
    bookings
      .filter((b) => b.kind !== 'hotel')
      .sort((a, b) => compareIso(a.date, b.date) || a.title.localeCompare(b.title)),
  );
  const stays = $derived(bookings.filter((b) => b.kind === 'hotel').sort((a, b) => compareIso(a.date, b.date)));
  const staysPending = $derived(stays.filter((s) => s.status === 'pending').length);
  const docCards = $derived([...cards].sort((a, b) => a.order - b.order));

  /* Flights grouped by their booking group, as on the legacy Wallet. */
  const travelGroups = $derived.by(() => {
    const m = new Map<string, Booking[]>();
    for (const b of travel) {
      const key = b.groupLabel ?? 'Other';
      m.set(key, [...(m.get(key) ?? []), b]);
    }
    return [...m.entries()];
  });
</script>

<main class="wrap" style="padding-top:16px">
  <h1 class="pagename">
    {S.tabs.wallet} <span class="pagesub">show this at the counter</span>
  </h1>

  <div class="seg" role="tablist">
    <button role="tab" aria-selected={view === 'travel'} class:on={view === 'travel'} onclick={() => (view = 'travel')}>
      ✈️ Travel{travel.length ? ` (${travel.length})` : ''}
    </button>
    <button role="tab" aria-selected={view === 'stays'} class:on={view === 'stays'} onclick={() => (view = 'stays')}>
      🛏 Stays{stays.length ? ` (${stays.length})` : ''}
    </button>
    <button role="tab" aria-selected={view === 'docs'} class:on={view === 'docs'} onclick={() => (view = 'docs')}>
      🗂 Cards{docCards.length ? ` (${docCards.length})` : ''}
    </button>
  </div>

  {#if view === 'travel'}
    {#if travel.length === 0}
      <section class="card"><p class="muted" style="margin:0">No flights or trains yet.</p></section>
    {/if}
    {#each travelGroups as [label, items] (label)}
      <h3 class="grouplabel">{label}</h3>
      {#each items as b (b.id)}<BookingCard booking={b} />{/each}
    {/each}
  {:else if view === 'stays'}
    {#if stays.length === 0}
      <section class="card"><p class="muted" style="margin:0">No stays yet.</p></section>
    {:else}
      <h3 class="grouplabel">
        {stays.length} beds{staysPending ? ` · ${staysPending} still to book` : ''}
      </h3>
    {/if}
    {#each stays as b (b.id)}<BookingCard booking={b} />{/each}
  {:else}
    {#if docCards.length === 0}
      <section class="card"><p class="muted" style="margin:0">No documents or money cards yet.</p></section>
    {/if}
    {#each docCards as c (c.id)}<WalletCardView card={c} />{/each}
  {/if}

  <p class="gmnote">
    📧 "Find email" opens Gmail — the only thing here that needs a network. Everything else works
    with no signal at all.
  </p>
  <footer class="foot">{trip.title}</footer>
</main>

<style>
  .grouplabel {
    font-size: 10.5px;
    letter-spacing: 1.6px;
    text-transform: uppercase;
    color: var(--faint);
    font-weight: 800;
    margin: 14px 2px 8px;
  }
  .gmnote {
    font-size: 11.5px;
    color: var(--faint);
    margin: 6px 2px 0;
  }
</style>
