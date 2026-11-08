/* A DAY ON THE MAP (demo, lib/logic/maproute.ts) — on the demo trip seed:
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
  groupStops,
  stopsWith,
  STOP_PIN_PX,
  MIN_ROUTE_STOPS,
} from '../lib/logic/maproute';
import { parseRoutePinName, routeLineData, routePinName, routeStopData } from '../lib/map/street/routes';
import { fitView } from '../lib/map/street/view';

const here = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(here, '..', '..', '..', 'seed', 'demo-2027.trip.json'), 'utf8')) as AppBackup;
const t = seed.trips[0] as TripBundle;
const src = { tripId: 'dm27', stops: t.stops, showCards: t.showCards, bookings: t.bookings, dayPlans: t.dayPlans, dayDefaults: t.dayDefaults };
const places = mapPlaces(src);
/* Fri 16 Apr in Hong Kong: the Peak, Tai Kwun, the roast goose, the Star
   Ferry, the concert — five stops, and the Harbour Hotel for the night */
const HK: ISODate = '2027-04-16';
/* Thu 8 Apr in Chengdu: pandas, Wenshu, the teahouse, Kuanzhai (optional),
   the opera; the day before it flies in from Tunxi */
const CD: ISODate = '2027-04-08';
const CD_IN: ISODate = '2027-04-07';
const HK_DAYS = ['2027-04-14', '2027-04-15', '2027-04-16'];
const dates = (rs: { date: ISODate }[]) => rs.map((r) => r.date);

describe('the day on the map · which routes', () => {
  it('null is today: the day of `now`, the chips the days of its stay that have a route', () => {
    const r = mapRoutes(src, places, null, HK);
    expect(r.anchor).toBe(HK);
    expect(dates(r.shown)).toEqual([HK]);
    /* not the 13th, the day it arrives from Guilin, nor the 17th, the day it
       flies home (travel days, and not today): no chip */
    expect(dates(r.days)).toEqual(HK_DAYS);
    expect(r.shown[0]!.stops.map((s) => s.n)).toEqual([1, 2, 3, 4, 5]);
  });

  it('"All days" draws every day spent in the stay — the days with a chip — each in its own colour, numbered from 1', () => {
    const r = mapRoutes(src, places, 'all', HK);
    expect(r.shown).toBe(r.days);
    /* not the day it arrives from Guilin: that plan pins KWL, 500 km away — no walk, no taxi */
    expect(dates(r.shown)).toEqual(HK_DAYS);
    expect(travelDay(src, '2027-04-13')).toBe(true);
    expect(travelDay(src, HK)).toBe(false);
    expect(new Set(r.shown.map((d) => d.colour)).size).toBe(r.shown.length);
    for (const d of r.shown) {
      expect(DAY_COLOURS).toContain(d.colour);
      expect(d.stops[0]!.n).toBe(1);
    }
  });

  it('"No route" draws nothing, and keeps the chips', () => {
    const r = mapRoutes(src, places, 'off', HK);
    expect(r.shown).toEqual([]);
    expect(r.days.length).toBe(3);
  });

  /* B2: the chips once named two days while "All days" drew one. Now "All days" draws exactly the days that have
     a chip — and a travel day has one only when it is today, the day chosen or the last day chosen, so it is
     never a chip that "All days" leaves out. */
  it('"All days" draws exactly the days with a chip — a travel day only when it is today or chosen', () => {
    const cd = mapRoutes(src, places, CD, HK);
    expect(dates(cd.days)).toEqual([CD]);
    const all = mapRoutes(src, places, 'all', HK, CD);
    expect(dates(all.shown)).toEqual(dates(all.days));
    expect(dates(all.days)).toEqual([CD]);
    /* the 7th chosen (it comes from Tunxi): its chip, and "All days" after it draws both chips' days */
    expect(dates(mapRoutes(src, places, CD_IN, HK).days)).toEqual([CD_IN, CD]);
    const both = mapRoutes(src, places, 'all', HK, CD_IN);
    expect(dates(both.shown)).toEqual([CD_IN, CD]);
    expect(both.shown).toBe(both.days);
    /* today a travel day (the 7th, from Tunxi): its chip, and in "All days" */
    expect(dates(mapRoutes(src, places, 'all', CD_IN).shown)).toEqual([CD_IN, CD]);
    /* the 13th pins Guilin's airport alone: not a route at all (two stops or more), so no chip even today */
    expect(dates(mapRoutes(src, places, 'all', '2027-04-13').days)).toEqual(HK_DAYS);
  });

  it('a chosen day anchors the chips on its own stay — and "All days" after it stays there', () => {
    const cd = mapRoutes(src, places, CD, HK);
    expect(cd.anchor).toBe(CD);
    expect(dates(cd.shown)).toEqual([CD]);
    expect(cd.shown[0]!.stops).toHaveLength(5);
    expect(dates(cd.days)).toEqual([CD]);
    expect(dates(mapRoutes(src, places, 'all', HK, CD).shown)).toEqual([CD]);
    /* today again: the last day chosen no longer counts */
    expect(mapRoutes(src, places, null, HK, CD).anchor).toBe(HK);
  });

  it('before the trip: no chips, nothing drawn — the map as it was', () => {
    const r = mapRoutes(src, places, null, '2027-03-01');
    expect(r.days).toEqual([]);
    expect(r.shown).toEqual([]);
  });

  it('the traveller’s leg modes change the estimate, not the stops', () => {
    const a = mapRoutes(src, places, null, HK).shown[0]!;
    /* a leg that may go more than one way (a hike's trail legs walk only — QA 7 Nov 2026) */
    const i = a.legs.findIndex((l) => l.modes?.length !== 1);
    const leg = a.legs[i]!;
    const modes: Record<string, LegMode> = { [legKey(leg.fromId, leg.toId)]: leg.mode === 'taxi' ? 'walk' : 'taxi' };
    const b = mapRoutes(src, places, null, HK, null, modes).shown[0]!;
    expect(b.legs[i]!.mode).not.toBe(leg.mode);
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
    expect(chipSel('2027-04-15', HK)).toBe('2027-04-15');
  });

  it('"All days" presses only All; "No route" only No route; a day with no route of its own leaves No route pressed', () => {
    const all = dayChips(mapRoutes(src, places, 'all', HK), 'all', HK);
    expect(all.days.some((d) => d.on)).toBe(false);
    expect([all.all, all.off]).toEqual([true, false]);
    const off = dayChips(mapRoutes(src, places, 'off', HK), 'off', HK);
    expect(off.days.some((d) => d.on)).toBe(false);
    expect([off.all, off.off]).toEqual([false, true]);
    expect(dayChips({ anchor: HK, days: [], shown: [] }, null, HK).off).toBe(true);
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
    const fc = routeStopData(groupStops(draws, 17), chosen);
    expect(fc.features).toHaveLength(5);
    for (const f of fc.features) {
      const sel = f.properties.id === chosen;
      expect(f.properties.img).toBe(routePinName(draws[0]!.colour, String(f.properties.n), sel));
      expect(f.properties.k).toBe(sel ? 1000 : f.properties.n);
      expect(f.properties.v).toBe('');
    }
  });

  it('a pin’s image name goes there and back; anything else is not one', () => {
    expect(routePinName('#B8A9FF', '3', false)).toBe('rt-b8a9ff-3');
    expect(routePinName('#b8a9ff', '12', true)).toBe('rt-b8a9ff-12-s');
    expect(routePinName('#b8a9ff', '1·5', true, true)).toBe('rt-b8a9ff-1·5-o-s');
    expect(parseRoutePinName('rt-b8a9ff-12-s')).toEqual({ colour: '#b8a9ff', text: '12', optional: false, selected: true });
    expect(parseRoutePinName('rt-b8a9ff-3')).toEqual({ colour: '#b8a9ff', text: '3', optional: false, selected: false });
    expect(parseRoutePinName('rt-b8a9ff-1·5-o')).toEqual({ colour: '#b8a9ff', text: '1·5', optional: true, selected: false });
    for (const no of ['pin-food', 'cl-food-3', 'rt-b8a9f-3', 'rt-b8a9ff-', 'rt-b8a9ff-1·', 'ph-x']) expect(parseRoutePinName(no), no).toBeNull();
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

/* B1: pins at the framed zoom lay exactly under one another, and the map showed only some of them. Stops whose
   pins would overlap on screen at the map's zoom share one badge, "2·3", which a tap opens at its first stop and
   whose rows the day list lights together; zoomed in, apart. On the demo's Hong Kong day, Tai Kwun lies a
   street from the roast goose and the Star Ferry pier a few hundred metres from the Cultural Centre. */
describe('stops that would lie on one another', () => {
  const hk = routeDraws(mapRoutes(src, places, HK, HK).shown);
  const framed = fitView(routeFit(hk), 375 - 16 - 72, 812 - 160 - 330, 15.5, [36, 30])!.zoom;

  it('at the framed zoom, 2 with 3 and 4 with 5 — one badge each, none hidden', () => {
    const g = groupStops(hk, framed);
    expect(g.map((x) => x.text)).toEqual(['1', '2·3', '4·5']);
    expect(g.flatMap((x) => x.stops.map((s) => s.n)).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(g[1]!.stops[0]!.n).toBe(2); // a tap opens the first
    expect(g.every((x) => x.colour === hk[0]!.colour)).toBe(true);
  });

  it('zoomed in, every stop its own pin again; zoomed far out, one badge', () => {
    expect(groupStops(hk, 14).map((x) => x.text)).toEqual(['1', '2', '3', '4', '5']);
    expect(groupStops(hk, 5).map((x) => x.text)).toEqual(['1·2·3·4·5']);
  });

  it('pins closer than a pin’s width group; farther, they do not', () => {
    const at = (lng: number) => ({ id: String(lng), n: 1, lng, lat: 0, label: '', cat: 'sight' as const });
    const z = 10;
    const px = 360 / (512 * 2 ** z); // degrees of longitude per screen pixel at the equator
    const two = (d: number) => groupStops([{ colour: '#ff9f6b', stops: [at(0), { ...at(d * px), n: 2 }], bed: null }], z).length;
    expect(two(STOP_PIN_PX - 1)).toBe(1);
    expect(two(STOP_PIN_PX + 1)).toBe(2);
  });

  it('the day list lights every stop a tapped badge stood for, and a lone pin alone', () => {
    const one = hk[0]!.stops[0]!.id;
    const two = hk[0]!.stops[1]!.id;
    const three = hk[0]!.stops[2]!.id;
    expect(stopsWith(hk, framed, two)).toEqual([two, three]);
    expect(stopsWith(hk, framed, three)).toEqual([two, three]);
    expect(stopsWith(hk, framed, one)).toEqual([one]);
    expect(stopsWith(hk, 14, two)).toEqual([two]);
  });

  it('one feature per badge, at its first stop, chosen if any stop in it is', () => {
    const fc = routeStopData(groupStops(hk, framed), hk[0]!.stops[2]!.id);
    expect(fc.features.map((f) => f.properties.img)).toEqual([
      routePinName(hk[0]!.colour, '1', false),
      routePinName(hk[0]!.colour, '2·3', true),
      routePinName(hk[0]!.colour, '4·5', false),
    ]);
    expect(fc.features[1]!.geometry.coordinates).toEqual([hk[0]!.stops[1]!.lng, hk[0]!.stops[1]!.lat]);
  });
});

/* B5: a route is two pinned stops or more — a one-place day keeps its place's own pin, gets no chip; and a stop the
   plan calls optional (dayroute.ts) is drawn quieter: its badge `-o`, its legs dashed apart from the solid path. */
describe('a route is two stops or more; an optional stop is drawn quieter', () => {
  it('a day that pins one place has no route and no chip (Hangzhou, 27 Mar: Hefang Street alone)', () => {
    const hz = mapRoutes(src, places, null, '2027-03-27');
    expect(hz.shown).toEqual([]);
    expect(hz.days.every((d) => d.stops.length >= MIN_ROUTE_STOPS)).toBe(true);
    expect(dates(hz.days)).not.toContain('2027-03-27');
    expect(dayChips(hz, null, '2027-03-27').off).toBe(true);
  });

  it('Chengdu, 8 Apr: Kuanzhai Alley is optional — its badge quieter, its two legs dashed, the rest one solid line', () => {
    const cd = routeDraws(mapRoutes(src, places, CD, HK).shown);
    expect(cd[0]!.stops.filter((s) => s.optional).map((s) => s.n)).toEqual([4]);
    const fc = routeLineData(cd);
    expect(fc.features.map((f) => f.properties.k)).toEqual(['path', 'opt', 'opt', 'bed']);
    expect(fc.features[0]!.geometry.coordinates).toHaveLength(3); // 1 → 2 → 3, solid
    expect(fc.features.at(-1)!.properties.o).toBe(0); // the bed leg leaves stop 5, not the optional 4
    const badges = routeStopData(groupStops(cd, 14), null).features.map((f) => f.properties.img);
    expect(badges[3]).toBe(routePinName(cd[0]!.colour, '4', false, true));
    expect(badges.filter((b) => b.includes('-o'))).toHaveLength(1);
  });
});
