/* A DAY AS A ROUTE (demo, lib/logic/dayroute.ts) — on small hand-built trips,
   not the seed: what a leg's mode starts as (walk to a point, taxi beyond it),
   what a tap switches it to (walk → taxi → metro → walk, kept by the traveller
   per leg), which places are numbered (only those with a pin, in the plan's
   order), what the totals add up (the leg on to tonight's bed too) and which
   colour a day wears (its index within the stay). Straight line × 1.3 at a
   typical speed — an estimate, and every test says so by computing it. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { AppBackup, Booking, Coord, DayPlan, HotelBooking, Spot, Stop, TripBundle } from '../lib/model/types';
import { haversineKm } from '../lib/logic/geoStats';
import { resolveDay } from '../lib/logic/day';
import { drawnIds } from '../lib/logic/mapdrawn';
import { mapPlaces, type PlaceSources } from '../lib/logic/mapplaces';
import {
  DAY_COLOURS,
  DETOUR,
  FAR_METRES,
  LEG_MODES,
  SPEED,
  WALK_UP_TO,
  dayColour,
  dayRoute,
  defaultMode,
  legBetween,
  legKey,
  metresText,
  minutesText,
  nextMode,
  stayRoutes,
  type LegMode,
} from '../lib/logic/dayroute';
import { legModes } from '../lib/state/legModes.svelte';

/* a point `m` metres north of the origin — a straight line of exactly that
   length from the origin, give or take a millimetre */
const ORIGIN: Coord = { lat: 40, lng: 116 };
const north = (m: number): Coord => ({ lat: ORIGIN.lat + m / 1000 / 111.1949, lng: ORIGIN.lng });
const metresBetween = (a: Coord, b: Coord): number => haversineKm(a, b) * 1000;

const spot = (id: string, name: string, at?: Coord): Spot =>
  at ? { id, name, kind: 'sight', coord: at } : { id, name, kind: 'sight', mapQuery: name };

const stop = (id: string, start: string, end: string, spots: Spot[], order = 0): Stop => ({
  id,
  tripId: 't',
  kind: 'stop',
  name: id,
  hue: 20,
  start,
  end,
  blocks: [],
  recoBlocks: [],
  spots,
  order,
});

const bed = (id: string, checkIn: string, checkOut: string, at?: Coord): HotelBooking => ({
  id,
  tripId: 't',
  kind: 'hotel',
  status: 'booked',
  title: `Hotel ${id}`,
  date: checkIn,
  city: 'Testville',
  checkIn,
  checkOut,
  meta: [],
  ...(at ? { pin: at } : { mapQuery: `Hotel ${id}` }),
  createdAt: 0,
  updatedAt: 0,
});

const plan = (date: string, placeIds: string[]): DayPlan => ({ id: `d-${date}`, tripId: 't', date, title: 'A day', planItems: [], placeIds });

/* Testville, Dec 1–6. A is the origin, B 1 km north of it, C 3 km north; P is
   named by the plan but has no pin (it opens by its name). The bed is 600 m
   beyond C. */
const A = north(0);
const B = north(1000);
const C = north(3000);
const BED = north(3600);
const town = stop('st-town', '2026-12-01', '2026-12-07', [
  spot('sp-a', 'Alpha Gate', A),
  spot('sp-b', 'Beta Park', B),
  spot('sp-c', 'Gamma Tower', C),
  spot('sp-p', 'Pending Noodles'),
]);

function sources(over: Partial<PlaceSources> = {}): PlaceSources {
  return {
    tripId: 't',
    stops: [town],
    showCards: [],
    bookings: [bed('bed-1', '2026-12-01', '2026-12-07', BED)] as Booking[],
    dayPlans: [plan('2026-12-03', ['sp-a', 'sp-p', 'sp-b', 'sp-a', 'no-such-id', 'sp-c'])],
    dayDefaults: [],
    ...over,
  };
}

describe('a leg · the mode it starts as', () => {
  it('walks when the walk is at most WALK_UP_TO, takes a taxi beyond it', () => {
    expect(defaultMode(1000)).toBe('walk');
    /* 1384 m × 1.3 = 1799.2 m, 1385 m × 1.3 = 1800.5 m: the line is the walk, not the straight line */
    expect(defaultMode(1384)).toBe('walk');
    expect(defaultMode(1385)).toBe('taxi');
    expect(1384 * DETOUR).toBeLessThanOrEqual(WALK_UP_TO);
    expect(1385 * DETOUR).toBeGreaterThan(WALK_UP_TO);
    expect(defaultMode(0)).toBe('walk');
  });

  it('a leg of 1 km straight is a 1.3 km walk; of 2 km straight a taxi of 2.6 km', () => {
    const ab = legBetween('a', A, 'b', B);
    expect(ab.mode).toBe('walk');
    expect(ab.chosen).toBe(false);
    expect(ab.metres).toBeCloseTo(metresBetween(A, B) * DETOUR, 6);
    expect(ab.metres).toBeCloseTo(1300, 0);
    expect(ab.minutes).toBe(Math.round((ab.metres / 1000 / SPEED.walk.kmh) * 60)); // ≈ 17

    const bc = legBetween('b', B, 'c', C);
    expect(bc.mode).toBe('taxi');
    expect(bc.metres).toBeCloseTo(2600, 0);
    expect(bc.minutes).toBe(Math.round((bc.metres / 1000 / SPEED.taxi.kmh) * 60 + SPEED.taxi.extra)); // ≈ 14, hailing included
    expect(legBetween('a', A, 'a', A).minutes).toBe(2); // never "0 min"
  });
});

describe('a leg · what a tap switches it to', () => {
  it('cycles walk → taxi → metro → walk', () => {
    expect(nextMode('walk')).toBe('taxi');
    expect(nextMode('taxi')).toBe('metro');
    expect(nextMode('metro')).toBe('walk');
    expect(LEG_MODES).toEqual(['walk', 'taxi', 'metro']);
    let m: LegMode = 'walk';
    for (let i = 0; i < LEG_MODES.length; i++) m = nextMode(m);
    expect(m).toBe('walk');
  });

  it('a chosen mode wins over the distance, is flagged, and re-times the leg', () => {
    const key = legKey('a', 'b');
    expect(key).toBe('a>b');
    const base = legBetween('a', A, 'b', B);
    let modes: Record<string, LegMode> = {};
    const seen: LegMode[] = [];
    for (let i = 0; i < 3; i++) {
      const leg = legBetween('a', A, 'b', B, modes);
      seen.push(leg.mode);
      modes = { ...modes, [key]: nextMode(leg.mode) };
    }
    expect(seen).toEqual(['walk', 'taxi', 'metro']);

    /* the third tap came back to walk — and that is still the traveller's choice */
    expect(legBetween('a', A, 'b', B, modes)).toMatchObject({ mode: 'walk', chosen: true });

    modes = { [key]: 'metro' };
    const metro = legBetween('a', A, 'b', B, modes);
    expect(metro.mode).toBe('metro');
    expect(metro.chosen).toBe(true);
    expect(metro.metres).toBe(base.metres); // the way is the same, only the speed changes
    expect(metro.minutes).toBe(Math.round((metro.metres / 1000 / SPEED.metro.kmh) * 60 + SPEED.metro.extra));
    expect(legBetween('a', A, 'b', B, { [key]: nextMode(metro.mode) }).mode).toBe('walk');
    /* another leg is not touched by it */
    expect(legBetween('b', B, 'c', C, modes).chosen).toBe(false);
  });

  it('the shared store keeps the choice per leg, and the route follows it', () => {
    legModes.chosen = {};
    const src = sources();
    const first = dayRoute(src, '2026-12-03', undefined, legModes.chosen)!;
    const leg = first.legs[0]!;
    expect(leg.mode).toBe('walk');
    legModes.cycle(leg);
    expect(legModes.chosen).toEqual({ [legKey(leg.fromId, leg.toId)]: 'taxi' });
    const second = dayRoute(src, '2026-12-03', undefined, legModes.chosen)!;
    expect(second.legs[0]).toMatchObject({ mode: 'taxi', chosen: true });
    expect(second.legs[1]!.chosen).toBe(false);
    expect(second.minutes).not.toBe(first.minutes);
    legModes.cycle(second.legs[0]!);
    legModes.cycle(dayRoute(src, '2026-12-03', undefined, legModes.chosen)!.legs[0]!);
    expect(dayRoute(src, '2026-12-03', undefined, legModes.chosen)!.legs[0]!.mode).toBe('walk'); // round again
  });
  afterEach(() => {
    legModes.chosen = {};
  });
});

describe('a day · which places are numbered', () => {
  const route = dayRoute(sources(), '2026-12-03')!;

  it('numbers the places with a pin in the plan’s order, once each, from 1', () => {
    expect(route.stops.map((s) => [s.n, s.id])).toEqual([
      [1, 'sp-a'],
      [2, 'sp-b'],
      [3, 'sp-c'],
    ]);
    expect(route.stops[0]!.pos).toEqual(A);
  });

  it('a place with no pin is kept apart: listed, never numbered, never in a leg', () => {
    expect(route.unplaced.map((p) => p.id)).toEqual(['sp-p']);
    expect(route.unplaced[0]!.pos).toBeUndefined();
    for (const leg of [...route.legs, ...(route.toBed ? [route.toBed] : [])]) {
      expect(leg.fromId).not.toBe('sp-p');
      expect(leg.toId).not.toBe('sp-p');
    }
    /* the legs join the numbered stops across it: Alpha → Beta, Beta → Gamma */
    expect(route.legs.map((l) => `${l.fromId}>${l.toId}`)).toEqual(['sp-a>sp-b', 'sp-b>sp-c']);
  });

  it('an unknown id is dropped, and a day with no pinned place has no route', () => {
    expect(dayRoute(sources({ dayPlans: [plan('2026-12-03', ['sp-p', 'nope'])] }), '2026-12-03')).toBeNull();
    expect(dayRoute(sources({ dayPlans: [] }), '2026-12-03')).toBeNull();
    expect(dayRoute(sources({ dayPlans: [plan('2026-12-03', [])] }), '2026-12-03')).toBeNull();
  });

  it('takes the places it is given (the Map’s list), so the screen builds them once', () => {
    const places = mapPlaces(sources());
    expect(dayRoute(sources(), '2026-12-03', places)).toEqual(route);
  });
});

describe('a day · the totals', () => {
  it('include the leg on to tonight’s bed', () => {
    const route = dayRoute(sources(), '2026-12-03')!;
    expect(route.bed?.id).toBe('bed-1');
    expect(route.toBed).not.toBeNull();
    expect(route.toBed).toMatchObject({ fromId: 'sp-c', toId: 'bed-1', mode: 'walk' }); // 600 m × 1.3 = 780 m
    expect(route.toBed!.metres).toBeCloseTo(metresBetween(C, BED) * DETOUR, 6);

    const legs = route.legs;
    expect(legs).toHaveLength(2);
    expect(route.metres).toBeCloseTo(legs[0]!.metres + legs[1]!.metres + route.toBed!.metres, 6);
    expect(route.minutes).toBe(legs[0]!.minutes + legs[1]!.minutes + route.toBed!.minutes);

    const noBed = dayRoute(sources({ bookings: [] }), '2026-12-03')!;
    expect(noBed.bed).toBeNull();
    expect(noBed.toBed).toBeNull();
    expect(noBed.metres).toBeCloseTo(legs[0]!.metres + legs[1]!.metres, 6);
    expect(route.metres).toBeGreaterThan(noBed.metres);
    expect(route.minutes).toBeGreaterThan(noBed.minutes);
  });

  it('follow a changed mode: the bed leg by metro swaps its minutes into the sum', () => {
    const walk = dayRoute(sources(), '2026-12-03')!;
    const modes = { [legKey('sp-c', 'bed-1')]: 'metro' as const };
    const metro = dayRoute(sources(), '2026-12-03', undefined, modes)!;
    expect(metro.toBed).toMatchObject({ mode: 'metro', chosen: true });
    expect(metro.metres).toBeCloseTo(walk.metres, 6);
    expect(metro.minutes - walk.minutes).toBe(metro.toBed!.minutes - walk.toBed!.minutes);
    expect(metro.minutes).toBeGreaterThan(walk.minutes); // 9 minutes in the station
  });

  it('a bed with no pin, or a bed that is the last stop itself, adds no leg; one stop has no legs', () => {
    const pinless = dayRoute(sources({ bookings: [bed('bed-1', '2026-12-01', '2026-12-07')] }), '2026-12-03')!;
    expect(pinless.toBed).toBeNull();
    const asLast = dayRoute(sources({ dayPlans: [plan('2026-12-03', ['sp-a', 'bed-1'])] }), '2026-12-03')!;
    expect(asLast.stops.map((s) => s.id)).toEqual(['sp-a', 'bed-1']);
    expect(asLast.toBed).toBeNull();
    const one = dayRoute(sources({ bookings: [], dayPlans: [plan('2026-12-03', ['sp-a'])] }), '2026-12-03')!;
    expect(one.legs).toEqual([]);
    expect(one.metres).toBe(0);
    expect(one.minutes).toBe(0);
  });

  it('are written as estimates', () => {
    expect(minutesText(14)).toBe('≈ 14 min');
    expect(minutesText(60)).toBe('≈ 1 h');
    expect(minutesText(70)).toBe('≈ 1 h 10');
    expect(metresText(620)).toBe('600 m');
    expect(metresText(20)).toBe('50 m');
    expect(metresText(1040)).toBe('1.0 km');
    expect(metresText(9360)).toBe('9.4 km');
  });
});

describe('a day · its colour', () => {
  it('is its index among the days of the stay, and wraps after the last colour', () => {
    expect(DAY_COLOURS).toHaveLength(6);
    const src = { stops: [town] };
    expect(dayColour(src, '2026-12-01')).toBe(DAY_COLOURS[0]); // arrival day
    expect(dayColour(src, '2026-12-02')).toBe(DAY_COLOURS[1]);
    expect(dayColour(src, '2026-12-03')).toBe(DAY_COLOURS[2]);
    expect(dayColour(src, '2026-12-06')).toBe(DAY_COLOURS[5]);
    const long = { stops: [stop('st-long', '2026-12-01', '2026-12-20', [])] };
    expect(dayColour(long, '2026-12-07')).toBe(DAY_COLOURS[0]); // day 7 of the stay
    expect(dayColour(long, '2026-12-09')).toBe(DAY_COLOURS[2]);
  });

  it('counts from the start of the stay holding the date, not of the trip', () => {
    const later = stop('st-later', '2026-12-07', '2026-12-12', [], 1);
    const src = { stops: [town, later] };
    expect(dayColour(src, '2026-12-06')).toBe(DAY_COLOURS[5]);
    expect(dayColour(src, '2026-12-07')).toBe(DAY_COLOURS[0]);
    expect(dayColour(src, '2026-12-09')).toBe(DAY_COLOURS[2]);
  });

  it('a date in no stay gets the first colour; the route wears its day’s', () => {
    expect(dayColour({ stops: [town] }, '2027-02-01')).toBe(DAY_COLOURS[0]);
    expect(dayRoute(sources(), '2026-12-03')!.colour).toBe(DAY_COLOURS[2]);
  });

  it('one route per day of the stay that has one — the map’s “All days”', () => {
    const src = sources({ dayPlans: [plan('2026-12-02', ['sp-a', 'sp-b']), plan('2026-12-03', ['sp-b', 'sp-c']), plan('2026-12-04', ['sp-p'])] });
    const all = stayRoutes(src, '2026-12-03');
    expect(all.map((r) => r.date)).toEqual(['2026-12-02', '2026-12-03']);
    expect(all.map((r) => r.colour)).toEqual([DAY_COLOURS[1], DAY_COLOURS[2]]);
    expect(stayRoutes(src, '2027-02-01')).toEqual([]);
  });
});

describe('a leg · too far to estimate', () => {
  it('past FAR_METRES straight it is a train, ferry or flight: no minutes, flagged far', () => {
    const near = legBetween('a', ORIGIN, 'b', north(FAR_METRES - 10));
    const far = legBetween('a', ORIGIN, 'b', north(FAR_METRES + 10));
    expect(near.far).toBe(false);
    expect(near.minutes).toBeGreaterThan(0);
    expect(far.far).toBe(true);
    expect(far.minutes).toBe(0);
  });

  it('prints just under a kilometre as 1.0 km, never "1000 m"', () => {
    expect(metresText(990)).toBe('1.0 km');
    expect(metresText(949)).toBe('950 m');
    expect(metresText(83_400)).toBe('83.4 km');
    expect(metresText(1_542_000)).toBe('1542 km');
  });
});

/* DayView decides where the route stands before the route's chunk has loaded,
   by drawnIds — it must say "a route" on exactly the days dayRoute() returns one. */
describe('a day · does it have a route (DayView’s early answer)', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const seed = JSON.parse(readFileSync(join(here, '..', '..', '..', 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup;
  const t = seed.trips[0] as TripBundle;
  const src: PlaceSources = { tripId: 'cn26', stops: t.stops, showCards: t.showCards, bookings: t.bookings, dayPlans: t.dayPlans, dayDefaults: t.dayDefaults };
  const onMap = drawnIds(src);
  const places = mapPlaces(src);

  it('drawnIds names a route on the same days as dayRoute, every day of the trip', () => {
    let routed = 0;
    let bare = 0;
    for (let ms = Date.parse('2026-11-20T00:00:00Z'); ms <= Date.parse('2027-01-01T00:00:00Z'); ms += 86_400_000) {
      const date = new Date(ms).toISOString().slice(0, 10);
      const ids = resolveDay(date, t.dayPlans, t.dayDefaults, t.stops)?.placeIds ?? [];
      const early = ids.some((id) => onMap.has(id));
      expect(early, date).toBe(dayRoute(src, date, places) !== null);
      if (early) routed++;
      else bare++;
    }
    expect(routed).toBeGreaterThan(15);
    expect(bare).toBeGreaterThan(15);
  });

  it('the same on a small trip: a pinned place, only unpinned places, a place nobody knows', () => {
    const s = sources();
    const onS = drawnIds(s);
    for (const ids of [['sp-a'], ['sp-p'], ['sp-p', 'sp-c'], ['nope'], []]) {
      const own = sources({ dayPlans: [plan('2026-12-03', ids)] });
      expect(ids.some((id) => onS.has(id)), ids.join()).toBe(dayRoute(own, '2026-12-03') !== null);
    }
  });
});
