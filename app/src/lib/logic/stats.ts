/* Trip statistics. Pure functions over arrays — at personal scale there is no
   reason to precompute anything.
   Cross-trip money is never converted between home currencies: inventing an FX
   rate would be a lie, so totals are grouped per currency instead. */
import type { Booking, Expense, ExpenseCategory, ISODate, PackingItem, Stop, Task, Trip } from '../model/types';
import { compareIso, daysBetween } from './dates';
import { signed, sumMinor } from './money';
import { tripDay, tripDays, tripPhase } from './phase';

export interface TripStats {
  days: number;
  elapsedDays: number;
  stops: number;
  nights: number;
  totalMinor: number;
  planMinor: number;
  dailyAverageMinor: number | null;
  projectedMinor: number | null;
  cashMinor: number;
  cardMinor: number;
  refundMinor: number;
  entries: number;
  biggest: Expense | null;
  busiestDay: { date: ISODate; minor: number } | null;
  bookingsByStatus: { booked: number; pending: number; walkin: number; cancelled: number };
  tasksDone: number;
  tasksTotal: number;
  packedDone: number;
  packedTotal: number;
}

export function tripStats(
  trip: Trip,
  now: ISODate,
  data: {
    stops: Stop[];
    expenses: Expense[];
    bookings: Booking[];
    tasks: Task[];
    packing: PackingItem[];
  },
): TripStats {
  const phase = tripPhase(trip, now);
  const days = tripDays(trip);
  const elapsedDays = phase === 'before' ? 0 : phase === 'after' ? days : tripDay(trip, now);

  const totalMinor = sumMinor(data.expenses);
  const spentDays = new Set(data.expenses.map((e) => e.date)).size;
  const dailyAverageMinor = spentDays > 0 ? Math.round(totalMinor / spentDays) : null;
  const projectedMinor =
    dailyAverageMinor !== null && elapsedDays > 0 && phase !== 'after' ? Math.round(dailyAverageMinor * days) : null;

  const byDay = new Map<ISODate, number>();
  for (const e of data.expenses) byDay.set(e.date, (byDay.get(e.date) ?? 0) + signed(e));
  let busiestDay: TripStats['busiestDay'] = null;
  for (const [date, minor] of byDay) {
    if (!busiestDay || minor > busiestDay.minor) busiestDay = { date, minor };
  }

  const biggest = data.expenses.reduce<Expense | null>(
    (best, e) => (!best || signed(e) > signed(best) ? e : best),
    null,
  );

  const bookingsByStatus = { booked: 0, pending: 0, walkin: 0, cancelled: 0 };
  for (const b of data.bookings) bookingsByStatus[b.status]++;

  return {
    days,
    elapsedDays,
    stops: data.stops.filter((s) => s.kind === 'stop').length,
    nights: data.stops.filter((s) => s.kind === 'stop').reduce((n, s) => n + (s.nights ?? 0), 0),
    totalMinor,
    planMinor: trip.budgetTotalMinor ?? 0,
    dailyAverageMinor,
    projectedMinor,
    cashMinor: sumMinor(data.expenses.filter((e) => e.payment === 'cash')),
    cardMinor: sumMinor(data.expenses.filter((e) => e.payment === 'card')),
    refundMinor: data.expenses.filter((e) => e.refund).reduce((s, e) => s + e.homeMinor, 0),
    entries: data.expenses.length,
    biggest,
    busiestDay,
    bookingsByStatus,
    tasksDone: data.tasks.filter((t) => t.done).length,
    tasksTotal: data.tasks.length,
    packedDone: data.packing.filter((p) => p.done).length,
    packedTotal: data.packing.length,
  };
}

/** Spend per day of the trip, for the burn sparkline. */
export function dailyBurn(trip: Trip, expenses: Expense[]): { date: ISODate; minor: number }[] {
  const byDay = new Map<ISODate, number>();
  for (const e of expenses) byDay.set(e.date, (byDay.get(e.date) ?? 0) + signed(e));
  const out: { date: ISODate; minor: number }[] = [];
  const total = daysBetween(trip.start, trip.end);
  for (let i = 0; i <= total; i++) {
    const y = Number(trip.start.slice(0, 4));
    const mth = Number(trip.start.slice(5, 7));
    const d = Number(trip.start.slice(8, 10));
    const dt = new Date(y, mth - 1, d + i, 12);
    const p = (n: number) => String(n).padStart(2, '0');
    const date = `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
    out.push({ date, minor: byDay.get(date) ?? 0 });
  }
  return out;
}

export interface CrossTripRow {
  trip: Trip;
  days: number;
  status: 'upcoming' | 'active' | 'complete';
  totalMinor: number;
  entries: number;
}

export interface CrossTripStats {
  rows: CrossTripRow[];
  totalTrips: number;
  totalDays: number;
  /** Sums are grouped by home currency — never converted between them. */
  totalsByCurrency: { currency: string; minor: number; trips: number }[];
  daysByYear: { year: number; days: number }[];
}

export function crossTripStats(trips: Trip[], expensesByTrip: Map<string, Expense[]>, now: ISODate): CrossTripStats {
  const rows: CrossTripRow[] = trips
    .filter((t) => !t.archived)
    .sort((a, b) => compareIso(b.start, a.start))
    .map((trip) => {
      const expenses = expensesByTrip.get(trip.id) ?? [];
      const phase = tripPhase(trip, now);
      return {
        trip,
        days: tripDays(trip),
        status: phase === 'before' ? 'upcoming' : phase === 'during' ? 'active' : 'complete',
        totalMinor: sumMinor(expenses),
        entries: expenses.length,
      };
    });

  const byCur = new Map<string, { minor: number; trips: number }>();
  for (const r of rows) {
    const cur = r.trip.homeCurrency;
    const prev = byCur.get(cur) ?? { minor: 0, trips: 0 };
    byCur.set(cur, { minor: prev.minor + r.totalMinor, trips: prev.trips + 1 });
  }

  const byYear = new Map<number, number>();
  for (const r of rows) {
    if (r.status === 'upcoming') continue;
    const year = Number(r.trip.start.slice(0, 4));
    byYear.set(year, (byYear.get(year) ?? 0) + r.days);
  }

  return {
    rows,
    totalTrips: rows.length,
    totalDays: rows.filter((r) => r.status !== 'upcoming').reduce((n, r) => n + r.days, 0),
    totalsByCurrency: [...byCur.entries()].map(([currency, v]) => ({ currency, ...v })),
    daysByYear: [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([year, days]) => ({ year, days })),
  };
}

/** Per-category totals limited to what actually has spend, biggest first. */
export function topCategories(
  expenses: Expense[],
  categories: ExpenseCategory[],
): { label: string; color: string; minor: number }[] {
  const byCat = new Map<string, number>();
  for (const e of expenses) byCat.set(e.categoryId, (byCat.get(e.categoryId) ?? 0) + signed(e));
  return categories
    .map((c) => ({ label: c.label, color: c.color, minor: byCat.get(c.id) ?? 0 }))
    .filter((x) => x.minor !== 0)
    .sort((a, b) => b.minor - a.minor);
}
