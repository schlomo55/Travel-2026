<script lang="ts">
  import type { EntityTable } from 'dexie';
  import { db } from '../lib/db/db';
  import { live, type Live } from '../lib/data/live.svelte';
  import { weatherEnabled } from '../lib/data/repo';
  import { refreshWeather } from '../lib/data/weather';
  import { appState } from '../lib/state/appState.svelte';
  import { router, type TabName } from '../lib/state/router.svelte';
  import { counterState } from '../lib/logic/counters';
  import { firstError } from '../lib/logic/liveError';
  import { tripPhase, tripDay, tripDays, daysUntilStart } from '../lib/logic/phase';
  import { S } from '../lib/i18n/strings';
  import TabBar from '../lib/components/ui/TabBar.svelte';
  import Today from './Today.svelte';
  import Itinerary from './Itinerary.svelte';
  import StopDetail from './StopDetail.svelte';
  import Wallet from './Wallet.svelte';
  import Tasks from './Tasks.svelte';
  import Info from './Info.svelte';

  let { tripId, tab, sub }: { tripId: string; tab: TabName; sub?: string } = $props();

  const deps = () => tripId;
  const byTrip = <T, K extends keyof T>(table: EntityTable<T, K>): Live<T[]> =>
    live<T[]>(() => table.where('tripId').equals(tripId).toArray(), { initial: [], deps });

  const tripLive = live(() => db.trips.get(tripId), { deps });
  const countersLive = byTrip(db.counters);
  const stopsLive = byTrip(db.stops);
  const dayPlansLive = byTrip(db.dayPlans);
  const dayDefaultsLive = byTrip(db.dayDefaults);
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

  /* A BROKEN DATABASE MUST NOT LOOK LIKE AN EMPTY TRIP. Every list above
     resolves through `?? []`, so one failing liveQuery would otherwise draw a
     day with no bookings, no tasks and no bed — the app quietly saying
     "nothing is booked tonight". If ANY table is in an error state the shell
     says so, above everything, and points at the one screen that can fix it. */
  const dataError = $derived(
    firstError([
      tripLive.error,
      countersLive.error,
      stopsLive.error,
      dayPlansLive.error,
      dayDefaultsLive.error,
      runbooksLive.error,
      bookingsLive.error,
      cardsLive.error,
      tasksLive.error,
      packingLive.error,
      checklistsLive.error,
      alarmsLive.error,
      infoLive.error,
      emergencyLive.error,
      showCardsLive.error,
      checksLive.error,
      expensesLive.error,
      categoriesLive.error,
      documentsLive.error,
      noteLive.error,
    ]),
  );

  /* The always-visible status pill: the counter that cannot be lost track of
     during the trip, the countdown before it. */
  const statusPill = $derived.by(() => {
    if (!trip) return null;
    const phase = tripPhase(trip, now);
    if (phase === 'before') return { text: `✈️ ${daysUntilStart(trip, now)}d to go`, cls: '' };
    if (phase === 'after') return { text: '✓ complete', cls: 'ok' };
    const pinned = counters.find((c) => c.pinned);
    if (pinned) {
      const st = counterState(pinned, now);
      if (st.phase === 'counting') {
        return {
          text: `${pinned.icon ?? '🛂'} day ${st.day}/${st.limitDays}`,
          cls: st.remaining <= 3 ? 'tight' : 'counter',
        };
      }
      if (st.phase === 'entryDay') return { text: `${pinned.icon ?? '🛂'} entry day`, cls: 'counter' };
      if (st.phase === 'overLimit') return { text: `${pinned.icon ?? '🛂'} OVER`, cls: 'tight' };
    }
    return { text: `day ${tripDay(trip, now)}/${tripDays(trip)}`, cls: '' };
  });

  /* The one runtime network call in the app: a quiet weather refresh for the
     stop you are in and the next one. Re-runs when the trip opens and when the
     day rolls over. It resolves to 0 and says nothing when offline, when the
     setting is off, when the cache is fresh, or when the Firewall eats it. */
  $effect(() => {
    const list = stops;
    const today = now;
    if (!list.length) return;
    void refreshWeather($state.snapshot(list), today, weatherEnabled(settingsLive.current));
  });

  /* The per-trip hue follows the open trip. Under Lantern it no longer
     re-tints the app (gold is the brand voice) — it only feeds the identity
     tokens --stop/--stop-soft/--stop-text: shelf badge, stay bars, route lines. */
  $effect(() => {
    if (!trip) return;
    document.documentElement.style.setProperty('--accent-h', String(trip.accentHue));
    return () => document.documentElement.style.removeProperty('--accent-h');
  });

  /* Edit mode reveals ✎ / ＋ affordances; off by default so the wallet stays
     clean when it is being shown across a counter. */
  let editing = $state(false);

  /* The status pill is a doorway now: Info holds the counter spelled out —
     day, days left, hard deadline and the note that explains the rule. Home's
     visa card is the second doorway onto the same place, so the walk itself
     lives on the router (goCompliance) and neither can drift from the other. */
  function openCompliance(): void {
    router.goCompliance(tripId);
  }
</script>

{#if !tripLive.loaded}
  <main class="wrap" style="padding-top:40px"><div class="muted">Loading…</div></main>
{:else if !trip}
  <main class="wrap" style="padding-top:24px">
    <section class="card">
      <h3>Trip not found</h3>
      <p class="muted">It may have been deleted on this device.</p>
      <button class="btn wfull" onclick={() => router.go('#/trips')}>← All trips</button>
    </section>
  </main>
{:else if tab === 'itinerary' && sub}
  {@const detailStop = stops.find((s) => s.id === sub)}
  {#if detailStop}
    <StopDetail {trip} stop={detailStop} {stops} {dayPlans} {bookings} {showCards} />
  {:else}
    <main class="wrap" style="padding-top:24px">
      <section class="card">
        <h3>Stop not found</h3>
        <p class="muted">It may have been deleted on this device.</p>
        <button class="btn wfull" onclick={() => router.goTab(tripId, 'itinerary')}>← Back to the plan</button>
      </section>
    </main>
  {/if}
{:else}
  <header class="appbar">
    <div class="in wrap">
      <button class="backbtn" onclick={() => router.go('#/trips')} aria-label={S.misc.back}>‹</button>
      <span class="triptitle">{trip.emoji ? `${trip.emoji} ` : ''}{trip.title}</span>
      {#if statusPill}
        <!-- The one number the weekly check wants to drill into. It was a
             <span>: the clock you cannot afford to lose track of, and nothing
             happened when you touched it. -->
        <button
          class="statuspill {statusPill.cls}"
          class:preview={appState.previewing}
          onclick={openCompliance}>{statusPill.text}</button
        >
      {/if}
      <button
        class="editmode"
        class:on={editing}
        onclick={() => (editing = !editing)}
        aria-pressed={editing}
        aria-label={editing ? S.edit.turnOff : S.edit.turnOn}>{editing ? '✓' : '✎'}</button
      >
    </div>
  </header>

  {#if dataError}
    <main class="wrap" style="padding-top:14px">
      <section class="card crit">
        <h3>⚠️ {S.system.dataUnreadable}</h3>
        <p class="muted" style="margin:0 0 10px">{dataError}</p>
        <button class="btn wfull" onclick={() => router.go('#/backup')}>💾 {S.system.openBackup}</button>
      </section>
    </main>
  {/if}

  {#if tab === 'today'}
    <Today {trip} {counters} {stops} {dayPlans} {dayDefaults} {runbooks} {bookings} {tasks} {alarms} {checks} {now} {showCards} />
  {:else if tab === 'itinerary'}
    <Itinerary {trip} {stops} {bookings} {dayPlans} {runbooks} {now} {editing} />
  {:else if tab === 'wallet'}
    <Wallet {trip} {bookings} {cards} {expenses} {categories} {stops} {now} {editing} focusBookingId={sub} />
  {:else if tab === 'tasks'}
    <Tasks {trip} {tasks} {packing} {checklists} {alarms} {now} {editing} />
  {:else}
    <Info
      {trip}
      {counters}
      {stops}
      {bookings}
      {expenses}
      {tasks}
      {packing}
      {documents}
      walletCards={cards}
      {infoCards}
      {emergency}
      {showCards}
      {note}
      {now}
      {editing}
    />
  {/if}

  <TabBar {tripId} active={tab} />
{/if}

<style>
  /* The only way out of a trip. It was ~26 × 29 px in the corner a right thumb
     reaches last; the glyph keeps its size, the target does not. */
  .backbtn {
    background: none;
    border: none;
    font-size: var(--text-title);
    line-height: 1;
    color: var(--ink-2);
    min-width: 44px;
    min-height: 44px;
    margin-left: -10px;
    padding: 0 6px 3px 0;
    flex-shrink: 0;
  }
  .triptitle {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: var(--text-base);
    letter-spacing: 0.2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .statuspill {
    margin-left: auto;
    max-width: 42vw;
    overflow: hidden;
    text-overflow: ellipsis;
    border: 1px solid var(--line-2);
    background: var(--card);
    border-radius: 20px;
    padding: 4px 11px;
    min-height: 44px;
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--ink-2);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }
  /* Every date on the screen is fictional while a preview is on, and this pill
     is one of them. It says so where dates are read. */
  .statuspill.preview {
    border-style: dashed;
    border-color: color-mix(in srgb, var(--warn) 60%, var(--line));
    color: var(--warn);
  }
  .statuspill.counter {
    border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
    color: var(--accent-deep);
  }
  .statuspill.tight {
    border-color: var(--crit);
    color: var(--crit);
  }
  .statuspill.ok {
    border-color: color-mix(in srgb, var(--ok) 55%, var(--line));
    color: var(--ok);
  }
  .editmode {
    background: var(--card);
    border: 1px solid var(--line-2);
    border-radius: 50%;
    width: 44px;
    height: 44px;
    font-size: var(--text-sm);
    color: var(--ink-2);
    flex-shrink: 0;
  }
  .editmode.on {
    background: var(--btn-fill);
    border-color: var(--btn-fill);
    color: var(--on-accent);
  }
</style>
