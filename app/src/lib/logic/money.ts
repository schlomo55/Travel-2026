/* Money math, kept identical in spirit to the legacy tracker:
   integer minor units in the trip's home currency, each entry snapshotting the
   rate it was logged with, refunds counted as negatives. */
import type { Expense, ExpenseCategory, Trip } from '../model/types';

/** Amount in `currency` → integer minor units of the home currency. */
export function toHomeMinor(amount: number, rateToHome: number): number {
  return Math.round((amount / rateToHome) * 100);
}

/** A refund subtracts. */
export function signed(e: Pick<Expense, 'homeMinor' | 'refund'>): number {
  return e.refund ? -e.homeMinor : e.homeMinor;
}

export function sumMinor(entries: Pick<Expense, 'homeMinor' | 'refund'>[]): number {
  return entries.reduce((s, e) => s + signed(e), 0);
}

export function symbolFor(trip: Pick<Trip, 'currencies' | 'homeCurrency'>, code: string): string {
  return trip.currencies.find((c) => c.code === code)?.symbol ?? code;
}

export function rateFor(trip: Pick<Trip, 'currencies'>, code: string): number {
  return trip.currencies.find((c) => c.code === code)?.rateToHome ?? 1;
}

/** '$1,234.50' — home currency, always two decimals. */
export function fmtMoney(minor: number, symbol = '$'): string {
  const neg = minor < 0;
  const abs = Math.abs(minor) / 100;
  return `${neg ? '-' : ''}${symbol}${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** '$1,235' — for chips and totals where cents are noise. */
export function fmtMoneyWide(minor: number, symbol = '$'): string {
  const neg = minor < 0;
  return `${neg ? '-' : ''}${symbol}${Math.round(Math.abs(minor) / 100).toLocaleString()}`;
}

export interface CategoryTotal {
  category: ExpenseCategory;
  spentMinor: number;
  planMinor: number;
  pct: number;
  state: 'ok' | 'warn' | 'over';
}

export function categoryTotals(entries: Expense[], categories: ExpenseCategory[]): CategoryTotal[] {
  const byCat = new Map<string, number>();
  for (const e of entries) byCat.set(e.categoryId, (byCat.get(e.categoryId) ?? 0) + signed(e));
  return [...categories]
    .sort((a, b) => a.order - b.order)
    .map((category) => {
      const spentMinor = byCat.get(category.id) ?? 0;
      const planMinor = category.planMinor;
      const pct = planMinor > 0 ? Math.min(100, Math.round((spentMinor / planMinor) * 100)) : 0;
      const state: CategoryTotal['state'] =
        planMinor > 0 && spentMinor > planMinor ? 'over' : planMinor > 0 && spentMinor > planMinor * 0.85 ? 'warn' : 'ok';
      return { category, spentMinor, planMinor, pct, state };
    });
}

export interface DayGroup {
  date: string;
  entries: Expense[];
  totalMinor: number;
}

/** Newest day first, matching the legacy table. */
export function groupByDay(entries: Expense[]): DayGroup[] {
  const m = new Map<string, Expense[]>();
  for (const e of entries) m.set(e.date, [...(m.get(e.date) ?? []), e]);
  return [...m.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, list]) => ({
      date,
      entries: [...list].sort((a, b) => b.ts - a.ts),
      totalMinor: sumMinor(list),
    }));
}

const CSV_HEADER = 'date,category,description,amount,currency,rate_to_home,home_amount,paid_with,refund';

/** Guards against a leading =,+,-,@ turning a cell into a spreadsheet formula. */
function csvCell(value: string): string {
  const s = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${s.replace(/"/g, '""')}"`;
}

export function expensesToCsv(entries: Expense[], categories: ExpenseCategory[]): string {
  const label = new Map(categories.map((c) => [c.id, c.label]));
  const rows = [CSV_HEADER];
  for (const e of [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.ts - b.ts))) {
    rows.push(
      [
        e.date,
        csvCell(label.get(e.categoryId) ?? e.categoryId),
        csvCell(e.desc),
        String(e.amount),
        e.currency,
        String(e.rateToHome),
        (e.homeMinor / 100).toFixed(2),
        e.payment,
        e.refund ? 'yes' : 'no',
      ].join(','),
    );
  }
  return '﻿' + rows.join('\r\n');
}
