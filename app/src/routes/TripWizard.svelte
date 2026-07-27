<script lang="ts">
  import { untrack } from 'svelte';
  import { db } from '../lib/db/db';
  import { mutate, updateSettings } from '../lib/data/repo';
  import { newId } from '../lib/model/ids';
  import type { ExpenseCategory, Trip } from '../lib/model/types';
  import { isIsoDate } from '../lib/logic/dates';
  import { router } from '../lib/state/router.svelte';
  import { toast } from '../lib/state/toast.svelte';
  import { S } from '../lib/i18n/strings';

  let { trip = null }: { trip?: Trip | null } = $props();

  const CURRENCIES: [string, string][] = [
    ['USD', '$'],
    ['EUR', '€'],
    ['ILS', '₪'],
    ['GBP', '£'],
    ['JPY', '¥'],
    ['CNY', '¥'],
    ['CHF', 'CHF'],
    ['AUD', 'A$'],
    ['CAD', 'C$'],
    ['THB', '฿'],
    ['INR', '₹'],
    ['VND', '₫'],
  ];
  const ACCENTS: { h: number; name: string }[] = [
    { h: 8, name: 'Vermilion' },
    { h: 30, name: 'Amber' },
    { h: 95, name: 'Olive' },
    { h: 150, name: 'Jade' },
    { h: 195, name: 'Petrol' },
    { h: 215, name: 'Ink blue' },
    { h: 262, name: 'Violet' },
    { h: 330, name: 'Plum' },
  ];

  /* Seed values: the form owns its state from mount. The sheet is remounted per
     open, so later prop changes are not something we want to track here. */
  const seed = untrack(() => trip);

  let name = $state(seed?.title ?? '');
  let subtitle = $state(seed?.subtitle ?? '');
  let emoji = $state(seed?.emoji ?? '');
  let start = $state(seed?.start ?? '');
  let end = $state(seed?.end ?? '');
  let currency = $state(seed?.homeCurrency ?? 'USD');
  let hue = $state(seed?.accentHue ?? 215);
  let err = $state('');

  function defaultCategories(tripId: string): ExpenseCategory[] {
    const defs: [string, string][] = [
      ['Transport', '#3987e5'],
      ['Lodging', '#9085e9'],
      ['Food', '#c98500'],
      ['Activities', '#199e70'],
      ['Shopping', '#d55181'],
      ['Other', '#898781'],
    ];
    return defs.map(([label, color], i) => ({
      id: newId(),
      tripId,
      label,
      planMinor: 0,
      color,
      order: i,
    }));
  }

  async function save(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim()) {
      err = S.wizard.errName;
      return;
    }
    if (!isIsoDate(start) || !isIsoDate(end) || end < start) {
      err = S.wizard.errDates;
      return;
    }
    err = '';
    const sym = CURRENCIES.find(([c]) => c === currency)?.[1] ?? currency;

    if (trip) {
      await mutate(() =>
        db.trips.update(trip.id, {
          title: name.trim(),
          subtitle: subtitle.trim() || undefined,
          emoji: emoji.trim() || undefined,
          start,
          end,
          accentHue: hue,
          updatedAt: Date.now(),
        }),
      );
      toast.show(S.wizard.updated);
      router.closeTopLayer();
      return;
    }

    const id = newId();
    const t: Trip = {
      id,
      title: name.trim(),
      subtitle: subtitle.trim() || undefined,
      emoji: emoji.trim() || undefined,
      start,
      end,
      homeCurrency: currency,
      currencies: [{ code: currency, symbol: sym, rateToHome: 1 }],
      accentHue: hue,
      clocks: [],
      archived: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await mutate(async () => {
      await db.trips.put(t);
      await db.categories.bulkPut(defaultCategories(id));
    });
    await updateSettings({ activeTripId: id });
    toast.show(S.wizard.created);
    router.closeTopLayer();
    router.goTab(id, 'today');
  }
</script>

<form onsubmit={save} class="wform">
  <label>
    <span>{S.wizard.name}</span>
    <input bind:value={name} placeholder={S.wizard.namePh} maxlength="60" required />
  </label>
  <label>
    <span>{S.wizard.subtitle}</span>
    <input bind:value={subtitle} placeholder={S.wizard.subtitlePh} maxlength="80" />
  </label>
  <div class="row">
    <label style="flex:1">
      <span>{S.wizard.start}</span>
      <input type="date" bind:value={start} required />
    </label>
    <label style="flex:1">
      <span>{S.wizard.end}</span>
      <input type="date" bind:value={end} required />
    </label>
  </div>
  <div class="row">
    <label style="width:88px">
      <span>{S.wizard.emoji}</span>
      <input bind:value={emoji} placeholder="🇯🇵" maxlength="4" />
    </label>
    {#if !trip}
      <label style="flex:1">
        <span>{S.wizard.currency}</span>
        <select bind:value={currency}>
          {#each CURRENCIES as [code, sym] (code)}
            <option value={code}>{sym} {code}</option>
          {/each}
        </select>
      </label>
    {/if}
  </div>
  {#if !trip}<div class="small">{S.wizard.currencyHint}</div>{/if}

  <div>
    <span class="flabel">{S.wizard.accent}</span>
    <div class="swatches" role="radiogroup" aria-label={S.wizard.accent}>
      {#each ACCENTS as a (a.h)}
        <button
          type="button"
          class="swatch"
          class:on={hue === a.h}
          style="--h:{a.h}; --sw:var(--stop)"
          aria-label={a.name}
          aria-pressed={hue === a.h}
          onclick={() => (hue = a.h)}
        ></button>
      {/each}
    </div>
  </div>

  {#if err}<div class="err">{err}</div>{/if}
  <button class="btn primary wfull" type="submit" style="--accent-h:{hue}">
    {trip ? S.wizard.save : S.wizard.create}
  </button>
</form>

<style>
  .wform {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  label span,
  .flabel {
    font-size: 11px;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    color: var(--ink-2);
    font-weight: 700;
  }
  .flabel {
    display: block;
    margin-bottom: 8px;
  }
  input,
  select {
    width: 100%;
  }
  .row {
    display: flex;
    gap: 10px;
  }
  /* one row of eight — same grid as SchemaForm's hue field */
  .swatches {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 4px;
  }
  .swatch {
    position: relative;
    width: 100%;
    height: 44px;
    border-radius: 50%;
    border: none;
    background: none;
    padding: 0;
  }
  .swatch::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 34px;
    height: 34px;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    border: 2px solid var(--line-2);
    background: var(--sw);
  }
  .swatch.on::before {
    border-color: var(--ink);
    box-shadow: 0 0 0 2.5px var(--paper-2), 0 0 0 4.5px var(--gold);
  }
  .err {
    color: var(--crit);
    font-size: 13.5px;
    font-weight: 650;
    background: var(--crit-bg);
    border: 1px solid color-mix(in srgb, var(--crit) 45%, var(--line));
    border-radius: var(--radius-sm);
    padding: 11px 13px;
  }
</style>
