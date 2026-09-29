<script lang="ts">
  /* A PLACE (map4-place) — tapped on the map, the rail, the list or a search;
     or opened from the guide, a pass, Find or the day ("Show on map"). Its
     category word, the name and its Chinese, its one line in the trip's own
     words (never composed), today's chip when today's plan names it, how far
     it is and which way — a straight line, from your real position only — on
     a small radar, and the actions: Navigate (Guide me), the driver card, Google
     Maps, copy the address, and Add to my day where the trip's own options
     offer the place (the day screen's pick, the same one row).

     It is a state of the Map screen (#/trip/:id/map/:place), not a layer: the
     map stays live above it, and back closes it. Focus comes here as it opens
     and goes back to where it was opened from as it closes (Map.svelte). */
  import type { MapPlace } from '../../logic/mapplaces';
  import { compass16, compassWords, distanceSpoken, distanceText } from '../../logic/wayfind';
  import { googleMapsUrl } from '../../logic/geo';
  import { openInGoogleMaps } from '../../platform/maps';
  import { catColour, glyphOf } from '../../map/icons';
  import { copyText } from '../../state/toast.svelte';
  import { chipOf } from '../../logic/stamps';
  import { S } from '../../i18n/strings';
  import MapIcon from './MapIcon.svelte';
  import MiniRadar from './MiniRadar.svelte';
  import MapButtons from '../ui/MapButtons.svelte';

  let {
    place,
    away,
    rough,
    finding = false,
    todayTitle,
    tonight,
    dayState,
    tripId,
    onclose,
    onnavigate,
    ondriver,
    onday,
    onlocate,
    sheet = $bindable(null),
  }: {
    place: MapPlace;
    /** from your real position, when it is worth showing */
    away: { m: number; deg: number } | null;
    /** your position is too rough for a distance: its accuracy, "≈ 900 m" */
    rough: string | null;
    /** a position is on its way (asked for, or a fresh one after a while away) */
    finding?: boolean;
    todayTitle: string | null;
    tonight: boolean;
    /** Add to my day: null where the trip's options do not offer the place */
    dayState: 'add' | 'in' | null;
    tripId: string;
    onclose: () => void;
    onnavigate: () => void;
    ondriver: () => void;
    onday: () => void;
    onlocate: () => void;
    sheet?: HTMLElement | null;
  } = $props();

  const cat = $derived(S.mapTab.cat[place.category]);
  const colour = $derived(catColour(place.category));
  const google = $derived(!!googleMapsUrl(place.target));
  const point = $derived(away ? compass16(away.deg) : null);
</script>

<section class="ps" style="--c: {colour}" aria-labelledby="ps-h" bind:this={sheet} tabindex="-1">
  <span class="ps-hline" aria-hidden="true"></span>
  <span class="ps-grab" aria-hidden="true"></span>
  <div class="ps-row1">
    <span class="ps-cat"><MapIcon name={glyphOf(place.category, place.name, place.native)} size={15} stroke={1.9} />{cat}</span>
    {#if tonight}<span class="ps-today"><span class="dot" aria-hidden="true"></span>{S.mapTab.tonight}</span>
    {:else if todayTitle}<span class="ps-today"><span class="dot" aria-hidden="true"></span>{S.mapTab.todayChip(todayTitle)}</span>{/if}
    <span class="ps-grow"></span>
    <button class="ps-x iconbtn" onclick={onclose} aria-label={S.misc.close}><MapIcon name="close" size={18} stroke={2} /></button>
  </div>

  <div class="ps-names">
    <h1 id="ps-h" class="display ps-h">{place.name}</h1>
    {#if place.native}<span class="ps-zh zh" lang="zh">{place.native}</span>{/if}
    {#if place.detail}<p class="ps-detail">{place.detail}</p>{/if}
  </div>

  {#if place.pos}
    <div class="ps-away">
      {#if away && point}
        <span class="ps-arrow" aria-hidden="true"
          ><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate({away.deg}deg); stroke: var(--c)"
            ><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg
          ></span
        >
        <span class="ps-awayt">
          <span class="num ps-km">{distanceText(away.m)}</span>
          <span class="ps-of">{S.mapTab.ofYou(point)}</span>
        </span>
        <MiniRadar deg={away.deg} m={away.m} color={colour} label={S.mapTab.radarAria(compassWords(point), distanceSpoken(away.m))} />
      {:else}
        <span class="ps-awayt">
          <span class="ps-of">{rough ? S.mapTab.rough(rough) : finding ? S.mapTab.locating : S.mapTab.locateToMeasure}</span>
        </span>
        {#if !rough && !finding}<button class="btn ps-locate" onclick={onlocate}><MapIcon name="navigate" size={16} />{S.mapTab.locate}</button>{/if}
      {/if}
    </div>
    <button class="btn primary lg wfull ps-go" onclick={onnavigate}><MapIcon name="navigate" size={18} stroke={2.2} />{S.mapTab.navigate}</button>
  {:else}
    <p class="ps-noPin">{S.mapTab.noPinHint}</p>
    <MapButtons coord={place.target.coord} name={place.name} query={place.target.query} address={place.target.address} city={place.target.city} url={place.target.url} noAddressCopy />
  {/if}

  <div class="ps-grid">
    {#if place.driver}
      <button class="ps-act paper" onclick={ondriver}><MapIcon name="car" size={17} stroke={1.9} />{S.mapTab.driverCard}</button>
    {/if}
    {#if google && place.pos}
      <button class="ps-act" onclick={() => void openInGoogleMaps(place.target)}><MapIcon name="external" size={16} />{S.mapTab.googleMaps}</button>
    {/if}
    {#if place.target.address}
      <button class="ps-act" onclick={() => copyText(place.target.address ?? '', S.maps.copiedAddress)}><MapIcon name="copy" size={16} />{S.mapTab.copyAddress}</button>
    {:else if place.native}
      <button class="ps-act" onclick={() => copyText(place.native ?? '', S.maps.copied)}><MapIcon name="copy" size={16} />{S.mapTab.copyName}</button>
    {/if}
    {#if dayState}
      <button class="ps-act" class:on={dayState === 'in'} aria-pressed={dayState === 'in'} onclick={onday}
        ><MapIcon name={dayState === 'in' ? 'check' : 'plus'} size={16} stroke={2} />{dayState === 'in' ? S.mapTab.inDay : S.mapTab.addToDay}</button
      >
    {/if}
  </div>

  {#if place.with.some((w) => w.booking)}
    <div class="ps-with">
      <span class="caps">{S.mapTab.alsoHere}</span>
      {#each place.with.filter((w) => w.booking) as w (w.id)}
        {@const chip = chipOf(w.booking!.status)}
        <a class="ps-pass" href="#/trip/{encodeURIComponent(tripId)}/pocket/{encodeURIComponent(w.id)}" aria-label={S.mapTab.openPass(w.name)}>
          <span class="ps-passn">{w.name}</span>
          <span class="chip {chip.cls}">{chip.label}</span>
        </a>
      {/each}
    </div>
  {/if}
</section>

<style>
  .ps {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 22px 16px 16px;
    background: var(--chrome);
    border-top: 1px solid var(--line);
    border-radius: var(--radius-photo) var(--radius-photo) 0 0;
    box-shadow: 0 -24px 60px -12px rgba(0, 0, 0, 0.85);
    animation: h-rise var(--duration-rise) var(--ease-out) both;
    outline: none;
  }
  .ps-hline {
    position: absolute;
    left: 28px;
    right: 28px;
    top: -1px;
    height: 1px;
    background: var(--horizon-line);
  }
  .ps-grab {
    position: absolute;
    left: 50%;
    top: 10px;
    width: 40px;
    height: 5px;
    margin-left: -20px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.22);
  }
  .ps-row1 {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .ps-cat,
  .ps-today {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 12px 0 8px;
    border-radius: 999px;
    font-size: var(--fs-chip);
    font-weight: 700;
    white-space: nowrap;
  }
  .ps-cat {
    color: var(--c);
    background: var(--card-2);
    border: 1px solid var(--c);
  }
  .ps-today {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-left: 10px;
    color: var(--sunrise);
    background: var(--sunrise-soft);
    border: 1px solid rgba(255, 159, 107, 0.4);
  }
  .ps-today .dot {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--sunrise-fill);
  }
  .ps-grow {
    flex: 1;
  }
  .ps-x {
    flex-shrink: 0;
  }
  .ps-names {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .ps-h {
    margin: 0;
    font-size: var(--fs-screen-title);
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: -0.02em;
  }
  .ps-zh {
    font-family: var(--font-zh);
    font-size: var(--fs-code-lg);
    color: var(--ink);
  }
  .ps-detail {
    margin: 2px 0 0;
    font-size: var(--fs-row);
    line-height: 1.45;
    color: var(--ink-2);
  }
  .ps-away {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 14px;
    border-radius: var(--radius-tile);
    background: var(--card);
    border: 1px solid var(--line);
  }
  .ps-arrow {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 999px;
    background: var(--card-2);
    border: 1px solid var(--c);
  }
  .ps-awayt {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .ps-km {
    font-size: var(--fs-code-lg);
    font-weight: 500;
    letter-spacing: -0.02em;
    color: var(--ink);
  }
  .ps-of {
    font-size: var(--fs-caption);
    line-height: 1.4;
    color: var(--ink-2);
  }
  .ps-locate {
    flex-shrink: 0;
  }
  .ps-noPin {
    margin: 0;
    font-size: var(--fs-caption);
    line-height: 1.45;
    color: var(--ink-2);
  }
  .ps-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .ps-act {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
    padding: 0 10px;
    border-radius: 16px;
    font-size: var(--fs-label);
    font-weight: 600;
    color: var(--ink);
    background: var(--card-2);
    border: 1px solid var(--edge);
  }
  .ps-act.paper {
    font-weight: 700;
    color: var(--counter-ink);
    background: var(--counter-paper);
    border-color: var(--counter-paper);
  }
  .ps-act.paper:focus-visible {
    outline-color: var(--sunrise);
  }
  .ps-act.on {
    color: var(--sunrise);
    border-color: var(--sunrise);
  }
  .ps-with {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ps-with .caps {
    color: var(--faint);
  }
  .ps-pass {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 0 12px;
    border-radius: 14px;
    text-decoration: none;
    color: var(--ink);
    background: var(--card);
    border: 1px solid var(--edge);
  }
  .ps-passn {
    flex: 1;
    min-width: 0;
    font-size: var(--fs-label);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
