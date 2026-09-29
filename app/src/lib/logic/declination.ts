/* MAGNETIC DECLINATION, LOOKED UP (Map 5c) — how far magnetic north lies
   from true north, anywhere, offline: the World Magnetic Model's answers on a
   5° grid, computed at dev time (scripts/maps/declination.ts writes
   declination-grid.ts), blended between the four corners around a point.
   Checked against the model at every stop of every seed (declination.test.ts).

   East positive: true heading = magnetic heading + declination. Beyond the
   grid's latitudes (60° S … 75° N) the nearest row answers. */
import { COLS, LAT0, LAT1, LNG0, STEP, TENTHS } from './declination-grid';

let cells: Int16Array | null = null;
function table(): Int16Array {
  cells ??= Int16Array.from(TENTHS.split(','), Number);
  return cells;
}

/** Degrees, east positive, at a WGS-84 point. */
export function declinationAt(lat: number, lng: number): number {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 0;
  const t = table();
  const la = Math.min(LAT1, Math.max(LAT0, lat));
  const lo = ((((lng - LNG0) % 360) + 360) % 360) + LNG0; // into [-180, 180)
  const fy = (la - LAT0) / STEP;
  const fx = (lo - LNG0) / STEP;
  const rows = (LAT1 - LAT0) / STEP + 1;
  const y0 = Math.min(rows - 2, Math.floor(fy));
  const x0 = Math.min(COLS - 2, Math.floor(fx));
  const ty = fy - y0;
  const tx = fx - x0;
  const at = (y: number, x: number): number => (t[y * COLS + x] ?? 0) / 10;
  const top = at(y0 + 1, x0) * (1 - tx) + at(y0 + 1, x0 + 1) * tx;
  const bottom = at(y0, x0) * (1 - tx) + at(y0, x0 + 1) * tx;
  return Math.round((bottom * (1 - ty) + top * ty) * 100) / 100;
}
