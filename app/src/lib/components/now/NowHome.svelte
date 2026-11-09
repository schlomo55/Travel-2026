<script lang="ts">
  /* NOW, HOME (f-now) — what needs you today, in the order you need it.

     THE ROUTE STRIP is the trip in one line (logic/nowroute.ts): where you are
     in it, a tap from Journey, which draws the whole map. THE SENTENCE is the
     Concierge (logic/concierge.ts): what to do next, in plain words, and a door
     to the day. NEXT is the one opal card: a countdown and the sun on its arc.
     TONIGHT and the DRIVER CARD follow while the trip is on; a card with
     nothing to say is not drawn. TO DO (logic/nowTodo.ts) is what is late and
     what is due today, with its ticks; the VISA and the MONEY are two small
     doors at the foot. Everything is one column, top to bottom — nothing is
     hidden behind a sideways swipe. There is no NOW card: the sentence is the
     now. */
  import type { Booking, ComplianceCounter, ShowCard, Stop } from '../../model/types';
  import type { NowCtx } from './model';
  import { concierge, sentenceText } from '../../logic/concierge';
  import { arcPoint, arcProgress, compactCountdown } from '../../logic/glance';
  import { countStops } from '../../logic/day';
  import { bookingFixedPoints } from '../../logic/commitment';
  import { chipOf, legLabel, segmentOfStep } from '../../logic/metroline';
  import { driverChips, stayCard, visaPreview } from '../../logic/pocket';
  import { counterState } from '../../logic/counters';
  import { nowTodo } from '../../logic/nowTodo';
  import { routeStrip } from '../../logic/nowroute';
  import { fmtMoneyWide, symbolFor } from '../../logic/money';
  import { fmtDow, parseYmd } from '../../logic/dates';
  import { daysUntilStart, tripDays } from '../../logic/phase';
  import { mdliteToText } from '../../logic/mdlite';
  import { splitBody } from '../../logic/timeline';
  import { isSnowCode, weatherGlyph, weatherTemps } from '../../logic/weather';
  import { appState } from '../../state/appState.svelte';
  import { isNative } from '../../platform/files';
  import { minute } from '../../state/minute.svelte';
  import { S } from '../../i18n/strings';
  import AppBar from '../horizon/AppBar.svelte';
  import Icon from '../horizon/Icon.svelte';
  import RouteStrip from './RouteStrip.svelte';
  import NowTodo from './NowTodo.svelte';
  import Snowfall from '../ui/Snowfall.svelte';
  import PhotoImg from '../ui/PhotoImg.svelte';
  import Md from '../ui/Md.svelte';
  import { offscreen } from '../../motion/offscreen';

  let {
    ctx,
    counters,
    stops,
    bookings,
    showCards,
    spent,
    ondriver,
  }: {
    ctx: NowCtx;
    counters: ComplianceCounter[];
    stops: Stop[];
    bookings: Booking[];
    showCards: ShowCard[];
    /** what has been logged so far, in the trip's home currency — null until the expenses are read */
    spent: number | null;
    ondriver: (cardId: string) => void;
  } = $props();

  const id = $derived(encodeURIComponent(ctx.trip.id));
  const dayHref = $derived(`#/trip/${id}/now/day`);

  /* ---------- the route strip ---------- */
  const strip = $derived(routeStrip(stops, ctx.now, !!ctx.line?.arrived));
  const snowing = $derived(!!ctx.today && isSnowCode(ctx.today.code));

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
      stops: countStops(stops),
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

  const bedCard = $derived(ctx.bed ? stayCard(ctx.bed) : null);

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

  /* ---------- REMINDERS OFF (owner, QA 7 Nov 2026) — inside the Android app
     only: a banner while the app's reminders are off or Android does not
     allow its notifications, and ONE button, which does exactly what the
     Settings switch does (platform/reminders.ts turnOn: ask Android, switch
     on, plan) — nothing else is scheduled. The scheduler's chunk is the one
     main.ts reads after the first paint anyway; re-checked when the app comes
     back to the front (from Android's own settings). Hidden for the session
     with ×. ---------- */
  let remind = $state<'off' | 'denied' | null>(null);
  let shut = $state(false);
  const recheck = (): void => {
    void import('../../platform/reminders').then(async (m) => (remind = await m.reminderBanner()));
  };
  $effect(() => {
    if (!isNative()) return;
    recheck();
    document.addEventListener('visibilitychange', recheck);
    return () => document.removeEventListener('visibilitychange', recheck);
  });

  /* ---------- MONEY ---------- */
  const sym = $derived(symbolFor(ctx.trip, ctx.trip.homeCurrency));
  const budget = $derived(ctx.trip.budgetTotalMinor ?? 0);

  /* ---------- TO DO: what is late and what is due today, from the same plan
     the To do page draws; a previewed day shows its own list and cannot be ticked ---------- */
  const todo = $derived(nowTodo(ctx.plan, ctx.now, appState.previewing));
</script>

<div class="nowhome">
  {#if snowing}<div class="nh-snow" aria-hidden="true"><Snowfall /></div>{/if}
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

  <!-- The page's own bottom room is the body's (app.css: the floating nav and
       the device's inset, then 18 px): nothing here sits under the bar. -->
  <main class="nh-main" aria-label={S.glance.label}>
    {#if strip}<RouteStrip {strip} href="#/trip/{id}/journey" />{/if}
    {#if appState.offline}<div class="offchip"><Icon name="cloud" size={14} />{S.glance.offline}</div>{/if}
    {#if remind && !shut}
      <div class="nh-remind" role="status">
        <Icon name="bell" size={18} />
        <span>{remind === 'off' ? S.glance.remindOff : S.glance.remindDenied}</span>
        <button class="btn primary" onclick={() => void import('../../platform/reminders').then((m) => m.turnOn()).then(recheck)}>{S.glance.remindOn}</button>
        <button class="iconbtn" onclick={() => (shut = true)} aria-label={S.misc.close}><Icon name="close" size={16} /></button>
      </div>
    {/if}

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

    {#if (ctx.tonight && bedWord) || driver}
      <div class="nh-pair">
        {#if ctx.tonight && bedWord}
          <div class="tt-wrap">
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
            <!-- SHOW THE DRIVER tonight's bed: its own white card (logic/pocket.ts stayCard), one tap -->
            {#if bedCard}<button class="tt-drv" onclick={() => ondriver(bedCard.id)} aria-label={S.glance.driverAria(bedCard.meaning)}><Icon name="car" size={18} /></button>{/if}
          </div>
        {/if}
        {#if driver}
          <button class="tile t-driver" onclick={() => ondriver(driver.id)} aria-label={S.glance.driverAria(driver.meaning)}>
            <span class="caps t-caps">{S.glance.driver}</span>
            <span class="td-zh" lang="zh">{driver.native}</span>
            <span class="t-line">{splitBody(driver.meaning).title}</span>
          </button>
        {/if}
      </div>
    {/if}

    <NowTodo view={todo} tripId={ctx.trip.id} />

    <div class="nh-chips">
      {#if visa}
        {@const [day, limit] = visa.value.split('/')}
        <a
          class="chipcard visacard {visa.tone}"
          href="#/trip/{id}/pocket/visa"
          aria-label={S.glance.visaAria(visa.name, visa.value.replace('/', ' of '), visa.line)}
        >
          <span class="caps t-caps nc-cap">{visa.name}</span>
          <span class="nc-fig"><span class="tv-day num">{day}</span><span class="nc-of">{S.glance.ofDays(Number(limit))}</span></span>
          <span class="nc-sub tv-exit">{entryDay ? S.today.entryDay : visa.line}</span>
        </a>
      {/if}
      <a
        class="chipcard moneycard"
        href="#/trip/{id}/pocket/money"
        aria-label={spent === null ? S.wallet.money : S.pocket.moneyAria(fmtMoneyWide(spent, sym))}
      >
        <span class="caps t-caps nc-cap">{S.wallet.money}</span>
        <span class="nc-fig"><span class="nc-big num">{spent === null ? '' : fmtMoneyWide(spent, sym)}</span></span>
        <span class="nc-sub">{budget ? S.wallet.ofBudget(fmtMoneyWide(budget, sym)) : S.wallet.totalSpent}</span>
      </a>
    </div>
  </main>
</div>

<style>
  /* One column, top to bottom. The page's bottom room is the body's (the
     floating nav, the device's inset, then 18 px — app.css), so nothing sits
     under the bar. */
  .nowhome {
    position: relative;
    max-width: 480px;
    margin: 0 auto;
  }
  /* snow falls over the header and the route strip only */
  .nh-snow {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 150px;
    overflow: hidden;
    pointer-events: none;
  }
  /* the header and the page sit over the snow, never under it */
  .nh-bar,
  .nh-main {
    position: relative;
  }
  .nh-main {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 4px var(--gutter) 0;
  }
  .nh-main > .offchip {
    align-self: flex-start;
    margin: 0;
  }
  .nh-remind {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 8px 8px 14px;
    border-radius: var(--radius-tile);
    font-size: var(--fs-caption);
    color: var(--ink);
    background: var(--card);
    border: 1px solid var(--warn-line);
  }
  .nh-remind span {
    flex: 1;
  }
  .sentence {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 12px 12px 14px;
    border-radius: var(--radius-tile);
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

  /* ---------- the cards ---------- */
  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 6px;
    padding: 12px 14px;
    border-radius: var(--radius-tile);
    overflow: hidden;
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
  /* NEXT: full width — the sun on its arc and the name on the left, the
     countdown on the right, the route, the leave-by and the status below */
  .t-next {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'head count'
      'foot foot';
    align-items: center;
    gap: 8px 12px;
    --opal-fill: var(--card);
  }
  .tn-head {
    grid-area: head;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
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
    grid-area: count;
    font-size: var(--fs-countdown);
    font-weight: 500;
    line-height: 1;
    letter-spacing: -0.02em;
    color: var(--sunrise);
    text-shadow: 0 0 18px rgba(255, 159, 107, 0.45);
  }
  .tn-foot {
    grid-area: foot;
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 2px 12px;
  }
  .tn-foot .t-line {
    flex: 1 1 120px;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tn-leave {
    font-size: var(--fs-chip);
    font-weight: 600;
    line-height: 1.25;
    color: var(--sunrise);
  }

  /* TONIGHT and the DRIVER CARD side by side, while the trip is on */
  .nh-pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .nh-pair > :only-child {
    grid-column: 1 / -1;
  }
  .nh-pair .tile {
    min-height: 112px;
  }
  .t-tonight {
    height: 100%;
  }
  .tt-wrap {
    position: relative;
    min-width: 0;
  }
  .tt-foot {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  /* white = for other eyes: the way to the driver card */
  .tt-drv {
    position: absolute;
    top: 6px;
    right: 6px;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 999px;
    border: none;
    color: var(--counter-ink);
    background: var(--counter-paper);
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
  .t-driver {
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

  /* ---------- the two small doors at the foot: the visa and the money ---------- */
  .nh-chips {
    display: flex;
    gap: 10px;
  }
  .chipcard {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    min-height: 64px;
    padding: 8px 12px;
    border-radius: var(--radius-inner);
    color: var(--ink);
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
  }
  .nc-cap {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .nc-fig {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-height: 24px;
  }
  .tv-day,
  .nc-big {
    font-size: var(--fs-card-title);
    font-weight: 600;
    line-height: 1.3;
  }
  .nc-of,
  .nc-sub {
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .tv-exit {
    font-weight: 600;
  }
  .visacard.warn {
    border-color: var(--warn-line);
  }
  .visacard.crit {
    border-color: var(--crit-line);
    box-shadow: var(--glow-crit);
  }
  .visacard.crit .tv-exit {
    color: var(--crit-ink);
  }
</style>
