<script lang="ts">
  /* THE TRIP SHELL — one trip's live data, and the switch between its places.

     Horizon's three places (Now · Journey · Pocket) and Find share the nav;
     their homes share the trip bar. A Pocket sub-screen (a pass, a section),
     a city and Find carry their own header instead, as the boards draw them,
     and the city guide at full height carries neither — it is a reading
     screen.

     Every table is read here once, per trip, as a live query, and handed
     down; any write anywhere re-renders everything that reads it. */
  import type { EntityTable } from 'dexie';
  import { db } from '../lib/db/db';
  import { live, type Live } from '../lib/data/live.svelte';
  import { weatherEnabled } from '../lib/data/repo';
  import { refreshWeather } from '../lib/data/weather';
  import { appState } from '../lib/state/appState.svelte';
  import { editMode } from '../lib/state/editMode.svelte';
  import { router, type Place } from '../lib/state/router.svelte';
  import { firstError } from '../lib/logic/liveError';
  import { S } from '../lib/i18n/strings';
  import AppBar from '../lib/components/horizon/AppBar.svelte';
  import NavBar from '../lib/components/horizon/NavBar.svelte';
  import Icon from '../lib/components/horizon/Icon.svelte';
  import Now from './Now.svelte';
  import Journey from './Journey.svelte';
  import Stop from './Stop.svelte';
  import Pocket from './Pocket.svelte';
  import Find from './Find.svelte';

  let { tripId, place, sub, view }: { tripId: string; place: Place; sub?: string; view?: string } = $props();

  const deps = () => tripId;
  const byTrip = <T, K extends keyof T>(table: EntityTable<T, K>): Live<T[]> =>
    live<T[]>(() => table.where('tripId').equals(tripId).toArray(), { initial: [], deps });

  const tripLive = live(() => db.trips.get(tripId), { deps });
  const countersLive = byTrip(db.counters);
  const stopsLive = byTrip(db.stops);
  const dayPlansLive = byTrip(db.dayPlans);
  const dayDefaultsLive = byTrip(db.dayDefaults);
  const dayPicksLive = byTrip(db.dayPicks);
  const runbooksLive = byTrip(db.runbooks);
  const bookingsLive = byTrip(db.bookings);
  const cardsLive = byTrip(db.walletCards);
  const tasksLive = byTrip(db.tasks);
  const packingLive = byTrip(db.packingItems);
  const checklistsLive = byTrip(db.checklists);
  const alarmsLive = byTrip(db.alarms);
  const infoLive = byTrip(db.infoCards);
  const emergencyLive = byTrip(db.emergency);
  const showCardsLive = byTrip(db.showCards);
  const checksLive = byTrip(db.checkState);
  const expensesLive = byTrip(db.expenses);
  const categoriesLive = byTrip(db.categories);
  const documentsLive = byTrip(db.documents);
  const noteLive = live(() => db.notes.get(tripId), { deps });
  const settingsLive = live(() => db.settings.get('settings'));

  const trip = $derived(tripLive.current);
  const counters = $derived(countersLive.current ?? []);
  const stops = $derived(stopsLive.current ?? []);
  const dayPlans = $derived(dayPlansLive.current ?? []);
  const dayDefaults = $derived(dayDefaultsLive.current ?? []);
  const dayPicks = $derived(dayPicksLive.current ?? []);
  const runbooks = $derived(runbooksLive.current ?? []);
  const bookings = $derived(bookingsLive.current ?? []);
  const cards = $derived(cardsLive.current ?? []);
  const tasks = $derived(tasksLive.current ?? []);
  const packing = $derived(packingLive.current ?? []);
  const checklists = $derived(checklistsLive.current ?? []);
  const alarms = $derived(alarmsLive.current ?? []);
  const infoCards = $derived(infoLive.current ?? []);
  const emergency = $derived(emergencyLive.current ?? []);
  const showCards = $derived(showCardsLive.current ?? []);
  const checks = $derived(checksLive.current ?? []);
  const expenses = $derived(expensesLive.current ?? []);
  const categories = $derived(categoriesLive.current ?? []);
  const documents = $derived(documentsLive.current ?? []);
  const note = $derived(noteLive.current);
  const now = $derived(appState.now);
  const editing = $derived(editMode.on);

  /* Every table the trip is read from — the error banner and the first
     render below both answer for all of them. */
  const lives: Live<unknown>[] = [
    tripLive,
    countersLive,
    stopsLive,
    dayPlansLive,
    dayDefaultsLive,
    dayPicksLive,
    runbooksLive,
    bookingsLive,
    cardsLive,
    tasksLive,
    packingLive,
    checklistsLive,
    alarmsLive,
    infoLive,
    emergencyLive,
    showCardsLive,
    checksLive,
    expensesLive,
    categoriesLive,
    documentsLive,
    noteLive,
  ];

  /* A BROKEN DATABASE MUST NOT LOOK LIKE AN EMPTY TRIP. Every list above
     resolves through `?? []`, so one failing liveQuery would otherwise draw a
     day with no bookings, no tasks and no bed — the app quietly saying
     "nothing is booked tonight". If ANY table is in an error state the shell
     says so, above everything, and points at the one screen that can fix it. */
  const dataError = $derived(firstError(lives.map((l) => l.error)));

  /* ONE FIRST RENDER, NOT TWENTY (Run 4). Each table answers in its own
     IndexedDB task, so a screen drawn as soon as the trip arrived was drawn
     again as every other table landed — Now re-deriving its whole day (the
     map, the metro line, the sentence, the tiles) each time, in long tasks
     after its first paint. The place is drawn once every table has answered
     (or failed — the banner says so); the wait is a few milliseconds. */
  const ready = $derived(lives.every((l) => l.loaded || l.error !== null));

  /* The one runtime network call in the app: a quiet weather refresh for the
     stop you are in and the next one. Re-runs when the trip opens and when the
     day rolls over. It resolves to 0 and says nothing when offline, when the
     setting is off, when the cache is fresh, or when the Firewall eats it. */
  $effect(() => {
    const list = stops;
    const today = now;
    if (!list.length) return;
    /* The stops themselves, not a snapshot (Run 4): the refresh reads a stop's
       id, dates and coordinate and stores nothing of it, and the deep copy of
       every stop — guide text and all — was ~100 ms of a cold start with the
       CPU slowed 4× (profiled; about a quarter of that on the phone). */
    void refreshWeather(list, today, weatherEnabled(settingsLive.current));
  });

  /* The per-trip hue follows the open trip — it only feeds the identity
     tokens (--stop/--stop-soft/--stop-text): stay bars, route lines. */
  $effect(() => {
    if (!trip) return;
    document.documentElement.style.setProperty('--accent-h', String(trip.accentHue));
    return () => document.documentElement.style.removeProperty('--accent-h');
  });

  $effect(() => {
    editMode.enterTrip(tripId);
  });

  /* Which chrome this screen wears (see the header comment). Now draws its
     own: the home's header sits over the map (f-now), the day and To do carry
     a sub-header; a city carries its own header and keeps the nav. */
  const reading = $derived(place === 'journey' && !!sub && view === 'guide');
  const withBar = $derived(place !== 'find' && place !== 'now' && !((place === 'pocket' || place === 'journey') && !!sub));
  const stop = $derived(place === 'journey' && sub ? stops.find((s) => s.id === sub) : undefined);
</script>

{#if !ready}
  <main class="wrap" style="padding-top:40px"><div class="muted">Loading…</div></main>
{:else if !trip}
  <main class="wrap" style="padding-top:24px">
    <section class="card">
      <h3>{S.shell.notFound}</h3>
      <p class="muted">{S.shell.notFoundBody}</p>
      <a class="btn wfull" href="#/trips"><Icon name="chevron-left" size={18} /> {S.appbar.allTrips}</a>
    </section>
  </main>
{:else}
  {#if withBar}
    <AppBar {trip} {counters} {now} />
  {/if}

  {#if dataError}
    <main class="wrap" style="padding-top:14px">
      <section class="card crit">
        <h3>{S.system.dataUnreadable}</h3>
        <p class="muted" style="margin:0 0 10px">{dataError}</p>
        <a class="btn wfull" href="#/backup">{S.system.openBackup}</a>
      </section>
    </main>
  {/if}

  {#if place === 'now'}
    <Now
      {trip}
      {counters}
      {stops}
      {dayPlans}
      {dayDefaults}
      {dayPicks}
      {runbooks}
      {bookings}
      {tasks}
      {alarms}
      {checks}
      {showCards}
      {packing}
      {checklists}
      {now}
      {editing}
      {sub}
      {view}
    />
  {:else if place === 'journey' && sub}
    {#if stop}
      <Stop {trip} {stop} {stops} {bookings} {dayPlans} {dayDefaults} {runbooks} {showCards} {now} {view} />
    {:else if stopsLive.loaded && !router.depth && !router.leaving}
      <!-- not while a stop deleted from its own guide is being left (its
           sheet still closing, or the app stepping back past its pages) -->
      <main class="wrap" style="padding-top:24px">
        <section class="card">
          <h3>{S.shell.stopNotFound}</h3>
          <p class="muted">{S.shell.notFoundBody}</p>
          <button class="btn wfull" onclick={() => router.goTab(tripId, 'journey')}>
            <Icon name="chevron-left" size={18} /> {S.shell.backToJourney}
          </button>
        </section>
      </main>
    {/if}
  {:else if place === 'journey'}
    <Journey {trip} {counters} {stops} {bookings} {runbooks} {expenses} {tasks} {packing} {now} {editing} />
  {:else if place === 'pocket'}
    <Pocket
      {trip}
      {counters}
      {stops}
      {dayPlans}
      {dayDefaults}
      {bookings}
      {cards}
      {expenses}
      {categories}
      {documents}
      {infoCards}
      {emergency}
      {showCards}
      {packing}
      {note}
      {now}
      {editing}
      {sub}
    />
  {:else}
    <Find
      {trip}
      {stops}
      {dayPlans}
      {runbooks}
      {bookings}
      {cards}
      {tasks}
      {infoCards}
      {emergency}
      {showCards}
      {documents}
      {note}
      {now}
    />
  {/if}

  {#if !reading}<NavBar {tripId} active={place} />{/if}
{/if}
