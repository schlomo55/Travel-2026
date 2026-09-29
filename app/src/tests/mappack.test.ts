/* THE MAP PACK'S AREAS (Map 5c, scripts/maps/areas.ts) and the committed
   test pack. The pack itself is built by hand (`npm run map:pack`, dev-only
   network) and never committed; what is proven here is what decides it:
   every place the Map tab draws lies inside a box with its walk round it,
   no two boxes overlap, the approximate points stand in only for places with
   no position, and nothing outside China rides along. */
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AppBackup, TripBundle } from '../lib/model/types';
import { anchorsOf, areasOf, boxesOf, COVERAGE, MARGIN_KM, regionOf, tripOf } from '../../scripts/maps/areas';
import { mapPlaces } from '../lib/logic/mapplaces';

const here = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(here, '..', '..', '..', 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup;
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
    expect(drawn.length).toBeGreaterThan(140);
    for (const p of drawn) {
      const inside = boxes.some((b) => p.pos!.lat > b.s && p.pos!.lat < b.n && p.pos!.lng > b.w && p.pos!.lng < b.e);
      expect(inside, p.name).toBe(true);
    }
  });

  it('one area per stop, in trip order, and only the flights from Tel Aviv and Abu Dhabi left out', () => {
    expect(areas.map((a) => a.name)).toEqual(['Kunyu Academy', 'Beijing', 'Chongli', 'Zhangjiajie', 'Chongqing', 'Lijiang', 'Tiger Leaping Gorge', 'Dali', 'Kunming', 'Hong Kong']);
    expect(dropped.map((d) => d.id).sort()).toEqual(['cn26-flight-ey608', 'cn26-flight-ey609', 'cn26-flight-ey888']);
    for (const d of dropped) expect(d.at.lng < 60, d.label).toBe(true);
  });

  it('an approximate point stands in only while its place has no position of its own', () => {
    const cover = anchors.filter((a) => a.src === 'coverage');
    expect(cover.length).toBeGreaterThan(0);
    const ids = new Set(mapPlaces({ tripId: 'cn26', stops: trip.stops, showCards: trip.showCards, bookings: trip.bookings }).filter((p) => p.pos).flatMap((p) => [p.id, ...p.with.map((w) => w.id)]));
    for (const a of cover) expect(ids.has(a.id.replace('coverage:', '')), a.label).toBe(false);
    /* give Jinshanling a position and its approximate point goes */
    const pinned: TripBundle = structuredClone(trip);
    const bj = pinned.stops.find((s) => s.id === 'cn26-stop-beijing')!;
    const wall = bj.spots!.find((s) => s.id === 'cn26-spot-beijing-jinshanling')!;
    wall.pin = { lat: 40.676, lng: 117.24 };
    const again = anchorsOf(pinned).anchors;
    expect(again.some((a) => a.id === 'coverage:cn26-spot-beijing-jinshanling')).toBe(false);
    expect(again.some((a) => a.id === 'cn26-spot-beijing-jinshanling' && a.src === 'place')).toBe(true);
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
});
