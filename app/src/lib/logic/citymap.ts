/* THE CITY CLOSE-UP, AS DATA (mx-city, f-city) — one stop at city scale.

   Every pin is a coordinate the trip file stores: the stop's own centre, its
   spots, the driver cards and the bookings that carry one. Everything the
   city holds WITHOUT a coordinate — a park spot, a hotel whose address was
   never verified — goes in `noPin`, to be listed ("No pin yet"), never drawn
   at a guessed place. Run 3 draws it; this file only decides it.

   WHICH CITY A PLACE BELONGS TO
   · A spot belongs to the stop that carries it.
   · Anything WITH a coordinate belongs to the stop it is nearest to, within
     CITY_KM — the one rule that holds for an airport 29 km out of town and
     for a flight dated on the day you leave (its coordinate is where you
     board it, so it lands on the city you board it in).
   · Anything WITHOUT one belongs where the trip file puts it: a stay by its
     check-in date or its stop, an experience by its date, a driver card by
     the days that name it (DayPlan.placeIds — the explicit join).

   THE WAYS OUT. The legs in and out of the stop point at the previous and
   next stops, whose coordinates are real, so the arrow on the map's edge is
   a bearing and not a guess — Zhangjiajie West has no coordinate, and its
   train is drawn as an arrow towards Chongqing, which does. */
import type { Booking, Coord, DayDefault, DayPlan, ShowCard, Stop } from '../model/types';
import { compareIso } from './dates';
import { haversineKm } from './geoStats';
import { mdliteToText } from './mdlite';
import { fitProjection, type Box } from './projection';
import { shortName } from './constellation';

/** How far from a stop's centre a place may be and still be "in" it. */
export const CITY_KM = 80;

export type CityKind = 'stop' | 'spot' | 'card' | 'booking';
export interface CityPlace {
  id: string;
  name: string;
  kind: CityKind;
  coord?: Coord;
}
export interface CityPin {
  x: number;
  y: number;
  /** Everything stored at this exact coordinate (a card and a ticket for
      the same cableway are one pin). */
  places: CityPlace[];
  /** Straight-line km from the stop's centre — never a travel time. */
  km: number;
}
export interface CityExit {
  role: 'in' | 'out';
  stopId: string;
  name: string;
  /** Degrees clockwise from north, from this stop to that one. */
  bearing: number;
  /** Where the arrow meets the edge of the box. */
  x: number;
  y: number;
}
export interface CityMap {
  pins: CityPin[];
  noPin: CityPlace[];
  exits: CityExit[];
  /** Screen pixels per kilometre. */
  kmPx: number;
}

const ok = (c: Coord | undefined): c is Coord => !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng);
const inStay = (s: Stop, d: string): boolean => compareIso(d, s.start) >= 0 && compareIso(d, s.end) < 0;

/** The stop a coordinate belongs to: the nearest, within CITY_KM. */
export function nearestStop(c: Coord, stops: Stop[]): Stop | null {
  let best: Stop | null = null;
  let bestKm = Infinity;
  for (const s of stops) {
    if (s.kind !== 'stop' || !ok(s.coord)) continue;
    const km = haversineKm(c, s.coord);
    if (km < bestKm) {
      best = s;
      bestKm = km;
    }
  }
  return bestKm <= CITY_KM ? best : null;
}

function bookingName(b: Booking): string {
  return b.kind === 'flight' ? `${b.from.name ?? b.from.code} · ${b.flightNo}` : mdliteToText(b.title);
}

/** Everything that belongs to `stop`, located or not. */
export function cityPlaces(
  stop: Stop,
  all: { stops: Stop[]; showCards: ShowCard[]; bookings: Booking[]; dayPlans?: DayPlan[]; dayDefaults?: DayDefault[] },
): CityPlace[] {
  const mine = (c: Coord | undefined): boolean => ok(c) && nearestStop(c, all.stops)?.id === stop.id;
  const out: CityPlace[] = [];
  if (ok(stop.coord)) out.push({ id: stop.id, name: shortName(stop.name), kind: 'stop', coord: stop.coord });
  for (const sp of stop.spots ?? []) {
    out.push({ id: sp.id, name: sp.name, kind: 'spot', ...(ok(sp.coord) ? { coord: sp.coord } : {}) });
  }
  /* the cards the stop's own days name — the explicit join */
  const named = new Set<string>();
  for (const d of all.dayPlans ?? []) if (inStay(stop, d.date)) for (const id of d.placeIds ?? []) named.add(id);
  for (const d of all.dayDefaults ?? []) if (d.stopId === stop.id) for (const id of d.placeIds ?? []) named.add(id);
  for (const c of all.showCards) {
    if (c.kind !== 'place' || c.pending) continue;
    const place: CityPlace = { id: c.id, name: c.native, kind: 'card' };
    if (ok(c.coord)) {
      if (mine(c.coord)) out.push({ ...place, coord: c.coord });
    } else if (named.has(c.id)) out.push(place);
  }
  for (const b of all.bookings) {
    if (b.status === 'cancelled' || b.alternative) continue;
    const place: CityPlace = { id: b.id, name: bookingName(b), kind: 'booking' };
    if (ok(b.coord)) {
      if (mine(b.coord)) out.push({ ...place, coord: b.coord });
      continue;
    }
    /* unlocated: a bed or a ticket is a place in the city; a move is a way out */
    const here =
      b.stopId === stop.id ||
      (b.kind === 'hotel' && inStay(stop, b.checkIn)) ||
      (b.kind === 'activity' && inStay(stop, b.date));
    if (here && (b.kind === 'hotel' || b.kind === 'activity')) out.push(place);
  }
  return out;
}

/** Bearing in degrees clockwise from north, from a to b. */
export function bearing(a: Coord, b: Coord): number {
  const r = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * r) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lng - a.lng) * r);
  return Math.round(((Math.atan2(y, x) / r + 360) % 360) * 10) / 10;
}

/**
 * Lay a city out: every located place projected (a few km at least, so a
 * city with one pin is not blown up to fill the phone), the rest listed, and
 * an arrow to the stop before and the stop after.
 */
export function buildCityMap(stop: Stop, places: CityPlace[], stops: Stop[], box: Box, minSpanKm = 6): CityMap | null {
  const located = places.filter((p) => ok(p.coord));
  const proj = fitProjection(
    located.map((p) => p.coord!),
    box,
    minSpanKm,
  );
  if (!proj) return null;
  const byKey = new Map<string, CityPin>();
  for (const p of located) {
    const key = `${p.coord!.lat.toFixed(4)},${p.coord!.lng.toFixed(4)}`;
    const pin = byKey.get(key);
    if (pin) pin.places.push(p);
    else
      byKey.set(key, {
        x: proj.x(p.coord!),
        y: proj.y(p.coord!),
        places: [p],
        km: ok(stop.coord) ? Math.round(haversineKm(stop.coord, p.coord!) * 10) / 10 : 0,
      });
  }
  const real = stops.filter((s) => s.kind === 'stop').sort((a, b) => a.order - b.order);
  const i = real.findIndex((s) => s.id === stop.id);
  const exits: CityExit[] = [];
  const cx = box.width / 2;
  const cy = box.height / 2;
  for (const [role, other] of [
    ['in', real[i - 1]],
    ['out', real[i + 1]],
  ] as const) {
    if (!other || !ok(other.coord) || !ok(stop.coord)) continue;
    const deg = bearing(stop.coord, other.coord);
    const rad = (deg * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);
    /* from the centre of the box to its edge, along the bearing */
    const t = Math.min(
      dx ? (dx > 0 ? box.width - box.pad - cx : box.pad - cx) / dx : Infinity,
      dy ? (dy > 0 ? box.height - box.pad - cy : box.pad - cy) / dy : Infinity,
    );
    exits.push({
      role,
      stopId: other.id,
      name: shortName(other.name),
      bearing: deg,
      x: Math.round((cx + dx * t) * 10) / 10,
      y: Math.round((cy + dy * t) * 10) / 10,
    });
  }
  return { pins: [...byKey.values()], noPin: places.filter((p) => !ok(p.coord)), exits, kmPx: proj.kmPx };
}
