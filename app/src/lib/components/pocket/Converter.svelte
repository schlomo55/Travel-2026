<script lang="ts">
  /* THE CONVERTER — money, without a network.

     Three rules, and they are the whole design:
     1. it NEVER fetches — a rate that needs a network is a blank card behind
        the Firewall, which is the one place this was needed;
     2. every rate says where it came from and how old it is, because a rate
        with no date is a rumour;
     3. the traveller can overwrite any of them with the number on the board,
        and that is then labelled as theirs.
     Arithmetic and provenance: lib/logic/convert.ts. */
  import { db } from '../../db/db';
  import { live } from '../../data/live.svelte';
  import { mutate } from '../../data/repo';
  import { fmtShort } from '../../logic/dates';
  import {
    convert,
    findRate,
    fmtAmount,
    isRateEdits,
    parseRateInput,
    rateLine,
    rateSources,
    type RateEdits,
    type RateSource,
  } from '../../logic/convert';
  import type { Expense, ISODate, Trip } from '../../model/types';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';

  const { trip, expenses, now }: { trip: Trip; expenses: Expense[]; now: ISODate } = $props();

  const RATES_KEY = 'convert.rates';
  const editsLive = live(() => db.meta.get(RATES_KEY));
  const edits = $derived.by<RateEdits>(() => {
    const v = editsLive.current?.value;
    return isRateEdits(v) ? v : {};
  });
  const sources = $derived(rateSources(trip, expenses, edits));

  let fromCode = $state('');
  let toCode = $state('');
  const from = $derived(findRate(sources, fromCode || trip.homeCurrency));
  const to = $derived(
    findRate(sources, toCode || (sources.find((s) => s.code !== trip.homeCurrency)?.code ?? trip.homeCurrency)),
  );

  let amount = $state('100');
  const parsed = $derived(Number(amount.replace(',', '.')));
  const result = $derived(convert(parsed, from, to));
  const line = $derived(rateLine(from, to));

  let editing = $state(false);
  let rateInput = $state('');

  function provenance(s: RateSource | null): string | null {
    if (!s) return null;
    if (s.origin === 'edited' && s.asOf) return S.convert.fromYou(fmtShort(s.asOf));
    if (s.origin === 'expense' && s.asOf) return S.convert.fromSpending(fmtShort(s.asOf));
    return S.convert.fromTrip;
  }
  function swap(): void {
    const a = from?.code ?? trip.homeCurrency;
    const b = to?.code ?? trip.homeCurrency;
    fromCode = b;
    toCode = a;
  }
  async function saveRate(): Promise<void> {
    const value = parseRateInput(rateInput);
    if (!value || !to) return;
    const next: RateEdits = { ...edits, [to.code]: { rateToHome: value, setAt: now } };
    await mutate(() => db.meta.put({ key: RATES_KEY, value: next }));
    editing = false;
    rateInput = '';
  }
  async function clearRate(): Promise<void> {
    if (!to) return;
    const next: RateEdits = { ...edits };
    delete next[to.code];
    await mutate(() => db.meta.put({ key: RATES_KEY, value: next }));
  }
</script>

<section class="convcard" id="convert">
  <label class="amt">
    <span class="caps lbl">{S.convert.amount}</span>
    <input class="num" inputmode="decimal" bind:value={amount} aria-label={S.convert.amount} />
  </label>
  <div class="pair">
    <select value={from?.code ?? ''} onchange={(e) => (fromCode = e.currentTarget.value)} aria-label={S.convert.fromCur}>
      {#each sources as s (s.code)}<option value={s.code}>{s.symbol} {s.code}</option>{/each}
    </select>
    <button class="iconbtn swapbtn" onclick={swap} aria-label={S.convert.swap} title={S.convert.swap}><Icon name="swap" size={18} /></button>
    <select value={to?.code ?? ''} onchange={(e) => (toCode = e.currentTarget.value)} aria-label={S.convert.toCur}>
      {#each sources as s (s.code)}<option value={s.code}>{s.symbol} {s.code}</option>{/each}
    </select>
  </div>

  <div class="out" aria-live="polite">
    {#if result === null}
      <span class="norate">{S.convert.noRate}</span>
    {:else}
      <b class="num big">{to?.symbol ?? ''}{fmtAmount(result)}</b>
    {/if}
  </div>
  {#if line}<div class="rateline num">{line}</div>{/if}
  {#if provenance(to)}<div class="prov">{provenance(to)}</div>{/if}

  {#if editing}
    <div class="editrow">
      <input class="num" inputmode="decimal" bind:value={rateInput} placeholder={S.convert.ratePh} aria-label={S.convert.editRate} />
      <button class="btn primary" onclick={saveRate}>{S.convert.saveRate}</button>
    </div>
    <p class="never">{S.convert.neverFetches}</p>
  {:else}
    <div class="acts">
      <button class="btn" onclick={() => (editing = true)}><Icon name="edit" size={16} /> {S.convert.editRate}</button>
      {#if to?.origin === 'edited'}
        <button class="btn ghost" onclick={clearRate}>{S.convert.clear}</button>
      {/if}
    </div>
  {/if}
</section>

<style>
  .convcard {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px;
    border-radius: var(--radius-card);
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
  }
  .amt {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .lbl {
    color: var(--ink-2);
  }
  .amt input {
    width: 100%;
    font-size: var(--fs-countdown);
    font-weight: 500;
    min-height: 60px;
  }
  .pair {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pair select {
    flex: 1;
    min-width: 0;
    font-weight: 600;
  }
  .out {
    margin-top: 4px;
  }
  .big {
    font-size: var(--fs-hero-code);
    font-weight: 500;
    line-height: 1.1;
    color: var(--sunrise);
    overflow-wrap: anywhere;
  }
  .norate {
    font-size: var(--fs-body);
    color: var(--ink-2);
  }
  .rateline {
    font-size: var(--fs-time);
    color: var(--ink-2);
  }
  .prov {
    margin-top: -6px;
    font-size: var(--fs-caption);
    color: var(--faint);
  }
  .acts,
  .editrow {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .editrow input {
    flex: 1 1 120px;
    min-width: 0;
  }
  .never {
    margin: -4px 0 0;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
</style>
