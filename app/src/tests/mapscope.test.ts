/* THE MAP'S SCOPE (10 Nov 2026, lib/logic/mapscope.ts) — what part of the trip the Map tab's chips, rail and
   list are about. A phone test found it silently going from one stop ("6 places") to the whole trip ("141") after
   a place was opened: the scope was read off the camera. It is a choice now; this pins the default (before /
   during / after the trip, one stop, no dated stop), that a choice outranks it, the numbers beside the chip, the
   points the camera frames, and the peek row's chips. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AppBackup, Stop, TripBundle } from '../lib/model/types';
import { mapPlaces } from '../lib/logic/mapplaces';
import { defaultScope, peekChips, resolveScope, scopeCount, scopeOptions, scopePoints, stopWhere } from '../lib/logic/mapscope';
import type { DayRoute } from '../lib/logic/dayroute';

/* an invented trip: three stops in three invented cities, a night flight between the first and the second */
const stop = (id: string, name: string, start: string, end: string, order: number, kind: Stop['kind'] = 'stop'): Stop => ({
  id,
  tripId: 't1',
  kind,
  name,
  hue: 200,
  start,
  end,
  blocks: [],
  recoBlocks: [],
  order,
});
const trip = { start: '2027-05-10', end: '2027-05-20' };
const stops: Stop[] = [
  stop('s-aldermere', 'Aldermere — the lake town', '2027-05-10', '2027-05-14', 1),
  stop('s-night', 'Night flight', '2027-05-14', '2027-05-15', 2, 'transit'),
  stop('s-brindle', 'Brindle', '2027-05-15', '2027-05-18', 3),
  stop('s-corvane', 'Corvane', '2027-05-18', '2027-05-20', 4),
];

describe('the default scope', () => {
  it('before the first day: the whole trip', () => {
    expect(defaultScope(trip, stops, '2027-05-09')).toBeNull();
    expect(defaultScope(trip, stops, '2027-01-01')).toBeNull();
  });
  it('after the last day: the whole trip', () => {
    expect(defaultScope(trip, stops, '2027-05-21')).toBeNull();
  });
  it('during the trip: the stop you are in', () => {
    expect(defaultScope(trip, stops, '2027-05-10')).toBe('s-aldermere'); // the first day
    expect(defaultScope(trip, stops, '2027-05-12')).toBe('s-aldermere');
    expect(defaultScope(trip, stops, '2027-05-16')).toBe('s-brindle');
    expect(defaultScope(trip, stops, '2027-05-19')).toBe('s-corvane');
  });
  it('the day one stop ends is the day the next begins: the next', () => {
    expect(defaultScope(trip, stops, '2027-05-18')).toBe('s-corvane'); // [start, end)
  });
  it('a travel day, or the last day past the last stop: the whole trip — never a guess', () => {
    expect(defaultScope(trip, stops, '2027-05-14')).toBeNull(); // the night flight is not a stop, no stop holds the day
    expect(defaultScope({ ...trip, end: '2027-05-21' }, stops, '2027-05-20')).toBeNull(); // the day after Corvane ends
  });
  it('a trip with one stop: the trip IS the stop — the whole trip, in every phase', () => {
    const one = [stop('s-only', 'Only', '2027-05-10', '2027-05-20', 1)];
    for (const d of ['2027-05-01', '2027-05-15', '2027-05-30']) expect(defaultScope(trip, one, d)).toBeNull();
  });
  it('a trip with only a travel stop, or none at all: the whole trip', () => {
    expect(defaultScope(trip, [stop('s-night', 'Night flight', '2027-05-14', '2027-05-15', 1, 'transit')], '2027-05-14')).toBeNull();
    expect(defaultScope(trip, [], '2027-05-14')).toBeNull();
  });
  it('stops with no dates cannot be "now": the whole trip', () => {
    const undated = [stop('s-a', 'A', '', '', 1), stop('s-b', 'B', '', '', 2)];
    expect(defaultScope(trip, undated, '2027-05-14')).toBeNull();
    // one dated stop among undated ones still counts — it is the only one that can be here
    const mixed = [stop('s-a', 'A', '', '', 1), stop('s-b', 'B', '2027-05-12', '2027-05-16', 2)];
    expect(defaultScope(trip, mixed, '2027-05-13')).toBe('s-b');
  });
});

describe('what the screen uses: a choice outranks the default', () => {
  it('nothing chosen: the default, whichever it is', () => {
    expect(resolveScope(undefined, 's-brindle', stops)).toBe('s-brindle');
    expect(resolveScope(undefined, null, stops)).toBeNull();
  });
  it('a choice is kept — the whole trip (null) included — whatever the default says', () => {
    expect(resolveScope('s-corvane', 's-brindle', stops)).toBe('s-corvane');
    expect(resolveScope(null, 's-brindle', stops)).toBeNull();
  });
  it('a choice of a stop this trip no longer has (or the travel stop) falls back to the default', () => {
    expect(resolveScope('s-gone', 's-brindle', stops)).toBe('s-brindle');
    expect(resolveScope('s-night', null, stops)).toBeNull();
  });
});

describe('the camera does not move the scope', () => {
  it('the Map screen never reads the scope off the camera (a phone test, 10 Nov 2026)', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'routes', 'Map.svelte'), 'utf8');
    expect(src).not.toMatch(/nearestStop\(\s*settled/);
    expect(src).toMatch(/resolveScope\(mapScope\.of\(/);
  });
});

describe('the names, the numbers and the points — on the demo trip', () => {
  const seed = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'seed', 'demo-2027.trip.json'), 'utf8')) as AppBackup;
  const t = seed.trips[0] as TripBundle;
  const places = mapPlaces({ tripId: 'dm27', stops: t.stops, showCards: t.showCards, bookings: t.bookings, dayPlans: t.dayPlans, dayDefaults: t.dayDefaults });

  it('a stop is named by its city: what comes before " — "', () => {
    expect(stopWhere({ name: 'Aldermere — the lake town' })).toBe('Aldermere');
    expect(stopWhere({ name: '  Brindle ' })).toBe('Brindle');
  });
  it('the options: the whole trip, then every real stop in trip order — never the travel stop', () => {
    const o = scopeOptions(t.stops, places, 'beds');
    expect(o[0]).toMatchObject({ id: null, name: null });
    expect(o.slice(1).map((x) => x.id)).toEqual(t.stops.filter((s) => s.kind === 'stop').map((s) => s.id));
    expect(o.some((x) => x.id === 'dm27-stop-flights')).toBe(false);
  });
  it('the numbers are the "All" chip’s: places with a pin, hotels by the setting', () => {
    expect(scopeCount(places, 'dm27-stop-shanghai', 'beds')).toBe(13); // the rehearsal’s "All 13"
    expect(scopeCount(places, null, 'beds')).toBe(places.filter((p) => p.pos && (p.category !== 'hotel' || p.kind === 'bed' || p.with.some((m) => m.kind === 'bed'))).length);
    expect(scopeCount(places, null, 'all')).toBeGreaterThanOrEqual(scopeCount(places, null, 'beds'));
  });
  it('the stops’ numbers add up to the whole trip’s, less the places no stop owns', () => {
    const per = scopeOptions(t.stops, places, 'beds').slice(1).reduce((n, o) => n + o.n, 0);
    expect(per).toBeLessThanOrEqual(scopeCount(places, null, 'beds'));
    expect(per).toBeGreaterThan(0);
  });
  it('the points the camera frames: this scope’s pinned places, as [lng, lat]', () => {
    const f = { off: new Set<never>(), hotels: 'beds' as const };
    const pts = scopePoints(places, 'dm27-stop-shanghai', f);
    expect(pts).toHaveLength(13);
    for (const [lng, lat] of pts) {
      expect(lng).toBeGreaterThan(120);
      expect(lng).toBeLessThan(122);
      expect(lat).toBeGreaterThan(30);
      expect(lat).toBeLessThan(32);
    }
    expect(scopePoints(places, null, f).length).toBeGreaterThan(pts.length);
  });
  it('a category switched off leaves the points: the pins in view are the pins drawn', () => {
    const all = scopePoints(places, 'dm27-stop-shanghai', { off: new Set(), hotels: 'beds' });
    const noFood = scopePoints(places, 'dm27-stop-shanghai', { off: new Set(['food']), hotels: 'beds' });
    expect(noFood.length).toBeLessThan(all.length);
  });
});

describe('the peek row’s chips', () => {
  const t = (JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'seed', 'demo-2027.trip.json'), 'utf8')) as AppBackup).trips[0] as TripBundle;
  const places = mapPlaces({ tripId: 'dm27', stops: t.stops, showCards: t.showCards, bookings: t.bookings, dayPlans: t.dayPlans, dayDefaults: t.dayDefaults }).filter((p) => p.pos);
  const route = (n: number, withBed: boolean): DayRoute =>
    ({
      date: '2027-03-30',
      colour: '#ff7eb6',
      stops: places.slice(0, n).map((place, i) => ({ n: i + 1, id: place.id, place, pos: place.pos!, optional: false })),
      unplaced: [],
      legs: [],
      bed: withBed ? places[n]! : null,
      toBed: withBed ? ({} as DayRoute['toBed']) : null,
      metres: 0,
      minutes: 0,
      optionalMetres: 0,
      optionalMinutes: 0,
    }) as DayRoute;

  it('with no route: the first twelve places, in the rail’s order, plain chips', () => {
    const chips = peekChips(places, [], 12);
    expect(chips).toHaveLength(12);
    expect(chips.map((c) => c.place.id)).toEqual(places.slice(0, 12).map((p) => p.id));
    expect(chips.every((c) => c.n === undefined && c.colour === undefined)).toBe(true);
  });
  it('with fewer places than the limit: all of them; with none: none', () => {
    expect(peekChips(places.slice(0, 3), [])).toHaveLength(3);
    expect(peekChips([], [])).toEqual([]);
  });
  it('with a route: its stops in the plan’s order, numbered, in the day’s colour — and tonight’s bed after one day’s', () => {
    const chips = peekChips(places, [route(3, true)]);
    expect(chips.map((c) => c.n)).toEqual([1, 2, 3, undefined]);
    expect(chips.slice(0, 3).every((c) => c.colour === '#ff7eb6')).toBe(true);
    expect(chips[3]!.place.id).toBe(places[3]!.id);
  });
  it('every day of the stay: each day’s stops one after the other, no bed', () => {
    const chips = peekChips(places, [route(2, true), route(2, true)]);
    expect(chips).toHaveLength(4);
    expect(chips.every((c) => c.n !== undefined)).toBe(true);
  });
});
