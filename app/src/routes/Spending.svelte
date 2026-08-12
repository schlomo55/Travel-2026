<script lang="ts">
  import { untrack } from 'svelte';
  import { db } from '../lib/db/db';
  import { mutate } from '../lib/data/repo';
  import { deleteEntity, plain } from '../lib/data/edit';
  import { newId } from '../lib/model/ids';
  import type { Booking, Expense, ExpenseCategory, ISODate, Stop, Trip } from '../lib/model/types';
  import { fmtLong } from '../lib/logic/dates';
  import {
    categoryTotals,
    expensesToCsv,
    fmtMoney,
    fmtMoneyWide,
    groupByDay,
    rateFor,
    signed,
    sumMinor,
    symbolFor,
    toHomeMinor,
  } from '../lib/logic/money';
  import { downloadBlob } from '../lib/logic/backup';
  import { dailyBurn, topCategories, tripStats } from '../lib/logic/stats';
  import { fmtShort } from '../lib/logic/dates';
  import { toast } from '../lib/state/toast.svelte';
  import { offerUndo } from '../lib/state/undo.svelte';
  import BookedCosts from '../lib/components/cards/BookedCosts.svelte';
  import EmptyState from '../lib/components/ui/EmptyState.svelte';
  import { S } from '../lib/i18n/strings';

  let {
    trip,
    expenses,
    categories,
    bookings = [],
    stops = [],
    now,
    editing = false,
    onopenBooking,
    oneditBooking,
  }: {
    trip: Trip;
    expenses: Expense[];
    categories: ExpenseCategory[];
    bookings?: Booking[];
    stops?: Stop[];
    now: ISODate;
    editing?: boolean;
    onopenBooking?: (b: Booking) => void;
    oneditBooking?: (b: Booking) => void;
  } = $props();

  let filterCat = $state<string | null>(null);
  let showForm = $state(false);

  const homeSym = $derived(symbolFor(trip, trip.homeCurrency));
  const totals = $derived(categoryTotals(expenses, categories));
  const filtered = $derived(filterCat ? expenses.filter((e) => e.categoryId === filterCat) : expenses);
  const days = $derived(groupByDay(filtered));
  const totalMinor = $derived(sumMinor(expenses));
  const planMinor = $derived(trip.budgetTotalMinor ?? 0);
  const cashMinor = $derived(sumMinor(expenses.filter((e) => e.payment === 'cash')));

  /* The deep money view came here when the standalone Stats route was folded
     away (plan §SCREENS 6): the numbers that are about money belong beside
     the money, and the numbers that are about the journey went to Info. */
  const mstats = $derived(tripStats(trip, now, { stops, expenses, bookings, tasks: [], packing: [] }));
  const burn = $derived(dailyBurn(trip, expenses));
  const burnPeak = $derived(Math.max(1, ...burn.map((b) => Math.abs(b.minor))));
  const cats = $derived(topCategories(expenses, categories));
  const catMax = $derived(Math.max(1, ...cats.map((c) => c.minor)));

  /* quick-add form — one thumb, the highest-frequency action in the app.
     Seeded once at mount; the trip does not change under an open form. */
  let fDate = $state(untrack(() => now));
  let fCat = $state('');
  let fDesc = $state('');
  let fAmt = $state('');
  let fCur = $state(untrack(() => trip.currencies[0]?.code ?? trip.homeCurrency));
  let fPay = $state<'card' | 'cash'>('card');
  let fRefund = $state(false);
  let bigConfirm = $state(false);

  $effect(() => {
    if (!fCat && categories.length) fCat = categories[0]?.id ?? '';
  });

  const previewMinor = $derived.by(() => {
    const amt = parseFloat(fAmt.replace(/[^0-9.]/g, ''));
    if (!isFinite(amt) || amt <= 0) return null;
    return toHomeMinor(amt, rateFor(trip, fCur));
  });

  async function add(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    const amt = parseFloat(fAmt.replace(/[^0-9.]/g, ''));
    if (!isFinite(amt) || amt <= 0) {
      toast.show('Enter an amount');
      return;
    }
    const homeMinor = toHomeMinor(amt, rateFor(trip, fCur));
    /* the legacy large-amount guard: a mistyped rate is easy and expensive */
    if (homeMinor > 300_000 && !bigConfirm) {
      bigConfirm = true;
      toast.show(`Really ${fmtMoney(homeMinor, homeSym)}? Tap Add again.`);
      setTimeout(() => (bigConfirm = false), 5000);
      return;
    }
    const entry: Expense = {
      id: newId(),
      tripId: trip.id,
      date: fDate,
      categoryId: fCat || (categories[0]?.id ?? ''),
      desc: fDesc.trim().slice(0, 120),
      amount: amt,
      currency: fCur,
      rateToHome: rateFor(trip, fCur),
      homeMinor,
      payment: fPay,
      refund: fRefund,
      ts: Date.now(),
    };
    await mutate(async () => {
      await db.expenses.put(plain(entry));
    });
    toast.show(`${fmtMoney(signed(entry), homeSym)} logged`);
    fAmt = '';
    fDesc = '';
    fRefund = false;
    bigConfirm = false;
  }

  async function removeEntry(e: Expense): Promise<void> {
    await deleteEntity(db.expenses, e, 'Entry deleted');
  }

  function exportCsv(): void {
    const slug = trip.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    downloadBlob(`${slug}-expenses.csv`, new Blob([expensesToCsv(expenses, categories)], { type: 'text/csv;charset=utf-8' }));
    toast.show(`${expenses.length} entries exported`);
  }

  async function editPlan(c: ExpenseCategory): Promise<void> {
    const v = prompt(`Budget for ${c.label} (${trip.homeCurrency})`, (c.planMinor / 100).toFixed(0));
    if (v == null) return;
    const n = Number(v.replace(/[^0-9.]/g, ''));
    if (!isFinite(n) || n < 0) {
      toast.show('Not a number');
      return;
    }
    const before = c.planMinor;
    await mutate(async () => {
      await db.categories.update(c.id, { planMinor: Math.round(n * 100) });
    });
    offerUndo({ label: 'Budget updated', undo: () => mutate(async () => { await db.categories.update(c.id, { planMinor: before }); }) });
  }
</script>

<!-- MONEY ANSWERS FIRST. The budget meter and the category chips are the
     answer to "am I on budget?"; the committed ledger is the answer to a
     different question and used to be printed in front of it. -->
<div class="chips">
  {#each totals as t (t.category.id)}
    <button
      class="chip {t.state}"
      style="--dot:{t.category.color}"
      aria-pressed={filterCat === t.category.id}
      onclick={() => (filterCat = filterCat === t.category.id ? null : t.category.id)}
      ondblclick={() => editPlan(t.category)}
    >
      <span class="k"><i></i>{t.category.label}</span>
      <span class="v">
        {fmtMoneyWide(t.spentMinor, homeSym)}
        {#if t.planMinor > 0}<span class="of">/ {fmtMoneyWide(t.planMinor, homeSym)}</span>{/if}
      </span>
      <span class="meter"><i style="width:{t.pct}%"></i></span>
    </button>
  {/each}

  <div class="chip total" class:over={planMinor > 0 && totalMinor > planMinor}>
    <span class="k">Total spent</span>
    <span class="v">
      {fmtMoneyWide(totalMinor, homeSym)}
      {#if planMinor > 0}<span class="of">/ {fmtMoneyWide(planMinor, homeSym)}</span>{/if}
    </span>
    {#if planMinor > 0}
      <span class="meter"><i style="width:{Math.min(100, Math.round((totalMinor / planMinor) * 100))}%"></i></span>
    {/if}
  </div>
</div>

<BookedCosts {trip} {bookings} {stops} {editing} onopen={onopenBooking} onedit={oneditBooking} />

{#if !showForm}
  <button class="btn primary wfull" style="margin-bottom:12px" onclick={() => (showForm = true)}>＋ Log a spend</button>
{:else}
  <form class="expform" onsubmit={add}>
    <div class="r">
      <input type="date" bind:value={fDate} required />
      <select bind:value={fCat}>
        {#each [...categories].sort((a, b) => a.order - b.order) as c (c.id)}
          <option value={c.id}>{c.label}</option>
        {/each}
      </select>
    </div>
    <div class="r">
      <input type="text" bind:value={fDesc} placeholder="What was it?" maxlength="120" />
    </div>
    <div class="r">
      <input type="text" inputmode="decimal" bind:value={fAmt} placeholder="Amount" class="amt" />
      <select bind:value={fCur}>
        {#each trip.currencies as c (c.code)}
          <option value={c.code}>{c.symbol} {c.code}</option>
        {/each}
      </select>
      <select bind:value={fPay}>
        <option value="card">💳 Card</option>
        <option value="cash">💵 Cash</option>
      </select>
    </div>
    <div class="r bottom">
      <label class="reflab"><input type="checkbox" bind:checked={fRefund} /> refund</label>
      {#if previewMinor !== null && fCur !== trip.homeCurrency}
        <span class="preview">= {fmtMoney(previewMinor, homeSym)}</span>
      {/if}
      <button type="submit" class="btn primary" style="flex:1">{bigConfirm ? 'Confirm' : 'Add'}</button>
    </div>
    <button type="button" class="btn ghost wfull" onclick={() => (showForm = false)}>Close</button>
  </form>
{/if}

{#if trip.currencies.length > 1}
  <p class="small" style="margin:-4px 0 12px">
    Rates: {trip.currencies.filter((c) => c.code !== trip.homeCurrency).map((c) => `${c.symbol}${c.rateToHome} = ${homeSym}1`).join(' · ')}.
    Each entry keeps the rate it was logged with.
  </p>
{/if}

{#if days.length === 0}
  {#if filterCat}
    <EmptyState
      compact
      glyph={S.empty.spendFiltered.glyph}
      title={S.empty.spendFiltered.title}
      body={S.empty.spendFiltered.body}
      actionLabel={S.empty.spendFiltered.action}
      onaction={() => (filterCat = null)}
    />
  {:else}
    <EmptyState
      glyph={S.empty.spend.glyph}
      title={S.empty.spend.title}
      body={S.empty.spend.body}
      actionLabel={S.empty.spend.action}
      onaction={() => (showForm = true)}
    />
  {/if}
{:else}
  <div class="table">
    {#each days as d (d.date)}
      <div class="dhead">
        <span>{fmtLong(d.date)}</span>
        <span class="num">{fmtMoney(d.totalMinor, homeSym)}</span>
      </div>
      {#each d.entries as e (e.id)}
        <div class="erow">
          <span class="dot" style="--dot:{categories.find((c) => c.id === e.categoryId)?.color ?? 'var(--faint)'}"></span>
          <span class="edesc">
            {e.desc || categories.find((c) => c.id === e.categoryId)?.label || '—'}
            {#if e.payment === 'cash'}<span class="tag">cash</span>{/if}
            {#if e.refund}<span class="tag jade">refund</span>{/if}
          </span>
          <span class="eorig small">{symbolFor(trip, e.currency)}{e.amount}</span>
          <span class="num" class:neg={e.refund}>{fmtMoney(signed(e), homeSym)}</span>
          <button class="del" onclick={() => removeEntry(e)} aria-label="Delete">✕</button>
        </div>
      {/each}
    {/each}
  </div>
{/if}

<div class="expfoot">
  <span>{expenses.length} entries · cash {fmtMoney(cashMinor, homeSym)}</span>
  <button class="btn ghost small-btn" onclick={exportCsv} disabled={expenses.length === 0}>⬇ CSV</button>
</div>

{#if expenses.length}
  <section class="card">
    <h3>The money in detail</h3>
    <div class="mrows">
      {#if mstats.dailyAverageMinor !== null}
        <div><span>Average spending day</span><b>{fmtMoney(mstats.dailyAverageMinor, homeSym)}</b></div>
      {/if}
      {#if mstats.projectedMinor !== null}
        <div><span>At this rate, whole trip</span><b>{fmtMoneyWide(mstats.projectedMinor, homeSym)}</b></div>
      {/if}
      <div><span>Cash</span><b>{fmtMoney(mstats.cashMinor, homeSym)}</b></div>
      <div><span>Card</span><b>{fmtMoney(mstats.cardMinor, homeSym)}</b></div>
      {#if mstats.refundMinor > 0}<div><span>Refunded</span><b>{fmtMoney(mstats.refundMinor, homeSym)}</b></div>{/if}
      {#if mstats.busiestDay}
        <div><span>Biggest day</span><b>{fmtShort(mstats.busiestDay.date)} · {fmtMoney(mstats.busiestDay.minor, homeSym)}</b></div>
      {/if}
      {#if mstats.biggest}
        <div><span>Biggest single</span><b>{mstats.biggest.desc || '—'} · {fmtMoney(mstats.biggest.homeMinor, homeSym)}</b></div>
      {/if}
    </div>
  </section>

  {#if cats.length}
    <section class="card">
      <h3>Where it went</h3>
      {#each cats as c (c.label)}
        <div class="catrow">
          <span class="cl">{c.label}</span>
          <span class="cbar"><i style="width:{Math.round((c.minor / catMax) * 100)}%; background:{c.color}"></i></span>
          <span class="cv">{fmtMoneyWide(c.minor, homeSym)}</span>
        </div>
      {/each}
    </section>
  {/if}

  <section class="card">
    <h3>Daily burn</h3>
    <div class="burn" role="img" aria-label="Spending per day across the trip">
      {#each burn as b (b.date)}
        <span class="bcol" title="{b.date}: {fmtMoney(b.minor, homeSym)}">
          <i style="height:{Math.max(1, Math.round((Math.abs(b.minor) / burnPeak) * 100))}%"
             class:neg={b.minor < 0} class:today={b.date === now}></i>
        </span>
      {/each}
    </div>
    <div class="small" style="display:flex; justify-content:space-between; margin-top:4px">
      <span>{fmtShort(trip.start)}</span><span>peak {fmtMoneyWide(burnPeak, homeSym)}</span><span>{fmtShort(trip.end)}</span>
    </div>
  </section>
{/if}

<style>
  /* ---------- the deep money view (was the Stats route) ---------- */
  .mrows div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 7px 0;
    border-bottom: 1px dashed var(--line);
    font-size: var(--text-sm);
  }
  .mrows div:last-child {
    border-bottom: none;
  }
  .mrows span {
    color: var(--ink-2);
  }
  .mrows b {
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
    font-size: var(--text-sm);
    color: var(--ink-2);
    flex-shrink: 0;
  }
  .cbar {
    flex: 1;
    height: 9px;
    background: var(--paper-2);
    border-radius: 5px;
    overflow: hidden;
  }
  .cbar i {
    display: block;
    height: 100%;
    border-radius: 5px;
  }
  .cv {
    width: 62px;
    text-align: right;
    font-size: var(--text-sm);
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
    background: var(--gold);
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
  /* `1fr 1fr` is minmax(auto, 1fr): un-wrappable chip labels blew each track
     out to ~228 px inside a 362 px box, so the right column ran off a screen
     that cannot scroll sideways (body has overflow-x: hidden) — half of the
     weekly budget answer, and half of the category FILTERS, unreachable.
     **minmax(0, …) is the fix**: a track that may shrink to nothing can never
     be pushed wider than its share. Letting the label wrap is the other half.

     Two explicit tracks, not `repeat(auto-fit, …)`: with a zero minimum,
     auto-fit has nothing to size against and fills the row with as many tracks
     as it can — measured at 412 px it produced EIGHT ~38 px columns, which is
     off-screen content solved by making it illegible instead. */
  .chips {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 12px;
  }
  /* These are budget tiles, not status chips — but they carry the same class
     name, so app.css's `.chip` was quietly making every one of them an
     `inline-flex` row with `white-space: nowrap`. That is where the width came
     from: label, amount and meter were laid out SIDE BY SIDE and forbidden to
     wrap, blowing each grid track past the screen. Three declarations put the
     tile back: it stacks, and its text is allowed to break. */
  .chips .chip {
    display: block;
    white-space: normal;
    min-width: 0;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 9px 11px;
    text-align: left;
  }
  .chip[aria-pressed='true'] {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent) inset;
  }
  .chip .k {
    color: var(--ink-2);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.6px;
    display: flex;
    align-items: center;
    gap: 5px;
    /* the label wraps instead of forcing the track wider than the screen */
    flex-wrap: wrap;
    overflow-wrap: anywhere;
  }
  .chip .k i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--dot, var(--faint));
    flex-shrink: 0;
  }
  .chip .v {
    display: block;
    font-weight: 700;
    font-size: var(--text-base);
    font-variant-numeric: tabular-nums;
    margin-top: 2px;
    overflow-wrap: anywhere;
  }
  .chip .v .of {
    color: var(--faint);
    font-weight: 500;
    font-size: var(--text-xs);
  }
  .chip .meter {
    display: block;
    height: 4px;
    border-radius: 2px;
    background: var(--paper-2);
    margin-top: 6px;
    overflow: hidden;
  }
  .chip .meter i {
    display: block;
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
    transition: width 0.3s;
  }
  .chip.warn .meter i {
    background: var(--warn);
  }
  .chip.over .meter i {
    background: var(--crit);
  }
  .chip.total {
    grid-column: 1 / -1;
    border-color: var(--accent);
  }
  .chip.total .v {
    font-size: var(--text-lg);
  }
  .chip.total.over {
    border-color: var(--crit);
  }
  /* the quick-add is a bespoke editor, so it takes the sheet's manners:
     a lit frame, 44 px controls, gold focus (app.css) */
  .expform {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 14px;
    background: var(--card);
    border: 1px solid color-mix(in srgb, var(--gold) 28%, var(--line));
    border-radius: var(--radius);
    padding: 14px;
    box-shadow: var(--glow-2);
  }
  .expform .r {
    display: flex;
    gap: 8px;
  }
  .expform .r > * {
    min-width: 0;
    flex: 1;
  }
  .amt {
    flex: 0 0 100px;
    font-variant-numeric: tabular-nums;
  }
  .bottom {
    align-items: center;
  }
  .reflab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: var(--text-sm);
    color: var(--ink-2);
    flex: 0 0 auto;
  }
  .reflab input {
    width: 22px;
    height: 22px;
    accent-color: var(--gold);
  }
  .preview {
    font-size: var(--text-sm);
    color: var(--accent-deep);
    font-weight: 650;
    flex: 0 0 auto;
  }
  .table {
    border: 1px solid var(--line);
    border-radius: 12px;
    overflow: hidden;
    background: var(--card);
  }
  .dhead {
    display: flex;
    justify-content: space-between;
    background: var(--paper-2);
    padding: 7px 11px;
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--ink-2);
  }
  .erow {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 11px;
    border-bottom: 1px solid var(--line);
    font-size: var(--text-sm);
  }
  .erow:last-child {
    border-bottom: none;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--dot);
    flex-shrink: 0;
  }
  .edesc {
    flex: 1;
    min-width: 0;
  }
  .eorig {
    white-space: nowrap;
  }
  .num {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    font-weight: 650;
  }
  .num.neg {
    color: var(--ok);
  }
  .tag {
    font-size: var(--text-xs);
    border: 1px solid var(--line-2);
    border-radius: 10px;
    padding: 1px 6px;
    color: var(--faint);
    margin-left: 5px;
  }
  .tag.jade {
    color: var(--ok);
    border-color: color-mix(in srgb, var(--ok) 45%, var(--line));
  }
  .del {
    background: none;
    border: 1px solid transparent;
    border-radius: 9px;
    color: var(--faint);
    font-size: var(--text-base);
    min-width: 40px;
    min-height: 40px;
    flex-shrink: 0;
  }
  .del:active {
    border-color: var(--crit);
    color: var(--crit);
  }
  .expfoot {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 12px;
    font-size: var(--text-sm);
    color: var(--ink-2);
  }
  .expfoot span {
    flex: 1;
  }
  .small-btn {
    min-height: 44px;
    padding: 7px 16px;
    font-size: var(--text-sm);
  }
</style>
