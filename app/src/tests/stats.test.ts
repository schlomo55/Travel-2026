import { describe, expect, it } from 'vitest';
import { crossTripStats, dailyBurn, topCategories, tripStats } from '../lib/logic/stats';
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
