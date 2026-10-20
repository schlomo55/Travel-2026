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

     A stop the plan calls optional (logic/dayroute.ts optionalIds) is numbered
     like the rest but drawn dashed with the word, and stays out of the totals
     ("+ optional ≈ …" says what it would add). A stop row carries ONE labelled
     "Map" pill — the link into the Map tab; the button that hands the place to
     the phone's map app stays in the Map's place sheet and on the chips below —
     and the first stop, which has no leg, gets the legs' own app button. A leg's
     button starts its route at the stop before it (platform/directions.ts).

     A place the plan names that has no pin is never numbered and never
     guessed onto a map: it stays a chip after the timeline, drawn by DayView's
     own `chips` — the very markup the day wore before this. Tonight's bed (also
     DayView's own block) closes the route: straight after the leg that goes to
     it, or after those chips when no leg does. DayView puts this at the top of
     the day, and knows from drawnIds whether there is a route to put there.
     A stop with a ticket for the day riding with it wears its TicketChip. */
  import type { Snippet } from 'svelte';
  import type { Booking, DayDefault, DayPlan, ISODate, ShowCard, Stop } from '../../model/types';
  import { DETOUR, dayRoute, metresText, minutesText, nextMode, type Leg, type LegMode } from '../../logic/dayroute';
  import { MIN_ROUTE_STOPS } from '../../logic/routehint';
  import { mapPlaces, type MapPlace, type PlaceSources } from '../../logic/mapplaces';
  import { placeTickets } from '../../logic/reserveby';
  import TicketChip from './TicketChip.svelte';
  import type { PlaceRef } from '../../logic/places';
  import { legModes } from '../../state/legModes.svelte';
  import { navApp } from '../../state/navApp.svelte';
  import { legDestination, legOrigin, openLegDirections } from '../../platform/directions';
  import { mapDay } from '../../state/mapDay.svelte';
  import { router } from '../../state/router.svelte';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';

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
    bed,
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
    /** DayView's tonight's-bed block — the end of the route, so it is drawn here */
    bed: Snippet<[]>;
  } = $props();

  const src = $derived<PlaceSources>({ tripId, stops, showCards, bookings, dayPlans, dayDefaults });
  const all = $derived(mapPlaces(src));
  const found = $derived(dayRoute(src, date, all, legModes.chosen));
  /* one place is a pin, not a route: DayView already keeps the chips and the
     bed where they were (routehint.ts), and so does this, should it be asked */
  const route = $derived(found && found.stops.length >= MIN_ROUTE_STOPS ? found : null);

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

  /* a far leg (train, ferry, flight) is no estimate and not in the totals, and
     it is not a button: with only those there is nothing to sum or to tap */
  const hasLegs = $derived(!!route && [...route.legs, ...(route.toBed ? [route.toBed] : [])].some((l) => !l.far));

  const MODE_ICON: Record<LegMode, string> = { walk: 'walk', taxi: 'car', metro: 'train' };

  /* following "See the day on the map" or a stop's Map pill leaves the map
     showing THIS day's route */
  const showDay = (): void => {
    mapDay.sel = date;
  };
</script>

{#snippet go(dest: MapPlace, mode: LegMode | null, from: MapPlace | null)}
  {@const app = navApp.for(dest.target)}
  <button type="button" class="drgo" onclick={() => void openLegDirections(dest, mode, app, from)} aria-label={S.day.route.goAria(dest.label, S.day.route.goApp[app])}>
    <Icon name="external" size={14} />{S.day.route.goApp[app]}
  </button>
{/snippet}

{#snippet leg(l: Leg, to: string, bed: boolean)}
  {@const dest = route ? legDestination(route, l) : null}
  {#if l.far}
    <!-- a ferry, train or flight: no estimate to tap, but the stop it brings you to still opens in a map app, from where you are -->
    <span class="drlegrow">
      <span class="drleg far">
        <span class="drlegtx"><span class="num">{metresText(l.metres)}</span> · {S.day.route.far}</span>
      </span>
      {#if dest}{@render go(dest, null, null)}{/if}
    </span>
  {:else}
    <span class="drlegrow">
      <button
        type="button"
        class="drleg"
        class:chosen={l.chosen}
        class:opt={l.optional}
        onclick={() => legModes.cycle(l)}
        aria-label={S.day.route.legAria(l.minutes, S.day.route.how[l.mode], to, S.day.route.switchTo[nextMode(l.mode)])}
      >
        <Icon name={MODE_ICON[l.mode]} size={16} />
        <span class="drlegtx"
          ><span class="num">{minutesText(l.minutes)}</span> {S.day.route.mode[l.mode]} · <span class="num">{metresText(l.metres)}</span
          >{#if bed}{' · '}<span class="drbed">{S.day.route.toBed}</span>{/if}{#if l.optional}{' · '}<span class="drbed">{S.day.route.optional}</span>{/if}</span
        >
      </button>
      {#if dest && route}{@render go(dest, l.mode, legOrigin(route, l))}{/if}
    </span>
  {/if}
{/snippet}

{#if route}
  {@const extra = route.optionalMinutes > 0}
  <div class="dayroute" style:--c={route.colour}>
    <span class="caps dphead">{S.maps.placesToday}</span>
    <div class="drsum">
      <p class="drn"><span class="drdot" aria-hidden="true"></span><span class="num drtext">{S.day.route.stops(route.stops.length)}</span></p>
      {#if hasLegs && route.minutes > 0}
        <p class="num drtext drtotals"><span class="drnw">{S.day.route.distance(metresText(route.metres))}</span> · <span class="drnw">{S.day.route.moving(minutesText(route.minutes))}</span></p>
      {/if}
      {#if extra}<p class="num drextra">{S.day.route.optionalPlus(minutesText(route.optionalMinutes))}</p>{/if}
    </div>
    {#if hasLegs}<p class="small drcap">{S.day.route.caption(DETOUR)}</p>{/if}
    <a class="drmap" href={router.mapHash(tripId)} onclick={showDay}>
      <Icon name="map" size={16} />{S.day.route.seeMap}
    </a>

    {#if route.stops[0]}
      <!-- the first stop has no leg: its route starts from you, in the legs' own button -->
      <div class="drstart"><span class="small">{S.day.route.fromYou}</span>{@render go(route.stops[0].place, null, null)}</div>
    {/if}

    <ol class="drlist" aria-label={S.day.route.listAria}>
      {#each route.stops as s, i (s.id)}
        {@const next = route.legs[i]}
        {@const toBed = i === route.stops.length - 1 ? route.toBed : null}
        {@const p = s.place}
        <li class="drstop">
          <div class="drrail">
            <span class="drbadge num" class:opt={s.optional}>{s.n}</span>
            {#if next || toBed}<span class="drline" class:opt={(next ?? toBed)?.optional} aria-hidden="true"></span>{/if}
          </div>
          <div class="drbody">
            <div class="drrow">
              <span class="drname"
                ><span class="drlabel">{p.label}{#if s.optional}<span class="drtag">{S.day.route.optional}</span>{/if}</span
                >{#if p.native}<span class="zh drzh" lang="zh">{p.native}</span>{/if}</span
              >
              <a class="drpill" href={router.mapHash(tripId, s.id)} onclick={showDay} aria-label={S.mapTab.showOnMapAria(p.name)}>
                <Icon name="map" size={15} />{S.day.route.mapPill}
              </a>
            </div>
            <!-- a ticket for today riding with this place (its `with`, logic/reserveby.ts) -->
            {#each placeTickets(p, date) as t (t.id)}<span class="drtk"><TicketChip booking={t} {tripId} /></span>{/each}
            {#if next}
              {@render leg(next, route.stops[i + 1]?.place.label ?? '', false)}
            {:else if toBed && route.bed}
              {@render leg(toBed, `${S.day.route.tonightsBed}, ${route.bed.label}`, true)}
            {/if}
          </div>
        </li>
      {/each}
    </ol>

    {#if route.toBed}{@render bed()}{/if}
    {@render chips(rest, false)}
    {#if !route.toBed}{@render bed()}{/if}
  </div>
{:else}
  {@render chips(places, true)}
  {@render bed()}
{/if}

<style>
  .dayroute {
    margin: 16px 0 8px;
  }
  .dphead {
    display: block;
    color: var(--ink-2);
  }
  /* "5 stops" on its own line, the totals under it, each figure a unit that
     never breaks inside — at 384 px "≈ 1 h 52 moving" was split in two */
  .drsum {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 8px 0 0;
  }
  .drsum p {
    margin: 0;
  }
  .drn {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .drtotals {
    display: flex;
    flex-wrap: wrap;
    column-gap: 6px;
    padding-left: 22px;
  }
  .drnw {
    white-space: nowrap;
  }
  .drextra {
    padding-left: 22px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
    white-space: nowrap;
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
  /* an optional stop: the same badge as a ring, its line dashed */
  .drbadge.opt {
    background: transparent;
    border: 2px dashed var(--c);
    color: var(--ink);
  }
  .drline.opt {
    width: 0;
    background: none;
    border-left: 2px dashed var(--c);
    opacity: 0.8;
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
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 6px;
    min-height: 44px;
  }
  .drname {
    flex: 1 1 140px;
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
  .drtk {
    display: flex;
    margin: 0 0 8px;
  }
  .drzh {
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .drtag {
    margin-left: 8px;
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--faint);
    white-space: nowrap;
  }
  /* the one Map pill on a stop: a link into the Map tab */
  .drpill {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-pill);
    background: var(--card);
    color: var(--ink);
    font-size: var(--fs-caption);
    font-weight: 600;
    text-decoration: none;
  }
  .drpill:active {
    color: var(--sunrise);
  }

  /* ---------- a leg, and its turn-by-turn beside it ---------- */
  .drlegrow {
    align-self: stretch;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 6px;
  }
  /* the buttons that hand a stop to a map app line up on the right, where the
     stop rows' Map pills are — beside their leg, or under it when it is long */
  .drstart {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-left: 42px;
  }
  .drstart .drgo {
    margin-bottom: 0;
  }
  .drgo {
    margin: 0 0 8px auto;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 44px;
    padding: 0 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius-pill);
    background: var(--card);
    color: var(--ink);
    font: inherit;
    font-size: var(--fs-caption);
    font-weight: 600;
  }
  .drgo:active {
    color: var(--sunrise);
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
  .drleg.opt {
    border-color: var(--line);
    color: var(--faint);
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
