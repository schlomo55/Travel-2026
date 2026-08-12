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
  import { addDays, compareIso, fmtDow, fmtLong, fmtShort, parseYmd, ymd } from '../lib/logic/dates';
  import { buildTimeline, currentIndex } from '../lib/logic/timeline';
  import { countdownLabel, nextCommitment, nightInTransit, whenLabel } from '../lib/logic/commitment';
  import { runStepKey, setCheck } from '../lib/data/checks';
  import { noBookingStamp, statusStamp, transitNightStamp } from '../lib/logic/stamps';
  import { router } from '../lib/state/router.svelte';
  import { appState } from '../lib/state/appState.svelte';
  import { copyText } from '../lib/state/toast.svelte';
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

  /* ONE interval, and only while Home is mounted AND the screen is awake. The
     countdown is minute-granular precisely so it costs nothing; a timer still
     ticking behind a locked phone would cost battery for a screen nobody is
     reading, so `visibilitychange` stops it and restarts it with a fresh
     reading (the elapsed time while hidden is caught up in one step). */
  let tick = $state(Date.now());
  $effect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    const stop = (): void => {
      if (id !== null) clearInterval(id);
      id = null;
    };
    const start = (): void => {
      stop();
      tick = Date.now();
      id = setInterval(() => (tick = Date.now()), 60_000);
    };
    const onVisibility = (): void => {
      if (document.hidden) stop();
      else start();
    };
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  });
  const nowMinutes = $derived.by(() => {
    const d = new Date(tick);
    return ymd(d) === now ? d.getHours() * 60 + d.getMinutes() : null;
  });
  /* THE MOMENT THE COUNTDOWN COUNTS FROM. On the real today it is the real
     clock. On a PREVIEWED day it is that day's 00:00, because a day you are not
     living has no "now" inside it — pasting the real wall time onto another
     date would make the same preview read differently at 09:00 and at 23:00,
     and turn "is the countdown right?" into a coin flip. Home already refuses
     to highlight a "current" timeline item under preview for the same reason. */
  const nowMoment = $derived.by(() => {
    const d = new Date(tick);
    if (ymd(d) === now) return d;
    const start = parseYmd(now);
    start.setHours(0, 0, 0, 0);
    return start;
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
  /* ---------- the next hard commitment ----------
     The old "Next leg" row was a 14.5 px line two thirds down the screen, under
     the day, the places and the bed — the one fact on Home with a clock
     attached to it, drawn quieter than the weather. The query behind it (moves
     only, no cancelled, no `alternative` — Nov 22 is a flight OR ELSE the HSR)
     moved verbatim into logic/commitment.ts, where a stay's check-in joins it
     and fixed dates can test it. */
  const next = $derived(nextCommitment(bookings, now));
  /* Null once the moment has passed; the day phrasing stays true all day. */
  const nextCount = $derived(
    next ? (countdownLabel(next.date, next.time, nowMoment) ?? whenLabel(now, next.date)) : '',
  );
  const nextGlyph = $derived.by(() => {
    if (!next) return '';
    if (next.kind === 'checkin') return '🛏';
    return next.booking.kind === 'flight' ? '✈' : next.booking.kind === 'train' ? '🚄' : '🚗';
  });
  /* WHAT THE BOOKING STATES, AND NOT ONE WORD MORE. A flight carries two
     airport codes and a departure clock, so it prints them; a train or a road
     leg carries its own title and, where a document gave one, a time. No
     terminal, no gate, no station is composed here — the trip file either says
     it or the line does without it. */
  const nextLine = $derived.by(() => {
    if (!next) return '';
    const b = next.booking;
    if (b.kind === 'flight') return `${b.flightNo} · ${b.from.code} ${b.dep} → ${b.to.code}`;
    if (b.kind === 'hotel') return b.city ? `${b.title} · ${b.city}` : b.title;
    return next.time ? `${b.title} · ${next.time}` : b.title;
  });

  /* TONIGHT IS SPENT MOVING, not unbooked. Nov 21 is EY 888 out of Abu Dhabi at
     21:20, landing 08:45 the next morning: there is no bed to book, so the crit
     NO BOOKING ON FILE was the app crying wolf on a night nobody could act on.
     Nov 22 — the Yantai arrival, deliberately unbooked — is untouched by this
     and stays loud, which is the whole point of separating the two. */
  const transitLeg = $derived(nightInTransit(bookings, now));
  /* THE RED CARD USED TO BE THE SAME RED CARD ON EVERY DAY OF THE TRIP: the
     single earliest-due open task, whose deadline is already in the past, so it
     stayed the winner forever. Red that never changes is red he stops seeing.
     Now: how many windows are actually blown, and the nearest one still worth
     acting on — with the stale ones counted rather than re-read. */
  const overdueTasks = $derived(
    tasks
      .filter((t) => !t.done && t.due && compareIso(t.due, now) < 0)
      .sort((a, b) => compareIso(b.due ?? '', a.due ?? '')),
  );
  const upcomingTask = $derived(
    tasks
      .filter((t) => !t.done && t.due && compareIso(t.due, now) >= 0)
      .sort((a, b) => compareIso(a.due ?? '', b.due ?? ''))[0],
  );
  /* The nearest actionable item: the next deadline that has NOT passed, and
     only when nothing is due ahead, the most recently missed one. */
  const nextTask = $derived(upcomingTask ?? overdueTasks[0]);
  const openTasks = $derived(tasks.filter((t) => !t.done).length);
  /* A moment already ticked off in Lists is not the next timed moment. */
  const nextAlarm = $derived(
    alarms
      .filter((a) => !a.done && compareIso(a.date, now) >= 0)
      .sort((a, b) => compareIso(a.date, b.date) || a.time.localeCompare(b.time))[0],
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

  /* THE CAPTION SAYS THE DAY, AND ONLY THE DAY. It used to carry tonight's bed
     as well — "DAY 29 OF 37 · TONIGHT: DALI YANYUAN MOUNTAIN RETREAT 大理晏清
     山居客栈" — 12.5 px of uppercase running off the photo's bottom edge and
     wrapping into the scrim. Where you sleep is a row of its own further down,
     at a size it can be read at, with the stamp that says whether it is booked. */
  const dayTag = $derived.by(() => {
    if (phase === 'before') return S.shelf.daysToGo(daysUntilStart(trip, now));
    if (phase === 'after') return S.today.tripComplete;
    return S.shelf.dayOf(tripDay(trip, now), tripDays(trip));
  });

  /* HOW LOUD THE VISA CARD IS, AND WHY. Volume follows danger and nothing else:
     calm while there is room, warn inside the last five days, crit inside the
     last two — and crit on the hard deadline itself and past the limit, where
     the number has stopped being a countdown and become a fact. */
  const visaTone = $derived.by(() => {
    if (!pinned || !pinnedState) return '';
    if (pinnedState.phase === 'overLimit') return 'crit';
    if (pinnedState.phase === 'complete' || pinnedState.phase === 'before') return '';
    if (pinned.hardDeadline && compareIso(now, pinned.hardDeadline) >= 0) return 'crit';
    if (pinnedState.phase !== 'counting') return '';
    if (pinnedState.remaining <= 2) return 'crit';
    if (pinnedState.remaining <= 5) return 'warn';
    return '';
  });

  function toggleStep(i: number): void {
    if (!runbook) return;
    const key = runStepKey(trip.id, runbook.id, now, i);
    void setCheck(key, trip.id, !checkedKeys.has(key));
  }

  /* ---------- stepping a day ----------
     "What does tomorrow look like?" used to cost six taps through both top
     corners of a 6.8" phone. The date preview is the mechanism the app already
     has for showing another day, so the chevrons — and a horizontal swipe on
     the day itself — drive exactly that. Settings keeps the long jump. */
  function stepDay(delta: number): void {
    appState.setPreview(addDays(now, delta));
  }
  let touchX: number | null = null;
  let touchY: number | null = null;
  function onTouchStart(e: TouchEvent): void {
    const t = e.touches[0];
    touchX = t ? t.clientX : null;
    touchY = t ? t.clientY : null;
  }
  function onTouchEnd(e: TouchEvent): void {
    const t = e.changedTouches[0];
    if (!t || touchX === null || touchY === null) return;
    const dx = t.clientX - touchX;
    const dy = t.clientY - touchY;
    touchX = null;
    touchY = null;
    /* A swipe, not a scroll: mostly horizontal and long enough to mean it. */
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    stepDay(dx < 0 ? 1 : -1);
  }

  /* A run of eight digits or more inside a runbook step is a booking
     reference, a policy number or a ticket — something read out loud at 22:00,
     one-handed. It gets the same copy affordance the Wallet's code strip has. */
  const DIGIT_RUN = /\d[\d ]{7,}\d|\d{8,}/;
  function longDigits(step: string): string | null {
    const m = DIGIT_RUN.exec(step);
    return m ? m[0].replace(/\s+/g, '') : null;
  }

  const legStamp = (b: Booking): { label: string; cls: string } => statusStamp(b.status);
</script>

<main class="home" ontouchstart={onTouchStart} ontouchend={onTouchEnd}>
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
    <!-- Offline is NORMAL on this trip, so this is a quiet chip and not a
         warning — but silence about it meant a dead "Find email" tab could be
         the phone, the Firewall or a broken app, with no way to tell. -->
    {#if appState.offline}<div class="offchip">{S.system.offline}</div>{/if}
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

    <!-- ---------- the next hard commitment ----------
         The strongest element after the photo, because it is the only thing on
         this screen with a clock attached to it. The countdown, the route as
         the booking states it, the reference you read out at a desk, and the
         stamp that says whether it is held — one tap from the card that holds
         the rest. The whole element is absent when nothing timed is left; an
         empty "Next leg" frame would be worse than the silence. -->
    {#if next && phase !== 'after'}
      {@const b = next.booking}
      {@const st = statusStamp(b.status)}
      <section class="card lit nexthero">
        <button class="nhmain" onclick={() => router.go(`#/trip/${trip.id}/wallet/${b.id}`)}>
          <span class="nhhead">
            <span class="nhic" aria-hidden="true">{nextGlyph}</span>
            <span class="nhlabel">{next.kind === 'checkin' ? S.today.checkIn : S.today.nextLeg}</span>
            <span class="stamp {st.cls}">{st.label}</span>
          </span>
          <span class="nhcount mono">{nextCount}</span>
          <span class="nhroute"><Md text={nextLine} /></span>
          <span class="nhwhen">{fmtLong(next.date)}</span>
        </button>
        <!-- No code, no strip. A placeholder where a confirmation number goes
             is the one thing worse than not having one (§RULES 4). -->
        {#if b.code}
          <div class="nhcode">
            <button class="nhcodeval mono" onclick={() => copyText(b.code ?? '', b.codeLabel ?? '')}>{b.code}</button>
            <span class="nhcopyhint">{S.wallet.tapToCopy}</span>
          </div>
        {/if}
      </section>
    {/if}

    <!-- ---------- the visa clock ----------
         THIS WAS A 13.5 px LINE. The one legally binding number on a 37-day
         trip — the day a border officer will count — sat in the same grey the
         weather age is printed in, above a 20 px day title. It is a card now,
         with the day number at the size it is worth, and it opens the counter
         spelled out in full on Info (the same doorway the app bar's pill uses).
         It still has no silent branches: `before` speaks quietly because not
         having started is not danger, and `overLimit` keeps the crit treatment
         the Repair run gave it. -->
    {#if pinned && pinnedState && phase === 'during'}
      <button class="card visacard {visaTone}" onclick={() => router.goCompliance(trip.id)}>
        <!-- WHERE THERE IS A NUMBER, the label row carries the state in words
             and the headline carries the number — over the limit the words
             change and the number stays, because "day 31 of 30" is the fact and
             OVER THE LIMIT is what it means. Where there is NO number the state
             sentence already names the counter (strings.ts writes it that way
             for Info's pill), so it leads on its own rather than printing
             "Mainland visa" twice in two sizes. -->
        {#if pinnedState.phase === 'counting' || pinnedState.phase === 'overLimit'}
          <span class="vclabel" class:over={pinnedState.phase === 'overLimit'}>
            {pinned.icon ?? '🛂'}
            {pinnedState.phase === 'overLimit' ? S.today.counterOver(pinned.name) : pinned.name}
          </span>
          <span class="vcday">{S.today.counterDayOf(pinnedState.day, pinnedState.limitDays)}</span>
        {:else if pinnedState.phase === 'entryDay'}
          <span class="vclabel">{pinned.icon ?? '🛂'} {pinned.name}</span>
          <span class="vcsay">{S.today.entryDay}</span>
        {:else if pinnedState.phase === 'complete'}
          <span class="vcsay">{pinned.icon ?? '🛂'} {S.today.counterComplete(pinned.name)}</span>
        {:else}
          <span class="vcsay">{pinned.icon ?? '🛂'} {S.today.counterBefore(pinned.name, fmtShort(pinned.startDate))}</span>
        {/if}
        {#if pinned.hardDeadline}
          <span class="vcexit">{S.today.mustLeaveBy(fmtShort(pinned.hardDeadline))}</span>
        {/if}
      </button>
    {/if}

    <!-- ‹ › — one thumb, thumb-height, and they step the PREVIEWED date, so
         the long jump in Settings and this share one mechanism. -->
    {#snippet dayStep(delta: number, label: string, glyph: string)}
      <button class="daystep" onclick={() => stepDay(delta)} aria-label={label}>{glyph}</button>
    {/snippet}

    {#if runbook}
      <!-- a runbook day: the checklist IS the day -->
      <div class="dayhead">
        {@render dayStep(-1, S.today.prevDay, '‹')}
        <h2 class="dayttl"><Md text={runbook.title} /></h2>
        {@render dayStep(1, S.today.nextDay, '›')}
      </div>
      <div class="rbmeter" aria-hidden="true"><i style="width:{runbook.steps.length ? (doneSteps / runbook.steps.length) * 100 : 0}%"></i></div>
      <ul class="steps u-stagger">
        {#each runbook.steps as step, i (i)}
          {@const digits = longDigits(step)}
          <li class:done={isChecked(i)} class:crit={runbook.severity === 'crit'}>
            <!-- The row is the target, not just the box: a <label> makes the
                 300 px of step text toggle it too, and the box carries the
                 44 px ring Tasks has had all along without drawing it. -->
            <label class="steprow">
              <input class="cbox" type="checkbox" checked={isChecked(i)} onchange={() => toggleStep(i)} />
              <span class="stx"><Md text={step} /></span>
            </label>
            {#if digits}
              <button class="stepcopy" onclick={() => copyText(digits)} aria-label={S.info.copy}>⧉</button>
            {/if}
          </li>
        {/each}
      </ul>
    {:else if phase === 'during' && day}
      <div class="dayhead">
        {@render dayStep(-1, S.today.prevDay, '‹')}
        <h2 class="dayttl"><Md text={day.title} /></h2>
        {#if day.fromDefault}<span class="pill">{S.today.usualDay}</span>{/if}
        {@render dayStep(1, S.today.nextDay, '›')}
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

    <!-- ---------- tonight ----------
         NO STAMP IS NOT A STATE THE EYE READS — it reads as "fine". Every
         tonight row carries exactly one of BOOKED / PENDING / WALK-IN / NIGHT
         IN TRANSIT / NO BOOKING ON FILE, and the row opens whichever card it
         names instead of being a dead <div>.

         THE FOURTH STAMP IS THE 2026-08-12 OWNER DECISION. When an overnight
         leg spans the night there is no reservation to hold, so the absence is
         the correct state of the world — Nov 21 is EY 888, Abu Dhabi 21:20 to
         Beijing 08:45 — and it takes the neutral stamp. Nov 22, the Yantai
         arrival night that is genuinely unbooked, stays crit; keeping those two
         apart is the entire point. -->
    {#if day?.bedLabel && phase === 'during'}
      {@const bed = tonightBooking ?? transitLeg}
      {@const st = tonightBooking
        ? legStamp(tonightBooking)
        : transitLeg
          ? transitNightStamp()
          : noBookingStamp()}
      <div class="row bedrow" class:crit={!bed}>
        {#snippet bedFace()}
          <span class="ic">{day?.bedEmoji ?? '🛏'}</span>
          <div class="rx">
            <b><Md text={day?.bedLabel ?? ''} /></b>
            <small>{S.today.tonight} · {fmtDow(now)}</small>
          </div>
          <span class="stamp {st.cls}">{st.label}</span>
        {/snippet}
        {#if bed}
          <button class="rowmain" onclick={() => router.go(`#/trip/${trip.id}/wallet/${bed.id}`)}>
            {@render bedFace()}
          </button>
        {:else}
          <div class="rowmain">{@render bedFace()}</div>
        {/if}
        {#if tonightBooking}
          <!-- "How do I get there" in one more tap, in the thumb zone. A night
               in the air has nowhere to be driven to, so it gets no buttons. -->
          <MapButtons
            coord={tonightBooking.coord}
            name={tonightBooking.title}
            query={tonightBooking.mapQuery}
            address={tonightBooking.address}
            city={tonightBooking.mapCity}
            url={tonightBooking.mapUrl}
          />
        {/if}
      </div>
    {/if}

    {#if nextTask}
      {@const overdue = overdueTasks.length > 0}
      <section class="card" class:crit={overdue}>
        <h3>
          {overdue ? S.today.overdueCount(overdueTasks.length) : S.today.nextDeadline}
          <span style="text-transform:none; letter-spacing:0; color:var(--faint); font-weight:500"
            >· {nextTask.dueLabel ?? fmtShort(nextTask.due ?? '')}{#if nextTask.dueLabel && nextTask.due}
              · {compareIso(nextTask.due, now) < 0 ? S.today.wasDue(fmtShort(nextTask.due)) : fmtShort(nextTask.due)}{/if}</span
          >
        </h3>
        <div><Md text={nextTask.title} as="div" /></div>
        <div class="small" style="margin-top:6px">{S.today.openItems(openTasks)}</div>
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
  /* ---------- the next hard commitment ----------
     Gold at rest, glow-2, and the countdown carrying the weight: this is the
     thing you came for (LANTERN §glow-elevation). It is a section holding a
     button rather than one big button, because the reference strip below it has
     its own copy control and a button cannot live inside a button. */
  .nexthero {
    margin-top: 14px;
    padding: 6px 16px 12px;
    border-color: var(--gold-dim);
    box-shadow: var(--glow-2);
  }
  .nhmain {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 10px 0 2px;
    color: inherit;
    font: inherit;
  }
  .nhhead {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .nhic {
    font-size: 17px;
    color: var(--gold);
  }
  .nhlabel {
    flex: 1;
    min-width: 0;
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 1.6px;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .nhhead .stamp {
    flex: 0 0 auto;
  }
  /* The countdown is the loudest number on Home. Tabular so the minutes do not
     shuffle the line sideways every sixty seconds. */
  .nhcount {
    display: block;
    margin: 6px 0 2px;
    font-size: 27px;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.5px;
    color: var(--gold);
    font-variant-numeric: tabular-nums;
  }
  .nhroute {
    display: block;
    font-size: 15.5px;
    font-weight: 650;
    line-height: 1.35;
    color: var(--ink);
  }
  .nhwhen {
    display: block;
    margin-top: 3px;
    font-size: var(--text-md);
    color: var(--ink-2);
  }
  /* The Wallet's code strip, verbatim in behaviour: the string leaves the card
     surface onto plain --paper-2, mono gold, TAP TO COPY beside it, one tap to
     the clipboard with the app's haptic. Smaller than the luggage tag's, which
     is the copy you hold up at a desk; this one is the reminder. */
  .nhcode {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px 10px;
    margin: 10px -6px 0;
    padding: 4px 12px;
    background: var(--paper-2);
    border-radius: 10px;
  }
  .nhcodeval {
    background: none;
    border: none;
    padding: 0;
    min-height: 44px;
    text-align: left;
    font-size: 19px;
    font-weight: 700;
    letter-spacing: 1.4px;
    color: var(--gold);
    word-break: break-all;
  }
  .nhcodeval:active {
    color: var(--gold-light);
  }
  .nhcopyhint {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--faint);
  }

  /* ---------- the visa clock ----------
     Calm by default: a dim gold frame and no fill, because thirty days with
     twenty left is not news. `.warn` and `.crit` are the app's own card
     modifiers (app.css), so the escalation uses the same two treatments every
     other card in the app escalates with. */
  .visacard {
    display: block;
    width: 100%;
    margin: 14px 0 13px;
    padding: 12px 16px 14px;
    text-align: left;
    border-color: var(--gold-dim);
    color: inherit;
    font: inherit;
  }
  .vclabel {
    display: block;
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 1.6px;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .vclabel.over {
    color: var(--crit);
  }
  /* The number a border officer counts, at the size it is worth. */
  .vcday {
    display: block;
    margin-top: 4px;
    font-size: 26px;
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: 0.5px;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  /* The states with no number to print: the sentence IS the card. */
  .vcsay {
    display: block;
    font-size: var(--text-base);
    font-weight: 650;
    line-height: 1.35;
    color: var(--ink);
  }
  .vclabel + .vcsay {
    margin-top: 4px;
  }
  .vcexit {
    display: block;
    margin-top: 4px;
    font-size: var(--text-base);
    color: var(--ink-2);
  }
  .visacard.warn .vcday {
    color: var(--warn);
  }
  .visacard.crit .vcday,
  .visacard.crit .vcexit {
    color: var(--crit);
  }
  .visacard.crit .vcexit {
    font-weight: 650;
  }
  /* Offline is dim, not crit: it is the normal condition of this trip. */
  .offchip {
    display: inline-block;
    margin: 10px 2px 0;
    padding: 4px 11px;
    border: 1px dashed var(--line-2);
    border-radius: var(--radius-pill);
    font-size: 12px;
    font-weight: 650;
    color: var(--faint);
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
  /* Day stepping, at thumb height beside the title it changes. */
  .daystep {
    flex: 0 0 auto;
    min-width: 44px;
    min-height: 44px;
    background: var(--card-2);
    border: 1px solid var(--line-2);
    border-radius: 50%;
    color: var(--ink-2);
    font-size: 20px;
    line-height: 1;
    padding: 0;
  }
  .daystep:active {
    border-color: var(--gold);
    color: var(--gold-light);
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
    gap: 6px;
    padding: 12px 2px;
    border-bottom: 1px solid var(--line);
  }
  .steps li:last-child {
    border-bottom: none;
  }
  /* The whole row toggles the step — a queue at VISA EXIT DAY is no place to
     be aiming at a 30 px square. */
  .steprow {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: flex-start;
    gap: 13px;
    cursor: pointer;
  }
  /* 30 px of drawing inside a 44 px ring: the ::after costs no layout, so the
     runbook keeps its rhythm (Tasks.svelte has done this since Phase 2). */
  .cbox {
    position: relative;
    appearance: none;
    -webkit-appearance: none;
    flex: 0 0 auto;
    width: 30px;
    height: 30px;
    min-height: 30px;
    margin: 0;
    padding: 0;
    border-radius: 9px;
    border: 2.5px solid var(--line-2);
    background: none;
    display: grid;
    place-items: center;
    font-size: 15px;
    font-weight: 800;
    transition:
      border-color var(--motion-fast) var(--ease-out),
      color var(--motion-fast) var(--ease-out);
  }
  .cbox::after {
    content: '';
    position: absolute;
    inset: -7px;
  }
  .cbox:checked::before {
    content: '✓';
    color: var(--neon);
  }
  .steps li.done .cbox {
    border-color: var(--neon);
    box-shadow: var(--glow-neon);
  }
  .stepcopy {
    flex: 0 0 auto;
    min-width: 44px;
    min-height: 44px;
    background: none;
    border: 1px solid transparent;
    border-radius: 10px;
    color: var(--faint);
    font-size: 16px;
  }
  .stepcopy:active {
    border-color: var(--gold);
    color: var(--gold-light);
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

  /* ---------- tonight ---------- */
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
  .row .ic {
    flex: 0 0 auto;
    font-size: 20px;
    color: var(--gold);
  }
  .rx {
    flex: 1;
    min-width: 0;
  }
  /* WHERE YOU SLEEP LEFT THE PHOTO CAPTION and lives here now, so it is read at
     a size a bed name deserves rather than at 12.5 px of uppercase running off
     the picture's edge. */
  .rx b {
    display: block;
    font-size: 15.5px;
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
  /* The bed row carries a face (tappable, or not when there is no booking to
     open) and its own map buttons under it. */
  .row.bedrow {
    display: block;
    padding: 4px 14px 10px;
  }
  .row.crit {
    border-color: color-mix(in srgb, var(--crit) 45%, var(--line));
    background: linear-gradient(165deg, var(--crit-bg), var(--card));
  }
  .rowmain {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 44px;
    padding: 8px 0;
    text-align: left;
    background: none;
    border: none;
    color: inherit;
    font: inherit;
  }
  .row.bedrow :global(.maps) {
    margin-top: 2px;
  }
</style>
