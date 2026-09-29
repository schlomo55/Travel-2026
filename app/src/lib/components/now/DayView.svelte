<script lang="ts">
  /* THE DAY (f-travelday · f-day) — the day on screen, stepped by ‹ › and
     the long jump (both drive the ?d= preview, so Settings, the address bar
     and these are one behaviour).

     A TRAVEL DAY is a metro line generated from the day's own bookings
     (logic/metroline.ts lays it out: last night's bed → every end of every
     leg → tonight's bed; a flight is an arc, a crossing no booking covers is
     a dashed transfer that points at its runbook step). The segment you are
     on FLOWS, one you finish with Done INKS itself once. Under it, the
     runbook — every step, tickable — and one FOCUS card for the step you are
     on, pinned above the nav, with its driver card and Done.

     ANY OTHER DAY is a day line: the plan's timed lines as stations, the free
     time between fixed points as a dashed block offering the stop's own
     researched options (logic/timeline.ts + options.ts; a pick is one row,
     data/picks.ts), the untimed lines, what you picked.

     Both end on the places the day goes to, tonight's bed with its real
     status, and the to-dos that fall on this day. */
  import type { Booking, DayDefault, DayPick, DayPlan, ISODate, ShowCard, Spot, Stop } from '../../model/types';
  import type { NowCtx } from './model';
  import { addDays, compareIso, fmtDow, fmtDowDay, fmtShort, localToday } from '../../logic/dates';
  import { currentStop, resolveDay } from '../../logic/day';
  import { focusOf, metroRows, runbookHeadline, segmentOfStep } from '../../logic/metroline';
  import { buildTimeline, currentIndex, freeBlocks, planFixedPoints } from '../../logic/timeline';
  import { bookingFixedPoints } from '../../logic/commitment';
  import { candidateFacts, candidatesOf, inTheDay, parseOption, rankCandidates, type RankedCandidate } from '../../logic/options';
  import { resolvePlaces } from '../../logic/places';
  import { noBookingStamp, statusStamp, transitNightStamp } from '../../logic/stamps';
  import { todoOn } from '../../logic/todo';
  import { mdliteToText } from '../../logic/mdlite';
  import { weatherAge, weatherGlyph, weatherTemps } from '../../logic/weather';
  import { runStepKey, setCheck } from '../../data/checks';
  import { pickOption, pickedIndex, picksOn, unpick } from '../../data/picks';
  import { appState } from '../../state/appState.svelte';
  import { router } from '../../state/router.svelte';
  import { copyText } from '../../state/toast.svelte';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';
  import Md from '../ui/Md.svelte';
  import MapButtons from '../ui/MapButtons.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import { offscreen } from '../../motion/offscreen';

  let {
    ctx,
    stops,
    dayPlans,
    dayDefaults,
    dayPicks,
    bookings,
    showCards,
    ondriver,
  }: {
    ctx: NowCtx;
    stops: Stop[];
    dayPlans: DayPlan[];
    dayDefaults: DayDefault[];
    dayPicks: DayPick[];
    bookings: Booking[];
    showCards: ShowCard[];
    ondriver: (cardId: string) => void;
  } = $props();

  const now = $derived(ctx.now);
  const trip = $derived(ctx.trip);
  const id = $derived(encodeURIComponent(trip.id));
  const rb = $derived(ctx.runbook);
  const day = $derived(ctx.day);
  const stop = $derived(ctx.stop);
  const pr = $derived(ctx.progress);
  const pass = (b: Booking): string => `#/trip/${id}/pocket/${encodeURIComponent(b.id)}`;
  const spotMap = (s: Spot) => ({ coord: s.coord, name: s.native ?? s.name, query: s.mapQuery, address: s.address, city: s.mapCity, url: s.mapUrl });

  /* ---------- stepping and the long jump ---------- */
  const short = fmtDowDay;
  const step = (d: number): void => appState.setPreview(addDays(now, d));
  let jumpOpen = $state(false);
  const jumpDays = $derived.by(() => {
    const out: { date: ISODate; label: string; place: string }[] = [];
    for (let d = trip.start; compareIso(d, trip.end) <= 0 && out.length < 400; d = addDays(d, 1)) {
      out.push({ date: d, label: resolveDay(d, dayPlans, dayDefaults, stops)?.title ?? '', place: currentStop(stops, d)?.name ?? '' });
    }
    return out;
  });
  /* The sheet closes through the router FIRST, and the date is written once
     it has (Run 4b). Cleared by its flag, the sheet left its layer behind —
     the next back press did nothing visible — and the ?d= was written onto
     the sheet's entry, so that press also took the date back out of the
     address. */
  async function jumpTo(d: ISODate): Promise<void> {
    await router.closeTopLayer();
    appState.setPreview(d === localToday(null) ? null : d);
  }
  let x0 = 0;
  let y0 = 0;
  /* a swipe, not a scroll: mostly sideways and long enough to mean it */
  function touchEnd(e: TouchEvent): void {
    const t = e.changedTouches[0];
    const dx = (t?.clientX ?? x0) - x0;
    if (Math.abs(dx) >= 64 && Math.abs(dx) >= Math.abs((t?.clientY ?? y0) - y0) * 1.6) step(dx < 0 ? 1 : -1);
  }

  const travel = $derived(!!(ctx.line || rb));
  const caps = $derived(
    travel
      ? S.day.travel(fmtDow(now))
      : now === ctx.realToday
        ? S.day.today(fmtDow(now))
        : now === addDays(ctx.realToday, 1)
          ? S.day.tomorrow
          : fmtDow(now),
  );
  const age = $derived(ctx.today ? weatherAge(ctx.weather, Date.now()) : null);

  /* ---------- a travel day ---------- */
  let inked = $state(-1);
  const rows = $derived(ctx.line ? metroRows(ctx.line, inked) : []);
  const focus = $derived(focusOf(ctx.line, rb?.steps ?? [], pr.current));
  function tick(i: number, on: boolean): void {
    if (!rb) return;
    if (on) inked = segmentOfStep(ctx.line, i);
    void setCheck(runStepKey(trip.id, rb.id, now, i), trip.id, on);
  }
  /* eight digits or more in a step is a reference read out at a desk */
  const digits = (s: string): string | null => /\d[\d ]{7,}\d|\d{8,}/.exec(s)?.[0].replace(/\s+/g, '') ?? null;

  /* ---------- any other day: the plan, the gaps, the offers ---------- */
  const timeline = $derived(buildTimeline(day?.planItems ?? [], stop?.spots ?? []));
  const nowIdx = $derived(currentIndex(timeline.timed, ctx.clock));
  const picks = $derived(picksOn(dayPicks, now));
  const pickedIds = $derived(pickedIndex(dayPicks, now));
  const pool = $derived(
    stop ? candidatesOf(stop).filter((c) => pickedIds.has(c.id) || !inTheDay(c, day?.planItems ?? [], stop.spots ?? [])) : [],
  );
  /* NOT ON A TRAVEL DAY: there the line and the runbook ARE the day. */
  const blocks = $derived(
    ctx.phase !== 'during' || travel || !day || !stop
      ? []
      : freeBlocks([...planFixedPoints(timeline.timed), ...bookingFixedPoints(bookings, now)])
          .map((block) => {
            const anchor = (block.after?.label ?? stop.name).replace(/[*_`]/g, '').trim();
            return { block, anchor, ...rankCandidates(pool, { anchor: block.after?.coord ?? stop.coord, pickedIds, limit: 4 }) };
          })
          .filter((r) => r.shown.length > 0 || r.fallback),
  );
  const lineRows = $derived(
    [...timeline.timed.map((it, i) => ({ at: it.minutes ?? 0, i, b: -1 })), ...blocks.map((b, j) => ({ at: b.block.start, i: -1, b: j }))].sort(
      (a, b) => a.at - b.at,
    ),
  );
  function togglePick(c: RankedCandidate): void {
    if (c.picked && c.pickId) void unpick(c.pickId);
    else void pickOption(trip.id, now, stop?.id, c);
  }

  /* ---------- places, tonight, the day's to-dos ---------- */
  const places = $derived(ctx.phase === 'during' ? resolvePlaces(day?.placeIds, { stops, showCards, bookings }) : []);
  const bedOf = $derived(ctx.bed ?? ctx.aboard);
  const stamp = $derived(ctx.bed ? statusStamp(ctx.bed.status) : ctx.aboard ? transitNightStamp() : noBookingStamp());
  const todos = $derived(todoOn(ctx.plan, now));
</script>

<main
  class="dayview"
  ontouchstart={(e) => {
    x0 = e.touches[0]?.clientX ?? 0;
    y0 = e.touches[0]?.clientY ?? 0;
  }}
  ontouchend={touchEnd}
>
  <header class="wrap dv-head">
    <button class="iconbtn" onclick={() => router.backOr(`#/trip/${id}/now`)} aria-label={S.day.back}><Icon name="chevron-left" size={20} /></button>
    <div class="dv-title">
      <span class="caps dv-caps">{caps}</span>
      <h1 class="display dv-h1">
        {rb ? runbookHeadline(rb.title) : day ? mdliteToText(day.title) : trip.title}{#if day?.fromDefault}<span class="pill usual">{S.today.usualDay}</span>{/if}
      </h1>
    </div>
    {#if ctx.today}<span class="dv-wx"><Icon name={weatherGlyph(ctx.today.code)} size={16} /><span class="num">{weatherTemps(ctx.today)}</span></span>{/if}
  </header>

  <nav class="wrap dv-step" aria-label={S.day.change}>
    <button class="daystep" onclick={() => step(-1)} aria-label={S.day.prev(fmtDow(addDays(now, -1)))}>‹ {short(addDays(now, -1))}</button>
    <button class="dayttl" onclick={() => (jumpOpen = true)} aria-label={S.today.jumpTitle}>
      <span class="dt-date">{fmtDow(now)}</span><span class="daytag">{ctx.dayTag}</span>
    </button>
    <button class="daystep" onclick={() => step(1)} aria-label={S.day.next(fmtDow(addDays(now, 1)))}>{short(addDays(now, 1))} ›</button>
  </nav>

  <div class="wrap">
    {#if age}<p class="small dv-age">{age}</p>{/if}

    {#if ctx.phase !== 'during'}
      <section class="card dv-out">
        <span class="caps">{ctx.phase === 'before' ? S.today.departureIn : S.today.tripComplete}</span>
        <b class="display dv-big">{ctx.dayTag}</b>
        <span class="muted">{trip.title} · {fmtShort(trip.start)} → {fmtShort(trip.end)}</span>
      </section>
    {:else if travel}
      {#if rb}
        <div class="rb-prog" role="img" aria-label={S.day.progressAria(pr.done, pr.total, pr.current === null ? null : pr.current + 1)}>
          {#each rb.steps as _, i (i)}<span class="rbs" class:on={ctx.ticked(i)} class:now={i === pr.current}></span>{/each}
        </div>
        <p class="rb-note">
          <b>{S.day.progress(pr.done, pr.total)}</b> · {pr.current === null ? S.day.allDone : S.day.stepNow(pr.current + 1)}
          {#if ctx.line}<span class="small">{S.day.schematic}</span>{/if}
        </p>
      {/if}

      {#if rows.length}
        <ol class="metro" aria-label={S.day.lineAria}>
          {#each rows as r, i (i)}
            {#if r.kind === 'st'}
              <li class="m-row m-st">
                <svg class="m-rail" aria-hidden="true" use:offscreen>
                  {#if r.up}<line class={r.up} x1="80" x2="80" y1="0" y2="14" />{/if}
                  {#if r.down}<line class={r.down} x1="80" x2="80" y1="14" y2="100%" />{/if}
                  {#if r.arrow}<path class="flow-arrow m-arrow" d="M75 -2 L80 7 L85 -2 Z" />{/if}
                  <circle class="m-dot {r.dot}" cx="80" cy="14" r="7" />
                  {#if r.you}<circle class="ping" cx="80" cy="14" r="7" use:offscreen />{/if}
                </svg>
                <span class="m-body">
                  <span class="m-name"
                    >{#if r.booking}<a href={pass(r.booking)}>{r.name}</a>{:else}{r.name}{/if}{#if r.native}<span class="zh m-zh" lang="zh"
                        >{r.native}</span
                      >{/if}</span
                  >
                  {#if r.you}<span class="m-you">{S.day.you}</span>{/if}
                  {#if r.sub || r.chip || r.warn}<span class="m-sub"
                      >{#if r.chip}<span class="chip {r.chip.cls}">{r.chip.label}</span>{/if}{r.sub}{#if r.warn}{r.sub ? ' ·' : ''}<b class="m-warn">{r.warn}</b>{/if}</span
                    >{/if}
                </span>
                <span class="m-time num">{r.time}</span>
              </li>
            {:else}
              <li class="m-row m-seg" class:air={r.air}>
                <svg class="m-rail" aria-hidden="true" use:offscreen>
                  {#if r.air}
                    <path class={r.rail} pathLength={r.rail?.endsWith("ink") ? 1 : undefined} d="M80 0 C 8 0, 8 120, 80 120" />
                    <path class="m-plane" transform="translate(17 51) rotate(135 9 9) scale(0.75)" d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
                  {:else}
                    <line class={r.rail} pathLength={r.rail?.endsWith("ink") ? 1 : undefined} x1="80" x2="80" y1="0" y2="100%" />
                  {/if}
                </svg>
                <span class="m-body m-leg">
                  {#if r.booking}
                    <a class="m-link" href={pass(r.booking)} aria-label={S.day.openPass(mdliteToText(r.booking.title))}
                      ><span class="m-label num">{r.label}</span>{#if r.chip}<span class="chip {r.chip.cls}">{r.chip.label}</span>{/if}</a
                    >
                  {:else if r.missing}
                    <span class="chip crit">{S.day.noMove}</span>
                  {/if}
                  {#if r.facts}<span class="m-sub" class:num={r.num}>{r.facts}{#if r.verify}<span class="chip warn">{S.plan.verify}</span>{/if}</span>{/if}
                </span>
              </li>
            {/if}
          {/each}
        </ol>
      {/if}

      {#if focus}
        {@const card = focus.card ? showCards.find((c) => c.id === focus.card) : undefined}
        <article class="focus u-rise" class:warn={focus.chip?.cls === 'warn'} aria-label={S.day.focusCaps(focus.n, focus.of)}>
          <div class="fc-top">
            <span class="caps fc-caps">{S.day.focusCaps(focus.n, focus.of)}</span>
            {#if focus.chip}<span class="chip {focus.chip.cls}">{focus.chip.label}</span>{/if}
          </div>
          {#if focus.title}
            <h2 class="display fc-title">{focus.title}</h2>
            {#if focus.facts || focus.warn}<span class="fc-line"
                >{focus.facts}{#if focus.warn}{focus.facts ? ' · ' : ''}<b class="m-warn">{focus.warn}</b>{/if}</span
              >{/if}
          {:else}
            <p class="fc-text"><Md text={focus.text ?? ''} /></p>
          {/if}
          <div class="fc-act">
            {#if card}<button class="btn" onclick={() => ondriver(card.id)}><Icon name="car" size={17} /><span lang="zh" class="zh">{card.native}</span></button>{/if}
            <button class="btn primary" onclick={() => tick(focus.n - 1, true)}><Icon name="check" size={17} stroke={2.2} />{S.day.done}</button>
          </div>
        </article>
      {/if}

      {#if rb}
        <h2 class="seclabel">{S.day.runbook}</h2>
        <ul class="steps">
          {#each rb.steps as s, i (i)}
            {@const dg = digits(s)}
            <li class:done={ctx.ticked(i)} class:now={i === pr.current}>
              <label class="steprow">
                <input class="cbox" type="checkbox" checked={ctx.ticked(i)} onchange={(e) => tick(i, e.currentTarget.checked)} />
                <span class="stx"><Md text={s} /></span>
              </label>
              {#if dg}<button class="iconbtn stepcopy" onclick={() => copyText(dg)} aria-label={S.info.copy}><Icon name="copy" size={16} /></button>{/if}
            </li>
          {/each}
        </ul>
      {/if}
    {:else if day}
      {#snippet cand(c: RankedCandidate, anchor: string)}
        <div class="cand" class:planned={c.picked}>
          <span class="cbody">
            <span class="cname">{#if c.star}<span class="cstar" aria-label={S.plan.optionsHint}>★</span>{/if}<Md text={c.name} /></span>
            {#if c.picked}
              <span class="cin">{S.today.free.added}</span>
            {:else}
              {#if c.detail}<span class="cdet"><Md text={c.detail} /></span>{/if}
              <span class="cfacts">{#each candidateFacts(c, anchor) as f, j (j)}<span class="cfact {f.cls}">{f.t}</span>{/each}</span>
            {/if}
          </span>
          <button class="cadd" class:on={c.picked} onclick={() => togglePick(c)} aria-pressed={c.picked} aria-label={c.picked ? S.today.free.remove : S.today.free.add}
            ><Icon name={c.picked ? 'check' : 'plus'} size={18} stroke={2.4} /></button
          >
        </div>
      {/snippet}

      {#if lineRows.length}
        <div class="timeline">
          {#each lineRows as row (row.b >= 0 ? `b${row.b}` : `i${row.i}`)}
            {@const b = blocks[row.b]}
            {@const it = timeline.timed[row.i]}
            {#if b}
              <div class="titem freerow">
                <span class="opendot" aria-hidden="true"></span>
                <section class="freeblock">
                  <span class="fbdur num">{S.today.free.head(b.block.duration, b.block.span)}</span>
                  <span class="fbafter">{b.block.after ? S.today.free.after(b.anchor) : S.today.free.openDay}</span>
                  {#each b.shown as c (c.id)}{@render cand(c, b.anchor)}{/each}
                  {#if b.fallback}
                    <span class="fbfall"><span class="caps fblabel">{S.today.free.fallback}</span>{@render cand(b.fallback, b.anchor)}</span>
                  {/if}
                  {#if stop && b.total > b.shown.length}
                    <button class="fbmore" onclick={() => router.goStopOptions(trip.id, stop.id)}>{S.today.free.allOptions(b.total)}</button>
                  {/if}
                </section>
              </div>
            {:else if it}
              <div class="titem">
                <span class="dot" class:now={row.i === nowIdx} aria-hidden="true"></span>
                <div class="tcard" class:now={row.i === nowIdx}>
                  <span class="tx"><span class="tt num">{it.time}</span><b><Md text={it.title} /></b>{#if it.detail}<p><Md text={it.detail} /></p>{/if}</span>
                  {#if it.spot}<MapButtons {...spotMap(it.spot)} compact />{/if}
                </div>
              </div>
            {/if}
          {/each}
        </div>
      {/if}

      {#if timeline.anytime.length}
        {#if timeline.timed.length}<h2 class="seclabel">{S.today.anytime}</h2>{/if}
        <div class="anylist">
          {#each timeline.anytime as it, i (i)}
            <div class="tcard plain">
              <span class="tx"><b><Md text={it.title} /></b>{#if it.detail}<p><Md text={it.detail} /></p>{/if}</span>
              {#if it.spot}<MapButtons {...spotMap(it.spot)} compact />{/if}
            </div>
          {/each}
        </div>
      {/if}
    {:else}
      <EmptyState
        glyph={S.empty.today.glyph}
        title={S.empty.today.title}
        body={S.empty.today.body}
        actionLabel={S.empty.today.action}
        onaction={() => router.goTab(trip.id, 'journey')}
      />
    {/if}

    {#if ctx.phase === 'during' && picks.length}
      <h2 class="seclabel">{S.today.free.planned}</h2>
      <div class="anylist">
        {#each picks as p (p.id)}
          {@const spot = stop?.spots?.find((s) => s.id === p.spotId)}
          {@const c = parseOption(p.text, p.blockId, p.itemIndex, '', stop?.spots ?? [])}
          <div class="tcard plain mine">
            <span class="tx"><b><Md text={c.name} /></b>{#if c.detail}<p><Md text={c.detail} /></p>{/if}<span class="minetag">{S.today.free.pickedTag}</span></span>
            {#if spot}<MapButtons {...spotMap(spot)} compact />{/if}
            <button class="iconbtn mineout" onclick={() => void unpick(p.id)} aria-label={S.today.free.remove}><Icon name="close" size={16} /></button>
          </div>
        {/each}
      </div>
    {/if}

    {#if places.length}
      <div class="dayplaces">
        <span class="caps dphead">{S.maps.placesToday}</span>
        {#each places as p (p.id)}
          <span class="dchip"
            ><span class="dcname">{p.label}</span><MapButtons
              coord={p.coord}
              name={p.mapName}
              query={p.mapQuery}
              address={p.address}
              addressInSearch={p.addressInSearch}
              city={p.mapCity}
              url={p.mapUrl}
              compact
            /></span
          >
        {/each}
      </div>
    {/if}

    {#if ctx.phase === 'during' && day?.bedLabel}
      <div class="bedrow" class:crit={!bedOf}>
        <svelte:element this={bedOf ? 'button' : 'div'} class="rowmain" role={bedOf ? undefined : 'group'} onclick={bedOf ? () => router.go(pass(bedOf)) : undefined}>
          <Icon name="bed" size={20} class="ic" />
          <span class="rx"><b><Md text={day.bedLabel} /></b><small>{S.today.tonight} · {fmtDow(now)}</small></span>
          <span class="stamp {stamp.cls}">{stamp.label}</span>
        </svelte:element>
        {#if ctx.bed}<MapButtons coord={ctx.bed.coord} name={ctx.bed.title} query={ctx.bed.mapQuery} address={ctx.bed.address} city={ctx.bed.mapCity} url={ctx.bed.mapUrl} />{/if}
      </div>
    {/if}

    {#if todos.length}
      <h2 class="seclabel">{S.day.onThisDay}</h2>
      <a class="card dtodo" href="#/trip/{id}/now/todo">
        {#each todos as t (t.id)}
          <span class="dt-row" class:done={t.done}
            >{#if t.time}<span class="num">{t.time}</span>{/if}<Md text={t.task?.title ?? t.alarm?.title ?? t.booking?.title ?? ''} /></span
          >
        {/each}
      </a>
    {/if}
  </div>
</main>

{#if jumpOpen}
  <Sheet title={S.today.jumpTitle} onclose={() => (jumpOpen = false)}>
    <div class="jumplist">
      {#each jumpDays as d (d.date)}
        <button class="jumprow" class:on={d.date === now} onclick={() => jumpTo(d.date)}>
          <span class="jdate num">{fmtDow(d.date)}</span>
          <span class="jbody"><span class="jtitle"><Md text={d.label} /></span>{#if d.place}<span class="jplace">{d.place}</span>{/if}</span>
          {#if d.date === ctx.realToday}<span class="jnow">{S.today.jumpToday}</span>{:else if d.date === now}<span class="jshow">{S.today.jumpShowing}</span>{/if}
        </button>
      {/each}
    </div>
  </Sheet>
{/if}

<style>
  .dayview {
    padding-bottom: 8px;
  }
  /* ---------- the head ---------- */
  .dv-head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-top: calc(12px + env(safe-area-inset-top));
    padding-bottom: 10px;
  }
  .dv-title {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .dv-caps {
    color: var(--ink-2);
  }
  .dv-h1 {
    margin: 0;
    font-size: var(--fs-code-lg);
    font-weight: 600;
    line-height: 1.1;
  }
  .usual {
    margin-left: 8px;
    vertical-align: middle;
    font-family: var(--font-ui);
    letter-spacing: 0;
  }
  .dv-wx {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .dv-age {
    margin: 0 2px 8px;
  }
  .dv-step {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
  }
  .dv-step button {
    min-height: 44px;
    border: none;
    background: none;
    color: var(--ink-2);
    font-size: var(--fs-caption);
    font-weight: 600;
  }
  .daystep {
    min-width: 64px;
    padding: 0 10px;
    border-radius: var(--radius-pill);
  }
  .dv-step .dayttl {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    border-radius: var(--radius-pill);
    background: var(--chrome);
    border: 1px solid var(--line);
    color: var(--ink);
  }
  .dt-date {
    font-size: var(--fs-label);
  }
  .daytag {
    font-size: var(--fs-caps);
    font-weight: 500;
    color: var(--faint);
  }
  .dv-out {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .dv-big {
    font-size: var(--fs-screen-title);
    font-weight: 600;
  }

  /* ---------- the runbook's progress ---------- */
  .rb-prog {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 4px;
  }
  .rbs {
    height: 6px;
    border-radius: 3px;
    background: var(--line);
  }
  .rbs.on {
    background: var(--sunrise-fill);
    box-shadow: 0 0 8px rgba(255, 159, 107, 0.7);
  }
  .rbs.now {
    background: var(--warn);
    box-shadow: 0 0 10px rgba(255, 196, 107, 0.8);
  }
  .rb-note {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 8px;
    margin: 8px 2px 10px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .rb-note b {
    color: var(--ink);
  }

  /* ---------- the metro line ---------- */
  .metro {
    list-style: none;
    margin: 0 0 8px;
    padding: 0;
  }
  .m-row {
    position: relative;
    display: grid;
    grid-template-columns: 92px 1fr auto;
    align-items: start;
    gap: 0 10px;
  }
  .m-rail {
    position: absolute;
    left: 0;
    top: 0;
    width: 92px;
    height: 100%;
    overflow: visible;
  }
  .m-st {
    min-height: 58px;
    padding: 4px 0 6px;
  }
  .m-seg {
    min-height: 60px;
    padding: 4px 0;
  }
  .m-seg.air {
    min-height: 120px;
  }
  .m-body {
    grid-column: 2;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    min-width: 0;
  }
  .m-leg {
    align-self: center;
    padding: 6px 0;
  }
  .m-time {
    grid-column: 3;
    padding-top: 2px;
    font-size: var(--fs-caption);
    color: var(--ink);
  }
  .m-name {
    font-size: var(--fs-row);
    font-weight: 600;
    line-height: 1.3;
  }
  .m-name a {
    color: inherit;
  }
  .m-zh {
    margin-left: 6px;
    font-size: var(--fs-caption);
    font-weight: 400;
    color: var(--ink-2);
    /* a Chinese name moves to the next line whole, never split inside it
       (北京大兴国际机 / 场) */
    white-space: nowrap;
  }
  .m-sub {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  /* a station's own warning, lifted from its step ("NOT Capital") */
  .m-warn {
    font-weight: 700;
    color: var(--warn-ink);
  }
  .m-you {
    display: inline-flex;
    align-items: center;
    min-height: 22px;
    padding: 0 10px;
    border-radius: var(--radius-pill);
    font-size: var(--fs-chip);
    font-weight: 600;
    color: var(--sunrise);
    background: var(--sunrise-soft);
    border: 1px solid color-mix(in srgb, var(--sunrise) 42%, transparent);
  }
  .m-link {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    color: var(--ink);
  }
  .m-label {
    font-size: var(--fs-code);
    font-weight: 600;
  }
  .m-rail :global(.r) {
    fill: none;
    stroke-width: 6;
    stroke-linecap: round;
  }
  .m-rail :global(.r.done) {
    stroke: var(--sunrise-fill);
    filter: drop-shadow(0 0 5px rgba(255, 159, 107, 0.6));
  }
  .m-rail :global(.r.now) {
    stroke: var(--warn);
  }
  .m-rail :global(.r.ahead) {
    stroke: var(--route-future);
    stroke-width: 5;
    stroke-dasharray: 0.1 11;
  }
  .m-rail :global(.r.transfer.ahead) {
    stroke-dasharray: 2 7;
  }
  .air .m-rail :global(.r) {
    stroke-width: 4;
  }
  .m-plane {
    fill: var(--sky);
    stroke: var(--ink);
    stroke-width: 2;
    stroke-linejoin: round;
  }
  .m-dot {
    fill: var(--sky);
    stroke: var(--ink);
    stroke-width: 3;
  }
  .m-dot.done {
    fill: var(--sunrise-fill);
    stroke: var(--sunrise-fill);
  }
  .m-dot.now {
    stroke: var(--warn);
  }
  .m-dot.air {
    stroke: var(--opal-3);
  }
  .m-dot.bed {
    stroke: var(--opal-1);
    stroke-width: 4;
  }
  .m-dot.you {
    fill: var(--sunrise-fill);
    stroke: none;
    filter: drop-shadow(0 0 8px rgba(255, 159, 107, 0.95));
  }
  .m-arrow {
    fill: var(--warn);
  }
  .ping {
    fill: none;
    stroke: var(--sunrise-fill);
    stroke-width: 1.5;
    transform-box: fill-box;
    transform-origin: center;
    animation: h-ping var(--duration-ping) ease-out infinite;
  }

  /* ---------- the Focus card, pinned above the nav ---------- */
  .focus {
    position: sticky;
    bottom: calc(var(--nav-h) + env(safe-area-inset-bottom) + 8px);
    z-index: 5;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 6px 0 14px;
    padding: 16px 16px 16px 18px;
    border-radius: var(--radius-card);
    background: var(--card);
    border: 1px solid color-mix(in srgb, var(--sunrise) 45%, transparent);
    box-shadow: var(--shadow-float);
  }
  .focus.warn {
    background: linear-gradient(180deg, var(--warn-soft), transparent 80%), var(--card);
    border-color: var(--warn-line);
  }
  .fc-top {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .fc-caps {
    flex: 1;
    color: var(--sunrise);
  }
  .focus.warn .fc-caps {
    color: var(--warn-ink);
  }
  .fc-title {
    margin: 0;
    font-size: var(--fs-code-lg);
    font-weight: 600;
    line-height: 1.15;
  }
  .fc-line {
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .fc-text {
    margin: 0;
    font-size: var(--fs-row);
    line-height: 1.45;
  }
  .fc-act {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
    gap: 10px;
    margin-top: 4px;
  }
  .fc-act .btn {
    min-height: 48px;
  }

  /* ---------- the runbook, every step ---------- */
  .steps {
    list-style: none;
    margin: 0 0 8px;
    padding: 0;
  }
  .steps li {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px dashed var(--line);
  }
  .steps li.now .stx {
    color: var(--ink);
    font-weight: 600;
  }
  .steps li.done .stx {
    color: var(--faint);
    text-decoration: line-through;
  }
  .steprow {
    flex: 1;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    min-height: 44px;
    cursor: pointer;
  }
  .cbox {
    position: relative;
    appearance: none;
    -webkit-appearance: none;
    flex: 0 0 auto;
    width: 30px;
    height: 30px;
    margin: 2px 0 0;
    padding: 0;
    min-height: 0;
    border-radius: 50%;
    border: 2px solid var(--edge);
    background: transparent;
  }
  .cbox::after {
    content: '';
    position: absolute;
    inset: -8px;
  }
  .cbox:checked {
    background: var(--sunrise-fill);
    border-color: var(--sunrise-fill);
    box-shadow: var(--glow-sunrise);
  }
  .cbox:checked::before {
    content: '';
    position: absolute;
    left: 8px;
    top: 4px;
    width: 8px;
    height: 13px;
    border: solid var(--on-sunrise);
    border-width: 0 2.5px 2.5px 0;
    transform: rotate(45deg);
  }
  .stx {
    flex: 1;
    min-width: 0;
    padding-top: 6px;
    font-size: var(--fs-row);
    line-height: 1.45;
    color: var(--ink-2);
  }

  /* ---------- any other day ---------- */
  .timeline {
    position: relative;
    padding: 4px 0 2px;
  }
  .timeline::before {
    content: '';
    position: absolute;
    left: 19px;
    top: 12px;
    bottom: 12px;
    width: 3px;
    border-radius: 2px;
    background: var(--lilac);
    opacity: 0.85;
  }
  .titem {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 14px;
    margin-bottom: 12px;
  }
  .dot,
  .opendot {
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
    margin: 14px 0 0 14px;
    border-radius: 50%;
    background: var(--sky);
    border: 2.5px solid var(--lilac);
    z-index: 1;
  }
  .dot.now {
    background: var(--lilac);
    box-shadow: 0 0 0 5px var(--lilac-soft);
  }
  .opendot {
    border-style: dashed;
  }
  .tcard {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 13px;
    border-radius: var(--radius-inner);
    background: var(--plan-card);
    border: 1px solid var(--plan-edge);
    box-shadow: var(--shadow-card);
  }
  .tcard.now {
    border-color: var(--lilac-line);
  }
  .tcard.plain {
    margin-bottom: 10px;
  }
  .tx {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .tt {
    font-size: var(--fs-chip);
    font-weight: 600;
    color: var(--lilac-ink);
  }
  .tt:empty {
    display: none;
  }
  .tcard b {
    font-size: var(--fs-row);
    font-weight: 600;
    line-height: 1.3;
  }
  .tcard p {
    margin: 0;
    font-size: var(--fs-caption);
    line-height: 1.45;
    color: var(--ink-2);
  }
  .freeblock {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 10px 10px 14px;
    border-radius: var(--radius-tile);
    background: var(--card);
    border: 1px dashed var(--lilac-line);
  }
  .fbdur {
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--lilac-ink);
  }
  .fbafter {
    margin-top: -6px;
    font-size: var(--fs-label);
    font-weight: 600;
  }
  .cand {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 8px 8px 12px;
    border-radius: var(--radius-inner);
    background: var(--card-2);
    border: 1px solid var(--line);
  }
  .cand.planned {
    border-color: color-mix(in srgb, var(--sunrise) 35%, transparent);
  }
  .cbody {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .cname {
    font-size: var(--fs-label);
    font-weight: 600;
    line-height: 1.3;
  }
  .cstar {
    margin-right: 5px;
    color: var(--sunrise);
  }
  .cin {
    font-size: var(--fs-chip);
    font-weight: 600;
    color: var(--sunrise);
  }
  .cdet {
    font-size: var(--fs-chip);
    line-height: 1.35;
    color: var(--ink-2);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .cfacts {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
  }
  .cfacts:empty {
    display: none;
  }
  .cfact {
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .cfact.pre,
  .cfact.verify {
    color: var(--warn-ink);
  }
  .cadd {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: 50%;
    color: var(--ink);
    background: var(--card);
    border: 1px solid var(--edge);
  }
  .cadd.on {
    color: var(--on-sunrise);
    background: var(--sunrise-fill);
    border-color: var(--sunrise-fill);
    box-shadow: var(--glow-sunrise);
  }
  .fbfall {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .fblabel {
    color: var(--ink-2);
  }
  .fbmore {
    align-self: flex-end;
    min-height: 44px;
    padding: 0 8px;
    border: none;
    background: none;
    font-size: var(--fs-caption);
    font-weight: 600;
    color: var(--sunrise);
  }
  .mine {
    border-color: color-mix(in srgb, var(--sunrise) 35%, transparent);
  }
  .minetag {
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--sunrise);
  }

  /* ---------- places, tonight, to-dos ---------- */
  .dayplaces {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 16px 0 8px;
  }
  .dphead {
    flex-basis: 100%;
    color: var(--ink-2);
  }
  .dchip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    padding: 4px 4px 4px 12px;
    border-radius: var(--radius-pill);
    background: var(--card);
    border: 1px solid var(--line);
  }
  .dcname {
    font-size: var(--fs-caption);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* the bed takes its own line and its two map buttons go under it: side by
     side they squeezed "Pullman Zhangjiajie, Wulingyuan" into a column and
     sat on its Booked stamp (Run 3b) */
  .bedrow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    margin: 12px 0;
    padding: 6px 8px 6px 4px;
    border-radius: var(--radius-tile);
    background: var(--card);
    border: 1px solid var(--line);
  }
  .bedrow > :global(.maps),
  .bedrow > :global(.addrcopy) {
    flex: 1 1 auto;
    margin: 0 0 4px;
  }
  .bedrow > :global(.maps) {
    margin-left: 4px;
  }
  .bedrow :global(.mapbtn) {
    white-space: nowrap;
  }
  .bedrow.crit {
    border-color: var(--crit-line);
    background: linear-gradient(180deg, var(--crit-soft), transparent 80%), var(--card);
  }
  .rowmain {
    flex: 1 1 100%;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 52px;
    padding: 4px 6px;
    border: none;
    background: none;
    text-align: left;
    color: inherit;
  }
  .rowmain :global(.ic) {
    color: var(--opal-1);
  }
  .rx {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .rx b {
    font-size: var(--fs-row);
    font-weight: 600;
  }
  .rx small {
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .dtodo {
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: var(--ink);
  }
  .dt-row {
    display: flex;
    gap: 8px;
    font-size: var(--fs-caption);
  }
  .dt-row.done {
    color: var(--faint);
    text-decoration: line-through;
  }
  .dt-row .num {
    color: var(--lilac-ink);
  }

  /* ---------- the long jump ---------- */
  .jumplist {
    display: flex;
    flex-direction: column;
  }
  .jumprow {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    padding: 6px 4px;
    border: none;
    border-bottom: 1px solid var(--line);
    background: none;
    text-align: left;
    color: var(--ink);
  }
  .jumprow.on {
    background: var(--sunrise-soft);
    border-radius: var(--radius-button-sm);
  }
  .jdate {
    flex: 0 0 96px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .jbody {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .jtitle {
    font-size: var(--fs-label);
    font-weight: 600;
  }
  .jplace {
    font-size: var(--fs-chip);
    color: var(--faint);
  }
  .jnow,
  .jshow {
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--sunrise);
  }
  .jshow {
    color: var(--ink-2);
  }
</style>
