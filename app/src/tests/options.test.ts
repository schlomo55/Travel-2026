import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  candidatesOf,
  inTheDay,
  kmLabel,
  offeredOf,
  optionBlocksOf,
  parseOption,
  rankCandidates,
  roundKm,
} from '../lib/logic/options';
import { bookingFixedPoints } from '../lib/logic/commitment';
import { freeBlocks } from '../lib/logic/timeline';
import type { Booking, DayPlan, Spot, Stop, TripBundle } from '../lib/model/types';

const seedPath = join(__dirname, '..', '..', '..', 'seed', 'demo-2027.trip.json');
const bundle = (JSON.parse(readFileSync(seedPath, 'utf8')) as { trips: TripBundle[] }).trips[0]!;
const stopOf = (id: string): Stop => bundle.stops.find((s) => s.id === id)!;
const dayOf = (date: string): DayPlan => bundle.dayPlans.find((d) => d.date === date)!;

describe('parseOption — only what the line already says', () => {
  it('lifts the bold head as the name and the rest as the detail', () => {
    const c = parseOption(
      '⭐ **Yuanjiajie on the clearest morning** — the Hallelujah pillar and the First Bridge',
      'blk',
      0,
      '⭐ Our picks',
    );
    expect(c.name).toBe('Yuanjiajie on the clearest morning');
    expect(c.detail).toBe('the Hallelujah pillar and the First Bridge');
    expect(c.star).toBe(true);
    expect(c.id).toBe('blk#0');
  });

  it('records a price only where the line quotes one, verbatim', () => {
    expect(parseOption('**Baofeng Lake** — boat ride, ~¥110', 'b', 0, 'h').cost).toBe('~¥110');
    expect(parseOption('**Tang Shifu**, Wuling Road, ~¥70pp — sanxiaguo', 'b', 0, 'h').cost).toBe(
      '~¥70pp',
    );
    expect(parseOption('**HK Phil** — **HK$260–680**, ~2h15', 'b', 0, 'h').cost).toBe('HK$260–680');
    expect(parseOption('**Golden Whip Stream** — the flat 7 km valley walk', 'b', 0, 'h').cost).toBeNull();
  });

  it('records hours only where the line states a range or a closing time', () => {
    expect(parseOption('**Australia Dairy**, 07:00–22:00', 'b', 0, 'h').hours).toBe('07:00–22:00');
    expect(parseOption('**Xibu Street** — snack lane open till 23:30', 'b', 0, 'h').hours).toBe(
      'open till 23:30',
    );
    /* A LONE CLOCK IS NOT OPENING HOURS. 19:30 is when the concert starts. */
    expect(parseOption('**HK Phil** — 22 & 23 Dec, 19:30, Concert Hall', 'b', 0, 'h').hours).toBeNull();
  });

  it('flags pre-booking only in the words the trip file uses', () => {
    expect(parseOption('**NCPA** — book ahead, popular nights sell out', 'b', 0, 'h').prebook).toBe(true);
    expect(
      parseOption('Dec 24–26 are holidays — **book any sit-down dinner ahead**', 'b', 0, 'h').prebook,
    ).toBe(true);
    expect(parseOption('**Xibu Street** for late food', 'b', 0, 'h').prebook).toBe(false);
  });

  it('carries the (verify) marker across, and never invents one', () => {
    expect(parseOption('**A Tujia evening** *(verify it is running)*', 'b', 0, 'h').verify).toBe(true);
    expect(parseOption('**Golden Whip Stream** — the valley floor', 'b', 0, 'h').verify).toBe(false);
  });

  it('names the wet-weather answers the trip file wrote as such', () => {
    expect(
      parseOption('Fog day, no view at all: **Huanglong Cave** is underground', 'b', 0, 'h').fallback,
    ).toBe(true);
    expect(
      parseOption('**Golden Whip Stream** — the right call when the tops are in cloud', 'b', 0, 'h')
        .fallback,
    ).toBe(true);
    expect(parseOption('**Tianzi Mountain late in the afternoon**', 'b', 0, 'h').fallback).toBe(false);
  });

  it('finds the verified place a line names', () => {
    const spots: Spot[] = [{ id: 'sp1', name: 'Huanglong Cave', kind: 'sight' }];
    expect(parseOption('**Huanglong Cave** — karst', 'b', 0, 'h', spots).spot?.id).toBe('sp1');
    expect(parseOption('**Xibu Street** — snacks', 'b', 0, 'h', spots).spot).toBeNull();
  });
});

describe('the pool, over the demo trip', () => {
  const hs = stopOf('dm27-stop-huangshan');

  it('reads both sources the guide prints under “All the options”', () => {
    expect(optionBlocksOf(hs)).toHaveLength((hs.options?.length ?? 0) + hs.recoBlocks.length);
    /* 3 + 3 + 1 option lines, 3 + 2 + 1 researched ones */
    expect(candidatesOf(hs)).toHaveLength(13);
  });

  it('drops what the day already says it is doing', () => {
    /* Apr 6 walks the West Sea Grand Canyon and ends on Tunxi Old Street —
       both are also researched option lines, and neither may be offered as a
       free-time idea on the day it is already the plan. */
    const items = dayOf('2027-04-06').planItems;
    const pool = candidatesOf(hs);
    const westSea = pool.find((c) => c.name.includes('West Sea Grand Canyon'))!;
    const tunxi = pool.find((c) => c.name.includes('Tunxi Old Street'))!;
    expect(inTheDay(westSea, items, hs.spots ?? [])).toBe(true);
    expect(inTheDay(tunxi, items, hs.spots ?? [])).toBe(true);
    /* …and Hongcun, which Apr 6 never mentions, survives */
    const hongcun = pool.find((c) => c.name.includes('Hongcun'))!;
    expect(inTheDay(hongcun, items, hs.spots ?? [])).toBe(false);
  });

  it('matches across a rewording through the verified spot index', () => {
    /* Mar 29 says "the Bund after dark"; the option line says "The Bund at
       night". Different words, one place. */
    const sh = stopOf('dm27-stop-shanghai');
    const night = candidatesOf(sh).find((c) => c.name === 'The Bund at night')!;
    expect(night.spot?.id).toBe('dm27-spot-shanghai-bund');
    expect(inTheDay(night, dayOf('2027-03-29').planItems, sh.spots ?? [])).toBe(true);
  });
});

describe('rankCandidates', () => {
  /* THE DEMO WRITES NO WET-WEATHER LINE, so the stop is read with one more
     block — the shape the trip file writes them in — for the fallback row. */
  const base = stopOf('dm27-stop-huangshan');
  const hs: Stop = {
    ...base,
    options: [...(base.options ?? []), { id: 'dm27-stop-huangshan-wet', heading: '☔ If the tops are in cloud', items: ['Fog day, no view at all: **Hongcun** water village down in the valley'] }],
  };
  const pool = candidatesOf(hs).filter((c) => !inTheDay(c, dayOf('2027-04-06').planItems, hs.spots ?? []));

  it('caps at four and reports how many the guide still holds', () => {
    const r = rankCandidates(pool, { anchor: hs.coord });
    expect(r.shown).toHaveLength(4);
    expect(r.total).toBeGreaterThan(4);
  });

  it('leads with the trip’s own stars', () => {
    const r = rankCandidates(pool, { anchor: hs.coord });
    expect(r.shown[0]?.star).toBe(true);
  });

  it('lifts the wet-weather line out into its own row', () => {
    const r = rankCandidates(pool, { anchor: hs.coord });
    expect(r.fallback).not.toBeNull();
    expect(r.fallback?.fallback).toBe(true);
    expect(r.fallback?.blockId).toBe('dm27-stop-huangshan-wet');
    /* and it is not ALSO one of the four ordinary offers */
    expect(r.shown.some((c) => c.id === r.fallback?.id)).toBe(false);
    /* without that block the demo offers no fallback, and none is invented */
    const plain = candidatesOf(base).filter((c) => !inTheDay(c, dayOf('2027-04-06').planItems, base.spots ?? []));
    expect(rankCandidates(plain, { anchor: base.coord }).fallback).toBeNull();
  });

  it('measures a straight line only where both ends carry a coordinate', () => {
    const r = rankCandidates(pool, { anchor: hs.coord });
    for (const c of r.shown) {
      if (!c.spot?.coord) expect(c.km).toBeNull();
      else expect(c.km).toBeGreaterThanOrEqual(0);
    }
    /* with no anchor there is no distance anywhere, however many coords exist */
    expect(rankCandidates(pool, {}).shown.every((c) => c.km === null)).toBe(true);
  });

  it('never caps a picked line out of reach', () => {
    /* the LAST line in written order — it would never survive a cap of four */
    const last = pool[pool.length - 1]!;
    const r = rankCandidates(pool, { anchor: hs.coord, pickedIds: new Map([[last.id, 'pick-1']]) });
    const row = r.shown.find((c) => c.id === last.id);
    expect(row).toBeDefined();
    expect(row?.picked).toBe(true);
    expect(row?.pickId).toBe('pick-1');
    /* and it leads, because it is the one row that can be un-picked */
    expect(r.shown[0]?.id).toBe(last.id);
  });

  it('rounds a straight line to one decimal and labels it as one', () => {
    expect(roundKm(2.34)).toBe(2.3);
    expect(kmLabel(2.3)).toBe('2.3 km');
  });

  /* NOT ONE SPOT IN THE DEMO TRIP CARRIES A COORDINATE. Every place is named
     and ships `mapQuery` instead (docs/ARCHITECTURE §9a: "a name beats a
     coordinate"), so on the trip's data the distance line is silent
     everywhere — which IS the rule working. The arithmetic therefore has to
     be proven against spots that do carry them, or the whole straight-line
     path would ride on a vacuous assertion. */
  it('measures and orders by the straight line when the coordinates exist', () => {
    const near: Spot = { id: 'near', name: 'Nearby Hall', kind: 'sight', coord: { lat: 30.135, lng: 118.168 } };
    const far: Spot = { id: 'far', name: 'Distant Cave', kind: 'sight', coord: { lat: 29.71, lng: 118.32 } };
    const anchor = { lat: 30.1333, lng: 118.1667 };
    const pool = [
      parseOption('**Distant Cave** — underground', 'b', 0, 'h', [near, far]),
      parseOption('**Nearby Hall** — five minutes off the square', 'b', 1, 'h', [near, far]),
    ];
    const r = rankCandidates(pool, { anchor });
    expect(r.shown[0]?.name).toBe('Nearby Hall');
    expect(r.shown[0]?.km).toBeCloseTo(0.2, 1);
    expect(r.shown[1]?.km).toBeGreaterThan(40);
    /* the same pool with no anchor states no distance at all */
    expect(rankCandidates(pool, {}).shown.every((c) => c.km === null)).toBe(true);
  });
});

describe('a real free afternoon, end to end', () => {
  it('Apr 16 — the Peak day, with a booked concert at 19:30', () => {
    const bookings = bundle.bookings as Booking[];
    const blocks = freeBlocks(bookingFixedPoints(bookings, '2027-04-16'));
    /* one block, running up to the concert ticket and stopping there */
    expect(blocks.map((b) => b.span)).toEqual(['08:00–19:30']);
    expect(blocks[0]?.duration).toBe('11 h 30 m');

    const hk = stopOf('dm27-stop-hongkong');
    const pool = candidatesOf(hk).filter(
      (c) => !inTheDay(c, dayOf('2027-04-16').planItems, hk.spots ?? []),
    );
    const r = rankCandidates(pool, { anchor: hk.coord });
    expect(r.shown.length).toBeGreaterThan(1);
    expect(r.shown.length).toBeLessThanOrEqual(4);
  });

  it('Apr 5 — Huangshan on foot, no clock on any booking, so the day is one open block', () => {
    /* the park pass is that day's one booking, and it names no time */
    const bookings = bundle.bookings as Booking[];
    expect(bookings.some((b) => b.date === '2027-04-05' && b.kind === 'activity')).toBe(true);
    const blocks = freeBlocks(bookingFixedPoints(bookings, '2027-04-05'));
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.after).toBeNull();
    expect(blocks[0]?.span).toBe('08:00–22:00');
  });
});

describe('options · the facts a row prints', () => {
  it('prints only what the line recorded, and the straight line says it is one', async () => {
    const { candidateFacts, parseOption } = await import('../lib/logic/options');
    const c = { ...parseOption('⭐ **Tianzi Mountain** — ~¥70pp, 07:00–18:00, book ahead (verify)', 'b', 0, 'h'), km: 2.3, picked: false, pickId: null };
    expect(candidateFacts(c, 'the gate')).toEqual([
      { t: '~¥70pp', cls: 'num' },
      { t: 'hours 07:00–18:00', cls: 'num' },
      { t: 'book ahead', cls: 'pre' },
      { t: 'verify', cls: 'verify' },
      { t: '≈ 2.3 km from the gate', cls: '' },
    ]);
    const bare = { ...parseOption('A walk by the river', 'b', 1, 'h'), km: null, picked: false, pickId: null };
    expect(candidateFacts(bare, 'x')).toEqual([]);
  });
});

/* THE DAY'S OFFERS (Map 5d) — one rule for the day screen's free blocks and
   the Map tab's "Add to my day". The review found the Map asking a place's
   OWN stop instead: it offered every city's places on any day (a pick made
   there with another stop's stopId then showed under the wrong city's
   "Planned"), the places the day already has a second time, and on a travel
   day a pick the day screen never offers. */
describe('the day’s offers · the day screen and the Map tab read one rule', async () => {
  const { dayOffers, offerFor } = await import('../lib/logic/options');
  const { currentStop, resolveDay } = await import('../lib/logic/day');
  const { isTravelDay } = await import('../lib/logic/metroline');
  const { tripPhase } = await import('../lib/logic/phase');
  const { mapPlaces } = await import('../lib/logic/mapplaces');
  const trip = { start: '2027-03-19', end: '2027-04-18' };
  const offersOn = (date: string, picked: Set<string> = new Set()) => {
    const day = resolveDay(date, bundle.dayPlans, bundle.dayDefaults, bundle.stops);
    return dayOffers({
      during: tripPhase(trip, date) === 'during',
      travel: isTravelDay(day?.runbookId, bundle.bookings as Booking[], date),
      day,
      stop: currentStop(bundle.stops, date),
      picked,
    });
  };
  const places = mapPlaces({ tripId: 'dm27', stops: bundle.stops, showCards: bundle.showCards, bookings: bundle.bookings as Booking[], dayPlans: bundle.dayPlans, dayDefaults: bundle.dayDefaults });
  const offered = (date: string) => {
    const o = offersOn(date);
    return places.filter((p) => offerFor(o, { spotId: p.spot?.id, stopId: p.stopId }));
  };

  it('Apr 5: only Huangshan’s own lines, never one the day already has — 4 places, none of the 31 elsewhere', () => {
    const o = offersOn('2027-04-05')!;
    expect(o.stop.id).toBe('dm27-stop-huangshan');
    const list = offered('2027-04-05');
    /* the spots a Huangshan line names — West Sea, Welcome Pine, Tunxi Old
       Street, Hongcun — less Shixin Peak, which the day climbs */
    expect(list).toHaveLength(4);
    expect(list.every((p) => p.stopId === 'dm27-stop-huangshan')).toBe(true);
    const ids = list.map((p) => p.id);
    expect(ids).toContain('dm27-spot-huangshan-hongcun');
    /* already in the day */
    expect(ids).not.toContain('dm27-spot-huangshan-shixin');
    /* Chengdu's pandas are Chengdu's line — the old rule offered them on Apr 5 */
    expect(ids).not.toContain('dm27-spot-chengdu-pandas');
    expect(offerFor(o, { spotId: 'dm27-spot-chengdu-pandas', stopId: 'dm27-stop-chengdu' })).toBeNull();
    /* the rule the Map tab had — a place's own stop, no day, no travel test:
       every spot some line of its own stop names (6 Hangzhou, 6 Shanghai,
       5 Huangshan, 5 Chengdu, 5 Yangshuo, 2 Longji, 2 Guilin, 5 Hong Kong) */
    const oldRule = places.filter((p) => p.spot && p.stopId && candidatesOf(stopOf(p.stopId)).some((c) => c.spot?.id === p.spot!.id));
    expect(oldRule).toHaveLength(36);
    expect(oldRule.filter((p) => p.stopId !== 'dm27-stop-huangshan')).toHaveLength(31);
    expect(oldRule.map((p) => p.id)).toEqual(expect.arrayContaining(['dm27-spot-huangshan-shixin', 'dm27-spot-chengdu-pandas']));
  });

  it('the same pool the day screen ranks: DayView’s rule, not a copy of it', () => {
    const o = offersOn('2027-04-05')!;
    const stop = stopOf('dm27-stop-huangshan');
    /* only the lines a free block may offer (offeredOf, QA 7 Nov 2026) */
    const direct = offeredOf(stop).filter((c) => !inTheDay(c, dayOf('2027-04-05').planItems, stop.spots ?? []));
    expect(o.pool.map((c) => c.id)).toEqual(direct.map((c) => c.id));
  });

  it('a travel day offers nothing (Apr 4, Suzhou → Huangshan), nor a day before or after the trip', () => {
    expect(isTravelDay(resolveDay('2027-04-04', bundle.dayPlans, bundle.dayDefaults, bundle.stops)?.runbookId, bundle.bookings as Booking[], '2027-04-04')).toBe(true);
    expect(offersOn('2027-04-04')).toBeNull();
    expect(offered('2027-04-04')).toHaveLength(0);
    expect(offersOn('2027-03-01')).toBeNull();
    expect(offersOn('2027-05-10')).toBeNull();
  });

  it('a line you picked stays on offer, so it can be taken back out — even one the day names', () => {
    const stop = stopOf('dm27-stop-huangshan');
    const inDay = candidatesOf(stop).find((c) => inTheDay(c, dayOf('2027-04-05').planItems, stop.spots ?? []))!;
    expect(offersOn('2027-04-05')!.pool.some((c) => c.id === inDay.id)).toBe(false);
    expect(offersOn('2027-04-05', new Set([inDay.id]))!.pool.some((c) => c.id === inDay.id)).toBe(true);
  });
});
