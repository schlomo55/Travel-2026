/* A DAY ON THE MAP (demo, lib/logic/maproute.ts) — on the real China seed:
   which day's route the Map tab draws for each choice (today, a day, every
   day of the stay, none), the day chips and which is pressed, and the route
   as the street map draws it: its line, the dotted leg to tonight's bed, the
   numbered stops (the chosen one ringed), what the camera frames. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AppBackup, ISODate, TripBundle } from '../lib/model/types';
import { mapPlaces } from '../lib/logic/mapplaces';
import { DAY_COLOURS, legKey, type LegMode } from '../lib/logic/dayroute';
import {
  chipSel,
  dayChips,
  mapRoutes,
  routeDraws,
  routeFit,
  routeIds,
  routeTotals,
  selDate,
  travelDay,
} from '../lib/logic/maproute';
import { parseRoutePinName, routeLineData, routePinName, routeStopData } from '../lib/map/street/routes';

const here = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(here, '..', '..', '..', 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup;
const t = seed.trips[0] as TripBundle;
const src = { tripId: 'cn26', stops: t.stops, showCards: t.showCards, bookings: t.bookings, dayPlans: t.dayPlans, dayDefaults: t.dayDefaults };
const places = mapPlaces(src);
const HK: ISODate = '2026-12-23';
const dates = (rs: { date: ISODate }[]) => rs.map((r) => r.date);

describe('the day on the map · which routes', () => {
  it('null is today: the day of `now`, the chips the days of its stay that have a route', () => {
    const r = mapRoutes(src, places, null, HK);
    expect(r.anchor).toBe(HK);
    expect(dates(r.shown)).toEqual([HK]);
    expect(dates(r.days)).toEqual(['2026-12-21', '2026-12-22', '2026-12-23', '2026-12-24', '2026-12-25']);
    expect(r.shown[0]!.stops.map((s) => s.n)).toEqual([1, 2, 3, 4, 5]);
  });

  it('"All days" draws every day spent in the stay, each in its own colour and numbered from 1', () => {
    const r = mapRoutes(src, places, 'all', HK);
    expect(r.shown).toBe(r.every);
    /* not the day it arrives from Kunming: that plan starts at KMG, 1,500 km away — no walk, no taxi */
    expect(dates(r.shown)).toEqual(['2026-12-22', '2026-12-23', '2026-12-24', '2026-12-25']);
    expect(travelDay(src, '2026-12-21')).toBe(true);
    expect(travelDay(src, HK)).toBe(false);
    expect(new Set(r.shown.map((d) => d.colour)).size).toBe(r.shown.length);
    for (const d of r.shown) {
      expect(DAY_COLOURS).toContain(d.colour);
      expect(d.stops[0]!.n).toBe(1);
    }
  });

  it('"Off" draws nothing, and keeps the chips', () => {
    const r = mapRoutes(src, places, 'off', HK);
    expect(r.shown).toEqual([]);
    expect(r.days.length).toBe(5);
  });

  it('a chosen day anchors the chips on its own stay — and "All days" after it stays there', () => {
    const cq = mapRoutes(src, places, '2026-12-15', HK);
    expect(cq.anchor).toBe('2026-12-15');
    expect(dates(cq.shown)).toEqual(['2026-12-15']);
    expect(cq.shown[0]!.stops).toHaveLength(5);
    expect(dates(cq.days)).toEqual(['2026-12-14', '2026-12-15']);
    /* (the 14th, the day it comes from Zhangjiajie, is a chip of its own, not one of "All days") */
    expect(dates(mapRoutes(src, places, 'all', HK, '2026-12-15').shown)).toEqual(['2026-12-15']);
    /* today again: the last day chosen no longer counts */
    expect(mapRoutes(src, places, null, HK, '2026-12-15').anchor).toBe(HK);
  });

  it('before the trip: no chips, nothing drawn — the map as it was', () => {
    const r = mapRoutes(src, places, null, '2026-10-17');
    expect(r.days).toEqual([]);
    expect(r.shown).toEqual([]);
  });

  it('the traveller’s leg modes change the estimate, not the stops', () => {
    const a = mapRoutes(src, places, null, HK).shown[0]!;
    const leg = a.legs[0]!;
    const modes: Record<string, LegMode> = { [legKey(leg.fromId, leg.toId)]: leg.mode === 'metro' ? 'walk' : 'metro' };
    const b = mapRoutes(src, places, null, HK, null, modes).shown[0]!;
    expect(b.legs[0]!.mode).not.toBe(leg.mode);
    expect(b.minutes).not.toBe(a.minutes);
    expect(b.stops.map((s) => s.id)).toEqual(a.stops.map((s) => s.id));
  });
});

describe('the day chips', () => {
  it('today’s chip is pressed and says so; a tap on it follows the clock (null)', () => {
    const r = mapRoutes(src, places, null, HK);
    const c = dayChips(r, null, HK);
    expect(c.days.filter((d) => d.on).map((d) => d.date)).toEqual([HK]);
    expect(c.days.find((d) => d.today)?.date).toBe(HK);
    expect(c.all).toBe(false);
    expect(c.off).toBe(false);
    expect(chipSel(HK, HK)).toBeNull();
    expect(chipSel('2026-12-24', HK)).toBe('2026-12-24');
  });

  it('"All days" presses only All; "Off" only Off; a day with no route of its own leaves Off pressed', () => {
    const all = dayChips(mapRoutes(src, places, 'all', HK), 'all', HK);
    expect(all.days.some((d) => d.on)).toBe(false);
    expect([all.all, all.off]).toEqual([true, false]);
    const off = dayChips(mapRoutes(src, places, 'off', HK), 'off', HK);
    expect(off.days.some((d) => d.on)).toBe(false);
    expect([off.all, off.off]).toEqual([false, true]);
    expect(dayChips({ anchor: HK, days: [], every: [], shown: [] }, null, HK).off).toBe(true);
  });

  it('selDate names a day only for a date', () => {
    expect(selDate(null)).toBeNull();
    expect(selDate('all')).toBeNull();
    expect(selDate('off')).toBeNull();
    expect(selDate(HK)).toBe(HK);
  });
});

describe('the route as the street map draws it', () => {
  const day = mapRoutes(src, places, null, HK).shown;
  const draws = routeDraws(day);

  it('a stop is drawn where its place is drawn, under its pin’s own label, never anywhere else', () => {
    const d = draws[0]!;
    expect(d.colour).toBe(day[0]!.colour);
    for (const [i, s] of d.stops.entries()) {
      const st = day[0]!.stops[i]!;
      expect([s.id, s.n, s.lng, s.lat, s.label, s.cat]).toEqual([st.id, st.n, st.place.pos!.lng, st.place.pos!.lat, st.place.label, st.place.category]);
    }
    expect(d.bed).toEqual({ lng: day[0]!.bed!.pos!.lng, lat: day[0]!.bed!.pos!.lat });
    expect(routeIds(draws)).toEqual(new Set(d.stops.map((s) => s.id)));
  });

  it('the line runs through the stops in order, solid, then dotted on to the bed', () => {
    const fc = routeLineData(draws);
    expect(fc.features.map((f) => f.properties.k)).toEqual(['path', 'bed']);
    const [path, bed] = fc.features;
    expect(path!.geometry.coordinates).toEqual(draws[0]!.stops.map((s) => [s.lng, s.lat]));
    expect(bed!.geometry.coordinates).toEqual([path!.geometry.coordinates.at(-1), [draws[0]!.bed!.lng, draws[0]!.bed!.lat]]);
    for (const f of fc.features) expect(f.properties.c).toBe(draws[0]!.colour);
  });

  it('one stop and no bed: no line at all', () => {
    expect(routeLineData([{ colour: '#ff9f6b', stops: [{ id: 'a', n: 1, lng: 1, lat: 2, label: 'A', cat: 'sight' }], bed: null }]).features).toEqual([]);
  });

  it('the numbered pins: the day’s colour and number, the chosen one ringed and on top', () => {
    const chosen = draws[0]!.stops[2]!.id;
    const fc = routeStopData(draws, chosen);
    expect(fc.features).toHaveLength(5);
    for (const f of fc.features) {
      const sel = f.properties.id === chosen;
      expect(f.properties.img).toBe(routePinName(draws[0]!.colour, f.properties.n, sel));
      expect(f.properties.k).toBe(sel ? 1000 : f.properties.n);
      expect(f.properties.v).toBe('');
    }
  });

  it('a pin’s image name goes there and back; anything else is not one', () => {
    expect(routePinName('#B8A9FF', 3, false)).toBe('rt-b8a9ff-3');
    expect(routePinName('#b8a9ff', 12, true)).toBe('rt-b8a9ff-12-s');
    expect(parseRoutePinName('rt-b8a9ff-12-s')).toEqual({ colour: '#b8a9ff', n: 12, selected: true });
    expect(parseRoutePinName('rt-b8a9ff-3')).toEqual({ colour: '#b8a9ff', n: 3, selected: false });
    for (const no of ['pin-food', 'cl-food-3', 'rt-b8a9f-3', 'rt-b8a9ff-', 'ph-x']) expect(parseRoutePinName(no), no).toBeNull();
  });

  it('the camera frames the stops and tonight’s bed', () => {
    const pts = routeFit(draws);
    expect(pts).toHaveLength(6);
    expect(pts.at(-1)).toEqual([draws[0]!.bed!.lng, draws[0]!.bed!.lat]);
    expect(routeFit([])).toEqual([]);
  });

  it('the totals are the routes’ own sums', () => {
    const all = mapRoutes(src, places, 'all', HK).shown;
    const tot = routeTotals(all);
    expect(tot.stops).toBe(all.reduce((a, r) => a + r.stops.length, 0));
    expect(tot.metres).toBeCloseTo(all.reduce((a, r) => a + r.metres, 0));
    expect(tot.minutes).toBe(all.reduce((a, r) => a + r.minutes, 0));
    expect(tot.legs).toBe(all.reduce((a, r) => a + r.legs.length + (r.toBed ? 1 : 0), 0));
    expect(routeTotals([])).toEqual({ stops: 0, metres: 0, minutes: 0, legs: 0 });
  });
});
