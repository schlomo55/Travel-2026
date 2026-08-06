<script lang="ts">
  /* Home — the screen the app opens on (plan §SCREENS 2).

     A photo hero about a third of the screen, then the day itself on black:
     a luminous spine with the timed items hanging off it, an "Anytime" block
     for everything the trip file wrote without a clock, then tonight's bed and
     the next leg with their real BOOKED / PENDING stamps.

     On a runbook day the checklist replaces the timeline — the same visual
     language, tickable, because on those days the list IS the day. */
  import type {
    Alarm,
    Booking,
    CheckState,
    ComplianceCounter,
    DayDefault,
    DayPlan,
    HotelBooking,
    ISODate,
    Runbook,
    ShowCard,
    Stop,
    Task,
    Trip,
  } from '../lib/model/types';
  import { tripPhase, tripDay, tripDays, daysUntilStart } from '../lib/logic/phase';
  import { counterState } from '../lib/logic/counters';
  import { currentStop, resolveDay } from '../lib/logic/day';
  import { resolvePlaces } from '../lib/logic/places';
  import { compareIso, daysBetween, fmtDow, fmtLong, fmtShort, ymd } from '../lib/logic/dates';
  import { buildTimeline, currentIndex } from '../lib/logic/timeline';
  import { runStepKey, setCheck } from '../lib/data/checks';
  import { router } from '../lib/state/router.svelte';
  import { db } from '../lib/db/db';
  import { live } from '../lib/data/live.svelte';
  import {
    asWeatherCache,
    dayIn,
    isSnowCode,
    NOTE_AGE_MS,
    weatherChip,
    weatherKey,
  } from '../lib/logic/weather';
  import Md from '../lib/components/ui/Md.svelte';
  import MapButtons from '../lib/components/ui/MapButtons.svelte';
  import PhotoImg from '../lib/components/ui/PhotoImg.svelte';
  import Snowfall from '../lib/components/ui/Snowfall.svelte';
  import EmptyState from '../lib/components/ui/EmptyState.svelte';
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
    showCards = [],
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
    /** Driver cards — today's `placeIds` may point at one, so Home needs them
        to draw its 📍 Places today row. */
    showCards?: ShowCard[];
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
  const doneSteps = $derived(runbook ? runbook.steps.filter((_, i) => isChecked(i)).length : 0);

  /* The clock only ticks for the REAL today: a previewed date has no "now" to
     point at, so nothing is highlighted and nothing lies. */
  let tick = $state(Date.now());
  $effect(() => {
    const id = setInterval(() => (tick = Date.now()), 60_000);
    return () => clearInterval(id);
  });
  const nowMinutes = $derived.by(() => {
    const d = new Date(tick);
    return ymd(d) === now ? d.getHours() * 60 + d.getMinutes() : null;
  });

  const timeline = $derived(buildTimeline(day?.planItems ?? [], stop?.spots ?? []));
  const currentTimed = $derived(currentIndex(timeline.timed, nowMinutes));

  /* Where today goes, from the day's own manifest (types.ts → DayPlan.placeIds)
     rather than from reading the prose. It is drawn once under the plan — on a
     runbook day too, because eleven of the twelve runbook days are travel days
     and those are exactly the ones with an airport in them. Resolved across the
     WHOLE trip: a travel day leaves its stop, and Dec 11 links Beijing Capital
     and Wulingyuan on the same afternoon. */
  const places = $derived(resolvePlaces(day?.placeIds, { stops, showCards, bookings }));

  /* Tonight's bed: the label the day carries, and — when a real booking covers
     tonight — that booking's status, so the stamp is a fact and not a mood. */
  const tonightBooking = $derived(
    bookings.find(
      (b): b is HotelBooking =>
        b.kind === 'hotel' && compareIso(b.checkIn, now) <= 0 && compareIso(now, b.checkOut) < 0,
    ),
  );
  /* "Next leg" is about LEGS. Tickets are dated bookings too, and from
     2026-08-06 there are eleven of them — but a concert is not the next leg,
     and letting one answer that question would push the flight you are actually
     catching off the screen. Beds have always been excluded for the same
     reason; experiences join them. */
  const nextTravel = $derived(
    bookings
      .filter((b) => b.kind !== 'hotel' && b.kind !== 'activity' && compareIso(b.date, now) >= 0)
      .sort((a, b) => compareIso(a.date, b.date))[0],
  );
  const nextTask = $derived(
    tasks.filter((t) => !t.done && t.due).sort((a, b) => compareIso(a.due ?? '', b.due ?? ''))[0],
  );
  const openTasks = $derived(tasks.filter((t) => !t.done).length);
  const nextAlarm = $derived(
    alarms.filter((a) => compareIso(a.date, now) >= 0).sort((a, b) => compareIso(a.date, b.date) || a.time.localeCompare(b.time))[0],
  );

  /* Cached forecast for the stop you are standing in. With an empty cache this
     is null and NOTHING below renders — the page is identical to a build with
     no weather module at all. The fetch itself lives in TripShell. */
  const weatherLive = live(() => (stop ? db.meta.get(weatherKey(stop.id)) : undefined), {
    deps: () => stop?.id,
  });
  const weather = $derived(asWeatherCache(weatherLive.current?.value));
  const todayWeather = $derived(phase === 'during' ? dayIn(weather, now) : null);
  const snowing = $derived(!!todayWeather && isSnowCode(todayWeather.code));
  const weatherAge = $derived.by(() => {
    if (!todayWeather || !weather) return null;
    const at = new Date(weather.fetchedAt);
    if (Date.now() - weather.fetchedAt < NOTE_AGE_MS) return null;
    return S.weather.from(`${fmtShort(ymd(at))}, ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`);
  });

  /* The hero photo: the place you are in, else the trip's own cover, else a
     designed scene. Never a stock image — nothing is fetched, ever. */
  const heroDoc = $derived((phase === 'during' && stop?.photoDocId) || trip.coverDocId || null);
  const heroTitle = $derived(phase === 'during' && stop ? stop.name : trip.title);

  const dayTag = $derived.by(() => {
    if (phase === 'before') return S.shelf.daysToGo(daysUntilStart(trip, now));
    if (phase === 'after') return S.today.tripComplete;
    const parts = [S.shelf.dayOf(tripDay(trip, now), tripDays(trip))];
    if (day?.bedLabel) parts.push(S.today.tonightIs(day.bedLabel));
    return parts.join(' · ');
  });

  function toggleStep(i: number): void {
    if (!runbook) return;
    const key = runStepKey(trip.id, runbook.id, now, i);
    void setCheck(key, trip.id, !checkedKeys.has(key));
  }
  function whenLabel(date: ISODate): string {
    const d = daysBetween(now, date);
    return d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`;
  }
  const legStamp = (b: Booking): { label: string; cls: string } =>
    b.status === 'booked'
      ? { label: S.money.booked1, cls: 'ok' }
      : b.status === 'pending'
        ? { label: S.money.pending, cls: 'warn' }
        : b.status === 'walkin'
          ? { label: S.money.walkin, cls: '' }
          : { label: S.money.cancelled, cls: 'crit' };
</script>

<main class="home">
  <!-- ---------- the hero ---------- -->
  <div class="hero" style="--h:{stop?.hue ?? trip.accentHue}">
    {#if heroDoc}
      <PhotoImg docId={heroDoc} alt="" loading="eager" />
    {:else}
      <span class="scene" aria-hidden="true"></span>
    {/if}
    <span class="hscrim" aria-hidden="true"></span>
    {#if snowing}<Snowfall />{/if}
    <h1 class="city"><Md text={heroTitle} /></h1>
    {#if todayWeather}
      <span class="wchip">{weatherChip(todayWeather)}</span>
    {/if}
    <div class="daytag">{dayTag}</div>
  </div>

  <div class="wrap">
    {#if weatherAge}<div class="small" style="margin:8px 2px 0">{weatherAge}</div>{/if}

    {#if phase === 'before'}
      <section class="card hero-card">
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
      <section class="card hero-card">
        <span class="chip ok" style="position:absolute; top:16px; right:16px">{S.shelf.stamps.done}</span>
        <h2 style="font-size:26px; margin:2px 0 6px">{S.today.tripComplete}</h2>
        <div class="muted">
          {tripDays(trip)} days · {stops.filter((s) => s.kind === 'stop').length} stops · {fmtShort(trip.start)} → {fmtLong(trip.end)}
        </div>
      </section>
    {/if}

    {#if pinned && pinnedState && phase === 'during'}
      <div class="counterline">
        {#if pinnedState.phase === 'counting'}
          {pinned.icon ?? '🛂'} {pinned.name} — day <b>{pinnedState.day}</b> of {pinnedState.limitDays}{#if pinned.hardDeadline}, {S.today.mustLeaveBy(fmtShort(pinned.hardDeadline))}{/if}
        {:else if pinnedState.phase === 'entryDay'}
          {pinned.icon ?? '🛂'} {S.today.entryDay}
        {:else if pinnedState.phase === 'complete'}
          {pinned.icon ?? '🛂'} {S.today.counterComplete(pinned.name)}
        {/if}
      </div>
    {/if}

    {#if runbook}
      <!-- a runbook day: the checklist IS the day -->
      <h2 class="dayttl"><Md text={runbook.title} /></h2>
      <div class="rbmeter" aria-hidden="true"><i style="width:{runbook.steps.length ? (doneSteps / runbook.steps.length) * 100 : 0}%"></i></div>
      <ul class="steps u-stagger">
        {#each runbook.steps as step, i (i)}
          <li class:done={isChecked(i)} class:crit={runbook.severity === 'crit'}>
            <button
              class="cbox"
              onclick={() => toggleStep(i)}
              aria-pressed={isChecked(i)}
              aria-label={isChecked(i) ? 'Undo' : 'Done'}>✓</button
            >
            <span class="stx"><Md text={step} /></span>
          </li>
        {/each}
      </ul>
    {:else if phase === 'during' && day}
      <div class="dayhead">
        <h2 class="dayttl"><Md text={day.title} /></h2>
        {#if day.fromDefault}<span class="pill">{S.today.usualDay}</span>{/if}
      </div>

      {#if timeline.timed.length}
        <div class="timeline">
          <span class="spine" aria-hidden="true"></span>
          {#each timeline.timed as it, i (i)}
            <div class="titem u-rise" style="--i:{Math.min(i, 6)}">
              <span class="tt">{it.time}</span>
              <span class="dot" aria-hidden="true"></span>
              <div class="tcard" class:now={i === currentTimed}>
                <div class="tx">
                  <b><Md text={it.title} /></b>
                  {#if it.detail}<p><Md text={it.detail} /></p>{/if}
                </div>
                {#if it.spot}
                  <MapButtons
                    coord={it.spot.coord}
                    name={it.spot.native ?? it.spot.name}
                    query={it.spot.mapQuery}
                    address={it.spot.address}
                    city={it.spot.mapCity}
                    url={it.spot.mapUrl}
                    compact
                  />
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if timeline.anytime.length}
        {#if timeline.timed.length}<h3 class="anyhead">{S.today.anytime}</h3>{/if}
        <div class="anylist u-stagger">
          {#each timeline.anytime as it, i (i)}
            <div class="tcard plain">
              <div class="tx">
                <b><Md text={it.title} /></b>
                {#if it.detail}<p><Md text={it.detail} /></p>{/if}
              </div>
              {#if it.spot}
                <MapButtons
                  coord={it.spot.coord}
                  name={it.spot.native ?? it.spot.name}
                  query={it.spot.mapQuery}
                  address={it.spot.address}
                  city={it.spot.mapCity}
                  url={it.spot.mapUrl}
                  compact
                />
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    {:else if phase === 'during'}
      <EmptyState
        glyph={S.empty.today.glyph}
        title={S.empty.today.title}
        body={S.empty.today.body}
        actionLabel={S.empty.today.action}
        onaction={() => router.goTab(trip.id, 'itinerary')}
      />
    {/if}

    <!-- ---------- 📍 Places today ----------
         Under the plan, whichever shape the plan took: a runbook checklist and
         a timeline are both "today", and most runbook days are travel days.
         A day that goes nowhere renders nothing here — no header, no rule. -->
    {#if phase === 'during' && places.length}
      <div class="dayplaces">
        <span class="dphead">{S.maps.placesToday}</span>
        {#each places as p (p.id)}
          <span class="dchip">
            <span class="dcname">{p.label}</span>
            <MapButtons
              coord={p.coord}
              name={p.mapName}
              query={p.mapQuery}
              address={p.address}
              addressInSearch={p.addressInSearch}
              city={p.mapCity}
              url={p.mapUrl}
              compact
            />
          </span>
        {/each}
      </div>
    {/if}

    <!-- ---------- tonight, and the next leg ---------- -->
    {#if day?.bedLabel && phase === 'during'}
      <div class="row">
        <span class="ic">{day.bedEmoji ?? '🛏'}</span>
        <div class="rx">
          <b><Md text={day.bedLabel} /></b>
          <small>{S.today.tonight} · {fmtDow(now)}</small>
        </div>
        {#if tonightBooking}
          {@const st = legStamp(tonightBooking)}
          <span class="stamp {st.cls}">{st.label}</span>
        {/if}
      </div>
    {/if}

    {#if nextTravel && phase !== 'after'}
      {@const st = legStamp(nextTravel)}
      <button class="row tappable" onclick={() => router.goTab(trip.id, 'wallet')}>
        <span class="ic">{nextTravel.kind === 'flight' ? '✈' : nextTravel.kind === 'train' ? '🚄' : '🎟'}</span>
        <div class="rx">
          {#if nextTravel.kind === 'flight'}
            <b>{S.today.nextLeg} · {nextTravel.flightNo} → {nextTravel.to.code}</b>
            <small>{fmtLong(nextTravel.date)} · {nextTravel.dep} · {whenLabel(nextTravel.date)}</small>
          {:else}
            <b>{S.today.nextLeg} · <Md text={nextTravel.title} /></b>
            <small>{fmtLong(nextTravel.date)} · {whenLabel(nextTravel.date)}</small>
          {/if}
        </div>
        <span class="stamp {st.cls}">{st.label}</span>
      </button>
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
        <button class="btn wfull" style="margin-top:10px" onclick={() => router.goTab(trip.id, 'tasks')}>✅ Open {S.tabs.lists.toLowerCase()}</button>
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
  </div>
</main>

<style>
  .home {
    padding-bottom: 4px;
  }

  /* ---------- hero ---------- */
  .hero {
    position: relative;
    height: min(36vh, 258px);
    min-height: 206px;
    overflow: hidden;
    border-radius: 0 0 28px 28px;
    background: var(--card);
  }
  .hero :global(img) {
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
  .scene {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(120% 70% at 78% 18%, rgba(255, 233, 176, 0.5), transparent 60%),
      linear-gradient(180deg, hsl(var(--h) 48% 40%), hsl(var(--h) 45% 18%) 62%, #120d08);
  }
  .hscrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0) 42%, rgba(0, 0, 0, 0.62) 100%);
  }
  .city {
    position: absolute;
    left: 20px;
    top: 14px;
    right: 118px;
    margin: 0;
    font-family: var(--font-ui);
    font-weight: 800;
    font-size: clamp(26px, 8.4vw, 36px);
    line-height: 1.08;
    letter-spacing: -0.02em;
    color: var(--on-photo);
    text-shadow: 0 2px 14px rgba(0, 0, 0, 0.75);
    /* a long stop name must not eat the photo it is standing on */
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }
  .wchip {
    position: absolute;
    right: 14px;
    top: 16px;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.34);
    border-radius: 18px;
    padding: 7px 12px;
    font-size: 13.5px;
    font-weight: 650;
    color: var(--on-photo);
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .daytag {
    position: absolute;
    left: 20px;
    right: 20px;
    bottom: 14px;
    font-size: 12.5px;
    font-weight: 650;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: #ffe9bd;
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.9);
  }

  .card.hero-card {
    margin-top: 14px;
    padding: 20px 18px 18px;
    border-color: color-mix(in srgb, var(--gold) 42%, var(--line));
    box-shadow: var(--glow-3);
  }
  .counterline {
    margin: 12px 2px 2px;
    font-size: var(--text-md);
    color: var(--ink-2);
  }

  /* ---------- the day ---------- */
  .dayhead {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin: 18px 2px 4px;
  }
  .dayttl {
    margin: 18px 2px 10px;
    font-size: 20px;
    font-weight: 700;
    line-height: 1.25;
  }
  .dayhead .dayttl {
    margin: 0;
    flex: 1;
    min-width: 0;
  }

  .timeline {
    position: relative;
    padding: 6px 0 2px;
  }
  /* the luminous spine: gold at the top of the day, cooling to neon at its end */
  .spine {
    position: absolute;
    left: 60px;
    top: 10px;
    bottom: 14px;
    width: 4px;
    border-radius: 2px;
    background: linear-gradient(180deg, var(--gold), #8ec9e8);
    box-shadow: 0 0 14px rgba(232, 176, 75, 0.5);
  }
  .titem {
    display: flex;
    align-items: flex-start;
    position: relative;
    margin-bottom: 14px;
  }
  .tt {
    width: 52px;
    flex: 0 0 52px;
    text-align: right;
    padding: 14px 8px 0 0;
    font-size: 12.5px;
    font-weight: 650;
    color: var(--ink-2);
    font-variant-numeric: tabular-nums;
  }
  .dot {
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--paper);
    border: 3px solid var(--gold);
    margin: 16px 12px 0 -3px;
    z-index: 2;
    box-shadow: 0 0 10px rgba(232, 176, 75, 0.75);
  }
  .tcard {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(30, 36, 44, 0.55);
    border: 1px solid rgba(160, 190, 220, 0.35);
    border-radius: 18px;
    padding: 12px 13px;
    box-shadow: 0 0 16px rgba(120, 170, 220, 0.1);
  }
  .tcard.now {
    border-color: var(--gold);
    box-shadow: 0 0 20px rgba(232, 176, 75, 0.3);
  }
  .tcard.plain {
    margin-bottom: 10px;
  }
  .tcard .tx {
    flex: 1;
    min-width: 0;
  }
  .tcard b {
    display: block;
    font-size: 15.5px;
    font-weight: 700;
    line-height: 1.3;
  }
  .tcard p {
    margin: 3px 0 0;
    font-size: 13px;
    color: var(--ink-2);
    line-height: 1.45;
  }
  .tcard :global(.maps.compact .mapbtn) {
    border: 1.5px solid var(--gold-dim);
    color: var(--gold);
    border-radius: 50%;
  }
  .anyhead {
    margin: 18px 2px 8px;
    font-size: var(--text-xs);
    letter-spacing: 1.8px;
    text-transform: uppercase;
    color: var(--ink-2);
    font-weight: 700;
  }

  /* ---------- 📍 Places today ----------
     The city guide's chip, verbatim (StopDetail .gchip: --card-2 fill, pill
     radius, --ink-2 ink) wrapped around the same compact map button that
     already sits in the timeline cards above. No new token, no new component. */
  .dayplaces {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin: 16px 2px 0;
  }
  .dphead {
    width: 100%;
    font-size: var(--text-xs);
    color: var(--faint);
  }
  .dchip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    background: var(--card-2);
    border-radius: var(--radius-pill);
    padding: 0 2px 0 12px;
  }
  /* A bed's chip wears its booking title, and two of them run to fifty
     characters. Clipped like the app bar's own trip title rather than reworded:
     the full string still reaches the screen reader through the map button's
     aria-label, and the row stays a row. */
  .dcname {
    max-width: 52vw;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12.5px;
    line-height: 1.3;
    color: var(--ink-2);
  }

  /* ---------- the runbook checklist ---------- */
  .rbmeter {
    height: 5px;
    border-radius: 3px;
    background: var(--neon-track);
    overflow: hidden;
    margin: 0 2px 12px;
  }
  .rbmeter i {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: var(--neon);
    box-shadow: var(--glow-neon);
    transition: width var(--motion) var(--ease-out);
  }
  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .steps li {
    display: flex;
    align-items: flex-start;
    gap: 13px;
    padding: 12px 2px;
    border-bottom: 1px solid var(--line);
  }
  .steps li:last-child {
    border-bottom: none;
  }
  .cbox {
    flex: 0 0 auto;
    width: 30px;
    height: 30px;
    border-radius: 9px;
    border: 2.5px solid var(--line-2);
    background: none;
    display: grid;
    place-items: center;
    color: transparent;
    font-size: 15px;
    font-weight: 800;
    transition:
      border-color var(--motion-fast) var(--ease-out),
      color var(--motion-fast) var(--ease-out);
  }
  .steps li.done .cbox {
    border-color: var(--neon);
    color: var(--neon);
    box-shadow: var(--glow-neon);
  }
  .stx {
    flex: 1;
    min-width: 0;
    font-size: 14.5px;
    line-height: 1.45;
    padding-top: 3px;
  }
  .steps li.done .stx {
    color: var(--faint);
    text-decoration: line-through;
  }

  /* ---------- tonight / next leg ---------- */
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    text-align: left;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 18px;
    padding: 12px 14px;
    margin-top: 12px;
    box-shadow: var(--glow-1);
  }
  .row.tappable:active {
    border-color: color-mix(in srgb, var(--gold) 45%, var(--line));
  }
  .row .ic {
    flex: 0 0 auto;
    font-size: 20px;
    color: var(--gold);
  }
  .rx {
    flex: 1;
    min-width: 0;
  }
  .rx b {
    display: block;
    font-size: 14.5px;
    font-weight: 700;
    line-height: 1.35;
  }
  .rx small {
    display: block;
    font-size: 12.5px;
    color: var(--ink-2);
    margin-top: 2px;
  }
  .row .stamp {
    flex: 0 0 auto;
    margin-left: auto;
  }
</style>
