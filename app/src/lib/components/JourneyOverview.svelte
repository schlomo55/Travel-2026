<script lang="ts">
  /* THE JOURNEY, AT A GLANCE — Info's route half, which Horizon gives to
     Journey (plan §1: route / stats → Journey).

     Three things, in the order the question is asked: where does the trip go
     (the route diagram), is each stop actually booked (one row per stop with
     the same chip the stop list wears — one derivation, logic/coverage.ts, so
     the two can never disagree), and the trip in numbers.

     Run 3 replaces the diagram with Replay and the constellation map; until
     then the Lantern route map is drawn here, re-skinned by the tokens. */
  import { untrack } from 'svelte';
  import type { Booking, ComplianceCounter, Expense, ISODate, PackingItem, Stop, Task, Trip } from '../model/types';
  import { buildCoverage, coverageByStop, coverageStamp } from '../logic/coverage';
  import { fmtShort } from '../logic/dates';
  import { tripStats } from '../logic/stats';
  import { fmtKm, routeDistanceKm } from '../logic/geoStats';
  import { fmtMoney, symbolFor } from '../logic/money';
  import { router } from '../state/router.svelte';
  import { S } from '../i18n/strings';
  import Md from './ui/Md.svelte';
  import RouteMap from './RouteMap.svelte';
  import EmptyState from './ui/EmptyState.svelte';
  import Icon from './horizon/Icon.svelte';

  let {
    trip,
    counters,
    stops,
    bookings,
    expenses,
    tasks,
    packing,
    now,
  }: {
    trip: Trip;
    counters: ComplianceCounter[];
    stops: Stop[];
    bookings: Booking[];
    expenses: Expense[];
    tasks: Task[];
    packing: PackingItem[];
    now: ISODate;
  } = $props();

  const realStops = $derived([...stops].filter((s) => s.kind === 'stop').sort((a, b) => a.order - b.order));
  const cover = $derived(coverageByStop(buildCoverage(trip, stops, bookings, now)));

  /* ONLY knowable numbers. A tile whose data is absent is not drawn — an
     empty tile would read as a zero, and a zero is a claim. */
  const sym = $derived(symbolFor(trip, trip.homeCurrency));
  const st = $derived(tripStats(trip, now, { stops, expenses, bookings, tasks, packing }));
  const distanceKm = $derived(routeDistanceKm(stops));
  const tiles = $derived.by(() => {
    const out: { label: string; value: string; tone: string }[] = [];
    out.push({ label: S.info.stat.days, value: String(st.days), tone: '' });
    out.push({ label: S.info.stat.stops, value: String(st.stops), tone: '' });
    if (st.nights > 0) out.push({ label: S.info.stat.nights, value: String(st.nights), tone: '' });
    if (distanceKm !== null) out.push({ label: S.info.stat.distance, value: fmtKm(distanceKm), tone: 'lilac' });
    if (expenses.length) out.push({ label: S.info.stat.spent, value: fmtMoney(st.totalMinor, sym), tone: 'sun' });
    const total = st.bookingsByStatus.booked + st.bookingsByStatus.pending + st.bookingsByStatus.walkin;
    if (total > 0) out.push({ label: S.info.stat.bookings, value: `${st.bookingsByStatus.booked}/${total}`, tone: 'ok' });
    if (st.packedTotal > 0) out.push({ label: S.info.stat.packed, value: `${st.packedDone}/${st.packedTotal}`, tone: 'ok' });
    return out;
  });

  /* An old #/map or #/stats link lands here with the section it meant. The
     hand-off is consumed once (untracked, so clearing it does not re-run this
     and cancel its own scroll), and the scroll is repeated once the trip's
     rows have had time to arrive and push the sections down. */
  $effect(() => {
    const id = router.pendingAnchor;
    if (id !== 'route' && id !== 'stats') return;
    untrack(() => (router.pendingAnchor = null));
    const go = (): void => document.getElementById(id)?.scrollIntoView({ block: 'start' });
    setTimeout(go, 150);
    setTimeout(go, 700);
  });
</script>

<section class="jsec" id="route" aria-labelledby="jroute-h">
  <div class="jhead">
    <h2 id="jroute-h" class="caps">{S.journey.route}</h2>
    {#if realStops.length}<span class="jcount">{S.info.stopsSub(realStops.length)}</span>{/if}
  </div>
  {#if realStops.length}
    <div class="routebox">
      <RouteMap {trip} {stops} {bookings} {counters} {now} />
    </div>
    <!-- The map says WHERE and WHEN; these rows say whether it is booked. -->
    <h3 class="caps sublabel">{S.plan.cover.heading}</h3>
    <ul class="stoprows">
      {#each realStops as s (s.id)}
        {@const cv = cover.get(s.id)}
        <li>
          <a class="srow" href="#/trip/{encodeURIComponent(trip.id)}/journey/{encodeURIComponent(s.id)}">
            <span class="sdot" style="--h:{s.hue}" aria-hidden="true"></span>
            <span class="sbody">
              <span class="snm"><Md text={s.name} /></span>
              <span class="swh num">{fmtShort(s.start)} → {fmtShort(s.end)}{#if s.nights} · {s.nights} n{/if}</span>
            </span>
            {#if cv}<span class="chip {cv.tone}">{coverageStamp(cv).label}</span>{/if}
            <Icon name="chevron-right" size={16} />
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <EmptyState
      compact
      glyph={S.empty.route.glyph}
      title={S.empty.route.title}
      body={S.empty.route.body}
    />
  {/if}
</section>

{#if tiles.length}
  <section class="jsec" id="stats" aria-labelledby="jstats-h">
    <div class="jhead"><h2 id="jstats-h" class="caps">{S.info.tripStatistics}</h2></div>
    <div class="statgrid">
      {#each tiles as t (t.label)}
        <div class="stat">
          <div class="sl">{t.label}</div>
          <div class="sv num {t.tone}">{t.value}</div>
        </div>
      {/each}
    </div>
    <p class="jnote">{S.info.deepMoney}</p>
  </section>
{/if}

<style>
  .jsec {
    margin: 18px 0 8px;
    scroll-margin-top: 16px;
  }
  .jhead {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 0 4px 10px;
  }
  .jhead h2 {
    margin: 0;
    color: var(--ink);
  }
  .jcount {
    font-size: var(--fs-chip);
    color: var(--faint);
  }
  .sublabel {
    margin: 16px 4px 8px;
    color: var(--faint);
  }
  .routebox {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-card);
    padding: 12px 6px 6px;
    overflow-x: auto;
  }
  .stoprows {
    list-style: none;
    margin: 0;
    padding: 4px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-card);
  }
  .srow {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 52px;
    padding: 8px 10px 8px 12px;
    border-radius: 22px;
    color: var(--ink);
    text-decoration: none;
  }
  .srow:active {
    background: var(--card-2);
  }
  .srow :global(.hicon) {
    color: var(--faint);
  }
  .sdot {
    flex-shrink: 0;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--stop);
  }
  .sbody {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .snm {
    font-size: var(--fs-row);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .swh {
    font-size: var(--fs-time);
    color: var(--ink-2);
  }
  .statgrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .stat {
    padding: 12px 14px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius-inner);
    box-shadow: var(--shadow-card);
  }
  .sl {
    font-size: var(--fs-chip);
    font-weight: 600;
    color: var(--ink-2);
  }
  .sv {
    font-size: var(--fs-countdown);
    font-weight: 500;
    line-height: 1.15;
    margin-top: 4px;
  }
  .sv.sun {
    color: var(--sunrise);
  }
  .sv.lilac {
    color: var(--lilac);
  }
  .sv.ok {
    color: var(--ok);
  }
  .jnote {
    margin: 10px 4px 0;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
</style>
