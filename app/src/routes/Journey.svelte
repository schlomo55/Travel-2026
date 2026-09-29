<script lang="ts">
  /* JOURNEY — "Replay the trip + every stop with its coverage" (f-journey,
     ROUND4 §IA). Top to bottom:

     · REPLAY (#route): the trip as a constellation for any day, the scrubber
       from the first day to the last, the visa window as a bar under it.
     · THE ROUTE CHECK: every stop (its beds) and every move (its legs) in
       order, lit by the RELAY sweep once when Journey opens — it pauses on
       amber and red and ends on the count; the map's rings light with it.
     · THE TRIP IN NUMBERS (#stats): only knowable numbers — the stop-to-stop
       distance is a straight line and says so.
     · In edit mode: add a stop, add a day, and the runbooks.
     A stop opens its city (journey/:stopId); the city opens its guide. */
  import { untrack } from 'svelte';
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
  import { db } from '../lib/db/db';
  import { deleteEntity, saveEntity } from '../lib/data/edit';
  import { dayPlanSpec, runbookSpec, stopSpec } from '../lib/components/forms/specs';
  import type { FormSpec } from '../lib/components/forms/types';
  import { relayPlan, type RelayStep } from '../lib/logic/motion';
  import { routeCheck } from '../lib/logic/routecheck';
  import { tripPhase } from '../lib/logic/phase';
  import { fmtDow, fmtShort, ymd } from '../lib/logic/dates';
  import { mdliteToText } from '../lib/logic/mdlite';
  import { tripStats } from '../lib/logic/stats';
  import { fmtKm, routeDistanceKm } from '../lib/logic/geoStats';
  import { fmtMoney, symbolFor } from '../lib/logic/money';
  import { minute } from '../lib/state/minute.svelte';
  import { router } from '../lib/state/router.svelte';
  import { S } from '../lib/i18n/strings';
  import Icon from '../lib/components/horizon/Icon.svelte';
  import EmptyState from '../lib/components/ui/EmptyState.svelte';
  import EditSheet from '../lib/components/ui/EditSheet.svelte';
  import Md from '../lib/components/ui/Md.svelte';
  import { buildConstellation } from '../lib/logic/constellation';
  import { buildConnectors } from '../lib/logic/connectors';
  import {
    dayIndex,
    PLAY_HOME,
    playAction,
    playback,
    replayClock,
    scrubBars,
    scrubMarks,
    tripDates,
    visaWindow,
    whereOn,
    type PlayEvent,
  } from '../lib/logic/replay';
  import { realStops } from '../lib/logic/day';
  import { chipOf } from '../lib/logic/stamps';
  import { nightsOf, stayRange } from '../lib/logic/guide';
  import { relay } from '../lib/motion/relay';
  import TripMap from '../lib/map/TripMap.svelte';

  let {
    trip,
    counters,
    stops,
    bookings,
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
    runbooks: Runbook[];
    expenses: Expense[];
    tasks: Task[];
    packing: PackingItem[];
    now: ISODate;
    editing: boolean;
  } = $props();

  const id = $derived(encodeURIComponent(trip.id));
  const real = $derived(realStops(stops));
  const phase = $derived(tripPhase(trip, now));

  /* ---------- where the playhead rests: today, at the hour on the real today ---------- */
  $effect(() => minute.watch());
  const rest = $derived.by(() => {
    const d = new Date(minute.t);
    const min = ymd(d) === now && phase === 'during' ? d.getHours() * 60 + d.getMinutes() : null;
    return {
      clock: min === null ? null : `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`,
      home: dayIndex(trip, now) + (phase === 'during' ? (min !== null ? min / 1440 : 0.5) : phase === 'before' ? 0 : 0.999),
    };
  });

  /* ---------- the route check, and the Relay sweep over it ---------- */
  /* The sweep runs once as the rows first draw (each row's animation is
     paced from its own insertion); a later re-render hands the same steps
     back and the relay action leaves a finished row alone. The map's rings
     are the stops the check flags, lit at their rows' moments. */
  const R = $derived.by(() => {
    const check = routeCheck(trip, stops, bookings, now);
    const plan = relayPlan(check.rows.map((r) => r.tone));
    const flags = new Map<string, string>();
    const relayAt = new Map<string, RelayStep>();
    check.rows.forEach((r, i) => {
      if (r.kind !== 'stop') return;
      if (r.tone !== 'ok') flags.set(r.stop.id, r.tone);
      relayAt.set(r.stop.id, plan.steps[i]!);
    });
    return { check, plan, flags, relayAt };
  });

  /* ---------- the trip in numbers — only what can be known ---------- */
  const tiles = $derived.by(() => {
    const st = tripStats(trip, now, { stops, expenses, bookings, tasks, packing });
    const km = routeDistanceKm(stops);
    const out: { label: string; value: string; tone: string }[] = [];
    out.push({ label: S.info.stat.days, value: String(st.days), tone: '' });
    out.push({ label: S.info.stat.stops, value: String(st.stops), tone: '' });
    if (st.nights > 0) out.push({ label: S.info.stat.nights, value: String(st.nights), tone: '' });
    if (km !== null) out.push({ label: S.info.stat.distance, value: fmtKm(km), tone: 'lilac' });
    if (expenses.length) out.push({ label: S.info.stat.spent, value: fmtMoney(st.totalMinor, symbolFor(trip, trip.homeCurrency)), tone: 'sun' });
    const total = st.bookingsByStatus.booked + st.bookingsByStatus.pending + st.bookingsByStatus.walkin;
    if (total > 0) out.push({ label: S.info.stat.bookings, value: `${st.bookingsByStatus.booked}/${total}`, tone: 'ok' });
    if (st.packedTotal > 0) out.push({ label: S.info.stat.packed, value: `${st.packedDone}/${st.packedTotal}`, tone: 'ok' });
    return out;
  });

  /* An old #/stats link lands here with the section it meant; the scroll is
     repeated once the rows have arrived and pushed it down. (#/map is the
     Map tab since Map 5c, and asks for no section here.) */
  $effect(() => {
    const a = router.pendingAnchor;
    if (a !== 'stats') return;
    untrack(() => (router.pendingAnchor = null));
    const go = (): void => document.getElementById(a)?.scrollIntoView({ block: 'start' });
    setTimeout(go, 150);
    setTimeout(go, 700);
  });

  /* ---------- REPLAY THE TRIP (f-journey) ----------
     The constellation drawn for any day of the trip, a scrubber from its
     first day to its last, and the visa window as a bar under it.
     · PLAY walks the days (logic/replay.ts replayClock): a day a leg is
       walked holds while a COMET flies that leg and leaves it painted behind
       it; every other day passes quickly; the playhead ends back on today.
       Pressed again it pauses, and pressed after a pause it goes on.
     · ‹ › step one day, the scrubber drags through the days; either stops
       Play. The map is always the playhead's own day: the road so far lit,
       the day's leg Flowing (while nothing plays), legs ahead dotted, YOU and
       TONIGHT where that day puts them.
     · Relay's rings — the stops the route check flags — light with their rows.
     Nothing moves while the app is hidden: Play waits for it (a frame never
     advances more than 100 ms). Words never move. */
  const BOX = { width: 412, height: 280, pad: 28, padTop: 22, padBottom: 22 };
  /* the scrubber's own width in px (the screen, at most 480, less its 24 px
     sides) — read once, the app is portrait-only — so no date under it
     touches the last one (logic/replay.ts scrubMarks) */
  const TRACK = Math.min(480, document.documentElement.clientWidth || 412) - 48;

  /* what the trip itself decides, once: its days, the clock Play runs on,
     the bars and the dates under the scrubber, the legs nothing holds */
  const T = $derived.by(() => {
    const dates = tripDates(trip);
    const n = Math.max(1, dates.length);
    const placed = real.filter((s) => s.coord);
    return {
      dates,
      n,
      clock: replayClock(dates, new Set(placed.slice(1).map((s) => s.start))),
      bars: scrubBars(trip, stops),
      marks: scrubMarks(n, TRACK),
      unbooked: new Set(
        buildConnectors(stops, bookings, trip)
          .filter((k) => k.state !== 'booked' && k.fromStopId && k.toStopId)
          .map((k) => `${k.fromStopId}>${k.toStopId}`),
      ),
    };
  });
  /* the playhead: logic/replay.ts `playback` — home (resting on today),
     playing, paused, or parked where a hand moved it */
  let pb = $state.raw(PLAY_HOME);
  const pos = $derived(pb.pos);
  const playing = $derived(pb.mode === 'playing');
  const p = $derived(Math.min(Math.max(pos ?? rest.home, 0), T.n - 0.001));
  const idx = $derived(Math.floor(p));
  const atHome = $derived(pos === null);

  /* what the playhead's day decides: the map, the words, the visa */
  const D = $derived.by(() => {
    const date = T.dates[idx] ?? trip.start;
    return {
      date,
      c: buildConstellation(stops, date, BOX, { unbooked: T.unbooked }),
      when: `${fmtDow(date)}${idx === Math.floor(rest.home) && atHome && rest.clock ? ` · ${rest.clock}` : ''} · ${S.journey.dayOf(idx + 1, T.n)}`,
      where: whereOn(stops, bookings, date),
      visa: visaWindow(
        counters.find((k) => k.pinned),
        trip,
        date,
      ),
    };
  });

  /* ---------- Play ----------
     Every control is an event on the one playback state (Run 3c): Back to
     today while Play runs stops it — the next frame can no longer put the
     playhead back — and the button's name says what a press will do. */
  let raf = 0;
  let last = 0;
  function frame(ts: number): void {
    pb = playback(pb, { kind: 'frame', dt: ts - last }, T.clock);
    last = ts;
    if (pb.mode === 'playing') raf = requestAnimationFrame(frame);
  }
  function send(e: PlayEvent): void {
    cancelAnimationFrame(raf);
    pb = playback(pb, e, T.clock);
    if (pb.mode !== 'playing') return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  $effect(() => () => cancelAnimationFrame(raf));
  const seek = (i: number): void => send({ kind: 'seek', day: i });
  const playName = $derived.by(() => {
    const a = playAction(pb, T.n);
    return a.act === 'pause'
      ? S.journey.pause
      : a.act === 'resume'
        ? S.journey.resume
        : a.day
          ? S.journey.playFrom(fmtShort(T.dates[a.day] ?? trip.start))
          : S.journey.play(fmtShort(trip.start));
  });

  /* while it plays, the Comet is the motion: the day's leg flies and paints
     itself, and nothing Flows */
  const shown = $derived(D.c && playing ? { ...D.c, legs: D.c.legs.map((l) => (l.live ? { ...l, live: false } : l)) } : D.c);
  const pct = (x: number): string => `${(Math.min(Math.max(x, 0), T.n) / T.n) * 100}%`;

  /* ---------- THE ROUTE CHECK — every stop and every move, in order ----------
     RELAY: the rows light one after another — a stop's dot, a move's
     diamond, then its word — pausing with a pulse on amber (not booked) and
     longer on red (a bed missing), and the sweep ends on the count in the
     header. The rail on the left is time: lit up to tonight's stop, dotted
     after it — the map's own language. A stop row opens the city; a move row
     opens to show its legs in the order you travel them — "then" between the
     parts, "or instead" before a fallback, a move nothing covers saying so —
     each leg a door to its pass. */
  const MODE: Record<string, string> = { air: 'plane', rail: 'train', road: 'car' };
  const pass = (b: Booking): string => `#/trip/${id}/pocket/${encodeURIComponent(b.id)}`;
  /** a leg's own line: "CA 8683 · 12:35 → 13:45 · 1h 10m · $117.30" */
  const line = (b: Booking): string =>
    [b.kind === 'flight' ? b.flightNo : '', 'dep' in b && b.dep ? `${b.dep}${'arr' in b && b.arr ? ` → ${b.arr}` : ''}` : '', 'duration' in b ? b.duration : '', b.priceNote]
      .filter(Boolean)
      .join(' · ');

  /* the rail is time — lit up to tonight's stop, dotted after it — and the
     first and last rows have no half beyond them */
  const rails = $derived(
    R.check.rows.map((r, i) => {
      const [u, d] = r.kind === 'stop' ? (r.past ? 'll' : r.tonight ? 'lf' : 'ff') : r.past || r.today ? 'll' : 'ff';
      return `rail${i ? ` u${u}` : ''}${i < R.check.rows.length - 1 ? ` d${d}` : ''}`;
    }),
  );

  /* ---------- the editors: one sheet, whichever it edits ---------- */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Sheet = { spec: FormSpec<any>; entity?: any; save: (x: any) => Promise<void>; del?: () => Promise<void> };
  let sheet = $state<Sheet | null>(null);
  const editStop = (e?: Stop): void => {
    sheet = { spec: stopSpec(trip.id, stops.length), entity: e, save: (x: Stop) => saveEntity(db.stops, x), del: e && (() => deleteEntity(db.stops, e, 'Stop deleted')) };
  };
  const editRunbook = (e?: Runbook): void => {
    sheet = { spec: runbookSpec(trip.id), entity: e, save: (x: Runbook) => saveEntity(db.runbooks, x), del: e && (() => deleteEntity(db.runbooks, e, 'Runbook deleted')) };
  };
  const addDay = (): void => {
    sheet = { spec: dayPlanSpec(trip.id, trip.start, runbooks), save: (x: DayPlan) => saveEntity(db.dayPlans, x) };
  };
</script>

<main class="journey">
  <header class="wrap jhead">
    <div class="jtitles">
      <h1 class="display jtitle">{S.nav.journey}</h1>
      <span class="jsub">{S.journey.subtitle(`${fmtShort(trip.start)} → ${fmtShort(trip.end)}`, real.length)}</span>
    </div>
    {#if pos === null && phase === 'during'}
      <span class="jnow"><i aria-hidden="true"></i>{rest.clock ? S.journey.todayAt(rest.clock) : S.journey.today}</span>
    {:else if pos !== null}
      <button class="btn jback" onclick={() => send({ kind: 'home' })}><Icon name="sun" size={14} stroke={2} />{S.journey.backToday}</button>
    {/if}
  </header>

  {#if real.length}
    <section id="route" class="jsec" aria-label={S.journey.replayAria}>
      <div class="replay">
        <div class="rp-map" role="img" aria-label={D.c ? S.journey.mapAria(D.c.stars.length, R.flags.size) : D.where}>
          {#if shown}
            <TripMap
              c={shown}
              grid
              comet={playing ? (shown.legs.find((l) => l.state === 'today') ?? null) : null}
              trail
              flags={R.flags}
              relayAt={R.relayAt}
              quiet={playing}
            />
          {/if}
        </div>

        <div class="rp-ctl">
          <button class="rp-play" onclick={() => send({ kind: 'toggle' })} aria-label={playName}>
            <Icon name={playing ? 'pause' : 'play'} size={18} stroke={0} class="fillicon" />
          </button>
          <div class="rp-when">
            <span class="num rp-wl">{D.when}</span>
            <span class="rp-wh">{D.where}</span>
          </div>
          <button class="iconbtn" onclick={() => seek(idx - 1)} aria-label={S.journey.prev} disabled={idx <= 0}><Icon name="chevron-left" size={18} /></button>
          <button class="iconbtn" onclick={() => seek(idx + 1)} aria-label={S.journey.next} disabled={idx >= T.n - 1}><Icon name="chevron-right" size={18} /></button>
        </div>

        <div class="rp-scrub">
          <div class="rp-track">
            {#each T.bars as b (b.from)}
              <span class="bar {b.kind} {b.to < idx ? 'past' : b.from <= idx ? 'cur' : ''}" style="left:{pct(b.from)};width:{pct(b.to - b.from + 1)}"></span>
            {/each}
            {#if D.visa}
              {@const v = D.visa}
              {@const span = Math.min(v.to + 1, T.n) - Math.max(v.from, 0)}
              <!-- the window, lit to the playhead (never past the planned exit), the deadline ticked at its end -->
              <span
                class="vbar {v.tone}"
                style="left:{pct(v.from)};width:{pct(span)};--lit:{Math.max(0, Math.min(p, (v.planned ?? v.to) + 1) - Math.max(v.from, 0)) / Math.max(1, span) * 100}%;--tick:{v.deadline ? 1 : 0}"
              ></span>
            {/if}
            <span class="headwrap" style="transform:translateX({(p / T.n) * 100}%)" aria-hidden="true">
              <span class="glow"></span>
              <span class="knob"></span>
            </span>
          </div>
          <input
            class="rp-range"
            type="range"
            min="0"
            max={T.n - 1}
            step="1"
            value={idx}
            oninput={(e) => seek(Number(e.currentTarget.value))}
            aria-label={S.journey.scrub}
            aria-valuetext="{fmtDow(D.date)}, {S.journey.dayOf(idx + 1, T.n)}"
          />
          <div class="rp-marks" aria-hidden="true">
            {#each T.marks as m, i (m)}
              <span
                class="num {i === 0 ? 'first' : i === T.marks.length - 1 ? 'last' : ''}"
                class:now={m === Math.floor(rest.home) && atHome}
                style={i === 0 || i === T.marks.length - 1 ? '' : `left:${pct(m + 0.5)}`}>{fmtShort(T.dates[m] ?? trip.start)}</span
              >
            {/each}
          </div>
        </div>

        {#if D.visa}
          <a class="rp-visa {D.visa.tone}" href="#/trip/{encodeURIComponent(trip.id)}/pocket/visa" aria-label={S.journey.visaAria(D.visa.name, D.visa.value, D.visa.exit)}>
            <span class="caps vname">{D.visa.name}</span>
            <span class="num vval">{D.visa.value}</span>
            <span class="vexit">{D.visa.exit}</span>
          </a>
        {/if}
      </div>
    </section>
    <section class="check" aria-labelledby="ck-h">
      <div class="ck-head">
        <h2 id="ck-h" class="display">{S.journey.check}</h2>
        <span class="ck-sum relay-end" style="--rd:{R.plan.total}ms">
          {#if R.check.legsToBook}<span class="chip warn">{S.journey.legsToBook(R.check.legsToBook)}</span>{/if}
          {#if R.check.bedsMissing}<span class="chip crit">{S.journey.bedsMissing(R.check.bedsMissing)}</span>{/if}
          {#if !R.check.legsToBook && !R.check.bedsMissing}<span class="chip ok">{S.journey.allBooked}</span>{/if}
        </span>
      </div>

      <ol class="ck-list" aria-label={S.journey.checkAria}>
        {#each R.check.rows as r, i (r.kind === 'stop' ? r.stop.id : r.connector.id)}
          {#if r.kind === 'stop'}
            <li class="ck-row ck-stop" class:tonight={r.tonight} data-stop={r.stop.id} data-tone={r.tone} use:relay={R.plan.steps[i]}>
              <a class="ck-main" href="#/trip/{id}/journey/{encodeURIComponent(r.stop.id)}">
                <span class={rails[i]} aria-hidden="true"><i class="node rl t-{r.tone}"></i></span>
                <span class="ck-txt">
                  <span class="ck-name"><span class="ck-nm">{mdliteToText(r.stop.name)}</span>{#if r.tonight}<span class="caps">{S.journey.tonight}</span>{/if}</span>
                  <span class="ck-sub">{S.journey.stopSub(stayRange(r.stop), nightsOf(r.stop))}</span>
                </span>
                <span class="chip rl {r.tone}">{r.word}</span>
                <Icon name="chevron-right" size={18} />
              </a>
            </li>
          {:else}
            {@const k = r.connector}
            <li class="ck-row ck-leg" class:today={r.today} data-tone={r.tone} use:relay={R.plan.steps[i]}>
              <details>
                <summary class="ck-main">
                  <span class={rails[i]} aria-hidden="true"><i class="node rl t-{r.tone} {r.today ? 'sun' : 'diamond'}"></i></span>
                  <span class="ck-move">
                    <Icon name={MODE[k.mode] ?? 'route'} size={14} />
                    {#if r.today}<b>{S.journey.today}</b>{:else}<span class="num">{fmtDow(k.date)}</span>{/if}
                    <span class="ck-lbl">{r.label}</span>
                  </span>
                  <span class="chip rl {r.tone}">{r.word}</span>
                </summary>
                <div class="ck-legs">
                  {#each k.legs as b, j (b.id)}
                    {#if j}<span class="caps ck-then">{S.journey.then}</span>{/if}
                    <a class="ck-lg" href={pass(b)}
                      ><span class="lg-t"><Md text={b.title} /><span class="num">{line(b)}</span></span><span class="chip {chipOf(b.status).cls}">{chipOf(b.status).label}</span></a
                    >
                  {:else}
                    <p class="ck-gap">{S.journey.gap}</p>
                  {/each}
                  {#each k.alternatives as b (b.id)}
                    <a class="ck-lg alt" href={pass(b)}><span class="lg-t"><span class="caps ck-then">{S.journey.orInstead}</span><Md text={b.title} /><span class="num">{line(b)}</span></span></a>
                  {/each}
                </div>
              </details>
            </li>
          {/if}
        {/each}
      </ol>
    </section>
  {:else}
    <div class="wrap">
      <EmptyState
        glyph={S.empty.plans.glyph}
        title={S.empty.plans.title}
        body={S.empty.plans.body}
        actionLabel={S.empty.plans.action}
        onaction={() => editStop()}
      />
    </div>
  {/if}

  <div class="jbody">
    {#if real.length && tiles.length}
      <section class="wrap jsec" id="stats" aria-labelledby="jstats-h">
        <h2 id="jstats-h" class="caps jlabel">{S.info.tripStatistics}</h2>
        <div class="jstats">
          {#each tiles as t (t.label)}
            <div class="jstat">
              <span class="caps jst-l">{t.label}</span>
              <span class="num jst-v {t.tone}">{t.value}</span>
            </div>
          {/each}
        </div>
        <a class="jmoney" href="#/trip/{id}/pocket/money">{S.journey.money}<Icon name="chevron-right" size={16} /></a>
      </section>
    {/if}

    {#if editing}
      <section class="wrap jsec jedit">
        <button class="addbtn" onclick={() => editStop()}>{S.edit.add('a stop')}</button>
        <button class="addbtn" onclick={addDay}>{S.edit.add('a day')}</button>
        <div class="card jrb">
          <h3>{S.journey.runbooks} <span class="jrb-sub">· {S.journey.runbooksSub}</span></h3>
          <p class="muted">{S.journey.runbooksHint}</p>
          <ul class="jrb-list">
            {#each runbooks as r (r.id)}
              <li>
                <span class="jrb-t"><Md text={r.title} /> <span class="small">· {S.journey.steps(r.steps.length)}</span></span>
                <button class="iconbtn" onclick={() => editRunbook(r)} aria-label={S.forms.editTitle(mdliteToText(r.title).toLowerCase())}><Icon name="edit" size={16} /></button>
              </li>
            {/each}
          </ul>
          <button class="btn wfull" onclick={() => editRunbook()}>{S.edit.add('a runbook')}</button>
        </div>
      </section>
    {/if}
  </div>
</main>

{#if sheet}
  <EditSheet spec={sheet.spec} entity={sheet.entity} onsave={sheet.save} ondelete={sheet.del} onclose={() => (sheet = null)} />
{/if}

<style>
  .journey {
    position: relative;
  }
  .jhead {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 50px;
    padding-top: 4px;
  }
  .jtitles {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .jtitle {
    margin: 0;
    font-size: var(--fs-screen-title);
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.03em;
  }
  .jsub {
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .jnow {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 12px;
    border-radius: var(--radius-pill);
    font-size: var(--fs-chip);
    font-weight: 600;
    color: var(--sunrise);
    background: color-mix(in srgb, var(--sunrise-fill) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--sunrise) 38%, transparent);
  }
  .jnow i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--sunrise-fill);
    box-shadow: 0 0 8px var(--sunrise-fill);
  }
  .jback {
    flex-shrink: 0;
    padding: 0 14px;
    font-size: var(--fs-caption);
  }
  .jsec {
    scroll-margin-top: 12px;
  }
  /* the route check's sheet runs on behind everything below it */
  .jbody {
    max-width: 480px;
    margin: 0 auto;
    padding-bottom: 12px;
    background: var(--sky-2);
  }
  .jlabel {
    margin: 0;
    padding: 20px 4px 10px;
    color: var(--ink-2);
  }
  .jstats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .jstat {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius-inner);
    box-shadow: var(--shadow-card);
  }
  .jst-l {
    color: var(--faint);
    letter-spacing: 0.1em;
  }
  .jst-v {
    font-size: var(--fs-code-lg);
    font-weight: 500;
    line-height: 1.1;
  }
  .jst-v.sun {
    color: var(--sunrise);
  }
  .jst-v.lilac {
    color: var(--lilac);
  }
  .jst-v.ok {
    color: var(--ok);
  }
  .jmoney {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 44px;
    margin-top: 6px;
    padding: 0 4px;
    font-size: var(--fs-caption);
    font-weight: 600;
    color: var(--sunrise);
  }
  .jedit {
    padding-top: 16px;
  }
  .jrb h3 {
    margin: 0 0 6px;
  }
  .jrb-sub {
    text-transform: none;
    letter-spacing: 0;
    color: var(--faint);
    font-weight: 500;
  }
  .jrb-list {
    margin: 8px 0 12px;
    padding: 0;
    list-style: none;
  }
  .jrb-list li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    border-bottom: 1px dashed var(--line);
  }
  .jrb-list li:last-child {
    border-bottom: none;
  }
  .jrb-t {
    flex: 1;
    min-width: 0;
    font-size: var(--fs-label);
  }

  /* ---------- replay ---------- */
  .replay {
    position: relative;
  }
  /* ---------- the map ---------- */
  .rp-map {
    position: relative;
    aspect-ratio: 412 / 280;
    max-width: 480px;
    margin: 0 auto;
  }
  .rp-map::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: var(--dot-grid);
    background-size: 22px 22px;
    -webkit-mask-image: radial-gradient(ellipse 60% 62% at 52% 50%, #000 30%, transparent 82%);
    mask-image: radial-gradient(ellipse 60% 62% at 52% 50%, #000 30%, transparent 82%);
  }
  .rp-map :global(.tmap) {
    position: absolute;
    inset: 0;
  }

  /* ---------- the controls ---------- */
  .rp-ctl {
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 480px;
    margin: 4px auto 0;
    padding: 0 var(--gutter);
  }
  .rp-play {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: var(--radius-pill);
    color: var(--on-sunrise);
    background: var(--sunrise-fill);
    border: none;
    box-shadow: var(--glow-sunrise);
  }
  .rp-play :global(.fillicon) {
    fill: currentColor;
  }
  .rp-when {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .rp-wl {
    font-size: var(--fs-chip);
    /* the number face's narrowest width: "Tue 15 Dec · day 25 of 37" whole
       on a 384 px phone (Run 3b) */
    font-stretch: 75%;
    color: var(--ink-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rp-wh {
    font-size: var(--fs-label);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rp-ctl .iconbtn:disabled {
    opacity: 0.4;
  }

  /* ---------- the scrubber ---------- */
  .rp-scrub {
    position: relative;
    max-width: 480px;
    margin: 8px auto 0;
    /* the playhead is a track-wide box moved by transform: past mid-trip it
       reached ~220 px beyond the screen and widened the whole page (Journey
       panned sideways; in the emulator the nav bar left the screen). The
       knob itself never leaves the scrubber's padding. (Run 3b) */
    overflow-x: clip;
    padding: 0 24px;
    height: 64px;
  }
  .rp-track {
    position: absolute;
    left: 24px;
    right: 24px;
    top: 0;
    height: 64px;
  }
  .bar {
    position: absolute;
    top: 10px;
    height: 14px;
    border-radius: 3px;
    border-left: 1px solid var(--sky);
    border-right: 1px solid var(--sky);
    background: color-mix(in srgb, var(--route-future) 28%, transparent);
  }
  .bar.move {
    top: 15px;
    height: 4px;
  }
  .bar.past {
    background: var(--route-lit);
    opacity: 0.85;
  }
  .bar.cur {
    background: linear-gradient(90deg, var(--route-lit), var(--route-today));
    box-shadow: 0 0 14px color-mix(in srgb, var(--route-today) 75%, transparent);
  }
  /* the visa window: its track, the part lived (::before, --lit wide) and
     the hard deadline at its far end (::after — the window ends on it) */
  .vbar {
    position: absolute;
    top: 50px;
    height: 5px;
    border-radius: 3px;
    background: var(--line);
  }
  .vbar::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: var(--lit);
    border-radius: 3px;
    background: linear-gradient(90deg, var(--sunrise-fill), var(--opal-2));
    box-shadow: 0 0 10px color-mix(in srgb, var(--opal-2) 60%, transparent);
  }
  .vbar.crit::before {
    background: var(--crit);
  }
  .vbar::after {
    content: '';
    position: absolute;
    right: -1px;
    top: -4px;
    width: 2px;
    height: 13px;
    border-radius: 1px;
    opacity: var(--tick);
    background: var(--warn-ink);
    box-shadow: 0 0 8px color-mix(in srgb, var(--warn) 80%, transparent);
  }
  /* the playhead: one wrapper the width of the track, moved by transform only */
  .headwrap {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .glow {
    position: absolute;
    left: -1px;
    top: 2px;
    width: 2px;
    height: 58px;
    background: linear-gradient(180deg, transparent, var(--sunrise-fill) 30%, var(--sunrise-fill) 70%, transparent);
    box-shadow: 0 0 10px color-mix(in srgb, var(--sunrise-fill) 70%, transparent);
  }
  .knob {
    position: absolute;
    left: -13px;
    top: 4px;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--sunrise-fill);
    border: 3px solid var(--sky);
    box-shadow: 0 0 18px color-mix(in srgb, var(--sunrise-fill) 80%, transparent);
  }
  .rp-range {
    position: absolute;
    left: 16px;
    right: 16px;
    top: -6px;
    width: calc(100% - 32px);
    height: 44px;
    margin: 0;
    padding: 0;
    opacity: 0;
    cursor: grab;
    min-height: 0;
  }
  .rp-range:focus-visible + .rp-marks {
    outline: 2px solid var(--sunrise);
    outline-offset: 4px;
  }
  .rp-marks {
    position: absolute;
    left: 24px;
    right: 24px;
    top: 30px;
    height: 14px;
    font-size: var(--fs-caps);
    color: var(--faint);
    pointer-events: none;
  }
  .rp-marks span {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    white-space: nowrap;
    /* the narrowest width the number face has, so the tens and the last day
       ("21 Dec", "27 Dec") keep a gap between them on a 412 px phone */
    font-stretch: 75%;
  }
  .rp-marks .first {
    left: 0;
    transform: none;
  }
  .rp-marks .last {
    right: 0;
    transform: none;
  }
  .rp-marks .now {
    color: var(--sunrise);
    font-weight: 600;
  }

  /* ---------- the visa ---------- */
  .rp-visa {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    max-width: 480px;
    margin: 0 auto;
    padding: 0 24px;
    color: var(--ink);
  }
  .vname {
    color: var(--ink-2);
  }
  .vval {
    font-size: var(--fs-chip);
    font-weight: 600;
  }
  .vexit {
    margin-left: auto;
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--warn-ink);
  }
  .rp-visa.crit .vval,
  .rp-visa.crit .vexit {
    color: var(--crit-ink);
  }

  /* ---------- the route check ---------- */
  .check {
    position: relative;
    max-width: 480px;
    margin: 18px auto 0;
    padding: 6px var(--gutter) 8px;
    border-radius: var(--radius-card) var(--radius-card) 0 0;
    background: var(--sky-2);
    border-top: 1px solid var(--line);
    box-shadow: 0 -24px 60px -12px rgba(0, 0, 0, 0.85);
  }
  .check::before {
    content: '';
    position: absolute;
    left: 28px;
    right: 28px;
    top: -1px;
    height: 1px;
    background: var(--horizon-line);
  }
  .ck-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
    min-height: 44px;
    padding-top: 8px;
  }
  .ck-head h2 {
    flex: 1;
    margin: 0;
    font-size: var(--fs-card-title);
    font-weight: 600;
  }
  .ck-sum {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .ck-list {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
  }
  .ck-row {
    display: flex;
    align-items: stretch;
    border-radius: 16px;
  }
  .ck-main {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 52px;
    padding-right: 4px;
    color: var(--ink);
    list-style: none;
    cursor: pointer;
  }
  .ck-leg .ck-main {
    min-height: 44px;
  }
  /* a move's row is its <details>: it takes the row and no more, so a long
     move ("EY 608 + EY 888 + CA 8683 → …") ends in an ellipsis, not off
     the screen with its chip */
  .ck-leg > details {
    flex: 1;
    min-width: 0;
  }
  .ck-main::-webkit-details-marker {
    display: none;
  }
  .ck-main > :global(.hicon) {
    color: var(--faint);
  }
  .ck-stop.tonight {
    margin: 0 -8px;
    padding: 0 8px;
    background: color-mix(in srgb, var(--sunrise-fill) 6%, transparent);
  }

  /* ---------- the rail ---------- */
  .rail {
    position: relative;
    flex-shrink: 0;
    align-self: stretch;
    width: 28px;
  }
  /* the two halves of the rail: u = above the node, d = below; l lit, f ahead */
  .rail::before,
  .rail::after {
    content: '';
    position: absolute;
    left: 13px;
    width: 0;
  }
  .rail::before {
    top: 0;
    bottom: 50%;
  }
  .rail::after {
    top: 50%;
    bottom: 0;
  }
  .rail.ul::before,
  .rail.dl::after {
    border-left: 2px solid var(--route-lit);
    box-shadow: 0 0 6px color-mix(in srgb, var(--route-lit) 50%, transparent);
  }
  .rail.uf::before,
  .rail.df::after {
    border-left: 2px dotted color-mix(in srgb, var(--route-future) 55%, transparent);
  }
  .node {
    position: absolute;
    left: 14px;
    top: 50%;
    width: 12px;
    height: 12px;
    margin: -6px 0 0 -6px;
    border-radius: 50%;
    background: var(--route-future);
  }
  .node.diamond {
    width: 8px;
    height: 8px;
    margin: -4px 0 0 -4px;
    border-radius: 1px;
    transform: rotate(45deg);
  }
  .node.t-ok {
    background: var(--ok);
    box-shadow: 0 0 10px color-mix(in srgb, var(--ok) 70%, transparent);
  }
  .node.t-warn {
    background: var(--warn);
    box-shadow: 0 0 8px color-mix(in srgb, var(--warn) 70%, transparent);
  }
  .node.t-crit {
    background: var(--crit);
    box-shadow: 0 0 10px color-mix(in srgb, var(--crit) 80%, transparent);
  }
  .node.sun {
    width: 14px;
    height: 14px;
    margin: -7px 0 0 -7px;
    background: var(--sunrise-fill);
    box-shadow: 0 0 12px color-mix(in srgb, var(--sunrise-fill) 95%, transparent);
  }
  .tonight .node {
    box-shadow:
      0 0 0 2px var(--sky-2),
      0 0 0 4px currentColor;
  }
  .tonight .node.t-ok {
    color: var(--ok);
  }
  .tonight .node.t-warn {
    color: var(--warn);
  }
  .tonight .node.t-crit {
    color: var(--crit);
  }
  /* the pulse Relay holds on amber and red (its keyframes run only in a sweep) */
  .node::after {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: inherit;
    border: 2px solid currentColor;
    opacity: 0;
  }
  .node.t-warn::after {
    color: var(--warn);
  }
  .node.t-crit::after {
    color: var(--crit);
  }

  /* ---------- the words ---------- */
  .ck-txt {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .ck-name {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
  }
  /* a stop's name and a move's legs wrap at their words rather than being
     cut inside one ("Kunyu Academy — Yan…") — Run 3b */
  .ck-nm {
    font-size: var(--fs-row);
    font-weight: 600;
  }
  .tonight .ck-nm {
    font-weight: 700;
  }
  .ck-name .caps {
    flex-shrink: 0;
    color: var(--opal-1);
  }
  .ck-sub {
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .ck-move {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .ck-move :global(.hicon) {
    flex-shrink: 0;
  }
  .ck-move .num {
    flex-shrink: 0;
    font-size: var(--fs-chip);
    white-space: nowrap;
  }
  .ck-move b {
    flex-shrink: 0;
    color: var(--sunrise);
  }
  .today .ck-move {
    color: var(--ink);
  }
  .ck-lbl {
    min-width: 0;
  }
  .ck-row .chip {
    flex-shrink: 0;
    min-height: 24px;
    padding: 0 9px;
  }

  /* ---------- a move, opened ---------- */
  details[open] .ck-main {
    color: var(--ink);
  }
  .ck-legs {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0 0 10px 36px;
    padding: 8px 10px;
    border-radius: var(--radius-inner);
    background: var(--card);
    border: 1px solid var(--line);
  }
  .ck-lg {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 6px 4px;
    border-radius: 12px;
    color: var(--ink);
  }
  .ck-lg:active {
    background: var(--card-2);
  }
  .lg-t {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: var(--fs-label);
    font-weight: 600;
  }
  .lg-t .num {
    font-size: var(--fs-chip);
    font-weight: 500;
    color: var(--ink-2);
  }
  .ck-lg.alt .lg-t {
    font-weight: 500;
    color: var(--ink-2);
  }
  .ck-then {
    color: var(--faint);
  }
  .ck-then {
    padding-left: 4px;
  }
  .ck-gap {
    margin: 4px;
    font-size: var(--fs-caption);
    color: var(--warn-ink);
  }

  /* ---------- RELAY — the sweep, once, on open ---------- */
  .ck-row:global(.relay) {
    animation: ck-row var(--rt) var(--ease-out) var(--rd) both;
  }
  .ck-row:global(.relay) .node.rl {
    animation: ck-pop 360ms var(--ease-out) var(--rd) both;
  }
  .ck-row:global(.relay) .chip.rl {
    animation: ck-in 240ms var(--ease-out) var(--rd) both;
  }
  .ck-row:global(.relay.t-warn) .node.rl::after,
  .ck-row:global(.relay.t-crit) .node.rl::after {
    animation: ck-hold calc(var(--rt) / 2) ease-out var(--rd) 2 both;
  }
  .ck-leg:global(.relay) .node.diamond.rl {
    animation-name: ck-pop-d;
  }
  @keyframes ck-row {
    from {
      opacity: 0.45;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes ck-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes ck-pop {
    from {
      transform: scale(0.3);
    }
    to {
      transform: none;
    }
  }
  @keyframes ck-pop-d {
    from {
      transform: rotate(45deg) scale(0.3);
    }
    to {
      transform: rotate(45deg);
    }
  }
  @keyframes ck-hold {
    from {
      opacity: 0.9;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(2.6);
    }
  }
</style>
