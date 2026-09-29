<script lang="ts">
  /* NEAR YOU (map4-map) — the peek sheet's rail: the places round you,
     nearest first, each a card — its glyph and category word, its name and
     its Chinese, its one line (the trip's own words), the straight-line
     distance and the bearing arrow when your position makes it worth
     showing, and Navigate. With no position the rail is "Around here",
     nearest the middle of the map, with no distance at all. The last card
     opens the whole list (a screen reader's way to every place).

     A card is one tap to its sheet (the name button, stretched over the
     card) and one to Guide me (Navigate, above it). */
  import type { MapPlace } from '../../logic/mapplaces';
  import { compass16, distanceText, type Ranged } from '../../logic/wayfind';
  import { catColour, glyphOf } from '../../map/icons';
  import { revealFocus } from '../ui/revealFocus';
  import { S } from '../../i18n/strings';
  import MapIcon from './MapIcon.svelte';

  let {
    items,
    total,
    measured,
    today,
    onopen,
    onnavigate,
    onlist,
  }: {
    /** nearest first; `m` and `deg` from you, or from the map's middle */
    items: Ranged<MapPlace>[];
    /** every place in view of the list, for the last card */
    total: number;
    /** the distances are from your real position and worth showing */
    measured: (r: Ranged<MapPlace>) => boolean;
    today: (p: MapPlace) => boolean;
    onopen: (p: MapPlace, from: HTMLElement) => void;
    onnavigate: (p: MapPlace) => void;
    onlist: () => void;
  } = $props();
</script>

<ul class="rail" use:revealFocus>
  {#each items as r (r.item.id)}
    {@const p = r.item}
    {@const lit = today(p)}
    {@const dist = measured(r) ? `${distanceText(r.m)} ${compass16(r.deg)}` : null}
    <li class="rc" class:lit style="--c: {catColour(p.category)}">
      <div class="rc-top">
        <span class="rc-disc" aria-hidden="true"><MapIcon name={glyphOf(p.category, p.name, p.native)} size={15} /></span>
        <span class="rc-cat">{S.mapTab.cat[p.category]}</span>
        {#if lit}<span class="rc-today">{S.mapTab.today}</span>{/if}
      </div>
      <button
        class="rc-open"
        data-place={p.id}
        onclick={(e) => onopen(p, e.currentTarget)}
        aria-label={S.mapTab.placeAria(p.name, S.mapTab.cat[p.category], dist)}
        aria-describedby={p.detail ? `rcd-${p.id}` : undefined}
      >
        <span class="rc-names">
          <span class="rc-name">{p.name}</span>
          {#if p.native}<span class="rc-zh zh" lang="zh">{p.native}</span>{/if}
        </span>
        {#if p.detail}<span class="rc-detail" id="rcd-{p.id}">{p.detail}</span>{/if}
      </button>
      <div class="rc-foot">
        {#if dist}
          <span class="rc-dist num">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="transform: rotate({r.deg}deg); stroke: var(--c)"
              ><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg
            >
            {dist}
          </span>
        {:else}
          <span class="rc-dist"></span>
        {/if}
        {#if p.pos}
          <button class="rc-nav" onclick={() => onnavigate(p)} aria-label={S.mapTab.navigateTo(p.name)}>
            <MapIcon name="navigate" size={15} stroke={2} />
            {S.mapTab.navigate}
          </button>
        {/if}
      </div>
    </li>
  {/each}
  {#if total > items.length || total > 0}
    <li class="rc all">
      <button class="rc-list" onclick={onlist}>
        <MapIcon name="list" size={20} />
        <span>{S.mapTab.listAll(total)}</span>
      </button>
    </li>
  {/if}
</ul>

<style>
  .rail {
    display: flex;
    gap: 12px;
    margin: 12px 0 0;
    padding: 6px 16px;
    list-style: none;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-padding-inline: 16px;
    scrollbar-width: none;
    overscroll-behavior-x: contain;
    -webkit-mask-image: linear-gradient(90deg, #000 88%, transparent);
    mask-image: linear-gradient(90deg, #000 88%, transparent);
  }
  .rail::-webkit-scrollbar {
    display: none;
  }
  .rc {
    position: relative;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 268px;
    padding: 12px 12px 10px 14px;
    box-sizing: border-box;
    border-radius: var(--radius-tile);
    background: var(--card);
    border: 1px solid var(--line);
    scroll-snap-align: start;
  }
  .rc.lit {
    border-color: rgba(255, 159, 107, 0.45);
    box-shadow: 0 0 30px -14px rgba(255, 159, 107, 0.6);
  }
  .rc-top {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .rc-disc {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    box-sizing: border-box;
    color: var(--c);
    background: var(--card-2);
    border: 1.5px solid var(--c);
  }
  .rc-cat {
    flex: 1;
    min-width: 0;
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--c);
  }
  .rc-today {
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 8px;
    border-radius: 999px;
    font-size: var(--fs-caps);
    font-weight: 700;
    color: var(--sunrise);
    background: var(--sunrise-soft);
  }
  /* the name and its line open the sheet: one target, at least 44 px */
  .rc-open {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    min-width: 0;
    min-height: 44px;
    padding: 0;
    border: none;
    border-radius: 12px;
    background: none;
    color: var(--ink);
    text-align: left;
  }
  .rc-names {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
  }
  .rc-name {
    font-size: var(--fs-row);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    flex-shrink: 1;
  }
  .rc-zh {
    flex-shrink: 2;
    font-family: var(--font-zh);
    font-size: var(--fs-caption);
    color: var(--ink-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rc-detail {
    font-size: var(--fs-caption);
    line-height: 1.4;
    color: var(--ink-2);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .rc-foot {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: auto;
  }
  .rc-dist {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--fs-chip);
    color: var(--ink);
  }
  .rc-nav {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 14px;
    border: none;
    border-radius: var(--radius-pill);
    font-size: var(--fs-caption);
    font-weight: 700;
    color: var(--on-sunrise);
    background: var(--sunrise-fill);
  }
  .rc.all {
    width: 160px;
    padding: 0;
    align-items: stretch;
    justify-content: center;
    background: var(--sky-2);
  }
  .rc-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 120px;
    padding: 12px;
    border: none;
    border-radius: var(--radius-tile);
    background: none;
    color: var(--ink);
    font-size: var(--fs-label);
    font-weight: 600;
    text-align: center;
  }
  .rc-list:focus-visible {
    outline-offset: -4px;
  }
</style>
