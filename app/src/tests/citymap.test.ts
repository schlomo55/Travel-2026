/* THE CITY CLOSE-UP — pins only where the trip file stores a coordinate,
   everything else listed as "No pin yet", and the ways out drawn as bearings
   towards real neighbouring stops. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup } from '../lib/model/types';
import { bearing, buildCityMap, cityPlaces, nearestStop } from '../lib/logic/citymap';

const china = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup)
  .trips[0]!;
const zjj = china.stops.find((s) => s.id === 'cn26-stop-zhangjiajie')!;
const all = {
  stops: china.stops,
  showCards: china.showCards,
  bookings: china.bookings,
  dayPlans: china.dayPlans,
  dayDefaults: china.dayDefaults,
};
const box = { width: 412, height: 420, pad: 40 };

describe('city map · Zhangjiajie, the real trip', () => {
  const places = cityPlaces(zjj, all);
  const map = buildCityMap(zjj, places, china.stops, box)!;

  it('pins the three verified places: the park gate, the airport and Tianmen', () => {
    const names = map.pins.flatMap((p) => p.places.map((x) => x.name));
    expect(names).toContain('武陵源');
    expect(names).toContain('张家界荷花国际机场');
    expect(names).toContain('天门山');
  });

  it('merges a card and a ticket that share one coordinate into one pin', () => {
    const tianmen = map.pins.find((p) => p.places.some((x) => x.name === '天门山'))!;
    expect(tianmen.places.map((x) => x.id).sort()).toEqual(['cn26-place-11', 'cn26-ticket-tianmen']);
  });

  it('lists every park spot and both beds as "No pin yet" — never a guessed pin', () => {
    const noPin = map.noPin.map((p) => p.id);
    for (const s of zjj.spots ?? []) if (!s.coord) expect(noPin).toContain(s.id);
    expect(noPin).toContain('cn26-stay-03'); // Pullman
    expect(noPin).toContain('cn26-stay-04'); // Huatian
    expect(map.pins.every((p) => p.places.every((x) => x.coord))).toBe(true);
  });

  it('keeps Beijing’s airports off a Zhangjiajie map', () => {
    const ids = map.pins.flatMap((p) => p.places.map((x) => x.id));
    expect(ids).not.toContain('cn26-place-01'); // Daxing
    expect(ids).not.toContain('cn26-flight-ca1953'); // boards at Daxing
  });

  it('measures straight lines from the centre, and says how big a kilometre is', () => {
    const dyg = map.pins.find((p) => p.places.some((x) => x.id === 'cn26-place-09'))!;
    expect(dyg.km).toBeGreaterThan(25);
    expect(dyg.km).toBeLessThan(35);
    expect(map.kmPx).toBeGreaterThan(0);
  });

  it('points the ways out at the real stops before and after', () => {
    const into = map.exits.find((e) => e.role === 'in')!;
    const out = map.exits.find((e) => e.role === 'out')!;
    expect(into.name).toBe('Chongli');
    expect(out.name).toBe('Chongqing');
    /* Chongqing is west (a little south) of Zhangjiajie; Chongli is north */
    expect(out.bearing).toBeGreaterThan(240);
    expect(out.bearing).toBeLessThan(280);
    expect(into.bearing < 30 || into.bearing > 330).toBe(true);
    /* on the edge of the padded box */
    expect(Math.min(out.x - box.pad, box.width - box.pad - out.x, out.y - box.pad, box.height - box.pad - out.y)).toBeCloseTo(0, 0);
  });
});

describe('city map · the rules', () => {
  it('belongs a coordinate to the nearest stop within reach, or to none', () => {
    expect(nearestStop({ lat: 29.1031, lng: 110.4433 }, china.stops)?.id).toBe('cn26-stop-zhangjiajie');
    /* Qiaotou is the gorge, not Lijiang, though they are 40 km apart */
    expect(nearestStop({ lat: 27.1892, lng: 100.0488 }, china.stops)?.id).toBe('cn26-stop-gorge');
    /* Abu Dhabi is nowhere on this trip */
    expect(nearestStop({ lat: 24.4328, lng: 54.6511 }, china.stops)).toBeNull();
  });

  it('computes a bearing clockwise from north', () => {
    expect(bearing({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(0, 0);
    expect(bearing({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(90, 0);
    expect(bearing({ lat: 0, lng: 0 }, { lat: -1, lng: 0 })).toBeCloseTo(180, 0);
  });

  it('draws nothing where nothing is located', () => {
    const bare = { ...zjj, coord: undefined, spots: [] };
    expect(buildCityMap(bare, [], china.stops, box)).toBeNull();
  });
});
