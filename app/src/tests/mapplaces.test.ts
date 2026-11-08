/* THE MAP TAB'S PLACES (Map 5c, lib/logic/mapplaces.ts) — on the demo trip
   seed: what is a place, where it is drawn (coord ?? pin, nothing else), what
   its buttons open (never the drawn-only pin), one pin per point on the
   ground, the names, today and tonight, the filters, the counts, the search,
   and the doorways' set. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AppBackup, Spot, TripBundle } from '../lib/model/types';
import {
  CATEGORIES,
  cardName,
  categoryCounts,
  dayTitleShort,
  drawnIds,
  inStop,
  isToday,
  isTonight,
  mapPlaces,
  pinLabel,
  placeById,
  searchPlaces,
  shown,
  splitScripts,
  todayIds,
  type MapPlace,
} from '../lib/logic/mapplaces';
import { S } from '../lib/i18n/strings';
import { bookingOnMap, placePos } from '../lib/logic/mapdrawn';

const here = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(here, '..', '..', '..', 'seed', 'demo-2027.trip.json'), 'utf8')) as AppBackup;
const t = seed.trips[0] as TripBundle;
const src = { tripId: 'dm27', stops: t.stops, showCards: t.showCards, bookings: t.bookings, dayPlans: t.dayPlans, dayDefaults: t.dayDefaults };
const places = mapPlaces(src);
const byId = (id: string) => placeById(places, id);
const spots = t.stops.flatMap((s) => s.spots ?? []);

describe('the Map tab · which places, and where', () => {
  it('draws a place at coord ?? pin, and nowhere else', () => {
    for (const p of places) {
      if (!p.pos) continue;
      const e = spots.find((s) => s.id === p.id) ?? t.showCards.find((c) => c.id === p.id) ?? t.bookings.find((b) => b.id === p.id);
      expect(e, p.id).toBeDefined();
      expect(p.pos, p.id).toEqual(e!.coord ?? e!.pin);
    }
    /* 51 pinned spots + 14 cards (the cableway, West Street, Ping'an and
       Cultural Centre cards ride with their spots; the pending clinic card is
       not drawn) + 4 pinned beds (the Harbour Hotel's rides with its card) +
       the dim-sum splurge; every other ticket rides with its place */
    expect(places.filter((p) => p.pos)).toHaveLength(70);
  });

  it('movements are not places: no flight, train or road leg', () => {
    for (const p of places) expect(p.booking?.kind ?? 'place', p.id).not.toMatch(/^(flight|train|other)$/);
    expect(byId('dm27-flight-mu5001')).toBeUndefined();
  });

  it('a button never opens the drawn-only pin: a spot opens by name, a bed as before', () => {
    for (const p of places) {
      const e = spots.find((s) => s.id === p.id) ?? t.showCards.find((c) => c.id === p.id) ?? t.bookings.find((b) => b.id === p.id);
      if (!e?.coord) expect(p.target.coord, p.id).toBeUndefined();
    }
    const teahouse = byId('dm27-stay-09')!; // a pin and a local-script address
    expect(teahouse.pos).toBeDefined();
    expect(teahouse.target.coord).toBeUndefined();
    expect(teahouse.target.address).toMatch(/样本街9号/);
  });

  it('one pin per point on the ground: a ticket rides with the place it is for', () => {
    const pm = byId('dm27-spot-shanghai-museum-east')!;
    expect(pm.with.map((w) => w.id)).toContain('dm27-ticket-museum');
    expect(byId('dm27-ticket-museum')).toBe(pm);
    expect(pm.booking?.id).toBe('dm27-ticket-museum');
    const keys = places.filter((p) => p.pos).map((p) => `${p.pos!.lat.toFixed(5)},${p.pos!.lng.toFixed(5)}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('with no position and no button a place is not on the map at all; with a button it opens by name', () => {
    const noPin = places.filter((p) => !p.pos);
    expect(noPin.length).toBeGreaterThan(10);
    for (const p of noPin) expect(!!(p.target.query || p.target.address || p.target.url), p.id).toBe(true);
    expect(byId('dm27-stay-02')).toBeUndefined(); // the school dormitory: no pin, no button
    expect(byId('dm27-place-00')).toBeUndefined(); // the school's taxi paragraph
    expect(byId('dm27-spot-longji-dazhai')?.pos).toBeUndefined();
  });

  it('the line is the trip’s own, verbatim; the category is the trip’s, else the kind’s', () => {
    for (const p of places) {
      const e = spots.find((s) => s.id === p.id) ?? t.showCards.find((c) => c.id === p.id) ?? t.bookings.find((b) => b.id === p.id);
      if (e?.detail) expect(p.detail, p.id).toBe(e.detail);
      expect(CATEGORIES, p.id).toContain(p.category);
    }
    expect(byId('dm27-place-06')).toMatchObject({ name: 'Sample Blind Massage', native: '样本盲人按摩', category: 'spa', detail: 'Tuina by blind therapists, not bone-setting' });
    const bare: Spot = { id: 'x', name: 'Somewhere · noodles', kind: 'food', pin: { lat: 31.2, lng: 121.5 }, mapQuery: 'x' };
    const one = mapPlaces({ tripId: 'z', stops: [{ ...t.stops[2]!, id: 's', spots: [bare] }], showCards: [], bookings: [] });
    expect(one[0]).toMatchObject({ category: 'food', label: 'Somewhere' });
  });

  it('every place in Shanghai belongs to Shanghai; the counts are the pins', () => {
    const sh = inStop(places, 'dm27-stop-shanghai');
    expect(sh.length).toBeGreaterThan(12);
    const c = categoryCounts(sh.filter((p) => p.pos));
    /* the massage, the clinic, Pudong + Hongqiao T2 + Hongqiao station; the
       Bund Hotel has an address and no pin, so it is not a pin */
    expect(c).toMatchObject({ spa: 1, medical: 1, transport: 3, hotel: 0 });
    expect(c.all).toBe(CATEGORIES.reduce((n, k) => n + c[k], 0));
  });
});

describe('the Map tab · names', () => {
  it('a card is named by its own English before its aside, its city dropped where it is its own', () => {
    expect(byId('dm27-place-05')?.name).toBe('Xintiandi');
    expect(byId('dm27-place-01')?.name).toBe('Shanghai Pudong (PVG)');
    /* a card whose meaning carries a warning is named without it */
    const sha = t.showCards.find((c) => c.id === 'dm27-place-02')!;
    const warned = { ...sha, meaning: 'Shanghai Hongqiao Airport Terminal 2 (SHA) — ⚠️ NOT the Pudong airport' };
    expect(cardName(warned)).not.toMatch(/⚠|NOT the/);
    expect(cardName(warned)).toBe(cardName(sha));
  });
  it('a pin wears the words before the " · " and the ", "', () => {
    expect(pinLabel('Sample Roast Goose Kitchen · roast goose')).toBe('Sample Roast Goose Kitchen');
    expect(pinLabel('Yungu cableway, Apr 6')).toBe('Yungu cableway');
    expect(pinLabel('Xintiandi')).toBe('Xintiandi');
  });
  it('a title in two scripts gives its English and its Chinese, word for word', () => {
    expect(splitScripts('Sample Pine Lodge 样本松林山庄')).toEqual({ name: 'Sample Pine Lodge', native: '样本松林山庄' });
    expect(splitScripts('Sample Terrace Guesthouse')).toEqual({ name: 'Sample Terrace Guesthouse' });
  });
});

describe('the Map tab · today, tonight, filters, search', () => {
  it('Tue 30 Mar names the Museum East and Lujiazui; the museum is today’s, the Blind Massage (the grey-day swap in the text) is not', () => {
    const ids = todayIds(src, '2027-03-30');
    expect([...ids].sort()).toEqual(['dm27-spot-shanghai-lujiazui', 'dm27-spot-shanghai-museum-east']);
    expect(isToday(byId('dm27-spot-shanghai-museum-east')!, ids)).toBe(true);
    expect(isToday(byId('dm27-place-06')!, ids)).toBe(false);
    expect(dayTitleShort(src, '2027-03-30')).toBe('Museum Tuesday');
  });
  it('tonight is the bed whose nights hold the date', () => {
    const teahouse = byId('dm27-stay-09')!; // Apr 7 → 9
    expect(isTonight(teahouse, '2027-04-08')).toBe(true);
    expect(isTonight(teahouse, '2027-04-01')).toBe(false);
  });
  it('filters: a category off, and hotels as your beds only or every one', () => {
    const teahouse = byId('dm27-stay-09')!;
    expect(shown(teahouse, { off: new Set(), hotels: 'beds' })).toBe(true);
    expect(shown(teahouse, { off: new Set(['hotel']), hotels: 'all' })).toBe(false);
    const hotelCard = { ...byId('dm27-place-06')!, category: 'hotel' as const, kind: 'card' as const };
    expect(shown(hotelCard, { off: new Set(), hotels: 'beds' })).toBe(false);
    expect(shown(hotelCard, { off: new Set(), hotels: 'all' })).toBe(true);
  });
  it('search: every word, in English or Chinese, pins first', () => {
    const cat = (c: (typeof CATEGORIES)[number]) => S.mapTab.cat[c];
    expect(searchPlaces(places, 'massage', cat)[0]?.id).toBe('dm27-place-06');
    expect(searchPlaces(places, '按摩', cat)[0]?.id).toBe('dm27-place-06');
    expect(searchPlaces(places, 'MASSAGE blind', cat).map((p) => p.id)).toContain('dm27-place-06');
    expect(searchPlaces(places, 'spa', cat).map((p) => p.id)).toContain('dm27-place-06');
    /* two ferry piers with a pin, and Taipa without one — last */
    const ferry = searchPlaces(places, 'ferry', cat);
    expect(ferry.length).toBeGreaterThanOrEqual(2);
    const firstUnpinned = ferry.findIndex((p) => !p.pos);
    expect(firstUnpinned).toBeGreaterThan(0);
    expect(ferry.slice(firstUnpinned).every((p) => !p.pos)).toBe(true);
    expect(searchPlaces(places, '   ', cat)).toEqual([]);
  });
  it('the doorways’ set: what the map draws, members of a merged pin included', () => {
    const ids = drawnIds(src);
    expect(ids.has('dm27-place-06')).toBe(true);
    expect(ids.has('dm27-ticket-museum')).toBe(true);
    expect(ids.has('dm27-flight-mu5001')).toBe(false);
    expect(ids.has('dm27-stay-02')).toBe(false);
    for (const p of places.filter((x) => x.pos)) expect(ids.has(p.id), p.id).toBe(true);
  });
  /* MAP 5D — the pass asked its own question ("a bed or a ticket, not
     cancelled, with a position") and skipped the `alternative` test the map
     keeps: an either/or booking got a doorway to a pin the map never draws. */
  it('a pass offers "Show on map" exactly where the map draws its booking — never an alternative', () => {
    const base = t.bookings.find((b) => b.id === 'dm27-ticket-museum')!;
    const alt = { ...base, id: 'dm27-ticket-either-or', alternative: true } as typeof base;
    const oldPassRule = (b: typeof base): boolean => (b.kind === 'hotel' || b.kind === 'activity') && b.status !== 'cancelled' && !!placePos(b);
    expect(oldPassRule(alt)).toBe(true); // the doorway it offered
    expect(bookingOnMap(alt)).toBe(false);
    const withAlt = { ...src, bookings: [...t.bookings, alt] };
    expect(drawnIds(withAlt).has(alt.id)).toBe(false);
    expect(placeById(mapPlaces(withAlt), alt.id)).toBeUndefined();
    const ids = drawnIds(src);
    for (const b of t.bookings) expect(bookingOnMap(b), b.id).toBe(ids.has(b.id));
  });
});

/* QA, 7 Nov 2026: "Peak" listed The Peak last of five, behind places whose
   LINE mentioned a peak. Synthetic places only. */
describe('map search · the name ranks first', () => {
  const pl = (id: string, name: string, detail = '', pos = true): MapPlace =>
    ({ id, kind: 'spot', category: 'sight', name, label: name, ...(detail ? { detail } : {}), ...(pos ? { pos: { lat: 22, lng: 114 } } : {}), target: { query: name }, with: [] }) as MapPlace;
  const list = [
    pl('lake', 'Mirror Lake', 'a boat ride under the peak'),
    pl('garden', 'Victoria Peak Garden', '', false),
    pl('mtn', 'Snow Mountain', 'the highest peak of the range'),
    pl('tram', 'Peak Tram'),
    pl('peak', 'The Peak'),
  ];
  const word = (c: string): string => c;
  it('the name itself, then a name that begins with it, then a word of it, then the lines', () => {
    expect(searchPlaces(list, 'Peak', word).map((p) => p.id)).toEqual(['peak', 'tram', 'garden', 'lake', 'mtn']);
    expect(searchPlaces(list, 'the peak', word)[0]?.id).toBe('peak');
    expect(searchPlaces(list, 'peak tr', word).map((p) => p.id)).toEqual(['tram']);
  });
  it('within a rank, a place with a pin comes first', () => {
    const two = [pl('a', 'Peak Lookout', '', false), pl('b', 'Peak Café')];
    expect(searchPlaces(two, 'peak', word).map((p) => p.id)).toEqual(['b', 'a']);
  });
});
