/* THE PLACES A PHOTO IS LOOKED FOR (Map 5e) — every place the Map tab DRAWS
   (`coord ?? pin`, lib/logic/mapplaces.ts — the same function, so the photos
   and the pins can never disagree), each with the Wikidata item that verified
   its position in Map 5a, when one did: the item the OSM answer linked to, or
   the one that agreed with a stored coordinate (china/pins.ts). That item is
   the first place to look — its image (P18), its English Wikipedia article,
   its official website (P856) — because it is the item already proven to BE
   this place, not a namesake a search turned up.

   Pure: the seed in, places out. Nothing here goes online. */
import type { AppBackup, Coord, PlaceCategory } from '../../../src/lib/model/types';
import { mapPlaces } from '../../../src/lib/logic/mapplaces';
import { COORD_CHECKS, PINS } from '../../china/pins';

export interface PhotoPlace {
  /** the Map tab's id for the place (the lead entity) */
  id: string;
  /** every entity riding at this point — the index answers for each */
  ids: string[];
  name: string;
  native?: string;
  category: PlaceCategory;
  stopId?: string;
  /** the stop's short name, for the reports */
  city: string;
  pos: Coord;
  /** the Wikidata item Map 5a's evidence names for it, and where that came from */
  wd?: string;
  wdFrom?: string;
}

/** The Wikidata item Map 5a's evidence ties to an entity — only where that
    evidence CONFIRMED the position (a stored coordinate the item did not
    agree with — the Tianmen cableway card, the Shenzhen address — gets none). */
export function map5aItem(entity: string): { wd: string; from: string } | undefined {
  for (const [key, p] of Object.entries(PINS)) {
    if (p.entity === entity && p.ok && p.wd) return { wd: p.wd, from: `pins.ts ${key} (${p.sources ?? 'osm+wikidata'})` };
  }
  for (const [key, c] of Object.entries(COORD_CHECKS)) {
    if (c.entity === entity && c.confirmed && c.wd && c.wdKm !== undefined && c.wdKm <= 1) return { wd: c.wd, from: `pins.ts COORD_CHECKS ${key} (${c.wdKm} km)` };
  }
  return undefined;
}

/** Every drawn place of the seed's trip, in the Map tab's own order. */
export function photoPlaces(seed: AppBackup): PhotoPlace[] {
  const t = seed.trips[0];
  if (!t) throw new Error('the seed carries no trip');
  const cityOf = new Map(t.stops.map((s) => [s.id, (s.name.split(' — ')[0] ?? s.name).trim()]));
  const places = mapPlaces({ tripId: t.trip.id, stops: t.stops, showCards: t.showCards, bookings: t.bookings, dayPlans: t.dayPlans, dayDefaults: t.dayDefaults });
  return places
    .filter((p) => p.pos)
    .map((p) => {
      const ids = [p.id, ...p.with.map((w) => w.id)];
      const item = ids.map(map5aItem).find((x) => !!x);
      return {
        id: p.id,
        ids,
        name: p.name,
        ...(p.native ? { native: p.native } : {}),
        category: p.category,
        ...(p.stopId ? { stopId: p.stopId } : {}),
        city: (p.stopId && cityOf.get(p.stopId)) || '—',
        pos: p.pos!,
        ...(item ? { wd: item.wd, wdFrom: item.from } : {}),
      };
    });
}
