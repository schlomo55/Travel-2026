/* THE CONSTELLATION — a trip's stops as stars, placed from their REAL stored
   latitude and longitude, north up, fitted into a box. The Trips shelf draws
   it small (f-trips); Run 2's map engine draws it large.

   Nothing is guessed. A stop with no stored coordinate is not placed — it is
   returned in `unplaced`, so a screen can list it rather than invent a
   position. With fewer than two placed stops there is no constellation at
   all, and the screen draws something else.

   The projection is equirectangular with longitude scaled by the cosine of
   the trip's mean latitude — faithful enough at the scale of one country,
   and pure arithmetic, so it needs no map data and no network. */
import type { ISODate, Stop } from '../model/types';
import { compareIso } from './dates';
import { mdliteToText } from './mdlite';

export type StarState = 'done' | 'here' | 'ahead';
export type LegState = 'done' | 'today' | 'ahead';

export interface Star {
  id: string;
  name: string;
  x: number;
  y: number;
  state: StarState;
}
export interface Leg {
  from: Star;
  to: Star;
  state: LegState;
}
export interface Constellation {
  width: number;
  height: number;
  stars: Star[];
  legs: Leg[];
  /** The stop you are in tonight, when the trip is under way. */
  here: Star | null;
  /** Stops with no stored coordinate — listed, never placed. */
  unplaced: string[];
}

export function buildConstellation(
  stops: Stop[],
  now: ISODate,
  box: { width: number; height: number; pad: number },
): Constellation | null {
  const real = [...stops].filter((s) => s.kind === 'stop').sort((a, b) => a.order - b.order);
  const placed = real.filter((s) => s.coord && Number.isFinite(s.coord.lat) && Number.isFinite(s.coord.lng));
  const unplaced = real.filter((s) => !placed.includes(s)).map((s) => mdliteToText(s.name));
  if (placed.length < 2) return null;

  const meanLat = placed.reduce((n, s) => n + (s.coord?.lat ?? 0), 0) / placed.length;
  const k = Math.cos((meanLat * Math.PI) / 180);
  const px = placed.map((s) => (s.coord?.lng ?? 0) * k);
  const py = placed.map((s) => -(s.coord?.lat ?? 0)); // north up
  const minX = Math.min(...px);
  const maxX = Math.max(...px);
  const minY = Math.min(...py);
  const maxY = Math.max(...py);
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);
  const innerW = box.width - box.pad * 2;
  const innerH = box.height - box.pad * 2;
  /* one scale for both axes, so the shape of the trip is not stretched */
  const scale = Math.min(innerW / spanX, innerH / spanY);
  const offX = box.pad + (innerW - spanX * scale) / 2;
  const offY = box.pad + (innerH - spanY * scale) / 2;

  const stateOf = (s: Stop): StarState =>
    compareIso(s.end, now) <= 0 ? 'done' : compareIso(s.start, now) <= 0 ? 'here' : 'ahead';
  const stars: Star[] = placed.map((s, i) => ({
    id: s.id,
    name: mdliteToText(s.name),
    x: round(offX + ((px[i] ?? 0) - minX) * scale),
    y: round(offY + ((py[i] ?? 0) - minY) * scale),
    state: stateOf(s),
  }));

  /* A leg is walked on the day its destination begins: before that day it
     is ahead, on it it is today's leg, after it the road so far. */
  const legs: Leg[] = [];
  for (let i = 0; i + 1 < placed.length; i++) {
    const to = placed[i + 1];
    const a = stars[i];
    const b = stars[i + 1];
    if (!to || !a || !b) continue;
    const c = compareIso(to.start, now);
    legs.push({ from: a, to: b, state: c < 0 ? 'done' : c === 0 ? 'today' : 'ahead' });
  }
  return {
    width: box.width,
    height: box.height,
    stars,
    legs,
    here: stars.find((s) => s.state === 'here') ?? null,
    unplaced,
  };
}

const round = (n: number): number => Math.round(n * 10) / 10;

/** A gentle arc between two stars (the boards' quadratic legs): the control
    point sits off the midpoint, perpendicular, by a fraction of the length. */
export function legPath(a: { x: number; y: number }, b: { x: number; y: number }, bend = 0.18): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const cx = round(mx - dy * bend);
  const cy = round(my + dx * bend);
  return `M${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}
