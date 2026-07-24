import { describe, expect, it } from 'vitest';
import { extractLegacyData, importLegacy, isLegacyExpense, type LegacyMappingTargets } from '../lib/logic/legacyImport';
import type { ExpenseCategory } from '../lib/model/types';

const cats: ExpenseCategory[] = [
  { id: 'cn26-cat-food', tripId: 'cn26', label: 'Food', planMinor: 90000, color: '#c98500', order: 0, legacyKey: 'food' },
  { id: 'cn26-cat-other', tripId: 'cn26', label: 'Other', planMinor: 35000, color: '#898781', order: 1, legacyKey: 'other' },
];

const targets: LegacyMappingTargets = {
  tripId: 'cn26',
  categories: cats,
  taskIds: new Set(['cn26-task-insurance', 'cn26-task-hotel-hk']),
  packingIds: new Set(['cn26-pack-p-passport']),
  checklistItemIds: new Set(['cn26-app-a-vpn']),
  alarmIdsByIndex: ['cn26-alarm-00', 'cn26-alarm-01', 'cn26-alarm-02'],
  runbookIds: new Set(['cn26-run-dec11']),
};

const legacyExpense = {
  id: 'e-1', date: '2026-12-15', cat: 'food', desc: 'Hotpot',
  amt: 180, cur: 'CNY', rate: 7.15, usd: 2517, pay: 'cash', refund: false, ts: 1700000000000,
};

describe('legacy shapes', () => {
  it('recognizes an expense row', () => {
    expect(isLegacyExpense(legacyExpense)).toBe(true);
    expect(isLegacyExpense({ id: 'x' })).toBe(false);
    expect(isLegacyExpense(null)).toBe(false);
  });

  it('unwraps the app backup blob', () => {
    const data = extractLegacyData({ app: 'china2026', v: '1.0.0', data: { 'expenses.v1': '[]' } });
    expect(data).toHaveProperty('expenses.v1');
  });

  it('accepts a bare expense array (the trip-guide format)', () => {
    const data = extractLegacyData([legacyExpense]);
    expect(Array.isArray(data?.['expenses.v1'])).toBe(true);
  });

  it('accepts a raw localStorage dump and strips the namespace', () => {
    const data = extractLegacyData({ 'china2026.notes.v1': 'hello' });
    expect(data?.['notes.v1']).toBe('hello');
  });

  it('rejects unrelated JSON', () => {
    expect(extractLegacyData({ hello: 'world' })).toBeNull();
    expect(extractLegacyData([1, 2, 3])).toBeNull();
  });
});

describe('importing an old backup', () => {
  const blob = {
    app: 'china2026',
    data: {
      'expenses.v1': JSON.stringify([legacyExpense, { ...legacyExpense, id: 'e-2', cat: 'unknown-cat', usd: 500 }]),
      'checklist.v1': JSON.stringify({
        'task-insurance': 1,
        'task-does-not-exist': 1,
        'pk-p-passport': 1,
        'app-a-vpn': 1,
        'alarm-01': 1,
        'run-dec11-2026-12-11-3': 1,
        'nonsense-key': 1,
      }),
      'packCustom.v1': JSON.stringify([{ id: 'c1', t: 'Spare laces' }]),
      'notes.v1': 'Remember the 3C logo',
      'giftBalance.v1': '297.7',
    },
  };
  const r = importLegacy(blob, targets)!;

  it('preserves cents and the logged rate exactly', () => {
    const e = r.expenses.find((x) => x.id === 'e-1')!;
    expect(e.homeMinor).toBe(2517);
    expect(e.rateToHome).toBe(7.15);
    expect(e.amount).toBe(180);
    expect(e.currency).toBe('CNY');
    expect(e.payment).toBe('cash');
  });

  it('maps legacy category keys, falling back rather than dropping', () => {
    expect(r.expenses.find((x) => x.id === 'e-1')?.categoryId).toBe('cn26-cat-food');
    expect(r.expenses.find((x) => x.id === 'e-2')?.categoryId).toBe('cn26-cat-other');
  });

  it('lands ticks on the seeded ids', () => {
    expect(r.taskIdsDone).toEqual(['cn26-task-insurance']);
    expect(r.packingIdsDone).toEqual(['cn26-pack-p-passport']);
    expect(r.checklistItemIdsDone).toEqual(['cn26-app-a-vpn']);
    expect(r.alarmIdsDone).toEqual(['cn26-alarm-01']);
  });

  it('rebuilds dated runbook ticks under the new key scheme', () => {
    expect(r.checkState[0]?.key).toBe('cn26:run:cn26-run-dec11:2026-12-11:3');
  });

  it('reports what it could not match instead of dropping it silently', () => {
    expect(r.unmatched).toContain('task-does-not-exist');
    expect(r.unmatched).toContain('nonsense-key');
  });

  it('restores custom packing items with their ticks', () => {
    expect(r.customPacking).toHaveLength(1);
    expect(r.customPacking[0]?.label).toBe('Spare laces');
  });

  it('restores notes and the gift-card balance as minor units', () => {
    expect(r.notes).toBe('Remember the 3C logo');
    expect(r.giftBalanceMinor).toBe(29770);
  });

  it('returns null for something that is not a legacy backup', () => {
    expect(importLegacy({ nope: true }, targets)).toBeNull();
  });
});
