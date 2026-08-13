<script lang="ts">
  /* The offline converter (Lantern Run C, C2.1).
   *
   * Three rules, and they are the whole design:
   *
   * 1. it NEVER fetches — a rate that needs a network is a blank card behind
   *    the Firewall, which is the one place this was needed;
   * 2. every rate says where it came from and how old it is, because a rate
   *    with no date is a rumour;
   * 3. the traveller can overwrite any of them with the number on the board,
   *    and that is then labelled as theirs.
   *
   * Arithmetic and provenance: lib/logic/convert.ts.
   */
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

  interface Props {
    trip: Trip;
    expenses: Expense[];
    /** Today, previewed or real — the date an edited rate is stamped with. */
    now: ISODate;
  }
  const { trip, expenses, now }: Props = $props();

  const RATES_KEY = 'convert.rates';
  const editsLive = live(() => db.meta.get(RATES_KEY));
  const edits = $derived.by<RateEdits>(() => {
    const v = editsLive.current?.value;
    return isRateEdits(v) ? v : {};
  });

  const sources = $derived(rateSources(trip, expenses, edits));

  /* Empty means "not chosen yet", and the defaults are derived from the trip:
     what the traveller thinks in, and the first currency that is not it. */
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
    /* Plain object built here — nothing from $state crosses into Dexie. */
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

<section class="card u-rise convcard" id="convert">
  <h3>💱 {S.convert.title} <span class="h3sub">· {S.convert.subtitle}</span></h3>

  <div class="row">
    <label class="amt">
      <span class="lbl">{S.convert.amount}</span>
      <input inputmode="decimal" bind:value={amount} aria-label={S.convert.amount} />
    </label>
    <label class="cur">
      <span class="lbl">&nbsp;</span>
      <select
        value={from?.code ?? ''}
        onchange={(e) => (fromCode = e.currentTarget.value)}
        aria-label={S.convert.amount}
      >
        {#each sources as s (s.code)}<option value={s.code}>{s.code}</option>{/each}
      </select>
    </label>
    <button class="swapbtn" onclick={swap} aria-label={S.convert.swap} title={S.convert.swap}>⇄</button>
    <label class="cur">
      <span class="lbl">&nbsp;</span>
      <select
        value={to?.code ?? ''}
        onchange={(e) => (toCode = e.currentTarget.value)}
        aria-label={S.convert.title}
      >
        {#each sources as s (s.code)}<option value={s.code}>{s.code}</option>{/each}
      </select>
    </label>
  </div>

  <div class="out" aria-live="polite">
    {#if result === null}
      <span class="norate">{S.convert.noRate}</span>
    {:else}
      <b class="big">{to?.symbol ?? ''}{fmtAmount(result)}</b>
    {/if}
  </div>

  {#if line}
    <div class="rateline mono">{line}</div>
  {/if}
  <!-- WHERE THE NUMBER CAME FROM. A rate with no provenance is a rumour, and
       this app does not print rumours as facts. -->
  {#if provenance(to)}
    <div class="small prov">{provenance(to)}</div>
  {/if}

  {#if editing}
    <div class="editrow">
      <input
        inputmode="decimal"
        bind:value={rateInput}
        placeholder={S.convert.ratePh}
        aria-label={S.convert.editRate}
      />
      <button class="btn primary small-btn" onclick={saveRate}>{S.convert.saveRate}</button>
    </div>
    <p class="small" style="margin:7px 0 0">{S.convert.neverFetches}</p>
  {:else}
    <div class="acts">
      <button class="btn ghost small-btn" onclick={() => (editing = true)}>✎ {S.convert.editRate}</button>
      {#if to?.origin === 'edited'}
        <button class="btn ghost small-btn" onclick={clearRate}>{S.convert.clear}</button>
      {/if}
    </div>
  {/if}
</section>

<style>
  .row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    flex-wrap: wrap;
  }
  .lbl {
    display: block;
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.4px;
    color: var(--faint);
    margin-bottom: 3px;
  }
  .amt {
    flex: 1 1 110px;
    min-width: 0;
  }
  .amt input {
    width: 100%;
    font-family: var(--font-mono);
    font-size: var(--text-lg);
  }
  .cur {
    flex: 0 0 auto;
  }
  .cur select {
    min-height: 44px;
    font-size: var(--text-sm);
    font-weight: 700;
  }
  .swapbtn {
    flex: 0 0 auto;
    min-width: 44px;
    min-height: 44px;
    border: 1px solid var(--line-2);
    border-radius: var(--radius-sm);
    background: var(--card-2);
    color: var(--ink);
    font-size: var(--text-base);
  }
  .out {
    margin-top: 13px;
  }
  .big {
    font-family: var(--font-mono);
    font-size: var(--text-title);
    font-weight: 600;
    color: var(--gold);
    letter-spacing: -0.5px;
  }
  .norate {
    font-size: var(--text-base);
    color: var(--ink-2);
  }
  .rateline {
    margin-top: 2px;
    font-size: var(--text-sm);
    color: var(--ink-2);
  }
  .prov {
    margin-top: 2px;
  }
  .acts,
  .editrow {
    display: flex;
    gap: 9px;
    margin-top: 12px;
    flex-wrap: wrap;
  }
  .editrow input {
    flex: 1 1 120px;
    min-width: 0;
    font-family: var(--font-mono);
  }
  .small-btn {
    min-height: 44px;
    padding: 7px 15px;
    font-size: var(--text-sm);
  }
</style>
