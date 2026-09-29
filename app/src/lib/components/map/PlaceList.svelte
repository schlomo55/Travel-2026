<script lang="ts">
  /* EVERY PLACE, AS A LIST (Map 5c, a11y) — what the map draws, for a thumb
     that would rather read and for a screen reader, which cannot see a pin:
     grouped by category in the filters' order, each row its name and Chinese,
     its category, its one line and — from your real position — its distance
     and direction. Then the places that open by name, with no pin yet. A row
     opens the place's sheet (the list closes first — close, then go). */
  import type { PlaceCategory } from '../../model/types';
  import { CATEGORIES, openable, type MapPlace } from '../../logic/mapplaces';
  import { byDistanceThenName, compass16, compassWords, distanceSpoken, distanceText } from '../../logic/wayfind';
  import { catColour, glyphOf } from '../../map/icons';
  import { S } from '../../i18n/strings';
  import Sheet from '../ui/Sheet.svelte';
  import MapIcon from './MapIcon.svelte';
  import MapButtons from '../ui/MapButtons.svelte';

  let {
    where,
    places,
    away,
    onopen,
    onclose,
  }: {
    where: string;
    places: MapPlace[];
    /** from your real position, when worth showing */
    away: (p: MapPlace) => { m: number; deg: number } | null;
    onopen: (p: MapPlace) => void;
    onclose: () => void;
  } = $props();

  const groups = $derived(
    CATEGORIES.map((c: PlaceCategory) => ({
      c,
      /* the ones with a distance first, nearest first; then the rest by name (Map 5d) */
      list: byDistanceThenName(
        places.filter((p) => p.pos && p.category === c).map((p) => ({ p, a: away(p) })),
        (x) => x.a?.m,
        (x) => x.p.name,
      ),
    })).filter((g) => g.list.length),
  );
  const byName = $derived(places.filter((p) => !p.pos && openable(p.target)));
</script>

<Sheet title={S.mapTab.listTitle(where)} {onclose}>
  {#if !groups.length && !byName.length}<p class="pl-none">{S.mapTab.nothingHere}</p>{/if}
  {#each groups as g (g.c)}
    <h3 class="caps pl-h" style="color: {catColour(g.c)}">{S.mapTab.catChip[g.c]} · <span class="num">{g.list.length}</span></h3>
    <ul class="pl-list">
      {#each g.list as { p, a } (p.id)}
        {@const dist = a ? `${distanceText(a.m)} ${compass16(a.deg)}` : null}
        <li>
          <button
            class="pl-row"
            style="--c: {catColour(p.category)}"
            onclick={() => onopen(p)}
            aria-label={S.mapTab.placeAria(p.name, S.mapTab.cat[p.category], a ? `${distanceSpoken(a.m)} ${compassWords(compass16(a.deg))}` : null)}
            aria-describedby={p.detail ? `pld-${p.id}` : undefined}
          >
            <span class="pl-disc" aria-hidden="true"><MapIcon name={glyphOf(p.category, p.name, p.native)} size={16} /></span>
            <span class="pl-body">
              <span class="pl-name">{p.name}{#if p.native}<span class="pl-zh zh" lang="zh">{p.native}</span>{/if}</span>
              {#if p.detail}<span class="pl-detail" id="pld-{p.id}">{p.detail}</span>{/if}
            </span>
            {#if dist}<span class="num pl-dist">{dist}</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/each}

  {#if byName.length}
    <h3 class="caps pl-h">{S.mapTab.noPinYet} · <span class="num">{byName.length}</span></h3>
    <ul class="pl-list">
      {#each byName as p (p.id)}
        <li class="pl-named" style="--c: {catColour(p.category)}">
          <span class="pl-disc" aria-hidden="true"><MapIcon name={glyphOf(p.category, p.name, p.native)} size={16} /></span>
          <span class="pl-body">
            <span class="pl-name">{p.name}{#if p.native}<span class="pl-zh zh" lang="zh">{p.native}</span>{/if}</span>
            <span class="pl-detail">{S.mapTab.cat[p.category]}{p.detail ? ` · ${p.detail}` : ''}</span>
          </span>
          <MapButtons coord={p.target.coord} name={p.name} query={p.target.query} address={p.target.address} city={p.target.city} url={p.target.url} compact />
        </li>
      {/each}
    </ul>
  {/if}
</Sheet>

<style>
  .pl-none {
    margin: 0;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .pl-h {
    margin: 16px 0 6px;
    color: var(--faint);
    letter-spacing: 0.14em;
  }
  .pl-h:first-child {
    margin-top: 4px;
  }
  .pl-list {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .pl-row,
  .pl-named {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 56px;
    padding: 8px 4px;
    border: none;
    border-bottom: 1px solid var(--line);
    background: none;
    color: var(--ink);
    text-align: left;
  }
  .pl-row:focus-visible {
    outline-offset: -4px;
  }
  .pl-disc {
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
  .pl-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .pl-name {
    font-size: var(--fs-row);
    font-weight: 600;
  }
  .pl-zh {
    margin-left: 8px;
    font-family: var(--font-zh);
    font-size: var(--fs-caption);
    font-weight: 400;
    color: var(--ink-2);
  }
  .pl-detail {
    font-size: var(--fs-caption);
    line-height: 1.4;
    color: var(--ink-2);
  }
  .pl-dist {
    flex-shrink: 0;
    font-size: var(--fs-chip);
    color: var(--ink);
  }
</style>
