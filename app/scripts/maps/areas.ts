/* THE MAP PACK'S AREAS (Map 5c) — the workshop's door to them. The rule
   itself (anchors, the coverage-only points, boxes, the region) lives in the
   app, src/lib/map/region.ts, since the in-app map builder (7 Nov 2026): the
   phone's "Build map for this trip" and `npm run map:pack` must cut the same
   region from the same trip, so there is one copy of it. This file only
   adapts a trip FILE (a seed's TripBundle) to it, for build-pack.ts and the
   tests. */
import type { AppBackup, TripBundle } from '../../src/lib/model/types';
import type { PlaceSources } from '../../src/lib/logic/mapplaces';
import { CITY_KM } from '../../src/lib/logic/citymap';
import * as region from '../../src/lib/map/region';

export { boxesOf, boxKm2, COVERAGE, LINK_KM, MARGIN_KM, packName, regionOf, STOP_MIN_KM } from '../../src/lib/map/region';
export type { Anchor, AnchorSrc, Area, Box, Dropped, Region } from '../../src/lib/map/region';

/** What the region reads of a trip file. */
export const sourcesOf = (t: TripBundle): PlaceSources => ({
  tripId: t.trip.id,
  stops: t.stops,
  showCards: t.showCards,
  bookings: t.bookings,
  dayPlans: t.dayPlans,
  dayDefaults: t.dayDefaults,
});

/** Every anchor of a trip, and what was left out and why. */
export const anchorsOf = (t: TripBundle): ReturnType<typeof region.anchorsOf> => region.anchorsOf(sourcesOf(t));

/** The areas, one per stop, in trip order (region.ts areasOf). */
export const areasOf = (t: TripBundle): ReturnType<typeof region.areasOf> => region.areasOf(sourcesOf(t));

/** Does the region hold all of [w, s, e, n] — inside one box (its boxes never overlap)? The workshop's test pack is
    cut round Houhai only from a pack whose region does (build-pack.ts). */
export const regionCovers = (boxes: { w: number; s: number; e: number; n: number }[], [w, s, e, n]: [number, number, number, number]): boolean =>
  boxes.some((b) => b.w <= w && b.s <= s && b.e >= e && b.n >= n);

/** The trip a seed file carries (the first one). */
export function tripOf(seed: AppBackup): TripBundle {
  const t = seed.trips[0];
  if (!t) throw new Error('the seed carries no trip');
  return t;
}

export { CITY_KM };
