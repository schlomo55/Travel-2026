import { describe, expect, it } from 'vitest';
import { crossTripStats, dailyBurn, topCategories, tripStats } from '../lib/logic/stats';
import { buildRouteMap, pxPerDay } from '../lib/logic/routemap';
import type { Booking, Expense, ExpenseCategory, Stop, Trip } from '../lib/model/types';

const trip: Trip = {
  id: 'cn26', title: 'China 2026', start: '2026-11-21', end: '2026-12-27',
  homeCurrency: 'USD', currencies: [{ code: 'USD', symbol: '$', rateToHome: 1 }],
  accentHue: 8, clocks: [], budgetTotalMinor: 650000, archived: false, createdAt: 0, updatedAt: 0,
};
const stop = (id: string, start: string, end: string, nights = 2, kind: Stop['kind'] = 'stop'): Stop => ({
  id, tripId: 'cn26', kind, name: id, hue: 200, start, end, nights, blocks: [], recoBlocks: [], order: 0,
});
const stops = [
  stop('flights', '2026-11-21', '2026-11-22', 0, 'transit'),
  stop('kunyu', '2026-11-22', '2026-12-05', 13),
  stop('beijing', '2026-12-05', '2026-12-09', 4),
  stop('chongli', '2026-12-09', '2026-12-11', 2),
];
const exp = (over: Partial<Expense> = {}): Expense => ({
  id: 'e', tripId: 'cn26', date: '2026-12-06', categoryId: 'food', desc: '', amount: 10,
  currency: 'USD', rateToHome: 1, homeMinor: 1000, payment: 'card', refund: false, ts: 1, ...over,
});

describe('tripStats', () => {
  const base = { stops, bookings: [] as Booking[], tasks: [], packing: [] };

  it('counts days, stops and nights, ignoring transit stops', () => {
    const s = tripStats(trip, '2026-12-06', { ...base, expenses: [] });
    expect(s.days).toBe(37);
    expect(s.stops).toBe(3);
    expect(s.nights).toBe(19);
  });

  it('reports no elapsed days before departure', () => {
    expect(tripStats(trip, '2026-10-01', { ...base, expenses: [] }).elapsedDays).toBe(0);
  });

  it('averages over days that had spending, not calendar days', () => {
    const s = tripStats(trip, '2026-12-06', {
      ...base,
      expenses: [exp({ id: 'a', homeMinor: 2000 }), exp({ id: 'b', date: '2026-12-07', homeMinor: 4000 })],
    });
    expect(s.totalMinor).toBe(6000);
    expect(s.dailyAverageMinor).toBe(3000);
    expect(s.projectedMinor).toBe(3000 * 37);
  });

  it('does not project once the trip is over', () => {
    expect(tripStats(trip, '2027-01-05', { ...base, expenses: [exp()] }).projectedMinor).toBeNull();
  });

  it('nets refunds into the total but reports them separately', () => {
    const s = tripStats(trip, '2026-12-06', {
      ...base,
      expenses: [exp({ id: 'a', homeMinor: 5000 }), exp({ id: 'b', homeMinor: 2000, refund: true })],
    });
    expect(s.totalMinor).toBe(3000);
    expect(s.refundMinor).toBe(2000);
  });

  it('finds the biggest day and the biggest single entry', () => {
    const s = tripStats(trip, '2026-12-08', {
      ...base,
      expenses: [
        exp({ id: 'a', date: '2026-12-06', homeMinor: 1000 }),
        exp({ id: 'b', date: '2026-12-07', homeMinor: 9000, desc: 'Wall guide' }),
      ],
    });
    expect(s.busiestDay?.date).toBe('2026-12-07');
    expect(s.biggest?.desc).toBe('Wall guide');
  });
});

describe('dailyBurn', () => {
  it('emits one bucket per trip day, zero-filled', () => {
    const b = dailyBurn(trip, [exp({ homeMinor: 1500 })]);
    expect(b).toHaveLength(37);
    expect(b[0]?.date).toBe('2026-11-21');
    expect(b[36]?.date).toBe('2026-12-27');
    expect(b.find((x) => x.date === '2026-12-06')?.minor).toBe(1500);
    expect(b.find((x) => x.date === '2026-12-05')?.minor).toBe(0);
  });
});

describe('topCategories', () => {
  const cats: ExpenseCategory[] = [
    { id: 'food', tripId: 'cn26', label: 'Food', planMinor: 0, color: '#a', order: 0 },
    { id: 'ski', tripId: 'cn26', label: 'Ski', planMinor: 0, color: '#b', order: 1 },
    { id: 'idle', tripId: 'cn26', label: 'Idle', planMinor: 0, color: '#c', order: 2 },
  ];
  it('drops categories with no spend and sorts biggest first', () => {
    const t = topCategories([exp({ categoryId: 'food', homeMinor: 1000 }), exp({ id: 'x', categoryId: 'ski', homeMinor: 5000 })], cats);
    expect(t.map((x) => x.label)).toEqual(['Ski', 'Food']);
  });
});

describe('crossTripStats', () => {
  const other: Trip = { ...trip, id: 'jp', title: 'Japan', start: '2027-03-28', end: '2027-04-12', homeCurrency: 'EUR' };
  const rows = crossTripStats([trip, other], new Map([['cn26', [exp({ homeMinor: 4000 })]]]), '2026-12-06');

  it('classifies each trip against today', () => {
    expect(rows.rows.find((r) => r.trip.id === 'cn26')?.status).toBe('active');
    expect(rows.rows.find((r) => r.trip.id === 'jp')?.status).toBe('upcoming');
  });

  it('never converts between home currencies', () => {
    expect(rows.totalsByCurrency).toHaveLength(2);
    expect(rows.totalsByCurrency.find((c) => c.currency === 'USD')?.minor).toBe(4000);
    expect(rows.totalsByCurrency.find((c) => c.currency === 'EUR')?.minor).toBe(0);
  });

  it('counts days away only for trips that have started', () => {
    expect(rows.totalDays).toBe(37);
  });
});

describe('route map geometry', () => {
  const m = buildRouteMap(trip, stops, [], [{
    id: 'c', tripId: 'cn26', name: 'Visa', startDate: '2026-11-22', countStartsDayAfter: true,
    limitDays: 30, hardDeadline: '2026-12-22', pinned: true,
  }], '2026-12-06');

  it('draws a station per real stop, in date order', () => {
    expect(m.stations.map((s) => s.id)).toEqual(['kunyu', 'beijing', 'chongli']);
  });

  it('places stations further down the spine as dates advance', () => {
    expect(m.stations[0]!.y).toBeLessThan(m.stations[1]!.y);
    expect(m.stations[1]!.y).toBeLessThan(m.stations[2]!.y);
  });

  it('gives a longer stay a longer bar', () => {
    const kunyu = m.stations[0]!;
    const beijing = m.stations[1]!;
    expect(kunyu.barBottom - kunyu.barTop).toBeGreaterThan(beijing.barBottom - beijing.barTop);
  });

  it('marks the stop you are in', () => {
    expect(m.stations.find((s) => s.isCurrent)?.id).toBe('beijing');
  });

  it('draws the hard deadline as a wall inside the canvas', () => {
    expect(m.walls).toHaveLength(1);
    expect(m.walls[0]!.y).toBeGreaterThan(m.startY);
    expect(m.walls[0]!.y).toBeLessThan(m.height);
  });

  it('marks where today is', () => {
    expect(m.nowY).not.toBeNull();
  });

  it('has no you-are-here marker outside the trip', () => {
    expect(buildRouteMap(trip, stops, [], [], '2026-10-01').nowY).toBeNull();
  });

  it('classifies legs from the bookings on the handover day', () => {
    const flight = {
      id: 'f', tripId: 'cn26', kind: 'flight', status: 'booked', title: 'CA', date: '2026-12-05',
      meta: [], carrier: 'Air China', flightNo: 'CA1', from: { code: 'YNT' }, to: { code: 'PEK' },
      dep: '09:00', arr: '10:30', arrDayOffset: 0, createdAt: 0, updatedAt: 0,
    } as Booking;
    const withFlight = buildRouteMap(trip, stops, [flight], [], null);
    expect(withFlight.legs[0]?.mode).toBe('air');
    expect(withFlight.legs[1]?.mode).toBe('ground');
  });

  it('scales down so long trips stay a sane height', () => {
    expect(pxPerDay(7)).toBeGreaterThan(pxPerDay(37));
    expect(pxPerDay(200)).toBeGreaterThanOrEqual(8);
  });

  it('leaves room left of the spine for the date rail', () => {
    // "28 Nov" at 8.5px is ~31px wide, right-anchored at spineX - 20
    expect(m.spineX - 20).toBeGreaterThan(31);
  });

  it('pushes labels of back-to-back stops apart so they stay readable', () => {
    const tight: Stop[] = [
      stop('dali', '2026-12-19', '2026-12-20', 1),
      stop('kunming', '2026-12-20', '2026-12-21', 1),
      stop('hk', '2026-12-21', '2026-12-26', 5),
    ];
    const t = buildRouteMap(trip, tight, [], [], null);
    for (let i = 1; i < t.stations.length; i++) {
      expect(t.stations[i]!.labelY - t.stations[i - 1]!.labelY).toBeGreaterThanOrEqual(26);
    }
    // a nudged label never rises above its own station
    for (const s of t.stations) expect(s.labelY).toBeGreaterThanOrEqual(s.y);
  });

  it('grows the canvas so a nudged last label still fits', () => {
    const tight: Stop[] = ['12-19', '12-20', '12-21', '12-22', '12-23', '12-24'].map((d, i) =>
      stop(`s${i}`, `2026-${d}`, `2026-12-${25 + 0}`, 1),
    );
    const t = buildRouteMap(trip, tight, [], [], null);
    const last = t.stations[t.stations.length - 1]!;
    expect(t.height).toBeGreaterThan(last.labelY);
  });
});
