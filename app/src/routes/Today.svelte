<script lang="ts">
  import type { ComplianceCounter, ISODate, Trip } from '../lib/model/types';
  import { tripPhase, tripDay, tripDays, daysUntilStart } from '../lib/logic/phase';
  import { counterState } from '../lib/logic/counters';
  import { fmtDow, fmtLong, fmtShort } from '../lib/logic/dates';
  import { S } from '../lib/i18n/strings';

  let {
    trip,
    counters,
    now,
  }: { trip: Trip; counters: ComplianceCounter[]; now: ISODate } = $props();

  const phase = $derived(tripPhase(trip, now));
  const pinned = $derived(counters.find((c) => c.pinned));
  const pinnedState = $derived(pinned ? counterState(pinned, now) : null);
</script>

<main class="wrap" style="padding-top:16px">
  <h1 class="pagename">
    {S.tabs.today} <span class="pagesub">{fmtDow(now)}</span>
  </h1>

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
      <span class="stamp ok" style="position:absolute; top:16px; right:16px">{S.shelf.stamps.done}</span>
      <h2 style="font-size:27px; margin:2px 0 6px">{S.today.tripComplete}</h2>
      <div class="muted">
        {tripDays(trip)} days · {fmtShort(trip.start)} → {fmtLong(trip.end)}
      </div>
    </section>
  {:else}
    <section class="card hero" style="--accent-h:{trip.accentHue}">
      <div class="klabel">
        {S.shelf.dayOf(tripDay(trip, now), tripDays(trip))}
      </div>
      <h2 style="font-size:26px; margin:2px 0 4px">
        {trip.emoji ? `${trip.emoji} ` : ''}{trip.title}
      </h2>
      {#if trip.subtitle}<div class="muted">{trip.subtitle}</div>{/if}
    </section>
  {/if}

  {#if pinned && pinnedState && phase !== 'before'}
    <section
      class="card"
      class:crit={pinnedState.phase === 'overLimit'}
      class:warn={pinnedState.phase === 'counting' && pinnedState.remaining <= 3}
    >
      <h3>{pinned.icon ?? '🛂'} {pinned.name}</h3>
      {#if pinnedState.phase === 'entryDay'}
        <div>{S.today.entryDay}</div>
      {:else if pinnedState.phase === 'complete'}
        <div>{S.today.counterComplete(pinned.name)}</div>
      {:else if pinnedState.phase === 'overLimit'}
        <div><b>{S.today.counterOver(pinned.name)}</b></div>
      {:else if pinnedState.phase === 'counting'}
        <div>
          Day <b style="font-size:22px">{pinnedState.day}</b> of {pinnedState.limitDays}
          · <b>{pinnedState.remaining}</b> left
          {#if pinned.hardDeadline}
            · {S.today.mustLeaveBy(fmtShort(pinned.hardDeadline))}
          {/if}
        </div>
      {/if}
      {#if pinned.note}<div class="small" style="margin-top:6px">{pinned.note}</div>{/if}
    </section>
  {/if}

  <footer class="foot">{trip.title} · {S.misc.localOnly}</footer>
</main>
