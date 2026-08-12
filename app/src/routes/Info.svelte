<script lang="ts">
  /* Info — the hub (plan §SCREENS 6). It absorbed three screens:

     · the route map, which used to sit on top of Plans;
     · the document vault, which used to be a Wallet segment ("Files");
     · the trip statistics, which used to be their own route.

     `#/trip/:id/map`, `.../stats` and `.../docs` now redirect here (router),
     so every deep link that ever existed still lands somewhere true.

     Top to bottom: the compliance clock you cannot afford to lose track of,
     a jump bar, the journey, the papers, the numbers, then the things you
     hold up to a stranger — driver cards, phrases, emergency numbers. */
  import type {
    Booking,
    ComplianceCounter,
    DocumentFile,
    EmergencyContact,
    Expense,
    InfoCard,
    ISODate,
    PackingItem,
    ShowCard,
    Stop,
    Task,
    Trip,
    TripNote,
    WalletCard,
  } from '../lib/model/types';
  import { counterState } from '../lib/logic/counters';
  import { isHongKongOrMacau, outOfChina } from '../lib/logic/geo';
  import { clockIn, fmtLong, fmtShort } from '../lib/logic/dates';
  import { tripStats } from '../lib/logic/stats';
  import { fmtKm, routeDistanceKm } from '../lib/logic/geoStats';
  import { fmtMoney, symbolFor } from '../lib/logic/money';
  import { db } from '../lib/db/db';
  import { deleteEntity, saveEntity } from '../lib/data/edit';
  import { counterSpec, emergencySpec, infoCardSpec, showCardSpec } from '../lib/components/forms/specs';
  import { copyText } from '../lib/state/toast.svelte';
  import { appState } from '../lib/state/appState.svelte';
  import { router } from '../lib/state/router.svelte';
  import Md from '../lib/components/ui/Md.svelte';
  import DriverOverlay from '../lib/components/ui/DriverOverlay.svelte';
  import EditSheet from '../lib/components/ui/EditSheet.svelte';
  import EmptyState from '../lib/components/ui/EmptyState.svelte';
  import MapButtons from '../lib/components/ui/MapButtons.svelte';
  import RouteMap from '../lib/components/RouteMap.svelte';
  import Documents from './Documents.svelte';
  import { S } from '../lib/i18n/strings';

  let {
    trip,
    counters,
    stops,
    bookings,
    expenses,
    tasks,
    packing,
    documents,
    walletCards,
    infoCards,
    emergency,
    showCards,
    note,
    now,
    editing = false,
  }: {
    trip: Trip;
    counters: ComplianceCounter[];
    stops: Stop[];
    bookings: Booking[];
    expenses: Expense[];
    tasks: Task[];
    packing: PackingItem[];
    documents: DocumentFile[];
    walletCards: WalletCard[];
    infoCards: InfoCard[];
    emergency: EmergencyContact[];
    showCards: ShowCard[];
    note?: TripNote | undefined;
    now: ISODate;
    editing?: boolean;
  } = $props();

  type Sheet =
    | { kind: 'counter'; entity?: ComplianceCounter }
    | { kind: 'show'; entity?: ShowCard }
    | { kind: 'emergency'; entity?: EmergencyContact }
    | { kind: 'info'; entity?: InfoCard };
  let sheet = $state<Sheet | null>(null);

  let driver = $state<ShowCard | null>(null);

  /* Clock faces recompute off this tick rather than on every render. */
  let tick = $state(Date.now());
  $effect(() => {
    const id = setInterval(() => (tick = Date.now()), 30_000);
    return () => clearInterval(id);
  });
  const clockFaces = $derived(trip.clocks.map((c) => ({ ...c, time: clockIn(c.timeZone, new Date(tick)) })));

  const places = $derived(showCards.filter((c) => c.kind === 'place').sort((a, b) => a.order - b.order));
  const phrases = $derived(showCards.filter((c) => c.kind === 'phrase' && !c.isKey).sort((a, b) => a.order - b.order));
  const cards = $derived([...infoCards].sort((a, b) => a.order - b.order));
  const contacts = $derived([...emergency].sort((a, b) => a.order - b.order));
  const realStops = $derived(stops.filter((s) => s.kind === 'stop'));

  /* The pinned counter, as the pill that rides above everything. */
  const pinned = $derived(counters.find((c) => c.pinned));
  const pinnedState = $derived(pinned ? counterState(pinned, now) : null);

  /* ONLY knowable numbers. A tile whose data is absent is not drawn — an empty
     tile would read as a zero, and a zero is a claim. */
  const sym = $derived(symbolFor(trip, trip.homeCurrency));
  const st = $derived(tripStats(trip, now, { stops, expenses, bookings, tasks, packing }));
  const distanceKm = $derived(routeDistanceKm(stops));
  const tiles = $derived.by(() => {
    const out: { label: string; value: string; cls: string }[] = [];
    out.push({ label: S.info.stat.days, value: String(st.days), cls: '' });
    out.push({ label: S.info.stat.stops, value: String(st.stops), cls: '' });
    if (st.nights > 0) out.push({ label: S.info.stat.nights, value: String(st.nights), cls: '' });
    if (distanceKm !== null) out.push({ label: S.info.stat.distance, value: fmtKm(distanceKm), cls: 'ok' });
    if (expenses.length) out.push({ label: S.info.stat.spent, value: fmtMoney(st.totalMinor, sym), cls: 'gold' });
    const totalBookings =
      st.bookingsByStatus.booked + st.bookingsByStatus.pending + st.bookingsByStatus.walkin;
    if (totalBookings > 0) {
      out.push({
        label: S.info.stat.bookings,
        value: `${st.bookingsByStatus.booked}/${totalBookings}`,
        cls: 'neon',
      });
    }
    if (st.packedTotal > 0) {
      out.push({ label: S.info.stat.packed, value: `${st.packedDone}/${st.packedTotal}`, cls: 'neon' });
    }
    return out;
  });

  /* The jump bar only offers sections this trip actually has. */
  const jumps = $derived.by(() => {
    const j: { id: string; label: string }[] = [];
    if (realStops.length) j.push({ id: 'route', label: S.info.jump.route });
    if (documents.some((d) => d.tag !== 'photo')) j.push({ id: 'docs', label: S.info.jump.docs });
    if (tiles.length) j.push({ id: 'stats', label: S.info.jump.stats });
    if (clockFaces.length) j.push({ id: 'clocks', label: S.info.jump.clocks });
    if (places.length) j.push({ id: 'driver', label: S.info.jump.driver });
    if (contacts.length) j.push({ id: 'emergency', label: S.info.jump.emergency });
    if (note?.text) j.push({ id: 'notes', label: S.info.jump.notes });
    return j;
  });
  function jump(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* A trip can arrive with nothing in Info at all — another traveller's file,
     a trip started from scratch this morning (§DECISIONS: trips may start
     shallow). Rather than five empty sections, that case gets one honest
     screen-level empty state. Anything filed at all, and the hub draws its
     spine — route, vault, numbers — each with its own empty state. */
  /* "Maps in China" is advice about Amap and the Great Firewall. It is true of
     a mainland trip and false of every other one, so it is derived from the
     trip's own coordinates instead of being shown to everybody — telling an
     Israeli trip to install 高德地图 is exactly the invented fact §RULES 2
     forbids. Hong Kong and Macau are excluded: they go to Google Maps. */
  const goesToMainland = $derived(
    [...showCards, ...stops].some(
      (x) => !!x.coord && !outOfChina(x.coord.lat, x.coord.lng) && !isHongKongOrMacau({ coord: x.coord }),
    ),
  );

  const files = $derived(documents.filter((d) => d.tag !== 'photo'));
  const hubEmpty = $derived(
    counters.length === 0 &&
      realStops.length === 0 &&
      files.length === 0 &&
      clockFaces.length === 0 &&
      places.length === 0 &&
      phrases.length === 0 &&
      contacts.length === 0 &&
      cards.length === 0 &&
      !note?.text,
  );
</script>

<main class="wrap" style="padding-top:14px">
  <h1 class="bigtitle">{S.info.title} <span class="sub">{S.info.subtitle}</span></h1>

  {#if appState.offline}<div class="offchip">{S.system.offline}</div>{/if}

  <!-- `tight` used to fire only while counting, so the calmest possible pill
       was drawn on the day the limit was passed — the one day it is a fact
       rather than a countdown. -->
  {#if pinned && pinnedState}
    <div
      class="visapill"
      class:tight={pinnedState.phase === 'overLimit' || (pinnedState.phase === 'counting' && pinnedState.remaining <= 3)}
    >
      <span class="dotp" aria-hidden="true"></span>
      {#if pinnedState.phase === 'counting'}
        <span>{pinned.icon ?? '🛂'} {S.info.counterPill(pinned.name, pinnedState.day, pinnedState.limitDays)}</span>
      {:else if pinnedState.phase === 'entryDay'}
        <span>{pinned.icon ?? '🛂'} {S.today.entryDay}</span>
      {:else if pinnedState.phase === 'complete'}
        <span>{pinned.icon ?? '🛂'} {S.today.counterComplete(pinned.name)}</span>
      {:else if pinnedState.phase === 'overLimit'}
        <span class="over">{pinned.icon ?? '🛂'} {S.today.counterOver(pinned.name)}</span>
      {:else}
        <span>{pinned.icon ?? '🛂'} {pinned.name} · {fmtLong(pinned.startDate)}</span>
      {/if}
      {#if pinned.hardDeadline}<b>· {S.info.exitBy(fmtShort(pinned.hardDeadline))}</b>{/if}
    </div>
  {/if}

  {#if jumps.length > 1}
    <nav class="jumpbar" aria-label="Jump to a section">
      {#each jumps as j (j.id)}
        <button class="jchip" onclick={() => jump(j.id)}>{j.label}</button>
      {/each}
    </nav>
  {/if}

  {#if hubEmpty}
    <EmptyState glyph={S.empty.info.glyph} title={S.empty.info.title} body={S.empty.info.body} />
  {:else}
    <!-- ---------- the journey ---------- -->
    <section class="isec" id="route">
      <h3>{S.info.journeyOverview}</h3>
      {#if realStops.length}
        <p class="isub">{S.info.stopsSub(realStops.length)}</p>
        <div class="routebox">
          <RouteMap {trip} {stops} {bookings} {counters} {now} />
        </div>
      {:else}
        <EmptyState
          compact
          glyph={S.empty.route.glyph}
          title={S.empty.route.title}
          body={S.empty.route.body}
          actionLabel={S.empty.route.action}
          onaction={() => router.goTab(trip.id, 'itinerary')}
        />
      {/if}
    </section>

    <!-- ---------- the papers ---------- -->
    <section class="isec" id="docs">
      <h3>{S.info.documentVault}</h3>
      <Documents {trip} {documents} {bookings} cards={walletCards} {editing} />
    </section>

    <!-- ---------- the numbers ---------- -->
    {#if tiles.length}
      <section class="isec" id="stats">
        <h3>{S.info.tripStatistics}</h3>
        <div class="statgrid">
          {#each tiles as t (t.label)}
            <div class="stat">
              <div class="sl">{t.label}</div>
              <div class="sv {t.cls}">{t.value}</div>
            </div>
          {/each}
        </div>
        <p class="isub" style="margin-top:10px">{S.info.deepMoney}</p>
      </section>
    {/if}
  {/if}

  <!-- ---------- the compliance detail ----------
       The app bar's status pill lands here (TripShell.openCompliance). -->
  <div id="compliance"></div>
  {#each counters as c (c.id)}
    {@const cst = counterState(c, now)}
    <section class="card" class:crit={cst.phase === 'overLimit' || (cst.phase === 'counting' && cst.remaining <= 3)}>
      <h3>{c.icon ?? '🛂'} {c.name}</h3>
      {#if cst.phase === 'before'}
        <div>{S.info.counterStarts(fmtLong(c.startDate))}{c.countStartsDayAfter ? S.info.counterDayAfter : ''}.</div>
      {:else if cst.phase === 'entryDay'}
        <div>{S.today.entryDay}</div>
      {:else if cst.phase === 'complete'}
        <div>
          {S.info.counterDone(
            c.plannedEndDate ? fmtLong(c.plannedEndDate) : S.info.counterOnSchedule,
            cst.day,
            cst.limitDays,
          )}.
        </div>
      {:else}
        <div class="cline">
          {S.info.counterDay} <b class="cbig">{cst.day}</b>
          {S.info.counterOf(cst.limitDays)} · <b>{S.info.counterLeft(cst.remaining)}</b>
        </div>
      {/if}
      {#if c.hardDeadline}
        <div class="small" style="margin-top:6px">{S.info.hardDeadline}: <b>{fmtLong(c.hardDeadline)}</b></div>
      {/if}
      {#if c.note}<div class="muted" style="margin-top:6px"><Md text={c.note} as="div" /></div>{/if}
      {#if editing}
        <div class="editrow">
          <button class="editbtn" onclick={() => (sheet = { kind: 'counter', entity: c })}>✎ {S.edit.turnOn}</button>
        </div>
      {/if}
    </section>
  {/each}
  {#if editing}
    <button class="addbtn" onclick={() => (sheet = { kind: 'counter' })}>{S.edit.add('a counter')}</button>
  {/if}

  {#if clockFaces.length}
    <section class="card" id="clocks">
      <h3>{S.info.clocks} <span class="h3sub">· {S.info.clocksSub}</span></h3>
      <div class="clocks">
        {#each clockFaces as c (c.timeZone)}
          <div class="clock">
            <div class="cl">{c.flag ?? ''} {c.label}</div>
            <div class="clocknum mono">{c.time}</div>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <!-- The driver cards: a Lantern frame around content the overlay renders in
       plain black and white (§RULES 4 — Lantern styles the frame, never the
       card a stranger reads). -->
  {#if places.length}
    <section class="card lit" id="driver">
      <h3>🚕 {S.info.driverTitle} <span class="h3sub">· {S.info.driverSub}</span></h3>
      <p class="muted dhint"><Md text={S.info.driverVerify} /></p>
      <ul class="zhlist">
        {#each places as p (p.id)}
          <li>
            <button class="txt" onclick={() => !p.pending && (driver = p)} disabled={p.pending}>
              <span class="zh" class:pend={p.pending}>{p.native}</span>
              <span class="en">
                {p.meaning}{#if p.verify}<span class="vfy"> · verify</span>{/if}
              </span>
              {#if p.note}<span class="small"><Md text={p.note} /></span>{/if}
            </button>
            <MapButtons coord={p.coord} name={p.meaning} query={p.mapQuery} address={p.address} city={p.mapCity} url={p.mapUrl} compact />
            {#if !p.pending}
              <button class="rowbtn" onclick={() => copyText(p.native)} aria-label={S.info.copy}>⧉</button>
            {/if}
            {#if editing}
              <button class="editbtn" onclick={() => (sheet = { kind: 'show', entity: p })} aria-label="Edit">✎</button>
            {/if}
          </li>
        {/each}
      </ul>
    </section>

    {#if goesToMainland}
      <section class="card">
        <h3>🗺 {S.maps.hintTitle}</h3>
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
    <button class="addbtn" onclick={() => (sheet = { kind: 'show' })}>{S.edit.add('a card to show')}</button>
  {/if}

  {#if phrases.length}
    <section class="card">
      <h3>🗣 {S.info.phrases}</h3>
      <ul class="zhlist">
        {#each phrases as p (p.id)}
          <li>
            <button class="txt" onclick={() => (driver = p)}>
              <span class="zh">{p.native}</span>
              <span class="en">{p.meaning}</span>
            </button>
            <button class="rowbtn" onclick={() => copyText(p.native)} aria-label={S.info.copy}>⧉</button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <!-- The one card that has to be found by feel. Crit frame, mono numbers big
       enough to dial from across a room, and the call button is the row. -->
  <!-- The one section that is offered even when it is empty. Every other
       absence in Info is quiet; a trip with no emergency numbers is worth one
       sentence, because 3 a.m. is the wrong time to discover the app could
       have held them. -->
  {#if !hubEmpty && contacts.length === 0}
    <section class="card" id="emergency">
      <EmptyState
        compact
        glyph={S.empty.emergency.glyph}
        title={S.empty.emergency.title}
        body={S.empty.emergency.body}
        actionLabel={S.empty.emergency.action}
        onaction={() => (sheet = { kind: 'emergency' })}
      />
    </section>
  {:else if contacts.length}
    <section class="card crit" id="emergency">
      <h3>🆘 {S.info.emergency} <span class="h3sub">· {S.info.emergencySub}</span></h3>
      <ul class="zhlist emlist">
        {#each contacts as e (e.id)}
          <li>
            <span class="txt static">
              <!-- Only a number gets the big dialling face. A URL or a
                   still-to-come line is not something you read out loud in an
                   emergency, and typesetting it as one would say it is. -->
              <span class="ev" class:mono={e.kind === 'phone'} class:pend={e.pending}>
                {e.value}{#if e.verify}<span class="vfy"> verify</span>{/if}
              </span>
              <span class="en"><Md text={e.label} /></span>
            </span>
            {#if e.kind === 'phone'}
              <a class="btn callbtn" href="tel:{e.value.replace(/\s/g, '')}" aria-label={S.info.call}>📞</a>
            {:else if !e.pending}
              <button class="rowbtn" onclick={() => copyText(e.value)} aria-label={S.info.copy}>⧉</button>
            {/if}
            {#if editing}
              <button class="editbtn" onclick={() => (sheet = { kind: 'emergency', entity: e })} aria-label="Edit">✎</button>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}
  {#if editing}
    <button class="addbtn" onclick={() => (sheet = { kind: 'emergency' })}>{S.edit.add('an emergency contact')}</button>
  {/if}

  {#each cards as g (g.id)}
    <section class="card" class:warn={g.severity === 'crit'}>
      <h3>
        {g.emoji ?? 'ℹ️'} <Md text={g.heading} />
        {#if editing}
          <button class="editbtn" style="float:right" onclick={() => (sheet = { kind: 'info', entity: g })} aria-label="Edit">✎</button>
        {/if}
      </h3>
      <ul>
        {#each g.items as it, i (i)}<Md text={it} as="li" />{/each}
      </ul>
    </section>
  {/each}
  {#if editing}
    <button class="addbtn" onclick={() => (sheet = { kind: 'info' })}>{S.edit.add('an info card')}</button>
  {/if}

  {#if note?.text}
    <section class="card" id="notes">
      <h3>{S.info.notes}</h3>
      <Md text={note.text} as="div" />
    </section>
  {/if}

  <footer class="foot">{trip.title}</footer>
</main>

{#if sheet}
  {@const close = () => (sheet = null)}
  {#if sheet.kind === 'counter'}
    <EditSheet
      spec={counterSpec(trip.id)}
      entity={sheet.entity}
      onsave={(c) => saveEntity(db.counters, c)}
      ondelete={sheet.entity ? () => deleteEntity(db.counters, sheet?.entity as ComplianceCounter, 'Counter deleted') : undefined}
      onclose={close}
    />
  {:else if sheet.kind === 'show'}
    <EditSheet
      spec={showCardSpec(trip.id, showCards.length)}
      entity={sheet.entity}
      onsave={(c) => saveEntity(db.showCards, c)}
      ondelete={sheet.entity ? () => deleteEntity(db.showCards, sheet?.entity as ShowCard, 'Card deleted') : undefined}
      onclose={close}
    />
  {:else if sheet.kind === 'emergency'}
    <EditSheet
      spec={emergencySpec(trip.id, emergency.length)}
      entity={sheet.entity}
      onsave={(c) => saveEntity(db.emergency, c)}
      ondelete={sheet.entity ? () => deleteEntity(db.emergency, sheet?.entity as EmergencyContact, 'Contact deleted') : undefined}
      onclose={close}
    />
  {:else}
    <EditSheet
      spec={infoCardSpec(trip.id, infoCards.length)}
      entity={sheet.entity}
      onsave={(c) => saveEntity(db.infoCards, c)}
      ondelete={sheet.entity ? () => deleteEntity(db.infoCards, sheet?.entity as InfoCard, 'Card deleted') : undefined}
      onclose={close}
    />
  {/if}
{/if}

{#if driver}
  <DriverOverlay
    native={driver.native}
    meaning={driver.meaning}
    address={driver.address}
    suffix={trip.driverSuffix}
    onclose={() => (driver = null)}
  />
{/if}

<style>
  .bigtitle {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin: 2px 2px 12px;
    display: flex;
    align-items: baseline;
    gap: 10px;
    flex-wrap: wrap;
  }
  .bigtitle .sub {
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0;
    color: var(--faint);
  }

  /* the clock that must never be lost track of */
  .visapill {
    display: flex;
    align-items: center;
    gap: 9px;
    flex-wrap: wrap;
    background: var(--card);
    border: 1px solid color-mix(in srgb, var(--warn) 30%, var(--line));
    border-radius: 16px;
    padding: 11px 14px;
    font-size: 13.5px;
    font-weight: 650;
    margin-bottom: 12px;
  }
  .visapill .dotp {
    flex: 0 0 auto;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--warn);
    box-shadow: 0 0 8px var(--warn);
  }
  .visapill b {
    color: var(--warn);
  }
  .visapill.tight {
    border-color: color-mix(in srgb, var(--crit) 55%, var(--line));
  }
  .visapill.tight .dotp {
    background: var(--crit);
    box-shadow: 0 0 8px var(--crit);
  }
  .visapill.tight b {
    color: var(--crit);
  }
  .visapill .over {
    color: var(--crit);
    font-weight: 800;
  }
  #compliance {
    scroll-margin-top: 72px;
  }
  .offchip {
    display: inline-block;
    margin: 0 2px 10px;
    padding: 4px 11px;
    border: 1px dashed var(--line-2);
    border-radius: var(--radius-pill);
    font-size: 12px;
    font-weight: 650;
    color: var(--faint);
  }

  .jumpbar {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 8px;
    margin-bottom: 6px;
    scrollbar-width: none;
  }
  .jumpbar::-webkit-scrollbar {
    display: none;
  }
  .jchip {
    flex: 0 0 auto;
    background: var(--card-2);
    border: 1px solid var(--line-2);
    border-radius: var(--radius-pill);
    padding: 7px 14px;
    font-size: 12.5px;
    font-weight: 650;
    color: var(--ink-2);
    min-height: 44px;
  }
  .jchip:active {
    border-color: var(--gold);
    color: var(--gold-light);
  }

  .isec {
    margin: 18px 0 4px;
    scroll-margin-top: 72px;
  }
  .isec h3 {
    margin: 0 0 2px;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  .isub {
    margin: 0 0 10px;
    font-size: 13.5px;
    color: var(--ink-2);
  }
  .routebox {
    background: var(--paper-2);
    border: 1px solid var(--line);
    border-radius: 18px;
    padding: 10px 6px 4px;
    overflow-x: auto;
  }

  .statgrid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px 10px;
    padding-top: 2px;
  }
  .sl {
    font-size: 13px;
    color: var(--ink-2);
  }
  .sv {
    font-size: 25px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1.15;
  }
  .sv.ok {
    color: var(--ok);
  }
  .sv.gold {
    color: var(--gold);
  }
  .sv.neon {
    color: var(--neon);
  }

  .card {
    scroll-margin-top: 72px;
  }
  .cline {
    font-size: 15px;
  }
  .cbig {
    font-size: 24px;
    color: var(--gold-light);
    font-variant-numeric: tabular-nums;
  }
  .h3sub {
    text-transform: none;
    letter-spacing: 0;
    color: var(--faint);
    font-weight: 500;
  }
  .dhint {
    margin: 0 0 8px;
  }
  /* md-lite renders *verify* as <i> inside the Md child component */
  .dhint :global(i) {
    font-style: normal;
    font-weight: 700;
    color: var(--warn);
  }

  /* ---------- world clocks: little lit dials, one per zone ---------- */
  .clocks {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding: 2px 0 4px;
    scrollbar-width: none;
  }
  .clocks::-webkit-scrollbar {
    display: none;
  }
  .clock {
    flex: 0 0 auto;
    min-width: 104px;
    background: var(--card-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
  }
  .cl {
    font-size: 11px;
    letter-spacing: 1.1px;
    text-transform: uppercase;
    color: var(--ink-2);
    font-weight: 700;
    white-space: nowrap;
  }
  .clocknum {
    margin-top: 3px;
    font-size: 25px;
    font-weight: 600;
    line-height: 1.1;
    color: var(--gold-light);
    font-variant-numeric: tabular-nums;
    text-shadow: 0 0 14px rgba(232, 176, 75, 0.35);
  }
  .zhlist {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .zhlist li {
    padding: 11px 0;
    border-bottom: 1px dashed var(--line);
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .zhlist li:last-child {
    border-bottom: none;
  }
  .txt {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    background: none;
    border: none;
    text-align: left;
    padding: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .txt.static {
    cursor: default;
  }
  .zh {
    display: block;
    font-family: var(--font-zh);
    font-size: 20px;
    font-weight: 700;
    line-height: 1.35;
  }
  .zh.pend {
    font-size: 13px;
    font-weight: 500;
    color: var(--warn);
  }
  /* an emergency number is dialled, not read: mono, wide, tabular */
  .ev {
    display: block;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.3;
    word-break: break-word;
  }
  .ev.mono {
    font-size: 20px;
    letter-spacing: 0.6px;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
    word-break: normal;
  }
  .ev.pend {
    font-size: 13.5px;
    font-weight: 500;
    color: var(--warn);
  }
  .emlist li {
    padding: 13px 0;
  }
  .en {
    display: block;
    font-size: 12.5px;
    color: var(--ink-2);
    margin-top: 3px;
  }
  .vfy {
    color: var(--warn);
    font-weight: 600;
    font-size: 12px;
    font-family: var(--font-ui);
    letter-spacing: 0;
  }
  .rowbtn {
    background: none;
    border: 1px solid transparent;
    color: var(--ink-2);
    font-size: 17px;
    min-width: 44px;
    min-height: 44px;
    border-radius: 10px;
    flex-shrink: 0;
  }
  .rowbtn:active {
    border-color: var(--gold);
    color: var(--gold-light);
  }
  .callbtn {
    min-height: 44px;
    min-width: 56px;
    padding: 6px 14px;
    flex-shrink: 0;
    border-color: color-mix(in srgb, var(--crit) 60%, var(--line));
    color: var(--crit);
    font-size: 17px;
  }
</style>
