<script lang="ts">
  /* NOW — "the map + glance tiles (home) → travel day / ordinary day / To do"
     (ROUND4 §IA). Run 2 builds it: the constellation, the Concierge sentence,
     the metro line and the day line.

     Until then Now holds the two screens that already answer its questions —
     the day (Lantern's Home) and To do (Lantern's Lists) — re-skinned by the
     tokens, with a switch between them so To do is one tap from anywhere in
     Now, as the TO DO tile will make it. */
  import type {
    Alarm,
    Booking,
    CheckState,
    Checklist,
    ComplianceCounter,
    DayDefault,
    DayPick,
    DayPlan,
    ISODate,
    PackingItem,
    Runbook,
    ShowCard,
    Stop,
    Task,
    Trip,
  } from '../lib/model/types';
  import { S } from '../lib/i18n/strings';
  import Icon from '../lib/components/horizon/Icon.svelte';
  import Today from './Today.svelte';
  import Tasks from './Tasks.svelte';

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

  const todo = $derived(sub === 'todo');
  const open = $derived(tasks.filter((t) => !t.done).length);
  const base = $derived(`#/trip/${encodeURIComponent(trip.id)}/now`);
</script>

<nav class="wrap nowswitch" aria-label={S.nowbridge.label}>
  <a class="nsw" class:on={!todo} href={base} aria-current={!todo ? 'page' : undefined}>
    <Icon name="sun" size={18} />
    {S.nowbridge.day}
  </a>
  <a class="nsw" class:on={todo} href="{base}/todo" aria-current={todo ? 'page' : undefined}>
    <Icon name="list" size={18} />
    {S.nowbridge.todo}{#if open}<span class="nswc num">{open}</span>{/if}
  </a>
</nav>

{#if todo}
  <!-- keyed on the list asked for, so Pocket's Packing tile lands on it -->
  {#key view}
    <Tasks {trip} {tasks} {packing} {checklists} {alarms} {now} {editing} initialView={view} />
  {/key}
{:else}
  <Today {trip} {counters} {stops} {dayPlans} {dayDefaults} {dayPicks} {runbooks} {bookings} {tasks} {alarms} {checks} {now} {showCards} />
{/if}

<style>
  .nowswitch {
    display: flex;
    gap: 8px;
    padding-top: 4px;
    padding-bottom: 10px;
  }
  .nsw {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    border-radius: 999px;
    font-size: var(--fs-label);
    font-weight: 600;
    color: var(--ink);
    background: var(--card);
    border: 1px solid var(--line);
    text-decoration: none;
  }
  .nsw.on {
    color: var(--on-sunrise);
    background: var(--sunrise-fill);
    border-color: var(--sunrise-fill);
  }
  .nswc {
    font-size: var(--fs-time);
    font-weight: 600;
    min-width: 22px;
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--card-2);
    color: var(--ink-2);
  }
  .nsw.on .nswc {
    background: rgba(26, 15, 8, 0.14);
    color: var(--on-sunrise);
  }
</style>
