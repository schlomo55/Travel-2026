<script lang="ts">
  /* GUIDE ME (map4-go) — works offline. The map above fits you and the place
     and draws the live leg between them (Map.svelte: the one loop on the Map
     tab, FLOW; its end state under Calm motion is a still line with an
     arrowhead). Here: the compass that turns as you do, the straight-line
     distance and the way to turn, and the hand-off for the streets —
     "Turn-by-turn in Amap" (GCJ-02, lib/logic/geo.ts; it works in mainland
     China without a VPN), Google Maps, and the driver card. Nothing here
     goes online: the map apps do, once you open them. */
  import type { MapPlace } from '../../logic/mapplaces';
  import { compass16, compassWords, distanceText, turnOf } from '../../logic/wayfind';
  import { modeFor } from '../../logic/geo';
  import { openAmapRoute, openGoogleDirections } from '../../platform/maps';
  import { catColour } from '../../map/icons';
  import { S } from '../../i18n/strings';
  import MapIcon from './MapIcon.svelte';
  import Compass from './Compass.svelte';

  let {
    place,
    away,
    heading,
    rough,
    onclose,
    ondriver,
    onlocate,
    panel = $bindable(null),
  }: {
    place: MapPlace;
    away: { m: number; deg: number } | null;
    heading: { deg: number; from: 'course' | 'compass' } | null;
    rough: string | null;
    onclose: () => void;
    ondriver: () => void;
    onlocate: () => void;
    panel?: HTMLElement | null;
  } = $props();

  const cat = $derived(S.mapTab.cat[place.category]);
  const point = $derived(away ? compass16(away.deg) : null);
  const turn = $derived(away && heading ? turnOf(away.deg, heading.deg) : null);
  const turnWords = $derived(turn ? S.mapTab.turn[turn] : null);
  const mode = $derived(modeFor(away?.m ?? null));
  const byCoord = $derived(!!place.target.coord);
</script>

<header class="gm-head">
  <button class="gm-x" onclick={onclose} aria-label={S.mapTab.closeGuide}><MapIcon name="close" size={20} stroke={2} /></button>
  <div class="gm-titles">
    <h1 class="display gm-h1">{S.mapTab.guideMe}</h1>
    <span class="gm-to">{S.mapTab.guideTo(place.name, cat)}</span>
  </div>
  <span class="gm-off"><MapIcon name="check" size={13} stroke={2.4} />{S.mapTab.worksOffline}</span>
</header>

<section class="gm-panel" style="--c: {catColour(place.category)}" aria-label={S.mapTab.guideTo(place.name, cat)} bind:this={panel} tabindex="-1">
  <span class="gm-hline" aria-hidden="true"></span>
  <div class="gm-top">
    <Compass
      bearing={away?.deg ?? null}
      heading={heading?.deg ?? null}
      label={point ? S.mapTab.compassAria(compassWords(point), turnWords) : S.mapTab.locateToGuide}
    />
    <div class="gm-words">
      {#if away && point}
        <span class="num gm-km">{distanceText(away.m).replace('≈ ', '')}</span>
        <span class="gm-dir">{turnWords ? `${point} · ${turnWords}` : point}</span>
        <span class="gm-note">{heading ? (heading.from === 'course' ? `${S.mapTab.followStreets} ${S.mapTab.byCourse}` : S.mapTab.followStreets) : S.mapTab.noCompass}</span>
      {:else}
        <span class="gm-note">{rough ? S.mapTab.rough(rough) : S.mapTab.locateToGuide}</span>
        {#if !rough}<button class="btn gm-locate" onclick={onlocate}><MapIcon name="navigate" size={16} />{S.mapTab.locate}</button>{/if}
      {/if}
    </div>
  </div>

  <div class="gm-acts">
    <button class="gm-amap" onclick={() => void openAmapRoute(place.target, place.native ?? place.name, mode)}>
      <MapIcon name="navigate" size={22} stroke={2.2} />
      <span class="gm-amapt">
        <span class="gm-amap1">{byCoord ? S.mapTab.amap : S.mapTab.amapName}</span>
        <span class="gm-amap2">{S.mapTab.amapSub}</span>
      </span>
      <MapIcon name="external" size={18} stroke={2} />
    </button>
    <div class="gm-two">
      <button class="gm-btn" onclick={() => void openGoogleDirections(place.target, mode)}><MapIcon name="external" size={16} />{S.mapTab.googleMaps}</button>
      {#if place.driver}
        <button class="gm-btn paper" onclick={ondriver}><MapIcon name="car" size={17} stroke={1.9} />{S.mapTab.showDriver}</button>
      {/if}
    </div>
    <p class="gm-foot">{S.mapTab.appsGoOnline}</p>
  </div>
</section>

<style>
  .gm-head {
    position: fixed;
    left: 16px;
    right: 16px;
    top: calc(16px + env(safe-area-inset-top));
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .gm-x {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 999px;
    color: var(--ink);
    background: var(--chrome);
    border: 1px solid var(--edge);
    box-shadow: 0 16px 30px -12px rgba(0, 0, 0, 0.9);
  }
  .gm-titles {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .gm-h1 {
    margin: 0;
    font-size: var(--fs-card-title);
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  .gm-to {
    font-size: var(--fs-caption);
    color: var(--ink-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .gm-off {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 11px;
    border-radius: 999px;
    font-size: var(--fs-chip);
    font-weight: 700;
    color: var(--ink);
    background: var(--card-2);
    border: 1px solid rgba(255, 255, 255, 0.12);
  }
  .gm-panel {
    outline: none;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 30;
    padding: 26px 0 calc(16px + env(safe-area-inset-bottom));
    background: var(--chrome);
    border-top: 1px solid var(--line);
    border-radius: var(--radius-photo) var(--radius-photo) 0 0;
    box-shadow: 0 -24px 60px -12px rgba(0, 0, 0, 0.85);
  }
  @media (min-width: 560px) {
    .gm-panel {
      left: calc(50% - 260px);
      right: calc(50% - 260px);
    }
  }
  .gm-hline {
    position: absolute;
    left: 28px;
    right: 28px;
    top: -1px;
    height: 1px;
    background: var(--horizon-line);
  }
  .gm-top {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 0 20px;
  }
  .gm-words {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .gm-km {
    font-size: var(--fs-hero-code);
    font-weight: 500;
    line-height: 1;
    letter-spacing: -0.03em;
    color: var(--ink);
  }
  .gm-dir {
    font-size: var(--fs-body);
    font-weight: 600;
    color: var(--c);
  }
  .gm-note {
    font-size: var(--fs-caption);
    line-height: 1.45;
    color: var(--ink-2);
    text-wrap: pretty;
  }
  .gm-locate {
    align-self: flex-start;
  }
  .gm-acts {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 20px 16px 0;
  }
  .gm-amap {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 62px;
    padding: 0 18px;
    border: none;
    border-radius: 22px;
    text-align: left;
    color: var(--on-sunrise);
    background: var(--sunrise-fill);
    box-shadow: var(--glow-sunrise);
  }
  .gm-amapt {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .gm-amap1 {
    font-size: var(--fs-body);
    font-weight: 700;
  }
  .gm-amap2 {
    font-size: var(--fs-chip);
    font-weight: 600;
  }
  .gm-two {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .gm-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 50px;
    border-radius: 16px;
    font-size: var(--fs-label);
    font-weight: 600;
    color: var(--ink);
    background: var(--card-2);
    border: 1px solid var(--edge);
  }
  .gm-btn.paper {
    font-weight: 700;
    color: var(--counter-ink);
    background: var(--counter-paper);
    border-color: var(--counter-paper);
  }
  .gm-foot {
    margin: 4px 0 0;
    font-size: var(--fs-chip);
    line-height: 1.45;
    text-align: center;
    color: var(--faint);
    /* two even lines at 384, not a lone word */
    text-wrap: balance;
  }
</style>
