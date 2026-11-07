/* THE REGION, ONE COPY (in-app map builder, 7 Nov 2026). The rule that cuts a
   map pack's region moved from scripts/maps/areas.ts into the app
   (lib/map/region.ts), so the phone's "Build map for this trip" and the
   workshop's `npm run map:pack` read the same code — and every stop got its
   countryside: ±25 km round its own coordinate, merged with the place boxes
   (owner, 7 Nov 2026).

   Proved on trips with no personal data in them: the Israel test trip
   (seed/israel-test.trip.json — 8 stops and no places: before the squares,
   seven 4 × 4 km boxes round the city centres; now every stop inside at least
   its 50 km square) and small trips written out here for the place clusters,
   the stop that has no coordinate, the transit leg and an anchor too far from
   every stop. (That the move left the China trip's region exactly as it was —
   33 boxes, 177 anchors, 3 dropped — was checked locally against its seed on
   7 Nov 2026; STATUS.md has the numbers. The trip files leave this repo.) */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AppBackup, Booking, Coord, Spot, Stop, TripBundle } from '../lib/model/types';
import { anchorsOf, areasOf, boxesOf, boxKm2, COVERAGE, MARGIN_KM, packName, regionOf, STOP_MIN_KM, type Box } from '../lib/map/region';
import type { PlaceSources } from '../lib/logic/mapplaces';
import * as workshop from '../../scripts/maps/areas';

const here = dirname(fileURLToPath(import.meta.url));
const israel = (JSON.parse(readFileSync(join(here, '..', '..', '..', 'seed', 'israel-test.trip.json'), 'utf8')) as AppBackup).trips[0]!;
const sources = (t: TripBundle): PlaceSources => ({ tripId: t.trip.id, stops: t.stops, showCards: t.showCards, bookings: t.bookings, dayPlans: t.dayPlans, dayDefaults: t.dayDefaults });
const KM = 111.32;

/** a stop's own square, as region.ts cuts it (±STOP_MIN_KM, its longitude scaled at its latitude) */
function square(c: Coord, km = STOP_MIN_KM): number[] {
  const dLat = km / KM;
  const dLng = km / (KM * Math.cos((c.lat * Math.PI) / 180));
  return [c.lng - dLng, c.lat - dLat, c.lng + dLng, c.lat + dLat];
}
const covers = (b: Box, q: number[]): boolean => b.w <= q[0]! && b.s <= q[1]! && b.e >= q[2]! && b.n >= q[3]!;
const inside = (b: Box, c: Coord): boolean => c.lat > b.s && c.lat < b.n && c.lng > b.w && c.lng < b.e;
function noOverlap(boxes: Box[]): void {
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      expect(a.w < b.e && b.w < a.e && a.s < b.n && b.s < a.n, `${i} × ${j}`).toBe(false);
    }
}

/* ---------- a small trip, written out: what each rule does to it ---------- */
/** `km` east and north of a point (good enough at these distances) */
const off = (c: Coord, east: number, north: number): Coord => ({ lat: c.lat + north / KM, lng: c.lng + east / (KM * Math.cos((c.lat * Math.PI) / 180)) });
const A: Coord = { lat: 45, lng: 10 };
const C = off(A, 30, 0); // 30 km east of A: its square overlaps A's
const spot = (id: string, at: Coord): Spot => ({ id, name: id, kind: 'sight', coord: at });
const stop = (id: string, name: string, start: string, order: number, coord?: Coord, spots: Spot[] = [], kind: Stop['kind'] = 'stop'): Stop => ({
  id,
  tripId: 'syn',
  kind,
  name,
  hue: 0,
  start,
  end: start,
  order,
  blocks: [],
  recoBlocks: [],
  ...(coord ? { coord } : {}),
  spots,
});
const farFlight = { id: 'syn-flight', tripId: 'syn', kind: 'flight', status: 'booked', flightNo: 'XX 1', date: '2027-01-01', coord: off(A, 0, -500) } as unknown as Booking;
const synthetic: PlaceSources = {
  tripId: 'syn',
  stops: [
    stop('syn-transit', 'The flights', '2027-01-01', 0, off(A, -200, 0), [], 'transit'),
    stop('syn-a', 'Alpha — the old town', '2027-01-01', 1, A, [
      spot('syn-a1', off(A, 1, 1)),
      spot('syn-a2', off(A, 3, 1)), // 2 km from a1: one cluster
      spot('syn-a3', off(A, 18, 1)), // 15 km from a2: a cluster of its own — inside A's square
      spot('syn-a4', off(A, 60, 0)), // a spot belongs to its own stop however far: its own box, outside the square
    ]),
    stop('syn-b', 'Beta', '2027-01-03', 2, undefined, [spot('syn-b1', off(A, -70, 0))]), // no coordinate: no square; its spot still counts
    stop('syn-c', 'Gamma', '2027-01-05', 3, C),
  ],
  showCards: [],
  bookings: [farFlight],
};

describe('the region · the place boxes (a written-out trip)', () => {
  const { anchors, dropped } = anchorsOf(synthetic);

  it('the anchors: every place, every stop with a coordinate — not the transit leg, not a flight far from every stop', () => {
    expect(anchors.map((a) => `${a.id}:${a.src}:${a.stopId}`).sort()).toEqual(
      ['syn-a:stop:syn-a', 'syn-c:stop:syn-c', 'syn-a1:place:syn-a', 'syn-a2:place:syn-a', 'syn-a3:place:syn-a', 'syn-a4:place:syn-a', 'syn-b1:place:syn-b'].sort(),
    );
    expect(dropped.map((d) => d.id)).toEqual(['syn-flight']);
  });

  it('without the squares, as before 7 Nov: places 10 km apart link, each cluster grown by 2 km', () => {
    const boxes = boxesOf(anchors, undefined, undefined, 0);
    /* A + a1 + a2 · a3 · a4 · b1 · C */
    expect(boxes).toHaveLength(5);
    const withA2 = boxes.find((b) => b.anchors.some((x) => x.id === 'syn-a2'))!;
    expect(withA2.anchors.map((x) => x.id).sort()).toEqual(['syn-a', 'syn-a1', 'syn-a2']);
    for (const a of anchors) {
      const b = boxes.find((x) => x.anchors.includes(a))!;
      expect(covers(b, square(a.at, MARGIN_KM * 0.99)), a.id).toBe(true);
    }
    noOverlap(boxes);
  });

  it('with them: each stop’s 50 km square merged with what it overlaps; a far spot keeps its own box; no square for no coordinate', () => {
    const r = areasOf(synthetic);
    /* A's square swallows a1, a2, a3 and overlaps C's square: one box · a4 (60 km out) · b1 */
    expect(r.boxes).toHaveLength(3);
    const big = r.boxes.find((b) => inside(b, A))!;
    expect(covers(big, square(A))).toBe(true);
    expect(covers(big, square(C))).toBe(true);
    expect(big.stopIds.sort()).toEqual(['syn-a', 'syn-c']);
    const a4 = r.boxes.find((b) => b.anchors.some((x) => x.id === 'syn-a4'))!;
    expect(a4).not.toBe(big);
    expect(boxKm2(a4)).toBeLessThan(40); // a place's 4 × 4 km, not a square
    expect(r.boxes.some((b) => b.stopIds.includes('syn-transit'))).toBe(false);
    noOverlap(r.boxes);
    /* Gamma has no box of its own any more: it is named in the area that covers it */
    expect(r.areas.map((a) => a.name)).toEqual(['Alpha + Gamma', 'Beta']);
    expect(r.dropped.map((d) => d.id)).toEqual(['syn-flight']);
  });

  it('a trip with no position anywhere has no region at all', () => {
    const r = areasOf({ tripId: 'x', stops: [], showCards: [], bookings: [] });
    expect(r.boxes).toEqual([]);
    expect(regionOf(r.boxes).coordinates).toEqual([]);
  });

  it('the pack’s name, the phone’s and the workshop’s alike', () => {
    expect(packName('China 2026')).toBe('china-2026-map');
    expect(packName('TEST — Israel 60')).toBe('test-israel-60-map');
    expect(packName('東京')).toBe('trip-map');
  });
});

describe('the region · the Israel test trip (8 stops, no places)', () => {
  const r = areasOf(sources(israel));

  it('before the squares: a 4 × 4 km box round each city centre — too small to find your way by', () => {
    const before = boxesOf(r.anchors, undefined, undefined, 0);
    expect(before).toHaveLength(7); // Tel Aviv twice, one box
    for (const b of before.filter((x) => x.anchors.every((a) => a.src === 'stop'))) expect(boxKm2(b)).toBeLessThan(20);
  });

  it('now: every stop inside at least its 50 km square — 6 boxes, 20,249 km²', () => {
    expect(israel.stops.filter((s) => s.kind === 'stop' && s.coord)).toHaveLength(8);
    for (const s of israel.stops) expect(r.boxes.some((b) => covers(b, square(s.coord!))), s.name).toBe(true);
    expect(r.boxes).toHaveLength(6);
    expect(Math.round(r.boxes.reduce((n, b) => n + boxKm2(b), 0))).toBe(20249);
    noOverlap(r.boxes);
    /* Jerusalem's square merged into Tel Aviv's box: it is named there, not lost */
    expect(r.areas.map((a) => a.name)).toEqual(['Tel Aviv + Jerusalem', 'Negev & Mitzpe Ramon', 'Eilat & the Red Sea', 'Dead Sea', 'Galilee & the Golan', 'Haifa & the coast']);
    expect(r.dropped).toEqual([]);
  });

  it('the coverage-only points speak only for their own trip’s ids', () => {
    expect(r.anchors.some((a) => a.src === 'coverage')).toBe(false);
    expect(COVERAGE.every((c) => c.for.startsWith('cn26-'))).toBe(true);
  });

  it('does not cover Houhai, so `map:pack` leaves the committed Houhai test pack alone (review, 7 Nov)', () => {
    const HOUHAI: [number, number, number, number] = [116.345, 39.915, 116.425, 39.962];
    expect(workshop.regionCovers(r.boxes, HOUHAI)).toBe(false);
    /* a box that holds all of it does; one that holds part of it does not */
    expect(workshop.regionCovers([{ w: 116.3, s: 39.9, e: 116.5, n: 40 }], HOUHAI)).toBe(true);
    expect(workshop.regionCovers([{ w: 116.4, s: 39.9, e: 116.5, n: 40 }], HOUHAI)).toBe(false);
  });

  it('the workshop (scripts/maps/areas.ts) reads the same region from the trip file', () => {
    const ws = workshop.areasOf(israel);
    expect(JSON.stringify(regionOf(ws.boxes))).toBe(JSON.stringify(regionOf(r.boxes)));
    expect(ws.areas.map((a) => a.name)).toEqual(r.areas.map((a) => a.name));
  });
});
