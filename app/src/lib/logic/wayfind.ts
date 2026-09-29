/* FINDING THE WAY, OFFLINE (Map 5c) — the numbers and words the Map tab says
   about where a place is from you: straight-line distance, bearing, the
   16-point compass, "slightly left", how rough your position is, the scale
   bar, a cluster's badge and its spoken label, and the compass heading the
   phone's sensors give.

   EVERY DISTANCE IS A STRAIGHT LINE and says so where it is shown ("straight
   line — follow streets on the map"): a great-circle metre between two
   verified points is a fact; a walking time would be a guess about a street
   nobody measured, so none is ever given.

   A ROUGH POSITION SAYS SO. Android's "approximate location" grant answers
   within a few kilometres; a distance smaller than a few times that
   uncertainty means nothing, so it is not shown — the position's own
   accuracy is ("≈ 900 m"), once, beside YOU.

   Pure: numbers in, numbers and words out. */
import type { Coord, PlaceCategory } from '../model/types';
import { haversineKm } from './geoStats';
import { bearing } from './citymap';
import { S } from '../i18n/strings';

/* ---------- distance and bearing ---------- */

/** Straight-line metres between two WGS-84 points. */
export const distanceM = (a: Coord, b: Coord): number => haversineKm(a, b) * 1000;

/** Degrees clockwise from true north, from a to b (one decimal). */
export const bearingDeg = (a: Coord, b: Coord): number => bearing(a, b);

/** Any angle into [0, 360). */
export const norm360 = (d: number): number => ((d % 360) + 360) % 360;

/** Any angle difference into (-180, 180]. */
export function signedDelta(to: number, from: number): number {
  const d = norm360(to - from);
  return d > 180 ? d - 360 : d;
}

const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'] as const;
export type Compass16 = (typeof POINTS)[number];

/** The 16-point compass for a bearing: 255° → "WSW". */
export function compass16(deg: number): Compass16 {
  return POINTS[Math.round(norm360(deg) / 22.5) % 16] ?? 'N';
}

/** The same, spoken: "WSW" → "west-south-west". */
export function compassWords(p: Compass16): string {
  const w: Record<string, string> = { N: 'north', E: 'east', S: 'south', W: 'west' };
  return p
    .split('')
    .map((c) => w[c] ?? c)
    .join('-');
}

/** "≈ 450 m", "≈ 1.9 km", "≈ 47.7 km", "≈ 310 km" — never more digits than
    a straight line between two points has earned. */
export function distanceText(m: number): string {
  if (!Number.isFinite(m) || m < 0) return '';
  if (m < 1000) return `≈ ${Math.max(10, Math.round(m / 10) * 10)} m`;
  const km = m / 1000;
  return km < 100 ? `≈ ${(Math.round(km * 10) / 10).toFixed(1)} km` : `≈ ${Math.round(km)} km`;
}

/** The distance for a screen reader: "1.9 kilometres", "450 metres". */
export function distanceSpoken(m: number): string {
  const t = distanceText(m).replace('≈ ', '');
  return t.endsWith(' km') ? `${t.slice(0, -3)} kilometres` : `${t.slice(0, -2)} metres`;
}

/* ---------- how rough your position is ---------- */

/** A fix this good needs no word about its accuracy. */
export const FINE_M = 100;
/** A distance counts only beyond this many times the position's uncertainty. */
export const MEANINGFUL_X = 3;

/** "≈ 900 m" — only for a rough position (worse than FINE_M); null for a good fix. */
export function accuracyText(accuracyM: number | null | undefined): string | null {
  if (accuracyM == null || !Number.isFinite(accuracyM) || accuracyM <= FINE_M) return null;
  if (accuracyM < 1000) return `≈ ${Math.round(accuracyM / 50) * 50 || 50} m`;
  const km = accuracyM / 1000;
  return `≈ ${km < 10 ? (Math.round(km * 2) / 2).toString() : Math.round(km)} km`;
}

/** Is a distance worth showing from a position this rough? */
export function meaningful(distance: number, accuracyM: number | null | undefined): boolean {
  if (accuracyM == null || !Number.isFinite(accuracyM) || accuracyM <= FINE_M) return true;
  return distance >= MEANINGFUL_X * accuracyM;
}

/* ---------- which way to turn ---------- */

export type Turn = 'ahead' | 'slightLeft' | 'slightRight' | 'left' | 'right' | 'behind';

/** Where the target lies from the way you face: within 10° it is ahead;
    to 45° slightly left or right; to 135° left or right; past that, behind. */
export function turnOf(targetBearing: number, heading: number): Turn {
  const d = signedDelta(targetBearing, heading);
  const a = Math.abs(d);
  if (a <= 10) return 'ahead';
  if (a <= 45) return d < 0 ? 'slightLeft' : 'slightRight';
  if (a <= 135) return d < 0 ? 'left' : 'right';
  return 'behind';
}

/**
 * THE COMPASS HEADING the phone's orientation gives — the direction the top
 * of the phone points, held in portrait, flat or upright (the W3C
 * DeviceOrientation spec's own worked example, tilt-compensated). `alpha`
 * from `deviceorientationabsolute` is measured from MAGNETIC north on
 * Android; add the declination for TRUE north. Null when the event carries
 * no angles.
 */
export function headingFromOrientation(alpha: number | null, beta: number | null, gamma: number | null): number | null {
  if (alpha == null || !Number.isFinite(alpha)) return null;
  const r = Math.PI / 180;
  const x = (beta ?? 0) * r;
  const y = (gamma ?? 0) * r;
  const z = alpha * r;
  const cY = Math.cos(y);
  const cZ = Math.cos(z);
  const sX = Math.sin(x);
  const sY = Math.sin(y);
  const sZ = Math.sin(z);
  const vx = -cZ * sY - sZ * sX * cY;
  const vy = -sZ * sY + cZ * sX * cY;
  /* the phone lying flat: the screen's top edge is the pointer */
  if (Math.abs(vx) < 1e-9 && Math.abs(vy) < 1e-9) return norm360(360 - alpha);
  let h = Math.atan(vx / vy);
  if (vy < 0) h += Math.PI;
  else if (vx < 0) h += 2 * Math.PI;
  return norm360(h / r);
}

/** Walking speed above which the GPS course is the better heading. */
export const COURSE_MIN_MPS = 0.8;

/**
 * The heading to steer by: the GPS course while you walk (the magnetometer is
 * easily pulled by steel and cars), else the compass corrected to true north,
 * else nothing.
 */
export function steerHeading(opts: {
  compassMagnetic: number | null;
  declination: number;
  course: number | null;
  speed: number | null;
}): { deg: number; from: 'course' | 'compass' } | null {
  const { compassMagnetic, declination, course, speed } = opts;
  if (course != null && Number.isFinite(course) && speed != null && speed >= COURSE_MIN_MPS) return { deg: norm360(course), from: 'course' };
  if (compassMagnetic != null && Number.isFinite(compassMagnetic)) return { deg: norm360(compassMagnetic + declination), from: 'compass' };
  return null;
}

/* ---------- the scale bar ---------- */

const NICE = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000];

/** The longest round length that fits in `maxPx` at this scale. */
export function scaleBar(metresPerPx: number, maxPx: number): { px: number; label: string } | null {
  if (!(metresPerPx > 0) || !(maxPx > 0)) return null;
  const fit = NICE.filter((m) => m / metresPerPx <= maxPx);
  const m = fit[fit.length - 1];
  if (!m) return null;
  return { px: Math.round((m / metresPerPx) * 10) / 10, label: m >= 1000 ? `${m / 1000} km` : `${m} m` };
}

/** Metres per CSS pixel at a latitude and zoom (512-px tiles, as MapLibre draws). */
export function metresPerPx(lat: number, zoom: number): number {
  return (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
}

/** The camera that frames `points` ([lng, lat]) in a w × h box — the map's
    area between its panels — on maplibre's 512 px world: their middle, and
    the zoom (at most `maxZoom`) with `margin` px round them — one for both
    sides, or [left and right, top and bottom] — a margin that shrinks when a
    tall sheet leaves little room. Null when there is no room at all. (The
    engine's own fitBounds refuses outright when its margin and the panels do
    not fit, and frames in the padding the map has NOW — not the one a panel
    is about to give it.) */
export function fitView(
  points: [number, number][],
  w: number,
  h: number,
  maxZoom: number,
  margin: number | [number, number] = 56,
): { center: [number, number]; zoom: number } | null {
  if (!points.length || !(w > 24) || !(h > 24)) return null;
  const mx = (lng: number): number => (lng + 180) / 360;
  const my = (lat: number): number => {
    const s = Math.sin((lat * Math.PI) / 180);
    return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  };
  const xs = points.map((p) => mx(p[0]));
  const ys = points.map((p) => my(p[1]));
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const [mx0, my0] = typeof margin === 'number' ? [margin, margin] : margin;
  const ex = Math.max(0, Math.min(mx0, Math.floor((w - 24) / 2)));
  const ey = Math.max(0, Math.min(my0, Math.floor((h - 24) / 2)));
  const sx = (w - 2 * ex) / Math.max((x1 - x0) * 512, 1e-12);
  const sy = (h - 2 * ey) / Math.max((y1 - y0) * 512, 1e-12);
  const zoom = Math.min(maxZoom, Math.log2(Math.min(sx, sy)));
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (y0 + y1)))) * 180) / Math.PI;
  return { center: [((x0 + x1) / 2) * 360 - 180, lat], zoom };
}

/* ---------- clusters ---------- */

/** The badge on a cluster: "+4" — the places it holds. */
export function clusterBadge(count: number): string {
  return count > 99 ? '+99' : `+${Math.max(0, Math.round(count))}`;
}

/** The one category a cluster is all of, else null (a mixed cluster). */
export function clusterCategory(counts: Partial<Record<PlaceCategory, number>>): PlaceCategory | null {
  const cats = (Object.keys(counts) as PlaceCategory[]).filter((c) => (counts[c] ?? 0) > 0);
  return cats.length === 1 ? (cats[0] ?? null) : null;
}

/** A cluster, spoken: "4 sights" · "5 places: 3 sights, 2 places to eat". */
export function clusterSpoken(counts: Partial<Record<PlaceCategory, number>>): string {
  const cats = (Object.keys(counts) as PlaceCategory[]).filter((c) => (counts[c] ?? 0) > 0).sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0));
  const n = cats.reduce((t, c) => t + (counts[c] ?? 0), 0);
  const one = (c: PlaceCategory): string => {
    const k = counts[c] ?? 0;
    return `${k} ${k === 1 ? S.mapTab.catOne[c] : S.mapTab.catMany[c]}`;
  };
  const only = cats[0];
  if (cats.length === 1 && only) return one(only);
  return `${n} ${n === 1 ? 'place' : 'places'}: ${cats.map(one).join(', ')}`;
}

/* ---------- nearest first ---------- */

export interface Ranged<T> {
  item: T;
  /** straight-line metres from where it was measured */
  m: number;
  /** degrees from true north */
  deg: number;
}

/** Items with a position, nearest first from `from` (stable for ties). */
export function nearestFirst<T>(items: T[], pos: (t: T) => Coord | undefined, from: Coord): Ranged<T>[] {
  const out: Ranged<T>[] = [];
  for (const item of items) {
    const p = pos(item);
    if (!p) continue;
    out.push({ item, m: distanceM(from, p), deg: bearingDeg(from, p) });
  }
  return out.map((r, i) => ({ r, i })).sort((a, b) => a.r.m - b.r.m || a.i - b.i).map((x) => x.r);
}
