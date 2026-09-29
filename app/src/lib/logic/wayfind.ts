/* FINDING THE WAY, OFFLINE (Map 5c) — the numbers and words the Map tab says
   about where a place is from you: straight-line distance, bearing, the
   16-point compass, "slightly left", how rough your position is, the scale
   bar, a cluster's badge, and the compass heading the phone's sensors give.

   EVERY DISTANCE IS A STRAIGHT LINE and says so where it is shown ("straight
   line — follow streets on the map"): a great-circle metre between two
   verified points is a fact; a walking time would be a guess about a street
   nobody measured, so none is ever given.

   A ROUGH POSITION SAYS SO. Android's "approximate location" grant answers
   within a few kilometres; a distance smaller than a few times that
   uncertainty means nothing, so it is not shown — the position's own
   accuracy is ("≈ 900 m"), once, beside YOU.

   Pure: numbers in, numbers and words out. */
import type { Coord } from '../model/types';
import { haversineKm } from './geoStats';
import { bearing } from './citymap';
import { PHOTO_HALO, PHOTO_NAME_BELOW, PHOTO_RIM, PHOTO_TONIGHT } from './placephotos';

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
    a straight line between two points has earned. The unit changes at the
    ROUNDED value (Map 5d): 995 m is "≈ 1.0 km", not "≈ 1000 m"; 99.95 km is
    "≈ 100 km", not "≈ 100.0 km". */
export function distanceText(m: number): string {
  if (!Number.isFinite(m) || m < 0) return '';
  const metres = Math.max(10, Math.round(m / 10) * 10);
  if (metres < 1000) return `≈ ${metres} m`;
  const tenths = Math.round(m / 100) / 10;
  return tenths < 100 ? `≈ ${tenths.toFixed(1)} km` : `≈ ${Math.round(m / 1000)} km`;
}

/** The distance a line from you wears on the map — the board's "1.9 km", no
    "≈" (the chip has no room for it) — and nothing at all when your position
    is too rough to stand behind it (Map 5d: Guide me's leg said "1.9 km" from
    a fix ±900 m, and "0 km" for a place 30 m away). */
export function legText(m: number, accuracyM: number | null | undefined): string | null {
  return Number.isFinite(m) && m >= 0 && meaningful(m, accuracyM) ? distanceText(m).replace('≈ ', '') : null;
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

/** "≈ 900 m" — only for a rough position (worse than FINE_M); null for a good
    fix. The unit changes at the rounded value: 990 m is "≈ 1 km" (Map 5d). */
export function accuracyText(accuracyM: number | null | undefined): string | null {
  if (accuracyM == null || !Number.isFinite(accuracyM) || accuracyM <= FINE_M) return null;
  const metres = Math.round(accuracyM / 50) * 50 || 50;
  if (metres < 1000) return `≈ ${metres} m`;
  const km = accuracyM / 1000;
  return `≈ ${km < 10 ? (Math.round(km * 2) / 2).toString() : Math.round(km)} km`;
}

/** A position this old, found when the map comes back — the Map tab opened
    again, the app shown again — is where you WERE (Map 5d). */
export const STALE_MS = 30_000;
/** Is a fix (taken at `at`, ms since the epoch) too old to draw as you? */
export const staleFix = (at: number | null | undefined, now: number): boolean => at == null || !Number.isFinite(at) || now - at > STALE_MS;

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

/** The top edge's lift above the horizon (°) where the back of the phone
    starts to take over as the pointer, and where it has taken over. */
export const UPRIGHT_FROM = 60;
export const UPRIGHT_AT = 80;

/**
 * THE COMPASS HEADING the phone's orientation gives — the way you point it
 * (Map 5d). Near flat, that is the TOP EDGE OF THE SCREEN as it is drawn: its
 * heading is 360 − alpha, whatever the phone's roll (a roll turns the phone
 * about that very edge), turned by the screen's own rotation (`screenAngle`,
 * screen.orientation.angle: 90 when the phone is held in landscape turned
 * counter-clockwise, the screen's top then the phone's right-hand side). As
 * the phone comes upright the top edge points at the sky and its heading
 * means nothing, so the BACK of the phone — the way its camera looks — takes
 * over, blended in between UPRIGHT_FROM and UPRIGHT_AT degrees of lift.
 *
 * The back alone (the W3C spec's worked example, which this replaced) is right
 * only for an upright phone: held near flat it swings with the slightest roll
 * — facing north it said 56° at β 2° γ −3°, 34° at β 15° γ −10°, 350° at
 * β 30° γ 5°.
 *
 * `alpha` from `deviceorientationabsolute` is measured from MAGNETIC north on
 * Android; add the declination for TRUE north. Null when the event carries no
 * angles.
 */
export function headingFromOrientation(alpha: number | null, beta: number | null, gamma: number | null, screenAngle = 0): number | null {
  if (alpha == null || !Number.isFinite(alpha)) return null;
  const r = Math.PI / 180;
  const [sa, ca] = [Math.sin(alpha * r), Math.cos(alpha * r)];
  const [sb, cb] = [Math.sin((beta ?? 0) * r), Math.cos((beta ?? 0) * r)];
  const [sg, cg] = [Math.sin((gamma ?? 0) * r), Math.cos((gamma ?? 0) * r)];
  const [sk, ck] = [Math.sin((Number.isFinite(screenAngle) ? screenAngle : 0) * r), Math.cos((Number.isFinite(screenAngle) ? screenAngle : 0) * r)];
  /* the phone's own axes on the ground (east, north, up): R = Rz(α)·Rx(β)·Ry(γ) */
  const x = [ca * cg - sa * sb * sg, sa * cg + ca * sb * sg, -cb * sg];
  const y = [-sa * cb, ca * cb, sb];
  const z = [ca * sg + sa * sb * cg, sa * sg - ca * sb * cg, cb * cg];
  /* the screen's top edge as drawn, and the phone's back */
  const top = [sk * x[0]! + ck * y[0]!, sk * x[1]! + ck * y[1]!, sk * x[2]! + ck * y[2]!];
  const back = [-z[0]!, -z[1]!, -z[2]!];
  const lift = Math.asin(Math.max(-1, Math.min(1, top[2]!))) / r;
  const t = Math.max(0, Math.min(1, (lift - UPRIGHT_FROM) / (UPRIGHT_AT - UPRIGHT_FROM)));
  const w = t * t * (3 - 2 * t);
  const th = Math.hypot(top[0]!, top[1]!);
  const bh = Math.hypot(back[0]!, back[1]!);
  let e = 0;
  let n = 0;
  if (th > 1e-6) {
    e += ((1 - w) * top[0]!) / th;
    n += ((1 - w) * top[1]!) / th;
  }
  if (bh > 1e-6) {
    e += (w * back[0]!) / bh;
    n += (w * back[1]!) / bh;
  }
  /* the top edge straight down (the phone upright, upside down): its back points the way */
  if (Math.hypot(e, n) < 1e-9) {
    if (bh < 1e-6) return norm360(360 - alpha + screenAngle);
    e = back[0]!;
    n = back[1]!;
  }
  return norm360(Math.atan2(e, n) / r);
}

/** The screen's rotation from the phone's natural (portrait) orientation, in
    degrees: screen.orientation.angle, else the old window.orientation (−90 →
    270), else 0. */
export function screenAngleOf(env: { screen?: { orientation?: { angle?: unknown } }; orientation?: unknown }): number {
  const a = env.screen?.orientation?.angle;
  if (typeof a === 'number' && Number.isFinite(a)) return norm360(a);
  const o = env.orientation;
  return typeof o === 'number' && Number.isFinite(o) ? norm360(o) : 0;
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

/** The middle of the room the panels leave a w × h map — where the map's
    centre is drawn. Folding the places' sheet (Map 5e) makes the point
    already drawn at the NEW room's middle the centre, so nothing on the
    screen moves and the room given back is simply more map. */
export function roomMiddle(p: { top: number; bottom: number; left: number; right: number }, w: number, h: number): [number, number] {
  return [(p.left + w - p.right) / 2, (p.top + h - p.bottom) / 2];
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

/* ---------- keeping words off the pins (Map 5d) ---------- */

/** A box on screen, CSS px. */
export interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}
/** A pin or a cluster the map drew, where it came to rest (CSS px from the map's top left). `photo`: it wears its
    place's photo (Map 5e, E — a larger round than the icon, its name lower); `chars`: the length of the name drawn
    under it (none for a cluster, or for today's and tonight's pins, which the screen names with a tag). */
export interface DrawnPin {
  x: number;
  y: number;
  photo?: boolean;
  chars?: number;
}
/** Half the side of a pin's (or a cluster's, badge and all) image: 46 px round its point. */
export const PIN_HALF = 23;
/** An icon pin's disc, ring and all (16.25 px and 0.75 of its stroke). */
export const PIN_DISC = 17;
/** A pin's name: 11.5 px bold, wrapped at 9 em — about 6.4 px a character (Map 5f). */
const NAME_CHAR = 6.4;
const NAME_MAX = 9 * 11.5;
const NAME_LINE = 14;
const covers = (o: { x: number; y: number }, box: Box, pad: number): boolean => o.x + pad > box.l && o.x - pad < box.r && o.y + pad > box.t && o.y - pad < box.b;

/** A ring's label sits on one of the ring's diagonals, outside it. */
export type RingCorner = 45 | 135 | 225 | 315;
/** The label's box at a diagonal's point: it grows away from the ring's middle. */
export function ringLabelBox(p: { x: number; y: number }, corner: RingCorner, size: { w: number; h: number }): Box {
  const right = corner === 45 || corner === 135;
  const up = corner === 45 || corner === 315;
  const l = right ? p.x + 3 : p.x - 3 - size.w;
  const t = up ? p.y - 2 - size.h : p.y + 2;
  return { l, t, r: l + size.w, b: t + size.h };
}
/** WHERE A RING'S LABEL GOES: the north-east diagonal, as the board draws it —
    unless a pin or a cluster covers that spot (its "+3" sat on "250 m"), then
    the first free one of south-east, north-west, south-west; none free, the
    north-east. `at` gives a diagonal's point on the ring, on screen. */
export function ringLabelCorner(at: (c: RingCorner) => { x: number; y: number }, size: { w: number; h: number }, pins: DrawnPin[]): RingCorner {
  for (const c of [45, 135, 315, 225] as const) {
    const box = ringLabelBox(at(c), c, size);
    if (!pins.some((q) => covers(q, box, q.photo ? PHOTO_HALO : PIN_HALF))) return c;
  }
  return 45;
}

/** How far below its point a pin's name reaches (its label hangs under the disc). */
export const PIN_NAME_BELOW = 38;
/** THE ROOM A DRAWN PIN TAKES (Map 5f): its disc — or, wearing its photo, the photo's night rim (23.5 px, not the
    icon's 17) — and the name under it: down to 38 px below its point under an icon, 43 under a photo (its name
    hangs lower), a line more for a name long enough to wrap, and as wide as that name. */
export function pinBox(q: DrawnPin): Box {
  const r = q.photo ? PHOTO_RIM : PIN_DISC;
  const w = Math.min(NAME_MAX, (q.chars ?? 0) * NAME_CHAR);
  const lines = q.chars ? Math.ceil(((q.chars ?? 0) * NAME_CHAR) / NAME_MAX) : 1;
  const half = Math.max(r, w / 2);
  return { l: q.x - half, t: q.y - r, r: q.x + half, b: q.y + (q.photo ? PHOTO_NAME_BELOW : PIN_NAME_BELOW) + (lines - 1) * NAME_LINE };
}
/** Does a pin — its disc or photo, and its name under it — lie on this box (or within `gap` of it)? */
export const pinOn = (q: DrawnPin, box: Box, gap = 0): boolean => meets(pinBox(q), { l: box.l - gap, t: box.t - gap, r: box.r + gap, b: box.b + gap });
const meets = (a: Box, b: Box): boolean => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

/** WHERE TODAY'S AND TONIGHT'S NAME TAG HANGS (Map.svelte's tag under the pin), px below the pin's point: under an
    icon pin as Map 5c set it (tucked under its 17 px disc); under a photo pin (Map 5f) below what is really drawn
    there — the photo's night rim with today's halo round it, tonight's ring — never on the photo. */
export function tagBelow(v: 'today' | 'tonight', photo: boolean): number {
  if (!photo) return 20;
  return v === 'tonight' ? Math.ceil(PHOTO_TONIGHT) + 1 : Math.ceil(PHOTO_RIM) + 2;
}

/** WHERE THE MAP'S FOOT GOES (the scale and whose streets they are), so it
    never lies on a pin at rest (Map 5d: Beihai Park and Jingshan Park sat
    under it): on the left, as the board draws it — unless a pin (or its name)
    lies under it there; then on the right, if that is clear of pins and of
    the controls down the side; else in SHORT, one line — the scale and the
    licence's own words — on the left, as small as the foot gets. `full` is
    the whole box's size, `bottom` where its lower edge sits on screen,
    `blocked` what else lives in the lanes (the side controls). */
export type FootAt = 'l' | 'r' | 'short';
export function footPlace(
  full: { w: number; h: number },
  lane: { width: number; bottom: number },
  pins: DrawnPin[],
  blocked: Box[] = [],
  inset = 16,
): FootAt {
  const at = (side: 'l' | 'r', size: { w: number; h: number }): Box => {
    const l = side === 'l' ? inset : lane.width - inset - size.w;
    return { l, t: lane.bottom - size.h, r: l + size.w, b: lane.bottom };
  };
  const clear = (b: Box): boolean => !pins.some((q) => pinOn(q, b));
  if (clear(at('l', full))) return 'l';
  const right = at('r', full);
  if (clear(right) && !blocked.some((b) => meets(right, b))) return 'r';
  return 'short';
}

/* ---------- clusters ---------- */

/** The badge on a cluster: "+4" — the places it holds. */
export function clusterBadge(count: number): string {
  return count > 99 ? '+99' : `+${Math.max(0, Math.round(count))}`;
}

/* ---------- nearest first ---------- */

export interface Ranged<T> {
  item: T;
  /** straight-line metres from where it was measured */
  m: number;
  /** degrees from true north */
  deg: number;
}

/** THE LIST'S ORDER (Map 5d): the rows a distance is worth saying for first,
    nearest first; then the rest by name. The list sorted with "by distance
    when both have one, else 0" — not an order at all once some rows have a
    distance and some do not (a rough fix): a row 300 m away could come out
    before one 100 m away, depending on which pairs the sort happened to try. */
export function byDistanceThenName<T>(rows: readonly T[], dist: (t: T) => number | null | undefined, name: (t: T) => string): T[] {
  const measured: { r: T; d: number }[] = [];
  const rest: T[] = [];
  for (const r of rows) {
    const d = dist(r);
    if (d != null && Number.isFinite(d)) measured.push({ r, d });
    else rest.push(r);
  }
  measured.sort((a, b) => a.d - b.d);
  rest.sort((a, b) => name(a).localeCompare(name(b)));
  return [...measured.map((x) => x.r), ...rest];
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
