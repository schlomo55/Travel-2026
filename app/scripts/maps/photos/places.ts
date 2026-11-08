/* THE PLACES A PHOTO IS LOOKED FOR (Map 5e) — every place the Map tab DRAWS
   (`coord ?? pin`, lib/logic/mapplaces.ts — the same function, so the photos
   and the pins can never disagree), each with the Wikidata item that verified
   its position in Map 5a, when one did: the item the OSM answer linked to, or
   the one that agreed with a stored coordinate. That item is the first place
   to look — its image (P18), its English Wikipedia article, its official
   website (P856) — because it is the item already proven to BE this place,
   not a namesake a search turned up.

   That evidence is one trip's (8 Nov 2026): it is read from the photo
   decisions' data (choices.json MAP5A_ITEMS) when that file is there. Any
   other trip — or a checkout without the file — has none: its places carry
   no item, and the lookups find them by name and position alone.

   Pure: the seed in, places out. Nothing here goes online. (And the photo
   scripts' one way to name their trip: --trip <file>, tripFileArg.) */
import { existsSync, readFileSync } from 'node:fs';
import type { AppBackup, Coord, PlaceCategory } from '../../../src/lib/model/types';
import { mapPlaces } from '../../../src/lib/logic/mapplaces';
import { MAP5A_ITEMS } from './choices';

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
    agree with gets none). None for a trip without that evidence. */
export function map5aItem(entity: string, items: Record<string, { wd: string; from: string }> = MAP5A_ITEMS): { wd: string; from: string } | undefined {
  const it = items[entity];
  return it ? { wd: it.wd, from: it.from } : undefined;
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
      const item = ids.map((id) => map5aItem(id)).find((x) => !!x);
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

/** The trip file a photo script is run for: `--trip <file>` (or `--trip=<file>`), like build-pack.ts — the trips'
    own files are not kept in this repository, so none is wired in. Exits with a word when there is none. */
export function tripFileArg(argv: string[] = process.argv): string {
  const i = argv.indexOf('--trip');
  const file = i > 0 ? argv[i + 1] : argv.find((a) => a.startsWith('--trip='))?.slice('--trip='.length);
  if (!file || !existsSync(file)) {
    console.error(file ? `No trip file at ${file}.` : 'Which trip? Pass its file: --trip <path/to/trip.json> (a trip file the app exports, or a seed — e.g. ../seed/demo-2027.trip.json)');
    process.exit(2);
  }
  return file;
}

/** The seed of the trip file a photo script is run for (tripFileArg). */
export const seedFromArgs = (argv: string[] = process.argv): AppBackup => JSON.parse(readFileSync(tripFileArg(argv), 'utf8')) as AppBackup;

/** The command line without `--trip <file>` (the scripts' other words are read from what is left). */
export const argsWithoutTrip = (argv: string[] = process.argv.slice(2)): string[] => argv.filter((a, i) => a !== '--trip' && argv[i - 1] !== '--trip' && !a.startsWith('--trip='));
