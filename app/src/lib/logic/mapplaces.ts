/* THE MAP TAB'S PLACES, AS DATA (Map 5c) — everything in a trip the Map tab
   can show, where it is drawn, what it is called, what its buttons open.

   WHAT IS A PLACE. A spot, a driver card (place kind, not pending), a bed and a
   ticket: the four things a traveller goes TO. Flights, trains and road legs
   are movements, not places (MAP-DATA.md) — they get no pin, even the flights
   that carry their departure airport's coordinate: the airport itself is a
   driver card, and that card is the pin.

   WHERE IT IS DRAWN: `coord ?? pin` (types.ts, the block under Coord). `pin`
   is only ever DRAWN — the map buttons below are built from the entity's own
   map fields, and a coordinate joins them only when it is the entity's
   `coord`. So a bed that gained a pin in Map 5a still opens exactly what it
   opened before (its address, its name, or nothing), and a spot still opens
   by its NAME. A place with no position is never guessed onto the map: it is
   listed ("Opens by name — no pin yet") when a button can open it, and left
   out when nothing can.

   ONE PIN PER SPOT ON THE GROUND. A ticket borrows the pin of the place it is
   for (Map 5a, tickets.ts), and a driver card and a ticket can share a
   coordinate (the Tianmen cableway): several entities at the very same point
   are one place, named by the first of spot · card · ticket · bed, with the
   others riding along in `with` (the sheet names them; a link to any of them
   lands on this pin).

   WHAT IT IS CALLED. A spot by its name; a driver card by its own English
   words before the trip file's " — " aside (the Chinese is its `native`); a
   bed or a ticket by its title, its Chinese split out when the title carries
   both scripts. The one line under it is the trip's own `detail`, verbatim —
   never composed. Its category is the trip's `category`, else the entity's
   own kind (trips built in the app carry no categories).

   Pure: trip data in, places out. Nothing here fetches anything. */
import type { Booking, Coord, DayDefault, DayPlan, ISODate, PlaceCategory, ShowCard, Spot, Stop } from '../model/types';
import type { MapTarget } from './geo';
import { nearestStop } from './citymap';
import { currentStop, resolveDay } from './day';
import { mdliteToText } from './mdlite';
import { shortPlaceName } from './places';
import { splitWarning } from './pass';
import { compareIso } from './dates';
import { placePos, posKey } from './mapdrawn';

/** The eight categories, in the order every list of them is drawn (map4-filters). */
export const CATEGORIES: readonly PlaceCategory[] = ['food', 'spa', 'sight', 'show', 'shopping', 'hotel', 'transport', 'medical'];

export type PlaceKind = 'spot' | 'card' | 'bed' | 'ticket';

export interface PlaceMember {
  id: string;
  kind: PlaceKind;
  name: string;
  booking?: Booking;
}

export interface MapPlace {
  /** the entity's own id — the Map tab's address names a place by it */
  id: string;
  kind: PlaceKind;
  category: PlaceCategory;
  /** English, the way the app names it elsewhere */
  name: string;
  /** the short name beside its pin */
  label: string;
  /** the Chinese a driver reads */
  native?: string;
  /** the trip's own one line about it, verbatim (Map 5a) */
  detail?: string;
  /** where the Map tab draws it — coord ?? pin; absent: no pin yet */
  pos?: Coord;
  /** the stop (the city) it belongs to */
  stopId?: string;
  /** what its map buttons open: the entity's OWN map fields, never its pin */
  target: MapTarget;
  /** the white card to hold up for a driver: the card itself, or the place's
      own verified Chinese on the same white screen */
  driver?: ShowCard;
  /** a bed's or a ticket's booking */
  booking?: Booking;
  /** a spot's own record (its guide line, its option) */
  spot?: Spot;
  /** other entities at this very point (a ticket at its spot) */
  with: PlaceMember[];
}

export interface PlaceSources {
  tripId: string;
  stops: Stop[];
  showCards: ShowCard[];
  bookings: Booking[];
  dayPlans?: DayPlan[];
  dayDefaults?: DayDefault[];
}

const okCoord = (c: Coord | undefined): c is Coord =>
  !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng) && Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180;
const has = (s: string | undefined): s is string => !!s && !!s.trim();
const CJK = /[㐀-鿿豈-﫿]/;
const CJK_RUN = /[㐀-鿿豈-﫿][㐀-鿿豈-﫿　-〿＀-￯\d\s·()（）]*[㐀-鿿豈-﫿)）]/;

/** The category the trip gave the place, else its own kind's. */
export function categoryOf(e: { category?: PlaceCategory }, fallback: PlaceCategory): PlaceCategory {
  return e.category && (CATEGORIES as readonly string[]).includes(e.category) ? e.category : fallback;
}
const SPOT_KIND: Record<Spot['kind'], PlaceCategory> = { sight: 'sight', food: 'food', show: 'show', transport: 'transport', other: 'sight' };

/* Where a place is DRAWN (coord ?? pin) lives in ./mapdrawn, with the
   doorways' set — small, because the screens that start the app read it. */
export { drawnIds, placePos } from './mapdrawn';

/** A map button's target from an entity's own fields — a coordinate only
    when it is the entity's `coord`, never the drawn-only `pin`. */
function targetOf(e: {
  coord?: Coord;
  mapQuery?: string;
  mapCity?: string;
  mapUrl?: string;
  address?: string;
  addressInSearch?: boolean;
}): MapTarget {
  return {
    ...(has(e.mapUrl) ? { url: e.mapUrl } : {}),
    ...(has(e.mapQuery) ? { query: e.mapQuery } : {}),
    ...(has(e.address) ? { address: e.address } : {}),
    ...(e.addressInSearch ? { addressInSearch: true } : {}),
    ...(has(e.mapCity) ? { city: e.mapCity } : {}),
    ...(okCoord(e.coord) ? { coord: e.coord } : {}),
  };
}

/** True when a button can open the place: a link, a name, an address or a coordinate. */
export const openable = (t: MapTarget): boolean => !!(t.url || t.query || t.address || t.coord);

/** The words before the trip file's own aside: " — " first, then ", ". */
function head(s: string): string {
  return (s.split(' — ')[0] ?? s).trim();
}

/** A title that carries both scripts — "Dali Yanyuan Mountain Retreat 大理晏清山居客栈" —
    split into its English and its Chinese, word for word. */
export function splitScripts(title: string): { name: string; native?: string } {
  const m = CJK_RUN.exec(title);
  if (!m) return { name: title.trim() };
  const latin = (title.slice(0, m.index) + title.slice(m.index + m[0].length)).replace(/\s{2,}/g, ' ').replace(/[\s·,—-]+$/, '').trim();
  if (!/[A-Za-z]/.test(latin)) return { name: title.trim(), native: m[0].trim() };
  return { name: latin, native: m[0].trim() };
}

/** The short name beside a pin: the words before the trip's own " · "
    qualifier and before a ", " ("Siji Minfu · Peking duck" → "Siji Minfu"). */
export function pinLabel(name: string): string {
  let s = head(name);
  s = (s.split(' · ')[0] ?? s).trim();
  const comma = s.indexOf(', ');
  if (comma > 2) s = s.slice(0, comma);
  return s.trim() || name.trim();
}

/** A driver card's English name: its own meaning, the warning left out, before
    its aside ("Beijing Massage Hospital — blind massage…" → "Beijing Massage Hospital"). */
export function cardName(c: ShowCard): string {
  return shortPlaceName(head(mdliteToText(splitWarning(c.meaning).main)));
}

/** The white card for a spot or a booking that carries its own verified
    Chinese — the same screen a driver card is, built from the place's own
    fields and nothing else. */
function whiteCard(
  tripId: string,
  id: string,
  native: string,
  meaning: string,
  e: { coord?: Coord; mapQuery?: string; mapCity?: string; mapUrl?: string; address?: string; addressInSearch?: boolean; addressEn?: string },
  verify: boolean,
): ShowCard {
  return {
    id,
    tripId,
    kind: 'place',
    native,
    meaning,
    ...(okCoord(e.coord) ? { coord: e.coord } : {}),
    ...(has(e.mapQuery) ? { mapQuery: e.mapQuery } : {}),
    ...(has(e.mapCity) ? { mapCity: e.mapCity } : {}),
    ...(has(e.mapUrl) ? { mapUrl: e.mapUrl } : {}),
    ...(has(e.address) ? { address: e.address } : {}),
    ...(e.addressInSearch ? { addressInSearch: true } : {}),
    ...(has(e.addressEn) ? { addressEn: e.addressEn } : {}),
    verify,
    pending: false,
    isKey: false,
    order: 0,
  };
}

const KIND_RANK: Record<PlaceKind, number> = { spot: 0, card: 1, ticket: 2, bed: 3 };

/** The stop a date falls in, for a place with no position. */
function stopOnDate(stops: Stop[], date: ISODate | undefined): string | undefined {
  return date ? currentStop(stops, date)?.id : undefined;
}

/**
 * Every place of a trip, merged by position, in a stable order: the stops'
 * order, then each stop's spots as the file lists them, then the cards, the
 * tickets and the beds.
 */
export function mapPlaces(src: PlaceSources): MapPlace[] {
  const { tripId, stops, showCards, bookings } = src;
  const raw: MapPlace[] = [];

  /* the days that name a card with no position — the explicit join */
  const dayOfCard = new Map<string, ISODate>();
  for (const d of [...(src.dayPlans ?? [])].sort((a, b) => compareIso(a.date, b.date))) {
    for (const id of d.placeIds ?? []) if (!dayOfCard.has(id)) dayOfCard.set(id, d.date);
  }
  const byStop = (pos: Coord | undefined): string | undefined => (pos ? nearestStop(pos, stops)?.id : undefined);

  const ordered = [...stops].sort((a, b) => compareIso(a.start, b.start) || a.order - b.order);
  for (const s of ordered) {
    for (const sp of s.spots ?? []) {
      const pos = placePos(sp);
      raw.push({
        id: sp.id,
        kind: 'spot',
        category: categoryOf(sp, SPOT_KIND[sp.kind] ?? 'sight'),
        name: sp.name,
        label: pinLabel(sp.name),
        ...(has(sp.native) ? { native: sp.native } : {}),
        ...(has(sp.detail) ? { detail: sp.detail } : {}),
        ...(pos ? { pos } : {}),
        stopId: s.id,
        target: targetOf(sp),
        ...(has(sp.native) ? { driver: whiteCard(tripId, sp.id, sp.native, sp.name, sp, sp.verify === true) } : {}),
        spot: sp,
        with: [],
      });
    }
  }
  for (const c of [...showCards].sort((a, b) => a.order - b.order)) {
    if (c.kind !== 'place' || c.pending) continue;
    const pos = placePos(c);
    const stopId = byStop(pos) ?? stopOnDate(stops, dayOfCard.get(c.id));
    /* "Houhai, Beijing" in Beijing is Houhai: the card's own city, said again, goes */
    const city = stopId ? head(stops.find((s) => s.id === stopId)?.name ?? '') : '';
    const full = cardName(c);
    const name = city && full.endsWith(`, ${city}`) ? full.slice(0, -(city.length + 2)).trim() : full;
    raw.push({
      id: c.id,
      kind: 'card',
      category: categoryOf(c, 'sight'),
      name,
      label: pinLabel(name),
      native: c.native,
      ...(has(c.detail) ? { detail: c.detail } : {}),
      ...(pos ? { pos } : {}),
      ...(stopId ? { stopId } : {}),
      target: targetOf(c),
      driver: c,
      with: [],
    });
  }
  const live = bookings.filter((b) => b.status !== 'cancelled' && !b.alternative);
  for (const kind of ['activity', 'hotel'] as const) {
    for (const b of live.filter((x) => x.kind === kind).sort((x, y) => compareIso(x.date, y.date))) {
      const pos = placePos(b);
      const title = mdliteToText(b.title);
      const split = splitScripts(title);
      const cjkQuery = has(b.mapQuery) && CJK.test(b.mapQuery) ? b.mapQuery.trim() : undefined;
      const native = split.native ?? cjkQuery;
      const stopId =
        byStop(pos) ?? b.stopId ?? (b.kind === 'hotel' ? stopOnDate(stops, b.checkIn) : stopOnDate(stops, b.date));
      raw.push({
        id: b.id,
        kind: kind === 'hotel' ? 'bed' : 'ticket',
        category: categoryOf(b, kind === 'hotel' ? 'hotel' : 'sight'),
        name: split.name,
        label: pinLabel(split.name),
        ...(native ? { native } : {}),
        ...(has(b.detail) ? { detail: b.detail } : {}),
        ...(pos ? { pos } : {}),
        ...(stopId ? { stopId } : {}),
        target: targetOf(b),
        ...(native ? { driver: whiteCard(tripId, b.id, native, split.name, b, false) } : {}),
        booking: b,
        with: [],
      });
    }
  }

  /* one place per point on the ground — and a place with neither a position
     nor a button is not on any map: it is named where the trip names it (the
     guide, the Pocket), and the Map tab has nothing true to add */
  const out: MapPlace[] = [];
  const at = new Map<string, MapPlace>();
  for (const p of raw) {
    if (!p.pos) {
      if (openable(p.target)) out.push(p);
      continue;
    }
    const k = posKey(p.pos);
    const first = at.get(k);
    if (!first) {
      at.set(k, p);
      out.push(p);
      continue;
    }
    const lead = KIND_RANK[p.kind] < KIND_RANK[first.kind] ? p : first;
    const other = lead === p ? first : p;
    const merged: MapPlace = {
      ...lead,
      detail: lead.detail ?? other.detail,
      native: lead.native ?? other.native,
      driver: lead.driver ?? other.driver,
      booking: lead.booking ?? other.booking,
      with: [...lead.with, { id: other.id, kind: other.kind, name: other.name, ...(other.booking ? { booking: other.booking } : {}) }, ...other.with],
    };
    if (!merged.detail) delete merged.detail;
    if (!merged.native) delete merged.native;
    if (!merged.driver) delete merged.driver;
    if (!merged.booking) delete merged.booking;
    at.set(k, merged);
    out[out.indexOf(first)] = merged;
  }
  return out;
}

/** The place an id names — its own, or one it rides along with. */
export function placeById(places: MapPlace[], id: string | undefined): MapPlace | undefined {
  if (!id) return undefined;
  return places.find((p) => p.id === id) ?? places.find((p) => p.with.some((m) => m.id === id));
}

/** Drawn on the map: a place with a position. */
export const pinned = (p: MapPlace): boolean => !!p.pos;

/* ---------- today, tonight ---------- */

/** The ids today's plan names (DayPlan.placeIds, else the default day's). */
export function todayIds(src: PlaceSources, date: ISODate): Set<string> {
  const day = resolveDay(date, src.dayPlans ?? [], src.dayDefaults ?? [], src.stops);
  return new Set(day?.placeIds ?? []);
}

/** Is this place in today's plan — itself, or an entity riding with it? */
export function isToday(p: MapPlace, ids: Set<string>): boolean {
  return ids.has(p.id) || p.with.some((m) => ids.has(m.id));
}

/** Tonight's bed: the stay whose nights hold `date`. */
export function isTonight(p: MapPlace, date: ISODate): boolean {
  const b = p.booking;
  return !!b && b.kind === 'hotel' && compareIso(date, b.checkIn) >= 0 && compareIso(date, b.checkOut) < 0;
}

/** The first clause of today's own title — "Spa day — legs fresh for skiing" → "Spa day". */
export function dayTitleShort(src: PlaceSources, date: ISODate): string | null {
  const day = resolveDay(date, src.dayPlans ?? [], src.dayDefaults ?? [], src.stops);
  if (!day?.title) return null;
  return head(mdliteToText(day.title)).replace(/[.:;,]+$/, '').trim() || null;
}

/* ---------- which places, counted ---------- */

export interface ShowFilter {
  /** categories switched off in the filters sheet */
  off: ReadonlySet<PlaceCategory>;
  /** hotels: 'beds' — only your own beds; 'all' — every hotel the trip names */
  hotels: 'beds' | 'all';
}

/** Does the filter let this place onto the map? */
export function shown(p: MapPlace, f: ShowFilter): boolean {
  if (f.off.has(p.category)) return false;
  if (p.category === 'hotel' && f.hotels === 'beds') return p.kind === 'bed' || p.with.some((m) => m.kind === 'bed');
  return true;
}

export type CategoryCounts = Record<PlaceCategory, number>;
const zero = (): CategoryCounts => ({ food: 0, spa: 0, sight: 0, show: 0, shopping: 0, hotel: 0, transport: 0, medical: 0 });

/** How many places of each category — the chips' and the filters' numbers. */
export function categoryCounts(places: MapPlace[]): CategoryCounts & { all: number } {
  const c = zero();
  for (const p of places) c[p.category]++;
  return { ...c, all: places.length };
}

/** The places of one city (a stop), or of the whole trip. */
export function inStop(places: MapPlace[], stopId: string | null): MapPlace[] {
  return stopId ? places.filter((p) => p.stopId === stopId) : places;
}

/* ---------- search ---------- */

const fold = (s: string): string =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * "Find a place": every word typed must appear in the place's name, its
 * Chinese, its line or its category word. Case- and accent-insensitive;
 * Chinese matches as written. Places with a pin first, then by name order
 * as given.
 */
export function searchPlaces(places: MapPlace[], query: string, catWord: (c: PlaceCategory) => string): MapPlace[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hay = (p: MapPlace): string =>
    fold([p.name, p.native ?? '', p.detail ?? '', catWord(p.category), ...p.with.map((m) => m.name)].join(' '));
  const hits = places.filter((p) => {
    const h = hay(p);
    return words.every((w) => h.includes(w));
  });
  return [...hits.filter(pinned), ...hits.filter((p) => !pinned(p))];
}
