/* THE GLANCE TILES' NUMBERS (f-now) — the NEXT tile's countdown and where
   its sun sits on the arc.

   THE ARC IS REAL TIME, OR NOTHING. It runs from the last fixed thing of the
   day already behind you (a leg that landed, a timed plan line) — else from
   the waking hour — to the commitment's own stated clock, and the sun sits
   at the minute it is now. On any other day, or for a commitment that states
   no time, the sun waits at the start of the arc: no progress is claimed
   that the clock has not made. */
import type { HHMM, ISODate } from '../model/types';
import { commitmentAt } from './commitment';
import { daysBetween, ymd } from './dates';
import { DAY_OPEN, timeMinutes, type FixedPoint } from './timeline';
import { S } from '../i18n/strings';

const HOUR = 3_600_000;

/** "5h 13m" · "45m" · "Now" · "Tomorrow" · "3 days" — the loudest number on
    Now. Minutes, never seconds; days beyond 48 hours; null once it has
    passed (the caller says "Today"). */
export function compactCountdown(date: ISODate, time: HHMM | null, now: Date): string | null {
  const days = (): string => {
    const n = daysBetween(ymd(now), date);
    return n <= 0 ? S.glance.today : n === 1 ? S.glance.tomorrow : S.glance.days(n);
  };
  const at = commitmentAt(date, time);
  if (!at) return days();
  const ms = at.getTime() - now.getTime();
  if (ms < 0) return null;
  if (ms < 60_000) return S.glance.now;
  if (ms >= 48 * HOUR) return days();
  const mins = Math.floor(ms / 60_000);
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${mins % 60}m` : `${mins % 60}m`;
}

/** 0 at the start of the arc, 1 at the commitment. `nowMin` is null on any
    day but the real one. */
export function arcProgress(dep: HHMM | null, nowMin: number | null, points: FixedPoint[]): number {
  const end = dep ? timeMinutes(dep) : null;
  if (end === null || nowMin === null) return 0;
  const behind = points.map((p) => p.end ?? p.start).filter((m) => m <= nowMin && m < end);
  const start = Math.min(Math.max(DAY_OPEN, ...behind), nowMin);
  if (end <= start) return 1;
  return Math.max(0, Math.min(1, (nowMin - start) / (end - start)));
}

/** The point on a semicircle of radius r centred at (cx, cy) for progress p
    (0 = left end, 1 = right end, over the top). */
export function arcPoint(p: number, cx: number, cy: number, r: number): { x: number; y: number } {
  const a = Math.PI * (1 - p);
  return { x: Math.round((cx + r * Math.cos(a)) * 10) / 10, y: Math.round((cy - r * Math.sin(a)) * 10) / 10 };
}
