<script lang="ts">
  /* NOW, HOME (f-now) — the map, one sentence, five tiles.

     THE MAP is the trip as a constellation from the stops' real coordinates
     (lib/map): the road so far inked, today's leg Flowing with its booking
     on a chip, you pinging where you are, tonight's star ringed in opal.
     THE SENTENCE is the Concierge (logic/concierge.ts): what to do next, in
     plain words, and a door to the day. THE TILES answer one question each
     — NEXT (the one opal card: a countdown and the sun on its arc), TONIGHT,
     the VISA, a DRIVER CARD, TO DO — and a tile with nothing to say is not
     drawn. There is no NOW tile: the sentence is the now. */
  import type { Booking, ComplianceCounter, ShowCard, Stop } from '../../model/types';
  import type { NowCtx } from './model';
  import { buildConstellation, chipSpot, type Leg } from '../../logic/constellation';
  import { concierge, sentenceText } from '../../logic/concierge';
  import { arcPoint, arcProgress, compactCountdown } from '../../logic/glance';
  import { bookingFixedPoints } from '../../logic/commitment';
  import { chipOf, legLabel, segmentOfStep } from '../../logic/metroline';
  import { driverChips, visaPreview } from '../../logic/pocket';
  import { counterState } from '../../logic/counters';
  import { todoNext } from '../../logic/todo';
  import { inkKey } from '../../logic/motion';
  import { addDays, fmtDow, parseYmd } from '../../logic/dates';
  import { daysUntilStart, tripDays } from '../../logic/phase';
  import { mdliteToText } from '../../logic/mdlite';
  import { splitBody } from '../../logic/timeline';
  import { isSnowCode, weatherGlyph, weatherTemps } from '../../logic/weather';
  import { appState } from '../../state/appState.svelte';
  import { minute } from '../../state/minute.svelte';
  import { S } from '../../i18n/strings';
  import AppBar from '../horizon/AppBar.svelte';
  import Icon from '../horizon/Icon.svelte';
  import TripMap from '../../map/TripMap.svelte';
  import Snowfall from '../ui/Snowfall.svelte';
  import PhotoImg from '../ui/PhotoImg.svelte';
  import Md from '../ui/Md.svelte';
  import { offscreen } from '../../motion/offscreen';
  import { revealFocus } from '../ui/revealFocus';

  let {
    ctx,
    counters,
    stops,
    bookings,
    showCards,
    ondriver,
  }: {
    ctx: NowCtx;
    counters: ComplianceCounter[];
    stops: Stop[];
    bookings: Booking[];
    showCards: ShowCard[];
    ondriver: (cardId: string) => void;
  } = $props();

  const id = $derived(encodeURIComponent(ctx.trip.id));
  const dayHref = $derived(`#/trip/${id}/now/day`);
  const W = 412;
  const H = 470;

  /* ---------- the map ---------- */
  const c = $derived(
    buildConstellation(stops, ctx.now, { width: W, height: H, pad: 30, padTop: 96, padBottom: 62 }, { arrived: ctx.line?.arrived }),
  );
  const ink = $derived(c ? inkKey(ctx.trip.id, ctx.now, c.legs.filter((l) => l.state === 'done').length) : null);
  /* today's leg carries its booking on a chip: the timed commitment of the day */
  const todayLeg = $derived(c?.legs.find((l) => l.live && l.state === 'today') ?? null);
  const legNext = $derived(ctx.next?.kind === 'leg' && ctx.next.date === ctx.now ? ctx.next : null);
  const chipText = $derived(legNext ? S.glance.legChip(legLabel(legNext.booking), legNext.time ?? '') : '');
  /* beside the leg, never over a name (≈7.8 px a character at 12 px mono,
     plus the icon and the padding; below the header, above the legend) */
  const chipAt = $derived(c && todayLeg && legNext ? chipSpot(c, todayLeg, 42 + 7.8 * chipText.length, 32, 70, 50) : null);
  const snowing = $derived(!!ctx.today && isSnowCode(ctx.today.code));
  /* COMET — a tap on the map flies the leg you are on (or the next) once:
     where it goes, at a glance. One at a time; it lands and is gone. */
  let comet = $state<Leg | null>(null);
  function fly(): void {
    const leg = c?.legs.find((l) => l.live);
    if (!leg) return;
    comet = null;
    queueMicrotask(() => (comet = leg));
  }

  /* ---------- the sentence ---------- */
  const dueToday = $derived(
    ctx.plan.days[0]?.date === ctx.now ? ctx.plan.days[0].items.find((i) => i.kind === 'task' && !i.done)?.task?.title : null,
  );
  const say = $derived(
    concierge({
      phase: ctx.phase,
      now: ctx.now,
      dayTag: ctx.dayTag,
      tripDays: tripDays(ctx.trip),
      stops: stops.filter((s) => s.kind === 'stop').length,
      daysToStart: daysUntilStart(ctx.trip, ctx.now),
      dayTitle: ctx.day?.title,
      line: ctx.line,
      steps: ctx.runbook?.steps,
      current: ctx.progress.current,
      tonight: ctx.tonight,
      next: ctx.next,
      dueToday,
    }),
  );

  /* ---------- NEXT ---------- */
  const nb = $derived(ctx.next?.booking ?? null);
  /* a previewed day has no "now" inside it: it counts from its own 00:00 */
  const moment = $derived.by(() => {
    if (ctx.clock !== null) return new Date(minute.t);
    const d = parseYmd(ctx.now);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const countdown = $derived(ctx.next ? (compactCountdown(ctx.next.date, ctx.next.time, moment) ?? S.glance.today) : '');
  const sun = $derived(
    arcPoint(ctx.next && ctx.next.date === ctx.now ? arcProgress(ctx.next.time, ctx.clock, bookingFixedPoints(bookings, ctx.now)) : 0, 32, 32, 26),
  );
  const route = $derived.by(() => {
    if (!nb) return '';
    if (nb.kind === 'flight') return `${nb.from.code} ${nb.dep} → ${nb.to.code} ${nb.arr}`;
    if (nb.kind === 'hotel') return nb.city;
    const f = 'from' in nb ? nb.from?.name : '';
    const t = 'to' in nb ? nb.to?.name : '';
    return f && t ? `${mdliteToText(f)} → ${mdliteToText(t)}` : (ctx.next?.time ?? '');
  });

  /* LEAVE BY (logic/leaveby.ts) — on the departure's own day, when to go:
     departure − buffer − the taxi from last night's bed. Loaded after the
     first paint: it reads the day-route estimate, which the start-up chunk
     has no room for. No position at either end, no line. */
  let lb = $state<typeof import('../../logic/leaveby') | null>(null);
  $effect(() => {
    void import('../../logic/leaveby').then((m) => (lb = m));
  });
  const leave = $derived.by(() => {
    if (!lb || !nb || (nb.kind !== 'flight' && nb.kind !== 'train') || nb.date !== ctx.now) return null;
    return lb.leaveByOf(nb, bookings);
  });

  /* ---------- TONIGHT ---------- */
  const bedWord = $derived(
    ctx.tonight
      ? {
          booked: [S.chip.booked, 'ok'],
          pending: [S.chip.pending, 'warn'],
          walkin: [S.chip.walkin, ''],
          transit: [S.today.nightInTransit, ''],
          missing: [S.today.noBooking, 'crit'],
        }[ctx.tonight.state]
      : null,
  );

  /* ---------- VISA ---------- */
  const pinned = $derived(counters.find((k) => k.pinned));
  const visa = $derived(ctx.phase === 'after' ? null : visaPreview(pinned, ctx.now));
  /* the day you cross in: the count starts tomorrow, and the tile says so */
  const entryDay = $derived(!!pinned && counterState(pinned, ctx.now).phase === 'entryDay');

  /* ---------- DRIVER CARD: where the current step goes, else the first of
     today's places that has a card — and no tile on a day that names none.
     (Topping up from the whole trip, as the Pocket's chip row does, would put
     a school in Shandong on a Zhangjiajie day.) ---------- */
  const driver = $derived.by((): ShowCard | null => {
    if (ctx.phase === 'after') return null;
    const i = segmentOfStep(ctx.line, ctx.progress.current);
    const seg = i >= 0 ? ctx.line!.segments[i]! : null;
    const st = seg ? ctx.line!.stations[seg.kind === 'transfer' ? i + 1 : i] : null;
    const byStep = st?.card ? showCards.find((x) => x.id === st.card) : undefined;
    const ids = ctx.day?.placeIds ?? [];
    return byStep ?? driverChips(showCards.filter((x) => ids.includes(x.id)), ids, 1)[0] ?? null;
  });

  /* ---------- TO DO ---------- */
  const todo = $derived(todoNext(ctx.plan));
  const dueWord = (d: string | null): string =>
    !d ? '' : d === ctx.now ? S.glance.today : d === addDays(ctx.now, 1) ? S.glance.tomorrow : fmtDow(d);
</script>

<div class="nowhome">
  <div class="nh-map">
    <span class="nh-dots" aria-hidden="true"></span>
    {#if c}
      <TripMap {c} grid {ink} {comet} oncometend={() => (comet = null)} ontap={fly} />
      {#if chipAt && legNext}
        {@const b = legNext.booking}
        <a
          class="nh-chip"
          href={dayHref}
          style="left:{(chipAt.x / W) * 100}%;top:{(chipAt.y / H) * 100}%"
          aria-label={S.glance.legAria(legLabel(b))}
        >
          <Icon name={b.kind === 'flight' ? 'plane' : b.kind === 'train' ? 'train' : 'car'} size={14} stroke={2} />
          <span class="num">{chipText}</span>
        </a>
      {/if}
      {#if c.here && ctx.stop}
        <a
          class="nh-city"
          href="#/trip/{id}/journey/{encodeURIComponent(ctx.stop.id)}"
          style="left:{(c.here.x / W) * 100}%;top:{(c.here.y / H) * 100}%"
          aria-label={S.glance.city(c.here.short)}
        ></a>
      {/if}
      <div class="nh-legend" aria-hidden="true">
        <span><i class="lg been"></i>{S.map.been}</span>
        <span><i class="lg today"></i>{S.map.today}</span>
        <span><i class="lg ahead"></i>{S.map.ahead}</span>
      </div>
    {:else}
      <svg class="nh-ridges" viewBox="0 0 412 140" preserveAspectRatio="none" aria-hidden="true">
        <circle class="r-sun" cx="300" cy="84" r="20" />
        <path class="r1" d="M0 90 L60 60 L110 80 L170 44 L230 76 L290 52 L412 82 L412 140 L0 140 Z" />
        <path class="r3" d="M0 112 L80 90 L150 108 L230 84 L300 110 L412 96 L412 140 L0 140 Z" />
      </svg>
    {/if}
    {#if snowing}<Snowfall />{/if}
    <div class="nh-bar">
      <AppBar
        trip={ctx.trip}
        {counters}
        now={ctx.now}
        home={{
          title: fmtDow(ctx.now),
          sub: ctx.clock !== null
            ? `${ctx.dayTag} · ${String(Math.floor(ctx.clock / 60)).padStart(2, '0')}:${String(ctx.clock % 60).padStart(2, '0')}`
            : ctx.dayTag,
        }}
      >
        {#snippet extra()}
          {#if ctx.today}
            · <Icon name={weatherGlyph(ctx.today.code)} size={14} /><span class="num">{weatherTemps(ctx.today)}</span>
          {/if}
        {/snippet}
      </AppBar>
    </div>
  </div>

  <section class="nh-sheet" aria-label={S.glance.label}>
    {#if appState.offline}<div class="offchip"><Icon name="cloud" size={14} />{S.glance.offline}</div>{/if}

    <a class="sentence {say.tone}" href={dayHref} aria-label={S.glance.sentenceAria(say.caps, sentenceText(say))}>
      <span class="se-sun" aria-hidden="true" use:offscreen></span>
      <span class="se-body">
        <span class="caps se-caps">{say.caps}</span>
        <span class="se-text"
          >{#each say.parts as p, i (i)}{#if p.em === 'time'}<span class="num se-time">{p.t}</span
              >{:else if p.em}<strong class="se-{p.em}">{p.t}</strong>{:else}{p.t}{/if}{/each}</span
        >
      </span>
      <Icon name="chevron-right" size={20} />
    </a>

    <div class="rail" use:revealFocus>
      {#if ctx.next && nb}
        <a
          class="tile t-next nexthero opal-edge"
          use:offscreen
          href="#/trip/{id}/pocket/{encodeURIComponent(nb.id)}"
          aria-label={`${S.glance.nextAria(mdliteToText(nb.title), countdown)}${leave ? ` ${S.leaveBy.tile(leave.time)}.` : ''}`}
        >
          <span class="tn-head">
            <svg class="tn-arc" viewBox="0 0 64 36" aria-hidden="true">
              <path class="arc-track" d="M6 32 A26 26 0 0 1 58 32" />
              {#if sun.x > 6.5}<path class="arc-lit" d="M6 32 A26 26 0 0 1 {sun.x} {sun.y}" />{/if}
              <path class="arc-line" d="M0 33.5H64" />
              <circle class="arc-end" cx="58" cy="32" r="2.5" />
              <circle class="arc-sun" cx={sun.x} cy={sun.y} r="4" />
            </svg>
            <span class="tn-what">
              <span class="caps t-caps sun">{ctx.next.kind === 'checkin' ? S.glance.checkIn : S.glance.next}</span>
              <span class="tn-label">{nb.kind === 'hotel' ? mdliteToText(nb.title) : legLabel(nb)}</span>
            </span>
          </span>
          <span class="tn-count num">{countdown}</span>
          <span class="tn-foot">
            <span class="t-line">{route}</span>
            {#if leave}<span class="tn-leave num">{S.leaveBy.tile(leave.time)}</span>{/if}
            <span class="t-state {chipOf(nb.status).cls}">{chipOf(nb.status).label}</span>
          </span>
        </a>
      {/if}

      {#if ctx.tonight && bedWord}
        <a
          class="tile t-tonight"
          href={ctx.stop ? `#/trip/${id}/journey/${encodeURIComponent(ctx.stop.id)}` : `#/trip/${id}/pocket/${encodeURIComponent(ctx.aboard?.id ?? '')}`}
          aria-label={S.glance.tonightAria(mdliteToText(ctx.tonight.name), bedWord[0]!)}
        >
          {#if ctx.stop?.photoDocId}<span class="tt-photo" aria-hidden="true"><PhotoImg docId={ctx.stop.photoDocId} alt="" /></span>{/if}
          <span class="caps t-caps">{S.glance.tonight}</span>
          <span class="tt-foot">
            <span class="tt-bed"><Md text={ctx.tonight.name} /></span>
            <span class="t-state {bedWord[1]}">{bedWord[0]}</span>
          </span>
        </a>
      {/if}

      {#if visa}
        {@const day = visa.value.split('/')[0]}
        <a
          class="tile t-visa visacard {visa.tone}"
          href="#/trip/{id}/pocket/visa"
          aria-label={S.glance.visaAria(visa.name, visa.value.replace('/', ' of '), visa.line)}
        >
          <span class="caps t-caps">{visa.name}</span>
          <span class="tv-ring">
            <svg viewBox="0 0 60 60" aria-hidden="true">
              <circle class="ring-track" cx="30" cy="30" r="24" />
              <circle class="ring-lit" cx="30" cy="30" r="24" stroke-dasharray="{(visa.pct / 100) * 150.8} 150.8" />
            </svg>
            <span class="tv-day num">{day}</span>
          </span>
          <span class="tv-foot">
            <span class="t-line">{S.glance.ofDays(Number(visa.value.split('/')[1]))}</span>
            <span class="tv-exit">{entryDay ? S.today.entryDay : visa.line}</span>
          </span>
        </a>
      {/if}

      {#if driver}
        <button class="tile t-driver" onclick={() => ondriver(driver.id)} aria-label={S.glance.driverAria(driver.meaning)}>
          <span class="caps t-caps">{S.glance.driver}</span>
          <span class="td-zh" lang="zh">{driver.native}</span>
          <span class="t-line">{splitBody(driver.meaning).title}</span>
        </button>
      {/if}

      {#if todo.item}
        {@const it = todo.item}
        {@const title = it.task?.title ?? it.alarm?.title ?? it.booking?.title ?? ''}
        {@const due = it.kind === 'booking' ? S.chip.pending : S.glance.due(dueWord(it.date))}
        <a class="tile t-todo" href="#/trip/{id}/now/todo" aria-label={S.glance.todoAria(mdliteToText(title), due)}>
          <span class="caps t-caps">{S.glance.todo}</span>
          <span class="tt-what"><Md text={splitBody(title).title} /></span>
          <span class="tt-due {it.kind === 'booking' ? 'warn' : ''}">{it.alarm ? `${dueWord(it.date)} · ${it.alarm.time}` : due}</span>
          {#if todo.late}<span class="t-line late">{S.glance.late(todo.late)}</span>{/if}
        </a>
      {/if}
    </div>
  </section>
</div>

<style>
  /* the sheet runs down behind the nav to the foot of the screen (f-now) */
  .nowhome {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    max-width: 480px;
    margin: 0 auto calc(-1 * (var(--nav-h) + env(safe-area-inset-bottom) + 18px));
  }
  /* ---------- the map ---------- */
  .nh-map {
    position: relative;
    width: 100%;
    /* no height cap: the chip and the city target are placed in the map's own
       coordinates, which only hold while the box keeps the map's ratio */
    aspect-ratio: 412 / 470;
    overflow: hidden;
  }
  .nh-dots {
    position: absolute;
    inset: 40px 0 0;
    background-image: var(--dot-grid);
    background-size: 22px 22px;
    -webkit-mask-image: radial-gradient(ellipse 62% 58% at 55% 48%, #000 30%, transparent 80%);
    mask-image: radial-gradient(ellipse 62% 58% at 55% 48%, #000 30%, transparent 80%);
  }
  .nh-map :global(.tmap) {
    position: absolute;
    inset: 0;
  }
  .nh-bar {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
  }
  .nh-chip {
    position: absolute;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 11px 0 9px;
    border-radius: var(--radius-pill);
    color: var(--ink);
    background: color-mix(in srgb, var(--sky-2) 92%, transparent);
    border: 1px solid color-mix(in srgb, var(--route-today) 55%, transparent);
    box-shadow: 0 0 20px -4px color-mix(in srgb, var(--route-today) 60%, transparent);
    font-size: var(--fs-chip);
    font-weight: 500;
    white-space: nowrap;
  }
  /* drawn 32 px tall, as the board draws it; the thumb gets 44 */
  .nh-chip::after {
    content: '';
    position: absolute;
    inset: -6px 0;
  }
  .nh-chip :global(.hicon) {
    color: var(--sunrise);
  }
  .nh-city {
    position: absolute;
    width: 44px;
    height: 44px;
    margin: -22px 0 0 -22px;
    border-radius: 50%;
  }
  .nh-legend {
    position: absolute;
    left: var(--gutter);
    bottom: 34px;
    display: flex;
    gap: 14px;
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--faint);
  }
  .nh-legend span {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .lg {
    width: 18px;
    height: 0;
  }
  .lg.been {
    height: 3px;
    border-radius: 2px;
    background: linear-gradient(90deg, var(--opal-1), var(--route-lit));
  }
  .lg.today {
    border-top: 2.5px dashed var(--route-today);
  }
  .lg.ahead {
    border-top: 2.5px dotted var(--route-future);
  }
  .nh-ridges {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 40px;
    width: 100%;
    height: 140px;
  }
  .r-sun {
    fill: var(--sunrise-fill);
    opacity: 0.8;
  }
  .r1 {
    fill: var(--ridge-1);
  }
  .r3 {
    fill: var(--ridge-3);
    stroke: var(--ridge-edge);
  }

  /* ---------- the sheet ---------- */
  .nh-sheet {
    position: relative;
    flex: 1;
    margin-top: -28px;
    padding: 18px 0 calc(var(--nav-h) + env(safe-area-inset-bottom) + 24px);
    border-radius: var(--radius-photo) var(--radius-photo) 0 0;
    background: var(--sky-2);
    border-top: 1px solid var(--line);
    box-shadow: 0 -24px 60px -12px rgba(0, 0, 0, 0.85);
  }
  .nh-sheet::before {
    content: '';
    position: absolute;
    left: 28px;
    right: 28px;
    top: -1px;
    height: 1px;
    background: var(--horizon-line);
  }
  .nh-sheet .offchip {
    margin: 0 var(--gutter) 10px;
  }
  .sentence {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0 var(--gutter);
    padding: 12px 12px 12px 14px;
    border-radius: 22px;
    color: var(--ink);
    background: var(--card);
    border: 1px solid var(--line);
  }
  .sentence.warn {
    background: linear-gradient(180deg, var(--warn-soft), transparent 90%), var(--card);
    border-color: var(--warn-line);
    box-shadow: 0 0 30px -14px color-mix(in srgb, var(--warn) 70%, transparent);
  }
  .sentence.crit {
    background: linear-gradient(180deg, var(--crit-soft), transparent 90%), var(--card);
    border-color: var(--crit-line);
  }
  .sentence > :global(.hicon) {
    color: var(--ink-2);
  }
  .se-sun {
    flex-shrink: 0;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: radial-gradient(circle at 50% 36%, #ffd8b8 0%, var(--sunrise-fill) 55%, #ee7755 100%);
    box-shadow: 0 0 14px rgba(255, 159, 107, 0.75);
    animation: h-sun var(--duration-sun) ease-in-out infinite;
  }
  .se-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .se-caps {
    color: var(--sunrise);
  }
  .se-text {
    font-size: var(--fs-row);
    line-height: 1.4;
  }
  .se-warn {
    font-weight: 600;
    color: var(--warn-ink);
  }
  .se-crit {
    font-weight: 600;
    color: var(--crit-ink);
  }
  .se-time {
    font-size: var(--fs-label);
    font-weight: 500;
    color: var(--sunrise);
  }

  /* ---------- the tiles ---------- */
  /* 6 px of the rail above the tiles, so a focused tile's ring (3 px out)
     is not cut off by the rail's own scroll box */
  .rail {
    display: flex;
    gap: 10px;
    margin-top: 6px;
    padding: 6px var(--gutter) 6px;
    overflow-x: auto;
    /* a tile scrolled to by focus stops short of the edge, ring and all */
    scroll-padding-inline: var(--gutter);
    scroll-snap-type: x proximity;
    scrollbar-width: none;
    -webkit-mask-image: linear-gradient(90deg, #000 86%, transparent);
    mask-image: linear-gradient(90deg, #000 86%, transparent);
  }
  .tile {
    position: relative;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 6px;
    height: 152px;
    padding: 12px 14px;
    border-radius: var(--radius-tile);
    overflow: hidden;
    scroll-snap-align: start;
    text-align: left;
    color: var(--ink);
  }
  /* the one opal card keeps the global .opal-edge ground and border */
  .tile:not(.opal-edge) {
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
  }
  .t-caps {
    color: var(--ink-2);
  }
  .t-caps.sun {
    color: var(--sunrise);
  }
  .t-line {
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .t-state {
    font-size: var(--fs-chip);
    font-weight: 600;
    color: var(--ink-2);
  }
  .t-state.ok {
    color: var(--ok-ink);
  }
  .t-state.warn {
    color: var(--warn-ink);
  }
  .t-state.crit {
    color: var(--crit-ink);
  }
  .t-next {
    width: 184px;
    --opal-fill: var(--card);
  }
  .tn-head {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .tn-arc {
    width: 64px;
    height: 36px;
    flex-shrink: 0;
    overflow: visible;
  }
  .arc-track {
    fill: none;
    stroke: var(--line);
    stroke-width: 3;
    stroke-linecap: round;
  }
  .arc-lit {
    fill: none;
    stroke: var(--opal-2);
    stroke-width: 3;
    stroke-linecap: round;
  }
  .arc-line {
    stroke: var(--ridge-edge);
  }
  .arc-end {
    fill: var(--route-future);
  }
  .arc-sun {
    fill: var(--sunrise-fill);
    filter: drop-shadow(0 0 6px rgba(255, 159, 107, 0.9));
  }
  .tn-what {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .tn-label {
    font-size: var(--fs-caption);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tn-count {
    font-size: var(--fs-countdown);
    font-weight: 500;
    line-height: 1;
    letter-spacing: -0.02em;
    color: var(--sunrise);
    text-shadow: 0 0 18px rgba(255, 159, 107, 0.45);
  }
  .tn-foot,
  .tt-foot,
  .tv-foot {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .tn-leave {
    font-size: var(--fs-chip);
    font-weight: 600;
    line-height: 1.25;
    color: var(--sunrise);
  }
  .tn-foot .t-line {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .t-tonight {
    width: 132px;
  }
  .tt-photo {
    position: absolute;
    inset: 0;
  }
  .tt-photo :global(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  /* The scrim is measured, not guessed: at least 62 % night sky under the
     label (9–19 % of the tile's height) and the bed (from 44 %, three lines),
     80 % under the status word (80–91 %) — check-contrast.mjs holds the
     --photo-* inks to 4.5:1 there over a WHITE photo. The photo breathes in
     between. (The board's 18 % at 32 % → 35 % at 58 % left a three-line bed
     name on as little as 26 %.) */
  .tt-photo::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgba(11, 12, 22, 0.78) 0%,
      rgba(11, 12, 22, 0.62) 21%,
      rgba(11, 12, 22, 0.18) 32%,
      rgba(11, 12, 22, 0.62) 43%,
      rgba(11, 12, 22, 0.8) 79%,
      rgba(11, 12, 22, 0.94) 100%
    );
  }
  .t-tonight .t-caps,
  .tt-foot {
    position: relative;
  }
  .t-tonight:has(.tt-photo),
  .t-tonight:has(.tt-photo) .t-caps {
    color: var(--photo-ink);
  }
  .t-tonight:has(.tt-photo) .t-state.ok {
    color: var(--photo-ok);
  }
  .t-tonight:has(.tt-photo) .t-state.warn {
    color: var(--photo-warn);
  }
  .t-tonight:has(.tt-photo) .t-state.crit {
    color: var(--photo-crit);
  }
  .tt-bed {
    font-size: var(--fs-label);
    font-weight: 600;
    line-height: 1.25;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .t-visa {
    width: 118px;
  }
  .t-visa.warn {
    border-color: var(--warn-line);
  }
  .t-visa.crit {
    border-color: var(--crit-line);
    box-shadow: var(--glow-crit);
  }
  .tv-ring {
    position: relative;
    width: 58px;
    height: 58px;
  }
  .tv-ring svg {
    width: 58px;
    height: 58px;
    transform: rotate(-90deg);
  }
  .ring-track,
  .ring-lit {
    fill: none;
    stroke-width: 6;
  }
  .ring-track {
    stroke: var(--line);
  }
  .ring-lit {
    stroke: var(--opal-2);
    stroke-linecap: round;
  }
  .t-visa.crit .ring-lit {
    stroke: var(--crit);
  }
  .tv-day {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: var(--fs-card-title);
    font-weight: 600;
  }
  .tv-exit {
    font-size: var(--fs-chip);
    font-weight: 600;
  }
  .t-visa.crit .tv-exit {
    color: var(--crit-ink);
  }
  .t-driver {
    width: 140px;
    font: inherit;
  }
  .td-zh {
    font-family: var(--font-zh);
    font-size: var(--fs-code-lg);
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: 0.02em;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .t-driver .t-line {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .t-todo {
    width: 156px;
  }
  .tt-what {
    font-size: var(--fs-label);
    font-weight: 600;
    line-height: 1.25;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .tt-due {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    min-height: 26px;
    padding: 0 10px;
    border-radius: var(--radius-pill);
    font-size: var(--fs-chip);
    font-weight: 600;
    color: var(--lilac-ink);
    background: var(--lilac-soft);
    border: 1px solid var(--lilac-line);
  }
  .tt-due.warn {
    color: var(--warn-ink);
    background: var(--warn-soft);
    border-color: var(--warn-line);
  }
  .t-line.late {
    color: var(--warn-ink);
  }
</style>
