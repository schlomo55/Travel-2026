/* THE MAP PACK'S AREAS (Map 5c, scripts/maps/areas.ts) and the committed
   test pack. The pack itself is built by hand (`npm run map:pack`, dev-only
   network) and never committed; what is proven here is what decides it:
   every place the Map tab draws lies inside a box with its walk round it,
   no two boxes overlap, the approximate points stand in only for places with
   no position, and nothing outside China rides along — on the demo trip. */
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AppBackup, TripBundle } from '../lib/model/types';
import { anchorsOf, areasOf, boxesOf, COVERAGE, MARGIN_KM, regionOf, tripOf } from '../../scripts/maps/areas';
import { mapPlaces } from '../lib/logic/mapplaces';

const here = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(here, '..', '..', '..', 'seed', 'demo-2027.trip.json'), 'utf8')) as AppBackup;
const trip = tripOf(seed);
const KM = 111.32;

describe('the map pack · its areas', () => {
  const { areas, boxes, anchors, dropped } = areasOf(trip);

  it('every anchor lies inside a box, with the walk round it', () => {
    for (const a of anchors) {
      const b = boxes.find((x) => x.anchors.includes(a));
      expect(b, a.label).toBeDefined();
      if (!b) continue;
      const dLat = (MARGIN_KM / KM) * 0.999;
      const dLng = (MARGIN_KM / (KM * Math.cos((a.at.lat * Math.PI) / 180))) * 0.99;
      expect(a.at.lat - b.s, a.label).toBeGreaterThanOrEqual(dLat);
      expect(b.n - a.at.lat, a.label).toBeGreaterThanOrEqual(dLat);
      expect(a.at.lng - b.w, a.label).toBeGreaterThanOrEqual(dLng);
      expect(b.e - a.at.lng, a.label).toBeGreaterThanOrEqual(dLng);
    }
  });

  it('no two boxes overlap (a MultiPolygon’s parts must not)', () => {
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        expect(a.w < b.e && b.w < a.e && a.s < b.n && b.s < a.n, `${i} × ${j}`).toBe(false);
      }
    }
  });

  it('every place the Map tab draws is in the pack', () => {
    const places = mapPlaces({ tripId: trip.trip.id, stops: trip.stops, showCards: trip.showCards, bookings: trip.bookings, dayPlans: trip.dayPlans });
    const drawn = places.filter((p) => p.pos);
    expect(drawn.length).toBeGreaterThan(60);
    for (const p of drawn) {
      const inside = boxes.some((b) => p.pos!.lat > b.s && p.pos!.lat < b.n && p.pos!.lng > b.w && p.pos!.lng < b.e);
      expect(inside, p.name).toBe(true);
    }
  });

  it('one area per stop, in trip order, and only the flights from Paris and Helsinki left out', () => {
    /* No Suzhou area: the stop has no coordinate and no place with a
       position, so there is nothing to draw an area around. */
    expect(areas.map((a) => a.name)).toEqual(['Tai-chi school', 'Shanghai', 'Huangshan', 'Chengdu', 'Yangshuo & the Li River', 'Longji rice terraces', 'Guilin', 'Hong Kong & Macau']);
    expect(dropped.map((d) => d.id).sort()).toEqual(['dm27-flight-ay1501', 'dm27-flight-ay1506', 'dm27-flight-ay9057']);
    for (const d of dropped) expect(d.at.lng < 60, d.label).toBe(true);
  });

  /* The COVERAGE table is keyed by another trip's ids, so on the demo trip it
     does nothing (its own unpinned spots — Dazhai, Hongcun, Xixi — get no
     approximate point). The rule itself is proven on a demo stop re-keyed as
     a table entry's stop, holding that entry's place with no position. */
  it('an approximate point stands in only while its place has no position of its own', () => {
    expect(anchors.filter((a) => a.src === 'coverage')).toEqual([]);
    expect(anchors.some((a) => a.id === 'dm27-spot-longji-dazhai')).toBe(false);
    const entry = COVERAGE.find((c) => c.for.includes('-spot-'))!;
    const keyed: TripBundle = structuredClone(trip);
    const longji = keyed.stops.find((s) => s.id === 'dm27-stop-longji')!;
    longji.id = entry.stopId;
    longji.coord = { lat: entry.at.lat + 0.05, lng: entry.at.lng + 0.05 };
    longji.spots = [{ id: entry.for, name: entry.label, kind: 'sight', mapQuery: entry.label }];
    const cover = anchorsOf(keyed).anchors.filter((a) => a.src === 'coverage');
    expect(cover.map((a) => a.id)).toEqual([`coverage:${entry.for}`]);
    expect(cover[0]!.stopId).toBe(entry.stopId);
    const ids = new Set(mapPlaces({ tripId: 'dm27', stops: keyed.stops, showCards: keyed.showCards, bookings: keyed.bookings }).filter((p) => p.pos).flatMap((p) => [p.id, ...p.with.map((w) => w.id)]));
    for (const a of cover) expect(ids.has(a.id.replace('coverage:', '')), a.label).toBe(false);
    /* give the place a position and its approximate point goes */
    const pinned: TripBundle = structuredClone(keyed);
    const spot = pinned.stops.find((s) => s.id === entry.stopId)!.spots![0]!;
    spot.pin = { ...entry.at };
    const again = anchorsOf(pinned).anchors;
    expect(again.some((a) => a.id === `coverage:${entry.for}`)).toBe(false);
    expect(again.some((a) => a.id === entry.for && a.src === 'place')).toBe(true);
    for (const c of COVERAGE) expect(c.at.lat > 20 && c.at.lat < 42 && c.at.lng > 99 && c.at.lng < 123, c.label).toBe(true);
  });

  it('a wider link merges more, never less; the region is one closed MultiPolygon', () => {
    expect(boxesOf(anchors, 20).length).toBeLessThanOrEqual(boxes.length);
    const r = regionOf(boxes);
    expect(r.type).toBe('MultiPolygon');
    expect(r.coordinates).toHaveLength(boxes.length);
    for (const poly of r.coordinates) {
      const ring = poly[0]!;
      expect(ring).toHaveLength(5);
      expect(ring[0]).toEqual(ring[4]);
    }
  });
});

describe('the committed test pack', () => {
  const file = join(here, '..', '..', 'scripts', 'e2e', 'fixtures', 'houhai-test.pmtiles');
  it('is a PMTiles v3 archive of at most 1 MB', () => {
    expect(statSync(file).size).toBeLessThanOrEqual(1_000_000);
    const head = readFileSync(file).subarray(0, 8);
    expect(head.subarray(0, 7).toString('latin1')).toBe('PMTiles');
    expect(head[7]).toBe(3);
  });
  /* Map 5e: the same test tiles with the rehearsal's tiny photo set — the only
     photos this repository carries, small on purpose */
  it('with its tiny photo set, still a PMTiles v3 archive and still at most 1 MB', () => {
    const withPhotos = join(here, '..', '..', 'scripts', 'e2e', 'fixtures', 'houhai-test-photos.pmtiles');
    const b = readFileSync(withPhotos);
    expect(b.length).toBeLessThanOrEqual(1_000_000);
    expect(b.subarray(0, 7).toString('latin1')).toBe('PMTiles');
    expect(b.subarray(b.length - 32, b.length - 24).toString('latin1')).toBe('LTDPHOTO');
  });
});
