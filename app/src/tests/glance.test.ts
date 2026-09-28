/* THE NEXT TILE — a countdown in minutes (never seconds), days beyond two
   days, and a sun that sits where the clock really is, or at the start. */
import { describe, expect, it } from 'vitest';
import { arcPoint, arcProgress, compactCountdown } from '../lib/logic/glance';

const at = (d: string, hh: number, mm = 0): Date => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y!, m! - 1, day!, hh, mm, 0, 0);
};

describe('glance · the countdown', () => {
  it('counts hours and minutes inside two days — the board’s 5h 13m', () => {
    expect(compactCountdown('2026-12-11', '18:15', at('2026-12-11', 13, 2))).toBe('5h 13m');
    expect(compactCountdown('2026-12-11', '18:15', at('2026-12-11', 17, 30))).toBe('45m');
    expect(compactCountdown('2026-12-21', '13:50', at('2026-12-21', 0, 0))).toBe('13h 50m');
  });

  it('says Now in its last minute, and nothing once it has passed', () => {
    expect(compactCountdown('2026-12-11', '18:15', at('2026-12-11', 18, 14, ))).toBe('1m');
    expect(compactCountdown('2026-12-11', '18:15', new Date(at('2026-12-11', 18, 15).getTime() - 30_000))).toBe('Now');
    expect(compactCountdown('2026-12-11', '18:15', at('2026-12-11', 19, 0))).toBeNull();
  });

  it('counts days beyond two days, or when no clock is stated', () => {
    expect(compactCountdown('2026-12-16', '20:20', at('2026-12-11', 12))).toBe('5 days');
    expect(compactCountdown('2026-12-12', null, at('2026-12-11', 12))).toBe('Tomorrow');
    expect(compactCountdown('2026-12-11', null, at('2026-12-11', 12))).toBe('Today');
  });
});

describe('glance · the sun on the arc', () => {
  it('runs from the last fixed thing behind you to the departure', () => {
    /* landed 12:00, flies 18:15, now 13:02 — the board’s sun, low on the left */
    const p = arcProgress('18:15', 13 * 60 + 2, [{ start: 10 * 60, end: 12 * 60, label: 'x' }]);
    expect(p).toBeCloseTo(62 / 375, 3);
  });

  it('starts at the waking hour when nothing is behind you', () => {
    expect(arcProgress('18:00', 13 * 60, [])).toBeCloseTo(300 / 600, 3);
  });

  it('claims nothing on another day or for a commitment with no clock', () => {
    expect(arcProgress('18:15', null, [])).toBe(0);
    expect(arcProgress(null, 13 * 60, [])).toBe(0);
  });

  it('places the sun on the semicircle, left end to right end over the top', () => {
    expect(arcPoint(0, 32, 32, 26)).toEqual({ x: 6, y: 32 });
    expect(arcPoint(1, 32, 32, 26)).toEqual({ x: 58, y: 32 });
    expect(arcPoint(0.5, 32, 32, 26)).toEqual({ x: 32, y: 6 });
  });
});
