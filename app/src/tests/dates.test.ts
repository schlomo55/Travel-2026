import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, fmtDow, fmtLong, isIsoDate, localToday, parseYmd, weekday, ymd } from '../lib/logic/dates';

describe('dates', () => {
  it('round-trips parse/format', () => {
    expect(ymd(parseYmd('2026-11-21'))).toBe('2026-11-21');
    expect(ymd(parseYmd('2026-01-05'))).toBe('2026-01-05');
  });

  it('parses as LOCAL date, not UTC (the new Date(str) trap)', () => {
    const d = parseYmd('2026-12-21');
    expect(d.getDate()).toBe(21);
    expect(d.getMonth()).toBe(11);
  });

  it('counts whole days across DST transitions (noon anchor)', () => {
    // EU DST ends Oct 25 2026; IL DST also shifts that window.
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(daysBetween('2026-03-27', '2026-03-30')).toBe(3);
  });

  it('matches the trip math: Nov 21 → Dec 27 inclusive = 37 days', () => {
    expect(daysBetween('2026-11-21', '2026-12-27') + 1).toBe(37);
  });

  it('addDays wraps months and years', () => {
    expect(addDays('2026-11-28', 5)).toBe('2026-12-03');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-12-05', -14)).toBe('2026-11-21');
  });

  it('formats without touching the date', () => {
    expect(fmtDow('2026-12-11')).toBe('Fri 11 Dec');
    expect(fmtLong('2026-11-22')).toBe('22 Nov 2026');
    expect(weekday('2026-11-22')).toBe(0); // arrival day is a Sunday — the no-pickup gotcha
  });

  it('localToday honors a valid ?d= override only', () => {
    expect(localToday('2026-12-11')).toBe('2026-12-11');
    expect(localToday('junk')).toBe(ymd(new Date()));
    expect(localToday(null)).toBe(ymd(new Date()));
  });

  it('validates ISO dates', () => {
    expect(isIsoDate('2026-12-01')).toBe(true);
    expect(isIsoDate('2026-1-1')).toBe(false);
  });
});
