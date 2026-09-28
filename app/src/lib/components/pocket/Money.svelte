<script lang="ts">
  /* MONEY — what has been spent, against the budget, category by category;
     what is already committed; and the one-thumb quick-add, the most
     frequent write in the app.

     MONEY ANSWERS FIRST: the logged total and the category tiles answer "am
     I on budget?"; the committed ledger answers a different question and
     waits behind a tap. Every figure is in the trip's home currency and each
     entry keeps the rate it was logged with — nothing here converts at a
     rate the traveller did not use. */
  import { untrack } from 'svelte';
  import { db } from '../../db/db';
  import { mutate } from '../../data/repo';
  import { deleteEntity, plain } from '../../data/edit';
  import { newId } from '../../model/ids';
  import type { Booking, Expense, ExpenseCategory, ISODate, Stop, Trip } from '../../model/types';
  import { fmtLong, fmtShort } from '../../logic/dates';
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
  } from '../../logic/money';
  import { buildBooked } from '../../logic/booked';
  import { downloadBlob } from '../../logic/backup';
  import { dailyBurn, topCategories, tripStats } from '../../logic/stats';
  import { router } from '../../state/router.svelte';
  import { toast } from '../../state/toast.svelte';
  import { offerUndo } from '../../state/undo.svelte';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Ledger from './Ledger.svelte';

  let {
    trip,
    expenses,
    categories,
    bookings,
    stops,
    now,
    editing = false,
    onopenBooking,
    oneditBooking,
  }: {
    trip: Trip;
    expenses: Expense[];
    categories: ExpenseCategory[];
    bookings: Booking[];
    stops: Stop[];
    now: ISODate;
    editing?: boolean;
    onopenBooking: (b: Booking) => void;
    oneditBooking: (b: Booking) => void;
  } = $props();

  let filterCat = $state<string | null>(null);
  let showForm = $state(false);

  /* Pocket's Money tile says "Log a spend": arriving with that intent opens
     the quick-add at once. */
  $effect(() => {
    if (router.pendingAnchor !== 'log') return;
    router.pendingAnchor = null;
    showForm = true;
  });

  const homeSym = $derived(symbolFor(trip, trip.homeCurrency));
  const totals = $derived(categoryTotals(expenses, categories));
  const filtered = $derived(filterCat ? expenses.filter((e) => e.categoryId === filterCat) : expenses);
  const days = $derived(groupByDay(filtered));
  const totalMinor = $derived(sumMinor(expenses));
  const planMinor = $derived(trip.budgetTotalMinor ?? 0);
  const cashMinor = $derived(sumMinor(expenses.filter((e) => e.payment === 'cash')));
  const committedMinor = $derived(
    buildBooked(trip, bookings, stops, {
      flights: S.money.flights,
      travel: S.money.travel,
      stays: S.money.stays,
      docs: S.money.fromDocs,
      experiences: S.money.experiences,
      alternatives: S.money.orInstead,
    }).total.maxMinor,
  );

  const mstats = $derived(tripStats(trip, now, { stops, expenses, bookings, tasks: [], packing: [] }));
  const burn = $derived(dailyBurn(trip, expenses));
  const burnPeak = $derived(Math.max(1, ...burn.map((b) => Math.abs(b.minor))));
  const cats = $derived(topCategories(expenses, categories));
  const catMax = $derived(Math.max(1, ...cats.map((c) => c.minor)));

  /* the quick-add — seeded once at mount; the trip does not change under an open form */
  let fDate = $state(untrack(() => now));
  let fCat = $state('');
  let fDesc = $state('');
  let fAmt = $state('');
  let fCur = $state(untrack(() => trip.currencies[0]?.code ?? trip.homeCurrency));
  let fPay = $state<'card' | 'cash'>('card');
  let fRefund = $state(false);
  let bigConfirm = $state(false);

  $effect(() => {
    if (!fCat && categories.length) fCat = [...categories].sort((a, b) => a.order - b.order)[0]?.id ?? '';
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
      toast.show(S.spend.enterAmount);
      return;
    }
    const homeMinor = toHomeMinor(amt, rateFor(trip, fCur));
    /* the legacy large-amount guard: a mistyped rate is easy and expensive */
    if (homeMinor > 300_000 && !bigConfirm) {
      bigConfirm = true;
      toast.show(S.spend.really(fmtMoney(homeMinor, homeSym)));
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
    toast.show(S.spend.logged(fmtMoney(signed(entry), homeSym)));
    fAmt = '';
    fDesc = '';
    fRefund = false;
    bigConfirm = false;
  }

  async function removeEntry(e: Expense): Promise<void> {
    await deleteEntity(db.expenses, e, S.spend.deleted);
  }

  function exportCsv(): void {
    const slug = trip.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    downloadBlob(`${slug}-expenses.csv`, new Blob([expensesToCsv(expenses, categories)], { type: 'text/csv;charset=utf-8' }));
    toast.show(S.spend.exported(expenses.length));
  }

  async function editPlan(c: ExpenseCategory): Promise<void> {
    const v = prompt(S.spend.budgetFor(c.label, trip.homeCurrency), (c.planMinor / 100).toFixed(0));
    if (v == null) return;
    const n = Number(v.replace(/[^0-9.]/g, ''));
    if (!isFinite(n) || n < 0) {
      toast.show(S.spend.notANumber);
      return;
    }
    const before = c.planMinor;
    await mutate(async () => {
      await db.categories.update(c.id, { planMinor: Math.round(n * 100) });
    });
    offerUndo({
      label: S.spend.budgetUpdated,
      undo: () =>
        mutate(async () => {
          await db.categories.update(c.id, { planMinor: before });
        }),
    });
  }
  const catById = $derived(new Map(categories.map((c) => [c.id, c])));
</script>

<!-- ---------- the logged total ---------- -->
<section class="mhero">
  <span class="caps mh-cap">{S.wallet.totalSpent}</span>
  <span class="num mh-amt">{fmtMoneyWide(totalMinor, homeSym)}</span>
  <span class="num mh-committed">{S.money.committedBeside(fmtMoneyWide(committedMinor, homeSym))}</span>
  <span class="mh-trip">{trip.title}{#if planMinor} · {S.wallet.ofBudget(fmtMoneyWide(planMinor, homeSym))}{/if}</span>
</section>

<!-- ---------- the category tiles: the budget answer, and the filters ---------- -->
<div class="chips">
  {#each totals as t (t.category.id)}
    <button
      class="budget {t.state}"
      style="--dot:{t.category.color}"
      aria-pressed={filterCat === t.category.id}
      onclick={() => (filterCat = filterCat === t.category.id ? null : t.category.id)}
      ondblclick={() => editPlan(t.category)}
    >
      <span class="k"><i aria-hidden="true"></i>{t.category.label}</span>
      <span class="v num">
        {fmtMoneyWide(t.spentMinor, homeSym)}
        {#if t.planMinor > 0}<span class="of">/ {fmtMoneyWide(t.planMinor, homeSym)}</span>{/if}
      </span>
      <span class="meter" aria-hidden="true"><i style="width:{t.pct}%"></i></span>
    </button>
  {/each}
  <div class="budget total" class:over={planMinor > 0 && totalMinor > planMinor}>
    <span class="k">{S.spend.totalSpent}</span>
    <span class="v num">
      {fmtMoneyWide(totalMinor, homeSym)}
      {#if planMinor > 0}<span class="of">/ {fmtMoneyWide(planMinor, homeSym)}</span>{/if}
    </span>
    {#if planMinor > 0}
      <span class="meter" aria-hidden="true"><i style="width:{Math.min(100, Math.round((totalMinor / planMinor) * 100))}%"></i></span>
    {/if}
  </div>
</div>
{#if editing}
  <div class="planedits">
    {#each [...categories].sort((a, b) => a.order - b.order) as c (c.id)}
      <button class="editbtn" onclick={() => editPlan(c)}><Icon name="edit" size={14} /> {c.label}</button>
    {/each}
  </div>
{/if}

<Ledger {trip} {bookings} {stops} {editing} onopen={onopenBooking} onedit={oneditBooking} />

<!-- ---------- log a spend ---------- -->
{#if !showForm}
  <button class="btn primary lg wfull logbtn" onclick={() => (showForm = true)}><Icon name="plus" size={18} stroke={2.2} /> {S.spend.log}</button>
{:else}
  <form class="expform" onsubmit={add}>
    <div class="r">
      <label class="f"><span class="fl">{S.spend.date}</span><input type="date" bind:value={fDate} required /></label>
      <label class="f"
        ><span class="fl">{S.spend.category}</span>
        <select bind:value={fCat}>
          {#each [...categories].sort((a, b) => a.order - b.order) as c (c.id)}
            <option value={c.id}>{c.label}</option>
          {/each}
        </select>
      </label>
    </div>
    <label class="f"><span class="fl">{S.spend.what}</span><input type="text" bind:value={fDesc} placeholder={S.spend.whatPh} maxlength="120" /></label>
    <div class="r">
      <label class="f amt"
        ><span class="fl">{S.spend.amount}</span><input type="text" inputmode="decimal" bind:value={fAmt} placeholder="0" class="num" /></label
      >
      <label class="f"
        ><span class="fl">{S.spend.currency}</span>
        <select bind:value={fCur}>
          {#each trip.currencies as c (c.code)}
            <option value={c.code}>{c.symbol} {c.code}</option>
          {/each}
        </select>
      </label>
      <label class="f"
        ><span class="fl">{S.spend.paid}</span>
        <select bind:value={fPay}>
          <option value="card">{S.spend.card}</option>
          <option value="cash">{S.spend.cash}</option>
        </select>
      </label>
    </div>
    <div class="r bottom">
      <label class="reflab"><input type="checkbox" bind:checked={fRefund} /> {S.spend.refund}</label>
      {#if previewMinor !== null && fCur !== trip.homeCurrency}
        <span class="preview num">= {fmtMoney(previewMinor, homeSym)}</span>
      {/if}
      <button type="submit" class="btn primary" style="flex:1">{bigConfirm ? S.spend.confirm : S.spend.add}</button>
    </div>
    <button type="button" class="btn ghost wfull" onclick={() => (showForm = false)}>{S.misc.close}</button>
  </form>
{/if}

{#if trip.currencies.length > 1}
  <p class="rates">
    {S.spend.rates(
      trip.currencies
        .filter((c) => c.code !== trip.homeCurrency)
        .map((c) => `${c.symbol}${c.rateToHome} = ${homeSym}1`)
        .join(' · '),
    )}
  </p>
{/if}

<!-- ---------- the entries, day by day ---------- -->
{#if days.length === 0}
  {#if filterCat}
    <EmptyState
      compact
      glyph="search"
      title={S.empty.spendFiltered.title}
      body={S.empty.spendFiltered.body}
      actionLabel={S.empty.spendFiltered.action}
      onaction={() => (filterCat = null)}
    />
  {:else}
    <EmptyState glyph="coins" title={S.empty.spend.title} body={S.empty.spend.body} actionLabel={S.empty.spend.action} onaction={() => (showForm = true)} />
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
          <span class="dot" style="--dot:{catById.get(e.categoryId)?.color ?? 'var(--faint)'}" aria-hidden="true"></span>
          <span class="edesc">
            {e.desc || catById.get(e.categoryId)?.label || '—'}
            {#if e.payment === 'cash'}<span class="tag">{S.spend.cash}</span>{/if}
            {#if e.refund}<span class="tag ok">{S.spend.refund}</span>{/if}
          </span>
          <span class="eorig num">{symbolFor(trip, e.currency)}{e.amount}</span>
          <span class="enum num" class:neg={e.refund}>{fmtMoney(signed(e), homeSym)}</span>
          <button class="del" onclick={() => removeEntry(e)} aria-label={S.spend.delete}><Icon name="close" size={16} /></button>
        </div>
      {/each}
    {/each}
  </div>
{/if}

<div class="expfoot">
  <span>{S.spend.footer(expenses.length, fmtMoney(cashMinor, homeSym))}</span>
  <button class="btn" onclick={exportCsv} disabled={expenses.length === 0}><Icon name="download" size={16} /> CSV</button>
</div>

{#if expenses.length}
  <section class="mcard">
    <h3 class="caps">{S.spend.detail}</h3>
    <div class="mrows">
      {#if mstats.dailyAverageMinor !== null}
        <div><span>{S.spend.avgDay}</span><b class="num">{fmtMoney(mstats.dailyAverageMinor, homeSym)}</b></div>
      {/if}
      {#if mstats.projectedMinor !== null}
        <div><span>{S.spend.projected}</span><b class="num">{fmtMoneyWide(mstats.projectedMinor, homeSym)}</b></div>
      {/if}
      <div><span>{S.spend.cash}</span><b class="num">{fmtMoney(mstats.cashMinor, homeSym)}</b></div>
      <div><span>{S.spend.card}</span><b class="num">{fmtMoney(mstats.cardMinor, homeSym)}</b></div>
      {#if mstats.refundMinor > 0}<div><span>{S.spend.refunded}</span><b class="num">{fmtMoney(mstats.refundMinor, homeSym)}</b></div>{/if}
      {#if mstats.busiestDay}
        <div><span>{S.spend.biggestDay}</span><b class="num">{fmtShort(mstats.busiestDay.date)} · {fmtMoney(mstats.busiestDay.minor, homeSym)}</b></div>
      {/if}
      {#if mstats.biggest}
        <div><span>{S.spend.biggestSingle}</span><b>{mstats.biggest.desc || '—'} · <span class="num">{fmtMoney(mstats.biggest.homeMinor, homeSym)}</span></b></div>
      {/if}
    </div>
  </section>

  {#if cats.length}
    <section class="mcard">
      <h3 class="caps">{S.spend.whereItWent}</h3>
      {#each cats as c (c.label)}
        <div class="catrow">
          <span class="cl">{c.label}</span>
          <span class="cbar" aria-hidden="true"><i style="width:{Math.round((c.minor / catMax) * 100)}%; background:{c.color}"></i></span>
          <span class="cv num">{fmtMoneyWide(c.minor, homeSym)}</span>
        </div>
      {/each}
    </section>
  {/if}

  <section class="mcard">
    <h3 class="caps">{S.spend.burn}</h3>
    <div class="burn" role="img" aria-label={S.spend.burnAria}>
      {#each burn as b (b.date)}
        <span class="bcol" title="{b.date}: {fmtMoney(b.minor, homeSym)}">
          <i style="height:{Math.max(1, Math.round((Math.abs(b.minor) / burnPeak) * 100))}%" class:neg={b.minor < 0} class:today={b.date === now}></i>
        </span>
      {/each}
    </div>
    <div class="burnkey">
      <span class="num">{fmtShort(trip.start)}</span><span class="num">{S.spend.peak(fmtMoneyWide(burnPeak, homeSym))}</span><span class="num">{fmtShort(trip.end)}</span>
    </div>
  </section>
{/if}

<style>
  .mhero {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 14px;
    padding: 16px 18px;
    border-radius: var(--radius-card);
    background:
      radial-gradient(120% 90% at 100% 0%, var(--sunrise-soft), transparent 60%),
      var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
  }
  .mh-cap {
    color: var(--ink-2);
  }
  .mh-amt {
    font-size: var(--fs-countdown);
    font-weight: 500;
    line-height: 1.1;
  }
  .mh-committed {
    font-size: var(--fs-time);
    color: var(--lilac);
  }
  .mh-trip {
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  /* Two explicit minmax(0, …) tracks — a track that may shrink to nothing
     can never be pushed wider than its share, so no tile runs off a screen
     that cannot scroll sideways. */
  .chips {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 12px;
  }
  .budget {
    display: block;
    min-width: 0;
    min-height: 44px;
    padding: 10px 12px;
    text-align: left;
    color: var(--ink);
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius-inner);
    box-shadow: var(--shadow-card);
  }
  .budget[aria-pressed='true'] {
    border-color: var(--sunrise);
    box-shadow: inset 0 0 0 1px var(--sunrise);
  }
  .budget .k {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    font-size: var(--fs-chip);
    font-weight: 600;
    color: var(--ink-2);
    overflow-wrap: anywhere;
  }
  .budget .k i {
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--dot, var(--faint));
  }
  .budget .v {
    display: block;
    margin-top: 3px;
    font-size: var(--fs-code);
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .budget .of {
    font-size: var(--fs-caps);
    font-weight: 500;
    color: var(--ink-2);
  }
  .budget .meter {
    display: block;
    height: 4px;
    margin-top: 7px;
    border-radius: 2px;
    background: var(--scene-track);
    overflow: hidden;
  }
  .budget .meter i {
    display: block;
    height: 100%;
    border-radius: 2px;
    background: var(--sunrise-fill);
  }
  .budget.warn .meter i {
    background: var(--warn);
  }
  .budget.over .meter i {
    background: var(--crit);
  }
  .budget.total {
    grid-column: 1 / -1;
    border-color: color-mix(in srgb, var(--sunrise) 45%, transparent);
  }
  .budget.total .v {
    font-size: 20px;
  }
  .budget.total.over {
    border-color: var(--crit-line);
  }
  .planedits {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin: -2px 0 14px;
  }
  .logbtn {
    margin-bottom: 12px;
  }
  .expform {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 14px;
    padding: 14px;
    border-radius: var(--radius-card);
    background: var(--card);
    border: 1px solid color-mix(in srgb, var(--sunrise) 36%, transparent);
    box-shadow: var(--glow-2);
  }
  .expform .r {
    display: flex;
    gap: 8px;
  }
  .expform .r > * {
    flex: 1;
    min-width: 0;
  }
  .f {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .fl {
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .f input,
  .f select {
    width: 100%;
  }
  .f.amt {
    flex: 0 0 104px;
  }
  .bottom {
    align-items: center;
  }
  .reflab {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex: 0 0 auto !important;
    min-height: 44px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .reflab input {
    width: 22px;
    height: 22px;
  }
  .preview {
    flex: 0 0 auto !important;
    font-size: var(--fs-time);
    font-weight: 600;
    color: var(--sunrise);
  }
  .rates {
    margin: -2px 4px 12px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .table {
    border-radius: var(--radius-inner);
    background: var(--card);
    border: 1px solid var(--line);
    overflow: hidden;
  }
  .dhead {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--card-2);
    font-size: var(--fs-caption);
    font-weight: 600;
    color: var(--ink-2);
  }
  .erow {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 6px 6px 12px;
    border-top: 1px solid var(--line);
    font-size: var(--fs-caption);
  }
  .dot {
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--dot);
  }
  .edesc {
    flex: 1;
    min-width: 0;
  }
  .eorig {
    white-space: nowrap;
    font-size: var(--fs-time);
    color: var(--ink-2);
  }
  .enum {
    white-space: nowrap;
    font-weight: 600;
  }
  .enum.neg {
    color: var(--ok);
  }
  .tag {
    margin-left: 6px;
    padding: 1px 7px;
    border-radius: 999px;
    border: 1px solid var(--edge);
    font-size: var(--fs-caps);
    color: var(--ink-2);
  }
  .tag.ok {
    color: var(--ok-ink);
    border-color: var(--ok-line);
  }
  .del {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: var(--radius-chip-sm);
    border: 1px solid transparent;
    background: none;
    color: var(--faint);
  }
  .del:active {
    border-color: var(--crit);
    color: var(--crit);
  }
  .expfoot {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 12px 0 14px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .expfoot span {
    flex: 1;
  }
  .mcard {
    margin-bottom: 12px;
    padding: 14px 16px;
    border-radius: var(--radius-tile);
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
  }
  .mcard h3 {
    margin: 0 0 8px;
    color: var(--ink-2);
  }
  .mrows div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid var(--line);
    font-size: var(--fs-caption);
  }
  .mrows div:last-child {
    border-bottom: none;
  }
  .mrows span {
    color: var(--ink-2);
  }
  .mrows b {
    font-weight: 600;
    text-align: right;
  }
  .catrow {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 0;
  }
  .cl {
    flex-shrink: 0;
    width: 96px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .cbar {
    flex: 1;
    height: 8px;
    border-radius: 4px;
    background: var(--scene-track);
    overflow: hidden;
  }
  .cbar i {
    display: block;
    height: 100%;
    border-radius: 4px;
  }
  .cv {
    width: 70px;
    text-align: right;
    font-size: var(--fs-time);
    font-weight: 600;
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
    border-radius: 2px 2px 0 0;
    background: var(--route-lit);
    opacity: 0.85;
  }
  .bcol i.neg {
    background: var(--ok);
  }
  .bcol i.today {
    background: var(--route-today);
    opacity: 1;
  }
  .burnkey {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
</style>
