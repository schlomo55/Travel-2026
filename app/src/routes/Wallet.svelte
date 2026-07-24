<script lang="ts">
  import type {
    Booking,
    DocumentFile,
    Expense,
    ExpenseCategory,
    FlightBooking,
    HotelBooking,
    ISODate,
    Stop,
    Trip,
    WalletCard,
  } from '../lib/model/types';
  import { compareIso } from '../lib/logic/dates';
  import Spending from './Spending.svelte';
  import Documents from './Documents.svelte';
  import { db } from '../lib/db/db';
  import { deleteEntity, saveEntity } from '../lib/data/edit';
  import { flightSpec, otherBookingSpec, staySpec, walletCardSpec } from '../lib/components/forms/specs';
  import BookingCard from '../lib/components/cards/BookingCard.svelte';
  import WalletCardView from '../lib/components/cards/WalletCardView.svelte';
  import EditSheet from '../lib/components/ui/EditSheet.svelte';
  import { S } from '../lib/i18n/strings';

  let {
    trip,
    bookings,
    cards,
    expenses,
    categories,
    documents,
    stops = [],
    now,
    editing = false,
  }: {
    trip: Trip;
    bookings: Booking[];
    cards: WalletCard[];
    expenses: Expense[];
    categories: ExpenseCategory[];
    documents: DocumentFile[];
    stops?: Stop[];
    now: ISODate;
    editing?: boolean;
  } = $props();

  type Sheet =
    | { kind: 'flight'; entity?: FlightBooking; focus?: string }
    | { kind: 'stay'; entity?: HotelBooking; focus?: string }
    | { kind: 'other'; entity?: Booking; focus?: string }
    | { kind: 'card'; entity?: WalletCard };
  let sheet = $state<Sheet | null>(null);

  function editBooking(b: Booking, focus?: string): void {
    if (b.kind === 'flight') sheet = { kind: 'flight', entity: b, focus };
    else if (b.kind === 'hotel') sheet = { kind: 'stay', entity: b, focus };
    else sheet = { kind: 'other', entity: b, focus };
  }

  /* A row of the money breakdown opens the real card, in its own segment,
     rather than a second detail screen that would say the same things. */
  let focusId = $state<string | null>(null);
  function showBooking(b: Booking): void {
    view = b.kind === 'hotel' ? 'stays' : 'travel';
    focusId = b.id;
  }
  $effect(() => {
    const id = focusId;
    if (!id) return;
    const scroll = setTimeout(() => {
      document.getElementById(`bk-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 60);
    const clear = setTimeout(() => (focusId = null), 2600);
    return () => {
      clearTimeout(scroll);
      clearTimeout(clear);
    };
  });

  type View = 'travel' | 'stays' | 'docs' | 'spend' | 'docs2';
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
    <button role="tab" aria-selected={view === 'spend'} class:on={view === 'spend'} onclick={() => (view = 'spend')}>
      💰 Money
    </button>
    <button role="tab" aria-selected={view === 'docs2'} class:on={view === 'docs2'} onclick={() => (view = 'docs2')}>
      📎 Files{documents.length ? ` (${documents.length})` : ''}
    </button>
  </div>

  {#snippet editRow(onEdit: () => void)}
    {#if editing}
      <div class="editrow" style="margin:-6px 0 14px">
        <button class="editbtn" onclick={onEdit} aria-label="Edit">✎ Edit</button>
      </div>
    {/if}
  {/snippet}

  {#if view === 'travel'}
    {#if travel.length === 0}
      <section class="card"><p class="muted" style="margin:0">No flights or trains yet.</p></section>
    {/if}
    {#each travelGroups as [label, items] (label)}
      <h3 class="grouplabel">{label}</h3>
      {#each items as b (b.id)}
        <div id="bk-{b.id}" class="bkanchor" class:flash={focusId === b.id}>
          <BookingCard booking={b} />
          {@render editRow(() => editBooking(b))}
        </div>
      {/each}
    {/each}
    {#if editing}
      <button class="addbtn" onclick={() => (sheet = { kind: 'flight' })}>✈️ {S.edit.add('a flight')}</button>
      <button class="addbtn" onclick={() => (sheet = { kind: 'other' })}>🚄 {S.edit.add('a train or activity')}</button>
    {/if}
  {:else if view === 'stays'}
    {#if stays.length === 0}
      <section class="card"><p class="muted" style="margin:0">No stays yet.</p></section>
    {:else}
      <h3 class="grouplabel">
        {stays.length} beds{staysPending ? ` · ${staysPending} still to book` : ''}
      </h3>
    {/if}
    {#each stays as b (b.id)}
      <div id="bk-{b.id}" class="bkanchor" class:flash={focusId === b.id}>
        <BookingCard booking={b} />
        {@render editRow(() => editBooking(b))}
      </div>
    {/each}
    {#if editing}
      <button class="addbtn" onclick={() => (sheet = { kind: 'stay' })}>🛏 {S.edit.add('a stay')}</button>
    {/if}
  {:else if view === 'docs'}
    {#if docCards.length === 0}
      <section class="card"><p class="muted" style="margin:0">No documents or money cards yet.</p></section>
    {/if}
    {#each docCards as c (c.id)}
      <WalletCardView card={c} />
      {@render editRow(() => (sheet = { kind: 'card', entity: c }))}
    {/each}
    {#if editing}
      <button class="addbtn" onclick={() => (sheet = { kind: 'card' })}>🗂 {S.edit.add('a card')}</button>
    {/if}
  {:else if view === 'spend'}
    <Spending
      {trip}
      {expenses}
      {categories}
      {bookings}
      {stops}
      {now}
      {editing}
      onopenBooking={showBooking}
      oneditBooking={(b) => editBooking(b, 'priceNote')}
    />
  {:else}
    <Documents {trip} {documents} {bookings} {cards} />
  {/if}

  <p class="gmnote">
    📧 "Find email" opens Gmail — the only thing here that needs a network. Everything else works
    with no signal at all.
  </p>
  <footer class="foot">{trip.title}</footer>
</main>

{#if sheet}
  {@const close = () => (sheet = null)}
  {#if sheet.kind === 'flight'}
    <EditSheet
      spec={flightSpec(trip.id)}
      entity={sheet.entity}
      focus={sheet.focus}
      onsave={(b) => saveEntity(db.bookings, b)}
      ondelete={sheet.entity ? () => deleteEntity(db.bookings, sheet?.entity as Booking, 'Flight deleted') : undefined}
      onclose={close}
    />
  {:else if sheet.kind === 'stay'}
    <EditSheet
      spec={staySpec(trip.id)}
      entity={sheet.entity}
      focus={sheet.focus}
      onsave={(b) => saveEntity(db.bookings, b)}
      ondelete={sheet.entity ? () => deleteEntity(db.bookings, sheet?.entity as Booking, 'Stay deleted') : undefined}
      onclose={close}
    />
  {:else if sheet.kind === 'other'}
    <EditSheet
      spec={otherBookingSpec(trip.id)}
      entity={sheet.entity}
      focus={sheet.focus}
      onsave={(b) => saveEntity(db.bookings, b)}
      ondelete={sheet.entity ? () => deleteEntity(db.bookings, sheet?.entity as Booking, 'Booking deleted') : undefined}
      onclose={close}
    />
  {:else}
    <EditSheet
      spec={walletCardSpec(trip.id, docCards.length, trip.homeCurrency)}
      entity={sheet.entity}
      onsave={(c) => saveEntity(db.walletCards, c)}
      ondelete={sheet.entity ? () => deleteEntity(db.walletCards, sheet?.entity as WalletCard, 'Card deleted') : undefined}
      onclose={close}
    />
  {/if}
{/if}

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
  /* the card a money row just jumped to, held long enough to be seen */
  .bkanchor {
    border-radius: var(--radius);
    scroll-margin-top: 70px;
  }
  .bkanchor.flash {
    animation: bkflash 2.4s ease-out;
  }
  @keyframes bkflash {
    0%,
    62% {
      box-shadow: 0 0 0 3px var(--accent);
    }
    100% {
      box-shadow: 0 0 0 3px transparent;
    }
  }
</style>
