/* THE DAY ON THE MAP (demo, Wanderlog-inspired) — which day's route the Map
   tab draws, its day chips, and the route as the street map draws it.

   The routes themselves are dayroute.ts's: a place is numbered where it is
   DRAWN, a place with no pin is never guessed onto the map, and every leg is
   an estimate. This module only chooses among them (state/mapDay.svelte.ts
   holds the choice) and turns them into plain lines and numbered points for
   lib/map/street — which knows nothing of the trip.

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
  /** the days of the anchor's stay that have a route — one chip each, in date order */
  days: DayRoute[];
  /** what "All days" draws: the days spent in the city — a travel day's plan starts at the airport or the
      station it leaves from, and its legs are no walk or taxi (each still has its own chip) */
  every: DayRoute[];
  /** what is drawn */
  shown: DayRoute[];
}

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
  let days = stayRoutes(src, anchor, places, modes);
  const settled = days.filter((r) => !travelDay(src, r.date));
  const every = settled.length ? settled : days;
  if (sel === 'off') return { anchor, days, every, shown: [] };
  if (sel === 'all') return { anchor, days, every, shown: every };
  const want = date ?? now;
  const one = days.find((r) => r.date === want) ?? dayRoute(src, want, places, modes);
  /* a chosen day outside every stay (a travel day) still has its chip */
  if (one && !days.some((r) => r.date === one.date)) days = [...days, one].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { anchor, days, every, shown: one ? [one] : [] };
}

export interface DayChip {
  date: ISODate;
  colour: string;
  today: boolean;
  stops: number;
  on: boolean;
}

/** The chips: a day each, "All days" and "Off" — which of them is pressed. */
export function dayChips(r: MapRoutes, sel: DaySel, now: ISODate): { days: DayChip[]; all: boolean; off: boolean } {
  const single = sel !== 'all' && r.shown.length === 1 ? r.shown[0]!.date : null;
  return {
    days: r.days.map((d) => ({ date: d.date, colour: d.colour, today: d.date === now, stops: d.stops.length, on: d.date === single })),
    all: sel === 'all',
    /* nothing drawn — Off chosen, or today has no route of its own */
    off: r.shown.length === 0,
  };
}

/** The selection a day chip makes: today's is null, so it follows the app's clock (and its preview date). */
export const chipSel = (date: ISODate, now: ISODate): DaySel => (date === now ? null : date);

/** A key that changes when what is drawn changes place (not when a leg's mode does). */
export const shownKey = (shown: DayRoute[]): string => shown.map((r) => `${r.date}:${r.stops.map((s) => s.id).join(',')}`).join('|');

/* ---------- what the street map draws ---------- */

export interface RouteDrawStop {
  id: string;
  /** 1-based, the plan's order */
  n: number;
  lng: number;
  lat: number;
  label: string;
  cat: PlaceCategory;
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
    stops: r.stops.map((s) => ({ id: s.id, n: s.n, lng: s.pos.lng, lat: s.pos.lat, label: s.place.label, cat: s.place.category })),
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

/** The map image of a numbered pin: `rt-<rrggbb>-<n>[-s]` (-s: the chosen one). */
export function routePinName(colour: string, n: number, selected: boolean): string {
  return `rt-${colour.replace('#', '').toLowerCase()}-${n}${selected ? '-s' : ''}`;
}
export function parseRoutePinName(name: string): { colour: string; n: number; selected: boolean } | null {
  const m = /^rt-([0-9a-f]{6})-(\d{1,3})(-s)?$/.exec(name);
  return m?.[1] && m[2] ? { colour: `#${m[1]}`, n: Number(m[2]), selected: !!m[3] } : null;
}

/** The lines: the stops in order, solid; the last stop to the bed, dotted (`k`: 'path' | 'bed'). */
export function routeLineData(routes: readonly RouteDraw[]) {
  const features: { type: 'Feature'; properties: { c: string; k: 'path' | 'bed' }; geometry: { type: 'LineString'; coordinates: LngLat[] } }[] = [];
  for (const r of routes) {
    const path = r.stops.map((s): LngLat => [s.lng, s.lat]);
    if (path.length >= 2) features.push({ type: 'Feature', properties: { c: r.colour, k: 'path' }, geometry: { type: 'LineString', coordinates: path } });
    const last = path[path.length - 1];
    if (r.bed && last) features.push({ type: 'Feature', properties: { c: r.colour, k: 'bed' }, geometry: { type: 'LineString', coordinates: [last, [r.bed.lng, r.bed.lat]] } });
  }
  return { type: 'FeatureCollection' as const, features };
}

/** The numbered pins; the chosen place's drawn on top. `v: ''` and `label`, as a category pin's, so the screen
    keeps its words off the name under it. */
export function routeStopData(routes: readonly RouteDraw[], selected: string | null) {
  return {
    type: 'FeatureCollection' as const,
    features: routes.flatMap((r) =>
      r.stops.map((s) => {
        const sel = s.id === selected;
        return {
          type: 'Feature' as const,
          properties: { id: s.id, n: s.n, c: r.colour, label: s.label, cat: s.cat, v: '', img: routePinName(r.colour, s.n, sel), k: sel ? 1000 : s.n },
          geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] as LngLat },
        };
      }),
    ),
  };
}

/** The routes' sum: how many stops, the estimated metres and moving minutes. */
export function routeTotals(routes: readonly DayRoute[]): { stops: number; metres: number; minutes: number; legs: number } {
  return routes.reduce(
    (a, r) => ({ stops: a.stops + r.stops.length, metres: a.metres + r.metres, minutes: a.minutes + r.minutes, legs: a.legs + r.legs.length + (r.toBed ? 1 : 0) }),
    { stops: 0, metres: 0, minutes: 0, legs: 0 },
  );
}
