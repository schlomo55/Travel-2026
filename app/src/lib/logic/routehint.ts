/* WHERE THE DAY'S ROUTE STANDS, AND WHETHER IT IS ONE (demo) — the two answers
   the Day view needs BEFORE the route's own chunk has loaded (dayroute.ts and
   mapplaces.ts are the Map's weight and stay out of the start-up JavaScript),
   so it can put the route in the right place — or leave the old chips and bed
   where they were — without a jump when the chunk arrives. Small, pure, and
   held to dayroute.ts by tests/dayroute.test.ts over every day of the seed.

   A "route" needs at least MIN_ROUTE_STOPS places with a pin: one place is a
   pin on the map, not a way from one place to the next. */
import type { Booking, Coord, ShowCard, Stop } from '../model/types';
import { bookingOnMap, placePos } from './mapdrawn';

export const MIN_ROUTE_STOPS = 2;
/** minutes past midnight: a timed line earlier than this keeps the top of the day */
export const ROUTE_FIRST_FROM = 10 * 60;

/** the same key mapPlaces merges by: several entities at one point are one place */
const posKey = (c: Coord): string => `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`;

/** How many distinct places with a pin the plan's ids name — dayRoute()'s
    stops.length, counted straight from the trip's own records: a spot, a place
    card, a live bed or ticket (a ticket at its spot's point is that spot); a
    stop, a flight and an unknown id are no place. */
export function pinnedPlaceCount(ids: readonly string[] | undefined, src: { stops: Stop[]; showCards: ShowCard[]; bookings: Booking[] }): number {
  if (!ids?.length) return 0;
  const want = new Set(ids);
  const at = new Set<string>();
  const add = (id: string, e: { coord?: Coord; pin?: Coord }): void => {
    const pos = want.has(id) ? placePos(e) : undefined;
    if (pos) at.add(posKey(pos));
  };
  for (const s of src.stops) for (const sp of s.spots ?? []) add(sp.id, sp);
  for (const c of src.showCards) if (c.kind === 'place' && !c.pending) add(c.id, c);
  for (const b of src.bookings) if (bookingOnMap(b)) add(b.id, b);
  return at.size;
}

/** The route takes the top of an ordinary day unless the day has something to
    be up for: a timed line before 10:00 (a 06:30 pickup is the first thing the
    day says), or a runbook / metro line (the travel day's own steps). Then the
    timed plan or the runbook comes first, and the route right after it. */
export function routeFirst(timedMinutes: readonly (number | null | undefined)[], hasRunbookOrLine: boolean): boolean {
  if (hasRunbookOrLine) return false;
  return !timedMinutes.some((m) => m != null && m < ROUTE_FIRST_FROM);
}
