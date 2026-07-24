import { describe, expect, it } from 'vitest';
import {
  categoryTotals,
  expensesToCsv,
  fmtMoney,
  fmtMoneyWide,
  groupByDay,
  signed,
  sumMinor,
  toHomeMinor,
} from '../lib/logic/money';
import type { Expense, ExpenseCategory } from '../lib/model/types';

const cat = (id: string, label: string, plan: number, order = 0): ExpenseCategory => ({
  id, tripId: 't', label, planMinor: plan, color: '#888', order,
});
const exp = (over: Partial<Expense> = {}): Expense => ({
  id: 'e1', tripId: 't', date: '2026-12-15', categoryId: 'food', desc: 'Hotpot',
  amount: 180, currency: 'CNY', rateToHome: 7.15, homeMinor: 2517,
  payment: 'card', refund: false, ts: 1, ...over,
});

describe('currency conversion', () => {
  it('matches the legacy tracker: ¥180 at 7.15 → $25.17', () => {
    expect(toHomeMinor(180, 7.15)).toBe(2517);
  });
  it('is exact for the home currency', () => {
    expect(toHomeMinor(42.5, 1)).toBe(4250);
  });
  it('rounds to whole cents', () => {
    expect(toHomeMinor(100, 3)).toBe(3333);
    expect(toHomeMinor(1, 7.8)).toBe(13); // HK$1 ≈ $0.128
  });
});

describe('refunds', () => {
  it('count as negative', () => {
    expect(signed(exp({ refund: true }))).toBe(-2517);
    expect(signed(exp())).toBe(2517);
  });
  it('net out against a spend', () => {
    expect(sumMinor([exp(), exp({ id: 'e2', refund: true })])).toBe(0);
  });
});

describe('category totals', () => {
  const cats = [cat('food', 'Food', 90000), cat('ski', 'Ski', 35000, 1)];
  it('sums per category and flags over budget', () => {
    const t = categoryTotals([exp({ categoryId: 'ski', homeMinor: 40000 })], cats);
    const ski = t.find((x) => x.category.id === 'ski');
    expect(ski?.spentMinor).toBe(40000);
    expect(ski?.state).toBe('over');
    expect(ski?.pct).toBe(100); // clamped for the meter
  });
  it('warns above 85 percent', () => {
    const t = categoryTotals([exp({ categoryId: 'food', homeMinor: 80000 })], cats);
    expect(t.find((x) => x.category.id === 'food')?.state).toBe('warn');
  });
  it('never warns on a category with no budget', () => {
    const t = categoryTotals([exp({ categoryId: 'x', homeMinor: 99999 })], [cat('x', 'X', 0)]);
    expect(t[0]?.state).toBe('ok');
  });
  it('keeps categories with no spend', () => {
    expect(categoryTotals([], cats)).toHaveLength(2);
  });
});

describe('grouping', () => {
  it('puts the newest day first and subtotals each day', () => {
    const g = groupByDay([
      exp({ id: 'a', date: '2026-12-14', homeMinor: 1000 }),
      exp({ id: 'b', date: '2026-12-15', homeMinor: 2000 }),
      exp({ id: 'c', date: '2026-12-15', homeMinor: 500 }),
    ]);
    expect(g.map((d) => d.date)).toEqual(['2026-12-15', '2026-12-14']);
    expect(g[0]?.totalMinor).toBe(2500);
  });
});

describe('formatting', () => {
  it('always shows two decimals', () => {
    expect(fmtMoney(2517)).toBe('$25.17');
    expect(fmtMoney(100000)).toBe('$1,000.00');
  });
  it('signs negatives before the symbol', () => {
    expect(fmtMoney(-2517)).toBe('-$25.17');
  });
  it('rounds for the wide form', () => {
    expect(fmtMoneyWide(431050)).toBe('$4,311');
  });
});

describe('CSV export', () => {
  const csv = expensesToCsv([exp({ desc: 'Dinner, with "wine"' })], [cat('food', 'Food', 0)]);
  it('has the documented header', () => {
    expect(csv.split('\r\n')[0]).toContain('date,category,description,amount,currency,rate_to_home,home_amount,paid_with,refund');
  });
  it('quotes and escapes', () => {
    expect(csv).toContain('"Dinner, with ""wine"""');
  });
  it('neutralizes formula injection', () => {
    const evil = expensesToCsv([exp({ desc: '=cmd|calc' })], [cat('food', 'Food', 0)]);
    expect(evil).toContain(`"'=cmd|calc"`);
  });
  it('writes the home amount in major units', () => {
    expect(csv).toContain(',25.17,');
  });
});
