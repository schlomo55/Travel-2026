/* THE MAP ENGINE'S OWN GEOMETRY — where the camera frames points and where
   the room the panels leave has its middle (logic/wayfind.ts was their home
   until the demo's day route: only the engine reads them, so they ship in
   its chunk, not the Map screen's — scripts/check-bundle.mjs), where a ring's
   label goes, a cluster's badge, and the photo pins' zoom rule and image
   names (logic/placephotos.ts keeps their geometry). Pure. */
import { PIN_HALF, type Box, type DrawnPin } from '../../logic/wayfind';
import { PHOTO_HALO } from '../../logic/placephotos';

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

/* ---------- clusters ---------- */

/** The badge on a cluster: "+4" — the places it holds. */
export function clusterBadge(count: number): string {
  return count > 99 ? '+99' : `+${Math.max(0, Math.round(count))}`;
}

/* ---------- the photo pins (Map 5e, E) ---------- */

/** From this zoom on, a place with a photo wears it on its pin — a small round
    photo in its category's ring; below it, the icon (Map 5e: chosen from the
    screenshots — see PROGRESS.md). Clusters are never photos. */
export const PHOTO_PIN_ZOOM = 15;

/** THE ZOOM RULE AS THE MAP'S STYLE WRITES IT — one source (Map 5f): lib/map/street draws its pins' image and
    their names' offset with it, `photoPinAt` reads it back for the screen, the tests hold both. Below
    PHOTO_PIN_ZOOM `icon`, from it on `photo`: a maplibre `step` on the zoom. */
export function photoPinStep<T>(icon: T, photo: T): ['step', ['zoom'], T, number, T] {
  return ['step', ['zoom'], icon, PHOTO_PIN_ZOOM, photo];
}

/** Does a pin wear its photo at this zoom? The style's own rule, evaluated as maplibre evaluates a `step`: the
    output of the last stop at or below the zoom. */
export function photoPinAt(zoom: number, hasPhoto: boolean): boolean {
  const [, , below, from, above] = photoPinStep(false, true);
  return hasPhoto && (zoom >= from ? above : below);
}

/** How far below its point a photo pin's name hangs, in em of its 11.5 px label (logic/placephotos.ts PHOTO_NAME_BELOW is where it reaches). */
export const PHOTO_LABEL_EM = 2.5;

/** The map image a photo pin is drawn with — `ph-<id>`, `-today` or `-tonight` as its pin is (the style's own
    `concat` writes the same name from the pin's properties). */
export const photoPinName = (id: string, v: '' | 'today' | 'tonight'): string => `ph-${id}${v ? `-${v}` : ''}`;

/** …and back: which place, which variant, or null for any other image. */
export function parsePhotoPinName(name: string): { id: string; v: '' | 'today' | 'tonight' } | null {
  const m = /^ph-(.+?)(?:-(today|tonight))?$/.exec(name);
  if (!m?.[1]) return null;
  return { id: m[1], v: (m[2] as 'today' | 'tonight' | undefined) ?? '' };
}
