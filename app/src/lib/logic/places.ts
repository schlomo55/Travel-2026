/* Turning a day's `placeIds` into things a map button can open.

   A DayPlan carries ids, not places — ids of whatever already exists in the
   trip: a stop, a spot nested in a stop, a driver card, a booking. They live in
   four different collections with four different shapes, and every one of them
   already carries the SAME map fields (coord / mapQuery / mapCity / mapUrl /
   address), which is the reason one button has always served all four.

   This module is the only place that flattens them. It answers with what the
   chip needs to draw and what MapButtons needs to open, and nothing else:

     label — the short name on the chip. A spot and a stop are named in
             English, a driver card is named in the script a driver reads
             (北京南站) because its `meaning` is a whole sentence, and a FLIGHT
             is named by the airport it leaves from, which is what its button
             opens (transform.ts → airportFields).
     mapName — what MapButtons is told the place is called: the string a
             long-press copies when there is no address, and the one the
             aria-label reads out. Same choice each surface already makes.

   AN ID THAT RESOLVES TO NOTHING IS DROPPED, silently and on purpose. The
   build is where that is caught (scripts/china/assert.ts fails the seed on an
   unknown or unopenable id), so by the time the app runs, a missing entity
   means the traveller deleted it — and a trip that lost a place should lose
   its chip, not throw. Nothing here fetches anything. */
import type { Booking, Coord, Id, ShowCard, Stop } from '../model/types';

export interface PlaceRef {
  id: Id;
  /** the chip's own text */
  label: string;
  /** what MapButtons calls the place */
  mapName: string;
  coord?: Coord;
  mapQuery?: string;
  mapCity?: string;
  mapUrl?: string;
  address?: string;
  addressInSearch?: boolean;
}

/** The four map fields, on any of the four kinds. */
interface Mappable {
  coord?: Coord;
  mapQuery?: string;
  mapCity?: string;
  mapUrl?: string;
  address?: string;
  addressInSearch?: boolean;
}

/** True when a map button would render for this entity: a saved link, a name,
    an address or a coordinate — the same four `googleMapsUrl` accepts. */
export function isOpenable(e: Mappable): boolean {
  return !!(e.mapUrl?.trim() || e.mapQuery?.trim() || e.address?.trim() || e.coord);
}

function mapFieldsOf(e: Mappable): Mappable {
  return {
    ...(e.coord ? { coord: e.coord } : {}),
    ...(e.mapQuery ? { mapQuery: e.mapQuery } : {}),
    ...(e.mapCity ? { mapCity: e.mapCity } : {}),
    ...(e.mapUrl ? { mapUrl: e.mapUrl } : {}),
    ...(e.address ? { address: e.address } : {}),
    ...(e.addressInSearch ? { addressInSearch: true } : {}),
  };
}

export interface PlaceSource {
  stops?: Stop[];
  showCards?: ShowCard[];
  bookings?: Booking[];
}

/** Everything in a trip that a `placeIds` entry may point at, by id. */
export function placeIndex({ stops = [], showCards = [], bookings = [] }: PlaceSource): Map<Id, PlaceRef> {
  const index = new Map<Id, PlaceRef>();
  const put = (id: Id, label: string, mapName: string, e: Mappable): void => {
    index.set(id, { id, label, mapName, ...mapFieldsOf(e) });
  };
  for (const s of stops) {
    put(s.id, s.name, s.mapQuery ?? s.name, s);
    for (const sp of s.spots ?? []) put(sp.id, sp.name, sp.native ?? sp.name, sp);
  }
  /* A driver card's `meaning` is a sentence ("Beijing Daxing International
     Airport (PKX) — arrival Nov 22"), so the chip wears its `native` — the name
     on the door — and the sentence goes to the button's label, exactly as the
     driver list in Info does. */
  for (const c of showCards) if (c.kind === 'place') put(c.id, c.native, c.meaning, c);
  /* A flight's map button opens the airport it LEAVES from, so that is what the
     chip must be called: "Etihad Airways · EY 608" is a booking, not a place. */
  for (const b of bookings) {
    const label = b.kind === 'flight' ? (b.from.name ?? b.from.code) : b.title;
    put(b.id, label, label, b);
  }
  return index;
}

/** The day's places, in the day's own order, first mention winning. Unknown
    ids and ids with no map target are dropped — the build already refused to
    ship either, so this is the app being unkillable, not the app being lax. */
export function resolvePlaces(ids: Id[] | undefined, source: PlaceSource): PlaceRef[] {
  if (!ids?.length) return [];
  const index = placeIndex(source);
  const out: PlaceRef[] = [];
  const seen = new Set<Id>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const ref = index.get(id);
    if (ref && isOpenable(ref)) out.push(ref);
  }
  return out;
}

/** A place's name where the room is tight — the Pocket's driver chips, the
    pass's two ends, Counter mode's route. It shortens by whole words only:
    the words before the trip file's own " — " aside; "Terminal 2" → "T2",
    "Railway Station" → "Station"; and an airport's "International",
    "Intl" and "Airport" go wherever its code is shown with it ("Beijing
    Daxing International Airport (PKX)" → "Beijing Daxing (PKX)", as the
    boards write it) — else "International Airport" → "Intl". The full name
    stays where there is room (the white driver card, the chip's accessible
    name, the pass's own screen reader label).
    Run 3c: the code is looked for in the part that is kept (not in the
    aside), only the airport words that END the name go — before its code,
    its terminal or its " · " — so "Airport Express (AEL)" keeps its first
    word, and nothing is ever shortened to nothing. */
export function shortPlaceName(name: string, coded?: boolean): string {
  const kept = (name.split(' — ')[0] ?? name).trim();
  const short = (
    (coded ?? /\([A-Z]{3}\)/.test(kept))
      ? kept.replace(/(?<!\b(?:International|Intl))\s+(?:(?:International|Intl)(?:\s+Airport)?|Airport)(?=\s*(?:$|\(|·|Terminal\b|T\d))/g, '')
      : kept.replace(/\bInternational( Airport)?\b/g, 'Intl')
  )
    .replace(/\bTerminal (\d{1,2})\b/g, 'T$1')
    .replace(/\bRailway Station\b/g, 'Station')
    .trim();
  return short || kept || name;
}
