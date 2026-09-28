import { describe, expect, it } from 'vitest';
import { counterState, counterWord } from '../lib/logic/counters';
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

/* Run 3b: the app bar's pill printed "MAINLAND VISA" and grew to 44 % of the
   screen; the boards draw "VISA 19/30". */
describe('counterWord', () => {
  it('names a counter by the thing it counts', () => {
    expect(counterWord('Mainland visa')).toBe('visa');
    expect(counterWord('Sample 60-day permit')).toBe('permit');
    expect(counterWord('ESTA')).toBe('ESTA');
    /* a name that ends in a number goes by its first word */
    expect(counterWord('Schengen 90/180')).toBe('Schengen');
    expect(counterWord('  Visa-free  ')).toBe('Visa-free');
  });

  /* Run 3c: the last word was read as the letters after its digits —
     "Visa-free 240h" → "h", "Transit 144-hour" → "hour" */
  it('never names a counter by the letters left after a number', () => {
    expect(counterWord('Visa-free 240h')).toBe('Visa-free');
    expect(counterWord('Transit 144-hour')).toBe('Transit');
    expect(counterWord('144-hour')).toBe('144-hour');
    expect(counterWord('China 240h visa-free')).toBe('visa-free');
  });
});
