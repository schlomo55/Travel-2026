/* A DAY AS A ROUTE (demo, Wanderlog-inspired) — the places a day's plan
   names, in the plan's own order (DayPlan.placeIds, the explicit join), each
   numbered where it is DRAWN (MapPlace.pos), plus the leg between each two and
   on to tonight's bed.

   THE LEGS ARE ESTIMATES AND SAY SO. There is no routing graph on the phone:
   a leg is the straight line × DETOUR at a typical speed for its mode. Every
   screen that prints one prefixes "≈". The mode starts from the distance
   (walk up to WALK_UP_TO metres of walking, else taxi) and the traveller can
   switch it; their choice is passed in, never stored here.

   A place the plan names but that has no pin is kept in `unplaced` — listed,
   never guessed onto the map, never numbered.

   Pure: trip data in, a route out. */
import type { Coord, ISODate } from '../model/types';
import { haversineKm } from './geoStats';
import { currentStop, resolveDay } from './day';
import { compareIso } from './dates';
import { isTonight, mapPlaces, placeById, type MapPlace, type PlaceSources } from './mapplaces';

export type LegMode = 'walk' | 'taxi' | 'metro';
export const LEG_MODES: readonly LegMode[] = ['walk', 'taxi', 'metro'];

/** straight line → the way the streets actually go */
export const DETOUR = 1.3;
/** a leg starts as a walk when the walk is at most this long, in metres */
export const WALK_UP_TO = 1800;
/** past this straight line (metres) a leg is no walk, taxi or metro ride — a
    train, ferry or flight the bookings carry: no estimate, out of the totals */
export const FAR_METRES = 30_000;
/** km/h on the move, plus fixed minutes (hailing, stations) */
export const SPEED: Record<LegMode, { kmh: number; extra: number }> = {
  walk: { kmh: 4.5, extra: 0 },
  taxi: { kmh: 18, extra: 5 },
  metro: { kmh: 28, extra: 9 },
};

/** One colour per day of a stay, so a city's days stay apart on its map. Each
    is light enough for dark text on it; they differ in lightness, not hue alone. */
export const DAY_COLOURS = ['#ff9f6b', '#6cc4ff', '#b8a9ff', '#7fd9a0', '#ffc46b', '#ff8fa8'] as const;

export interface RouteStop {
  /** 1-based, the plan's order among the places that have a pin */
  n: number;
  /** the place's own id (MapPlace.id) — what the Map tab's address names */
  id: string;
  place: MapPlace;
  pos: Coord;
}

export interface Leg {
  fromId: string;
  toId: string;
  /** walked/driven metres — straight line × DETOUR */
  metres: number;
  mode: LegMode;
  minutes: number;
  /** the mode was the traveller's own choice, not the default */
  chosen: boolean;
  /** beyond FAR_METRES: not estimated (minutes 0), left out of the totals */
  far: boolean;
}

export interface DayRoute {
  date: ISODate;
  colour: string;
  stops: RouteStop[];
  /** named by the plan, no pin: listed, never drawn */
  unplaced: MapPlace[];
  /** legs[i] goes from stops[i] to stops[i + 1] */
  legs: Leg[];
  bed: MapPlace | null;
  /** last stop → tonight's bed, when both have a pin */
  toBed: Leg | null;
  metres: number;
  minutes: number;
}

/** "from>to" — the key a traveller's mode choice is kept under. */
export const legKey = (fromId: string, toId: string): string => `${fromId}>${toId}`;

export const defaultMode = (straightMetres: number): LegMode =>
  straightMetres * DETOUR <= WALK_UP_TO ? 'walk' : 'taxi';

export function legBetween(
  fromId: string,
  from: Coord,
  toId: string,
  to: Coord,
  modes: Readonly<Record<string, LegMode>> = {},
): Leg {
  const straight = haversineKm(from, to) * 1000;
  const own = modes[legKey(fromId, toId)];
  const mode = own ?? defaultMode(straight);
  const metres = straight * DETOUR;
  const s = SPEED[mode];
  const far = straight > FAR_METRES;
  const minutes = far ? 0 : Math.max(2, Math.round((metres / 1000 / s.kmh) * 60 + s.extra));
  return { fromId, toId, metres, mode, minutes, chosen: !!own, far };
}

/** The next mode a tap on a leg switches to. */
export const nextMode = (m: LegMode): LegMode => LEG_MODES[(LEG_MODES.indexOf(m) + 1) % LEG_MODES.length] ?? 'walk';

/** The colour of `date` — its index among the days of the stay holding it. */
export function dayColour(src: Pick<PlaceSources, 'stops'>, date: ISODate): string {
  const stop = currentStop(src.stops, date);
  if (!stop) return DAY_COLOURS[0];
  const ms = Date.parse(`${date}T00:00:00Z`) - Date.parse(`${stop.start}T00:00:00Z`);
  const i = Math.max(0, Math.round(ms / 86_400_000));
  return DAY_COLOURS[i % DAY_COLOURS.length] ?? DAY_COLOURS[0];
}

/** The day's places as a route; null when the plan names no place with a pin. */
export function dayRoute(
  src: PlaceSources,
  date: ISODate,
  places: MapPlace[] = mapPlaces(src),
  modes: Readonly<Record<string, LegMode>> = {},
): DayRoute | null {
  const day = resolveDay(date, src.dayPlans ?? [], src.dayDefaults ?? [], src.stops);
  const ids = day?.placeIds ?? [];
  const stops: RouteStop[] = [];
  const unplaced: MapPlace[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const place = placeById(places, id);
    if (!place || seen.has(place.id)) continue;
    seen.add(place.id);
    if (place.pos) stops.push({ n: stops.length + 1, id: place.id, place, pos: place.pos });
    else unplaced.push(place);
  }
  if (!stops.length) return null;

  const legs: Leg[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    legs.push(legBetween(a.id, a.pos, b.id, b.pos, modes));
  }
  const bed = places.find((p) => isTonight(p, date) && !!p.pos) ?? null;
  const last = stops[stops.length - 1]!;
  const toBed = bed?.pos && bed.id !== last.id ? legBetween(last.id, last.pos, bed.id, bed.pos, modes) : null;
  const all = (toBed ? [...legs, toBed] : legs).filter((l) => !l.far);
  return {
    date,
    colour: dayColour(src, date),
    stops,
    unplaced,
    legs,
    bed,
    toBed,
    metres: all.reduce((a, l) => a + l.metres, 0),
    minutes: all.reduce((a, l) => a + l.minutes, 0),
  };
}

/** Every day of the stay holding `date` that has a route — the map's "All days". */
export function stayRoutes(
  src: PlaceSources,
  date: ISODate,
  places: MapPlace[] = mapPlaces(src),
  modes: Readonly<Record<string, LegMode>> = {},
): DayRoute[] {
  const stop = currentStop(src.stops, date);
  if (!stop) return [];
  const out: DayRoute[] = [];
  for (let d = stop.start; compareIso(d, stop.end) < 0; d = addDay(d)) {
    const r = dayRoute(src, d, places, modes);
    if (r) out.push(r);
  }
  return out;
}

function addDay(d: ISODate): ISODate {
  return new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10) as ISODate;
}

/** "≈ 15 min" / "≈ 1 h 20" */
export function minutesText(m: number): string {
  if (m < 60) return `≈ ${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `≈ ${h} h${r ? ` ${r}` : ''}`;
}

/** "650 m" / "2.9 km" — rounded the way an estimate should be. */
export function metresText(m: number): string {
  const m50 = Math.max(50, Math.round(m / 50) * 50);
  if (m50 < 1000) return `${m50} m`;
  return m >= 100_000 ? `${Math.round(m / 1000)} km` : `${(m / 1000).toFixed(1)} km`;
}
