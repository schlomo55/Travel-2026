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
  import { toast } from '../lib/state/toast.svelte';
  import { offerUndo } from '../lib/state/undo.svelte';
  import BookedCosts from '../lib/components/cards/BookedCosts.svelte';

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

<BookedCosts {trip} {bookings} {stops} {editing} onopen={onopenBooking} onedit={oneditBooking} />

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
  <section class="card"><p class="muted" style="margin:0">Nothing logged{filterCat ? ' in this category' : ''} yet.</p></section>
{:else}
  <div class="table">
    {#each days as d (d.date)}
      <div class="dhead">
        <span>{fmtLong(d.date)}</span>
        <span class="num">{fmtMoney(d.totalMinor, homeSym)}</span>
      </div>
      {#each d.entries as e (e.id)}
        <div class="erow">
          <span class="dot" style="--dot:{categories.find((c) => c.id === e.categoryId)?.color ?? '#888'}"></span>
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

<style>
  .chips {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 12px;
  }
  .chip {
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
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .chip .k i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--dot, #888);
    flex-shrink: 0;
  }
  .chip .v {
    display: block;
    font-weight: 700;
    font-size: 14.5px;
    font-variant-numeric: tabular-nums;
    margin-top: 2px;
  }
  .chip .v .of {
    color: var(--faint);
    font-weight: 500;
    font-size: 11px;
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
    font-size: 17px;
  }
  .chip.total.over {
    border-color: var(--crit);
  }
  .expform {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
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
    font-size: 12.5px;
    color: var(--ink-2);
    flex: 0 0 auto;
  }
  .reflab input {
    width: 18px;
    height: 18px;
    accent-color: var(--accent);
  }
  .preview {
    font-size: 12.5px;
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
    font-size: 11.5px;
    font-weight: 700;
    color: var(--ink-2);
  }
  .erow {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 11px;
    border-bottom: 1px solid var(--line);
    font-size: 13px;
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
    font-size: 10px;
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
    border: none;
    color: var(--faint);
    font-size: 14px;
    padding: 4px 6px;
  }
  .expfoot {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 12px;
    font-size: 12.5px;
    color: var(--ink-2);
  }
  .expfoot span {
    flex: 1;
  }
  .small-btn {
    min-height: 38px;
    padding: 7px 14px;
    font-size: 12.5px;
  }
</style>
