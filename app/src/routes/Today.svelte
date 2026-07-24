<script lang="ts">
  import type {
    Alarm,
    Booking,
    CheckState,
    ComplianceCounter,
    DayDefault,
    DayPlan,
    ISODate,
    Runbook,
    Stop,
    Task,
    Trip,
  } from '../lib/model/types';
  import { tripPhase, tripDay, tripDays, daysUntilStart } from '../lib/logic/phase';
  import { counterState } from '../lib/logic/counters';
  import { currentStop, resolveDay } from '../lib/logic/day';
  import { compareIso, daysBetween, fmtDow, fmtLong, fmtShort } from '../lib/logic/dates';
  import { runStepKey, setCheck } from '../lib/data/checks';
  import { router } from '../lib/state/router.svelte';
  import Md from '../lib/components/ui/Md.svelte';
  import PhotoImg from '../lib/components/ui/PhotoImg.svelte';
  import { S } from '../lib/i18n/strings';

  let {
    trip,
    counters,
    stops,
    dayPlans,
    dayDefaults,
    runbooks,
    bookings,
    tasks,
    alarms,
    checks,
    now,
  }: {
    trip: Trip;
    counters: ComplianceCounter[];
    stops: Stop[];
    dayPlans: DayPlan[];
    dayDefaults: DayDefault[];
    runbooks: Runbook[];
    bookings: Booking[];
    tasks: Task[];
    alarms: Alarm[];
    checks: CheckState[];
    now: ISODate;
  } = $props();

  const phase = $derived(tripPhase(trip, now));
  const pinned = $derived(counters.find((c) => c.pinned));
  const pinnedState = $derived(pinned ? counterState(pinned, now) : null);
  const stop = $derived(currentStop(stops, now));
  const day = $derived(resolveDay(now, dayPlans, dayDefaults, stops));
  const runbook = $derived(day?.runbookId ? runbooks.find((r) => r.id === day.runbookId) : undefined);

  const checkedKeys = $derived(new Set(checks.map((c) => c.key)));
  const isChecked = (i: number): boolean =>
    !!runbook && checkedKeys.has(runStepKey(trip.id, runbook.id, now, i));

  const nextTravel = $derived(
    bookings
      .filter((b) => b.kind !== 'hotel' && compareIso(b.date, now) >= 0)
      .sort((a, b) => compareIso(a.date, b.date))[0],
  );
  const nextTask = $derived(
    tasks.filter((t) => !t.done && t.due).sort((a, b) => compareIso(a.due ?? '', b.due ?? ''))[0],
  );
  const openTasks = $derived(tasks.filter((t) => !t.done).length);
  const nextAlarm = $derived(
    alarms.filter((a) => compareIso(a.date, now) >= 0).sort((a, b) => compareIso(a.date, b.date) || a.time.localeCompare(b.time))[0],
  );

  function toggleStep(i: number): void {
    if (!runbook) return;
    const key = runStepKey(trip.id, runbook.id, now, i);
    void setCheck(key, trip.id, !checkedKeys.has(key));
  }
  function whenLabel(date: ISODate): string {
    const d = daysBetween(now, date);
    return d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`;
  }
</script>

<main class="wrap" style="padding-top:16px">
  <h1 class="pagename">{S.tabs.today} <span class="pagesub">{fmtDow(now)}</span></h1>

  {#if phase === 'before'}
    <section class="card hero">
      <div class="routeline" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="klabel">{S.today.departureIn}</div>
      <div class="countnum">
        {daysUntilStart(trip, now)}
        <small>{daysUntilStart(trip, now) === 1 ? S.today.day : S.today.days}</small>
      </div>
      <div class="muted">
        {trip.emoji ? `${trip.emoji} ` : ''}{trip.title}{trip.subtitle ? ` — ${trip.subtitle}` : ''}
      </div>
      <div class="small" style="margin-top:4px">{fmtShort(trip.start)} → {fmtLong(trip.end)}</div>
    </section>
  {:else if phase === 'after'}
    <section class="card hero">
      <span class="chip ok" style="position:absolute; top:16px; right:16px">{S.shelf.stamps.done}</span>
      <h2 style="font-size:27px; margin:2px 0 6px">{S.today.tripComplete}</h2>
      <div class="muted">
        {tripDays(trip)} days · {stops.filter((s) => s.kind === 'stop').length} stops · {fmtShort(trip.start)} → {fmtLong(trip.end)}
      </div>
    </section>
  {:else}
    <section class="card hero" class:hasbanner={!!stop?.photoDocId}>
      {#if stop?.photoDocId}
        <button
          class="herobanner"
          style="--h:{stop.hue}"
          onclick={() => stop && router.go(`#/trip/${trip.id}/itinerary/${stop.id}`)}
        >
          <PhotoImg docId={stop.photoDocId} alt="" />
          <span class="heroshade" aria-hidden="true"></span>
          <span class="herostop">{stop.emoji ?? '📍'} <Md text={stop.name} /></span>
        </button>
      {/if}
      <div class="today-day">
        <span class="dn">{S.shelf.dayOf(tripDay(trip, now), tripDays(trip))}</span>
        {#if stop && !stop.photoDocId}<span class="pill" style="--h:{stop.hue}; border-color:var(--stop)">{stop.emoji ?? '📍'} <Md text={stop.name} /></span>{/if}
      </div>
      <h2 class="herotitle">{day ? '' : ''}{#if day}<Md text={day.title} />{:else}{trip.title}{/if}</h2>
      {#if pinned && pinnedState}
        {#if pinnedState.phase === 'counting'}
          <div class="muted">
            {pinned.icon ?? '🛂'} {pinned.name} — day <b>{pinnedState.day}</b> of {pinnedState.limitDays}{#if pinned.hardDeadline}, {S.today.mustLeaveBy(fmtShort(pinned.hardDeadline))}{/if}
          </div>
        {:else if pinnedState.phase === 'entryDay'}
          <div class="muted">{pinned.icon ?? '🛂'} {S.today.entryDay}</div>
        {:else if pinnedState.phase === 'complete'}
          <div class="muted">{pinned.icon ?? '🛂'} {S.today.counterComplete(pinned.name)}</div>
        {/if}
      {/if}
    </section>
  {/if}

  {#if runbook}
    <section class="card" class:crit={runbook.severity === 'crit'} class:warn={runbook.severity === 'warn'}>
      <h3><Md text={runbook.title} /></h3>
      <ul class="klist">
        {#each runbook.steps as step, i (i)}
          <li class:done={isChecked(i)}>
            <input type="checkbox" id="rb-{i}" checked={isChecked(i)} onchange={() => toggleStep(i)} />
            <label for="rb-{i}"><Md text={step} /></label>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if phase === 'during' && day}
    <section class="card">
      <h3>The plan{day.fromDefault ? ' · usual day' : ''}</h3>
      <ul class="planlist">
        {#each day.planItems as p, i (i)}<Md text={p} as="li" />{/each}
      </ul>
    </section>

    {#if day.bedLabel}
      <section class="card">
        <h3>Tonight</h3>
        <div class="tonight">
          <span class="ic">{day.bedEmoji ?? '🛏'}</span>
          <span><Md text={day.bedLabel} /></span>
        </div>
      </section>
    {/if}
  {/if}

  {#if nextTravel && phase !== 'after'}
    <section class="card">
      <h3>Next leg <span style="text-transform:none; letter-spacing:0; color:var(--faint); font-weight:500">· {whenLabel(nextTravel.date)}</span></h3>
      <div class="nextleg">
        {#if nextTravel.kind === 'flight'}
          <span class="route mono">{nextTravel.from.code} → {nextTravel.to.code}</span>
          <span class="legtime">
            <b>{nextTravel.dep}</b>
            <span class="small">{nextTravel.flightNo}</span>
          </span>
        {:else}
          <span class="route"><Md text={nextTravel.title} /></span>
        {/if}
      </div>
      <button class="btn wfull" style="margin-top:10px" onclick={() => router.goTab(trip.id, 'wallet')}>
        🎫 Open in the wallet
      </button>
    </section>
  {/if}

  {#if nextTask}
    {@const overdue = compareIso(nextTask.due ?? '', now) < 0}
    <section class="card" class:crit={overdue}>
      <h3>
        {overdue ? '⚠️ Overdue' : 'Next deadline'}
        <span style="text-transform:none; letter-spacing:0; color:var(--faint); font-weight:500">· {nextTask.dueLabel ?? fmtShort(nextTask.due ?? '')}</span>
      </h3>
      <div><Md text={nextTask.title} as="div" /></div>
      <div class="small" style="margin-top:6px">{openTasks} open item{openTasks === 1 ? '' : 's'}</div>
      <button class="btn wfull" style="margin-top:10px" onclick={() => router.goTab(trip.id, 'tasks')}>✅ Open tasks</button>
    </section>
  {/if}

  {#if nextAlarm}
    <section class="card">
      <h3>⏰ Next timed moment</h3>
      <div style="font-weight:650"><Md text={nextAlarm.title} /></div>
      <div class="small" style="margin-top:3px">
        {fmtLong(nextAlarm.date)} · {nextAlarm.time}{#if nextAlarm.why} — <Md text={nextAlarm.why} />{/if}
      </div>
    </section>
  {/if}

  <footer class="foot">{trip.title} · {S.misc.localOnly}</footer>
</main>

<style>
  .card.hasbanner {
    overflow: hidden;
  }
  .herobanner {
    display: block;
    position: relative;
    width: calc(100% + 36px);
    margin: -20px -18px 14px;
    height: 132px;
    overflow: hidden;
    border: none;
    padding: 0;
    background: linear-gradient(135deg, hsl(var(--h) 55% 36%), hsl(var(--h) 55% 28%));
    cursor: pointer;
    text-align: left;
  }
  .herobanner :global(img) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    animation: photoin 0.18s ease-out;
  }
  @keyframes photoin {
    from {
      opacity: 0;
    }
  }
  .heroshade {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(var(--photo-dim), var(--photo-dim)), var(--scrim);
  }
  .herostop {
    position: absolute;
    left: 14px;
    bottom: 10px;
    font-family: var(--font-display);
    font-weight: 640;
    font-size: 19px;
    color: var(--on-photo);
  }
  .today-day {
    display: flex;
    align-items: baseline;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 4px;
  }
  .dn {
    font-family: var(--font-display);
    font-size: 15px;
    color: var(--accent-deep);
    letter-spacing: 0.4px;
  }
  .herotitle {
    font-size: 25px;
    line-height: 1.2;
    margin: 2px 0 6px;
  }
  .planlist {
    margin: 4px 0 0;
    padding-left: 20px;
  }
  .planlist :global(li) {
    margin-bottom: 7px;
  }
  .tonight {
    display: flex;
    gap: 11px;
    align-items: center;
    font-weight: 650;
  }
  .tonight .ic {
    font-size: 24px;
  }
  .nextleg {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .route {
    font-size: 19px;
    font-weight: 700;
    letter-spacing: 0.5px;
    flex: 1;
  }
  .legtime {
    text-align: right;
  }
  .legtime b {
    display: block;
    color: var(--accent-deep);
    font-size: 16px;
  }
  .klist {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .klist li {
    display: flex;
    gap: 11px;
    align-items: baseline;
    padding: 9px 0;
    border-bottom: 1px dashed var(--line);
  }
  .klist li:last-child {
    border-bottom: none;
  }
  .klist input[type='checkbox'] {
    width: 21px;
    height: 21px;
    accent-color: var(--accent);
    transform: translateY(3px);
    flex-shrink: 0;
  }
  .klist label {
    flex: 1;
    cursor: pointer;
  }
  .klist li.done label {
    color: var(--faint);
    text-decoration: line-through;
  }
</style>
