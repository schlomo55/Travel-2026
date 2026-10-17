<script lang="ts">
  /* THE DAY AS A ROUTE (demo, Wanderlog-inspired) — the places the day goes
     to as a numbered timeline, with the ESTIMATED leg between each two and on
     to tonight's bed. Loaded by DayView on demand (like the Map tab's own
     screen), because it reads the Map's place list (logic/mapplaces) and the
     start-up JavaScript has no room for that.

     Every figure is a straight line × 1.3 at a typical speed — printed with
     "≈" and captioned as an estimate. There is no routing graph on the phone
     and nothing here needs a signal. A leg is a real button: a tap switches it
     walk → taxi → metro (state/legModes, shared with the Map tab, session
     only), and the row and the totals follow.

     A place the plan names that has no pin is never numbered and never
     guessed onto a map: it stays a chip after the timeline, drawn by DayView's
     own `chips` — the very markup the day wore before this. The same
     fallback renders when no named place has a pin at all. */
  import type { Snippet } from 'svelte';
  import type { Booking, DayDefault, DayPlan, ISODate, ShowCard, Stop } from '../../model/types';
  import { DETOUR, dayRoute, metresText, minutesText, nextMode, type Leg, type LegMode } from '../../logic/dayroute';
  import { mapPlaces, type PlaceSources } from '../../logic/mapplaces';
  import type { PlaceRef } from '../../logic/places';
  import { legModes } from '../../state/legModes.svelte';
  import { mapDay } from '../../state/mapDay.svelte';
  import { router } from '../../state/router.svelte';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';
  import MapButtons from '../ui/MapButtons.svelte';
  import ShowOnMap from '../map/ShowOnMap.svelte';

  let {
    tripId,
    date,
    stops,
    showCards,
    bookings,
    dayPlans,
    dayDefaults,
    places,
    chips,
  }: {
    tripId: string;
    date: ISODate;
    stops: Stop[];
    showCards: ShowCard[];
    bookings: Booking[];
    dayPlans: DayPlan[];
    dayDefaults: DayDefault[];
    /** the day's places as DayView resolves them (every one a map button can open) */
    places: PlaceRef[];
    /** DayView's chip row: (the places, with its "Places today" head or not) */
    chips: Snippet<[PlaceRef[], boolean]>;
  } = $props();

  const src = $derived<PlaceSources>({ tripId, stops, showCards, bookings, dayPlans, dayDefaults });
  const all = $derived(mapPlaces(src));
  const route = $derived(dayRoute(src, date, all, legModes.chosen));

  /* what the timeline does not number: the places with no pin, and whatever
     else the plan names that the map never draws (a flight's airport, a
     city) — today's chips, kept. A ticket that rides with a numbered place
     is that place. */
  const rest = $derived.by(() => {
    if (!route) return places;
    const numbered = new Set<string>();
    for (const s of route.stops) {
      numbered.add(s.id);
      for (const m of s.place.with) numbered.add(m.id);
    }
    return places.filter((p) => !numbered.has(p.id));
  });

  const hasLegs = $derived(!!route && (route.legs.length > 0 || !!route.toBed));
  const summary = $derived.by(() => {
    if (!route) return '';
    const parts = [S.day.route.stops(route.stops.length)];
    if (hasLegs) parts.push(S.day.route.distance(metresText(route.metres)), S.day.route.moving(minutesText(route.minutes)));
    return parts.join(' · ');
  });

  const MODE_ICON: Record<LegMode, string> = { walk: 'walk', taxi: 'car', metro: 'train' };

  /* "Show on map" is a link into the Map tab (ShowOnMap); following it
     leaves the map showing THIS day's route. */
  function showsThisDay(node: HTMLElement): { destroy(): void } {
    const set = (): void => {
      mapDay.sel = date;
    };
    node.addEventListener('click', set);
    return { destroy: () => node.removeEventListener('click', set) };
  }
</script>

{#snippet leg(l: Leg, to: string, bed: boolean)}
  {#if l.far}
  <span class="drleg far">
    <span class="drlegtx"><span class="num">{metresText(l.metres)}</span> · {S.day.route.far}</span>
  </span>
  {:else}
  <button
    type="button"
    class="drleg"
    class:chosen={l.chosen}
    onclick={() => legModes.cycle(l)}
    aria-label={S.day.route.legAria(l.minutes, S.day.route.how[l.mode], to, S.day.route.switchTo[nextMode(l.mode)])}
  >
    <Icon name={MODE_ICON[l.mode]} size={16} />
    <span class="drlegtx"
      ><span class="num">{minutesText(l.minutes)}</span> {S.day.route.mode[l.mode]} · <span class="num">{metresText(l.metres)}</span
      >{#if bed}{' · '}<span class="drbed">{S.day.route.toBed}</span>{/if}</span
    >
  </button>
  {/if}
{/snippet}

{#if route}
  <div class="dayroute" style:--c={route.colour}>
    <span class="caps dphead">{S.maps.placesToday}</span>
    <p class="drsum"><span class="drdot" aria-hidden="true"></span><span class="num drtext">{summary}</span></p>
    {#if hasLegs}<p class="small drcap">{S.day.route.caption(DETOUR)}</p>{/if}
    <a class="drmap" href={router.mapHash(tripId)} onclick={() => (mapDay.sel = date)}>
      <Icon name="map" size={16} />{S.day.route.seeMap}
    </a>

    <ol class="drlist" aria-label={S.day.route.listAria}>
      {#each route.stops as s, i (s.id)}
        {@const next = route.legs[i]}
        {@const toBed = i === route.stops.length - 1 ? route.toBed : null}
        {@const p = s.place}
        <li class="drstop">
          <div class="drrail">
            <span class="drbadge num">{s.n}</span>
            {#if next || toBed}<span class="drline" aria-hidden="true"></span>{/if}
          </div>
          <div class="drbody">
            <div class="drrow">
              <span class="drname"
                ><span class="drlabel">{p.label}</span>{#if p.native}<span class="zh drzh" lang="zh">{p.native}</span>{/if}</span
              >
              <MapButtons
                coord={p.target.coord}
                name={p.native ?? p.name}
                query={p.target.query}
                address={p.target.address}
                addressInSearch={p.target.addressInSearch}
                city={p.target.city}
                url={p.target.url}
                compact
              />
              <span class="drshow" use:showsThisDay><ShowOnMap {tripId} id={s.id} name={p.name} /></span>
            </div>
            {#if next}
              {@render leg(next, route.stops[i + 1]?.place.label ?? '', false)}
            {:else if toBed && route.bed}
              {@render leg(toBed, `${S.day.route.tonightsBed}, ${route.bed.label}`, true)}
            {/if}
          </div>
        </li>
      {/each}
    </ol>

    {@render chips(rest, false)}
  </div>
{:else}
  {@render chips(places, true)}
{/if}

<style>
  .dayroute {
    margin: 16px 0 8px;
  }
  .dphead {
    display: block;
    color: var(--ink-2);
  }
  .drsum {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 8px 0 0;
  }
  .drdot {
    flex: 0 0 auto;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--c);
  }
  .drtext {
    font-size: var(--fs-label);
    font-weight: 600;
    color: var(--ink);
  }
  .drcap {
    margin: 4px 0 0;
    line-height: 1.45;
  }
  .drmap {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 44px;
    font-size: var(--fs-caption);
    font-weight: 600;
    color: var(--sunrise);
    text-decoration: none;
  }
  .drmap:active {
    text-decoration: underline;
  }

  /* ---------- the stops ---------- */
  .drlist {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
  }
  .drstop {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr);
    column-gap: 12px;
  }
  /* the badge sits on the first row's middle (a 44 px row, a 30 px badge);
     the line runs from under it to the end of the row, into the next badge */
  .drrail {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 7px;
  }
  .drbadge {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--c);
    color: var(--sky);
    font-size: var(--fs-label);
    font-weight: 700;
    line-height: 1;
  }
  .drline {
    flex: 1 1 auto;
    width: 2px;
    margin-top: 4px;
    min-height: 8px;
    border-radius: 1px;
    background: var(--c);
    opacity: 0.55;
  }
  .drbody {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .drrow {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 44px;
  }
  .drname {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 4px 0;
  }
  .drlabel {
    font-size: var(--fs-row);
    font-weight: 600;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .drzh {
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .drshow {
    display: contents;
  }

  /* ---------- a leg: a dashed pill you can tap ---------- */
  .drleg {
    align-self: flex-start;
    max-width: 100%;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    margin: 0 0 8px;
    padding: 0 14px 0 12px;
    border: 1.5px dashed var(--edge);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--ink-2);
    font: inherit;
    font-size: var(--fs-caption);
    font-weight: 600;
    text-align: left;
  }
  .drleg :global(.hicon) {
    flex: 0 0 auto;
  }
  .drleg.far {
    color: var(--ink-2);
    border-style: dotted;
  }
  .drleg.chosen {
    border-style: solid;
    border-color: color-mix(in srgb, var(--sunrise) 55%, transparent);
    color: var(--ink);
  }
  .drleg:active {
    border-color: var(--sunrise);
    color: var(--sunrise);
  }
  .drbed {
    color: var(--faint);
  }
</style>
