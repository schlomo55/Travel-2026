<script lang="ts">
  /* THE NEW-TRIP WIZARD, in Horizon: a name, the dates, the home currency and
     the trip's own colour — enough for an empty trip you fill in as you go.
     The fuller way in (the trip brief, compiled into a file and imported) is
     named at the foot of the create form, because it is how a trip with its
     bookings and days already in it arrives. */
  import { untrack } from 'svelte';
  import { db } from '../lib/db/db';
  import { mutate, updateSettings } from '../lib/data/repo';
  import { newId } from '../lib/model/ids';
  import type { ExpenseCategory, Trip } from '../lib/model/types';
  import { isIsoDate } from '../lib/logic/dates';
  import { DEFAULT_CATEGORIES } from '../lib/logic/swatches';
  import { router } from '../lib/state/router.svelte';
  import { toast } from '../lib/state/toast.svelte';
  import { S } from '../lib/i18n/strings';
  import Icon from '../lib/components/horizon/Icon.svelte';
  import DateField from '../lib/components/ui/DateField.svelte';

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
    /* The six swatches are DATA — they are written into the database and into
       every backup — so they are named in logic/swatches.ts rather than in
       app.css, where a `var(--…)` would not survive the export. */
    return DEFAULT_CATEGORIES.map(([label, color], i) => ({
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
      void router.closeTopLayer();
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
    /* the sheet's step back lands first: gone to at once, the new trip was
       pushed under it and the step landed on the shelf (Run 4b) */
    await router.closeTopLayer();
    router.goTab(id, 'now');
  }
</script>

<form onsubmit={save} class="wform">
  <label class="field">
    <span class="klabel">{S.wizard.name}</span>
    <input bind:value={name} placeholder={S.wizard.namePh} maxlength="60" required />
  </label>
  <label class="field">
    <span class="klabel">{S.wizard.subtitle}</span>
    <input bind:value={subtitle} placeholder={S.wizard.subtitlePh} maxlength="80" />
  </label>
  <div class="row">
    <label class="field grow">
      <span class="klabel">{S.wizard.start}</span>
      <DateField bind:value={start} required />
    </label>
    <label class="field grow">
      <span class="klabel">{S.wizard.end}</span>
      <DateField bind:value={end} required />
    </label>
  </div>
  <div class="row">
    <label class="field emoji">
      <span class="klabel">{S.wizard.emoji}</span>
      <input bind:value={emoji} maxlength="4" />
    </label>
    {#if !trip}
      <label class="field grow">
        <span class="klabel">{S.wizard.currency}</span>
        <select bind:value={currency}>
          {#each CURRENCIES as [code, sym] (code)}
            <option value={code}>{sym} {code}</option>
          {/each}
        </select>
      </label>
    {/if}
  </div>
  {#if !trip}<p class="hint">{S.wizard.currencyHint}</p>{/if}

  <div>
    <span class="klabel flabel">{S.wizard.accent}</span>
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

  {#if err}<div class="err" role="alert"><Icon name="alert" size={16} /> {err}</div>{/if}
  <button class="btn primary lg wfull" type="submit">
    {trip ? S.wizard.save : S.wizard.create}
  </button>

  {#if !trip}
    <aside class="brief">
      <span class="b-ic" aria-hidden="true"><Icon name="doc" size={16} /></span>
      <span class="b-text">
        <b>{S.wizard.briefTitle}</b>
        <span>{S.wizard.briefBody}</span>
      </span>
    </aside>
  {/if}
</form>

<style>
  .wform {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .grow {
    flex: 1;
  }
  .emoji {
    width: 92px;
    flex-shrink: 0;
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
  .hint {
    margin: -8px 2px 0;
    font-size: var(--fs-caption);
    color: var(--ink-2);
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
    width: 32px;
    height: 32px;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    border: 1px solid var(--line);
    background: var(--sw);
  }
  .swatch.on::before {
    box-shadow:
      0 0 0 3px var(--card),
      0 0 0 5px var(--sunrise);
  }
  .err {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--crit-ink);
    font-size: var(--fs-label);
    font-weight: 600;
    background: var(--crit-soft);
    border: 1px solid var(--crit-line);
    border-radius: var(--radius-button-sm);
    padding: 11px 13px;
  }
  .brief {
    display: flex;
    gap: 12px;
    padding: 14px;
    border-radius: var(--radius-tile);
    border: 1.5px dashed var(--edge);
    color: var(--ink-2);
    font-size: var(--fs-caption);
    line-height: 1.45;
  }
  .b-ic {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 999px;
    color: var(--lilac-ink);
    background: var(--lilac-soft);
    border: 1px solid var(--lilac-line);
  }
  .b-text {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .b-text b {
    font-size: var(--fs-label);
    font-weight: 600;
    color: var(--ink);
  }
</style>
