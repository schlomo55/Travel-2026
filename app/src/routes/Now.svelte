<script lang="ts">
  /* NOW — "the map + glance tiles (home) → travel day / ordinary day / To do"
     (ROUND4 §IA, f-now · f-travelday · f-day · f-todo).

       #/trip/:id/now                   the home: the map, one sentence, tiles
       #/trip/:id/now/day               the day on screen (the ?d= preview
                                        steps it): a travel day as a metro
                                        line, any other day as a day line
       #/trip/:id/now/todo[/packing|lists]   To do, packing, checklists

     The day is decided here ONCE — which day, its runbook and ticks, its
     line, tonight's bed, the next commitment, the to-do plan — and handed to
     the screen that draws it, so the home, the day and the tiles can never
     disagree about the same fact. The white driver card is a layer owned
     here (Android back closes it). */
  import type {
    Alarm,
    Booking,
    CheckState,
    Checklist,
    ComplianceCounter,
    DayDefault,
    DayPick,
    DayPlan,
    HotelBooking,
    ISODate,
    PackingItem,
    Runbook,
    ShowCard,
    Stop,
    Task,
    Trip,
  } from '../lib/model/types';
  import { db } from '../lib/db/db';
  import { live } from '../lib/data/live.svelte';
  import { runStepKey } from '../lib/data/checks';
  import { compareIso, localToday, ymd } from '../lib/logic/dates';
  import { currentStop, resolveDay } from '../lib/logic/day';
  import { daysUntilStart, tripDay, tripDays, tripPhase } from '../lib/logic/phase';
  import { nextCommitment, nightInTransit } from '../lib/logic/commitment';
  import { buildMetroLine, isTravelDay, stepProgress } from '../lib/logic/metroline';
  import { todoPlan } from '../lib/logic/todo';
  import { asWeatherCache, dayIn, weatherKey } from '../lib/logic/weather';
  import type { TonightFact } from '../lib/logic/concierge';
  import { minute } from '../lib/state/minute.svelte';
  import { S } from '../lib/i18n/strings';
  import NowHome from '../lib/components/now/NowHome.svelte';
  import DayView from '../lib/components/now/DayView.svelte';
  import Todo from '../lib/components/now/Todo.svelte';
  import Lists from '../lib/components/now/Lists.svelte';
  import DriverCard from '../lib/components/pocket/DriverCard.svelte';

  let {
    trip,
    counters,
    stops,
    dayPlans,
    dayDefaults,
    dayPicks,
    runbooks,
    bookings,
    tasks,
    alarms,
    checks,
    showCards,
    packing,
    checklists,
    now,
    editing,
    sub,
    view,
  }: {
    trip: Trip;
    counters: ComplianceCounter[];
    stops: Stop[];
    dayPlans: DayPlan[];
    dayDefaults: DayDefault[];
    dayPicks: DayPick[];
    runbooks: Runbook[];
    bookings: Booking[];
    tasks: Task[];
    alarms: Alarm[];
    checks: CheckState[];
    showCards: ShowCard[];
    packing: PackingItem[];
    checklists: Checklist[];
    now: ISODate;
    editing: boolean;
    sub?: string;
    view?: string;
  } = $props();

  /* ---------- the clock: minutes, and only on the real today ---------- */
  $effect(() => minute.watch());
  const realToday = $derived.by(() => {
    void minute.t;
    return localToday(null);
  });
  const clock = $derived.by(() => {
    const d = new Date(minute.t);
    return ymd(d) === now ? d.getHours() * 60 + d.getMinutes() : null;
  });

  /* ---------- the day ---------- */
  const phase = $derived(tripPhase(trip, now));
  const stop = $derived(currentStop(stops, now));
  const day = $derived(resolveDay(now, dayPlans, dayDefaults, stops));
  const runbook = $derived(day?.runbookId ? runbooks.find((r) => r.id === day.runbookId) : undefined);
  const keys = $derived(new Set(checks.map((c) => c.key)));
  const ticked = (i: number): boolean => !!runbook && keys.has(runStepKey(trip.id, runbook.id, now, i));
  const progress = $derived(stepProgress(runbook?.steps.length ?? 0, ticked));
  const travel = $derived(phase === 'during' && isTravelDay(day?.runbookId, bookings, now));
  const line = $derived(
    travel
      ? buildMetroLine({
          date: now,
          bookings,
          cards: showCards,
          runbook,
          ticked,
          bedLabel: day?.bedLabel,
          nowMinutes: clock,
          realToday,
        })
      : null,
  );
  const dayTag = $derived(
    phase === 'before'
      ? S.shelf.daysToGo(daysUntilStart(trip, now))
      : phase === 'after'
        ? S.shelf.completed(tripDays(trip))
        : S.shelf.dayOf(tripDay(trip, now), tripDays(trip)),
  );

  /* ---------- tonight ---------- */
  const bed = $derived(
    bookings.find(
      (b): b is HotelBooking =>
        b.kind === 'hotel' && b.status !== 'cancelled' && compareIso(b.checkIn, now) <= 0 && compareIso(now, b.checkOut) < 0,
    ),
  );
  const aboard = $derived(nightInTransit(bookings, now));
  const tonight = $derived.by((): TonightFact | null => {
    if (phase !== 'during') return null;
    if (bed) return { name: bed.title, state: bed.status === 'booked' ? 'booked' : bed.status === 'walkin' ? 'walkin' : 'pending' };
    if (aboard) return { name: aboard.title, state: 'transit' };
    return day?.bedLabel ? { name: day.bedLabel, state: 'missing' } : null;
  });

  const next = $derived(phase === 'after' ? null : nextCommitment(bookings, now));
  const plan = $derived(todoPlan(tasks, alarms, bookings, now));

  /* ---------- weather, from the cache TripShell fills (the one network call) ---------- */
  const weatherLive = live(() => (stop ? db.meta.get(weatherKey(stop.id)) : undefined), { deps: () => stop?.id });
  const weather = $derived(asWeatherCache(weatherLive.current?.value));
  const today = $derived(phase === 'during' ? dayIn(weather, now) : null);

  /* ---------- the white driver card, a layer ---------- */
  const places = $derived(showCards.filter((c) => c.kind === 'place' && !c.pending).sort((a, b) => a.order - b.order));
  let driver = $state<number | null>(null);
  function openDriver(cardId: string): void {
    const i = places.findIndex((c) => c.id === cardId);
    if (i >= 0) driver = i;
  }

  const ctx = $derived({
    trip,
    now,
    phase,
    stop,
    day,
    runbook,
    ticked,
    progress,
    line,
    dayTag,
    bed,
    aboard,
    tonight,
    next,
    plan,
    weather,
    today,
    clock,
    realToday,
  });
</script>

{#if sub === 'todo' && (view === 'packing' || view === 'lists')}
  <Lists {trip} {packing} {checklists} {view} {editing} />
{:else if sub === 'todo'}
  <Todo {trip} {tasks} {alarms} {bookings} {packing} {checklists} {plan} {now} {editing} />
{:else if sub === 'day'}
  <DayView
    {ctx}
    {stops}
    {dayPlans}
    {dayDefaults}
    {dayPicks}
    {bookings}
    {showCards}
    ondriver={openDriver}
  />
{:else}
  <NowHome {ctx} {counters} {stops} {bookings} {showCards} ondriver={openDriver} />
{/if}

{#if driver !== null}
  <DriverCard cards={places} start={driver} suffix={trip.driverSuffix} onclose={() => (driver = null)} />
{/if}
