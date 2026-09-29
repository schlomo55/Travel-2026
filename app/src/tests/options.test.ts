import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  candidatesOf,
  inTheDay,
  kmLabel,
  optionBlocksOf,
  parseOption,
  rankCandidates,
  roundKm,
} from '../lib/logic/options';
import { bookingFixedPoints } from '../lib/logic/commitment';
import { freeBlocks } from '../lib/logic/timeline';
import type { Booking, DayPlan, Spot, Stop, TripBundle } from '../lib/model/types';

const seedPath = join(__dirname, '..', '..', '..', 'seed', 'china-2026.trip.json');
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

describe('the pool, over the real trip', () => {
  const zj = stopOf('cn26-stop-zhangjiajie');

  it('reads both sources the guide prints under “All the options”', () => {
    expect(optionBlocksOf(zj)).toHaveLength((zj.options?.length ?? 0) + zj.recoBlocks.length);
    expect(candidatesOf(zj).length).toBeGreaterThan(15);
  });

  it('drops what the day already says it is doing', () => {
    /* Dec 12 walks Golden Whip Stream and eats at Tang Shifu — both are also
       researched option lines, and neither may be offered as a free-time idea
       on the day it is already the plan. */
    const items = dayOf('2026-12-12').planItems;
    const pool = candidatesOf(zj);
    const gws = pool.find((c) => c.name.includes('Golden Whip Stream'))!;
    const tang = pool.find((c) => c.name.includes('Tang Shifu'))!;
    expect(inTheDay(gws, items, zj.spots ?? [])).toBe(true);
    expect(inTheDay(tang, items, zj.spots ?? [])).toBe(true);
    /* …and Huanglong Cave, which Dec 12 never mentions, survives */
    const cave = pool.find((c) => c.name.includes('Huanglong Cave'))!;
    expect(inTheDay(cave, items, zj.spots ?? [])).toBe(false);
  });

  it('matches across a rewording through the verified spot index', () => {
    /* Dec 13 says "Tianzi Mountain viewpoints"; the option line says "Tianzi
       Mountain late in the afternoon". Different words, one place. */
    const pool = candidatesOf(zj);
    const tianzi = pool.find((c) => c.name.startsWith('Tianzi Mountain'))!;
    expect(inTheDay(tianzi, dayOf('2026-12-13').planItems, zj.spots ?? [])).toBe(true);
  });
});

describe('rankCandidates', () => {
  const zj = stopOf('cn26-stop-zhangjiajie');
  const pool = candidatesOf(zj).filter((c) => !inTheDay(c, dayOf('2026-12-13').planItems, zj.spots ?? []));

  it('caps at four and reports how many the guide still holds', () => {
    const r = rankCandidates(pool, { anchor: zj.coord });
    expect(r.shown).toHaveLength(4);
    expect(r.total).toBeGreaterThan(4);
  });

  it('leads with the trip’s own stars', () => {
    const r = rankCandidates(pool, { anchor: zj.coord });
    expect(r.shown[0]?.star).toBe(true);
  });

  it('lifts the wet-weather line out into its own row', () => {
    const r = rankCandidates(pool, { anchor: zj.coord });
    expect(r.fallback).not.toBeNull();
    expect(r.fallback?.fallback).toBe(true);
    /* and it is not ALSO one of the four ordinary offers */
    expect(r.shown.some((c) => c.id === r.fallback?.id)).toBe(false);
  });

  it('measures a straight line only where both ends carry a coordinate', () => {
    const r = rankCandidates(pool, { anchor: zj.coord });
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
    const r = rankCandidates(pool, { anchor: zj.coord, pickedIds: new Map([[last.id, 'pick-1']]) });
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

  /* NOT ONE SPOT IN CHINA 2026 CARRIES A COORDINATE. Every place in this trip
     was verified by NAME and ships `mapQuery` instead (docs/ARCHITECTURE §9a:
     "a name beats a coordinate"), so on the real data the distance line is
     silent everywhere — which IS the rule working. The arithmetic therefore
     has to be proven against a stop that does carry them, or the whole
     straight-line path would ride on a vacuous assertion. */
  it('measures and orders by the straight line when the coordinates exist', () => {
    const near: Spot = { id: 'near', name: 'Nearby Hall', kind: 'sight', coord: { lat: 29.117, lng: 110.479 } };
    const far: Spot = { id: 'far', name: 'Distant Cave', kind: 'sight', coord: { lat: 29.46, lng: 110.99 } };
    const anchor = { lat: 29.115, lng: 110.478 };
    const pool = [
      parseOption('**Distant Cave** — underground', 'b', 0, 'h', [near, far]),
      parseOption('**Nearby Hall** — five minutes off the square', 'b', 1, 'h', [near, far]),
    ];
    const r = rankCandidates(pool, { anchor });
    expect(r.shown[0]?.name).toBe('Nearby Hall');
    expect(r.shown[0]?.km).toBeCloseTo(0.2, 1);
    expect(r.shown[1]?.km).toBeGreaterThan(50);
    /* the same pool with no anchor states no distance at all */
    expect(rankCandidates(pool, {}).shown.every((c) => c.km === null)).toBe(true);
  });
});

describe('a real free afternoon, end to end', () => {
  it('Dec 22 — the Macau day, with a booked concert at 19:30', () => {
    const bookings = bundle.bookings as Booking[];
    const blocks = freeBlocks(bookingFixedPoints(bookings, '2026-12-22'));
    /* one block, running up to the HK Phil ticket and stopping there */
    expect(blocks.map((b) => b.span)).toEqual(['08:00–19:30']);
    expect(blocks[0]?.duration).toBe('11 h 30 m');

    const hk = stopOf('cn26-stop-hongkong');
    const pool = candidatesOf(hk).filter(
      (c) => !inTheDay(c, dayOf('2026-12-22').planItems, hk.spots ?? []),
    );
    const r = rankCandidates(pool, { anchor: hk.coord });
    expect(r.shown.length).toBeGreaterThan(1);
    expect(r.shown.length).toBeLessThanOrEqual(4);
  });

  it('Dec 13 — Zhangjiajie, no clock anywhere, so the day is one open block', () => {
    const bookings = bundle.bookings as Booking[];
    const blocks = freeBlocks(bookingFixedPoints(bookings, '2026-12-13'));
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
   OWN stop instead: on Dec 8 it offered 89 places, 70 of them in other
   cities (a pick for Dec 8 with Kunyu's stopId then showed under Beijing's
   "Planned"), the Temple of Heaven and Dong Lai Shun a second time, and on a
   travel day a pick the day screen never offers. */
describe('the day’s offers · the day screen and the Map tab read one rule', async () => {
  const { dayOffers, offerFor } = await import('../lib/logic/options');
  const { currentStop, resolveDay } = await import('../lib/logic/day');
  const { isTravelDay } = await import('../lib/logic/metroline');
  const { tripPhase } = await import('../lib/logic/phase');
  const { mapPlaces } = await import('../lib/logic/mapplaces');
  const trip = { start: '2026-11-21', end: '2026-12-27' };
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
  const places = mapPlaces({ tripId: 'cn26', stops: bundle.stops, showCards: bundle.showCards, bookings: bundle.bookings as Booking[], dayPlans: bundle.dayPlans, dayDefaults: bundle.dayDefaults });
  const offered = (date: string) => {
    const o = offersOn(date);
    return places.filter((p) => offerFor(o, { spotId: p.spot?.id, stopId: p.stopId }));
  };

  it('Dec 8: only Beijing’s own lines, never one the day already has — 17 places, none of the 70 elsewhere', () => {
    const o = offersOn('2026-12-08')!;
    expect(o.stop.id).toBe('cn26-stop-beijing');
    const list = offered('2026-12-08');
    expect(list).toHaveLength(17);
    expect(list.every((p) => p.stopId === 'cn26-stop-beijing')).toBe(true);
    const ids = list.map((p) => p.id);
    expect(ids).toContain('cn26-spot-beijing-beihai');
    /* already in the day: the hotpot line names both */
    expect(ids).not.toContain('cn26-spot-beijing-temple-heaven');
    expect(ids).not.toContain('cn26-spot-beijing-donglaishun');
    /* Kunyu's Yantai Hill is Kunyu's line — the old rule offered it on Dec 8 */
    expect(ids).not.toContain('cn26-spot-kunyu-yantaishan');
    expect(offerFor(o, { spotId: 'cn26-spot-kunyu-yantaishan', stopId: 'cn26-stop-kunyu' })).toBeNull();
    /* the rule the Map tab had — a place's own stop, no day, no travel test — for the record: the review's numbers */
    const oldRule = places.filter((p) => p.spot && p.stopId && candidatesOf(stopOf(p.stopId)).some((c) => c.spot?.id === p.spot!.id));
    expect(oldRule).toHaveLength(89);
    expect(oldRule.filter((p) => p.stopId !== 'cn26-stop-beijing')).toHaveLength(70);
    expect(oldRule.map((p) => p.id)).toEqual(expect.arrayContaining(['cn26-spot-beijing-temple-heaven', 'cn26-spot-beijing-donglaishun']));
  });

  it('the same pool the day screen ranks: DayView’s rule, not a copy of it', () => {
    const o = offersOn('2026-12-08')!;
    const stop = stopOf('cn26-stop-beijing');
    const direct = candidatesOf(stop).filter((c) => !inTheDay(c, dayOf('2026-12-08').planItems, stop.spots ?? []));
    expect(o.pool.map((c) => c.id)).toEqual(direct.map((c) => c.id));
  });

  it('a travel day offers nothing (Dec 9, Beijing → Chongli), nor a day before or after the trip', () => {
    expect(isTravelDay(resolveDay('2026-12-09', bundle.dayPlans, bundle.dayDefaults, bundle.stops)?.runbookId, bundle.bookings as Booking[], '2026-12-09')).toBe(true);
    expect(offersOn('2026-12-09')).toBeNull();
    expect(offered('2026-12-09')).toHaveLength(0);
    expect(offersOn('2026-11-01')).toBeNull();
    expect(offersOn('2027-01-10')).toBeNull();
  });

  it('a line you picked stays on offer, so it can be taken back out — even one the day names', () => {
    const stop = stopOf('cn26-stop-beijing');
    const inDay = candidatesOf(stop).find((c) => inTheDay(c, dayOf('2026-12-08').planItems, stop.spots ?? []))!;
    expect(offersOn('2026-12-08')!.pool.some((c) => c.id === inDay.id)).toBe(false);
    expect(offersOn('2026-12-08', new Set([inDay.id]))!.pool.some((c) => c.id === inDay.id)).toBe(true);
  });
});
