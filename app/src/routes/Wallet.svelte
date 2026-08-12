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
  import { buildBooked } from '../lib/logic/booked';
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
    focusBookingId,
  }: {
    trip: Trip;
    bookings: Booking[];
    cards: WalletCard[];
    expenses: Expense[];
    categories: ExpenseCategory[];
    stops?: Stop[];
    now: ISODate;
    editing?: boolean;
    /** Deep link from another screen — `#/trip/<id>/wallet/<bookingId>`. The
        Plans page's connectors use it: tapping how you get from one city to the
        next opens the card that already describes it, in its own segment,
        rather than repeating the same facts in a second place. */
    focusBookingId?: string;
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

  /* Arriving on a deep link is the same act as tapping a money row, so it runs
     through the same function rather than a parallel path that could drift. */
  $effect(() => {
    const id = focusBookingId;
    if (!id) return;
    const b = bookings.find((x) => x.id === id);
    if (b) showBooking(b);
  });

  type View = 'travel' | 'stays' | 'tickets' | 'docs' | 'spend';
  let view = $state<View>('travel');

  /* The Total-Spent hero. It is the sum of what was LOGGED, in the trip's home
     currency — never a projection and never a conversion the app invented. */
  const sym = $derived(symbolFor(trip, trip.homeCurrency));
  const spentMinor = $derived(sumMinor(expenses));
  /* The other figure the tab prints, named beside the first one instead of
     being met, unexplained and $1,000 apart, two taps away. */
  const committedMinor = $derived(
    buildBooked(trip, bookings, stops, {
      flights: S.money.flights,
      travel: S.money.travel,
      stays: S.money.stays,
      docs: S.money.fromDocs,
      experiences: S.money.experiences,
      alternatives: S.money.orInstead,
    }).total.maxMinor,
  );

  /* Travel is the legs; Experiences are the things you go TO. They were one
     segment until 2026-08-06, which meant a concert ticket had nowhere to live
     but under a ✈️ heading — and in practice meant it was not in the Wallet at
     all. Beds have always been their own segment for the same reason. */
  /* CANCELLED IS NOT PART OF THE COUNT. booked.ts has always dropped cancelled
     bookings because "a cancelled booking is not something the trip is
     committed to"; the segment badges counted them, so the two screens counted
     the same wallet differently. The card itself is not hidden — a cancelled
     leg is a fact worth finding — it is grouped under its own heading below. */
  const liveOf = (list: Booking[]): Booking[] => list.filter((b) => b.status !== 'cancelled');
  const cancelled = $derived(bookings.filter((b) => b.status === 'cancelled'));
  const travel = $derived(
    liveOf(bookings.filter((b) => b.kind !== 'hotel' && b.kind !== 'activity')).sort(
      (a, b) => compareIso(a.date, b.date) || a.title.localeCompare(b.title),
    ),
  );
  const stays = $derived(
    liveOf(bookings.filter((b) => b.kind === 'hotel')).sort((a, b) => compareIso(a.date, b.date)),
  );
  /* "still to book" counted literal `pending` only, so the gorge walk-in — a
     bed with nothing reserved behind it — never appeared in the reassurance. */
  const staysPending = $derived(stays.filter((s) => s.status !== 'booked').length);
  const tickets = $derived(
    liveOf(bookings.filter((b) => b.kind === 'activity'))
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
  const ticketsPending = $derived(tickets.filter((t) => t.status !== 'booked').length);
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

  <!-- THE HERO SHOUTED ON THE WRONG SEGMENTS. A 150 px navy budget block was
       the loudest object on Travel, Stays, Experiences and Cards — the four
       segments you open for a PNR, a room number or a passport line — pushing
       the confirmation code 44 % down the screen. It belongs to Money, and it
       says which of the tab's two figures it is. -->
  {#if view === 'spend'}
    <div class="spendhero u-rise">
      <span class="lab">{S.wallet.totalSpent}</span>
      <span class="amt">{trip.homeCurrency} {fmtMoney(spentMinor, '').trim()}</span>
      <span class="committed">{S.money.committedBeside(fmtMoneyWide(committedMinor, sym))}</span>
      <span class="trip">
        🌏 {trip.title}{#if trip.budgetTotalMinor}{` · ${S.wallet.ofBudget(fmtMoneyWide(trip.budgetTotalMinor, sym))}`}{/if}
      </span>
      <span class="glob" aria-hidden="true">◎</span>
    </div>
  {/if}

  <!-- FIVE SEGMENTS, TWO ROWS. They were crammed onto one line at 11 px with
       3 px of side padding, which made "Experiences (11)" wrap so its 🎟 sat
       alone on the first line and the selected box no longer matched its own
       label. Two rows at 13 px is the smallest faithful fix — the labels keep
       their whole words and the pattern is still `.seg`. -->
  <div class="seg two" role="tablist">
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

  <!-- Out of the count, still on the screen: a cancelled booking is a fact you
       may need to find, but it is not one of "15 travel". -->
  {#snippet cancelledGroup(items: Booking[])}
    {#if items.length}
      <h3 class="grouplabel crit">{S.money.cancelled} ({items.length})</h3>
      {#each items as b (b.id)}
        <div id="bk-{b.id}" class="bkanchor" class:flash={focusId === b.id}>
          <BookingCard booking={b} />
          {@render editRow(() => editBooking(b))}
        </div>
      {/each}
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
    {@render cancelledGroup(cancelled.filter((b) => b.kind !== 'hotel' && b.kind !== 'activity'))}
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
    {@render cancelledGroup(cancelled.filter((b) => b.kind === 'hotel'))}
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
    {@render cancelledGroup(cancelled.filter((b) => b.kind === 'activity'))}
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
  /* FIVE segments since 2026-08-06, on a pill that was drawn for four. Rather
     than shrink navigation to 11 px — the smallest token in the file, for the
     control this screen is driven by — the row wraps to two: three across the
     top, two below. Labels keep their whole words; a tab called "Exp." is a
     tab nobody reads. */
  .seg button {
    flex: 1 1 30%;
    padding: 7px 6px;
    font-size: 13px;
    line-height: 1.3;
    white-space: nowrap;
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
    margin: 4px 0 2px;
    font-variant-numeric: tabular-nums;
  }
  .spendhero .committed {
    display: block;
    font-size: 13px;
    font-weight: 650;
    color: var(--gold-deep);
    margin-bottom: 5px;
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
  .grouplabel.crit {
    color: var(--crit);
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
