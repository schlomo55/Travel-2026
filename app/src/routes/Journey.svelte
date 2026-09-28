<script lang="ts">
  /* JOURNEY — "Replay the trip + every stop with its coverage" (ROUND4 §IA).

     Run 3 builds it: Replay (the scrubber, the route drawing itself, the visa
     window as a bar), the Relay coverage sweep, and the city close-up. Until
     then this place holds what already exists, in the order Journey will
     hold it: the route and whether each stop is booked (moved here from Info),
     the numbers, then every stop with the moves between them (the stop list,
     re-skinned by the tokens). */
  import type {
    Booking,
    ComplianceCounter,
    DayPlan,
    Expense,
    ISODate,
    PackingItem,
    Runbook,
    Stop,
    Task,
    Trip,
  } from '../lib/model/types';
  import { S } from '../lib/i18n/strings';
  import JourneyOverview from '../lib/components/JourneyOverview.svelte';
  import Itinerary from './Itinerary.svelte';

  let {
    trip,
    counters,
    stops,
    bookings,
    dayPlans,
    runbooks,
    expenses,
    tasks,
    packing,
    now,
    editing,
  }: {
    trip: Trip;
    counters: ComplianceCounter[];
    stops: Stop[];
    bookings: Booking[];
    dayPlans: DayPlan[];
    runbooks: Runbook[];
    expenses: Expense[];
    tasks: Task[];
    packing: PackingItem[];
    now: ISODate;
    editing: boolean;
  } = $props();
</script>

<div class="journey">
  <header class="wrap jtop">
    <h1 class="display jtitle">{S.nav.journey}</h1>
    <span class="caps jsub">{S.journey.subtitle}</span>
  </header>
  <div class="wrap">
    <JourneyOverview {trip} {counters} {stops} {bookings} {expenses} {tasks} {packing} {now} />
  </div>
  <Itinerary {trip} {stops} {bookings} {dayPlans} {runbooks} {now} {editing} embedded />
</div>

<style>
  .jtop {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding-top: 8px;
  }
  .jtitle {
    margin: 0;
    font-size: var(--fs-screen);
    font-weight: 600;
    line-height: 1.05;
  }
  .jsub {
    color: var(--ink-2);
  }
</style>
