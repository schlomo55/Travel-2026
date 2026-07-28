<script lang="ts">
  /* The city guide — the one screen the plan demands PIXEL-FAITHFUL to
     docs/design/lantern-preview.html (§SCREENS 5).

     Reached at #/trip/:tripId/itinerary/:stopId (route.sub), so Android back
     returns to the Plans tab through real history, no layer bookkeeping.

     Top to bottom, exactly as the mockup:
       ‹ back · city title in the hand · share
       full-width photo hero
       torn cream paper: "Getting there & money"
       torn cream paper: "About this place"
       typewriter "Day-by-day" + accordion of thin dark rows
       "Where to eat & what to see" + framed thumbs, stars, gold map pills
     Everything the mockup has no slot for (money rows, sleep blocks, the
     options prose) keeps its data source and takes the same dark typewriter
     treatment as the accordion, so the page reads as one document. */
  import type { Booking, DayPlan, ShowCard, Spot, Stop, Trip } from '../lib/model/types';
  import { compareIso, fmtDow, fmtShort } from '../lib/logic/dates';
  import { priceOf, staysInStop } from '../lib/logic/booked';
  import { resolvePlaces } from '../lib/logic/places';
  import { symbolFor } from '../lib/logic/money';
  import { fmtRange, splitCostRows, tripSymbols } from '../lib/logic/prices';
  import { asWeatherCache, dayIn, weatherChip, weatherKey } from '../lib/logic/weather';
  import { db } from '../lib/db/db';
  import { live } from '../lib/data/live.svelte';
  import Md from '../lib/components/ui/Md.svelte';
  import MapButtons from '../lib/components/ui/MapButtons.svelte';
  import PhotoImg from '../lib/components/ui/PhotoImg.svelte';
  import EmptyState from '../lib/components/ui/EmptyState.svelte';
  import { router } from '../lib/state/router.svelte';
  import { copyText } from '../lib/state/toast.svelte';
  import { S } from '../lib/i18n/strings';

  let {
    trip,
    stop,
    stops,
    dayPlans,
    bookings = [],
    showCards = [],
  }: {
    trip: Trip;
    stop: Stop;
    stops: Stop[];
    dayPlans: DayPlan[];
    bookings?: Booking[];
    /** Driver cards — a day's `placeIds` may point at one, so the guide needs
        them to draw its chip rows. */
    showCards?: ShowCard[];
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
  const hasMoney = $derived(costBlocks.length > 0 || beds.length > 0 || legs.length > 0);

  /* A stop can arrive with a name, dates and nothing else — a trip built this
     morning, or someone else's shallow file. The guide then says so instead of
     rendering a header and a footer with a hole between them. */
  const blank = $derived(
    practical.length === 0 &&
      restBlocks.length === 0 &&
      optionBlocks.length === 0 &&
      (stop.spots?.length ?? 0) === 0 &&
      days.length === 0 &&
      !stop.detail &&
      !stop.costNote &&
      !stop.warn &&
      !hasMoney,
  );

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
  /* The share glyph is offline by design: it copies the place, it does not
     open a network share sheet. */
  function share(): void {
    void copyText([stop.name, stop.address].filter(Boolean).join(' · '), S.maps.copied);
  }
  const kindGlyph = (k: Spot['kind']): string =>
    k === 'food' ? '🍜' : k === 'show' ? '🎭' : k === 'transport' ? '🚇' : '📍';

  /* The day's own places, resolved once for the whole accordion. A day's
     `placeIds` can point anywhere in the trip — Dec 11 leaves Chongli and links
     Beijing Capital and Wulingyuan — so the lookup is over ALL stops, not this
     one. A day with none resolves to [] and draws nothing at all. */
  const placesByDay = $derived(
    new Map(days.map((d) => [d.id, resolvePlaces(d.placeIds, { stops, showCards, bookings })])),
  );
</script>

<main class="guide">
  <!-- ---------- the header bar ---------- -->
  <div class="gtop">
    <button class="back" onclick={back} aria-label={S.misc.back}>‹</button>
    <h1 class="script"><Md text={stop.name} /></h1>
    <button class="share" onclick={share} aria-label={S.plan.share}>⇪</button>
  </div>

  <!-- ---------- the hero ---------- -->
  <div class="ghero" style="--h:{stop.hue}">
    {#if stop.photoDocId}
      <PhotoImg docId={stop.photoDocId} alt="" loading="eager" />
    {:else}
      <span class="scene" aria-hidden="true"><i>{stop.emoji ?? '📍'}</i></span>
    {/if}
  </div>

  <div class="gwrap">
    <div class="gchips">
      <span class="gchip mono">{stop.whenLabel ?? `${fmtShort(stop.start)} → ${fmtShort(stop.end)}`}</span>
      {#if stop.nights}<span class="gchip mono">{stop.nights} {stop.nights === 1 ? 'night' : 'nights'}</span>{/if}
      {#if pos}<span class="gchip mono">{S.plan.stopOf(pos.n, pos.total)}</span>{/if}
      <MapButtons coord={stop.coord} name={stop.name} query={stop.mapQuery} address={stop.address} city={stop.mapCity} url={stop.mapUrl} pill />
    </div>

    {#if stop.warn}
      <div class="card crit"><Md text={stop.warn} as="div" /></div>
    {/if}

    <!-- ① getting there & money — torn paper. A stop with neither a transport
         line nor a budget note does not get an empty sheet of paper. -->
    {#if practical.length || stop.costNote}
    <div class="paper u-rise">
      <h3>{S.plan.gettingThere}</h3>
      {#each practical as b (b.id)}
        {#if b.items.length}
          <ul>
            {#each b.items as it, i (i)}<Md text={it} as="li" />{/each}
          </ul>
        {/if}
        {#each b.dayRows ?? [] as row, i (i)}
          <p class="drow"><b>{row.label}</b> <Md text={row.text} /></p>
        {/each}
      {/each}
      {#if stop.costNote}
        <p class="budget">{S.plan.budgetFor} <Md text={stop.costNote} /></p>
      {/if}
    </div>
    {/if}

    <!-- ② about this place — torn paper -->
    {#if stop.detail}
      <div class="paper u-rise" style="--i:1">
        <h3>{S.plan.theStory}</h3>
        <Md text={stop.detail} as="div" />
      </div>
    {/if}

    <!-- the money, in the same document -->
    {#if hasMoney}
      <section class="gsec u-rise" style="--i:2">
        <h3 class="ghead">{S.plan.bookedHere}</h3>
        {#if beds.length || legs.length}
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
          <h4><Md text={b.heading} /></h4>
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
      </section>
    {/if}

    <!-- ③ day by day — the accordion -->
    {#if days.length}
      <section class="gsec">
        <h3 class="ghead">{S.plan.dayByDay}</h3>
        <div class="acc">
          {#each days as d (d.id)}
            {@const w = dayIn(weather, d.date)}
            {@const places = placesByDay.get(d.id) ?? []}
            <details class="accitem">
              <summary>
                <span class="ad mono">{fmtDow(d.date)}</span>
                <span class="at"><Md text={d.title} /></span>
                {#if w}<span class="aw">{weatherChip(w)}</span>{/if}
                <span class="chev" aria-hidden="true">⌄</span>
              </summary>
              <div class="accbody">
                <ul>
                  {#each d.planItems as p, i (i)}<Md text={p} as="li" />{/each}
                </ul>
                <!-- The places this day goes to. Nothing renders for a day with
                     none: no header, no empty rule, no placeholder. -->
                {#if places.length}
                  <div class="dayplaces">
                    <span class="dphead">{S.maps.placesToday}</span>
                    {#each places as p (p.id)}
                      <span class="gchip dchip">
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
                {#if d.bedLabel}
                  <p class="bed">{d.bedEmoji ?? '🛏'} <Md text={d.bedLabel} /></p>
                {/if}
              </div>
            </details>
          {/each}
        </div>
      </section>
    {/if}

    <!-- the rest of the blocks: sleep, tips, whatever a stop carries -->
    {#each restBlocks as b (b.id)}
      <section class="gsec">
        <h3 class="ghead"><Md text={b.heading} /></h3>
        {#if b.items.length}
          <ul class="tlist">
            {#each b.items as it, i (i)}<Md text={it} as="li" />{/each}
          </ul>
        {/if}
        {#each b.dayRows ?? [] as row, i (i)}
          <p class="drow"><b>{row.label}</b> <Md text={row.text} /></p>
        {/each}
      </section>
    {/each}

    <!-- ④ all the options -->
    {#if optionBlocks.length}
      <h2 class="opthead">
        {S.plan.options}<span class="opthint">{S.plan.optionsHint}</span>
      </h2>
      {#each optionBlocks as b (b.id)}
        <section class="gsec">
          <h3 class="ghead"><Md text={b.heading} /></h3>
          <ul class="tlist">
            {#each b.items as it, i (i)}<Md text={it} as="li" />{/each}
          </ul>
        </section>
      {/each}
    {/if}

    <!-- where to eat & what to see — the framed option rows -->
    {#if stop.spots?.length}
      <section class="gsec eats">
        <div class="shead">
          <h3 class="ghead">{S.plan.eatAndSee}</h3>
          <span class="pencil" aria-hidden="true">✎</span>
        </div>
        <p class="placeshint">{S.maps.placesHint}</p>
        <ul class="spots">
          {#each stop.spots as sp (sp.id)}
            <li>
              <span class="thumb" style="--h:{stop.hue}" aria-hidden="true">
                {#if sp.photoDocId}
                  <PhotoImg docId={sp.photoDocId} alt="" />
                {:else}
                  <i>{kindGlyph(sp.kind)}</i>
                {/if}
              </span>
              <span class="nm">
                <span class="sp-name">{sp.name}{#if sp.rating}:{/if}</span>
                {#if sp.rating}
                  <span class="stars" aria-label="{sp.rating} out of 5">
                    {#each [1, 2, 3, 4, 5] as s (s)}<span class:off={s > (sp.rating ?? 0)}>★</span>{/each}
                  </span>
                {/if}
                {#if sp.verify}<span class="vnote">{S.plan.verify}</span>{/if}
                {#if sp.native}<span class="sp-zh zh">{sp.native}</span>{/if}
              </span>
              <MapButtons
                coord={sp.coord}
                name={sp.native ?? sp.name}
                query={sp.mapQuery}
                address={sp.address}
                city={sp.mapCity}
                url={sp.mapUrl}
                pill
              />
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if blank}
      <EmptyState glyph={S.empty.guide.glyph} title={S.empty.guide.title} body={S.empty.guide.body} />
    {/if}

    <footer class="foot">{trip.title} · {S.misc.localOnly}</footer>
  </div>
</main>

<style>
  .guide {
    padding-bottom: 4px;
  }

  /* ---------- header ---------- */
  .gtop {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: calc(env(safe-area-inset-top) + 10px) 16px 8px;
  }
  .gtop .back,
  .gtop .share {
    background: none;
    border: none;
    color: var(--ink);
    width: 44px;
    height: 44px;
    font-size: 22px;
    line-height: 1;
    flex-shrink: 0;
  }
  .gtop .share {
    color: var(--ink-2);
    font-size: 18px;
  }
  .gtop h1 {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-family: var(--font-script);
    font-weight: 500;
    font-size: 30px;
    line-height: 1.1;
    letter-spacing: 0;
    color: #fdf6e6;
  }

  /* ---------- hero ---------- */
  .ghero {
    position: relative;
    height: 190px;
    overflow: hidden;
    background: var(--card);
  }
  .ghero :global(img) {
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
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 26px;
    background: linear-gradient(135deg, hsl(var(--h) 55% 36%), hsl(var(--h) 55% 24%));
  }
  .scene i {
    font-style: normal;
    font-size: 74px;
    opacity: 0.2;
  }

  .gwrap {
    max-width: 480px;
    margin: 0 auto;
  }
  .gchips {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
    padding: 12px 16px 0;
  }
  .gchip {
    font-size: var(--text-xs);
    letter-spacing: 0.3px;
    color: var(--ink-2);
    background: var(--card-2);
    border-radius: var(--radius-pill);
    padding: 3px 10px;
  }
  .card.crit {
    margin: 12px 16px 0;
  }

  /* ---------- torn cream paper ---------- */
  .paper {
    background: var(--cream);
    color: var(--cream-ink);
    margin: 14px 16px 0;
    padding: 14px 16px 16px;
    border-radius: 3px;
    font-family: var(--font-type);
    clip-path: polygon(0 4px, 6% 0, 94% 2px, 100% 6px, 100% 96%, 95% 100%, 4% 98%, 0 94%);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
  }
  .paper h3 {
    margin: 0 0 6px;
    font-family: var(--font-type);
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 0;
    text-transform: none;
    color: var(--cream-ink);
  }
  .paper :global(p),
  .paper :global(li),
  .paper .drow {
    font-family: var(--font-type);
    font-size: 13.5px;
    line-height: 1.55;
  }
  .paper ul {
    margin: 0;
    padding-left: 18px;
  }
  .paper :global(a) {
    color: #6b4a12;
    border-bottom-color: rgba(107, 74, 18, 0.6);
  }

  /* ---------- typewriter sections on black ---------- */
  .gsec {
    padding: 18px 18px 0;
  }
  .ghead {
    display: inline-block;
    margin: 0 0 10px;
    font-family: var(--font-type);
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0;
    text-transform: none;
    color: var(--cream);
    border-bottom: 2px solid var(--cream);
    padding-bottom: 3px;
  }
  .gsec h4 {
    margin: 12px 0 4px;
    font-family: var(--font-type);
    font-size: 13px;
    font-weight: 400;
    color: var(--ink-2);
  }
  .tlist {
    margin: 0;
    padding-left: 18px;
  }
  .gsec :global(li) {
    font-family: var(--font-type);
    font-size: 13.5px;
    line-height: 1.6;
    margin-bottom: 6px;
  }
  .drow {
    font-family: var(--font-type);
    font-size: 13.5px;
    line-height: 1.6;
    margin: 6px 0;
  }
  .drow b {
    color: var(--gold-light);
  }

  /* ---------- the accordion ---------- */
  .acc {
    border: 1px solid #4b4335;
    border-radius: 4px;
    overflow: hidden;
  }
  .accitem + .accitem {
    border-top: 1px solid #4b4335;
  }
  .accitem > summary {
    list-style: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    min-height: 44px;
    padding: 10px 12px;
    background: #0d0c0a;
    font-family: var(--font-type);
    color: var(--cream);
  }
  .accitem > summary::-webkit-details-marker {
    display: none;
  }
  .ad {
    font-size: 11px;
    color: var(--gold-deep);
    text-transform: uppercase;
    white-space: nowrap;
  }
  .at {
    flex: 1;
    min-width: 0;
    font-size: 14.5px;
  }
  .aw {
    font-size: 11.5px;
    color: var(--ink-2);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .chev {
    color: var(--faint);
    font-size: 13px;
    transition: transform var(--motion-fast) var(--ease-out);
  }
  .accitem[open] .chev {
    transform: rotate(180deg);
  }
  .accbody {
    background: #0d0c0a;
    color: var(--ink-2);
    font-family: var(--font-type);
    font-size: 13px;
    line-height: 1.6;
    padding: 0 12px 11px;
  }
  .accbody ul {
    margin: 0;
    padding-left: 18px;
  }
  .bed {
    margin: 6px 0 0;
    font-size: 12.5px;
  }

  /* ---------- 📍 Places today ----------
     The same chip as .gchips at the top of this page, with the same compact
     map button the driver list and Home already use. No new tokens, no new
     component: the row is a wrap of .gchip pills that happen to carry a 🗺.
     It draws only when the day has places, so there is never an empty header. */
  .dayplaces {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
  }
  .dphead {
    width: 100%;
    font-size: 11.5px;
    color: var(--faint);
  }
  .dchip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 0 2px 0 11px;
  }
  /* Clipped, not reworded — two bed titles run to fifty characters and the row
     has to stay a row. The whole string still reaches a screen reader through
     the map button's aria-label. */
  .dcname {
    max-width: 52vw;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-type);
    font-size: 12.5px;
    line-height: 1.3;
    color: var(--ink-2);
  }

  /* ---------- money rows ---------- */
  .paper .budget {
    font-family: var(--font-type);
    font-size: 14px;
    font-weight: 700;
    color: var(--cream-ink);
    margin: 8px 0 0;
    padding-top: 8px;
    border-top: 1px dashed rgba(43, 36, 25, 0.4);
  }
  .leg {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    min-height: 44px;
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

  /* ---------- options + eat & see ---------- */
  .opthead {
    display: flex;
    align-items: baseline;
    gap: 9px;
    flex-wrap: wrap;
    margin: 24px 18px 0;
    font-family: var(--font-type);
    font-size: 18px;
    font-weight: 700;
    color: var(--cream);
  }
  .opthint {
    font-family: var(--font-ui);
    font-size: 12px;
    font-weight: 500;
    color: var(--faint);
  }
  .shead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .pencil {
    color: var(--cream);
    font-size: 16px;
    opacity: 0.9;
    padding-bottom: 8px;
  }
  .placeshint {
    margin: 0 0 6px;
    font-size: 11.5px;
    color: var(--faint);
  }
  .spots {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .spots li {
    display: flex;
    align-items: center;
    gap: 11px;
    min-height: 56px;
    padding: 9px 0;
  }
  .thumb {
    flex: 0 0 auto;
    position: relative;
    width: 50px;
    height: 40px;
    border-radius: 2px;
    overflow: hidden;
    border: 3px solid var(--cream);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
    background: linear-gradient(135deg, hsl(var(--h) 48% 42%), hsl(var(--h) 45% 22%));
    display: grid;
    place-items: center;
  }
  .thumb i {
    font-style: normal;
    font-size: 17px;
  }
  .thumb :global(img) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .nm {
    flex: 1;
    min-width: 0;
    font-family: var(--font-type);
    font-size: 14px;
    color: var(--cream);
    line-height: 1.45;
  }
  .sp-name {
    font-family: var(--font-type);
  }
  .stars {
    color: var(--gold);
    letter-spacing: 1px;
  }
  .stars .off {
    color: var(--deco);
  }
  /* the honesty marker: quiet, dotted, and absent from a sourced guide */
  .vnote {
    font-family: var(--font-type);
    font-size: 11px;
    color: var(--warn);
    border-bottom: 1px dotted var(--warn);
    margin-left: 5px;
  }
  .sp-zh {
    display: block;
    font-size: 13px;
    color: var(--ink-2);
    line-height: 1.35;
  }
</style>
