<script lang="ts">
  /* The full-screen place page — the "read more" surface. Reached at
     #/trip/:tripId/itinerary/:stopId (route.sub), so Android back returns to
     the Plan tab through real history, no layer bookkeeping.

     Five parts, in this order and on purpose:
       hero → ① getting there & money → ② the story → ③ day by day
       → the remaining blocks (sleep, tips) → ④ all the options. */
  import type { Booking, DayPlan, Stop, Trip } from '../lib/model/types';
  import { compareIso, fmtDow, fmtShort } from '../lib/logic/dates';
  import { priceOf, staysInStop } from '../lib/logic/booked';
  import { symbolFor } from '../lib/logic/money';
  import { fmtRange, splitCostRows, tripSymbols } from '../lib/logic/prices';
  import { asWeatherCache, dayIn, weatherChip, weatherKey } from '../lib/logic/weather';
  import { db } from '../lib/db/db';
  import { live } from '../lib/data/live.svelte';
  import Md from '../lib/components/ui/Md.svelte';
  import MapButtons from '../lib/components/ui/MapButtons.svelte';
  import PhotoImg from '../lib/components/ui/PhotoImg.svelte';
  import { router } from '../lib/state/router.svelte';
  import { S } from '../lib/i18n/strings';

  let {
    trip,
    stop,
    stops,
    dayPlans,
    bookings = [],
  }: {
    trip: Trip;
    stop: Stop;
    stops: Stop[];
    dayPlans: DayPlan[];
    bookings?: Booking[];
  } = $props();

  const days = $derived(
    dayPlans
      .filter((d) => compareIso(d.date, stop.start) >= 0 && compareIso(d.date, stop.end) <= 0)
      .sort((a, b) => compareIso(a.date, b.date)),
  );
  const pos = $derived.by(() => {
    const real = stops.filter((s) => s.kind === 'stop').sort((a, b) => a.order - b.order);
    const i = real.findIndex((s) => s.id === stop.id);
    return i === -1 ? null : { n: i + 1, total: real.length };
  });

  /* ① takes the practical blocks; the legacy "day by day" summary block is
     dropped entirely because the real DayPlans below say the same thing. */
  const isCost = (h: string): boolean => /cost/i.test(h);
  const isPractical = (h: string): boolean => /getting there/i.test(h) || isCost(h);
  const isLegacyDays = (h: string): boolean => /day by day/i.test(h);
  const practical = $derived(stop.blocks.filter((b) => isPractical(b.heading) && !isCost(b.heading)));
  /* The money block reads as money: label left, amount right. */
  const costBlocks = $derived(stop.blocks.filter((b) => isCost(b.heading)));
  const restBlocks = $derived(
    stop.blocks.filter((b) => !isPractical(b.heading) && !isLegacyDays(b.heading)),
  );

  const legs = $derived(
    bookings
      .filter((b) => b.kind === 'flight' && compareIso(b.date, stop.start) >= 0 && compareIso(b.date, stop.end) <= 0)
      .sort((a, b) => compareIso(a.date, b.date)),
  );
  /* The beds of this stop: check-in inside [start, end), so a departure-day
     bed belongs to the place you sleep in, once. */
  const beds = $derived(staysInStop(bookings, stop));
  const homeSym = $derived(symbolFor(trip, trip.homeCurrency));
  const symbols = $derived(tripSymbols(trip));

  const optionBlocks = $derived([...(stop.options ?? []), ...stop.recoBlocks]);

  /* Cached forecast only — this page never fetches. Empty cache renders nothing. */
  const weatherLive = live(() => db.meta.get(weatherKey(stop.id)), { deps: () => stop.id });
  const weather = $derived(asWeatherCache(weatherLive.current?.value));

  /* Hash navigation keeps the scroll position of the page we came from —
     a place page must always open at its hero. */
  $effect(() => {
    void stop.id;
    window.scrollTo(0, 0);
  });

  function back(): void {
    router.goTab(trip.id, 'itinerary');
  }
</script>

<main class="place">
  <div class="hero" style="--h:{stop.hue}">
    <span class="fall" aria-hidden="true"><i>{stop.emoji ?? '📍'}</i></span>
    {#if stop.photoDocId}
      <PhotoImg docId={stop.photoDocId} alt="" loading="eager" />
    {/if}
    <span class="shade" aria-hidden="true"></span>
    <button class="back" onclick={back} aria-label={S.misc.back}>‹</button>
    <div class="title">
      <h1><Md text={stop.name} /></h1>
      <div class="chips">
        <span class="chip glass mono">{stop.whenLabel ?? `${fmtShort(stop.start)} → ${fmtShort(stop.end)}`}</span>
        {#if stop.nights}<span class="chip glass mono">{stop.nights} {stop.nights === 1 ? 'night' : 'nights'}</span>{/if}
        {#if pos}<span class="chip glass mono">{S.plan.stopOf(pos.n, pos.total)}</span>{/if}
      </div>
    </div>
  </div>

  <div class="sheet">
    <div class="wrap">
      {#if stop.warn}
        <div class="card crit"><Md text={stop.warn} as="div" /></div>
      {/if}

      <!-- ① getting there & money -->
      <section class="sec">
        <h4>🧭 {S.plan.gettingThere}</h4>
        {#each practical as b (b.id)}
          <h5><Md text={b.heading} /></h5>
          {#if b.items.length}
            <ul>
              {#each b.items as it, i (i)}<Md text={it} as="li" />{/each}
            </ul>
          {/if}
          {#each b.dayRows ?? [] as row, i (i)}
            <div class="dayrow"><span class="d">{row.label}</span><span><Md text={row.text} /></span></div>
          {/each}
        {/each}

        {#if stop.costNote}
          <div class="budget">💰 {S.plan.budgetFor} <Md text={stop.costNote} /></div>
        {/if}

        {#if beds.length || legs.length}
          <h5>{S.plan.bookedHere}</h5>
          {#each beds as b (b.id)}
            {@const p = priceOf(b, trip)}
            <div class="leg">
              <span class="legmain">
                🛏 <b><Md text={b.title} /></b> · {fmtShort(b.checkIn)} → {fmtShort(b.checkOut)}
                <span class="chip {b.status === 'booked' ? 'ok' : b.status === 'pending' ? 'warn' : ''}">
                  {b.status === 'booked' ? S.money.booked1 : b.status === 'pending' ? S.money.pending : S.money.walkin}
                </span>
              </span>
              {#if p.range}
                <span class="chip accent">{fmtRange(p.range, homeSym)}</span>
              {:else}
                <span class="nopr">{S.money.noPrice}</span>
              {/if}
            </div>
          {/each}
          {#each legs as f (f.id)}
            {#if f.kind === 'flight'}
              <div class="leg">
                <span class="legmain">✈ <b>{f.flightNo}</b> · {f.from.code} → {f.to.code} · {f.dep}</span>
                {#if f.priceNote}
                  <span class="chip accent">{f.priceNote}</span>
                {:else}
                  <span class="nopr">{S.money.noPrice}</span>
                {/if}
              </div>
            {/if}
          {/each}
        {/if}

        {#each costBlocks as b (b.id)}
          <h5><Md text={b.heading} /></h5>
          {#each b.items as it, i (i)}
            {#each splitCostRows(it, symbols) as row, j (j)}
              {#if row.amount}
                <div class="mrow">
                  <span class="ml"><Md text={row.label} /></span>
                  <span class="mv">{row.amount}</span>
                </div>
              {:else}
                <div class="mline"><Md text={row.label} as="div" /></div>
              {/if}
            {/each}
          {/each}
        {/each}

        <MapButtons coord={stop.coord} name={stop.name} query={stop.mapQuery} city={stop.mapCity} url={stop.mapUrl} />
      </section>

      <!-- ② the story -->
      {#if stop.detail}
        <div class="detail"><Md text={stop.detail} as="div" /></div>
      {/if}

      <!-- ③ day by day -->
      {#if days.length}
        <section class="sec">
          <h4>{S.plan.dayByDay}</h4>
          {#each days as d (d.id)}
            {@const w = dayIn(weather, d.date)}
            <details class="dayd">
              <summary>
                <span class="dp-date mono">{fmtDow(d.date)}</span>
                <span class="dp-title"><Md text={d.title} /></span>
                {#if w}<span class="wchip">{weatherChip(w)}</span>{/if}
                <span class="chev" aria-hidden="true">▸</span>
              </summary>
              <ul>
                {#each d.planItems as p, i (i)}<Md text={p} as="li" />{/each}
              </ul>
              {#if d.bedLabel}
                <div class="small">{d.bedEmoji ?? '🛏'} <Md text={d.bedLabel} /></div>
              {/if}
            </details>
          {/each}
        </section>
      {/if}

      <!-- the rest of the blocks: sleep, tips, whatever a stop carries -->
      {#each restBlocks as b (b.id)}
        <section class="sec">
          <h4><Md text={b.heading} /></h4>
          {#if b.items.length}
            <ul>
              {#each b.items as it, i (i)}<Md text={it} as="li" />{/each}
            </ul>
          {/if}
          {#each b.dayRows ?? [] as row, i (i)}
            <div class="dayrow"><span class="d">{row.label}</span><span><Md text={row.text} /></span></div>
          {/each}
        </section>
      {/each}

      <!-- ④ all the options -->
      {#if optionBlocks.length}
        <h3 class="optionhead">
          {S.plan.options}<span class="opthint">{S.plan.optionsHint}</span>
        </h3>
        {#each optionBlocks as b (b.id)}
          <section class="sec">
            <h4><Md text={b.heading} /></h4>
            <ul>
              {#each b.items as it, i (i)}<Md text={it} as="li" />{/each}
            </ul>
          </section>
        {/each}
      {/if}

      <footer class="foot">{trip.title} · {S.misc.localOnly}</footer>
    </div>
  </div>
</main>

<style>
  .hero {
    position: relative;
    height: min(44vh, 330px);
    min-height: 210px;
    overflow: hidden;
  }
  .fall {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 26px;
    background: linear-gradient(135deg, hsl(var(--h) 55% 36%), hsl(var(--h) 55% 28%));
  }
  .fall i {
    font-style: normal;
    font-size: 84px;
    opacity: 0.18;
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
  .shade {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(var(--photo-dim), var(--photo-dim)),
      linear-gradient(180deg, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0) 22%),
      var(--scrim);
  }
  .back {
    position: absolute;
    top: calc(env(safe-area-inset-top) + 10px);
    left: 10px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.4);
    color: #fff;
    font-size: 24px;
    line-height: 1;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }
  .title {
    position: absolute;
    left: 16px;
    right: 16px;
    bottom: 34px;
  }
  .title h1 {
    margin: 0 0 8px;
    font-family: var(--font-display);
    font-weight: 640;
    font-size: var(--text-hero);
    line-height: 1.1;
    color: var(--on-photo);
  }
  .chips {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
  }
  .glass {
    background: rgba(0, 0, 0, 0.38);
    color: #fff;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    text-transform: none;
    letter-spacing: 0.3px;
  }
  .sheet {
    position: relative;
    margin-top: -24px;
    border-radius: 24px 24px 0 0;
    background: var(--paper);
    padding-top: 18px;
    min-height: 40vh;
  }
  .detail {
    font-size: var(--text-base);
    line-height: 1.6;
    margin-bottom: 14px;
  }
  .sec {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
    padding: 13px 15px;
    margin-bottom: 12px;
  }
  .sec h4 {
    margin: 0 0 7px;
    font-size: var(--text-xs);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: var(--stop-text);
  }
  .sec h5 {
    margin: 10px 0 4px;
    font-size: 10.5px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--faint);
  }
  .sec h5:first-of-type {
    margin-top: 2px;
  }
  .sec ul {
    margin: 0;
    padding-left: 18px;
  }
  .sec :global(li) {
    margin-bottom: 5px;
    font-size: 14px;
  }
  .budget {
    margin-top: 10px;
    padding-top: 9px;
    border-top: 1px dashed var(--line);
    font-size: 14px;
    font-weight: 650;
  }
  .leg {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    min-height: 44px;
    margin-top: 7px;
    padding-bottom: 6px;
    border-bottom: 1px dashed var(--line);
    font-size: 13.5px;
    font-variant-numeric: tabular-nums;
  }
  .leg:last-of-type {
    border-bottom: none;
  }
  .legmain {
    flex: 1;
    min-width: 0;
  }
  .legmain .chip {
    margin-left: 6px;
    font-size: 9.5px;
    padding: 1px 7px;
  }
  .nopr {
    font-size: 11.5px;
    color: var(--faint);
    white-space: nowrap;
  }
  /* the 💰 Costs block, read as money */
  .mrow {
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-height: 30px;
    padding: 4px 0;
    border-bottom: 1px dashed var(--line);
    font-size: 13.5px;
  }
  .mrow:last-of-type {
    border-bottom: none;
  }
  .ml {
    flex: 1;
    min-width: 0;
  }
  .mv {
    font-weight: 700;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .mline {
    font-size: 13.5px;
    padding: 5px 0;
    line-height: 1.45;
  }
  .optionhead {
    display: flex;
    align-items: baseline;
    gap: 9px;
    flex-wrap: wrap;
    margin: 22px 0 10px;
    font-size: 12px;
    letter-spacing: 1.6px;
    text-transform: uppercase;
    color: var(--ink-2);
    font-weight: 700;
  }
  .opthint {
    letter-spacing: 0;
    text-transform: none;
    font-size: 12px;
    font-weight: 500;
    color: var(--faint);
  }
  .dayrow {
    display: flex;
    gap: 9px;
    margin: 8px 0;
    font-size: 14px;
  }
  .dayrow .d {
    background: var(--stop-soft);
    color: var(--stop-text);
    font-size: 10.5px;
    font-weight: 700;
    border-radius: 7px;
    padding: 2px 7px;
    height: fit-content;
    white-space: nowrap;
    margin-top: 2px;
    flex-shrink: 0;
  }
  .dayd {
    border-bottom: 1px dashed var(--line);
  }
  .dayd:last-of-type {
    border-bottom: none;
  }
  .dayd > summary {
    list-style: none;
    cursor: pointer;
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
    min-height: 44px;
    padding: 11px 0;
  }
  .dayd > summary::-webkit-details-marker {
    display: none;
  }
  .dp-date {
    font-size: 11px;
    font-weight: 600;
    color: var(--stop-text);
    white-space: nowrap;
    text-transform: uppercase;
  }
  .dp-title {
    font-weight: 650;
    font-size: 14px;
    flex: 1;
    min-width: 0;
  }
  .wchip {
    font-size: 11.5px;
    font-weight: 600;
    color: var(--ink-2);
    background: var(--card-2);
    border-radius: 999px;
    padding: 2px 9px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .chev {
    color: var(--faint);
    font-size: 11px;
    transition: transform 0.2s;
  }
  .dayd[open] .chev {
    transform: rotate(90deg);
  }
  .dayd ul {
    margin: 0 0 8px;
    padding-left: 18px;
  }
  .dayd .small {
    padding-bottom: 9px;
  }
</style>
