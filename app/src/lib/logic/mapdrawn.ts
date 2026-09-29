/* WHERE THE MAP TAB DRAWS A PLACE, AND WHICH IT DRAWS (Map 5c) — the two
   answers the screens that start the app need for their "Show on map"
   doorways (the guide, the pass, Find, the day), kept apart from the Map
   tab's own logic (./mapplaces) so that stays in the Map's lazy chunk.
   The rule is the one in types.ts, under Coord: `coord ?? pin`, and `pin`
   is only ever drawn. */
import type { Booking, Coord, ShowCard, Stop } from '../model/types';

const okCoord = (c: Coord | undefined): c is Coord =>
  !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng) && Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180;

/** Where a place is DRAWN: its coordinate, else its pin. */
export function placePos(e: { coord?: Coord; pin?: Coord }): Coord | undefined {
  if (okCoord(e.coord)) return e.coord;
  if (okCoord(e.pin)) return e.pin;
  return undefined;
}

/** The ids the Map tab draws a pin for — a spot, a place card, a live bed or
    ticket with a position (a ticket that rides with its place answers too).
    What the "Show on map" doorways read: no pin, no doorway. */
export function drawnIds(src: { stops: Stop[]; showCards: ShowCard[]; bookings: Booking[] }): Set<string> {
  const ids = new Set<string>();
  for (const s of src.stops) for (const sp of s.spots ?? []) if (placePos(sp)) ids.add(sp.id);
  for (const c of src.showCards) if (c.kind === 'place' && !c.pending && placePos(c)) ids.add(c.id);
  for (const b of src.bookings) {
    if ((b.kind === 'hotel' || b.kind === 'activity') && b.status !== 'cancelled' && !b.alternative && placePos(b)) ids.add(b.id);
  }
  return ids;
}
