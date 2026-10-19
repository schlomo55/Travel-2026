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

   A STOP THE PLAN CALLS OPTIONAL is still a stop (numbered, drawn) but marked
   `optional`, and the legs into and out of it with it: they stay out of the
   totals, which are the day without it (the leg that skips it is counted
   instead), and `optionalMinutes` says what doing it would add.

   Pure: trip data in, a route out. */
import type { Coord, ISODate } from '../model/types';
import { haversineKm } from './geoStats';
import { currentStop, resolveDay } from './day';
import { compareIso } from './dates';
import { mdliteToText } from './mdlite';
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
/** km/h on the move, plus fixed minutes (hailing, stations). A taxi's `kmh` is
    its city-street speed — what a short hop runs at; see taxiKmh. */
export const SPEED: Record<LegMode, { kmh: number; extra: number }> = {
  walk: { kmh: 4.5, extra: 0 },
  taxi: { kmh: 18, extra: 5 },
  metro: { kmh: 28, extra: 9 },
};

/* A TAXI'S SPEED FOLLOWS THE DISTANCE. A short hop crawls through city streets;
   a long one is mostly ring road and expressway — Beijing Capital T3 to Sanlitun,
   25.7 km, is about 45 minutes in a car, not the hour and a half 18 km/h made of
   it, and Daxing to the centre of Beijing, 58 km, about an hour. The speed is
   read off these points (km DRIVEN → km/h) and joined by straight lines — a
   step per band made a leg just over an edge read shorter than one just under
   it — so a longer ride always takes longer, and the figure is still one the
   traveller can check against a clock. */
const TAXI_KMH: readonly (readonly [km: number, kmh: number])[] = [
  [5, SPEED.taxi.kmh], // across a neighbourhood: city streets
  [10, 25], // across town
  [25, 35], // out to the ring road
  [60, 60], // an expressway transfer: an airport, a far station
];
export function taxiKmh(km: number): number {
  const [d0, v0] = TAXI_KMH[0]!;
  if (km <= d0) return v0;
  for (let i = 1; i < TAXI_KMH.length; i++) {
    const [a, va] = TAXI_KMH[i - 1]!;
    const [b, vb] = TAXI_KMH[i]!;
    if (km <= b) return va + ((km - a) / (b - a)) * (vb - va);
  }
  return TAXI_KMH[TAXI_KMH.length - 1]![1];
}

/** minutes a ride of `metres` takes in `mode`, the fixed minutes (hailing,
    stations) included — never fewer than 2 */
const rideMinutes = (mode: LegMode, metres: number): number => {
  const kmh = mode === 'taxi' ? taxiKmh(metres / 1000) : SPEED[mode].kmh;
  return Math.max(2, Math.round((metres / 1000 / kmh) * 60 + SPEED[mode].extra));
};

/** past this straight line (metres) a road transfer is not estimated at all */
export const RIDE_MAX_METRES = 120_000;

/** A KNOWN ROAD TRANSFER — a hotel to its airport or station, a ride the
    traveller has to make whatever the distance. Unlike a day's leg it is never
    "far" (FAR_METRES is where a day's walk, taxi or metro stops being the
    answer and a booked train or flight takes over); it is the same estimate,
    the straight line × DETOUR at the distance-based speed. null beyond
    RIDE_MAX_METRES straight: that is a journey, not a transfer. */
export function rideEstimate(from: Coord, to: Coord, mode: LegMode = 'taxi'): { metres: number; minutes: number } | null {
  const straight = haversineKm(from, to) * 1000;
  if (straight > RIDE_MAX_METRES) return null;
  const metres = straight * DETOUR;
  return { metres, minutes: rideMinutes(mode, metres) };
}

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
  /** the day's own plan line calls it optional (optionalIds): kept out of the totals */
  optional?: boolean;
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
  /** into or out of an optional stop: left out of the totals */
  optional?: boolean;
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
  /** the day WITHOUT its optional stops (all of it when none is optional) */
  metres: number;
  minutes: number;
  /** what doing the optional stops adds on top of that */
  optionalMetres: number;
  optionalMinutes: number;
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
  const far = straight > FAR_METRES;
  const minutes = far ? 0 : rideMinutes(mode, metres);
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

/* WHICH PLACES THE DAY'S OWN PLAN CALLS OPTIONAL.

   The app joins a day to its places by `placeIds` and nothing else, and that
   join says nothing about "if the legs still complain" — the plan's sentence
   does: "*Optional:* Ronghui Hot Springs soak, if the legs are still
   complaining". The trip file the owner imported has no field for it, so on the
   phone today the sentence is all there is, and reading it is the only way the
   route can stop counting a soak as a fixed stop. That is the one place the
   app reads prose for a fact, so it reads it narrowly:
     · the LINE must BEGIN with the word (after md-lite: "Optional:",
       "Optional evening", "Optional, not the plan") — "everything optional
       except the train" and "…is optional/unanswered" do not begin with it;
     · the place's own name — or its short label, its Chinese, a ticket's
       title — must stand in that line as a whole word or phrase;
     · and no other line of the plan may name it: a place the plan also
       names plainly is a plan.
   No match, no change: a place is optional only when it is sure. */
const OPTIONAL_LINE = /^optional\b/i;
const CJK = /[㐀-鿿]/;
const fold = (s: string): string =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function optionalIds(planItems: readonly string[], places: readonly MapPlace[]): Set<string> {
  const lines = planItems.map((raw) => {
    const text = mdliteToText(raw).trim();
    return { text: fold(text), optional: OPTIONAL_LINE.test(text) };
  });
  const out = new Set<string>();
  if (!lines.some((l) => l.optional)) return out;
  for (const p of places) {
    const names = [p.name, p.label, p.native, ...p.with.map((m) => m.name)]
      .map((n) => fold((n ?? '').trim()))
      .filter((n) => n.length >= (CJK.test(n) ? 2 : 3))
      .map((n) => new RegExp(`(?<![a-z0-9])${esc(n)}(?![a-z0-9])`, 'u'));
    const hits = lines.filter((l) => names.some((re) => re.test(l.text)));
    if (hits.length && hits.every((l) => l.optional)) out.add(p.id);
  }
  return out;
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
  const named: MapPlace[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const place = placeById(places, id);
    if (!place || seen.has(place.id)) continue;
    seen.add(place.id);
    named.push(place);
  }
  const opt = optionalIds(day?.planItems ?? [], named);
  const stops: RouteStop[] = [];
  const unplaced: MapPlace[] = [];
  for (const place of named) {
    if (place.pos) stops.push({ n: stops.length + 1, id: place.id, place, pos: place.pos, ...(opt.has(place.id) ? { optional: true } : {}) });
    else unplaced.push(place);
  }
  if (!stops.length) return null;

  const legs: Leg[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    const leg = legBetween(a.id, a.pos, b.id, b.pos, modes);
    legs.push(a.optional || b.optional ? { ...leg, optional: true } : leg);
  }
  const bed = places.find((p) => isTonight(p, date) && !!p.pos) ?? null;
  const last = stops[stops.length - 1]!;
  const bedLeg = bed?.pos && bed.id !== last.id ? legBetween(last.id, last.pos, bed.id, bed.pos, modes) : null;
  const toBed = bedLeg && last.optional ? { ...bedLeg, optional: true } : bedLeg;

  /* the day without its optional stops: every leg between two fixed ones, and
     where an optional stop lay between them the leg that skips it */
  const full = toBed ? [...legs, toBed] : legs;
  const nodes: { id: string; pos: Coord; optional?: boolean }[] = [...stops, ...(toBed && bed?.pos ? [{ id: bed.id, pos: bed.pos }] : [])];
  const path: Leg[] = [];
  let prev = -1;
  nodes.forEach((n, i) => {
    if (n.optional) return;
    const from = nodes[prev];
    if (from) path.push(prev === i - 1 ? full[prev]! : legBetween(from.id, from.pos, n.id, n.pos));
    prev = i;
  });
  const sum = (ls: Leg[], f: (l: Leg) => number): number => ls.filter((l) => !l.far).reduce((a, l) => a + f(l), 0);
  const metres = sum(path, (l) => l.metres);
  const minutes = sum(path, (l) => l.minutes);
  return {
    date,
    colour: dayColour(src, date),
    stops,
    unplaced,
    legs,
    bed,
    toBed,
    metres,
    minutes,
    optionalMetres: Math.max(0, sum(full, (l) => l.metres) - metres),
    optionalMinutes: Math.max(0, sum(full, (l) => l.minutes) - minutes),
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
