import { describe, expect, it } from 'vitest';
import { buildBooked, priceOf, staysInStop } from '../lib/logic/booked';
import type { Booking, HotelBooking, Stop, Trip } from '../lib/model/types';

const LABELS = {
  flights: 'Flights',
  travel: 'Travel',
  stays: 'Stays',
  docs: 'From the trip documents',
  /* Added 2026-08-06 with the Wallet's fifth segment: the things you go TO are
     their own group, because a concert ticket inside a Travel total reads as a
     fare. */
  experiences: 'Experiences',
  /* Added 2026-08-12 with the `alternative` flag: the half of an either/or
     move that will not happen is shown and never added up. */
  alternatives: 'Or instead',
};

const trip: Trip = {
  id: 't',
  title: 'China 2026',
  start: '2026-11-21',
  end: '2026-12-27',
  homeCurrency: 'USD',
  currencies: [
    { code: 'USD', symbol: '$', rateToHome: 1 },
    { code: 'CNY', symbol: '¥', rateToHome: 7.15 },
  ],
  accentHue: 215,
  clocks: [],
  budgetTotalMinor: 650000,
  archived: false,
  createdAt: 0,
  updatedAt: 0,
};

const stay = (over: Partial<HotelBooking> = {}): HotelBooking => ({
  id: 'h1',
  tripId: 't',
  kind: 'hotel',
  status: 'pending',
  title: 'CHAO Sanlitun',
  city: 'Beijing',
  date: '2026-12-05',
  checkIn: '2026-12-05',
  checkOut: '2026-12-07',
  priceNote: '~$376',
  meta: [],
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

const flight = (over: Partial<Booking> = {}): Booking =>
  ({
    id: 'f1',
    tripId: 't',
    kind: 'flight',
    status: 'booked',
    title: 'Air China · CA 1953',
    date: '2026-12-11',
    carrier: 'Air China',
    flightNo: 'CA 1953',
    from: { code: 'PEK' },
    to: { code: 'DYG' },
    dep: '17:00',
    arr: '19:40',
    arrDayOffset: 0,
    priceNote: '$241',
    meta: [],
    createdAt: 0,
    updatedAt: 0,
    ...over,
  }) as Booking;

const stop = (over: Partial<Stop> = {}): Stop => ({
  id: 's1',
  tripId: 't',
  kind: 'stop',
  name: 'Beijing',
  hue: 30,
  start: '2026-12-05',
  end: '2026-12-09',
  blocks: [],
  recoBlocks: [],
  order: 1,
  ...over,
});

describe('buildBooked', () => {
  it('groups travel and stays, and prices each one', () => {
    const b = buildBooked(trip, [flight(), stay()], [], LABELS);
    expect(b.groups.map((g) => [g.label, g.items.length])).toEqual([
      ['Flights', 1],
      ['Stays', 1],
    ]);
    expect(b.groups[0]?.items[0]?.range).toEqual({ minMinor: 24100, maxMinor: 24100 });
    expect(b.groups[1]?.items[0]?.sub).toBe('Beijing · 5 Dec → 7 Dec · 2 nights');
    expect(b.total).toEqual({ minMinor: 61700, maxMinor: 61700 });
    expect(b.counted).toBe(2);
    expect(b.unpriced).toBe(0);
  });

  it('multiplies a per-night quote by the nights of that stay', () => {
    const b = buildBooked(trip, [stay({ priceNote: '$17–40/n', checkIn: '2026-12-14', checkOut: '2026-12-16' })], [], LABELS);
    expect(b.total).toEqual({ minMinor: 3400, maxMinor: 8000 });
  });

  it('leaves an unreadable price out of the total and says so', () => {
    const b = buildBooked(trip, [flight({ priceNote: undefined }), stay({ priceNote: 'ask at the desk' })], [], LABELS);
    expect(b.total).toEqual({ minMinor: 0, maxMinor: 0 });
    expect(b.unpriced).toBe(2);
    expect(b.counted).toBe(0);
    expect(b.groups[0]?.items[0]?.quoted).toBeNull();
  });

  it('drops a cancelled booking — it is not committed to', () => {
    const b = buildBooked(trip, [flight({ status: 'cancelled' }), stay()], [], LABELS);
    expect(b.groups.map((g) => g.label)).toEqual(['Stays']);
    expect(b.total).toEqual({ minMinor: 37600, maxMinor: 37600 });
  });

  /* THE EITHER/OR LEG. `alternative` means "this OR the other one, never both"
     (types.ts) — Nov 22 is a flight to Yantai or else the HSR. Plans has
     honoured it since the flag existed; the money counted both halves, so a
     journey that will be made once was budgeted for twice. */
  it('shows an alternative leg and keeps it out of every total', () => {
    const b = buildBooked(
      trip,
      [flight(), flight({ id: 'alt', title: 'HSR fallback', alternative: true, priceNote: '$60' })],
      [],
      LABELS,
    );
    /* The counted groups never see it… */
    expect(b.groups.map((g) => [g.key, g.items.length])).toEqual([['travel', 1]]);
    expect(b.total).toEqual({ minMinor: 24100, maxMinor: 24100 });
    expect(b.counted).toBe(1);
    /* …and it is still on the screen, in its own uncounted group. */
    expect(b.alternatives?.key).toBe('alternatives');
    expect(b.alternatives?.items.map((i) => i.title)).toEqual(['HSR fallback']);
  });

  it('does not count an unpriced alternative as an unpriced commitment', () => {
    const b = buildBooked(trip, [flight(), flight({ id: 'alt', alternative: true, priceNote: undefined })], [], LABELS);
    expect(b.unpriced).toBe(0);
    expect(b.alternatives?.unpriced).toBe(1);
  });

  it('has no alternatives group when the trip has no either/or leg', () => {
    expect(buildBooked(trip, [flight(), stay()], [], LABELS).alternatives).toBeNull();
  });

  it('calls a mixed travel group by its general name', () => {
    const trains = [flight(), { ...flight({ id: 'x' }), kind: 'train', from: { name: 'Dali' }, to: { name: 'Kunming' } } as Booking];
    expect(buildBooked(trip, trains, [], LABELS).groups[0]?.label).toBe('Travel');
  });

  it('keeps the things you go TO out of the travel total, and prices only the bought one', () => {
    /* The Wallet's fifth segment, in the money card. A ticket is not a leg: a
       concert inside a "Travel" total reads as a fare, and an asking price for
       something nobody has bought is not a commitment at all. So an unpriced
       pending ticket lands in its own group and counts as unpriced — the same
       contract the five unbought rail legs ship under. */
    const ticket = (over: Partial<Booking> = {}): Booking =>
      ({
        id: 'a1',
        tripId: 't',
        kind: 'activity',
        status: 'pending',
        title: 'Jade Dragon cableway',
        date: '2026-12-17',
        venue: '玉龙雪山',
        meta: [],
        createdAt: 0,
        updatedAt: 0,
        ...over,
      }) as Booking;
    const b = buildBooked(
      trip,
      [flight(), stay(), ticket(), ticket({ id: 'a2', title: 'HK Phil', date: '2026-12-22', time: '19:30', status: 'booked', priceNote: '$88' })],
      [],
      LABELS,
    );
    expect(b.groups.map((g) => [g.key, g.label, g.items.length])).toEqual([
      ['travel', 'Flights', 1],
      ['stays', 'Stays', 1],
      ['experiences', 'Experiences', 2],
    ]);
    /* $241 + $376 + $88 — the pending ticket adds nothing at all. */
    expect(b.total).toEqual({ minMinor: 70500, maxMinor: 70500 });
    expect(b.unpriced).toBe(1);
    /* Its row says when and where, which is what a ticket is identified by. */
    expect(b.groups[2]?.items[0]?.sub).toBe('Thu 17 Dec · 玉龙雪山');
    expect(b.groups[2]?.items[1]?.sub).toBe('Tue 22 Dec · 19:30 · 玉龙雪山');
  });

  it('reads an already-paid amount out of a stop budget note, with its source', () => {
    const b = buildBooked(trip, [], [stop({ kind: 'transit', name: 'International Flights', costNote: '≈$1,050 (booked ~$2,026)', whenLabel: 'TLV → Beijing' })], LABELS);
    const line = b.groups[0]?.items[0];
    expect(b.groups[0]?.label).toBe('From the trip documents');
    expect(line?.range).toEqual({ minMinor: 202600, maxMinor: 202600 });
    expect(line?.source).toBe('≈$1,050 (booked ~$2,026)');
    expect(line?.booking).toBeUndefined();
    /* an estimate with no booked figure is NOT money already committed */
    expect(buildBooked(trip, [], [stop({ costNote: '≈$930' })], LABELS).groups).toEqual([]);
  });

  it('converts another currency at the trip rate, and refuses when there is none', () => {
    const cny = buildBooked(trip, [stay({ priceNote: '¥1,430' })], [], LABELS);
    expect(cny.total).toEqual({ minMinor: 20000, maxMinor: 20000 }); // ¥1,430 ÷ 7.15 = $200
    const yen = buildBooked(trip, [stay({ priceNote: '£120' })], [], LABELS);
    expect(yen.unpriced).toBe(1);
    expect(yen.total).toEqual({ minMinor: 0, maxMinor: 0 });
  });
});

describe('staysInStop', () => {
  const beijing = stop({ start: '2026-12-05', end: '2026-12-09' });
  const chongli = stop({ id: 's2', name: 'Chongli', start: '2026-12-09', end: '2026-12-11' });
  const beds = [
    stay({ id: 'a', checkIn: '2026-12-05', checkOut: '2026-12-07' }),
    stay({ id: 'b', checkIn: '2026-12-07', checkOut: '2026-12-09' }),
    stay({ id: 'c', checkIn: '2026-12-09', checkOut: '2026-12-11' }),
  ];
  it('takes the beds it is slept in, and never the neighbour’s', () => {
    expect(staysInStop(beds, beijing).map((b) => b.id)).toEqual(['a', 'b']);
    expect(staysInStop(beds, chongli).map((b) => b.id)).toEqual(['c']);
  });
  it('ignores flights and cancellations', () => {
    expect(staysInStop([flight(), ...beds.map((b) => ({ ...b, status: 'cancelled' as const }))], beijing)).toEqual([]);
  });
});

describe('priceOf', () => {
  it('gives the quote and what it adds up to', () => {
    expect(priceOf(stay({ priceNote: '$20–30/n' }), trip)).toEqual({
      quoted: '$20–30/n',
      range: { minMinor: 4000, maxMinor: 6000 },
    });
  });
  it('gives null when nothing was recorded', () => {
    expect(priceOf(stay({ priceNote: undefined }), trip)).toEqual({ quoted: null, range: null });
  });
});
