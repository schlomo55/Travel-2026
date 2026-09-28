/* THE PROJECTION — real latitudes and longitudes onto a flat box, north up.

   Equirectangular, with longitude scaled by the cosine of the mean latitude
   of the points drawn: at the scale of one country (or one city) that keeps
   the shape of the trip honest, and it is pure arithmetic — no map data, no
   tiles, no network. One scale for both axes, so nothing is stretched, and
   the drawing is centred in the box.

   It only ever projects coordinates the trip file stores. A place without
   one is never given a position here; the callers list it instead
   (constellation.ts `unplaced`, citymap.ts `noPin`). */
import type { Coord } from '../model/types';

export interface Box {
  width: number;
  height: number;
  pad: number;
  /** A deeper top or bottom margin — room for a header or a legend drawn over
      the map. Defaults to `pad`. */
  padTop?: number;
  padBottom?: number;
}

export interface Projection {
  x(c: Coord): number;
  y(c: Coord): number;
  /** Screen pixels per kilometre — the same east-west and north-south. */
  kmPx: number;
  /** The latitude / longitude at a screen position (for the grid labels). */
  latAt(y: number): number;
  lngAt(x: number): number;
}

/** Kilometres in one degree of latitude (mean Earth radius 6371.0088 km). */
export const KM_PER_DEG = 111.195;

const r1 = (n: number): number => Math.round(n * 10) / 10;
const ok = (c: Coord | undefined): c is Coord => !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng);

/**
 * Fit `points` into `box`. `minSpanKm` keeps a close cluster (or a single
 * place) from being blown up to fill the screen — a city map asks for a few
 * kilometres at least. Null when there is nothing to fit.
 */
export function fitProjection(points: Coord[], box: Box, minSpanKm = 0): Projection | null {
  const pts = points.filter(ok);
  if (!pts.length) return null;
  const meanLat = pts.reduce((n, c) => n + c.lat, 0) / pts.length;
  const k = Math.cos((meanLat * Math.PI) / 180);
  const X = (c: Coord): number => c.lng * k;
  const Y = (c: Coord): number => -c.lat; // north up
  const xs = pts.map(X);
  const ys = pts.map(Y);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  const minSpan = minSpanKm / KM_PER_DEG;
  /* Grow a span that is too small symmetrically, so the centre stays put. */
  const grow = (lo: number, hi: number): [number, number] => {
    const span = hi - lo;
    if (span >= minSpan) return [lo, hi];
    const add = (minSpan - span) / 2;
    return [lo - add, hi + add];
  };
  [minX, maxX] = grow(minX, maxX);
  [minY, maxY] = grow(minY, maxY);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  if (spanX <= 1e-9 && spanY <= 1e-9) return null;
  const innerW = box.width - box.pad * 2;
  const top = box.padTop ?? box.pad;
  const innerH = box.height - top - (box.padBottom ?? box.pad);
  const scale = Math.min(spanX > 1e-9 ? innerW / spanX : Infinity, spanY > 1e-9 ? innerH / spanY : Infinity);
  const offX = box.pad + (innerW - spanX * scale) / 2;
  const offY = top + (innerH - spanY * scale) / 2;
  return {
    x: (c) => r1(offX + (X(c) - minX) * scale),
    y: (c) => r1(offY + (Y(c) - minY) * scale),
    kmPx: scale / KM_PER_DEG,
    latAt: (y) => -((y - offY) / scale + minY),
    lngAt: (x) => ((x - offX) / scale + minX) / k,
  };
}

export interface Graticule {
  /** Latitude lines, with the label the boards print at their right end. */
  lats: { y: number; label: string }[];
  /** Longitude lines — unlabelled, as the boards draw them. */
  lngs: { x: number }[];
}

/**
 * The faint grid behind the constellation: whole-degree latitude and
 * longitude lines that fall inside the box. The step is the largest of 10°,
 * 5°, 2° and 1° that draws four latitude lines (else three, else two) — a country gets
 * 5°, a small one gets 1° — so the labels are always real latitudes.
 */
export function graticule(p: Projection, box: Pick<Box, 'width' | 'height'>): Graticule {
  const top = p.latAt(0);
  const bottom = p.latAt(box.height);
  const left = p.lngAt(0);
  const right = p.lngAt(box.width);
  const every = (lo: number, hi: number, step: number): number[] => {
    const out: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
    return out;
  };
  /* the largest step that draws four lines, else three, else two */
  const steps = [10, 5, 2, 1];
  const lines = (n: number): number | undefined => steps.find((s) => every(bottom, top, s).length >= n);
  const step = lines(4) ?? lines(3) ?? lines(2) ?? 1;
  const deg = (v: number, pos: string, neg: string): string => `${Math.abs(v)}°${v < 0 ? neg : pos}`;
  return {
    lats: every(bottom, top, step)
      .map((lat) => ({ y: p.y({ lat, lng: 0 }), label: deg(lat, 'N', 'S') }))
      .sort((a, b) => a.y - b.y),
    lngs: every(left, right, step).map((lng) => ({ x: p.x({ lat: 0, lng }) })),
  };
}
