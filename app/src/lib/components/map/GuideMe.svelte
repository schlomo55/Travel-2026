<script lang="ts">
  /* GUIDE ME (map4-go) — works offline. The map above fits you and the place
     and draws the live leg between them (Map.svelte: the one loop on the Map
     tab, FLOW; its end state under Calm motion is a still line with an
     arrowhead). Here: the compass that turns as you do, the straight-line
     distance and the way to turn, and the hand-off for the streets —
     "Turn-by-turn in Amap" (GCJ-02, lib/logic/geo.ts; it works in mainland
     China without a VPN), Google Maps, and the driver card. Outside the
     mainland — Hong Kong, Macau, anywhere else — Google Maps is the first
     button and Amap is not offered (geo.ts guideApp, the map buttons' own
     rule). Nothing here goes online: the map apps do, once you open them.

     LOOK FOR THIS (Map 5e, the owner's F): with the map pack's photos on the
     phone, the place's photo with its name, its Chinese and its credit —
     what you will see when you get there; a tap shows it full screen. A place
     with no free photo has no row. */
  import type { MapPlace } from '../../logic/mapplaces';
  import { compass16, compassWords, distanceText, turnOf } from '../../logic/wayfind';
  import { guideApp, modeFor } from '../../logic/geo';
  import { creditLine, type PackPhoto as Photo } from '../../logic/placephotos';
  import type { PhotoSource } from '../../map/photoUrls';
  import { openAmapRoute, openGoogleDirections } from '../../platform/maps';
  import { catColour } from '../../map/icons';
  import { S } from '../../i18n/strings';
  import MapIcon from './MapIcon.svelte';
  import Compass from './Compass.svelte';
  import PackPhoto from './PackPhoto.svelte';

  let {
    place,
    away,
    heading,
    rough,
    finding = false,
    photos = null,
    photo,
    onphoto,
    onclose,
    ondriver,
    onlocate,
    panel = $bindable(null),
  }: {
    place: MapPlace;
    away: { m: number; deg: number } | null;
    heading: { deg: number; from: 'course' | 'compass' } | null;
    rough: string | null;
    /** a position is on its way */
    finding?: boolean;
    /** the pack's photos, and this place's (Map 5e) */
    photos?: PhotoSource | null;
    photo?: Photo;
    onphoto?: (from: HTMLElement) => void;
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
  /* Amap on the mainland, Google everywhere else (Map 5d) */
  const app = $derived(guideApp(place.target));
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
        <span class="gm-note">{rough ? S.mapTab.rough(rough) : finding ? S.mapTab.locating : S.mapTab.locateToGuide}</span>
        {#if !rough && !finding}<button class="btn gm-locate" onclick={onlocate}><MapIcon name="navigate" size={16} />{S.mapTab.locate}</button>{/if}
      {/if}
    </div>
  </div>

  {#if photos && photo}
    <button class="gm-look" onclick={(e) => onphoto?.(e.currentTarget)} aria-label={S.photos.lookForAria(place.name)}>
      <span class="gm-lookimg"><PackPhoto src={photos} span={photo.card} fy={photo.fy} eager alt="" /></span>
      <span class="gm-lookt">
        <span class="gm-look1">{S.photos.lookFor}</span>
        <span class="gm-look2">{place.name}{#if place.native}{' · '}<span class="zh" lang="zh">{place.native}</span>{/if}</span>
        <span class="gm-look3">{creditLine(photo)}</span>
      </span>
    </button>
  {/if}

  <div class="gm-acts">
    {#if app === 'amap'}
      <button class="gm-amap" onclick={() => void openAmapRoute(place.target, place.native ?? place.name, mode)}>
        <MapIcon name="navigate" size={22} stroke={2.2} />
        <span class="gm-amapt">
          <span class="gm-amap1">{byCoord ? S.mapTab.amap : S.mapTab.amapName}</span>
          <span class="gm-amap2">{S.mapTab.amapSub}</span>
        </span>
        <MapIcon name="external" size={18} stroke={2} />
      </button>
    {:else}
      <button class="gm-amap" onclick={() => void openGoogleDirections(place.target, mode)}>
        <MapIcon name="navigate" size={22} stroke={2.2} />
        <span class="gm-amapt"><span class="gm-amap1">{S.mapTab.googleRoute}</span></span>
        <MapIcon name="external" size={18} stroke={2} />
      </button>
    {/if}
    {#if app === 'amap' || place.driver}
      <div class="gm-two" class:one={app !== 'amap' || !place.driver}>
        {#if app === 'amap'}
          <button class="gm-btn" onclick={() => void openGoogleDirections(place.target, mode)}><MapIcon name="external" size={16} />{S.mapTab.googleMaps}</button>
        {/if}
        {#if place.driver}
          <button class="gm-btn paper" onclick={ondriver}><MapIcon name="car" size={17} stroke={1.9} />{S.mapTab.showDriver}</button>
        {/if}
      </div>
    {/if}
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
  /* Look for this (Map 5e, F): the photo, the name and its Chinese, the credit */
  .gm-look {
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    width: calc(100% - 32px);
    margin: 18px 16px 0;
    padding: 8px;
    border-radius: var(--radius-inner);
    text-align: left;
    color: var(--ink);
    background: var(--card-2);
    border: 1px solid var(--edge);
  }
  .gm-lookimg {
    display: block;
    width: 120px;
    height: 72px;
    overflow: hidden;
    border-radius: 12px;
    background: var(--card);
  }
  .gm-lookimg :global(img) {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .gm-lookt {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .gm-look1 {
    font-size: var(--fs-label);
    font-weight: 700;
  }
  .gm-look2 {
    font-size: var(--fs-caption);
    color: var(--ink-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .gm-look2 .zh {
    font-family: var(--font-zh);
  }
  /* the credit wraps, never cut: who took it and the licence, whole */
  .gm-look3 {
    font-size: var(--fs-chip);
    line-height: 1.3;
    color: var(--faint);
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
  /* one button (the driver card beside Google as the first): the whole row */
  .gm-two.one {
    grid-template-columns: minmax(0, 1fr);
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
