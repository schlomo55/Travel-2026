/* THE MAP TAB'S PLACES (Map 5c, lib/logic/mapplaces.ts) — on the real China
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
} from '../lib/logic/mapplaces';
import { S } from '../lib/i18n/strings';

const here = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(here, '..', '..', '..', 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup;
const t = seed.trips[0] as TripBundle;
const src = { tripId: 'cn26', stops: t.stops, showCards: t.showCards, bookings: t.bookings, dayPlans: t.dayPlans, dayDefaults: t.dayDefaults };
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
    expect(places.filter((p) => p.pos)).toHaveLength(148);
  });

  it('movements are not places: no flight, train or road leg', () => {
    for (const p of places) expect(p.booking?.kind ?? 'place', p.id).not.toMatch(/^(flight|train|other)$/);
    expect(byId('cn26-flight-ca1953')).toBeUndefined();
  });

  it('a button never opens the drawn-only pin: a spot opens by name, a bed as before', () => {
    for (const p of places) {
      const e = spots.find((s) => s.id === p.id) ?? t.showCards.find((c) => c.id === p.id) ?? t.bookings.find((b) => b.id === p.id);
      if (!e?.coord) expect(p.target.coord, p.id).toBeUndefined();
    }
    const pullman = byId('cn26-stay-03')!;
    expect(pullman.pos).toBeDefined();
    expect(pullman.target.coord).toBeUndefined();
    expect(pullman.target.address).toMatch(/Gaoyun Road/);
  });

  it('one pin per point on the ground: a ticket rides with the place it is for', () => {
    const pm = byId('cn26-spot-beijing-palace-museum')!;
    expect(pm.with.map((w) => w.id)).toContain('cn26-ticket-forbidden-city');
    expect(byId('cn26-ticket-forbidden-city')).toBe(pm);
    expect(pm.booking?.id).toBe('cn26-ticket-forbidden-city');
    const keys = places.filter((p) => p.pos).map((p) => `${p.pos!.lat.toFixed(5)},${p.pos!.lng.toFixed(5)}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('with no position and no button a place is not on the map at all; with a button it opens by name', () => {
    const noPin = places.filter((p) => !p.pos);
    expect(noPin.length).toBeGreaterThan(20);
    for (const p of noPin) expect(!!(p.target.query || p.target.address || p.target.url), p.id).toBe(true);
    expect(byId('cn26-stay-01')).toBeUndefined(); // Blossom House: no pin, no button
    expect(byId('cn26-place-00')).toBeUndefined(); // the academy's taxi paragraph
    expect(byId('cn26-spot-beijing-jinshanling')?.pos).toBeUndefined();
  });

  it('the line is the trip’s own, verbatim; the category is the trip’s, else the kind’s', () => {
    for (const p of places) {
      const e = spots.find((s) => s.id === p.id) ?? t.showCards.find((c) => c.id === p.id) ?? t.bookings.find((b) => b.id === p.id);
      if (e?.detail) expect(p.detail, p.id).toBe(e.detail);
      expect(CATEGORIES, p.id).toContain(p.category);
    }
    expect(byId('cn26-place-07')).toMatchObject({ name: 'Beijing Massage Hospital', native: '北京按摩医院', category: 'spa', detail: 'Blind massage / tuina, not bone-setting' });
    const bare: Spot = { id: 'x', name: 'Somewhere · noodles', kind: 'food', pin: { lat: 39.9, lng: 116.4 }, mapQuery: 'x' };
    const one = mapPlaces({ tripId: 'z', stops: [{ ...t.stops[2]!, id: 's', spots: [bare] }], showCards: [], bookings: [] });
    expect(one[0]).toMatchObject({ category: 'food', label: 'Somewhere' });
  });

  it('every place in Beijing belongs to Beijing; the counts are the pins', () => {
    const bj = inStop(places, 'cn26-stop-beijing');
    expect(bj.length).toBeGreaterThan(30);
    const c = categoryCounts(bj.filter((p) => p.pos));
    expect(c).toMatchObject({ spa: 1, medical: 1, transport: 5, hotel: 0 });
    expect(c.all).toBe(CATEGORIES.reduce((n, k) => n + c[k], 0));
  });
});

describe('the Map tab · names', () => {
  it('a card is named by its own English before its aside, its city dropped where it is its own', () => {
    expect(byId('cn26-place-05')?.name).toBe('Houhai');
    expect(byId('cn26-place-01')?.name).toBe('Beijing Daxing (PKX)');
    const pek = t.showCards.find((c) => c.id === 'cn26-place-02')!;
    expect(cardName(pek)).not.toMatch(/⚠|NOT the/);
  });
  it('a pin wears the words before the " · " and the ", "', () => {
    expect(pinLabel('Siji Minfu · Peking duck')).toBe('Siji Minfu');
    expect(pinLabel('Tianmen Mountain cableway, Dec 14')).toBe('Tianmen Mountain cableway');
    expect(pinLabel('Houhai')).toBe('Houhai');
  });
  it('a title in two scripts gives its English and its Chinese, word for word', () => {
    expect(splitScripts('Dali Yanyuan Mountain Retreat 大理晏清山居客栈')).toEqual({ name: 'Dali Yanyuan Mountain Retreat', native: '大理晏清山居客栈' });
    expect(splitScripts('Halfway Guesthouse')).toEqual({ name: 'Halfway Guesthouse' });
  });
});

describe('the Map tab · today, tonight, filters, search', () => {
  it('Tue 8 Dec names Huguosi and Jiuhua; Huguosi is today’s, the Massage Hospital is not', () => {
    const ids = todayIds(src, '2026-12-08');
    expect([...ids].sort()).toEqual(['cn26-place-27', 'cn26-spot-beijing-jiuhua']);
    expect(isToday(byId('cn26-place-27')!, ids)).toBe(true);
    expect(isToday(byId('cn26-place-07')!, ids)).toBe(false);
    expect(dayTitleShort(src, '2026-12-08')).toBe('Spa day');
  });
  it('tonight is the bed whose nights hold the date', () => {
    const royal = byId('cn26-stay-10')!;
    expect(isTonight(royal, '2026-12-22')).toBe(true);
    expect(isTonight(royal, '2026-12-01')).toBe(false);
  });
  it('filters: a category off, and hotels as your beds only or every one', () => {
    const royal = byId('cn26-stay-10')!;
    expect(shown(royal, { off: new Set(), hotels: 'beds' })).toBe(true);
    expect(shown(royal, { off: new Set(['hotel']), hotels: 'all' })).toBe(false);
    const hotelCard = { ...byId('cn26-place-07')!, category: 'hotel' as const, kind: 'card' as const };
    expect(shown(hotelCard, { off: new Set(), hotels: 'beds' })).toBe(false);
    expect(shown(hotelCard, { off: new Set(), hotels: 'all' })).toBe(true);
  });
  it('search: every word, in English or Chinese, pins first', () => {
    const cat = (c: (typeof CATEGORIES)[number]) => S.mapTab.cat[c];
    expect(searchPlaces(places, 'massage', cat)[0]?.id).toBe('cn26-place-07');
    expect(searchPlaces(places, '按摩', cat)[0]?.id).toBe('cn26-place-07');
    expect(searchPlaces(places, 'MASSAGE hospital', cat).map((p) => p.id)).toContain('cn26-place-07');
    const spa = searchPlaces(places, 'spa', cat);
    expect(spa.length).toBeGreaterThanOrEqual(2);
    const firstUnpinned = spa.findIndex((p) => !p.pos);
    if (firstUnpinned >= 0) expect(spa.slice(firstUnpinned).every((p) => !p.pos)).toBe(true);
    expect(searchPlaces(places, '   ', cat)).toEqual([]);
  });
  it('the doorways’ set: what the map draws, members of a merged pin included', () => {
    const ids = drawnIds(src);
    expect(ids.has('cn26-place-07')).toBe(true);
    expect(ids.has('cn26-ticket-forbidden-city')).toBe(true);
    expect(ids.has('cn26-flight-ca1953')).toBe(false);
    expect(ids.has('cn26-stay-01')).toBe(false);
    for (const p of places.filter((x) => x.pos)) expect(ids.has(p.id), p.id).toBe(true);
  });
});
