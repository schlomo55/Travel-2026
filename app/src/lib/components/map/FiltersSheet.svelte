<script lang="ts">
  /* WHAT TO SHOW ON THE MAP (map4-filters) — every category with its glyph,
     its colour, how many of its places are on the map here (and how many more
     open by name only), a few of their names, and a switch; hotels: your own
     beds only, or every hotel the trip names; the distance rings. A Sheet, so
     Android back closes it (router.pushLayer). The colours are place types;
     green, amber and red stay for booking status. */
  import type { PlaceCategory } from '../../model/types';
  import { CATEGORIES, type MapPlace } from '../../logic/mapplaces';
  import { router } from '../../state/router.svelte';
  import { catColour, glyphOf } from '../../map/icons';
  import { S } from '../../i18n/strings';
  import Sheet from '../ui/Sheet.svelte';
  import MapIcon from './MapIcon.svelte';

  let {
    where,
    places,
    off,
    hotels,
    rings,
    onchange,
    onclose,
  }: {
    where: string;
    /** the places in view of the filters: this city's, pinned or not */
    places: MapPlace[];
    off: ReadonlySet<PlaceCategory>;
    hotels: 'beds' | 'all';
    rings: boolean;
    onchange: (next: { off: Set<PlaceCategory>; hotels: 'beds' | 'all'; rings: boolean }) => void;
    onclose: () => void;
  } = $props();

  const rows = $derived(
    CATEGORIES.map((c) => {
      const mine = places.filter((p) => p.category === c);
      const pinnedHere = mine.filter((p) => p.pos && (c !== 'hotel' || hotels === 'all' || p.kind === 'bed' || p.with.some((w) => w.kind === 'bed')));
      return { c, pinned: pinnedHere.length, byName: mine.filter((p) => !p.pos).length, names: mine.slice(0, 4).map((p) => p.label) };
    }).filter((r) => r.pinned + r.byName > 0),
  );
  const shownCount = $derived(rows.filter((r) => !off.has(r.c)).reduce((n, r) => n + r.pinned, 0));
  const total = $derived(rows.reduce((n, r) => n + r.pinned, 0));

  function flip(c: PlaceCategory, on: boolean): void {
    const next = new Set(off);
    if (on) next.delete(c);
    else next.add(c);
    onchange({ off: next, hotels, rings });
  }
</script>

<Sheet title={S.mapTab.showTitle} {onclose}>
  <p class="fl-sub">{S.mapTab.showSub(where, total)}</p>
  <div class="fl-rows">
    {#each rows as r (r.c)}
      <label class="switch fl-row" style="--c: {catColour(r.c)}">
        <span class="fl-disc" aria-hidden="true"><MapIcon name={glyphOf(r.c)} size={16} /></span>
        <span class="sw-label fl-text">
          <span class="fl-name">{S.mapTab.catChip[r.c]} <span class="num fl-n">{r.pinned}</span>{#if r.byName}<span class="fl-by">{S.mapTab.byName(r.byName)}</span>{/if}</span>
          <span class="fl-names">{r.names.join(' · ')}</span>
        </span>
        <input type="checkbox" role="switch" checked={!off.has(r.c)} onchange={(e) => flip(r.c, e.currentTarget.checked)} aria-label={S.mapTab.showCat(S.mapTab.catChip[r.c])} />
      </label>
    {/each}
  </div>

  <div class="fl-hotels" role="radiogroup" aria-label={S.mapTab.hotelsShown}>
    <span class="fl-hl">{S.mapTab.hotelsShown}</span>
    <div class="fl-seg">
      <button role="radio" aria-checked={hotels === 'beds'} class:on={hotels === 'beds'} onclick={() => onchange({ off: new Set(off), hotels: 'beds', rings })}>{S.mapTab.yourBeds}</button>
      <button role="radio" aria-checked={hotels === 'all'} class:on={hotels === 'all'} onclick={() => onchange({ off: new Set(off), hotels: 'all', rings })}>{S.mapTab.allHotels}</button>
    </div>
  </div>

  <label class="switch fl-rings">
    <span class="fl-ringsic" aria-hidden="true"><MapIcon name="rings" size={22} /></span>
    <span class="sw-label fl-text">
      <span class="fl-name">{S.mapTab.ringsRow}</span>
      <span class="num fl-names">{S.mapTab.ringsLine}</span>
    </span>
    <input type="checkbox" role="switch" checked={rings} onchange={(e) => onchange({ off: new Set(off), hotels, rings: e.currentTarget.checked })} />
  </label>

  <button class="btn primary lg wfull fl-go" onclick={() => void router.closeTopLayer()}>{S.mapTab.showN(shownCount)}</button>
  <p class="fl-note">{S.mapTab.statusNote}</p>
</Sheet>

<style>
  .fl-sub {
    margin: -6px 0 4px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .fl-rows {
    display: flex;
    flex-direction: column;
  }
  .fl-row {
    min-height: 52px;
    border-bottom: 1px solid var(--line);
  }
  .fl-disc {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 999px;
    box-sizing: border-box;
    color: var(--c);
    background: var(--card-2);
    border: 1.5px solid var(--c);
  }
  .fl-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .fl-name {
    font-size: var(--fs-row);
    font-weight: 600;
    color: var(--ink);
  }
  .fl-n {
    font-size: var(--fs-chip);
    font-weight: 500;
    color: var(--ink-2);
  }
  .fl-by {
    margin-left: 6px;
    font-size: var(--fs-chip);
    font-weight: 500;
    color: var(--faint);
  }
  .fl-names {
    font-size: var(--fs-chip);
    font-weight: 500;
    color: var(--ink-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .fl-hotels {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 14px;
  }
  .fl-hl {
    flex: 1;
    font-size: var(--fs-caption);
    font-weight: 600;
    color: var(--ink-2);
  }
  .fl-seg {
    display: flex;
    padding: 3px;
    border-radius: 999px;
    background: var(--card-2);
    border: 1px solid var(--edge);
  }
  .fl-seg button {
    min-height: 44px;
    padding: 0 14px;
    border: none;
    border-radius: 999px;
    font-size: var(--fs-caption);
    font-weight: 700;
    color: var(--ink-2);
    background: transparent;
  }
  .fl-seg button.on {
    color: var(--on-sunrise);
    background: var(--sunrise-fill);
  }
  .fl-rings {
    margin-top: 10px;
    padding: 8px 12px 8px 14px;
    border-radius: 20px;
    background: var(--card);
    border: 1px solid var(--line);
  }
  .fl-ringsic {
    flex-shrink: 0;
    display: flex;
    color: var(--sunrise);
  }
  .fl-go {
    margin-top: 12px;
  }
  .fl-note {
    margin: 10px 0 0;
    font-size: var(--fs-chip);
    line-height: 1.4;
    text-align: center;
    color: var(--faint);
    text-wrap: balance;
  }
</style>
