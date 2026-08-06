<script lang="ts">
  import type {
    Booking,
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
  import { fmtMoney, fmtMoneyWide, sumMinor, symbolFor } from '../lib/logic/money';
  import Spending from './Spending.svelte';
  import { db } from '../lib/db/db';
  import { deleteEntity, saveEntity } from '../lib/data/edit';
  import { flightSpec, otherBookingSpec, staySpec, walletCardSpec } from '../lib/components/forms/specs';
  import BookingCard from '../lib/components/cards/BookingCard.svelte';
  import WalletCardView from '../lib/components/cards/WalletCardView.svelte';
  import EditSheet from '../lib/components/ui/EditSheet.svelte';
  import EmptyState from '../lib/components/ui/EmptyState.svelte';
  import { S } from '../lib/i18n/strings';

  let {
    trip,
    bookings,
    cards,
    expenses,
    categories,
    stops = [],
    now,
    editing = false,
  }: {
    trip: Trip;
    bookings: Booking[];
    cards: WalletCard[];
    expenses: Expense[];
    categories: ExpenseCategory[];
    stops?: Stop[];
    now: ISODate;
    editing?: boolean;
  } = $props();

  type Sheet =
    | { kind: 'flight'; entity?: FlightBooking; focus?: string }
    | { kind: 'stay'; entity?: HotelBooking; focus?: string }
    | { kind: 'other'; entity?: Booking; focus?: string; defaultKind?: 'train' | 'activity' }
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
    view = b.kind === 'hotel' ? 'stays' : b.kind === 'activity' ? 'tickets' : 'travel';
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

  type View = 'travel' | 'stays' | 'tickets' | 'docs' | 'spend';
  let view = $state<View>('travel');

  /* The Total-Spent hero. It is the sum of what was LOGGED, in the trip's home
     currency — never a projection and never a conversion the app invented. */
  const sym = $derived(symbolFor(trip, trip.homeCurrency));
  const spentMinor = $derived(sumMinor(expenses));

  /* Travel is the legs; Experiences are the things you go TO. They were one
     segment until 2026-08-06, which meant a concert ticket had nowhere to live
     but under a ✈️ heading — and in practice meant it was not in the Wallet at
     all. Beds have always been their own segment for the same reason. */
  const travel = $derived(
    bookings
      .filter((b) => b.kind !== 'hotel' && b.kind !== 'activity')
      .sort((a, b) => compareIso(a.date, b.date) || a.title.localeCompare(b.title)),
  );
  const stays = $derived(bookings.filter((b) => b.kind === 'hotel').sort((a, b) => compareIso(a.date, b.date)));
  const staysPending = $derived(stays.filter((s) => s.status === 'pending').length);
  const tickets = $derived(
    bookings
      .filter((b) => b.kind === 'activity')
      /* WHAT YOU ALREADY HOLD COMES FIRST. This is the one segment where most
         rows are still things to buy, and the one you can actually be turned
         away at a door for not having would otherwise sit at the bottom of ten
         to-dos, in date order. Inside each half, chronological like the rest. */
      .sort(
        (a, b) =>
          Number(b.status === 'booked') - Number(a.status === 'booked') ||
          compareIso(a.date, b.date) ||
          a.title.localeCompare(b.title),
      ),
  );
  const ticketsPending = $derived(tickets.filter((t) => t.status === 'pending').length);
  const docCards = $derived([...cards].sort((a, b) => a.order - b.order));

  /* Bookings grouped by their booking group, as on the legacy Wallet. One
     grouper serves both card segments — the flights' PNR groups, and the
     tickets' bought/still-to-buy split. */
  function groupsOf(list: Booking[]): [string, Booking[]][] {
    const m = new Map<string, Booking[]>();
    for (const b of list) {
      const key = b.groupLabel ?? 'Other';
      m.set(key, [...(m.get(key) ?? []), b]);
    }
    return [...m.entries()];
  }
  const travelGroups = $derived(groupsOf(travel));
  const ticketGroups = $derived(groupsOf(tickets));
</script>

<main class="wrap" style="padding-top:14px">
  <h1 class="bigtitle">{S.wallet.title}</h1>

  <button class="spendhero u-rise" onclick={() => (view = 'spend')}>
    <span class="lab">{S.wallet.totalSpent}</span>
    <span class="amt">{trip.homeCurrency} {fmtMoney(spentMinor, '').trim()}</span>
    <span class="trip">
      🌏 {trip.title}{#if trip.budgetTotalMinor}{` · ${S.wallet.ofBudget(fmtMoneyWide(trip.budgetTotalMinor, sym))}`}{/if}
    </span>
    <span class="glob" aria-hidden="true">◎</span>
  </button>

  <div class="seg" role="tablist">
    <button role="tab" aria-selected={view === 'travel'} class:on={view === 'travel'} onclick={() => (view = 'travel')}>
      ✈️ {S.wallet.travel}{travel.length ? ` (${travel.length})` : ''}
    </button>
    <button role="tab" aria-selected={view === 'stays'} class:on={view === 'stays'} onclick={() => (view = 'stays')}>
      🛏 {S.wallet.stays}{stays.length ? ` (${stays.length})` : ''}
    </button>
    <button role="tab" aria-selected={view === 'tickets'} class:on={view === 'tickets'} onclick={() => (view = 'tickets')}>
      🎟 {S.wallet.experiences}{tickets.length ? ` (${tickets.length})` : ''}
    </button>
    <button role="tab" aria-selected={view === 'docs'} class:on={view === 'docs'} onclick={() => (view = 'docs')}>
      🗂 {S.wallet.cards}{docCards.length ? ` (${docCards.length})` : ''}
    </button>
    <button role="tab" aria-selected={view === 'spend'} class:on={view === 'spend'} onclick={() => (view = 'spend')}>
      💰 {S.wallet.money}
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
      <EmptyState
        glyph={S.empty.travel.glyph}
        title={S.empty.travel.title}
        body={S.empty.travel.body}
        actionLabel={S.empty.travel.action}
        onaction={() => (sheet = { kind: 'flight' })}
        altLabel={S.empty.travel.alt}
        onalt={() => (sheet = { kind: 'other' })}
      />
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
      <EmptyState
        glyph={S.empty.stays.glyph}
        title={S.empty.stays.title}
        body={S.empty.stays.body}
        actionLabel={S.empty.stays.action}
        onaction={() => (sheet = { kind: 'stay' })}
      />
    {:else}
      <h3 class="grouplabel">{S.wallet.beds(stays.length, staysPending)}</h3>
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
  {:else if view === 'tickets'}
    {#if tickets.length === 0}
      <EmptyState
        glyph={S.empty.experiences.glyph}
        title={S.empty.experiences.title}
        body={S.empty.experiences.body}
        actionLabel={S.empty.experiences.action}
        onaction={() => (sheet = { kind: 'other', defaultKind: 'activity' })}
      />
    {:else}
      <h3 class="grouplabel">{S.wallet.tickets(tickets.length, ticketsPending)}</h3>
    {/if}
    {#each ticketGroups as [label, items] (label)}
      <h3 class="grouplabel">{label}</h3>
      {#each items as b (b.id)}
        <div id="bk-{b.id}" class="bkanchor" class:flash={focusId === b.id}>
          <BookingCard booking={b} />
          {@render editRow(() => editBooking(b))}
        </div>
      {/each}
    {/each}
    {#if editing}
      <button class="addbtn" onclick={() => (sheet = { kind: 'other', defaultKind: 'activity' })}>🎟 {S.edit.add('a ticket')}</button>
    {/if}
  {:else if view === 'docs'}
    {#if docCards.length === 0}
      <EmptyState
        glyph={S.empty.cards.glyph}
        title={S.empty.cards.title}
        body={S.empty.cards.body}
        actionLabel={S.empty.cards.action}
        onaction={() => (sheet = { kind: 'card' })}
      />
    {/if}
    {#each docCards as c (c.id)}
      <WalletCardView card={c} />
      {@render editRow(() => (sheet = { kind: 'card', entity: c }))}
    {/each}
    {#if editing}
      <button class="addbtn" onclick={() => (sheet = { kind: 'card' })}>🗂 {S.edit.add('a card')}</button>
    {/if}
  {:else}
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
  {/if}

  <p class="gmnote">{S.wallet.gmailNote}</p>
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
      spec={otherBookingSpec(trip.id, sheet.defaultKind)}
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
  /* FIVE segments since 2026-08-06, on a pill that was drawn for four. The
     labels keep their whole words — a tab called "Exp." is a tab nobody reads —
     and the row buys the room by tightening each button instead. Measured at
     412 px, the phone this is built for: four sit on one line, "Experiences"
     takes two, and the 42 px minimum height already has space for both. */
  .seg button {
    padding: 7px 3px;
    font-size: 11px;
    line-height: 1.3;
  }
  .bigtitle {
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin: 2px 2px 10px;
  }
  /* the one navy surface in the app: money reads as its own material */
  .spendhero {
    display: block;
    width: 100%;
    text-align: left;
    position: relative;
    background: linear-gradient(160deg, #131b22, #0b1014);
    border: 1px solid #23303a;
    border-radius: var(--radius);
    padding: 17px 18px 15px;
    margin-bottom: 16px;
    box-shadow: var(--glow-1);
  }
  .spendhero .lab {
    display: block;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.8px;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .spendhero .amt {
    display: block;
    font-size: 32px;
    font-weight: 800;
    letter-spacing: 0.4px;
    margin: 4px 0 6px;
    font-variant-numeric: tabular-nums;
  }
  .spendhero .trip {
    display: block;
    font-size: 13px;
    color: var(--ink-2);
  }
  .spendhero .glob {
    position: absolute;
    right: 16px;
    top: 14px;
    color: var(--gold);
    font-size: 20px;
  }
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
