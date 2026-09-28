<script lang="ts">
  /* POCKET — "everything to show someone or need offline in one tap" (ROUND4
     §IA). This file routes inside the place and owns what floats above it:

     · #/trip/:id/pocket             the Pocket home (f-pocket)
     · #/trip/:id/pocket/<section>   a list or a tool — travel, stays,
                                     experiences, cards, money, docs, driver,
                                     phrases, visa, emergency, convert,
                                     health, info, notes, clocks
     · #/trip/:id/pocket/<booking>   the pass (f-pass)

     Counter mode and the driver card are full-screen LAYERS (Android back
     closes them); the editors are sheets. Every one of them registers with
     router.pushLayer, inside its own component. */
  import type {
    Booking,
    ComplianceCounter,
    DayDefault,
    DayPlan,
    DocumentFile,
    EmergencyContact,
    Expense,
    ExpenseCategory,
    FlightBooking,
    HotelBooking,
    InfoCard,
    ISODate,
    PackingItem,
    ShowCard,
    Stop,
    Trip,
    TripNote,
    WalletCard,
  } from '../lib/model/types';
  import { db } from '../lib/db/db';
  import { deleteEntity, saveEntity } from '../lib/data/edit';
  import {
    counterSpec,
    emergencySpec,
    flightSpec,
    infoCardSpec,
    otherBookingSpec,
    showCardSpec,
    staySpec,
    walletCardSpec,
  } from '../lib/components/forms/specs';
  import { nextCommitment } from '../lib/logic/commitment';
  import { attachedDocs, counterSubject, passKind, walletSectionOf, type CounterSubject } from '../lib/logic/pass';
  import { isPocketSection, router, type PocketSection } from '../lib/state/router.svelte';
  import { S } from '../lib/i18n/strings';
  import SubHeader from '../lib/components/horizon/SubHeader.svelte';
  import EditSheet from '../lib/components/ui/EditSheet.svelte';
  import PocketHome from '../lib/components/pocket/PocketHome.svelte';
  import Pass from '../lib/components/pocket/Pass.svelte';
  import CounterMode from '../lib/components/pocket/CounterMode.svelte';
  import DriverCard from '../lib/components/pocket/DriverCard.svelte';
  import WalletList from '../lib/components/pocket/WalletList.svelte';
  import WalletCards from '../lib/components/pocket/WalletCards.svelte';
  import Money from '../lib/components/pocket/Money.svelte';
  import Documents from '../lib/components/pocket/Documents.svelte';
  import Visa from '../lib/components/pocket/Visa.svelte';
  import Emergency from '../lib/components/pocket/Emergency.svelte';
  import DriverList from '../lib/components/pocket/DriverList.svelte';
  import Phrases from '../lib/components/pocket/Phrases.svelte';
  import Converter from '../lib/components/pocket/Converter.svelte';
  import Health from '../lib/components/pocket/Health.svelte';
  import InfoCards from '../lib/components/pocket/InfoCards.svelte';
  import Notes from '../lib/components/pocket/Notes.svelte';
  import Clocks from '../lib/components/pocket/Clocks.svelte';

  let {
    trip,
    counters,
    stops,
    dayPlans,
    dayDefaults,
    bookings,
    cards,
    expenses,
    categories,
    documents,
    infoCards,
    emergency,
    showCards,
    packing,
    note,
    now,
    editing,
    sub,
  }: {
    trip: Trip;
    counters: ComplianceCounter[];
    stops: Stop[];
    dayPlans: DayPlan[];
    dayDefaults: DayDefault[];
    bookings: Booking[];
    cards: WalletCard[];
    expenses: Expense[];
    categories: ExpenseCategory[];
    documents: DocumentFile[];
    infoCards: InfoCard[];
    emergency: EmergencyContact[];
    showCards: ShowCard[];
    packing: PackingItem[];
    note?: TripNote;
    now: ISODate;
    editing: boolean;
    sub?: string;
  } = $props();

  const home = $derived(`#/trip/${encodeURIComponent(trip.id)}/pocket`);
  const section = $derived<PocketSection | null>(isPocketSection(sub) ? sub : null);
  const booking = $derived(!section && sub ? (bookings.find((b) => b.id === sub) ?? null) : null);
  const nextId = $derived(nextCommitment(bookings, now)?.booking.id ?? null);

  /* a new sub-screen starts at its top */
  $effect(() => {
    void sub;
    window.scrollTo(0, 0);
  });

  /* ---------- the layers ---------- */
  let counter = $state<CounterSubject | null>(null);
  let driver = $state<{ list: ShowCard[]; index: number } | null>(null);
  function openCounter(x: Booking | WalletCard): void {
    const s = 'kind' in x ? counterSubject(x) : counterSubject({ kind: 'card', title: x.title, code: x.code, codeLabel: x.codeLabel });
    if (s) counter = s;
  }
  function openDriver(list: ShowCard[], index: number): void {
    if (!list.length || index < 0) return;
    driver = { list, index };
  }

  /* ---------- the editors ---------- */
  type Sheet =
    | { kind: 'flight'; entity?: FlightBooking; focus?: string }
    | { kind: 'stay'; entity?: HotelBooking; focus?: string }
    | { kind: 'other'; entity?: Booking; focus?: string; defaultKind?: 'train' | 'activity' }
    | { kind: 'card'; entity?: WalletCard }
    | { kind: 'show'; entity?: ShowCard }
    | { kind: 'emergency'; entity?: EmergencyContact }
    | { kind: 'info'; entity?: InfoCard }
    | { kind: 'counter'; entity?: ComplianceCounter };
  let sheet = $state<Sheet | null>(null);
  function editBooking(b: Booking, focus?: string): void {
    if (b.kind === 'flight') sheet = { kind: 'flight', entity: b, focus };
    else if (b.kind === 'hotel') sheet = { kind: 'stay', entity: b, focus };
    else sheet = { kind: 'other', entity: b, focus };
  }
  function addBooking(kind: 'flight' | 'stay' | 'train' | 'activity'): void {
    if (kind === 'flight') sheet = { kind: 'flight' };
    else if (kind === 'stay') sheet = { kind: 'stay' };
    else sheet = { kind: 'other', defaultKind: kind };
  }
  /* A pass whose booking is deleted from its own screen goes back to its list. */
  async function deleteBooking(b: Booking, label: string): Promise<void> {
    await deleteEntity(db.bookings, b, label);
    if (sub === b.id) router.replace(`${home}/${walletSectionOf(b)}`);
  }

  const TITLES: Record<PocketSection, string> = {
    travel: S.wallet.travel,
    stays: S.wallet.stays,
    experiences: S.wallet.experiences,
    cards: S.wallet.cards,
    money: S.wallet.money,
    docs: S.pocket.documents,
    driver: S.pocket.driverScreen,
    phrases: S.info.phrases,
    visa: S.pocket.visaScreen,
    emergency: S.pocket.emergency,
    convert: S.convert.title,
    health: S.health.title,
    info: S.pocket.goodToKnow,
    notes: S.info.notes,
    clocks: S.info.clocks,
  };
  const SUBS: Partial<Record<PocketSection, string>> = {
    travel: S.pocket.inWallet,
    stays: S.pocket.inWallet,
    experiences: S.pocket.inWallet,
    cards: S.pocket.inWallet,
    driver: S.pocket.whiteHint,
    convert: S.convert.subtitle,
  };
  const PASS_TITLE = { flight: S.pass.flight, train: S.pass.train, road: S.pass.road, stay: S.pass.stay, ticket: S.pass.ticket };
</script>

{#if !sub}
  <PocketHome
    {trip}
    {counters}
    {stops}
    {dayPlans}
    {dayDefaults}
    {bookings}
    {cards}
    {expenses}
    {documents}
    {infoCards}
    {emergency}
    {showCards}
    {packing}
    {note}
    {now}
    oncounter={openCounter}
    ondriver={openDriver}
  />
{:else if section}
  <SubHeader
    title={TITLES[section]}
    subtitle={SUBS[section] ?? S.nav.pocket}
    up={home}
    backLabel={S.pocket.backToPocket}
    editable={section !== 'convert' && section !== 'clocks' && section !== 'health'}
  />
  <main class="wrap psec" data-section={section}>
    {#if section === 'travel' || section === 'stays' || section === 'experiences'}
      <WalletList {section} {bookings} tripId={trip.id} {editing} onadd={addBooking} />
    {:else if section === 'cards'}
      <WalletCards
        {cards}
        {editing}
        oncounter={openCounter}
        onedit={(c) => (sheet = { kind: 'card', entity: c })}
        onadd={() => (sheet = { kind: 'card' })}
      />
    {:else if section === 'money'}
      <Money
        {trip}
        {expenses}
        {categories}
        {bookings}
        {stops}
        {now}
        {editing}
        onopenBooking={(b) => router.goPocket(trip.id, b.id)}
        oneditBooking={(b) => editBooking(b, 'priceNote')}
      />
    {:else if section === 'docs'}
      <Documents {trip} {documents} {bookings} {cards} {editing} />
    {:else if section === 'visa'}
      <Visa
        {counters}
        {now}
        {editing}
        onedit={(c) => (sheet = { kind: 'counter', entity: c })}
        onadd={() => (sheet = { kind: 'counter' })}
      />
    {:else if section === 'emergency'}
      <Emergency
        contacts={emergency}
        {editing}
        onedit={(c) => (sheet = { kind: 'emergency', entity: c })}
        onadd={() => (sheet = { kind: 'emergency' })}
      />
    {:else if section === 'driver'}
      <DriverList
        cards={showCards}
        {stops}
        {editing}
        onopen={openDriver}
        onedit={(c) => (sheet = { kind: 'show', entity: c })}
        onadd={() => (sheet = { kind: 'show' })}
      />
    {:else if section === 'phrases'}
      <Phrases
        cards={showCards}
        {editing}
        onopen={openDriver}
        onedit={(c) => (sheet = { kind: 'show', entity: c })}
        onadd={() => (sheet = { kind: 'show' })}
      />
    {:else if section === 'convert'}
      <Converter {trip} {expenses} {now} />
    {:else if section === 'health'}
      <Health walletCards={cards} {emergency} {infoCards} {documents} docsHref="{home}/docs" />
    {:else if section === 'info'}
      <InfoCards
        cards={infoCards}
        {editing}
        onedit={(c) => (sheet = { kind: 'info', entity: c })}
        onadd={() => (sheet = { kind: 'info' })}
      />
    {:else if section === 'notes'}
      <Notes tripId={trip.id} {note} {editing} />
    {:else}
      <Clocks {trip} />
    {/if}
  </main>
{:else if booking}
  <SubHeader
    title={PASS_TITLE[passKind(booking)]}
    subtitle={S.pocket.passSub(
      walletSectionOf(booking) === 'stays' ? S.wallet.stays : walletSectionOf(booking) === 'experiences' ? S.wallet.experiences : S.wallet.travel,
    )}
    up="{home}/{walletSectionOf(booking)}"
    backLabel={S.pocket.backToPocket}
    editable
  />
  <main class="wrap psec">
    <Pass
      {booking}
      documents={attachedDocs(documents, booking.id)}
      {now}
      isNext={booking.id === nextId}
      {editing}
      oncounter={() => openCounter(booking)}
      onedit={() => editBooking(booking)}
    />
  </main>
{:else}
  <SubHeader title={S.pocket.gone} up={home} backLabel={S.pocket.backToPocket} />
  <main class="wrap psec">
    <section class="card">
      <p class="muted" style="margin:0">{S.pocket.goneBody}</p>
    </section>
  </main>
{/if}

{#if counter}
  <CounterMode subject={counter} onclose={() => (counter = null)} />
{/if}
{#if driver}
  <DriverCard cards={driver.list} start={driver.index} suffix={trip.driverSuffix} onclose={() => (driver = null)} />
{/if}

{#if sheet}
  {@const close = () => (sheet = null)}
  {#if sheet.kind === 'flight'}
    <EditSheet
      spec={flightSpec(trip.id)}
      entity={sheet.entity}
      focus={sheet.focus}
      onsave={(b) => saveEntity(db.bookings, b)}
      ondelete={sheet.entity ? () => deleteBooking(sheet?.entity as Booking, S.pocket.deleted.flight) : undefined}
      onclose={close}
    />
  {:else if sheet.kind === 'stay'}
    <EditSheet
      spec={staySpec(trip.id)}
      entity={sheet.entity}
      focus={sheet.focus}
      onsave={(b) => saveEntity(db.bookings, b)}
      ondelete={sheet.entity ? () => deleteBooking(sheet?.entity as Booking, S.pocket.deleted.stay) : undefined}
      onclose={close}
    />
  {:else if sheet.kind === 'other'}
    <EditSheet
      spec={otherBookingSpec(trip.id, sheet.defaultKind)}
      entity={sheet.entity}
      focus={sheet.focus}
      onsave={(b) => saveEntity(db.bookings, b)}
      ondelete={sheet.entity ? () => deleteBooking(sheet?.entity as Booking, S.pocket.deleted.booking) : undefined}
      onclose={close}
    />
  {:else if sheet.kind === 'card'}
    <EditSheet
      spec={walletCardSpec(trip.id, cards.length, trip.homeCurrency)}
      entity={sheet.entity}
      onsave={(c) => saveEntity(db.walletCards, c)}
      ondelete={sheet.entity ? () => deleteEntity(db.walletCards, sheet?.entity as WalletCard, S.pocket.deleted.card) : undefined}
      onclose={close}
    />
  {:else if sheet.kind === 'show'}
    <EditSheet
      spec={showCardSpec(trip.id, showCards.length)}
      entity={sheet.entity}
      onsave={(c) => saveEntity(db.showCards, c)}
      ondelete={sheet.entity ? () => deleteEntity(db.showCards, sheet?.entity as ShowCard, S.pocket.deleted.card) : undefined}
      onclose={close}
    />
  {:else if sheet.kind === 'emergency'}
    <EditSheet
      spec={emergencySpec(trip.id, emergency.length)}
      entity={sheet.entity}
      onsave={(c) => saveEntity(db.emergency, c)}
      ondelete={sheet.entity ? () => deleteEntity(db.emergency, sheet?.entity as EmergencyContact, S.pocket.deleted.contact) : undefined}
      onclose={close}
    />
  {:else if sheet.kind === 'info'}
    <EditSheet
      spec={infoCardSpec(trip.id, infoCards.length)}
      entity={sheet.entity}
      onsave={(c) => saveEntity(db.infoCards, c)}
      ondelete={sheet.entity ? () => deleteEntity(db.infoCards, sheet?.entity as InfoCard, S.pocket.deleted.card) : undefined}
      onclose={close}
    />
  {:else}
    <EditSheet
      spec={counterSpec(trip.id)}
      entity={sheet.entity}
      onsave={(c) => saveEntity(db.counters, c)}
      ondelete={sheet.entity ? () => deleteEntity(db.counters, sheet?.entity as ComplianceCounter, S.pocket.deleted.counter) : undefined}
      onclose={close}
    />
  {/if}
{/if}

<style>
  .psec {
    padding-top: 6px;
  }
</style>
