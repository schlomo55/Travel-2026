import { describe, expect, it } from 'vitest';
import { addDays, compareClock, daysBetween, fmtDow, fmtLong, isIsoDate, localToday, parseYmd, weekday, ymd } from '../lib/logic/dates';

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

/* Run 4: clock times sort by a plain comparison (no ICU collator on a cold
   start) — the order localeCompare gave every real time, and the right one. */
describe('compareClock', () => {
  it('orders clock times by the time of day', () => {
    const day = ['18:15', '06:30', '12:35', '00:00', '23:59', '12:05'];
    expect([...day].sort(compareClock)).toEqual(['00:00', '06:30', '12:05', '12:35', '18:15', '23:59']);
    expect(compareClock('08:45', '08:45')).toBe(0);
    expect(compareClock('99:99', '23:59')).toBe(1); // the "no time" sentinel sorts last
  });

  it('agrees with localeCompare on every zero-padded time of the day', () => {
    const all: string[] = [];
    for (let h = 0; h < 24; h++) for (let m = 0; m < 60; m += 7) all.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    const shuffled = [...all].reverse();
    expect([...shuffled].sort(compareClock)).toEqual([...shuffled].sort((a, b) => a.localeCompare(b)));
  });

  it('sorts an hour written without its leading zero as its padded self', () => {
    expect(['10:00', '6:30', '9:05'].sort(compareClock)).toEqual(['6:30', '9:05', '10:00']);
    expect(compareClock('6:30', '06:30')).toBe(0);
  });

  /* Run 4b: an approximate time kept its '~', which sorts after every digit —
     "~07:30" came after 23:59, and after the '99:99' that means "no time"
     (logic/commitment.ts), so a leg at about half past seven sorted behind
     the day's untimed check-in */
  it('sorts an approximate time (~, ≈, a stray space) as the time it gives', () => {
    expect(compareClock('~07:30', '07:30')).toBe(0);
    expect(compareClock('≈07:30', '07:30')).toBe(0);
    expect(compareClock('~ 7:30', '07:30')).toBe(0);
    expect(compareClock(' 07:30', '07:30')).toBe(0);
    expect(compareClock('~07:30', '08:00')).toBeLessThan(0);
    expect(compareClock('~07:30', '99:99')).toBeLessThan(0);
    expect(['23:59', '~07:30', '99:99', '06:00', '≈12:00'].sort(compareClock)).toEqual(['06:00', '~07:30', '≈12:00', '23:59', '99:99']);
  });
});
