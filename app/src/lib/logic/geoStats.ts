/* Distance, derived — never guessed (§RULES 2).

   The only geographic number the trip data can honestly produce is the
   great-circle distance between the stops that actually carry a coordinate.
   It is a straight line between two points on a sphere, not a travelled
   route, and the Info tile says so. A stop without a coordinate is skipped
   rather than interpolated, and a trip with fewer than two of them gets no
   tile at all. */
import type { Coord, Stop } from '../model/types';
import { realStops } from './day';

const EARTH_KM = 6371.0088;
const rad = (d: number): number => (d * Math.PI) / 180;

/** Great-circle distance in kilometres between two WGS-84 points. */
export function haversineKm(a: Coord, b: Coord): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * The trip's stop-to-stop distance, in kilometres, rounded to whole km.
 * Returns null when fewer than two stops carry a coordinate — the honest
 * answer is "not known", which the caller renders as no tile.
 */
export function routeDistanceKm(stops: Stop[]): number | null {
  const pts = realStops(stops)
    .filter((s) => s.coord)
    .map((s) => s.coord as Coord);
  if (pts.length < 2) return null;
  let km = 0;
  for (let i = 1; i < pts.length; i++) {
    const from = pts[i - 1];
    const to = pts[i];
    if (from && to) km += haversineKm(from, to);
  }
  return Math.round(km);
}

/** "12,540 km" — grouped, never rounded into a lie. */
export function fmtKm(km: number): string {
  return `${km.toLocaleString('en-US')} km`;
}
