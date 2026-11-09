/* THE MAP'S SCOPE — which part of the trip the Map tab's chips, rail, list and counts are about: one stop
   (a city), or the whole trip. It is a CHOICE and nothing else: it changes when the person changes it, never
   because the camera moved.

   (Until 10 Nov 2026 the scope was DERIVED from where the map's camera rested — `nearestStop(settled)` — so a
   flight to a place, to your first fix, or a pan out of every city's 80 km quietly turned "Beijing · 6 places"
   into "the whole trip · 141 places". Now the camera and the scope are two things.)

   The default, before anyone has chosen: during the trip, the stop you are in (the app's own `currentStop`);
   before the first day and after the last, the whole trip; a trip with one stop — or none that is dated — is
   its own scope, so the whole trip. `null` is "the whole trip" throughout. */
import type { ISODate, Stop, Trip } from '../model/types';
import { currentStop, realStops } from './day';
import type { DayRoute } from './dayroute';
import { tripPhase } from './phase';
import { inStop, shown, type MapPlace, type ShowFilter } from './mapplaces';

/** a stop's id, or null: the whole trip */
export type ScopeId = string | null;

/** A stop with real dates — an empty or missing one cannot be "now". */
const dated = (s: Stop): boolean => !!s.start && !!s.end;

/** The scope the Map opens on when nobody has chosen one. */
export function defaultScope(trip: Pick<Trip, 'start' | 'end'>, stops: Stop[], now: ISODate): ScopeId {
  if (realStops(stops).length < 2) return null; // one stop: the trip IS the stop
  if (tripPhase(trip, now) !== 'during') return null; // not started, or over
  const here = currentStop(stops.filter(dated), now);
  return here && here.kind === 'stop' ? here.id : null; // a travel day, a gap: the whole trip, never a guess
}

/** What the screen uses: the person's choice while it still names a stop of this trip, else the default. */
export function resolveScope(chosen: ScopeId | undefined, fallback: ScopeId, stops: Stop[]): ScopeId {
  if (chosen === undefined) return fallback;
  if (chosen === null) return null;
  return realStops(stops).some((s) => s.id === chosen) ? chosen : fallback;
}

/** A stop's short name: the city before the first " — " ("Beijing — the old town" → "Beijing"). */
export const stopWhere = (s: Pick<Stop, 'name'>): string => (s.name.split(' — ')[0] ?? s.name).trim();

export interface ScopeOption {
  /** the stop's id; null is the whole trip */
  id: ScopeId;
  /** a stop's short name; the whole trip's label is the screen's words (it is the caller's to say) */
  name: string | null;
  /** places with a pin that "All" would draw there — the number beside the chip */
  n: number;
}

/** How many places with a pin a scope holds, as the "All" chip counts them (hotels: your beds only, or all). */
export function scopeCount(places: MapPlace[], id: ScopeId, hotels: 'beds' | 'all'): number {
  const f: ShowFilter = { off: new Set(), hotels };
  return inStop(places, id).filter((p) => p.pos && shown(p, f)).length;
}

/** The choices: the whole trip, then each stop in trip order. */
export function scopeOptions(stops: Stop[], places: MapPlace[], hotels: 'beds' | 'all'): ScopeOption[] {
  return [
    { id: null, name: null, n: scopeCount(places, null, hotels) },
    ...realStops(stops).map((s) => ({ id: s.id, name: stopWhere(s), n: scopeCount(places, s.id, hotels) })),
  ];
}

/** Where a scope's places are on the ground — what the camera frames when it opens on them or the scope changes. */
export function scopePoints(places: MapPlace[], id: ScopeId, f: ShowFilter): [number, number][] {
  return inStop(places, id)
    .filter((p) => p.pos && shown(p, f))
    .map((p) => [p.pos!.lng, p.pos!.lat] as [number, number]);
}

/* ---------- the places' sheet at its peek: one row of chips ---------- */

/** A chip in the peek row: a place, and — for a day's stop — its number and the day's colour. */
export interface PeekChip {
  place: MapPlace;
  n?: number;
  colour?: string;
}

/** The peek row's chips: while the map draws a route, that route's stops in the plan's order (every day's, one
    after the other, for "All days"; tonight's bed after a single day's); else the places the cards would show,
    in the order the rail has them — `limit` of them, the rest are one tap away in the List. */
export function peekChips(rail: readonly MapPlace[], routes: readonly DayRoute[], limit = 12): PeekChip[] {
  if (routes.length) {
    const stops = routes.flatMap((r) => r.stops.map((s) => ({ place: s.place, n: s.n, colour: r.colour })));
    const bed = routes.length === 1 && routes[0]!.bed && routes[0]!.toBed ? [{ place: routes[0]!.bed }] : [];
    return [...stops, ...bed];
  }
  return rail.slice(0, limit).map((place) => ({ place }));
}
