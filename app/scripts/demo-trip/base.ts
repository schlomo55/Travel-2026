/* Shared constants for the DEMO trip (seed/demo-2027.trip.json).

   THIS TRIP IS MADE UP. It is the repo's stand-in for a real, multi-stop,
   China-shaped journey: the cities and the public places in them are real
   geography (a map has to have something to draw), but every hotel, booking,
   reference, price, person, phone number and flight in it is invented. The
   hotels are "Sample …" businesses at made-up addresses; every booking code
   starts with DEMO; nobody is named.

   It exists so every test, gate and the offline rehearsal have one rich trip
   to exercise: a visa counter, bookings of every kind (flights, trains, road
   legs, beds, tickets), stays with native-script names and addresses,
   Simplified and Traditional show cards, day plans and runbooks, tasks and
   alarms, places with positions, metro and no-metro cities, a two-day hike,
   a Hong Kong + Macau leg, money in five currencies.

   Dexie primary keys are global, not per trip, so every id starts with
   `dm27-` — a demo trip imported next to a real one can never overwrite it. */
import type { Coord, ISODate } from '../../src/lib/model/types';

export const TRIP_ID = 'dm27';
export const P = 'dm27-';

/** Fixed build instant — no Date.now() anywhere, so rebuilds are byte-identical. */
export const SEED_TS = Date.UTC(2026, 10, 8); // 2026-11-08
export const SEED_DATE: ISODate = '2026-11-08';

export const TRIP_START: ISODate = '2027-03-19';
export const TRIP_END: ISODate = '2027-04-18'; // inclusive — 31 days

export const STOP_IDS = {
  flights: 'dm27-stop-flights',
  hangzhou: 'dm27-stop-hangzhou',
  shanghai: 'dm27-stop-shanghai',
  suzhou: 'dm27-stop-suzhou',
  huangshan: 'dm27-stop-huangshan',
  chengdu: 'dm27-stop-chengdu',
  yangshuo: 'dm27-stop-yangshuo',
  longji: 'dm27-stop-longji',
  guilin: 'dm27-stop-guilin',
  hongkong: 'dm27-stop-hongkong',
} as const;
export type StopKey = keyof typeof STOP_IDS;

export const stamp = { createdAt: SEED_TS, updatedAt: SEED_TS };

export const c = (lat: number, lng: number): Coord => ({ lat, lng });

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Every ISO date from `from` to `to`, inclusive — pure UTC string maths. */
export function dateRange(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const [fy, fm, fd] = from.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = to.split('-').map(Number) as [number, number, number];
  let t = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  while (t <= end) {
    const d = new Date(t);
    out.push(`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`);
    t += 86_400_000;
  }
  return out;
}
