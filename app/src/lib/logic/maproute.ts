/* THE DAY ON THE MAP (demo, Wanderlog-inspired) — which day's route the Map
   tab draws, its day chips, and the route as the street map draws it.

   The routes themselves are dayroute.ts's: a place is numbered where it is
   DRAWN, a place with no pin is never guessed onto the map, and every leg is
   an estimate. This module only chooses among them (state/mapDay.svelte.ts
   holds the choice) and turns them into plain lines and numbered points for
   lib/map/street — which knows nothing of the trip (it draws them as GeoJSON in
   lib/map/street/routes.ts, in the engine's own chunk).

   Pure: routes in, choices and drawings out. */
import type { ISODate, PlaceCategory } from '../model/types';
import { dayRoute, stayRoutes, type DayRoute, type LegMode } from './dayroute';
import { resolveDay } from './day';
import { isTravelDay } from './metroline';
import type { MapPlace, PlaceSources } from './mapplaces';

/** What the Map tab draws: null — today; 'all' — every day of the stay; 'off' — none; a date — that day. */
export type DaySel = ISODate | 'all' | 'off' | null;

type LngLat = [number, number];

/** The day a selection names, if it names one. */
export const selDate = (sel: DaySel): ISODate | null => (sel && sel !== 'all' && sel !== 'off' ? sel : null);

export interface MapRoutes {
  /** the day the chips are for: the chosen day, else the last day chosen, else today */
  anchor: ISODate;
  /** the days of the anchor's stay that have a route — one chip each, in date order, and exactly what "All
      days" draws. A TRAVEL day is not one of them (its plan starts at the airport or the station it leaves
      from, a city away: "All days" would frame both cities) unless it is today, the day chosen or the last
      day chosen — then it is a day of this map like the others, chip and "All days" alike */
  days: DayRoute[];
  /** what is drawn */
  shown: DayRoute[];
}

/** A ROUTE IS TWO STOPS OR MORE: a day whose plan pins one place has nothing to number or join — its place keeps
    its own pin, and the day gets no chip (as the day view draws no route for it). */
export const MIN_ROUTE_STOPS = 2;
const routed = (r: DayRoute): boolean => r.stops.length >= MIN_ROUTE_STOPS;

/** A day the trip moves on (its runbook, or a flight or train that day) — logic/metroline's own rule. */
export function travelDay(src: PlaceSources, date: ISODate): boolean {
  const day = resolveDay(date, src.dayPlans ?? [], src.dayDefaults ?? [], src.stops);
  return isTravelDay(day?.runbookId, src.bookings, date);
}

/**
 * The routes for a selection. `last` is the last day chosen before 'all' or
 * 'off' (so "All days" stays on the stay of the day that was chosen).
 */
export function mapRoutes(
  src: PlaceSources,
  places: MapPlace[],
  sel: DaySel,
  now: ISODate,
  last: ISODate | null = null,
  modes: Readonly<Record<string, LegMode>> = {},
): MapRoutes {
  const date = selDate(sel);
  const anchor = date ?? (sel === null ? now : (last ?? now));
  const keep = (d: ISODate): boolean => d === now || d === date || d === last || !travelDay(src, d);
  let days = stayRoutes(src, anchor, places, modes).filter((r) => routed(r) && keep(r.date));
  if (sel === 'off') return { anchor, days, shown: [] };
  if (sel === 'all') return { anchor, days, shown: days };
  const want = date ?? now;
  const found = days.find((r) => r.date === want) ?? dayRoute(src, want, places, modes);
  const one = found && routed(found) ? found : null;
  /* a chosen day outside every stay (a travel day between two) still has its chip */
  if (one && !days.some((r) => r.date === one.date)) days = [...days, one].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { anchor, days, shown: one ? [one] : [] };
}

export interface DayChip {
  date: ISODate;
  colour: string;
  today: boolean;
  on: boolean;
}

/** The chips: a day each, "All days" and "No route" — which of them is pressed. */
export function dayChips(r: MapRoutes, sel: DaySel, now: ISODate): { days: DayChip[]; all: boolean; off: boolean } {
  const single = sel !== 'all' && r.shown.length === 1 ? r.shown[0]!.date : null;
  return {
    days: r.days.map((d) => ({ date: d.date, colour: d.colour, today: d.date === now, on: d.date === single })),
    all: sel === 'all',
    /* nothing drawn — "No route" chosen, or today has no route of its own */
    off: r.shown.length === 0,
  };
}

/** The selection a day chip makes: today's is null, so it follows the app's clock (and its preview date). */
export const chipSel = (date: ISODate, now: ISODate): DaySel => (date === now ? null : date);


/* ---------- what the street map draws ---------- */

export interface RouteDrawStop {
  id: string;
  /** 1-based, the plan's order */
  n: number;
  lng: number;
  lat: number;
  label: string;
  cat: PlaceCategory;
  /** the plan marks it optional: drawn quieter */
  optional?: boolean;
}
export interface RouteDraw {
  /** the day's colour, #rrggbb */
  colour: string;
  stops: RouteDrawStop[];
  /** tonight's bed, when the last stop has a leg to it: drawn dotted */
  bed: { lng: number; lat: number } | null;
}

/** The routes as the street map takes them. */
export function routeDraws(routes: DayRoute[]): RouteDraw[] {
  return routes.map((r) => ({
    colour: r.colour,
    stops: r.stops.map((s) => ({ id: s.id, n: s.n, lng: s.pos.lng, lat: s.pos.lat, label: s.place.label, cat: s.place.category, ...(s.optional ? { optional: true } : {}) })),
    bed: r.toBed && r.bed?.pos ? { lng: r.bed.pos.lng, lat: r.bed.pos.lat } : null,
  }));
}

/** Every place drawn as a numbered stop — its category pin steps aside. */
export function routeIds(routes: readonly RouteDraw[]): Set<string> {
  return new Set(routes.flatMap((r) => r.stops.map((s) => s.id)));
}

/** What the camera frames for a route: its stops and tonight's bed. */
export function routeFit(routes: readonly RouteDraw[]): LngLat[] {
  return routes.flatMap((r) => [...r.stops.map((s): LngLat => [s.lng, s.lat]), ...(r.bed ? [[r.bed.lng, r.bed.lat] as LngLat] : [])]);
}

/* ---------- stops that would lie on one another ---------- */

/** A numbered pin's round, CSS px (pins.ts paints it): closer than this on screen, two stops' pins overlap. */
export const STOP_PIN_PX = 28;

export interface StopGroup {
  /** the stops in it, in plan order (a day's, then the next day's): the first is the one a tap opens */
  stops: RouteDrawStop[];
  /** the badge: "3", or "1·5" where several stops share the spot at this zoom */
  text: string;
  colour: string;
}

/** The stops of `routes` grouped by where their pins land at `zoom` (maplibre's 512 px world): a stop joins the
    first group whose first stop is less than `px` away on screen, so two pins never lie one under the other —
    "1·5" stands for both, and a group falls apart again as the map zooms in. Pure: it moves with the zoom only
    (a pan or a turn of the map moves every pin alike). */
export function groupStops(routes: readonly RouteDraw[], zoom: number, px = STOP_PIN_PX): StopGroup[] {
  const world = 512 * 2 ** zoom;
  const at = (s: RouteDrawStop): [number, number] => {
    const sin = Math.sin((s.lat * Math.PI) / 180);
    return [((s.lng + 180) / 360) * world, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * world];
  };
  const groups: { at: [number, number]; stops: RouteDrawStop[]; colour: string }[] = [];
  for (const r of routes)
    for (const s of r.stops) {
      const p = at(s);
      const g = groups.find((x) => Math.hypot(x.at[0] - p[0], x.at[1] - p[1]) < px);
      if (g) g.stops.push(s);
      else groups.push({ at: p, stops: [s], colour: r.colour });
    }
  return groups.map((g) => ({ stops: g.stops, colour: g.colour, text: g.stops.map((s) => s.n).join('·') }));
}

/** The stops drawn in one badge with `id` at `zoom` — itself alone when its pin stands on its own. */
export function stopsWith(routes: readonly RouteDraw[], zoom: number, id: string): string[] {
  const g = groupStops(routes, zoom).find((x) => x.stops.some((s) => s.id === id));
  return g ? g.stops.map((s) => s.id) : [id];
}

/** The routes' sum: how many stops, the estimated metres and moving minutes. */
export function routeTotals(routes: readonly DayRoute[]): { stops: number; metres: number; minutes: number; legs: number } {
  return routes.reduce(
    (a, r) => ({ stops: a.stops + r.stops.length, metres: a.metres + r.metres, minutes: a.minutes + r.minutes, legs: a.legs + r.legs.length + (r.toBed ? 1 : 0) }),
    { stops: 0, metres: 0, minutes: 0, legs: 0 },
  );
}
