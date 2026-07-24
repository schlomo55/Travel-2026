import { describe, expect, it } from 'vitest';
import { buildBooked, priceOf, staysInStop } from '../lib/logic/booked';
import type { Booking, HotelBooking, Stop, Trip } from '../lib/model/types';

const LABELS = { flights: 'Flights', travel: 'Travel', stays: 'Stays', docs: 'From the trip documents' };

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

  it('calls a mixed travel group by its general name', () => {
    const trains = [flight(), { ...flight({ id: 'x' }), kind: 'train', from: { name: 'Dali' }, to: { name: 'Kunming' } } as Booking];
    expect(buildBooked(trip, trains, [], LABELS).groups[0]?.label).toBe('Travel');
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
