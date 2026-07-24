<script lang="ts">
  import type { Booking, ComplianceCounter, Expense, ExpenseCategory, ISODate, PackingItem, Stop, Task, Trip } from '../lib/model/types';
  import { dailyBurn, topCategories, tripStats } from '../lib/logic/stats';
  import { fmtMoney, fmtMoneyWide, symbolFor } from '../lib/logic/money';
  import { fmtShort } from '../lib/logic/dates';
  import RouteMap from '../lib/components/RouteMap.svelte';

  let {
    trip,
    stops,
    expenses,
    categories,
    bookings,
    tasks,
    packing,
    counters,
    now,
  }: {
    trip: Trip;
    stops: Stop[];
    expenses: Expense[];
    categories: ExpenseCategory[];
    bookings: Booking[];
    tasks: Task[];
    packing: PackingItem[];
    counters: ComplianceCounter[];
    now: ISODate;
  } = $props();

  const sym = $derived(symbolFor(trip, trip.homeCurrency));
  const s = $derived(tripStats(trip, now, { stops, expenses, bookings, tasks, packing }));
  const burn = $derived(dailyBurn(trip, expenses));
  const peak = $derived(Math.max(1, ...burn.map((b) => Math.abs(b.minor))));
  const cats = $derived(topCategories(expenses, categories));
  const catMax = $derived(Math.max(1, ...cats.map((c) => c.minor)));
</script>

<main class="wrap" style="padding-top:16px">
  <h1 class="pagename">Stats <span class="pagesub">{trip.title}</span></h1>

  <section class="card">
    <h3>The route</h3>
    <RouteMap {trip} {stops} {bookings} {counters} {now} />
  </section>

  <section class="card">
    <h3>At a glance</h3>
    <div class="tiles">
      <div class="tile"><span class="n">{s.days}</span><span class="l">days</span></div>
      <div class="tile"><span class="n">{s.stops}</span><span class="l">stops</span></div>
      <div class="tile"><span class="n">{s.nights}</span><span class="l">nights</span></div>
      <div class="tile"><span class="n">{s.entries}</span><span class="l">entries</span></div>
    </div>
  </section>

  <section class="card">
    <h3>Money</h3>
    <div class="bigmoney">{fmtMoney(s.totalMinor, sym)}</div>
    {#if s.planMinor > 0}
      <div class="muted">
        of {fmtMoneyWide(s.planMinor, sym)} planned ·
        <b class:over={s.totalMinor > s.planMinor}>
          {fmtMoneyWide(Math.abs(s.planMinor - s.totalMinor), sym)} {s.totalMinor > s.planMinor ? 'over' : 'left'}
        </b>
      </div>
    {/if}
    <div class="rows">
      {#if s.dailyAverageMinor !== null}
        <div><span>Average spending day</span><b>{fmtMoney(s.dailyAverageMinor, sym)}</b></div>
      {/if}
      {#if s.projectedMinor !== null}
        <div><span>At this rate, whole trip</span><b>{fmtMoneyWide(s.projectedMinor, sym)}</b></div>
      {/if}
      <div><span>Cash</span><b>{fmtMoney(s.cashMinor, sym)}</b></div>
      <div><span>Card</span><b>{fmtMoney(s.cardMinor, sym)}</b></div>
      {#if s.refundMinor > 0}<div><span>Refunded</span><b>{fmtMoney(s.refundMinor, sym)}</b></div>{/if}
      {#if s.busiestDay}
        <div><span>Biggest day</span><b>{fmtShort(s.busiestDay.date)} · {fmtMoney(s.busiestDay.minor, sym)}</b></div>
      {/if}
      {#if s.biggest}
        <div><span>Biggest single</span><b>{s.biggest.desc || '—'} · {fmtMoney(s.biggest.homeMinor, sym)}</b></div>
      {/if}
    </div>
  </section>

  {#if cats.length}
    <section class="card">
      <h3>Where it went</h3>
      {#each cats as c (c.label)}
        <div class="catrow">
          <span class="cl">{c.label}</span>
          <span class="bar"><i style="width:{Math.round((c.minor / catMax) * 100)}%; background:{c.color}"></i></span>
          <span class="cv">{fmtMoneyWide(c.minor, sym)}</span>
        </div>
      {/each}
    </section>
  {/if}

  {#if expenses.length}
    <section class="card">
      <h3>Daily burn</h3>
      <div class="burn" role="img" aria-label="Spending per day across the trip">
        {#each burn as b (b.date)}
          <span class="bcol" title="{b.date}: {fmtMoney(b.minor, sym)}">
            <i style="height:{Math.max(1, Math.round((Math.abs(b.minor) / peak) * 100))}%"
               class:neg={b.minor < 0} class:today={b.date === now}></i>
          </span>
        {/each}
      </div>
      <div class="small" style="display:flex; justify-content:space-between; margin-top:4px">
        <span>{fmtShort(trip.start)}</span><span>peak {fmtMoneyWide(peak, sym)}</span><span>{fmtShort(trip.end)}</span>
      </div>
    </section>
  {/if}

  <section class="card">
    <h3>Progress</h3>
    <div class="rows">
      <div><span>Bookings confirmed</span><b>{s.bookingsByStatus.booked} of {s.bookingsByStatus.booked + s.bookingsByStatus.pending + s.bookingsByStatus.walkin}</b></div>
      {#if s.bookingsByStatus.pending}<div><span>Still to book</span><b class="over">{s.bookingsByStatus.pending}</b></div>{/if}
      <div><span>Tasks done</span><b>{s.tasksDone} of {s.tasksTotal}</b></div>
      <div><span>Packed</span><b>{s.packedDone} of {s.packedTotal}</b></div>
    </div>
  </section>
</main>

<style>
  .tiles {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  .tile {
    background: var(--paper-2);
    border-radius: 11px;
    padding: 10px 6px;
    text-align: center;
  }
  .tile .n {
    display: block;
    font-family: var(--font-display);
    font-size: 24px;
    line-height: 1.1;
  }
  .tile .l {
    display: block;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--faint);
  }
  .bigmoney {
    font-family: var(--font-display);
    font-size: 38px;
    line-height: 1.1;
  }
  .over {
    color: var(--crit);
  }
  .rows {
    margin-top: 10px;
  }
  .rows div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 7px 0;
    border-bottom: 1px dashed var(--line);
    font-size: 13.5px;
  }
  .rows div:last-child {
    border-bottom: none;
  }
  .rows span {
    color: var(--ink-2);
  }
  .rows b {
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .catrow {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 5px 0;
  }
  .cl {
    width: 92px;
    font-size: 12px;
    color: var(--ink-2);
    flex-shrink: 0;
  }
  .bar {
    flex: 1;
    height: 9px;
    background: var(--paper-2);
    border-radius: 5px;
    overflow: hidden;
  }
  .bar i {
    display: block;
    height: 100%;
    border-radius: 5px;
  }
  .cv {
    width: 62px;
    text-align: right;
    font-size: 12.5px;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }
  .burn {
    display: flex;
    align-items: flex-end;
    gap: 1px;
    height: 74px;
  }
  .bcol {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: flex-end;
    min-width: 2px;
  }
  .bcol i {
    display: block;
    width: 100%;
    background: var(--accent);
    border-radius: 2px 2px 0 0;
    opacity: 0.85;
  }
  .bcol i.neg {
    background: var(--ok);
  }
  .bcol i.today {
    background: var(--crit);
    opacity: 1;
  }
</style>
