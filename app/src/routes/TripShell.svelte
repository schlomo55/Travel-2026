<script lang="ts">
  import type { EntityTable } from 'dexie';
  import { db } from '../lib/db/db';
  import { live, type Live } from '../lib/data/live.svelte';
  import { appState } from '../lib/state/appState.svelte';
  import { router, type TabName } from '../lib/state/router.svelte';
  import { counterState } from '../lib/logic/counters';
  import { tripPhase, tripDay, tripDays, daysUntilStart } from '../lib/logic/phase';
  import { S } from '../lib/i18n/strings';
  import TabBar from '../lib/components/ui/TabBar.svelte';
  import Today from './Today.svelte';
  import Itinerary from './Itinerary.svelte';
  import Wallet from './Wallet.svelte';
  import Tasks from './Tasks.svelte';
  import Info from './Info.svelte';

  let { tripId, tab }: { tripId: string; tab: TabName } = $props();

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
  const now = $derived(appState.now);

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

  /* Per-trip accent follows the open trip. */
  $effect(() => {
    if (!trip) return;
    document.documentElement.style.setProperty('--accent-h', String(trip.accentHue));
    return () => document.documentElement.style.removeProperty('--accent-h');
  });

  /* Edit mode reveals ✎ / ＋ affordances; off by default so the wallet stays
     clean when it is being shown across a counter. */
  let editing = $state(false);
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
{:else}
  <header class="appbar">
    <div class="in wrap">
      <button class="backbtn" onclick={() => router.go('#/trips')} aria-label={S.misc.back}>‹</button>
      <span class="triptitle">{trip.emoji ? `${trip.emoji} ` : ''}{trip.title}</span>
      {#if statusPill}
        <span class="statuspill {statusPill.cls}">{statusPill.text}</span>
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

  {#if tab === 'today'}
    <Today {trip} {counters} {stops} {dayPlans} {dayDefaults} {runbooks} {bookings} {tasks} {alarms} {checks} {now} />
  {:else if tab === 'itinerary'}
    <Itinerary {trip} {stops} {dayPlans} {runbooks} {now} {editing} />
  {:else if tab === 'wallet'}
    <Wallet {trip} {bookings} {cards} {expenses} {categories} {now} {editing} />
  {:else if tab === 'tasks'}
    <Tasks {trip} {tasks} {packing} {checklists} {alarms} {now} {editing} />
  {:else}
    <Info {trip} {counters} {infoCards} {emergency} {showCards} {now} {editing} />
  {/if}

  <TabBar {tripId} active={tab} />
{/if}

<style>
  .backbtn {
    background: none;
    border: none;
    font-size: 26px;
    line-height: 1;
    color: var(--ink-2);
    padding: 0 6px 3px 0;
  }
  .triptitle {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 17px;
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
    font-size: 12.5px;
    font-weight: 700;
    color: var(--ink-2);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
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
    width: 36px;
    height: 36px;
    font-size: 14px;
    color: var(--ink-2);
    flex-shrink: 0;
  }
  .editmode.on {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
</style>
