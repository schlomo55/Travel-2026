import { describe, expect, it } from 'vitest';
import { counterState } from '../lib/logic/counters';
import type { ComplianceCounter } from '../lib/model/types';

const visa: ComplianceCounter = {
  id: 'c',
  tripId: 't',
  name: 'Mainland visa',
  startDate: '2026-11-22',
  countStartsDayAfter: true,
  limitDays: 30,
  hardDeadline: '2026-12-22',
  plannedEndDate: '2026-12-21',
  pinned: true,
};

describe('the visa clock, generalized', () => {
  it('is "before" prior to entry', () => {
    expect(counterState(visa, '2026-11-20').phase).toBe('before');
  });

  it('entry day is day 0 — the count starts the day AFTER entry (embassy-verified)', () => {
    const s = counterState(visa, '2026-11-22');
    expect(s.phase).toBe('entryDay');
    expect(s.day).toBe(0);
  });

  it('Nov 23 is mainland day 1', () => {
    const s = counterState(visa, '2026-11-23');
    expect(s.phase).toBe('counting');
    expect(s.day).toBe(1);
    expect(s.remaining).toBe(29);
  });

  it('the planned Dec 21 exit is day 29 — a one-day buffer', () => {
    const s = counterState(visa, '2026-12-21');
    expect(s.day).toBe(29);
    expect(s.remaining).toBe(1);
  });

  it('after the planned exit the counter reads complete', () => {
    expect(counterState(visa, '2026-12-22').phase).toBe('complete');
    expect(counterState(visa, '2026-12-25').phase).toBe('complete');
  });

  it('without plannedEndDate, day 30 still counts and day 31 is over the limit', () => {
    const open: ComplianceCounter = { ...visa, plannedEndDate: undefined };
    expect(counterState(open, '2026-12-22')).toMatchObject({ phase: 'counting', day: 30, remaining: 0 });
    expect(counterState(open, '2026-12-23').phase).toBe('overLimit');
  });

  it('a plain counter (no day-after rule) starts at day 1', () => {
    const plain: ComplianceCounter = { ...visa, countStartsDayAfter: false, plannedEndDate: undefined };
    expect(counterState(plain, '2026-11-22')).toMatchObject({ phase: 'counting', day: 1 });
  });
});
