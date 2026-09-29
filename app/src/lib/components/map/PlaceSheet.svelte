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
     and goes back to where it was opened from as it closes (Map.svelte).

     THE PHOTO, THE ABOUT AND THE LINKS (Map 5e, the owner's A and A2). With
     the map pack's photos on this phone: a 16:9 photo on top with its credit
     on it (who took it, under which licence) — a tap shows it full screen —,
     or, for a place the pack looked at and found no free photo of, the
     category's colour, its icon and "No free photo of this place": honest,
     never a stock picture. The trip's own line stays first; then "About ·
     From Wikipedia": the article's own first sentences, verbatim, with whose
     words they are. Then the links: Wikipedia and the official site where
     known (they need the internet, and say so quietly), Google Maps, and
     Amap on the mainland only — the map buttons' own territory rule
     (logic/geo.ts isAmapTerritory). No photos on the phone (no pack, or one
     from before Map 5e): no photo box at all, as before. */
  import type { MapPlace } from '../../logic/mapplaces';
  import { compass16, compassWords, distanceSpoken, distanceText } from '../../logic/wayfind';
  import { googleMapsUrl, isAmapTerritory } from '../../logic/geo';
  import { creditLine, photoButtonName, type PackPlace } from '../../logic/placephotos';
  import type { PhotoSource } from '../../map/photoUrls';
  import { openInAmap, openInGoogleMaps } from '../../platform/maps';
  import { external } from '../../platform/links';
  import { catColour, glyphOf } from '../../map/icons';
  import { copyText } from '../../state/toast.svelte';
  import { chipOf } from '../../logic/stamps';
  import { S } from '../../i18n/strings';
  import { SP } from '../../i18n/photos';
  import MapIcon from './MapIcon.svelte';
  import MiniRadar from './MiniRadar.svelte';
  import PackPhoto from './PackPhoto.svelte';
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
    photos = null,
    entry,
    onphoto,
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
    /** the map pack's photos on this phone, when it carries them (Map 5e) */
    photos?: PhotoSource | null;
    /** what the pack's index says about this place — undefined: never looked at */
    entry?: PackPlace;
    /** the photo, full screen */
    onphoto?: (from: HTMLElement) => void;
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
  const amap = $derived(isAmapTerritory(place.target) && !!(place.target.query || place.target.address || place.target.coord || place.target.url));
  const point = $derived(away ? compass16(away.deg) : null);
  const photo = $derived(photos ? entry?.photo : undefined);
  /* the links row: the article, the official site, then the map apps (pinned places only — an unpinned place has its one map button) */
  const links = $derived(!!(entry?.about || entry?.official) || (!!place.pos && (google || amap)));
</script>

<section class="ps" class:hasphoto={!!photos && !!entry && !!place.pos} style="--c: {colour}" aria-labelledby="ps-h" bind:this={sheet} tabindex="-1">
  <span class="ps-hline" aria-hidden="true"></span>
  <span class="ps-grab" aria-hidden="true"></span>
  {#if photos && entry && place.pos}
    {#if photo}
      <!-- its name says what a tap does AND the credit the photo wears: a screen reader hears who took it too (Map 5f) -->
      <button class="ps-hero" onclick={(e) => onphoto?.(e.currentTarget)} aria-label={photoButtonName(SP.expand(place.name), photo)}>
        <PackPhoto src={photos} span={photo.card} fy={photo.fy} eager alt="" />
        <span class="ps-credit">{creditLine(photo)}</span>
        <span class="ps-zoom" aria-hidden="true"><MapIcon name="expand" size={16} stroke={2} /></span>
      </button>
    {:else}
      <div class="ps-hero none">
        <span class="ps-nodisc" aria-hidden="true"><MapIcon name={glyphOf(place.category, place.name, place.native)} size={26} stroke={1.8} /></span>
        <span class="ps-nophoto">{SP.noPhoto}</span>
      </div>
    {/if}
  {/if}
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

  {#if entry?.about}
    <section class="ps-about" aria-labelledby="ps-about-h">
      <h2 id="ps-about-h" class="ps-abouth">{SP.about} <span>· {SP.fromWikipedia}</span></h2>
      <p class="ps-abouttext" lang="en">{entry.about.text}</p>
      <p class="ps-aboutby">{SP.textCredit(entry.about.licence)}</p>
    </section>
  {/if}

  {#if links}
    <div class="ps-links">
      {#if entry?.about}
        <a class="ps-link" href={entry.about.url} onclick={(e) => external(e, entry!.about!.url)} aria-label={SP.linkAria(SP.wikipedia, entry.about.title)}
          >{SP.wikipedia}<MapIcon name="external" size={13} stroke={2} /></a
        >
      {/if}
      {#if entry?.official}
        <a class="ps-link" href={entry.official} onclick={(e) => external(e, entry!.official!)} aria-label={SP.linkAria(SP.official, place.name)}
          >{SP.official}<MapIcon name="external" size={13} stroke={2} /></a
        >
      {/if}
      {#if place.pos && google}
        <button class="ps-link" onclick={() => void openInGoogleMaps(place.target)}>{S.mapTab.googleMaps}</button>
      {/if}
      {#if place.pos && amap}
        <button class="ps-link" onclick={() => void openInAmap(place.target, place.native ?? place.name)}>{SP.amap}</button>
      {/if}
    </div>
    {#if entry?.about || entry?.official}<p class="ps-linknote">{SP.linksNote}</p>{/if}
  {/if}

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
  /* the photo on top (A) — 16:9, its credit on it, a tap to full screen — or,
     with no free photo of the place, its colour and icon (A2) */
  .ps.hasphoto {
    padding-top: 26px;
  }
  .ps-hero {
    position: relative;
    display: block;
    width: calc(100% + 8px);
    margin: 0 -4px 2px;
    padding: 0;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border: none;
    border-radius: var(--radius-inner);
    background: var(--card-2);
  }
  .ps-hero:focus-visible {
    outline-offset: -4px;
  }
  .ps-hero :global(img) {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  /* a short screen — the phone on its side (Map 5f): a lower band, cropped round the photo's focal point as ever,
     so the sheet (capped to the screen, Map.svelte) shows the place and not only its photo */
  @media (max-height: 540px) {
    .ps.hasphoto {
      padding-top: 22px;
    }
    .ps-hero {
      aspect-ratio: auto;
      height: 26dvh;
    }
  }
  /* the credit is never cut — who took it and the licence are what the licence asks for; the longest the pack
     carries (Senado Square's, Commons' own 75 characters) wraps to three lines at 384 px */
  .ps-credit {
    position: absolute;
    left: 8px;
    bottom: 8px;
    max-width: calc(100% - 60px);
    padding: 4px 8px;
    border-radius: 8px;
    font-size: var(--fs-chip);
    line-height: 1.3;
    text-align: left;
    color: var(--photo-ink);
    background: rgba(11, 12, 22, 0.72);
  }
  .ps-zoom {
    position: absolute;
    right: 8px;
    bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    color: var(--photo-ink);
    background: rgba(11, 12, 22, 0.72);
  }
  .ps-hero.none {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background:
      radial-gradient(120% 90% at 30% 20%, color-mix(in srgb, var(--c) 22%, transparent), transparent 60%),
      linear-gradient(160deg, var(--card-2), var(--card));
  }
  .ps-nodisc {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 999px;
    color: var(--c);
    background: rgba(11, 12, 22, 0.4);
    border: 1.5px solid var(--c);
  }
  .ps-nophoto {
    font-size: var(--fs-caption);
    color: var(--ink-2);
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
  /* About · From Wikipedia: the article's own words */
  .ps-about {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
    border-radius: var(--radius-inner);
    background: var(--card);
    border: 1px solid var(--line);
  }
  .ps-abouth {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin: 0;
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--lilac);
  }
  .ps-abouth span {
    color: var(--faint);
  }
  .ps-abouttext {
    margin: 0;
    font-size: var(--fs-label);
    line-height: 1.5;
    color: var(--ink);
  }
  .ps-aboutby {
    margin: 0;
    font-size: var(--fs-chip);
    color: var(--faint);
  }
  /* the links: drawn 36 px as the board draws them, a 44 px target all the same */
  .ps-links {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .ps-link {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 14px;
    border-radius: var(--radius-pill);
    font-size: var(--fs-caption);
    font-weight: 600;
    color: var(--ink);
    text-decoration: none;
    background: var(--card-2);
    border: 1px solid var(--edge);
  }
  .ps-link::before {
    content: '';
    position: absolute;
    top: -4px;
    left: 0;
    right: 0;
    bottom: -4px;
  }
  .ps-linknote {
    margin: -2px 0 0;
    font-size: var(--fs-chip);
    line-height: 1.45;
    color: var(--faint);
    text-wrap: balance;
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
